"""
    Persistence

Versioned JSON storage with atomic writes. Data is stored in a
`{schemaVersion, data}` envelope so that format migrations can detect and
reject files written by newer versions. Raw arrays/objects (the pre-envelope
format) are still accepted for backwards compatibility.

Write safety: `atomic_write!` writes to a temporary file in the same directory
then renames it over the target. If the process crashes mid-write, the target
file is either the old complete version or the new complete version — never
half-written.
"""
module Persistence

using JSON3

export Store, StorageError, atomic_write!, load, normalize_json, save!

# Default 4 MB limit prevents unbounded writes from filling the disk.
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

"""
    normalize_json(value)

Recursively convert JSON3.Object and JSON3.Array to plain Dict{String,Any} and
Vector{Any}. JSON3's lazy types do not survive serialization round-trips, so
all loaded data is normalized before the rest of the application sees it.
"""
function normalize_json(value)
    if value isa JSON3.Object
        return Dict{String,Any}(string(key) => normalize_json(item) for (key, item) in pairs(value))
    elseif value isa JSON3.Array
        return Any[normalize_json(item) for item in value]
    elseif value isa AbstractDict
        return Dict{String,Any}(string(key) => normalize_json(item) for (key, item) in pairs(value))
    elseif value isa AbstractVector
        return Any[normalize_json(item) for item in value]
    end
    value
end

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
        normalize_json(JSON3.read(raw))
    catch error
        throw(_storage_error(:corrupt, store, "stored data is not valid JSON: $(store.path): $(sprint(showerror, error))"))
    end

    # Raw arrays/objects are the pre-envelope format and remain readable once.
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
        JSON3.write(Dict("schemaVersion" => store.schema_version, "data" => value))
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
