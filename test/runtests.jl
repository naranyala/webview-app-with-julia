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
    @test occursin("<div id=\"root\"></div>", frontend_html())
    @test !occursin("src=\"/static/", frontend_html())
    @test !occursin("href=\"/static/", frontend_html())
end

include("backend.jl")
include("modules.jl")
include("build.jl")
include("deploy.jl")
include("binding_manifest.jl")
include("edge_cases.jl")
include("diagnostics.jl")
if isfile(ManualWebview.BRIDGE_LIBRARY)
    include("native_bridge.jl")
end
include("jobs.jl")
include("persistence.jl")
include("workspace_policy.jl")
include("paper_projects.jl")
include("settings_and_bibtex.jl")
