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
