# ── Settings persistence ──────────────────────────────────────────────────────

const DEFAULT_SETTINGS = Dict{String,Any}(
    "schemaVersion" => 1,
    "workspace" => Dict{String,Any}(
        "roots" => String[],
        "defaultNotesPath" => "",
    ),
    "ui" => Dict{String,Any}(
        "theme" => "system",
        "sidebarCollapsed" => false,
        "fontSize" => 14,
    ),
    "plugins" => Dict{String,Any}(
        "enabled" => String[],
        "disabled" => String[],
    ),
    "paper" => Dict{String,Any}(
        "defaultTemplateId" => "default",
        "recentProjects" => String[],
    ),
)

const SETTINGS_STORE = Persistence.Store(SETTINGS_FILE; schema_version=1, max_bytes=1 * 1024 * 1024)

function _configured_workspace_roots()
    documents = joinpath(homedir(), "Documents")
    isdir(documents) || mkpath(documents)
    candidates = Any[documents]
    settings = _load_settings()
    workspace = get(settings, "workspace", nothing)
    workspace isa AbstractDict && append!(candidates, get(workspace, "roots", Any[]))
    WorkspacePolicy.canonical_roots(candidates)
end

function _load_settings()
    try
        value = Persistence.load(SETTINGS_STORE; default=DEFAULT_SETTINGS)
        value isa AbstractDict || throw(Persistence.StorageError(
            :corrupt,
            SETTINGS_FILE,
            "settings must be an object: $(SETTINGS_FILE)",
        ))
        merged = deepcopy(DEFAULT_SETTINGS)
        for (key, val) in value
            merged[key] = Persistence.normalize_json(val)
        end
        STATE.storage_errors["settings"] = ""
        merged
    catch error
        STATE.storage_errors["settings"] = sprint(showerror, error)
        deepcopy(DEFAULT_SETTINGS)
    end
end

function _save_settings(settings::Dict{String,Any})
    Persistence.save!(SETTINGS_STORE, settings)
    delete!(STATE.storage_errors, "settings")
    settings
end

function _deep_merge(base::Dict{String,Any}, overrides::Dict{String,Any})
    result = deepcopy(base)
    for (key, val) in overrides
        if val isa AbstractDict && haskey(result, key) && result[key] isa AbstractDict
            result[key] = _deep_merge(result[key], Dict{String,Any}(string(k) => v for (k, v) in val))
        else
            result[key] = deepcopy(val)
        end
    end
    result
end

function _validate_settings(settings::Dict{String,Any})
    errors = String[]
    for key in ("workspace", "ui", "plugins", "paper")
        haskey(settings, key) && settings[key] isa AbstractDict || push!(errors, "missing settings section: $key")
    end
    if haskey(settings, "workspace") && settings["workspace"] isa AbstractDict
        roots = get(settings["workspace"], "roots", nothing)
        roots isa AbstractVector || push!(errors, "workspace.roots must be an array")
        if roots isa AbstractVector
            for (index, root) in enumerate(roots)
                root isa AbstractString && !isempty(strip(root)) ||
                    push!(errors, "workspace root $index must be a non-empty string")
                if root isa AbstractString && !isempty(strip(root))
                    expanded = expanduser(strip(String(root)))
                    isdir(expanded) || push!(errors, "workspace root $index must be an existing directory")
                end
            end
        end
    end
    if haskey(settings, "ui") && settings["ui"] isa AbstractDict
        theme = get(settings["ui"], "theme", nothing)
        theme in ("system", "light", "dark") || push!(errors, "ui.theme must be system, light, or dark")
        fontSize = get(settings["ui"], "fontSize", nothing)
        fontSize isa Integer && fontSize >= 10 && fontSize <= 32 || push!(errors, "ui.fontSize must be an integer between 10 and 32")
    end
    if haskey(settings, "paper") && settings["paper"] isa AbstractDict
        recentProjects = get(settings["paper"], "recentProjects", nothing)
        recentProjects isa AbstractVector || push!(errors, "paper.recentProjects must be an array")
        if recentProjects isa AbstractVector
            for (index, path) in enumerate(recentProjects)
                path isa AbstractString || push!(errors, "paper.recentProject $index must be a string")
            end
            length(recentProjects) > 20 && push!(errors, "paper.recentProjects must have at most 20 entries")
        end
    end
    errors
end

function _get_settings(args)
    _ok(_load_settings())
end

function _save_settings_handler(args)
    length(args) >= 1 || return _err("InvalidArgument", "settings object is required")
    overrides = args[1]
    overrides isa AbstractDict || return _err("InvalidArgument", "settings must be an object")
    current = _load_settings()
    merged = _deep_merge(current, Dict{String,Any}(string(k) => v for (k, v) in overrides))
    errors = _validate_settings(merged)
    isempty(errors) || return _err("InvalidSettings", join(errors, "; "))
    try
        _ok(_save_settings(merged))
    catch error
        _storage_failure(error, "Settings")
    end
end
