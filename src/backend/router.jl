# ── Router ───────────────────────────────────────────────────────────────────

# Diagnostic helpers used by _get_diagnostics and _clear_diagnostics, which are
# registered in the HANDLERS dict below and must be defined first.
function _get_diagnostics(args)
    limit = isempty(args) ? 200 : (args[1] isa Integer ? Int(args[1]) : 200)
    _ok(Dict("schemaVersion" => 1, "generatedAt" => string(now(UTC)),
        "logPath" => Diagnostics.log_path(), "entries" => Diagnostics.recent(limit)))
end

function _clear_diagnostics(args)
    Diagnostics.clear!()
    _ok(Dict("cleared" => true))
end

function _get_renderer_capabilities(args)
    _ok(Dict("capabilities" => RendererCapability.list_capabilities()))
end

function _get_error_codes(args)
    _ok(Dict("schemaVersion" => ErrorCodes.SCHEMA_VERSION, "codes" => ErrorCodes.all_codes()))
end

function _get_media_cache_stats(args)
    _ok(Dict("schemaVersion" => 1, "stats" => BoundedCache.cache_stats(STATE.media_cache)))
end

function _clear_media_cache(args)
    BoundedCache.cache_clear!(STATE.media_cache)
    _ok(Dict("cleared" => true, "stats" => BoundedCache.cache_stats(STATE.media_cache)))
end

function _support_settings()
    settings = _load_settings()
    ui = get(settings, "ui", Dict{String,Any}())
    plugins = get(settings, "plugins", Dict{String,Any}())
    Dict{String,Any}(
        "schemaVersion" => get(settings, "schemaVersion", 1),
        "ui" => Dict(
            "theme" => get(ui, "theme", "system"),
            "fontSize" => get(ui, "fontSize", 14),
        ),
        "plugins" => Dict(
            "enabled" => get(plugins, "enabled", Any[]),
            "disabled" => get(plugins, "disabled", Any[]),
        ),
    )
end

function _export_support_bundle(args)
    documents = joinpath(homedir(), "Documents")
    isdir(documents) || mkpath(documents)
    default_name = "webview-workbench-support-$(Dates.format(now(UTC), dateformat"yyyymmdd-HHMMSS")).json"
    requested = isempty(args) || !(args[1] isa AbstractString) || isempty(strip(args[1])) ?
        joinpath(documents, default_name) : String(args[1])
    path, error = _validate_write_path(requested, "support bundle")
    error === nothing || return _err(error...)

    bundle = Dict{String,Any}(
        "schemaVersion" => 1,
        "generatedAt" => string(now(UTC)),
        "application" => Dict(
            "name" => "WebView Workbench",
            "juliaVersion" => string(VERSION),
            "platform" => string(Sys.MACHINE),
            "os" => string(Sys.KERNEL),
        ),
        "capabilities" => RendererCapability.list_capabilities(),
        "settings" => _support_settings(),
        "diagnostics" => Diagnostics.recent(500),
    )
    try
        Persistence.atomic_write!(path, JSON3.write(bundle))
        _ok(Dict("path" => path, "size" => filesize(path), "entries" => length(bundle["diagnostics"])))
    catch exception
        _storage_failure(exception, "SupportBundle")
    end
end

function _backup_paper_project(args)
    length(args) >= 1 || return _err("InvalidArgument", "paper project path or handle is required")
    path, error = _paper_project_scope(args[1])
    error === nothing || return _err(error...)
    try
        project = PaperProjects.load_project(path)
        backup_dir = joinpath(path, ".backups")
        isdir(backup_dir) || mkpath(backup_dir)
        timestamp = replace(string(Dates.now()), r"[^\d]" => "-")
        backup_name = "backup-$(timestamp).json"
        backup_path = joinpath(backup_dir, backup_name)
        Persistence.atomic_write!(backup_path, JSON3.write(project))
        _ok(Dict("path" => backup_path, "filename" => backup_name, "size" => filesize(backup_path)))
    catch exception
        _paper_error(exception)
    end
end

function _restore_paper_project(args)
    length(args) >= 2 || return _err("InvalidArgument", "paper project path and backup filename are required")
    path, error = _paper_project_scope(args[1])
    error === nothing || return _err(error...)
    backup_name = args[2]
    backup_name isa AbstractString && !isempty(strip(backup_name)) ||
        return _err("InvalidArgument", "backup filename is required")
    occursin("..", backup_name) && return _err("InvalidArgument", "backup filename is invalid")
    backup_path = joinpath(path, ".backups", backup_name)
    isfile(backup_path) || return _err("PathNotFound", "backup not found: $backup_name")
    try
        raw = read(backup_path, String)
        project = Persistence.normalize_json(JSON3.read(raw))
        project isa AbstractDict || return _err("InvalidPaperProject", "backup contains invalid data")
        saved = PaperProjects.save_project!(path, project)
        _ok(_paper_result(path, saved, args[1]))
    catch exception
        _paper_error(exception)
    end
end

function _list_paper_project_backups(args)
    length(args) >= 1 || return _err("InvalidArgument", "paper project path or handle is required")
    path, error = _paper_project_scope(args[1])
    error === nothing || return _err(error...)
    backup_dir = joinpath(path, ".backups")
    if !isdir(backup_dir)
        return _ok(Dict("backups" => Any[], "count" => 0))
    end
    backups = Any[]
    try
        for file in sort(readdir(backup_dir); rev=true)
            endswith(file, ".json") || continue
            full_path = joinpath(backup_dir, file)
            push!(backups, Dict{String,Any}(
                "filename" => file,
                "size" => filesize(full_path),
                "path" => full_path,
            ))
        end
    catch
    end
    _ok(Dict("backups" => backups, "count" => length(backups)))
end

# Add ordinary RPC bindings here. Window operations are intentionally absent:
# bin/webview_app.jl handles them inline because they require the Window handle.
const HANDLERS = Dict{String,Function}(
    "increment"             => _increment,
    "reset"                 => _reset,
    "getSystemInfo"         => _get_system_info,
    "getTimestamp"          => _get_timestamp,
    "getStatus"             => _get_status,
    "getDiagnostics"        => _get_diagnostics,
    "clearDiagnostics"      => _clear_diagnostics,
    "getRendererCapabilities" => _get_renderer_capabilities,
    "getErrorCodes"         => _get_error_codes,
    "getMediaCacheStats"    => _get_media_cache_stats,
    "clearMediaCache"       => _clear_media_cache,
    "exportSupportBundle"   => _export_support_bundle,
    "backupPaperProject"    => _backup_paper_project,
    "restorePaperProject"   => _restore_paper_project,
    "listPaperProjectBackups" => _list_paper_project_backups,
    "addSearchSource"         => _add_search_source,
    "addMediaSource"          => _add_media_source,
    "getSearchSources"        => _get_search_sources,
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
    "importBibliography"    => _import_bibliography,
    "exportBibliography"    => _export_bibliography,
    "addBibTeXToProject"    => _add_bibtex_to_project,
    # Backward-compatible alias for projects created before the casing was
    # standardized; new frontend code uses addBibTeXToProject.
    "addBibtexToProject"    => _add_bibtex_to_project,
    "getSettings"           => _get_settings,
    "saveSettings"          => _save_settings_handler,
    "createPaperProject"    => _create_paper_project,
    "openPaperProject"      => _open_paper_project,
    "savePaperProject"      => _save_paper_project,
    "validatePaperProject"  => _validate_paper_project,
    "exportPaperProject"    => _export_paper_project,
    "listPaperProjects"     => _list_paper_projects,
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
    "listDirectory"         => _list_directory,
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
    request_id = "req-" * _uuid()
    started_ns = time_ns()
    finish_error(code, message; error=nothing) = begin
        category = _error_category(code)
        recoverable = _recoverable_error(code)
        duration_ms = (time_ns() - started_ns) / 1_000_000
        Diagnostics.record!(level="error", event="request.failed", request_id=request_id,
            operation=name, code=code, message=message, category=category,
            recoverable=recoverable, duration_ms=duration_ms,
            details=error === nothing ? Dict{String,Any}() : Dict("error" => sprint(showerror, error)))
        _error_envelope(code, message, request_id, name, category, recoverable)
    end
    handler = get(HANDLERS, name, nothing)
    handler === nothing && return finish_error("UnknownBinding", "No handler for binding: $name")
    name == "mirAnalyze" && ncodeunits(payload) > MAX_MIR_PAYLOAD_BYTES &&
        return finish_error("AudioTooLarge", "MIR request payload is too large")
    ncodeunits(payload) > MAX_REQUEST_PAYLOAD_BYTES &&
        return finish_error("PayloadTooLarge", "Request payload exceeds the $(MAX_REQUEST_PAYLOAD_BYTES)-byte limit")
    try
        args = _parse_args(payload)
        status, result = handler(args)
        if status == 0
            name in ("getDiagnostics", "clearDiagnostics") || Diagnostics.record!(event="request.completed",
                request_id=request_id, operation=name, duration_ms=(time_ns() - started_ns) / 1_000_000)
            return status, result
        end
        parsed = try JSON3.read(result) catch; nothing end
        code = parsed === nothing ? "ApplicationError" : String(get(parsed, :code, "ApplicationError"))
        message = parsed === nothing ? "The operation failed." : String(get(parsed, :message, "The operation failed."))
        return finish_error(code, message)
    catch e
        finish_error("InternalError", "An unexpected backend error occurred."; error=e)
    end
end

function _error_category(code::AbstractString)
    ErrorCodes.category(code)
end

_recoverable_error(code::AbstractString) = ErrorCodes.recoverable(code)

_error_envelope(code, message, request_id, operation, category, recoverable) =
    _err(code, message; request_id, operation, category, recoverable)

# ── Initialization ───────────────────────────────────────────────────────────

function __init__()
    try
        Diagnostics.configure!(DIAGNOSTICS_FILE)
        Diagnostics.record!(event="application.started", operation="startup")
    catch error
        STATE.storage_errors["diagnostics"] = sprint(showerror, error)
    end
    try
        _ensure_config_dir()
    catch error
        STATE.storage_errors["config"] = sprint(showerror, error)
    end
    STATE.notes = _load_store(NOTES_STORE, "notes")
end
