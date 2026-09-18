"""
    StructuredDiagnostics

Bounded structured diagnostics for humans, support tools, and AI agents.
Provides JSON logging with rotation, in-memory buffer, and correlation IDs.

Zero external dependencies — uses only Julia stdlib (`Dates`).
JSON serialization is handled inline for maximum portability.

# Example

```julia
using StructuredDiagnostics

store = DiagnosticsStore(
    path = joinpath(logdir(), "app.jsonl"),
    max_memory_entries = 500,
    max_log_bytes = 2 * 1024 * 1024,
)

record!(store;
    level = "warn",
    source = "backend",
    event = "slow_query",
    request_id = "req-42",
    operation = "findAll",
    code = "PERF_SLOW",
    message = "query took 3200ms",
    category = "performance",
    recoverable = true,
    duration_ms = 3200.0,
    details = Dict("table" => "users", "rows" => 15000),
)

entries = recent(store, 50)
```
"""
module StructuredDiagnostics

using Dates

export DiagnosticsStore, clear!, configure!, log_path, recent, record!,
    recover!, sanitize_details

const SCHEMA_VERSION = 1

"""
    DiagnosticsStore(; path="", max_memory_entries=500, max_log_bytes=2*1024*1024)

Create a bounded, thread-safe diagnostics store. Entries are written to a
JSONL file at `path` (if non-empty) and retained in memory for fast querying.

When the log file exceeds `max_log_bytes`, it is rotated to `path * ".1"`.
At most `max_memory_entries` are kept in memory (oldest evicted first).
"""
mutable struct DiagnosticsStore
    lock::ReentrantLock
    entries::Vector{Dict{String,Any}}
    path::String
    max_memory_entries::Int
    max_log_bytes::Int
    max_detail_bytes::Int
end

function DiagnosticsStore(;
    path::AbstractString = "",
    max_memory_entries::Integer = 500,
    max_log_bytes::Integer = 2 * 1024 * 1024,
    max_detail_bytes::Integer = 16 * 1024,
)
    max_memory_entries > 0 || throw(ArgumentError("max_memory_entries must be positive"))
    max_log_bytes > 0 || throw(ArgumentError("max_log_bytes must be positive"))
    max_detail_bytes > 0 || throw(ArgumentError("max_detail_bytes must be positive"))

    resolved = isempty(path) ? "" : abspath(String(path))
    if !isempty(resolved)
        mkpath(dirname(resolved))
    end

    return DiagnosticsStore(
        ReentrantLock(),
        Dict{String,Any}[],
        resolved,
        Int(max_memory_entries),
        Int(max_log_bytes),
        Int(max_detail_bytes),
    )
end

# ── Minimal JSON serialization (no external deps) ──────────────────────────

_json_escape(s::AbstractString) = replace(s, "\\" => "\\\\", "\"" => "\\\"",
    "\n" => "\\n", "\r" => "\\r", "\t" => "\\t")

function _json_value(io::IO, v::String)
    write(io, '"', _json_escape(v), '"')
end

function _json_value(io::IO, v::Bool)
    write(io, v ? "true" : "false")
end

function _json_value(io::IO, v::Nothing)
    write(io, "null")
end

function _json_value(io::IO, v::Real)
    write(io, string(v))
end

function _json_value(io::IO, v::Vector)
    write(io, '[')
    for (i, item) in enumerate(v)
        i > 1 && write(io, ',')
        _json_value(io, item)
    end
    write(io, ']')
end

function _json_value(io::IO, v::Dict)
    write(io, '{')
    first = true
    for (k, val) in v
        first || write(io, ',')
        first = false
        _json_value(io, string(k))
        write(io, ':')
        _json_value(io, val)
    end
    write(io, '}')
end

_json_value(io::IO, v::Any) = _json_value(io, string(v))

_json(d::Dict) = sprint(_json_value, d)

const _SENSITIVE_KEYS = Set((
    "authorization", "cookie", "credential", "credentials", "password",
    "secret", "token", "access_token", "api_key", "apikey",
))
const _MAX_DETAIL_DEPTH = 8
const _MAX_DETAIL_STRING_CHARS = 4096

_sensitive_key(key) = lowercase(replace(String(key), '-' => '_')) in _SENSITIVE_KEYS

function _sanitize_value(value, depth::Int)
    depth > _MAX_DETAIL_DEPTH && return "[truncated: depth limit]"
    if value isa AbstractDict
        output = Dict{String,Any}()
        for (key, item) in pairs(value)
            string_key = string(key)
            output[string_key] = _sensitive_key(string_key) ? "[REDACTED]" :
                _sanitize_value(item, depth + 1)
        end
        return output
    elseif value isa AbstractVector || value isa Tuple
        return Any[_sanitize_value(item, depth + 1) for item in value]
    elseif value isa AbstractString
        sanitized = replace(String(value), homedir() => "~")
        return length(sanitized) <= _MAX_DETAIL_STRING_CHARS ? sanitized :
            first(sanitized, _MAX_DETAIL_STRING_CHARS) * "...[truncated]"
    elseif value isa Nothing || value isa Bool || value isa Real
        return value
    end
    return _sanitize_value(string(value), depth)
end

"""Recursively redact credentials, home paths, deep values, and long strings."""
function sanitize_details(details; max_bytes::Integer=16 * 1024)
    max_bytes > 0 || throw(ArgumentError("max_bytes must be positive"))
    sanitized = details isa AbstractDict ? _sanitize_value(details, 0) : Dict{String,Any}()
    ncodeunits(_json(sanitized)) <= max_bytes && return sanitized
    Dict{String,Any}("_truncated" => true, "_reason" => "details exceeded byte limit")
end

# ── Store API ──────────────────────────────────────────────────────────────

"""
    configure!(store, path)

Set or change the log file path. Creates parent directories as needed.
Returns the resolved absolute path.
"""
function configure!(store::DiagnosticsStore, path::AbstractString)
    lock(store.lock) do
        store.path = abspath(String(path))
        mkpath(dirname(store.path))
    end
    return store.path
end

"""
    log_path(store) -> String

Return the current log file path.
"""
log_path(store::DiagnosticsStore) = store.path

function _rotate_if_needed(store::DiagnosticsStore)
    path = store.path
    isempty(path) && return
    isfile(path) && filesize(path) >= store.max_log_bytes || return
    mv(path, path * ".1"; force=true)
end

"""
    record!(store; level, source, event, request_id="", operation="",
            code="", message="", category="application", recoverable=false,
            duration_ms=nothing, details=Dict{String,Any}())

Record a structured diagnostic entry. The entry is appended to the in-memory
buffer and (if configured) written to the JSONL log file. Failures in file
I/O are silently swallowed — diagnostics must never break the operation
being diagnosed.

Returns the entry as a `Dict{String,Any}`.
"""
function record!(
    store::DiagnosticsStore;
    level::AbstractString = "info",
    source::AbstractString = "backend",
    event::AbstractString,
    request_id::AbstractString = "",
    operation::AbstractString = "",
    code::AbstractString = "",
    message::AbstractString = "",
    category::AbstractString = "application",
    recoverable = false,
    duration_ms = nothing,
    details = Dict{String,Any}(),
)
    entry = Dict{String,Any}(
        "schemaVersion" => SCHEMA_VERSION,
        "timestamp" => Dates.format(now(UTC), dateformat"yyyy-mm-ddTHH:MM:SS.sssZ"),
        "level" => String(level),
        "source" => String(source),
        "event" => String(event),
        "requestId" => String(request_id),
        "operation" => String(operation),
        "code" => String(code),
        "message" => String(message),
        "category" => String(category),
        "recoverable" => recoverable === true,
        "details" => sanitize_details(details; max_bytes=store.max_detail_bytes),
    )
    duration_ms === nothing || (entry["durationMs"] = round(Float64(duration_ms); digits=3))

    lock(store.lock) do
        push!(store.entries, entry)
        if length(store.entries) > store.max_memory_entries
            excess = length(store.entries) - store.max_memory_entries
            deleteat!(store.entries, 1:excess)
        end
        if !isempty(store.path)
            try
                _rotate_if_needed(store)
                open(store.path, "a") do io
                    write(io, _json(entry))
                    write(io, '\n')
                end
            catch
            end
        end
    end
    return entry
end

"""
    recover!(store, parse_line) -> Int

Load valid diagnostic objects from the current JSONL file into memory. Invalid
or truncated lines are ignored. `parse_line` keeps this package independent of
a specific JSON parser and must return an `AbstractDict` for valid lines.
"""
function recover!(store::DiagnosticsStore, parse_line::Function)
    isempty(store.path) && return 0
    isfile(store.path) || return 0
    recovered = Dict{String,Any}[]
    for line in eachline(store.path)
        isempty(strip(line)) && continue
        value = try
            parse_line(line)
        catch
            continue
        end
        value isa AbstractDict || continue
        entry = Dict{String,Any}(string(key) => _sanitize_value(item, 0)
            for (key, item) in pairs(value))
        haskey(entry, "event") || continue
        push!(recovered, entry)
    end
    lock(store.lock) do
        append!(store.entries, recovered)
        if length(store.entries) > store.max_memory_entries
            deleteat!(store.entries, 1:length(store.entries) - store.max_memory_entries)
        end
    end
    length(recovered)
end

"""
    recent(store, limit=200) -> Vector{Dict{String,Any}}

Return the most recent `limit` entries from the in-memory buffer, ordered
oldest-first.
"""
function recent(store::DiagnosticsStore, limit::Integer = 200)
    bounded = clamp(Int(limit), 1, store.max_memory_entries)
    return lock(store.lock) do
        first_idx = max(1, length(store.entries) - bounded + 1)
        deepcopy(store.entries[first_idx:end])
    end
end

"""
    clear!(store) -> true

Clear all in-memory entries and truncate the log file.
"""
function clear!(store::DiagnosticsStore)
    lock(store.lock) do
        empty!(store.entries)
        if !isempty(store.path) && isfile(store.path)
            open(store.path, "w") do _ end
        end
    end
    return true
end

end
