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
