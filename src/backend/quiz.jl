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
