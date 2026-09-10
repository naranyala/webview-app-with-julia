module JuliaStarter

export calculate_fibonacci, fibonacci, frontend_html, greet, main

include("ManualWebview.jl")

"""Return a greeting for `name`."""
function greet(name::AbstractString = "world")
    return "Hello, $(name)!"
end

"""Return the `n`th Fibonacci number, starting with F(0) = 0."""
function fibonacci(n::Integer)::Int
    n < 0 && throw(ArgumentError("n must be non-negative"))

    previous, current = 0, 1
    for _ in 1:n
        previous, current = current, previous + current
    end

    return previous
end

"""Parse a UI value and return the matching Fibonacci calculation."""
function calculate_fibonacci(value)
    n = if value isa Integer
        Int(value)
    elseif value isa Real && isfinite(value) && isinteger(value)
        Int(value)
    elseif value isa AbstractString
        try
            parse(Int, strip(value))
        catch
            throw(ArgumentError("n must be an integer"))
        end
    else
        throw(ArgumentError("n must be an integer"))
    end

    0 <= n <= 50 || throw(ArgumentError("n must be between 0 and 50"))
    return Dict("input" => n, "result" => fibonacci(n))
end

"""Load the final self-contained frontend-preact production bundle."""
function frontend_html()
    default_path = joinpath(dirname(@__DIR__), "frontend-preact", "dist", "index.html")
    path = get(ENV, "JULIA_FRONTEND_HTML", default_path)
    isfile(path) || error(
        "Frontend build not found at `$path`. Run `npm --prefix frontend-preact run build` " *
        "or set JULIA_FRONTEND_HTML to a built index.html path."
    )
    return read(path, String)
end

"""Run the command-line example."""
function main(args = ARGS)
    name = isempty(args) ? "world" : join(args, " ")
    println(greet(name))
    println("fibonacci(10) = ", fibonacci(10))
end

end
