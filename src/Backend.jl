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

# ── Notes ────────────────────────────────────────────────────────────────────

function _find_note(id::AbstractString)
    findfirst(n -> n["id"] == id, STATE.notes)
end

function _validate_note_args(args; require_id=false)
    # Create and update share one validator. Updates prepend an id, so the
    # offsets below deliberately select the same title/tag/body positions.
    length(args) < (require_id ? 4 : 3) && return "Not enough arguments"
    if require_id
        id = args[1]
        if !(typeof(id) <: AbstractString) || isempty(id) || length(id) > MAX_ID
            return "Invalid note id"
        end
    end
    title = require_id ? args[2] : args[1]
    if !(typeof(title) <: AbstractString) || isempty(title) || length(title) > MAX_TITLE
        return "Title must be 1-$(MAX_TITLE) characters"
    end
    tag = require_id ? args[3] : args[2]
    if !(typeof(tag) <: AbstractString) || length(tag) > MAX_TAG
        return "Tag must be at most $(MAX_TAG) characters"
    end
    body = require_id ? args[4] : args[3]
    if !(typeof(body) <: AbstractString) || length(body) > MAX_NOTE_BODY
        return "Body must be at most $(MAX_NOTE_BODY) characters"
    end
    return nothing
end

function _get_notes(args)
    _ok(STATE.notes)
end

function _create_note(args)
    err = _validate_note_args(args)
    err !== nothing && return _err("InvalidArgument", err)
    title, tag, body = args[1], args[2], args[3]
    note = Dict{String,Any}(
        "id" => "note-$(_uuid())",
        "title" => title,
        "tag" => isempty(tag) ? "Draft" : tag,
        "updated" => _now(),
        "body" => body,
    )
    candidate = copy(STATE.notes)
    push!(candidate, note)
    try
        _save_notes(candidate)
    catch error
        return _storage_failure(error, "Storage")
    end
    STATE.notes = candidate
    _ok(note)
end

function _update_note(args)
    err = _validate_note_args(args; require_id=true)
    err !== nothing && return _err("InvalidArgument", err)
    id, title, tag, body = args[1], args[2], args[3], args[4]
    idx = _find_note(id)
    idx === nothing && return _err("NoteNotFound", "Note $id not found")
    candidate = deepcopy(STATE.notes)
    note = candidate[idx]
    note["title"] = title
    note["tag"] = tag
    note["body"] = body
    note["updated"] = _now()
    try
        _save_notes(candidate)
    catch error
        return _storage_failure(error, "Storage")
    end
    STATE.notes = candidate
    _ok(note)
end

function _delete_note(args)
    length(args) < 1 && return _err("InvalidArgument", "Note id required")
    id = args[1]
    idx = _find_note(id)
    idx === nothing && return _err("NoteNotFound", "Note $id not found")
    candidate = copy(STATE.notes)
    deleteat!(candidate, idx)
    try
        _save_notes(candidate)
    catch error
        return _storage_failure(error, "Storage")
    end
    STATE.notes = candidate
    _ok(nothing)
end

# ── PDF ──────────────────────────────────────────────────────────────────────

function _save_pdf(args)
    length(args) >= 2 || return _err("InvalidArgument", "Filename and PDF data are required")
    filename, data_b64 = args[1], args[2]
    filename isa AbstractString || return _err("InvalidPdfName", "Filename must be text")
    data_b64 isa AbstractString || return _err("PdfDecodeFailed", "PDF data must be text")

    # Validate and sanitize filename
    isempty(filename) && return _err("InvalidPdfName", "Filename is required")
    !occursin(r"^[A-Za-z0-9][A-Za-z0-9._\-]{0,95}\.pdf$"i, filename) &&
        return _err("InvalidPdfName", "Filename must be alphanumeric with .pdf extension")

    dir = joinpath(homedir(), "Documents")
    path = _safe_path(dir, filename)
    path === nothing && return _err("InvalidPdfName", "Path traversal not allowed")

    ncodeunits(data_b64) <= ceil(Int, MAX_PDF_BYTES * 4 / 3) + 4 ||
        return _err("PdfTooLarge", "PDF data exceeds the $(MAX_PDF_BYTES)-byte limit")

    try
        bytes = base64decode(data_b64)
        length(bytes) <= MAX_PDF_BYTES || return _err("PdfTooLarge", "PDF exceeds the $(MAX_PDF_BYTES)-byte limit")
        Persistence.atomic_write!(path, bytes)
        _ok(Dict("path" => path, "size" => length(bytes)))
    catch e
        _err("PdfWriteFailed", "Failed to write PDF: $(sprint(showerror, e))")
    end
end

# ── Quiz ─────────────────────────────────────────────────────────────────────

function _find_collection(id::AbstractString)
    findfirst(c -> c["id"] == id, STATE.quizzes)
end

function _find_question(collection_idx::Int, question_id::AbstractString)
    qs = STATE.quizzes[collection_idx]["questions"]
    findfirst(q -> q["id"] == question_id, qs)
end

function _validate_id(value, label)
    value isa AbstractString && !isempty(value) && length(value) <= MAX_ID ||
        return "$label must be 1-$MAX_ID characters"
    nothing
end

function _validate_text(value, label, limit; required=false)
    value isa AbstractString || return "$label must be text"
    required && isempty(strip(value)) && return "$label is required"
    length(value) <= limit || return "$label must be at most $limit characters"
    nothing
end

function _validate_collection_args(args; update=false)
    # Collection creation receives title/description/tone/level; updates
    # receive id/title/description. `offset` keeps both forms in one validator.
    expected = update ? 3 : 4
    length(args) >= expected || return "Not enough collection arguments"
    offset = update ? 1 : 0
    update && begin
        error = _validate_id(args[1], "Collection id")
        error !== nothing && return error
    end
    title = _validate_text(args[1 + offset], "Collection title", MAX_TITLE; required=true)
    title !== nothing && return title
    description = _validate_text(args[2 + offset], "Collection description", MAX_TEXT)
    description !== nothing && return description
    if !update
        tone = _validate_text(args[3], "Collection tone", MAX_TITLE)
        tone !== nothing && return tone
        level = _validate_text(args[4], "Collection level", MAX_TITLE)
        level !== nothing && return level
    end
    nothing
end

function _validate_question_args(args; update=false)
    # Question creation receives collection_id + 3 fields. Updates prepend a
    # question id and append explanation/difficulty/tags CSV.
    expected = update ? 8 : 4
    length(args) >= expected || return "Not enough question arguments"
    collection_offset = update ? 0 : 0
    collection_error = _validate_id(args[1], "Collection id")
    collection_error !== nothing && return collection_error
    if update
        id_error = _validate_id(args[2], "Question id")
        id_error !== nothing && return id_error
        offset = 2
    else
        offset = 1
    end
    topic = _validate_text(args[1 + offset], "Question topic", MAX_TOPIC)
    topic !== nothing && return topic
    question = _validate_text(args[2 + offset], "Question", MAX_TEXT; required=true)
    question !== nothing && return question
    answer = _validate_text(args[3 + offset], "Answer", MAX_TEXT; required=true)
    answer !== nothing && return answer
    if update
        explanation = _validate_text(args[6], "Explanation", MAX_TEXT)
        explanation !== nothing && return explanation
        difficulty = _validate_text(args[7], "Difficulty", MAX_DIFFICULTY)
        difficulty !== nothing && return difficulty
        tags = args[8]
        tags isa AbstractString || return "Tags must be text"
        tag_values = filter(!isempty, strip.(split(tags, ',')))
        length(tag_values) <= MAX_TAGS || return "At most $MAX_TAGS tags are allowed"
        all(length(tag) <= MAX_TAG for tag in tag_values) || return "Tags must be at most $MAX_TAG characters"
    end
    nothing
end

function _quiz_list(args)
    _ok(STATE.quizzes)
end

function _quiz_create_collection(args)
    error = _validate_collection_args(args)
    error !== nothing && return _err("InvalidArgument", error)
    title, description, tone, level = args[1], args[2], args[3], args[4]
    col = Dict{String,Any}(
        "id" => "quiz-$(_uuid())",
        "title" => title,
        "shortTitle" => title,
        "description" => description,
        "tone" => isempty(tone) ? "gold" : tone,
        "icon" => "",
        "level" => isempty(level) ? "Custom" : level,
        "questions" => Dict{String,Any}[],
    )
    candidate = copy(STATE.quizzes)
    push!(candidate, col)
    try
        _save_quizzes(candidate)
    catch error
        return _storage_failure(error, "Quiz")
    end
    STATE.quizzes = candidate
    _ok(col)
end

function _quiz_update_collection(args)
    error = _validate_collection_args(args; update=true)
    error !== nothing && return _err("InvalidArgument", error)
    id, title, description = args[1], args[2], args[3]
    idx = _find_collection(id)
    idx === nothing && return _err("QuizNotFound", "Collection $id not found")
    candidate = deepcopy(STATE.quizzes)
    col = candidate[idx]
    col["title"] = title
    col["shortTitle"] = title
    col["description"] = description
    try
        _save_quizzes(candidate)
    catch error
        return _storage_failure(error, "Quiz")
    end
    STATE.quizzes = candidate
    _ok(col)
end

function _quiz_delete_collection(args)
    length(args) >= 1 || return _err("InvalidArgument", "Collection id required")
    error = _validate_id(args[1], "Collection id")
    error !== nothing && return _err("InvalidArgument", error)
    id = args[1]
    idx = _find_collection(id)
    idx === nothing && return _err("QuizNotFound", "Collection $id not found")
    candidate = copy(STATE.quizzes)
    deleteat!(candidate, idx)
    try
        _save_quizzes(candidate)
    catch error
        return _storage_failure(error, "Quiz")
    end
    STATE.quizzes = candidate
    _ok(nothing)
end

function _quiz_create_question(args)
    error = _validate_question_args(args)
    error !== nothing && return _err("InvalidArgument", error)
    collection_id, topic, question, answer = args[1], args[2], args[3], args[4]
    cidx = _find_collection(collection_id)
    cidx === nothing && return _err("QuizNotFound", "Collection $collection_id not found")
    q = Dict{String,Any}(
        "id" => "q-$(_uuid())",
        "topic" => topic,
        "question" => question,
        "answer" => answer,
        "explanation" => "",
        "difficulty" => "",
        "tags" => String[],
    )
    candidate = deepcopy(STATE.quizzes)
    push!(candidate[cidx]["questions"], q)
    try
        _save_quizzes(candidate)
    catch error
        return _storage_failure(error, "Quiz")
    end
    STATE.quizzes = candidate
    _ok(q)
end

function _quiz_update_question(args)
    error = _validate_question_args(args; update=true)
    error !== nothing && return _err("InvalidArgument", error)
    collection_id, id, topic, question, answer, explanation, difficulty, tags_csv = args
    cidx = _find_collection(collection_id)
    cidx === nothing && return _err("QuizNotFound", "Collection $collection_id not found")
    qidx = _find_question(cidx, id)
    qidx === nothing && return _err("QuizNotFound", "Question $id not found")
    candidate = deepcopy(STATE.quizzes)
    q = candidate[cidx]["questions"][qidx]
    q["topic"] = topic
    q["question"] = question
    q["answer"] = answer
    q["explanation"] = explanation
    q["difficulty"] = difficulty
    q["tags"] = split(tags_csv, ","; keepempty=false) .|> strip .|> String
    try
        _save_quizzes(candidate)
    catch error
        return _storage_failure(error, "Quiz")
    end
    STATE.quizzes = candidate
    _ok(q)
end

function _quiz_delete_question(args)
    length(args) < 2 && return _err("InvalidArgument", "Collection id and question id required")
    collection_id, id = args[1], args[2]
    for (value, label) in ((collection_id, "Collection id"), (id, "Question id"))
        error = _validate_id(value, label)
        error !== nothing && return _err("InvalidArgument", error)
    end
    cidx = _find_collection(collection_id)
    cidx === nothing && return _err("QuizNotFound", "Collection $collection_id not found")
    qidx = _find_question(cidx, id)
    qidx === nothing && return _err("QuizNotFound", "Question $id not found")
    candidate = deepcopy(STATE.quizzes)
    deleteat!(candidate[cidx]["questions"], qidx)
    try
        _save_quizzes(candidate)
    catch error
        return _storage_failure(error, "Quiz")
    end
    STATE.quizzes = candidate
    _ok(nothing)
end

function _quiz_export(args)
    length(args) < 1 && return _err("InvalidArgument", "Collection id required")
    id = args[1]
    _validate_id(id, "Collection id") === nothing || return _err("InvalidArgument", "Collection id is invalid")
    idx = _find_collection(id)
    idx === nothing && return _err("QuizNotFound", "Collection $id not found")
    dir = joinpath(homedir(), "Documents")
    filename = "quiz-$(_sanitize_filename(STATE.quizzes[idx]["title"])).json"
    path = _safe_path(dir, filename)
    path === nothing && return _err("InvalidArgument", "Path traversal not allowed")
    try
        data = JSON3.write(STATE.quizzes[idx])
        ncodeunits(data) <= MAX_QUIZ_IMPORT_BYTES || return _err("QuizTooLarge", "Quiz export is too large")
        Persistence.atomic_write!(path, data)
        _ok(Dict("path" => path, "size" => length(data)))
    catch e
        _storage_failure(e, "Quiz")
    end
end

function _quiz_import(args)
    length(args) < 1 && return _err("InvalidArgument", "Quiz JSON is required")
    source = args[1]
    source isa AbstractString || return _err("InvalidArgument", "Quiz JSON must be text")
    ncodeunits(source) <= MAX_QUIZ_IMPORT_BYTES || return _err("QuizTooLarge", "Quiz import is too large")
    try
        col = Persistence.normalize_json(JSON3.read(source))
        col isa AbstractDict || return _err("InvalidArgument", "Invalid quiz format")
        title = get(col, "title", nothing)
        title isa AbstractString && !isempty(strip(title)) && length(title) <= MAX_TITLE ||
            return _err("InvalidArgument", "A valid quiz title is required")
        description = get(col, "description", "")
        description isa AbstractString && length(description) <= MAX_TEXT ||
            return _err("InvalidArgument", "Quiz description is invalid")
        raw_questions = get(col, "questions", Any[])
        raw_questions isa AbstractVector || return _err("InvalidArgument", "Quiz questions must be an array")
        length(raw_questions) <= 10000 || return _err("QuizTooLarge", "Too many quiz questions")

        questions = Dict{String,Any}[]
        for raw_question in raw_questions
            raw_question isa AbstractDict || return _err("InvalidArgument", "Invalid quiz question")
            question = get(raw_question, "question", nothing)
            answer = get(raw_question, "answer", nothing)
            question isa AbstractString && !isempty(strip(question)) && length(question) <= MAX_TEXT ||
                return _err("InvalidArgument", "Each question needs valid question text")
            answer isa AbstractString && !isempty(strip(answer)) && length(answer) <= MAX_TEXT ||
                return _err("InvalidArgument", "Each question needs valid answer text")
            tags = get(raw_question, "tags", Any[])
            tags isa AbstractVector || return _err("InvalidArgument", "Question tags must be an array")
            length(tags) <= MAX_TAGS || return _err("QuizLimitReached", "At most $MAX_TAGS tags are allowed")
            all(tag -> tag isa AbstractString && length(tag) <= MAX_TAG, tags) ||
                return _err("InvalidArgument", "Question tags are invalid")
            topic = get(raw_question, "topic", "")
            explanation = get(raw_question, "explanation", "")
            difficulty = get(raw_question, "difficulty", "")
            topic isa AbstractString && length(topic) <= MAX_TOPIC ||
                return _err("InvalidArgument", "Question topic is invalid")
            explanation isa AbstractString && length(explanation) <= MAX_TEXT ||
                return _err("InvalidArgument", "Question explanation is invalid")
            difficulty isa AbstractString && length(difficulty) <= MAX_DIFFICULTY ||
                return _err("InvalidArgument", "Question difficulty is invalid")
            push!(questions, Dict{String,Any}(
                "id" => "q-$(_uuid())",
                "topic" => String(topic),
                "question" => String(question),
                "answer" => String(answer),
                "explanation" => String(explanation),
                "difficulty" => String(difficulty),
                "tags" => String[String(tag) for tag in tags],
            ))
        end

        short_title = get(col, "shortTitle", title)
        tone = get(col, "tone", "gold")
        icon = get(col, "icon", "")
        level = get(col, "level", "Custom")
        all(value -> value isa AbstractString && length(value) <= MAX_TITLE,
            (short_title, tone, level)) || return _err("InvalidArgument", "Quiz metadata is invalid")
        icon isa AbstractString && length(icon) <= MAX_TITLE ||
            return _err("InvalidArgument", "Quiz icon is invalid")
        imported = Dict{String,Any}(
            "id" => "quiz-$(_uuid())",
            "title" => String(title),
            "shortTitle" => String(short_title),
            "description" => String(description),
            "tone" => String(tone),
            "icon" => String(icon),
            "level" => String(level),
            "questions" => questions,
        )
        candidate = copy(STATE.quizzes)
        push!(candidate, imported)
        _save_quizzes(candidate)
        STATE.quizzes = candidate
        _ok(imported)
    catch e
        e isa Persistence.StorageError && return _storage_failure(e, "Quiz")
        _err("ImportFailed", "Failed to import quiz: $(sprint(showerror, e))")
    end
end

function _generate_pdf(args)
    length(args) >= 3 || return _err("InvalidArgument", "Filename, title, and body are required")
    all(value -> value isa AbstractString, args[1:3]) ||
        return _err("InvalidArgument", "Filename, title, and body must be text")
    filename, title, body = args[1], args[2], args[3]
    occursin(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,95}\.pdf$", filename) ||
        return _err("InvalidPdfName", "Filename must be alphanumeric with .pdf extension")
    directory = joinpath(homedir(), "Documents")
    path = _safe_path(directory, filename)
    path === nothing && return _err("InvalidPdfName", "Path traversal not allowed")
    try
        PDFGen.write_pdf(path, title, body)
        _ok(Dict("path" => path, "size" => filesize(path)))
    catch error
        _err("PdfWriteFailed", sprint(showerror, error))
    end
end

# ── MIR ──────────────────────────────────────────────────────────────────────

function _mir_analyze(args)
    length(args) >= 2 || return _err("InvalidAudioInput", "Samples and sample rate are required")
    samples, sample_rate = args[1], args[2]
    try
        _ok(AudioAnalysisAdapter.analyze_samples(samples, sample_rate))
    catch error
        error isa AudioAnalysisAdapter.AudioTooLargeError &&
            return _err("AudioTooLarge", sprint(showerror, error))
        _err("InvalidAudioInput", sprint(showerror, error))
    end
end

# ── Asset scanning ───────────────────────────────────────────────────────────

function _discover_volumes()
    volumes = Dict{String,Any}[
        Dict("id" => "home", "name" => "Home Directory", "path" => homedir(), "kind" => "general"),
    ]

    # Add common directories
    for (name, kind) in [("projects", "blender"), ("samples", "audio"), ("renders", "render"), ("Documents", "general"), ("Music", "audio")]
        path = joinpath(homedir(), name)
        isdir(path) && push!(volumes, Dict("id" => lowercase(name), "name" => name, "path" => path, "kind" => kind))
    end

    # Try to discover mounted volumes via /proc/mounts
    try
        mounts = read("/proc/mounts", String)
        for line in split(mounts, "\n"; keepempty=false)
            parts = split(line)
            length(parts) < 2 && continue
            device, mountpoint = string(parts[1]), string(parts[2])
            # Skip virtual filesystems
            startswith(device, "/dev/") || continue
            startswith(mountpoint, "/home/") || startswith(mountpoint, "/mnt/") || startswith(mountpoint, "/media/") || continue
            # Skip if already in list
            any(v -> v["path"] == mountpoint, volumes) && continue
            label = basename(mountpoint)
            push!(volumes, Dict(
                "id" => "vol-$(_uuid()[1:8])",
                "name" => label,
                "path" => mountpoint,
                "kind" => "general",
            ))
        end
    catch
    end

    volumes
end

function _list_volumes(args)
    if isempty(STATE.volumes)
        STATE.volumes = _discover_volumes()
    end
    _ok(STATE.volumes)
end

function _start_asset_scan(args)
    length(args) >= 1 || return _err("InvalidArgument", "Volume id is required")
    volume_id = args[1]
    volume_id isa AbstractString && !isempty(strip(volume_id)) ||
        return _err("InvalidArgument", "Volume id is invalid")

    # Resolve the public volume id to a path from the discovered allowlist;
    # callers cannot submit an arbitrary filesystem path here.
    volume_path = ""
    if isempty(STATE.volumes)
        STATE.volumes = _discover_volumes()
    end
    for v in STATE.volumes
        if v["id"] == volume_id
            volume_path = v["path"]
            break
        end
    end
    isempty(volume_path) && return _err("AssetVolumeNotFound", "Volume $volume_id not found")

    Jobs.cleanup!(STATE.jobs)
    job_id = try
        Jobs.create_job!(STATE.jobs; kind="asset-scan", metadata=Dict(
            "volumeId" => String(volume_id),
            "path" => volume_path,
        ))
    catch error
        return _err("JobLimitReached", sprint(showerror, error))
    end
    job = Dict{String,Any}(
        "id" => job_id,
        "volumeId" => volume_id,
        "progress" => 0.0,
        "state" => "running",
        "scannedFiles" => 0,
        "scannedBytes" => 0,
        "blender" => 0,
        "audio" => 0,
        "render" => 0,
        "other" => 0,
        "truncated" => false,
    )
    STATE.scan_jobs[job_id] = job

    @async begin
        try
            _run_scan(job_id, job, volume_path)
        catch error
            Jobs.fail_job!(STATE.jobs, job_id, error)
        end
    end

    _ok(_scan_response(job_id))
end

function _scan_response(job_id::AbstractString)
    snapshot = try
        Jobs.snapshot(STATE.jobs, job_id)
    catch
        return nothing
    end
    details = get(STATE.scan_jobs, String(job_id), Dict{String,Any}())
    response = deepcopy(details)
    response["id"] = String(job_id)
    response["state"] = snapshot["state"]
    response["progress"] = snapshot["progress"]
    response["message"] = snapshot["message"]
    snapshot["error"] !== nothing && (response["error"] = snapshot["error"])
    response
end

function _run_scan(job_id::AbstractString, job::Dict{String,Any}, volume_path::AbstractString)
    isdir(volume_path) || throw(ArgumentError("scan root is no longer available: $volume_path"))
    audio_exts = Set([".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac", ".aiff"])
    render_exts = Set([".png", ".jpg", ".jpeg", ".exr", ".hdr", ".tiff"])
    blender_exts = Set([".blend", ".blend1"])
    # Depth and entry caps keep a broad volume scan responsive and prevent a
    # single job from producing an unbounded result set.
    report = FileTrees.scan(volume_path; max_depth=3, max_entries=100_000,
        should_cancel=() -> Jobs.is_cancelled(STATE.jobs, job_id),
        on_file=(entry, progress) -> begin
            job["scannedFiles"] = progress.scanned_files
            job["scannedBytes"] = progress.scanned_bytes
            Jobs.update_job!(STATE.jobs, job_id; message=progress.current_path)
            ext = entry.extension
            if ext in audio_exts
                job["audio"] += 1
            elseif ext in render_exts
                job["render"] += 1
            elseif ext in blender_exts
                job["blender"] += 1
            else
                job["other"] += 1
            end
        end)

    for (folder, size) in report.top_folders
        push!(get!(job, "topFolders", Any[]), Dict("name" => folder, "bytes" => size))
    end
    job["truncated"] = report.truncated
    if report.cancelled
        return
    end
    job["scannedFiles"] = report.scanned_files
    job["scannedBytes"] = report.scanned_bytes
    Jobs.complete_job!(STATE.jobs, job_id; result=deepcopy(job))
end

function _get_asset_scan_status(args)
    length(args) >= 1 || return _err("InvalidArgument", "Scan job id is required")
    job_id = args[1]
    job_id isa AbstractString || return _err("InvalidArgument", "Scan job id is invalid")
    haskey(STATE.scan_jobs, job_id) || return _err("AssetJobNotFound", "Scan job $job_id not found")
    _ok(_scan_response(job_id))
end

function _cancel_asset_scan(args)
    length(args) >= 1 || return _err("InvalidArgument", "Scan job id is required")
    job_id = args[1]
    job_id isa AbstractString || return _err("InvalidArgument", "Scan job id is invalid")
    haskey(STATE.scan_jobs, job_id) || return _err("AssetJobNotFound", "Scan job $job_id not found")
    Jobs.cancel_job!(STATE.jobs, job_id)
    _ok(_scan_response(job_id))
end

# ── Audio analysis adapter ───────────────────────────────────────────────────

function _audio_metadata_internal(args)
    length(args) >= 1 || return _err("InvalidArgument", "Audio path is required")
    path, path_error = _validate_read_path(args[1], "Audio")
    path_error !== nothing && return _err(path_error...)
    try
        metadata = AudioAnalysisAdapter.read_metadata(path)
        _ok(metadata)
    catch error
        error isa AudioAnalysisAdapter.AudioUnsupportedError &&
            return _err("UnsupportedAudioFormat", sprint(showerror, error))
        error isa AudioAnalysisAdapter.AudioTooLargeError &&
            return _err("AudioTooLarge", sprint(showerror, error))
        _err("InvalidAudio", sprint(showerror, error))
    end
end

function _audio_analysis_internal(args)
    length(args) >= 1 || return _err("InvalidArgument", "Audio path is required")
    path, path_error = _validate_read_path(args[1], "Audio")
    path_error !== nothing && return _err(path_error...)
    try
        values = AudioAnalysisAdapter.analyze_file(path; max_frames=262144)
        # Keep Julia's snake_case fields and add the frontend's camelCase
        # aliases during the migration; consumers can move independently.
        values["durationSec"] = values["duration_seconds"]
        values["sampleRate"] = values["sample_rate"]
        values["sampleCount"] = values["sample_count"]
        _ok(values)
    catch error
        error isa AudioAnalysisAdapter.AudioUnsupportedError &&
            return _err("UnsupportedAudioFormat", sprint(showerror, error))
        error isa AudioAnalysisAdapter.AudioTooLargeError &&
            return _err("AudioTooLarge", sprint(showerror, error))
        _err("InvalidAudio", sprint(showerror, error))
    end
end

function _audio_job_response(job_id::AbstractString)
    snapshot = try
        Jobs.snapshot(STATE.jobs, job_id)
    catch
        return nothing
    end
    path = get(STATE.audio_jobs, String(job_id), "")
    response = Dict{String,Any}(
        "id" => String(job_id),
        "path" => path,
        "state" => snapshot["state"],
        "progress" => snapshot["progress"],
        "message" => snapshot["message"],
    )
    snapshot["error"] !== nothing && (response["error"] = snapshot["error"])
    result = snapshot["result"]
    result isa AbstractDict && merge!(response, result)
    response
end

function _run_audio_analysis(job_id::AbstractString, path::AbstractString)
    try
        Jobs.update_job!(STATE.jobs, job_id; message="Reading audio file")
        result = AudioAnalysisAdapter.analyze_file(path; max_frames=262144)
        result["durationSec"] = result["duration_seconds"]
        result["sampleRate"] = result["sample_rate"]
        result["sampleCount"] = result["sample_count"]
        Jobs.complete_job!(STATE.jobs, job_id; result=result)
    catch error
        Jobs.fail_job!(STATE.jobs, job_id, error)
    end
end

function _start_audio_analysis(args)
    length(args) >= 1 || return _err("InvalidArgument", "Audio path is required")
    path, path_error = _validate_read_path(args[1], "Audio")
    path_error !== nothing && return _err(path_error...)
    Jobs.cleanup!(STATE.jobs)
    job_id = try
        Jobs.create_job!(STATE.jobs; kind="audio-analysis", metadata=Dict("path" => path))
    catch error
        return _err("JobLimitReached", sprint(showerror, error))
    end
    STATE.audio_jobs[job_id] = path
    Threads.@spawn _run_audio_analysis(job_id, path)
    _ok(_audio_job_response(job_id))
end

function _get_audio_analysis_status(args)
    length(args) >= 1 || return _err("InvalidArgument", "Audio job id is required")
    job_id = args[1]
    job_id isa AbstractString || return _err("InvalidArgument", "Audio job id is invalid")
    haskey(STATE.audio_jobs, job_id) || return _err("AudioJobNotFound", "Audio job $job_id not found")
    response = _audio_job_response(job_id)
    response === nothing && return _err("AudioJobNotFound", "Audio job $job_id not found")
    _ok(response)
end

function _cancel_audio_analysis(args)
    length(args) >= 1 || return _err("InvalidArgument", "Audio job id is required")
    job_id = args[1]
    job_id isa AbstractString || return _err("InvalidArgument", "Audio job id is invalid")
    haskey(STATE.audio_jobs, job_id) || return _err("AudioJobNotFound", "Audio job $job_id not found")
    Jobs.cancel_job!(STATE.jobs, job_id)
    _ok(_audio_job_response(job_id))
end

function _parse_bibtex(args)
    length(args) >= 1 || return _err("InvalidArgument", "BibTeX source is required")
    try
        entries = BibTeX.parse_bibtex(String(args[1]))
        _ok([Dict("type" => entry.entry_type, "key" => entry.key, "fields" => entry.fields) for entry in entries])
    catch error
        _err("InvalidBibTeX", sprint(showerror, error))
    end
end

function _inspect_blend(args)
    length(args) >= 1 || return _err("InvalidArgument", "Blend path is required")
    path, path_error = _validate_read_path(args[1], "Blender")
    path_error !== nothing && return _err(path_error...)
    try
        header = BlendReader.read_header(path)
        _ok(Dict(
            "path" => header.path,
            "pointerSize" => header.pointer_size,
            "byteOrder" => String(header.byte_order),
            "version" => string(header.version),
        ))
    catch error
        _err("InvalidBlendFile", sprint(showerror, error))
    end
end

# ── Static media feature bindings ────────────────────────────────────────────

function _media_failure(error)
    _err(StaticMediaAdapter.error_code(error), sprint(showerror, error))
end

function _inspect_media(args)
    length(args) >= 1 || return _err("InvalidArgument", "Media path is required")
    path, path_error = _validate_read_path(args[1], "Media")
    path_error !== nothing && return _err(path_error...)
    try
        _ok(StaticMediaAdapter.inspect_media(path))
    catch error
        _media_failure(error)
    end
end

function _markdown_to_html(args)
    length(args) >= 1 || return _err("InvalidArgument", "Markdown content is required")
    content = args[1]
    content isa AbstractString || return _err("InvalidArgument", "Markdown content must be text")
    try
        _ok(StaticMediaAdapter.markdown_to_html(content))
    catch error
        _media_failure(error)
    end
end

function _read_text(args)
    length(args) >= 1 || return _err("InvalidArgument", "Text path is required")
    path, path_error = _validate_read_path(args[1], "Text")
    path_error !== nothing && return _err(path_error...)
    try
        _ok(StaticMediaAdapter.read_text(path))
    catch error
        _media_failure(error)
    end
end

function _write_text(args)
    length(args) >= 2 || return _err("InvalidArgument", "Text path and content are required")
    content = args[2]
    content isa AbstractString || return _err("InvalidArgument", "Text content must be text")
    path, path_error = _validate_write_path(args[1], "Text output")
    path_error !== nothing && return _err(path_error...)
    try
        _ok(StaticMediaAdapter.write_text(path, content))
    catch error
        _media_failure(error)
    end
end

function _plan_conversion(args)
    length(args) >= 2 || return _err("InvalidArgument", "Input and output paths are required")
    input, input_error = _validate_read_path(args[1], "Conversion input")
    input_error !== nothing && return _err(input_error...)
    output, output_error = _validate_write_path(args[2], "Conversion output")
    output_error !== nothing && return _err(output_error...)
    try
        _ok(StaticMediaAdapter.plan_conversion(input, output))
    catch error
        _media_failure(error)
    end
end

function _convert_media(args)
    length(args) >= 2 || return _err("InvalidArgument", "Input and output paths are required")
    input, input_error = _validate_read_path(args[1], "Conversion input")
    input_error !== nothing && return _err(input_error...)
    output, output_error = _validate_write_path(args[2], "Conversion output")
    output_error !== nothing && return _err(output_error...)
    try
        _ok(StaticMediaAdapter.convert_media(input, output))
    catch error
        _media_failure(error)
    end
end

function _get_media_capabilities(args)
    try
        _ok(StaticMediaAdapter.get_media_capabilities())
    catch error
        _media_failure(error)
    end
end

function _html_to_text(args)
    length(args) >= 1 || return _err("InvalidArgument", "HTML content is required")
    html = args[1]
    html isa AbstractString || return _err("InvalidArgument", "HTML content must be text")
    try
        _ok(StaticMediaAdapter.html_to_text(html))
    catch error
        _media_failure(error)
    end
end

# ── Router ───────────────────────────────────────────────────────────────────

# Add ordinary RPC bindings here. Window operations are intentionally absent:
# bin/webview_app.jl handles them inline because they require the Window handle.
const HANDLERS = Dict{String,Function}(
    "increment"             => _increment,
    "reset"                 => _reset,
    "getSystemInfo"         => _get_system_info,
    "getTimestamp"          => _get_timestamp,
    "getStatus"             => _get_status,
    "getNotes"              => _get_notes,
    "createNote"            => _create_note,
    "updateNote"            => _update_note,
    "deleteNote"            => _delete_note,
    "savePdf"               => _save_pdf,
    "quizList"              => _quiz_list,
    "quizCreateCollection"  => _quiz_create_collection,
    "quizUpdateCollection"  => _quiz_update_collection,
    "quizDeleteCollection"  => _quiz_delete_collection,
    "quizCreateQuestion"    => _quiz_create_question,
    "quizUpdateQuestion"    => _quiz_update_question,
    "quizDeleteQuestion"    => _quiz_delete_question,
    "quizExport"            => _quiz_export,
    "quizImport"            => _quiz_import,
    "generatePdf"           => _generate_pdf,
    "mirAnalyze"            => _mir_analyze,
    "listVolumes"           => _list_volumes,
    "startAssetScan"        => _start_asset_scan,
    "getAssetScanStatus"    => _get_asset_scan_status,
    "cancelAssetScan"       => _cancel_asset_scan,
    "getAudioMetadata"      => _audio_metadata_internal,
    "analyzeAudio"          => _audio_analysis_internal,
    "startAudioAnalysis"    => _start_audio_analysis,
    "getAudioAnalysisStatus" => _get_audio_analysis_status,
    "cancelAudioAnalysis"   => _cancel_audio_analysis,
    "parseBibTeX"           => _parse_bibtex,
    "inspectBlend"          => _inspect_blend,
    # Optional StaticMediaCompanion feature bindings. They are registered by
    # the launcher but intentionally excluded from CORE_BINDINGS until a full
    # media UI is enabled in browser mode.
    "inspectMedia"          => _inspect_media,
    "markdownToHtml"        => _markdown_to_html,
    "readText"              => _read_text,
    "writeText"             => _write_text,
    "planConversion"        => _plan_conversion,
    "convertMedia"          => _convert_media,
    "getMediaCapabilities"  => _get_media_capabilities,
    "htmlToText"            => _html_to_text,
)

"""
    handle_request(name::String, payload::String) -> (status::Int, result::String)

Dispatch a frontend binding call to the appropriate Julia handler.
Returns a tuple of (status_code, json_result) for the webview bridge.
status 0 = success, 1 = error.
"""
function handle_request(name::AbstractString, payload::AbstractString)
    handler = get(HANDLERS, name, nothing)
    handler === nothing && return _err("UnknownBinding", "No handler for binding: $name")
    name == "mirAnalyze" && ncodeunits(payload) > MAX_MIR_PAYLOAD_BYTES &&
        return _err("AudioTooLarge", "MIR request payload is too large")
    ncodeunits(payload) > MAX_REQUEST_PAYLOAD_BYTES &&
        return _err("PayloadTooLarge", "Request payload exceeds the $(MAX_REQUEST_PAYLOAD_BYTES)-byte limit")
    try
        args = _parse_args(payload)
        handler(args)
    catch e
        _err("InternalError", sprint(showerror, e))
    end
end

# ── Initialization ───────────────────────────────────────────────────────────

function __init__()
    try
        _ensure_config_dir()
    catch error
        STATE.storage_errors["config"] = sprint(showerror, error)
    end
    STATE.notes = _load_store(NOTES_STORE, "notes")
    STATE.quizzes = _load_store(QUIZZES_STORE, "quizzes")
end

end
