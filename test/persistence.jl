using Test
using JSON3
using JuliaStarter.Persistence

@testset "Persistence" begin
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
    end
end
