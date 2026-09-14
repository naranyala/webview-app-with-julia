"""
    StaticMediaAdapter

Application boundary around StaticMediaCompanion.jl. The companion library
owns media detection, text/Markdown processing, and conversion routing; this
adapter converts its Julia structs and symbols into JSON-friendly dictionaries
for Backend.jl. It deliberately does not expose executable paths or native
library handles to the frontend.
"""
module StaticMediaAdapter

using StaticMediaCompanion

export MediaTooLargeError, inspect_media, markdown_to_html, read_text, write_text,
    plan_conversion, convert_media, get_media_capabilities, html_to_text,
    error_code

const MAX_TEXT_BYTES = 16 * 1024 * 1024
const MEDIA_SCHEMA_VERSION = 1

function _provenance(backend::AbstractString)
    Dict{String,Any}(
        "engine" => "StaticMediaCompanion",
        "engineVersion" => string(Base.pkgversion(StaticMediaCompanion)),
        "backend" => String(backend),
    )
end

struct MediaTooLargeError <: Exception
    detail::String
end

Base.showerror(io::IO, error::MediaTooLargeError) = print(io, error.detail)

function error_code(error)
    error isa MediaTooLargeError && return "MediaTooLarge"
    error isa BackendUnavailableError && return "BackendUnavailable"
    error isa ConversionError && return "ConversionFailed"
    if error isa ArgumentError
        message = sprint(showerror, error)
        occursin("does not exist", message) && return "MediaNotFound"
        occursin("not found", message) && return "MediaNotFound"
        return "MediaInvalid"
    end
    "MediaFailed"
end

function _bounded_text(path::AbstractString)
    isfile(path) || return
    filesize(path) <= MAX_TEXT_BYTES || throw(MediaTooLargeError(
        "text file exceeds the $(MAX_TEXT_BYTES)-byte limit: $path",
    ))
end

function _kind_name(kind)
    String(StaticMediaCompanion.media_kind_name(kind))
end

function _media_info_dict(info::StaticMediaCompanion.MediaInfo)
    Dict{String,Any}(
        "schemaVersion" => MEDIA_SCHEMA_VERSION,
        "provenance" => _provenance("media-info"),
        "path" => info.path,
        "kind" => _kind_name(info.kind),
        "mime" => info.mime,
        "extension" => info.extension,
        "size" => info.size,
        "width" => info.width,
        "height" => info.height,
    )
end

function inspect_media(path::AbstractString)
    _media_info_dict(StaticMediaCompanion.media_info(path; sniff=true))
end

function markdown_to_html(content::AbstractString)
    ncodeunits(content) <= MAX_TEXT_BYTES || throw(MediaTooLargeError(
        "Markdown content exceeds the $(MAX_TEXT_BYTES)-byte limit",
    ))
    StaticMediaCompanion.markdown_to_html(content; standalone=true, safe=true)
end

function read_text(path::AbstractString)
    _bounded_text(path)
    StaticMediaCompanion.read_text(path; normalize_newlines=true, max_bytes=MAX_TEXT_BYTES)
end

function write_text(path::AbstractString, content::AbstractString)
    ncodeunits(content) <= MAX_TEXT_BYTES || throw(MediaTooLargeError(
        "text content exceeds the $(MAX_TEXT_BYTES)-byte limit",
    ))
    written_path = StaticMediaCompanion.write_text(
        path,
        content;
        newline=:lf,
        create_dirs=true,
        atomic=true,
    )
    Dict{String,Any}("path" => String(written_path), "size" => filesize(written_path))
end

function _plan_dict(plan::StaticMediaCompanion.ConversionPlan)
    Dict{String,Any}(
        "schemaVersion" => MEDIA_SCHEMA_VERSION,
        "provenance" => _provenance(String(plan.backend)),
        "input" => plan.input,
        "output" => plan.output,
        "sourceKind" => _kind_name(plan.source_kind),
        "targetKind" => _kind_name(plan.target_kind),
        "backend" => String(plan.backend),
        "requiresExternalTool" => plan.requires_external_tool,
        "lossiness" => String(plan.lossiness),
    )
end

function plan_conversion(input::AbstractString, output::AbstractString)
    _plan_dict(StaticMediaCompanion.plan_conversion(input, output))
end

function convert_media(input::AbstractString, output::AbstractString;
                       timeout_seconds=nothing, cancel=nothing)
    result = StaticMediaCompanion.convert_media_result(
        input,
        output;
        timeout_seconds=timeout_seconds,
        cancel=cancel,
    )
    Dict{String,Any}(
        "schemaVersion" => MEDIA_SCHEMA_VERSION,
        "provenance" => _provenance(String(result.backend)),
        "output" => result.output,
        "backend" => String(result.backend),
        "sourceKind" => _kind_name(result.source_kind),
        "targetKind" => _kind_name(result.target_kind),
        "bytesWritten" => result.bytes_written,
        "warnings" => String[String(warning) for warning in result.warnings],
    )
end

function _capability_value(value)
    if value isa AbstractDict
        return Dict{String,Any}(
            string(key) => _capability_value(item)
            for (key, item) in pairs(value)
            if string(key) != "library"
        )
    elseif value isa AbstractVector
        return Any[_capability_value(item) for item in value]
    elseif value isa Symbol
        return String(value)
    elseif value isa AbstractString || value isa Number || value isa Bool || value === nothing
        return value
    end
    String(value)
end

function get_media_capabilities()
    raw_tools = StaticMediaCompanion.available_tools()
    tools = Dict{String,Any}(
        string(name) => (path !== nothing)
        for (name, path) in pairs(raw_tools)
    )
    Dict{String,Any}(
        "schemaVersion" => MEDIA_SCHEMA_VERSION,
        "provenance" => _provenance("capability-report"),
        "backend" => _capability_value(StaticMediaCompanion.backend_capabilities()),
        "tools" => tools,
    )
end

function html_to_text(html::AbstractString)
    ncodeunits(html) <= MAX_TEXT_BYTES || throw(MediaTooLargeError(
        "HTML content exceeds the $(MAX_TEXT_BYTES)-byte limit",
    ))
    StaticMediaCompanion.html_to_text(html)
end

end
