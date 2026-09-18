"""
    VersionedJSONStore

Crash-safe versioned JSON persistence with atomic writes and schema migration.

Data is stored in a `{schemaVersion, data}` envelope so that format migrations
can detect and reject files written by newer versions. Raw arrays/objects (the
pre-envelope format) are still accepted for backwards compatibility.

Write safety: `atomic_write!` writes to a temporary file in the same directory
then renames it over the target. If the process crashes mid-write, the target
file is either the old complete version or the new complete version — never
half-written.

Zero external dependencies — uses only Julia stdlib.

# Example

```julia
using VersionedJSONStore

store = Store("config.json"; schema_version=2, max_bytes=4*1024*1024)

# Save
save!(store, Dict("theme" => "dark", "lang" => "en"))

# Load
config = load(store)
# Dict("theme" => "dark", "lang" => "en")
```
"""
module VersionedJSONStore

export Store, StorageError, atomic_write!, load, normalize_json, save!,
    parse_json, json_string

const DEFAULT_MAX_BYTES = 4 * 1024 * 1024

struct StorageError <: Exception
    code::Symbol
    path::String
    detail::String
end

function Base.showerror(io::IO, error::StorageError)
    print(io, error.detail)
end

struct Store
    path::String
    schema_version::Int
    max_bytes::Int
end

function Store(path::AbstractString; schema_version::Integer=1,
               max_bytes::Integer=DEFAULT_MAX_BYTES)
    schema_version >= 1 || throw(ArgumentError("schema_version must be positive"))
    max_bytes > 0 || throw(ArgumentError("max_bytes must be positive"))
    Store(String(path), Int(schema_version), Int(max_bytes))
end

# ── Minimal JSON parser (zero dependencies) ────────────────────────────────

function _skip_whitespace(s::AbstractString, i::Int)
    while i <= length(s) && s[i] in (' ', '\t', '\n', '\r')
        i += 1
    end
    return i
end

function _parse_string(s::AbstractString, i::Int)
    i > length(s) && throw(ArgumentError("unexpected end of JSON string"))
    buf = Char[]
    while i <= length(s)
        c = s[i]
        if c == '"'
            return (String(buf), i + 1)
        elseif c == '\\' && i + 1 <= length(s)
            i += 1
            esc = s[i]
            if esc == '"' push!(buf, '"')
            elseif esc == '\\' push!(buf, '\\')
            elseif esc == '/' push!(buf, '/')
            elseif esc == 'n' push!(buf, '\n')
            elseif esc == 'r' push!(buf, '\r')
            elseif esc == 't' push!(buf, '\t')
            elseif esc == 'b' push!(buf, '\b')
            elseif esc == 'f' push!(buf, '\f')
            elseif esc == 'u' && i + 4 <= length(s)
                hex = s[i+1:i+4]
                push!(buf, Char(parse(UInt16, hex; base=16)))
                i += 4
            else
                push!(buf, esc)
            end
        else
            push!(buf, c)
        end
        i += 1
    end
    throw(ArgumentError("unterminated JSON string"))
end

function _parse_value(s::AbstractString, i::Int)
    i = _skip_whitespace(s, i)
    i > length(s) && throw(ArgumentError("unexpected end of JSON input"))
    c = s[i]

    if c == '"'
        return _parse_string(s, i + 1)
    elseif c == '{'
        return _parse_object(s, i + 1)
    elseif c == '['
        return _parse_array(s, i + 1)
    elseif c == 't' && i + 3 <= length(s) && s[i:i+3] == "true"
        return (true, i + 4)
    elseif c == 'f' && i + 4 <= length(s) && s[i:i+4] == "false"
        return (false, i + 5)
    elseif c == 'n' && i + 3 <= length(s) && s[i:i+3] == "null"
        return (nothing, i + 4)
    elseif c == '-' || isdigit(c)
        return _parse_number(s, i)
    else
        throw(ArgumentError("unexpected character '$(c)' at position $i"))
    end
end

function _parse_number(s::AbstractString, i::Int)
    start = i
    if i <= length(s) && s[i] == '-'
        i += 1
    end
    while i <= length(s) && isdigit(s[i])
        i += 1
    end
    if i <= length(s) && s[i] == '.'
        i += 1
        while i <= length(s) && isdigit(s[i])
            i += 1
        end
    end
    if i <= length(s) && s[i] in ('e', 'E')
        i += 1
        if i <= length(s) && s[i] in ('+', '-')
            i += 1
        end
        while i <= length(s) && isdigit(s[i])
            i += 1
        end
    end
    numstr = s[start:i-1]
    if occursin('.', numstr) || occursin('e', numstr) || occursin('E', numstr)
        return (parse(Float64, numstr), i)
    else
        return (parse(Int, numstr), i)
    end
end

function _parse_object(s::AbstractString, i::Int)
    i = _skip_whitespace(s, i)
    dict = Dict{String,Any}()
    i > length(s) && throw(ArgumentError("unexpected end of JSON object"))
    if s[i] == '}'
        return (dict, i + 1)
    end
    while true
        i = _skip_whitespace(s, i)
        i > length(s) && throw(ArgumentError("unexpected end of JSON object"))
        if s[i] != '"'
            throw(ArgumentError("expected string key in JSON object"))
        end
        key, i = _parse_string(s, i + 1)
        i = _skip_whitespace(s, i)
        i > length(s) && throw(ArgumentError("unexpected end of JSON object"))
        s[i] != ':' && throw(ArgumentError("expected ':' in JSON object"))
        i += 1
        val, i = _parse_value(s, i)
        dict[key] = val
        i = _skip_whitespace(s, i)
        i > length(s) && throw(ArgumentError("unexpected end of JSON object"))
        if s[i] == '}'
            return (dict, i + 1)
        elseif s[i] == ','
            i += 1
        else
            throw(ArgumentError("expected ',' or '}' in JSON object"))
        end
    end
end

function _parse_array(s::AbstractString, i::Int)
    i = _skip_whitespace(s, i)
    arr = Any[]
    i > length(s) && throw(ArgumentError("unexpected end of JSON array"))
    if s[i] == ']'
        return (arr, i + 1)
    end
    while true
        val, i = _parse_value(s, i)
        push!(arr, val)
        i = _skip_whitespace(s, i)
        i > length(s) && throw(ArgumentError("unexpected end of JSON array"))
        if s[i] == ']'
            return (arr, i + 1)
        elseif s[i] == ','
            i += 1
        else
            throw(ArgumentError("expected ',' or ']' in JSON array"))
        end
    end
end

"""
    parse_json(s::AbstractString)

Parse a JSON string into a Julia value. Returns `Dict{String,Any}` for objects,
`Vector{Any}` for arrays, and primitive types for strings, numbers, booleans,
and null.
"""
function parse_json(s::AbstractString)
    input = strip(s)
    val, next_index = _parse_value(input, 1)
    _skip_whitespace(input, next_index) > length(input) ||
        throw(ArgumentError("trailing content after JSON value"))
    return val
end

# ── Minimal JSON serializer ────────────────────────────────────────────────

_json_escape(s::AbstractString) = replace(s, "\\" => "\\\\", "\"" => "\\\"",
    "\n" => "\\n", "\r" => "\\r", "\t" => "\\t")

function _json_write(io::IO, v::String)
    write(io, '"', _json_escape(v), '"')
end

function _json_write(io::IO, v::Bool)
    write(io, v ? "true" : "false")
end

function _json_write(io::IO, v::Nothing)
    write(io, "null")
end

function _json_write(io::IO, v::Real)
    write(io, string(v))
end

function _json_write(io::IO, v::Vector)
    write(io, '[')
    for (i, item) in enumerate(v)
        i > 1 && write(io, ',')
        _json_write(io, item)
    end
    write(io, ']')
end

function _json_write(io::IO, v::Dict)
    write(io, '{')
    first = true
    for (k, val) in v
        first || write(io, ',')
        first = false
        _json_write(io, string(k))
        write(io, ':')
        _json_write(io, val)
    end
    write(io, '}')
end

_json_write(io::IO, v::Any) = _json_write(io, string(v))

json_string(d::Any) = sprint(_json_write, d)

# ── Normalize ──────────────────────────────────────────────────────────────

"""
    normalize_json(value)

Recursively convert nested Dict/Array to `Dict{String,Any}` and `Vector{Any}`
with string keys. Useful for normalizing data from different JSON parsers.
"""
function normalize_json(value)
    if value isa AbstractDict
        return Dict{String,Any}(string(key) => normalize_json(item) for (key, item) in pairs(value))
    elseif value isa AbstractVector
        return Any[normalize_json(item) for item in value]
    end
    value
end

# ── Store API ──────────────────────────────────────────────────────────────

function _storage_error(code::Symbol, store::Store, detail)
    StorageError(code, store.path, String(detail))
end

"""
    load(store::Store; default=nothing)

Read and deserialize the stored JSON file. Returns the `data` field from the
envelope if present, or the raw value for pre-envelope files. Throws
`StorageError` for corrupt, oversized, or unsupported files.
"""
function load(store::Store; default=nothing)
    isfile(store.path) || return deepcopy(default)

    size = try
        filesize(store.path)
    catch error
        throw(_storage_error(:unavailable, store, "could not inspect $(store.path): $(sprint(showerror, error))"))
    end
    size <= store.max_bytes || throw(_storage_error(
        :too_large,
        store,
        "stored data exceeds the $(store.max_bytes)-byte limit: $(store.path)",
    ))

    raw = try
        read(store.path, String)
    catch error
        throw(_storage_error(:unavailable, store, "could not read $(store.path): $(sprint(showerror, error))"))
    end
    value = try
        normalize_json(parse_json(raw))
    catch error
        throw(_storage_error(:corrupt, store, "stored data is not valid JSON: $(store.path): $(sprint(showerror, error))"))
    end

    if value isa AbstractDict && haskey(value, "schemaVersion")
        version = value["schemaVersion"]
        version isa Integer || throw(_storage_error(:corrupt, store, "schemaVersion is invalid: $(store.path)"))
        version <= store.schema_version || throw(_storage_error(
            :unsupported,
            store,
            "stored schema version $(version) is newer than $(store.schema_version): $(store.path)",
        ))
        haskey(value, "data") || throw(_storage_error(:corrupt, store, "stored envelope has no data: $(store.path)"))
        return value["data"]
    end
    value
end

"""
    atomic_write!(path, data)

Write `data` to `path` atomically: write to a temp file in the same directory,
then rename over the target. If the write or rename fails, the temp file is
cleaned up and the original file (if any) is left intact.
"""
function atomic_write!(path::AbstractString, data)
    directory = dirname(path)
    try
        isdir(directory) || mkpath(directory)
        temporary = tempname(directory)
        try
            write(temporary, data)
            mv(temporary, path; force=true)
        catch
            isfile(temporary) && rm(temporary; force=true)
            rethrow()
        end
    catch error
        error isa StorageError && rethrow()
        throw(StorageError(:write_failed, String(path), "could not atomically write $(path): $(sprint(showerror, error))"))
    end
    nothing
end

"""
    save!(store::Store, value)

Serialize `value` into a `{schemaVersion, data}` envelope, check the serialized
size against `store.max_bytes`, and write atomically. Returns `value` on success.
"""
function save!(store::Store, value)
    payload = try
        json_string(Dict("schemaVersion" => store.schema_version, "data" => value))
    catch error
        throw(_storage_error(:invalid, store, "value cannot be serialized: $(sprint(showerror, error))"))
    end
    ncodeunits(payload) <= store.max_bytes || throw(_storage_error(
        :too_large,
        store,
        "serialized data exceeds the $(store.max_bytes)-byte limit: $(store.path)",
    ))
    try
        atomic_write!(store.path, payload)
    catch error
        error isa StorageError && rethrow()
        throw(_storage_error(:write_failed, store, sprint(showerror, error)))
    end
    value
end

end
