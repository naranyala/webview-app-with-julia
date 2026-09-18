using Test
using JSON3
using WebViewApp
using WebViewApp.Diagnostics

@testset "Diagnostics" begin
    tmpdir = mktempdir()
    log_file = joinpath(tmpdir, "test-diagnostics.jsonl")

    @testset "configure and log_path" begin
        result = Diagnostics.configure!(log_file)
        @test result == abspath(log_file)
        @test Diagnostics.log_path() == abspath(log_file)
    end

    @testset "record! returns entry" begin
        entry = Diagnostics.record!(level="info", event="test.event", operation="test-op")
        @test entry["schemaVersion"] == 1
        @test entry["level"] == "info"
        @test entry["event"] == "test.event"
        @test entry["operation"] == "test-op"
        @test haskey(entry, "timestamp")
        @test haskey(entry, "requestId")
        @test entry["recoverable"] == false
    end

    @testset "recent returns bounded entries" begin
        Diagnostics.clear!()
        for i in 1:5
            Diagnostics.record!(event="batch.$i", operation="batch")
        end
        entries = Diagnostics.recent(3)
        @test length(entries) == 3
        @test entries[end]["event"] == "batch.5"
        @test entries[1]["event"] == "batch.3"
    end

    @testset "recent clamps to MAX_MEMORY_ENTRIES" begin
        Diagnostics.clear!()
        Diagnostics.record!(event="single", operation="clamp-test")
        entries = Diagnostics.recent(9999)
        @test length(entries) == 1
    end

    @testset "clear! empties memory and log file" begin
        Diagnostics.record!(event="before-clear", operation="clear-test")
        Diagnostics.clear!()
        entries = Diagnostics.recent()
        @test isempty(entries)
        @test isfile(log_file)
        @test filesize(log_file) == 0
    end

    @testset "record! with details and duration" begin
        Diagnostics.clear!()
        entry = Diagnostics.record!(
            level="error",
            event="detailed.event",
            code="TestError",
            message="something broke",
            category="test",
            recoverable=true,
            duration_ms=123.456,
            details=Dict{String,Any}("key" => "value"),
        )
        @test entry["code"] == "TestError"
        @test entry["message"] == "something broke"
        @test entry["category"] == "test"
        @test entry["recoverable"] == true
        @test entry["durationMs"] == 123.456
        @test entry["details"]["key"] == "value"
    end

    @testset "redaction" begin
        entry = Diagnostics.record!(event="redacted", details=Dict(
            "api_key" => "secret",
            "nested" => Dict("password" => "also-secret"),
            "path" => joinpath(homedir(), "Documents", "draft.md"),
        ))
        @test entry["details"]["api_key"] == "[REDACTED]"
        @test entry["details"]["nested"]["password"] == "[REDACTED]"
        @test !occursin(homedir(), entry["details"]["path"])
    end

    @testset "log file contains JSONL entries" begin
        Diagnostics.clear!()
        Diagnostics.record!(event="log-test", operation="log-test")
        content = read(log_file, String)
        @test occursin("log-test", content)
        lines = filter(!isempty, split(content, "\n"))
        @test length(lines) >= 1
        parsed = JSON3.read(lines[1])
        @test parsed["event"] == "log-test"
    end

    @testset "unavailable log directory does not crash" begin
        bad_path = joinpath(tmpdir, "nonexistent", "deep", "test.jsonl")
        Diagnostics.configure!(bad_path)
        entry = Diagnostics.record!(event="bad-path-test")
        @test entry["event"] == "bad-path-test"
        # Restore to valid path for cleanup
        Diagnostics.configure!(log_file)
    end

    Diagnostics.clear!()
    rm(tmpdir; force=true, recursive=true)
end
