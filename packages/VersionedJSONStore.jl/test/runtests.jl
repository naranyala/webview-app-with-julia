using Test
using VersionedJSONStore

@testset "VersionedJSONStore" begin
    @testset "constructor" begin
        store = Store("test.json")
        @test store.path == "test.json"
        @test store.schema_version == 1
        @test store.max_bytes == 4 * 1024 * 1024

        store2 = Store("test2.json"; schema_version=3, max_bytes=1024)
        @test store2.schema_version == 3
        @test store2.max_bytes == 1024

        @test_throws ArgumentError Store("x.json"; schema_version=0)
        @test_throws ArgumentError Store("x.json"; max_bytes=0)
    end

    @testset "json parsing" begin
        @test parse_json("null") === nothing
        @test parse_json("true") === true
        @test parse_json("false") === false
        @test parse_json("42") == 42
        @test parse_json("3.14") == 3.14
        @test parse_json("-1") == -1
        @test parse_json("\"hello\"") == "hello"
        @test parse_json("[1,2,3]") == [1, 2, 3]
    @test parse_json("{\"a\":1,\"b\":2}") == Dict("a" => 1, "b" => 2)
        @test_throws ArgumentError parse_json("not json")
        @test_throws ArgumentError parse_json("true trailing")

        nested = parse_json("{\"x\":{\"y\":[1,2]},\"z\":null}")
        @test nested["x"]["y"] == [1, 2]
        @test nested["z"] === nothing
    end

    @testset "json serialization" begin
        @test json_string(Dict("a" => 1)) == "{\"a\":1}"
        @test json_string([1, 2, 3]) == "[1,2,3]"
        @test json_string("hello") == "\"hello\""
        @test json_string(true) == "true"
        @test json_string(nothing) == "null"

        complex = Dict("arr" => [1, "two", true], "nested" => Dict("key" => "val"))
        result = json_string(complex)
        @test occursin("\"arr\":", result)
        @test occursin("\"nested\":", result)
    end

    @testset "round-trip" begin
        original = Dict(
            "name" => "test",
            "count" => 42,
            "tags" => ["a", "b"],
            "nested" => Dict("deep" => true),
        )
        json = json_string(original)
        parsed = parse_json(json)
        @test parsed == original
    end

    @testset "save and load" begin
        mktempdir() do dir
            path = joinpath(dir, "test.json")
            store = Store(path; schema_version=2)

            data = Dict("theme" => "dark", "lang" => "en", "version" => 2)
            save!(store, data)

            @test isfile(path)
            loaded = load(store)
            @test loaded == data
        end
    end

    @testset "schema version envelope" begin
        mktempdir() do dir
            path = joinpath(dir, "test.json")

            # Write with version 1
            store1 = Store(path; schema_version=1)
            save!(store1, Dict("old" => true))

            # Read with version 2 (backwards compatible)
            store2 = Store(path; schema_version=2)
            loaded = load(store2)
            @test loaded == Dict("old" => true)

            # Write with version 3
            store3 = Store(path; schema_version=3)
            save!(store3, Dict("new" => true))

            # Reject with version 2 (newer version)
            store2b = Store(path; schema_version=2)
            @test_throws StorageError load(store2b)
        end
    end

    @testset "atomic write" begin
        mktempdir() do dir
            path = joinpath(dir, "atomic.json")
            atomic_write!(path, "{\"test\":true}")
            @test read(path, String) == "{\"test\":true}"

            # Overwrite
            atomic_write!(path, "{\"test\":false}")
            @test read(path, String) == "{\"test\":false}"
        end
    end

    @testset "missing file returns default" begin
        store = Store("/tmp/nonexistent_path_12345.json")
        @test load(store) === nothing
        @test load(store; default=Dict("fallback" => true)) == Dict("fallback" => true)
    end

    @testset "normalize_json" begin
        input = Dict("a" => Dict("b" => 1), "c" => [Dict("d" => 2)])
        result = normalize_json(input)
        @test result isa Dict{String,Any}
        @test result["a"] isa Dict{String,Any}
        @test result["c"][1] isa Dict{String,Any}
    end
end
