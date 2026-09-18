using Test
using WebViewApp.Deploy
using WebViewApp.Build

@testset "Deployment planning" begin
    root = normpath(joinpath(@__DIR__, ".."))
    layout = deployment_layout(project_layout(root); prefix="/tmp/webview-app-test")
    @test endswith(layout.launcher, "/webview-app")
    @test occursin("[Desktop Entry]", desktop_entry(layout))
end
