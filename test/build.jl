using Test
using WebViewApp.Build

@testset "Build utilities" begin
    mktempdir() do root
        frontend = joinpath(root, "frontend")
        native = joinpath(root, "native")
        mkpath(joinpath(frontend, "src"))
        mkpath(joinpath(frontend, "public"))
        mkpath(joinpath(frontend, "scripts"))
        mkpath(joinpath(frontend, "dist"))
        mkpath(joinpath(native, "lib"))
        write(joinpath(frontend, "src", "main.js"), "console.log(1)")
        write(joinpath(frontend, "rsbuild.config.js"), "export default {}")
        write(joinpath(frontend, "package.json"), "{}")
        layout = project_layout(root)

        @test validate_layout(layout) === layout
        @test joinpath(frontend, "src", "main.js") in frontend_inputs(layout)
        @test needs_frontend_build(layout)
        write(layout.frontend_dist, "old")
        @test !needs_frontend_build(layout)
        artifact = verify_frontend_artifact(layout)
        @test !artifact["valid"]
        write(layout.frontend_dist, "<html><body><div id=\"root\"></div><script></script></body></html>")
        @test verify_frontend_artifact(layout)["valid"]
        write(layout.frontend_dist, "<html><body><div id=\"root\"></div><script src=\"app.js\"></script></body></html>")
        @test !verify_frontend_artifact(layout)["valid"]
        sleep(0.02)
        write(joinpath(frontend, "src", "new.js"), "new")
        @test needs_frontend_build(layout)
        @test needs_native_build(layout)
        write(layout.webview_library, "lib")
        write(layout.bridge_library, "bridge")
        @test !needs_native_build(layout)

        plan = build_plan(layout; force=true)
        @test plan["frontend"]["needed"]
        @test plan["native"]["needed"]
        @test command_spec(layout, :frontend)[1:2] == ["npm", "--prefix"]
        @test native_requirements(layout)["webview_version"] == "0.12.0"
        @test startswith(plan_json(plan), "{")
        @test_throws ArgumentError command_spec(layout, :unknown)
    end
end
