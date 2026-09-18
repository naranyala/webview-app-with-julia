"""
    Build

Pure build-system utilities for the WebViewApp repository. `Build` does not
execute subprocesses; it describes the project layout, determines whether
generated outputs are stale, and returns canonical command specifications for
the shell/CI layer to execute.
"""
module Build

export ProjectLayout, project_layout, validate_layout, frontend_inputs,
    newest_mtime, needs_frontend_build, needs_native_build, build_plan,
    command_spec, verify_frontend_artifact, native_requirements, plan_json

struct ProjectLayout
    root::String
    frontend::String
    frontend_dist::String
    frontend_entry::String
    frontend_config::String
    native::String
    native_script::String
    webview_library::String
    bridge_library::String
    julia_entry::String
end

function project_layout(root::AbstractString=normpath(joinpath(@__DIR__, "..")))
    root_path = abspath(expanduser(String(root)))
    frontend = joinpath(root_path, "frontend")
    native = joinpath(root_path, "native")
    ProjectLayout(
        root_path,
        frontend,
        joinpath(frontend, "dist", "index.html"),
        joinpath(frontend, "src"),
        joinpath(frontend, "rsbuild.config.js"),
        native,
        joinpath(native, "build_webview.sh"),
        joinpath(native, "lib", "libwebview.so"),
        joinpath(native, "lib", "libjulia_webview_bridge.so"),
        joinpath(root_path, "bin", "webview_app.jl"),
    )
end

function validate_layout(layout::ProjectLayout)
    isdir(layout.root) || throw(ArgumentError("project root does not exist: $(layout.root)"))
    isdir(layout.frontend) || throw(ArgumentError("frontend directory does not exist: $(layout.frontend)"))
    isdir(layout.native) || throw(ArgumentError("native directory does not exist: $(layout.native)"))
    layout
end

function frontend_inputs(layout::ProjectLayout)
    paths = String[]
    for path in (layout.frontend_entry, joinpath(layout.frontend, "public"), joinpath(layout.frontend, "scripts"))
        isfile(path) && push!(paths, path)
        isdir(path) && append!(paths, String[joinpath(root, file) for (root, _, files) in walkdir(path) for file in files])
    end
    for path in (layout.frontend_config, joinpath(layout.frontend, "package.json"), joinpath(layout.frontend, "package-lock.json"))
        isfile(path) && push!(paths, path)
    end
    sort!(unique(paths))
end

function newest_mtime(paths)
    mtimes = Float64[]
    for path in paths
        isfile(path) || continue
        push!(mtimes, Float64(stat(path).mtime))
    end
    isempty(mtimes) ? 0.0 : maximum(mtimes)
end

function needs_frontend_build(layout::ProjectLayout; force::Bool=false)
    force || !isfile(layout.frontend_dist) ||
        newest_mtime(frontend_inputs(layout)) > Float64(stat(layout.frontend_dist).mtime)
end

function needs_native_build(layout::ProjectLayout; force::Bool=false)
    force || !isfile(layout.webview_library) || !isfile(layout.bridge_library)
end

"""Inspect the generated HTML contract expected by the desktop WebView host."""
function verify_frontend_artifact(layout::ProjectLayout)
    path = layout.frontend_dist
    if !isfile(path)
        return Dict{String,Any}("path" => path, "exists" => false, "valid" => false,
            "single_file" => false, "has_root" => false, "external_assets" => String[])
    end
    html = read(path, String)
    external = String[]
    for match in eachmatch(r"<(script|link|img|iframe|object|embed|source)\b[^>]*(?:src|href)=['\"]([^'\"]+)['\"]"is, html)
        value = match.captures[2]
        startswith(value, "data:") || startswith(value, "#") || push!(external, value)
    end
    single_file = !occursin(r"<script\b[^>]*\bsrc=|<link\b[^>]*\bhref="is, html)
    has_root = occursin(r"<div\b[^>]*\bid=['\"]root['\"]"is, html)
    Dict{String,Any}("path" => path, "exists" => true,
        "valid" => single_file && has_root && isempty(external),
        "single_file" => single_file, "has_root" => has_root,
        "external_assets" => unique(external))
end

"""Return native build inputs/outputs and the pinned WebView source contract."""
function native_requirements(layout::ProjectLayout)
    Dict{String,Any}(
        "commands" => ["bash", "cmake", "pkg-config", "g++"],
        "pkg_config" => ["gtk+-3.0", "webkit2gtk-4.1"],
        "webview_version" => "0.12.0",
        "script" => layout.native_script,
        "outputs" => [layout.webview_library, layout.bridge_library],
    )
end

function command_spec(layout::ProjectLayout, component::Symbol)
    component == :frontend && return ["npm", "--prefix", layout.frontend, "run", "build"]
    component == :native && return ["bash", layout.native_script]
    component == :julia && return ["julia", "--project=$(layout.root)", "-e", "using Pkg; Pkg.instantiate()"]
    throw(ArgumentError("unknown build component: $component"))
end

function build_plan(layout::ProjectLayout=project_layout(); force::Bool=false)
    validate_layout(layout)
    frontend = needs_frontend_build(layout; force)
    native = needs_native_build(layout; force)
    Dict{String,Any}(
        "root" => layout.root,
        "frontend" => Dict("needed" => frontend, "output" => layout.frontend_dist,
            "command" => command_spec(layout, :frontend),
            "artifact" => verify_frontend_artifact(layout)),
        "native" => Dict("needed" => native, "outputs" => [layout.webview_library, layout.bridge_library],
            "command" => command_spec(layout, :native), "requirements" => native_requirements(layout)),
        "julia" => Dict("needed" => true, "command" => command_spec(layout, :julia)),
    )
end

function _json(value)
    value isa AbstractString && return "\"" * replace(value, "\\" => "\\\\", "\"" => "\\\"", "\n" => "\\n") * "\""
    value isa Bool && return value ? "true" : "false"
    value isa Number && return string(value)
    value isa AbstractVector && return "[" * join((_json(item) for item in value), ",") * "]"
    value isa AbstractDict && return "{" * join((_json(string(key)) * ":" * _json(item) for (key, item) in sort(collect(value); by=x -> string(first(x)))), ",") * "}"
    _json(string(value))
end

"""Serialize a build plan without requiring JSON3 or another package dependency."""
plan_json(plan::AbstractDict) = _json(plan)

end
