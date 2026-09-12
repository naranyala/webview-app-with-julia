using Test
using JSON3
using WebViewApp.Persistence

@testset "Persistence" begin
    @testset "validation and missing files" begin
        @test_throws ArgumentError Store("missing.json"; schema_version=0)
        @test_throws ArgumentError Store("missing.json"; max_bytes=0)

        mktempdir() do directory
            path = joinpath(directory, "missing.json")
            store = Store(path)
            default = [Dict("id" => "default")]
            loaded = load(store; default=default)
            @test loaded == default
            loaded[1]["id"] = "changed"
            @test default[1]["id"] == "default"

            nested = normalize_json(JSON3.read("{\"items\":[{\"ok\":true}]}"))
            @test nested == Dict("items" => Any[Dict("ok" => true)])
        end
    end

    mktempdir() do directory
        path = joinpath(directory, "notes.json")
        store = Store(path; schema_version=1, max_bytes=1024)
        value = [Dict("id" => "note-1", "body" => "hello")]

        @test save!(store, value) == value
        @test load(store; default=Any[]) == value
        @test occursin("schemaVersion", read(path, String))

        write(path, JSON3.write(value))
        @test load(store; default=Any[]) == value

        write(path, "not json")
        error = try
            load(store)
            nothing
        catch failure
            failure
        end
        @test error isa StorageError
        @test error.code == :corrupt

        write(path, repeat("x", 2048))
        @test_throws StorageError load(store)
        @test_throws StorageError save!(store, repeat("x", 2048))

        write(path, JSON3.write(Dict("schemaVersion" => 2, "data" => value)))
        future = try
            load(store)
            nothing
        catch failure
            failure
        end
        @test future isa StorageError
        @test future.code == :unsupported

        nested_path = joinpath(directory, "nested", "state.json")
        @test atomic_write!(nested_path, "first") === nothing
        @test read(nested_path, String) == "first"
        @test atomic_write!(nested_path, "second") === nothing
        @test read(nested_path, String) == "second"
    end
end
