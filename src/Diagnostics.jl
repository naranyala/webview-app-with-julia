"""Bounded structured diagnostics for humans, support tools, and AI agents."""
module Diagnostics

using Dates
using JSON3

export clear!, configure!, log_path, recent, record!

const SCHEMA_VERSION = 1
const MAX_MEMORY_ENTRIES = 500
const MAX_LOG_BYTES = 2 * 1024 * 1024
const ENTRIES = Dict{String,Any}[]
const LOCK = ReentrantLock()
const LOG_PATH = Ref("")

log_path() = LOG_PATH[]

function configure!(path::AbstractString)
    LOG_PATH[] = abspath(String(path))
    mkpath(dirname(LOG_PATH[]))
    LOG_PATH[]
end

function _rotate_if_needed(path)
    isfile(path) && filesize(path) >= MAX_LOG_BYTES || return
    mv(path, path * ".1"; force=true)
end

function record!(; level="info", source="backend", event, request_id="",
                 operation="", code="", message="", category="application",
                 recoverable=false, duration_ms=nothing, details=Dict{String,Any}())
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
        "details" => details isa AbstractDict ? Dict(string(k) => v for (k, v) in details) : Dict{String,Any}(),
    )
    duration_ms === nothing || (entry["durationMs"] = round(Float64(duration_ms); digits=3))
    lock(LOCK) do
        push!(ENTRIES, entry)
        length(ENTRIES) > MAX_MEMORY_ENTRIES && deleteat!(ENTRIES, 1:length(ENTRIES)-MAX_MEMORY_ENTRIES)
        path = LOG_PATH[]
        if !isempty(path)
            try
                _rotate_if_needed(path)
                open(path, "a") do io
                    JSON3.write(io, entry)
                    write(io, '\n')
                end
            catch
                # Diagnostics must never break the operation being diagnosed.
            end
        end
    end
    entry
end

function recent(limit::Integer=200)
    bounded = clamp(Int(limit), 1, MAX_MEMORY_ENTRIES)
    lock(LOCK) do
        first = max(1, length(ENTRIES) - bounded + 1)
        deepcopy(ENTRIES[first:end])
    end
end

function clear!()
    lock(LOCK) do
        empty!(ENTRIES)
        path = LOG_PATH[]
        !isempty(path) && isfile(path) && open(path, "w") do _ end
    end
    true
end

end
