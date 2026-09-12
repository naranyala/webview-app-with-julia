"""
    Backend

Central request dispatcher for the webview application. All 36 frontend
bindings are routed through `handle_request`, which looks up the handler in
`HANDLERS`, parses the JSON payload, and calls the handler function.

Architecture:
  frontend JS → webview bridge → handle_request → handler → (status, JSON)

Every handler returns `(status_code, json_string)`:
  - status 0 = success
  - status 1 = error (JSON contains `code` and `message`)

State is module-level (`STATE`) and protected by Julia's cooperative threading
(no locks needed for the current `@async`/`Threads.@spawn` model).
"""
module Backend

using JSON3
using LinuxCompanion
using Dates
using Base64
using ..AudioAnalysisAdapter
using ..FileTrees
using ..BibTeX
using ..BlendReader
using ..Jobs
using ..PDFGen
using ..Persistence
using ..StaticMediaAdapter

export handle_request

# ── Configuration ────────────────────────────────────────────────────────────

# Keep application data outside the repository so a rebuild cannot overwrite
# user content. Store limits are intentionally separate because quiz exports
# can contain many nested questions.
const CONFIG_DIR = joinpath(homedir(), ".config", "julia-starter")
const NOTES_FILE = joinpath(CONFIG_DIR, "notes.json")
const QUIZZES_FILE = joinpath(CONFIG_DIR, "quizzes.json")
const SETTINGS_FILE = joinpath(CONFIG_DIR, "settings.json")
const NOTES_STORE = Persistence.Store(NOTES_FILE; schema_version=1, max_bytes=4 * 1024 * 1024)
const QUIZZES_STORE = Persistence.Store(QUIZZES_FILE; schema_version=1, max_bytes=8 * 1024 * 1024)

# ── State ────────────────────────────────────────────────────────────────────

mutable struct AppState
    counter::Int
    notes::Vector{Dict{String,Any}}
    quizzes::Vector{Dict{String,Any}}
    scan_jobs::Dict{String,Dict{String,Any}}
    audio_jobs::Dict{String,String}
    jobs::Jobs.JobManager
    volumes::Vector{Dict{String,Any}}
    storage_errors::Dict{String,String}
end

# Backend state is process-local and is the source of truth during a session.
# Persistence is updated before mutations are committed, so a failed write
# cannot leave the in-memory state ahead of the durable state.
const STATE = AppState(
    0,
    Dict{String,Any}[],
    Dict{String,Any}[],
    Dict{String,Dict{String,Any}}(),
    Dict{String,String}(),
    Jobs.JobManager(),
    Dict{String,Any}[],
    Dict{String,String}(),
)

# ── Helpers ──────────────────────────────────────────────────────────────────

# The webview bridge transports only a status integer and a JSON string. Keep
# this wire contract in one place so every handler returns the same shape.
_ok(data) = (0, JSON3.write(data))
_err(code::AbstractString, msg::AbstractString) = (1, JSON3.write(Dict("code" => code, "message" => msg)))

function _parse_args(payload::AbstractString)
    (payload == "" || payload == "null" || payload == "\"\"") && return Any[]
    args = JSON3.read(payload)
    args isa AbstractVector ? collect(args) : [args]
end

_uuid() = string(Base.UUID(rand(UInt128)))

_now() = string(Dates.now())

# ── Persistent storage ───────────────────────────────────────────────────────

function _ensure_config_dir()
    isdir(CONFIG_DIR) || mkpath(CONFIG_DIR)
end

function _storage_code(error, prefix::AbstractString)
    suffix = error isa Persistence.StorageError ? error.code : :write_failed
    code = suffix == :corrupt ? "Corrupt" : suffix == :too_large ? "TooLarge" :
        suffix == :unsupported ? "Unsupported" : suffix == :unavailable ? "Unavailable" : "WriteFailed"
    "$(prefix)$(code)"
end

function _storage_failure(error, prefix::AbstractString)
    _err(_storage_code(error, prefix), sprint(showerror, error))
end

function _load_store(store::Persistence.Store, key::AbstractString)
    try
        value = Persistence.load(store; default=Any[])
        value isa AbstractVector || throw(Persistence.StorageError(
            :corrupt,
            store.path,
            "stored data must be an array: $(store.path)",
        ))
        STATE.storage_errors[key] = ""
        return Dict{String,Any}[Persistence.normalize_json(item) for item in value]
    catch error
        STATE.storage_errors[key] = sprint(showerror, error)
        return Dict{String,Any}[]
    end
end

function _save_notes(notes=STATE.notes)
    Persistence.save!(NOTES_STORE, notes)
    delete!(STATE.storage_errors, "notes")
end

function _save_quizzes(quizzes=STATE.quizzes)
    Persistence.save!(QUIZZES_STORE, quizzes)
    delete!(STATE.storage_errors, "quizzes")
end

# ── Security ─────────────────────────────────────────────────────────────────

function _sanitize_filename(name::AbstractString)
    base = basename(name)
    base = replace(base, r"[^\w\.\-]" => "_")
    base = replace(base, r"_+" => "_")
    isempty(base) && (base = "unnamed")
    base
end

function _safe_path(base::AbstractString, filename::AbstractString)
    # Validate the canonical parent directory rather than a raw string prefix:
    # symlinks and `..` segments can otherwise escape the intended directory.
    clean = _sanitize_filename(filename)
    target = joinpath(base, clean)
    isdir(base) || mkpath(base)
    realbase = realpath(base)
    realtarget = realpath(dirname(target))
    (realtarget == realbase || startswith(realtarget, realbase * string(Base.Filesystem.path_separator))) || return nothing
    target
end

function _allowed_read_roots()
    roots = String[realpath(homedir())]
    for volume in STATE.volumes
        path = get(volume, "path", nothing)
        path isa AbstractString || continue
        isdir(path) || continue
        resolved = try
            realpath(path)
        catch
            continue
        end
        resolved in roots || push!(roots, resolved)
    end
    roots
end

function _validate_read_path(value, label::AbstractString)
    # Read paths are canonicalized before authorization. This blocks null-byte
    # tricks, missing files, and symlink escapes from the allowed roots.
    value isa AbstractString && !isempty(strip(value)) ||
        return nothing, ("InvalidArgument", "$label path is required")
    occursin('\0', value) && return nothing, ("InvalidArgument", "$label path is invalid")
    expanded = expanduser(String(value))
    isfile(expanded) || return nothing, ("PathMissing", "$label file was not found")
    canonical = try
        realpath(expanded)
    catch error
        return nothing, ("PathUnavailable", "Could not resolve $label path: $(sprint(showerror, error))")
    end
    separator = string(Base.Filesystem.path_separator)
    allowed = any(root -> canonical == root || startswith(canonical, root * separator), _allowed_read_roots())
    allowed || return nothing, ("PathNotAllowed", "$label path is outside the allowed workspace roots")
    canonical, nothing
end

function _validate_write_path(value, label::AbstractString)
    value isa AbstractString && !isempty(strip(value)) ||
        return nothing, ("InvalidArgument", "$label path is required")
    occursin('\0', value) && return nothing, ("InvalidArgument", "$label path is invalid")
    documents = joinpath(homedir(), "Documents")
    try
        isdir(documents) || mkpath(documents)
        root = realpath(documents)
        target = abspath(expanduser(String(value)))
        parent = realpath(dirname(target))
        canonical = ispath(target) ? realpath(target) : joinpath(parent, basename(target))
        separator = string(Base.Filesystem.path_separator)
        allowed = canonical != root && startswith(canonical, root * separator)
        allowed || return nothing, ("PathNotAllowed", "$label path is outside ~/Documents")
        isdir(canonical) && return nothing, ("InvalidArgument", "$label path must be a file")
        target, nothing
    catch error
        nothing, ("PathUnavailable", "Could not resolve $label path: $(sprint(showerror, error))")
    end
end

# ── Window management ────────────────────────────────────────────────────────

# Window actions are handled in bin/webview_app.jl because only the shell owns
# the native Window handle. Backend keeps the application/data bindings here.

# ── State bindings ───────────────────────────────────────────────────────────

function _increment(args)
    length(args) >= 1 || return _err("InvalidArgument", "Counter delta is required")
    delta = args[1]
    delta isa Integer || return _err("InvalidArgument", "Counter delta must be an integer")
    STATE.counter += Int(delta)
    _ok(STATE.counter)
end

function _reset(args)
    STATE.counter = 0
    _ok(0)
end

function _get_system_info(args)
    caps = capabilities()
    info = Dict(
        "platform" => string(Sys.MACHINE),
        "os" => string(Sys.KERNEL),
        "julia_version" => string(VERSION),
        "hostname" => gethostname(),
        "linuxcompanion_version" => "0.1.0",
        "features" => length(caps.features),
    )
    _ok(JSON3.write(info))
end

function _get_timestamp(args)
    _ok(string(round(Int, time())))
end

function _get_status(args)
    try
        caps = capabilities()
        required = (:processes, :procfs, :epoll)
        available = all(feature -> feature.available,
            filter(feature -> feature.name in required, caps.features))
        _ok(Dict(
            "status" => available ? "ok" : "degraded",
            "features" => length(caps.features),
            "availableFeatures" => count(feature -> feature.available, caps.features),
            "storage" => Dict(
                "status" => isempty(filter(pair -> !isempty(pair.second), STATE.storage_errors)) ? "ok" : "degraded",
                "errors" => Dict(key => value for (key, value) in STATE.storage_errors if !isempty(value)),
            ),
        ))
    catch error
        _ok(Dict("status" => "degraded", "error" => sprint(showerror, error)))
    end
end

# ── Validation constants ─────────────────────────────────────────────────────

# These limits bound request memory and serialized response size. They are
# enforced on the Julia side even when the frontend performs the same checks.
const MAX_TITLE = 200
const MAX_TAG = 64
const MAX_NOTE_BODY = 512 * 1024  # 512 KB
const MAX_TEXT = 20000
const MAX_ID = 200
const MAX_TOPIC = 200
const MAX_DIFFICULTY = 64
const MAX_TAGS = 16
const MAX_MIR_PAYLOAD_BYTES = 16 * 1024 * 1024
const MAX_REQUEST_PAYLOAD_BYTES = 32 * 1024 * 1024
const MAX_PDF_BYTES = 16 * 1024 * 1024
const MAX_QUIZ_IMPORT_BYTES = 2 * 1024 * 1024


include("backend/notes.jl")
include("backend/pdf.jl")
include("backend/quiz.jl")
include("backend/analysis.jl")
include("backend/media.jl")
include("backend/router.jl")

end
