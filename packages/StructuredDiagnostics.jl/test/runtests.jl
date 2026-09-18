using Test
using StructuredDiagnostics

function _parse_json_dict(s::AbstractString)
    dict = Dict{String,Any}()
    s = strip(s)
    s = s[2:end-1]
    key = ""
    val = ""
    in_key = false
    in_val = false
    i = 1
    while i <= length(s)
        c = s[i]
        if c == '"' && !in_val
            in_key = !in_key
            if !in_key
                key = strip(val)
                val = ""
            end
        elseif c == ':' && !in_key
            in_val = true
        elseif c == ',' && in_val
            dict[key] = strip(val)
            val = ""
            in_val = false
        elseif in_val
            val *= c
        end
        i += 1
    end
    if !isempty(key) && !isempty(val)
        dict[key] = strip(val)
    end
    return dict
end

@testset "StructuredDiagnostics" begin
    @testset "constructor" begin
        store = DiagnosticsStore()
        @test log_path(store) == ""

        store2 = DiagnosticsStore(max_memory_entries=100, max_log_bytes=1024)
        @test log_path(store2) == ""

        @test_throws ArgumentError DiagnosticsStore(max_memory_entries=0)
        @test_throws ArgumentError DiagnosticsStore(max_log_bytes=0)
        @test_throws ArgumentError DiagnosticsStore(max_detail_bytes=0)
    end

    @testset "recursive redaction and limits" begin
        store = DiagnosticsStore(max_detail_bytes=512)
        entry = record!(store;
            event="redaction",
            details=Dict(
                "token" => "secret-token",
                "nested" => Dict("password" => "secret-password"),
                "path" => joinpath(homedir(), "Documents", "private.txt"),
            ),
        )
        @test entry["details"]["token"] == "[REDACTED]"
        @test entry["details"]["nested"]["password"] == "[REDACTED]"
        @test entry["details"]["path"] == joinpath("~", "Documents", "private.txt")

        limited = record!(DiagnosticsStore(max_detail_bytes=64);
            event="limited", details=Dict("payload" => repeat("x", 1000)))
        @test limited["details"]["_truncated"] == true
    end

    @testset "startup recovery ignores malformed lines" begin
        mktempdir() do dir
            path = joinpath(dir, "diags.jsonl")
            write(path, "valid\nmalformed\nsecond\n{truncated")
            store = DiagnosticsStore(path=path, max_memory_entries=1)
            parser(line) = line == "valid" ? Dict("event" => "first") :
                line == "second" ? Dict("event" => "second") : error("bad line")
            @test recover!(store, parser) == 2
            entries = recent(store, 10)
            @test length(entries) == 1
            @test entries[1]["event"] == "second"
        end
    end

    @testset "record and recent" begin
        store = DiagnosticsStore()

        entry = record!(store;
            level = "info",
            source = "test",
            event = "startup",
            message = "server started",
        )

        @test entry["level"] == "info"
        @test entry["source"] == "test"
        @test entry["event"] == "startup"
        @test entry["message"] == "server started"
        @test entry["schemaVersion"] == 1
        @test haskey(entry, "timestamp")

        entries = recent(store, 10)
        @test length(entries) == 1
        @test entries[1]["event"] == "startup"
    end

    @testset "structured fields" begin
        store = DiagnosticsStore()

        entry = record!(store;
            level = "warn",
            source = "backend",
            event = "slow_query",
            request_id = "req-42",
            operation = "findAll",
            code = "PERF_SLOW",
            message = "query took 3200ms",
            category = "performance",
            recoverable = true,
            duration_ms = 3200.0,
            details = Dict("table" => "users", "rows" => 15000),
        )

        @test entry["requestId"] == "req-42"
        @test entry["operation"] == "findAll"
        @test entry["code"] == "PERF_SLOW"
        @test entry["category"] == "performance"
        @test entry["recoverable"] === true
        @test entry["durationMs"] == 3200.0
        @test entry["details"]["table"] == "users"
    end

    @testset "bounded memory" begin
        store = DiagnosticsStore(max_memory_entries=5)

        for i in 1:10
            record!(store; level="info", source="test", event="event-$i")
        end

        entries = recent(store, 100)
        @test length(entries) == 5
        @test entries[1]["event"] == "event-6"
        @test entries[5]["event"] == "event-10"
    end

    @testset "clear" begin
        store = DiagnosticsStore()
        record!(store; level="info", source="test", event="a")
        record!(store; level="info", source="test", event="b")
        @test length(recent(store, 100)) == 2

        clear!(store)
        @test isempty(recent(store, 100))
    end

    @testset "JSONL file output" begin
        mktempdir() do dir
            path = joinpath(dir, "diags.jsonl")
            store = DiagnosticsStore(path=path)

            record!(store; level="info", source="test", event="file-test")
            record!(store; level="warn", source="test", event="file-warn")

            @test isfile(path)
            lines = filter(!isempty, split(read(path, String), '\n'))
            @test length(lines) == 2

            @test occursin("file-test", lines[1])
            @test occursin("schemaVersion", lines[1])
            @test occursin("file-warn", lines[2])

            clear!(store)
            @test filesize(path) == 0
        end
    end

    @testset "configure" begin
        store = DiagnosticsStore()
        @test log_path(store) == ""

        mktempdir() do dir
            path = joinpath(dir, "sub", "log.jsonl")
            result = configure!(store, path)
            @test result == abspath(path)
            @test log_path(store) == abspath(path)
            @test isdir(dirname(path))
        end
    end
end
