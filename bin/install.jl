#!/usr/bin/env julia

# Install a built WebViewApp into a user-owned prefix.
include(joinpath(@__DIR__, "..", "src", "Build.jl"))
include(joinpath(@__DIR__, "..", "src", "Deploy.jl"))
using .Build
using .Deploy

function option(name, default)
    prefix = "--" * name * "="
    for arg in ARGS
        startswith(arg, prefix) && return split(arg, "="; limit=2)[2]
    end
    default
end

dry_run = "--dry-run" in ARGS
desktop = !("--no-desktop" in ARGS)
force = "--force" in ARGS
unknown = [arg for arg in ARGS if !(arg in ("--dry-run", "--no-desktop", "--force") || startswith(arg, "--prefix=") || startswith(arg, "--bin-dir="))]
isempty(unknown) || error("unknown argument: $(first(unknown))")

source = project_layout()
layout = deployment_layout(source; prefix=option("prefix", joinpath(homedir(), ".local", "opt", "webview-app")),
    bin_dir=option("bin-dir", joinpath(homedir(), ".local", "bin")))
plan = deployment_plan(layout; force)
println("Install prefix: ", layout.app_dir)
println("Inputs: ", length(plan["inputs"]))
println("Launcher: ", layout.launcher)
dry_run && exit(0)

mkpath(layout.app_dir)
for input in plan["inputs"]
    target = joinpath(layout.app_dir, relpath(input, source.root))
    mkpath(dirname(target))
    cp(input, target; force=true)
end

mkpath(layout.bin_dir)
launcher_script = "#!/usr/bin/env bash\nexec julia --project=" * layout.app_dir * " " * joinpath(layout.app_dir, "bin", "webview_app.jl") * " \"" * string(Char(36), "@") * "\"\n"
write(layout.launcher, launcher_script)
chmod(layout.launcher, 0o755)

if desktop
    mkpath(dirname(layout.desktop_file))
    write(layout.desktop_file, desktop_entry(layout))
    println("Desktop entry: ", layout.desktop_file)
end
println("Installed. Ensure Julia dependencies are available, then run: ", layout.launcher)
