#!/usr/bin/env julia

"""
Measure the current idle bridge-loop baseline without opening a desktop window.

The production loop in `bin/webview_app.jl` pumps GLib, drains the native
bridge queue, and sleeps for 10 ms when idle. This harness exercises the same
GLib/queue calls on an empty queue so the polling cadence can be recorded
before changing the wake-up strategy. Wrap the command with `/usr/bin/time` to
capture process CPU usage as well.

Examples:
    julia --project=. scripts/measure_event_loop.jl
    julia --project=. scripts/measure_event_loop.jl --iterations=500 --interval-ms=10
"""

using JSON3
include(joinpath(@__DIR__, "..", "src", "ManualWebview.jl"))
using .ManualWebview

function _option(name::AbstractString, default)
    prefix = "--$(name)="
    value = findfirst(argument -> startswith(argument, prefix), ARGS)
    value === nothing && return default
    raw = ARGS[value][length(prefix) + 1:end]
    parsed = try
        parse(Int, raw)
    catch
        error("$name must be an integer")
    end
    parsed >= 0 || error("$name must be non-negative")
    parsed
end

function main()
    iterations = _option("iterations", 100)
    interval_ms = _option("interval-ms", 10)
    queue = ManualWebview.create_queue()
    drained = 0
    started = time_ns()
    try
        for _ in 1:iterations
            ManualWebview.pump!()
            request = ManualWebview.next!(queue)
            while request !== nothing
                drained += 1
                Base.close(request)
                request = ManualWebview.next!(queue)
            end
            interval_ms > 0 && sleep(interval_ms / 1000)
        end
    finally
        ManualWebview.destroy_queue!(queue)
    end

    elapsed_seconds = (time_ns() - started) / 1e9
    result = Dict(
        "mode" => "bridge-idle-poll",
        "iterations" => iterations,
        "configuredIntervalMs" => interval_ms,
        "elapsedSeconds" => elapsed_seconds,
        "effectivePollsPerSecond" => elapsed_seconds > 0 ? iterations / elapsed_seconds : 0.0,
        "drainedRequests" => drained,
        "nativeWakeup" => false,
    )
    println(JSON3.write(result))
end

main()
