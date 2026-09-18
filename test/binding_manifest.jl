using Test
using WebViewApp.BindingManifest

@testset "Binding manifest" begin
    handlers = ["getNotes", "createNote", "clearDiagnostics", "extraHandler"]
    contract = manifest(handlers)
    @test contract["schemaVersion"] == 1
    @test "closeWindow" in contract["all"]
    @test required_bindings(handlers) == contract["all"]
    report = validate(handlers)
    @test "createNote" in report["missingFrontend"]
    @test "extraHandler" in report["unusedBackend"]
    @test !report["valid"]
    @test validate(frontend_bindings())["valid"]
end
