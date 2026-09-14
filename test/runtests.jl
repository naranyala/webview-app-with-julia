using Test
using WebViewApp

@testset "WebViewApp" begin
    @test greet() == "Hello, world!"
    @test greet("Julia") == "Hello, Julia!"
    @test fibonacci(0) == 0
    @test fibonacci(1) == 1
    @test fibonacci(10) == 55
    @test_throws ArgumentError fibonacci(-1)
    @test calculate_fibonacci(10) == Dict("input" => 10, "result" => 55)
    @test calculate_fibonacci("12") == Dict("input" => 12, "result" => 144)
    @test_throws ArgumentError calculate_fibonacci(51)
    @test occursin("<title>WebView Workbench</title>", frontend_html())
    @test occursin("<div id=\"app\"></div>", frontend_html())
end

include("backend.jl")
include("modules.jl")
include("jobs.jl")
include("persistence.jl")
