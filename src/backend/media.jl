# ── Static media feature bindings ────────────────────────────────────────────

function _media_failure(error)
    _err(StaticMediaAdapter.error_code(error), sprint(showerror, error))
end

function _inspect_media(args)
    length(args) >= 1 || return _err("InvalidArgument", "Media path is required")
    path, path_error = _validated_path(_validate_read_path, args[1], "Media")
    path_error === nothing || return path_error
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
    path, path_error = _validated_path(_validate_read_path, args[1], "Text")
    path_error === nothing || return path_error
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
    path, path_error = _validated_path(_validate_write_path, args[1], "Text output")
    path_error === nothing || return path_error
    try
        _ok(StaticMediaAdapter.write_text(path, content))
    catch error
        _media_failure(error)
    end
end

function _plan_conversion(args)
    length(args) >= 2 || return _err("InvalidArgument", "Input and output paths are required")
    input, input_error = _validated_path(_validate_read_path, args[1], "Conversion input")
    input_error === nothing || return input_error
    output, output_error = _validated_path(_validate_write_path, args[2], "Conversion output")
    output_error === nothing || return output_error
    try
        _ok(StaticMediaAdapter.plan_conversion(input, output))
    catch error
        _media_failure(error)
    end
end

function _convert_media(args)
    length(args) >= 2 || return _err("InvalidArgument", "Input and output paths are required")
    input, input_error = _validated_path(_validate_read_path, args[1], "Conversion input")
    input_error === nothing || return input_error
    output, output_error = _validated_path(_validate_write_path, args[2], "Conversion output")
    output_error === nothing || return output_error
    try
        plan = StaticMediaAdapter.plan_conversion(input, output)
        plan["requiresExternalTool"] && return _err(
            "ConversionRequiresJob",
            "External conversions must use startMediaConversion",
        )
        _ok(StaticMediaAdapter.convert_media(input, output))
    catch error
        _media_failure(error)
    end
end

const MEDIA_CONVERSION_TIMEOUT_SECONDS = 120.0

function _media_conversion_response(job_id::AbstractString)
    snapshot = try
        Jobs.snapshot(STATE.jobs, job_id)
    catch
        return nothing
    end
    paths = lock(STATE.jobs_lock) do
        get(STATE.media_jobs, String(job_id), Dict{String,String}())
    end
    response = Dict{String,Any}(
        "schemaVersion" => StaticMediaAdapter.MEDIA_SCHEMA_VERSION,
        "provenance" => StaticMediaAdapter._provenance(
            String(get(snapshot["metadata"], "backend", "unknown")),
        ),
        "id" => String(job_id),
        "input" => get(paths, "input", ""),
        "output" => get(paths, "output", ""),
        "state" => snapshot["state"],
        "progress" => snapshot["progress"],
        "message" => snapshot["message"],
    )
    snapshot["error"] !== nothing && (response["error"] = snapshot["error"])
    snapshot["result"] isa AbstractDict && (response["result"] = snapshot["result"])
    response
end

function _run_media_conversion(job_id::AbstractString, input::AbstractString, output::AbstractString)
    try
        Jobs.update_job!(STATE.jobs, job_id; progress=0.05, message="Preparing conversion")
        result = StaticMediaAdapter.convert_media(
            input,
            output;
            timeout_seconds=MEDIA_CONVERSION_TIMEOUT_SECONDS,
            cancel=() -> Jobs.is_cancelled(STATE.jobs, job_id),
        )
        Jobs.is_cancelled(STATE.jobs, job_id) && return
        Jobs.complete_job!(STATE.jobs, job_id; result=result)
    catch error
        Jobs.is_cancelled(STATE.jobs, job_id) || Jobs.fail_job!(STATE.jobs, job_id, error)
    end
end

function _start_media_conversion(args)
    _cleanup_job_views!()
    length(args) >= 2 || return _err("InvalidArgument", "Input and output paths are required")
    input, input_error = _validated_path(_validate_read_path, args[1], "Conversion input")
    input_error === nothing || return input_error
    output, output_error = _validated_path(_validate_write_path, args[2], "Conversion output")
    output_error === nothing || return output_error
    plan = try
        StaticMediaAdapter.plan_conversion(input, output)
    catch error
        return _media_failure(error)
    end
    Jobs.cleanup!(STATE.jobs)
    job_id = try
        Jobs.create_job!(STATE.jobs; kind="media-conversion", metadata=Dict(
            "input" => input,
            "output" => output,
            "backend" => plan["backend"],
        ), correlation_id="convert-$(basename(input))")
    catch error
        return _err("JobLimitReached", sprint(showerror, error))
    end
    STATE.media_jobs[job_id] = Dict("input" => input, "output" => output)
    Threads.@spawn _run_media_conversion(job_id, input, output)
    _ok(_media_conversion_response(job_id))
end

function _get_media_conversion_status(args)
    _cleanup_job_views!()
    length(args) >= 1 || return _err("InvalidArgument", "Media job id is required")
    job_id = args[1]
    job_id isa AbstractString || return _err("InvalidArgument", "Media job id is invalid")
    haskey(STATE.media_jobs, job_id) || return _err("MediaJobNotFound", "Media job $job_id not found")
    response = _media_conversion_response(job_id)
    response === nothing && return _err("MediaJobNotFound", "Media job $job_id not found")
    _ok(response)
end

function _cancel_media_conversion(args)
    length(args) >= 1 || return _err("InvalidArgument", "Media job id is required")
    job_id = args[1]
    job_id isa AbstractString || return _err("InvalidArgument", "Media job id is invalid")
    haskey(STATE.media_jobs, job_id) || return _err("MediaJobNotFound", "Media job $job_id not found")
    Jobs.cancel_job!(STATE.jobs, job_id)
    _ok(_media_conversion_response(job_id))
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

# ── Directory listing ────────────────────────────────────────────────────────

const MAX_DIRECTORY_ENTRIES = 2000

function _list_directory(args)
    length(args) >= 1 || return _err("InvalidArgument", "Directory path is required")
    raw_path = args[1]
    raw_path isa AbstractString && !isempty(strip(raw_path)) ||
        return _err("InvalidArgument", "Directory path must be text")
    dir_path = expanduser(strip(String(raw_path)))
    isdir(dir_path) || return _err("PathNotFound", "Directory not found: $dir_path")
    canonical = try
        realpath(dir_path)
    catch
        return _err("PathUnavailable", "Could not resolve directory path")
    end
    WorkspacePolicy.contains_path(canonical, _configured_workspace_roots()) ||
        return _err("PathNotAllowed", "Directory is outside the configured workspace roots")
    extensions = nothing
    if length(args) >= 2 && args[2] isa AbstractDict
        raw_exts = get(args[2], "extensions", nothing)
        if raw_exts isa AbstractVector
            extensions = Set{String}(lowercase(String(e)) for e in raw_exts if e isa AbstractString)
        end
    end
    max_entries = MAX_DIRECTORY_ENTRIES
    entries = Any[]
    try
        for item in sort(readdir(canonical; join=true))
            length(entries) >= max_entries && break
            stat_result = try
                stat(item)
            catch
                continue
            end
            is_dir = isdir(stat_result)
            ext = is_dir ? "" : lowercase(Base.Filesystem.splitext(item)[2])
            extensions !== nothing && !is_dir && !(ext in extensions) && continue
            push!(entries, Dict{String,Any}(
                "name" => basename(item),
                "path" => item,
                "isDir" => is_dir,
                "size" => is_dir ? 0 : filesize(stat_result),
                "modified" => string(Dates.unix2datetime(mtime(stat_result))),
            ))
        end
    catch error
        return _err("DirectoryReadFailed", "Could not read directory: $(sprint(showerror, error))")
    end
    _ok(Dict{String,Any}(
        "path" => canonical,
        "entries" => entries,
        "count" => length(entries),
        "truncated" => length(entries) >= max_entries,
    ))
end
