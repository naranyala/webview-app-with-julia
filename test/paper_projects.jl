using JSON3
using Test
using WebViewApp

const VALID_PAPER_PROJECT = Dict{String,Any}(
    "id" => "test-paper",
    "title" => "Test paper",
    "authors" => [Dict("name" => "Ada Researcher")],
    "status" => "draft",
    "sections" => [Dict("id" => "intro", "title" => "Introduction", "body" => "Hello")],
    "references" => Any[],
    "figures" => Any[],
)

@testset "PaperProjects" begin
    validation = PaperProjects.validate_project(VALID_PAPER_PROJECT)
    @test validation["valid"]
    @test validation["project"]["schemaVersion"] == 1
    @test validation["project"]["template"] == Dict("id" => "default", "version" => "1")
    @test "paper has no export profiles" in validation["warnings"]

    invalid = PaperProjects.validate_project(merge(VALID_PAPER_PROJECT, Dict("id" => "Bad Id")))
    @test !invalid["valid"]
    @test "paper id must be a lowercase slug" in invalid["errors"]
    @test PaperProjects.content_hash(Dict("b" => 1, "a" => 2)) ==
        PaperProjects.content_hash(Dict("a" => 2, "b" => 1))

    legacy = merge(VALID_PAPER_PROJECT, Dict(
        "bibliography" => [Dict("key" => "legacy", "text" => "Legacy reference")],
        "references" => nothing,
        "template" => "preprint",
        "exportProfile" => Dict("id" => "pdf"),
    ))
    delete!(legacy, "references")
    migrated = PaperProjects.migrate_project(legacy)
    @test migrated["schemaVersion"] == 1
    @test migrated["references"][1]["key"] == "legacy"
    @test migrated["template"] == Dict("id" => "preprint", "version" => "1")
    @test migrated["exportProfiles"][1]["id"] == "pdf"

    future = PaperProjects.validate_project(merge(VALID_PAPER_PROJECT, Dict("schemaVersion" => 2)))
    @test !future["valid"]
    @test occursin("newer than", only(future["errors"]))

    mktempdir() do parent
        directory = joinpath(parent, "paper")
        created = PaperProjects.create_project!(directory, VALID_PAPER_PROJECT)
        @test isfile(joinpath(directory, PaperProjects.PROJECT_FILENAME))
        @test isfile(joinpath(directory, PaperProjects.REPRODUCIBILITY_FILENAME))
        @test PaperProjects.load_project(directory) == created

        record = JSON3.read(read(joinpath(directory, PaperProjects.REPRODUCIBILITY_FILENAME), String))
        @test record["projectSchemaVersion"] == 1
        @test record["projectId"] == "test-paper"
        @test length(record["projectHash"]) == 64

        revised = merge(created, Dict("title" => "Revised paper"))
        PaperProjects.save_project!(directory, revised)
        @test PaperProjects.load_project(directory)["title"] == "Revised paper"
        @test_throws PaperProjects.PaperProjectError PaperProjects.create_project!(directory, revised)

        write(joinpath(directory, PaperProjects.PROJECT_FILENAME), "not json")
        @test_throws Persistence.StorageError PaperProjects.load_project(directory)
    end
end

@testset "paper project backend" begin
    validation_status, validation_json = Backend.handle_request(
        "validatePaperProject",
        JSON3.write([VALID_PAPER_PROJECT]),
    )
    @test validation_status == 0
    @test JSON3.read(validation_json).valid

    documents = joinpath(homedir(), "Documents")
    isdir(documents) || mkpath(documents)
    mktempdir(documents) do parent
        path = joinpath(parent, "backend-paper")
        create_status, create_json = Backend.handle_request(
            "createPaperProject",
            JSON3.write([path, VALID_PAPER_PROJECT]),
        )
        @test create_status == 0
        created_result = JSON3.read(create_json)
        @test created_result.project.title == "Test paper"
        @test startswith(String(created_result.projectHandle), "paper-project-")
        @test length(String(created_result.reproducibility.projectHash)) == 64

        open_status, open_json = Backend.handle_request("openPaperProject", JSON3.write([path]))
        @test open_status == 0
        opened_result = JSON3.read(open_json)
        @test opened_result.path == realpath(path)
        @test startswith(String(opened_result.projectHandle), "paper-project-")

        revised = merge(VALID_PAPER_PROJECT, Dict("title" => "Saved title"))
        save_status, save_json = Backend.handle_request(
            "savePaperProject",
            JSON3.write([opened_result.projectHandle, revised]),
        )
        @test save_status == 0
        @test JSON3.read(save_json).projectHandle == opened_result.projectHandle
        @test PaperProjects.load_project(path)["title"] == "Saved title"

        legacy_save_status, legacy_save_json = Backend.handle_request(
            "savePaperProject",
            JSON3.write([path, merge(VALID_PAPER_PROJECT, Dict("title" => "Path save"))]),
        )
        @test legacy_save_status == 0
        @test JSON3.read(legacy_save_json).project.title == "Path save"
    end

    invalid_handle_status, invalid_handle_json = Backend.handle_request(
        "savePaperProject",
        JSON3.write(["paper-project-invalid", VALID_PAPER_PROJECT]),
    )
    @test invalid_handle_status == 1
    @test JSON3.read(invalid_handle_json).code == "PaperProjectHandleNotFound"

    outside_status, outside_json = Backend.handle_request(
        "createPaperProject",
        JSON3.write([joinpath(tempdir(), "forbidden-paper"), VALID_PAPER_PROJECT]),
    )
    @test outside_status == 1
    @test JSON3.read(outside_json).code == "PathNotAllowed"
end
