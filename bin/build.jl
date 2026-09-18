#!/usr/bin/env julia

"""Inspect the WebViewApp build plan without executing external commands.

Usage:
  julia bin/build.jl             # print the current plan
  julia bin/build.jl --force     # show all build steps as required
  julia bin/build.jl --check     # exit 1 when generated outputs are stale
  julia bin/build.jl --json      # emit a machine-readable dry-run plan
"""

include(joinpath(@__DIR__, "..", "src", "Build.jl"))
using .Build

force = "--force" in ARGS
check = "--check" in ARGS
json = "--json" in ARGS
unknown = [arg for arg in ARGS if arg ∉ ("--force", "--check", "--json")]
isempty(unknown) || error("unknown argument: $(first(unknown))")

plan = build_plan(; force)
json && (println(plan_json(plan)); exit(0))
for component in ("frontend", "native", "julia")
    step = plan[component]
    needed = get(step, "needed", true)
    println(component, ": ", needed ? "build" : "up-to-date")
    println("  ", join(step["command"], " "))
end

if check
    stale = any(get(plan[name], "needed", false) for name in ("frontend", "native"))
    artifact = plan["frontend"]["artifact"]
    invalid_artifact = artifact["exists"] && !artifact["valid"]
    exit(stale || invalid_artifact ? 1 : 0)
end
