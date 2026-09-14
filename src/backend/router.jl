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
    "startMediaConversion" => _start_media_conversion,
    "getMediaConversionStatus" => _get_media_conversion_status,
    "cancelMediaConversion" => _cancel_media_conversion,
    "getMediaCapabilities"  => _get_media_capabilities,
    "htmlToText"            => _html_to_text,
)
const RESERVED_SHELL_BINDINGS = Set((
    "minimizeWindow",
    "maximizeWindow",
    "restoreWindow",
    "closeWindow",
))

"""Register an application/plugin RPC handler before the native shell starts.

Plugin handlers receive the decoded argument vector and must return the same
`(status, json)` tuple as built-in handlers. Existing bindings are protected
unless `replace=true` is explicitly requested by the host.
"""
function register_handler!(name::AbstractString, handler::Function; replace::Bool=false)
    key = strip(String(name))
    isempty(key) && throw(ArgumentError("handler name must not be empty"))
    key in RESERVED_SHELL_BINDINGS &&
        throw(ArgumentError("handler name is reserved by the native shell: $key"))
    (!replace && haskey(HANDLERS, key)) &&
        throw(ArgumentError("handler already registered: $key"))
    HANDLERS[key] = handler
    key
end

function unregister_handler!(name::AbstractString)
    key = String(name)
    haskey(HANDLERS, key) || return false
    delete!(HANDLERS, key)
    true
end

handler_names() = sort!(collect(keys(HANDLERS)))

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
end
