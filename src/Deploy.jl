"""Pure deployment planning for a user-local WebViewApp installation."""
module Deploy

using ..Build

export DeploymentLayout, deployment_layout, deployment_plan, desktop_entry,
    runtime_inputs

struct DeploymentLayout
    source::Build.ProjectLayout
    prefix::String
    app_dir::String
    bin_dir::String
    launcher::String
    desktop_file::String
end

function deployment_layout(source::Build.ProjectLayout=Build.project_layout();
    prefix::AbstractString=joinpath(homedir(), ".local", "opt", "webview-app"),
    bin_dir::AbstractString=joinpath(homedir(), ".local", "bin"))
    prefix_path = abspath(expanduser(String(prefix)))
    bin_path = abspath(expanduser(String(bin_dir)))
    DeploymentLayout(source, prefix_path, prefix_path, bin_path,
        joinpath(bin_path, "webview-app"),
        joinpath(homedir(), ".local", "share", "applications", "webview-app.desktop"))
end

runtime_inputs(layout::DeploymentLayout) = filter(ispath, [
    joinpath(layout.source.root, "Project.toml"),
    joinpath(layout.source.root, "Manifest.toml"),
    joinpath(layout.source.root, "src"),
    joinpath(layout.source.root, "packages"),
    joinpath(layout.source.root, "bin", "webview_app.jl"),
    layout.source.frontend_dist,
    layout.source.webview_library,
    layout.source.bridge_library,
])

function deployment_plan(layout::DeploymentLayout=deployment_layout(); force::Bool=false)
    Build.validate_layout(layout.source)
    artifact = Build.verify_frontend_artifact(layout.source)
    artifact["valid"] || throw(ArgumentError("frontend artifact is missing or invalid: $(artifact["path"])") )
    isempty(runtime_inputs(layout)) && throw(ArgumentError("no runtime inputs found"))
    Dict{String,Any}(
        "prefix" => layout.prefix,
        "app_dir" => layout.app_dir,
        "launcher" => layout.launcher,
        "desktop_file" => layout.desktop_file,
        "force" => force,
        "inputs" => runtime_inputs(layout),
        "frontend_artifact" => artifact,
        "native_outputs" => [layout.source.webview_library, layout.source.bridge_library],
        "julia_project" => joinpath(layout.app_dir, "Project.toml"),
    )
end

function desktop_entry(layout::DeploymentLayout)
    "[Desktop Entry]\n" *
    "Type=Application\n" *
    "Name=WebView App\n" *
    "Comment=Local-first research and writing workspace\n" *
    "Exec=$(layout.launcher)\n" *
    "Terminal=false\n" *
    "Categories=Office;Utility;\n"
end

end
