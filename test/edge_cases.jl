using Test
using WebViewApp
using WebViewApp.StructuredDiagnostics

@testset "Abstraction edge cases" begin
    @testset "error registry invariants" begin
        codes = ErrorCodes.all_codes()
        names = [entry["code"] for entry in codes]
        @test issorted(names)
        @test length(names) == length(unique(names))
        @test ErrorCodes.category("unknown-code") == "application"
        @test ErrorCodes.recoverable("InternalError") == false
        @test ErrorCodes.recoverable("unknown-code") == true
    end

    @testset "binding manifest normalization" begin
        input = ["getNotes", "getNotes", "createNote"]
        contract = BindingManifest.manifest(input)
        @test contract["backend"] == ["createNote", "getNotes"]
        push!(contract["frontend"], "mutated")
        @test !("mutated" in BindingManifest.frontend_bindings())
        @test all(name -> name isa String, BindingManifest.required_bindings(input))
    end

    @testset "build artifact rejection" begin
        mktempdir() do root
            frontend = joinpath(root, "frontend")
            native = joinpath(root, "native")
            mkpath(joinpath(frontend, "src"))
            mkpath(joinpath(frontend, "dist"))
            mkpath(joinpath(native, "lib"))
            write(joinpath(frontend, "dist", "index.html"),
                "<html><body><div id=\"root\"></div><img src=\"asset.png\"></body></html>")
            layout = Build.project_layout(root)
            report = Build.verify_frontend_artifact(layout)
            @test !report["valid"]
            @test report["external_assets"] == ["asset.png"]
            @test_throws ArgumentError Deploy.deployment_plan(Deploy.deployment_layout(layout))
        end
    end

    @testset "diagnostics rotation" begin
        mktempdir() do root
            path = joinpath(root, "diagnostics.jsonl")
            store = StructuredDiagnostics.DiagnosticsStore(path=path, max_log_bytes=100)
            StructuredDiagnostics.record!(store; event="first", details=Dict("payload" => repeat("x", 120)))
            StructuredDiagnostics.record!(store; event="second")
            @test isfile(path)
            @test isfile(path * ".1")
            @test !isempty(StructuredDiagnostics.recent(store))
        end
    end
end
