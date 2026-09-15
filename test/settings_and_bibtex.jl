using JSON3
using Test
using WebViewApp
using WebViewApp.Backend

@testset "Settings persistence" begin
    @testset "getSettings returns defaults" begin
        status, payload = Backend.handle_request("getSettings", "")
        @test status == 0
        result = JSON3.read(payload)
        @test result["schemaVersion"] == 1
        @test result["ui"]["theme"] in ("system", "light", "dark")
        @test result["ui"]["fontSize"] >= 10
    end

    @testset "saveSettings persists and validates" begin
        settings = Dict{String,Any}(
            "ui" => Dict{String,Any}("theme" => "dark", "fontSize" => 16),
            "workspace" => Dict{String,Any}("roots" => String[], "defaultNotesPath" => ""),
            "plugins" => Dict{String,Any}("enabled" => String[], "disabled" => String[]),
            "paper" => Dict{String,Any}("defaultTemplateId" => "default", "recentProjects" => String[]),
        )
        status, payload = Backend.handle_request("saveSettings", JSON3.write([settings]))
        @test status == 0
        result = JSON3.read(payload)
        @test result["ui"]["theme"] == "dark"
        @test result["ui"]["fontSize"] == 16

        status2, payload2 = Backend.handle_request("getSettings", "")
        @test status2 == 0
        restored = JSON3.read(payload2)
        @test restored["ui"]["theme"] == "dark"
        @test restored["ui"]["fontSize"] == 16
    end

    @testset "saveSettings rejects invalid values" begin
        bad_theme = Dict{String,Any}(
            "ui" => Dict{String,Any}("theme" => "purple"),
        )
        status, _ = Backend.handle_request("saveSettings", JSON3.write([bad_theme]))
        @test status == 1
    end

    @testset "settings round trips partial updates" begin
        base = Dict{String,Any}(
            "ui" => Dict{String,Any}("theme" => "light", "fontSize" => 14),
            "workspace" => Dict{String,Any}("roots" => String[], "defaultNotesPath" => ""),
            "plugins" => Dict{String,Any}("enabled" => String[], "disabled" => String[]),
            "paper" => Dict{String,Any}("defaultTemplateId" => "default", "recentProjects" => String[]),
        )
        Backend.handle_request("saveSettings", JSON3.write([base]))
        update = Dict{String,Any}("ui" => Dict{String,Any}("fontSize" => 18))
        status, payload = Backend.handle_request("saveSettings", JSON3.write([update]))
        @test status == 0
        result = JSON3.read(payload)
        @test result["ui"]["fontSize"] == 18
        @test result["ui"]["theme"] == "light"
    end

    @testset "configured roots authorize project creation" begin
        mktempdir() do root
            status, _ = Backend.handle_request(
                "saveSettings",
                JSON3.write([Dict("workspace" => Dict("roots" => [root]))]),
            )
            @test status == 0
            project = Dict{String,Any}(
                "id" => "configured-root",
                "title" => "Configured root",
                "authors" => [Dict("name" => "Ada")],
                "sections" => [Dict("id" => "intro", "title" => "Intro", "body" => "Text")],
            )
            create_status, payload = Backend.handle_request(
                "createPaperProject",
                JSON3.write([joinpath(root, "paper"), project]),
            )
            @test create_status == 0
            created = JSON3.read(payload)
            @test created["project"]["id"] == "configured-root"

            outside_status, _ = Backend.handle_request(
                "createPaperProject",
                JSON3.write([joinpath(dirname(root), "outside-paper"), project]),
            )
            @test outside_status == 1
            Backend.handle_request(
                "saveSettings",
                JSON3.write([Dict("workspace" => Dict("roots" => String[]))]),
            )
            revoked_status, _ = Backend.handle_request(
                "savePaperProject",
                JSON3.write([created["projectHandle"], created["project"]]),
            )
            @test revoked_status == 1
        end
    end
end

@testset "BibTeX adapter" begin
    @testset "parseBibTeX returns valid entries" begin
        source = "@article{smith2026, title={A title}, author=\"Smith, J\", year=2026}"
        status, payload = Backend.handle_request("parseBibTeX", JSON3.write([source]))
        @test status == 0
        result = JSON3.read(payload)
        @test result["count"] == 1
        @test result["entries"][1]["key"] == "smith2026"
        @test result["entries"][1]["type"] == "article"
    end

    @testset "importBibliography reads a file" begin
        docs = joinpath(homedir(), "Documents")
        isdir(docs) || mkpath(docs)
        mktempdir(docs) do dir
            path = joinpath(dir, "refs.bib")
            write(path, "@book{knuth1984, title={TeXbook}, author={Knuth}}")
            status, payload = Backend.handle_request("importBibliography", JSON3.write([path]))
            @test status == 0
            result = JSON3.read(payload)
            @test result["count"] == 1
            @test result["entries"][1]["key"] == "knuth1984"
        end
    end

    @testset "exportBibliography writes a file" begin
        docs = joinpath(homedir(), "Documents")
        isdir(docs) || mkpath(docs)
        mktempdir(docs) do dir
            path = joinpath(dir, "out.bib")
            entries = [Dict{String,Any}(
                "key" => "test2026",
                "type" => "article",
                "fields" => Dict("title" => "Test", "year" => "2026"),
            )]
            status, payload = Backend.handle_request("exportBibliography", JSON3.write([path, entries]))
            @test status == 0
            result = JSON3.read(payload)
            @test result["entries"] == 1
            @test isfile(path)
            content = read(path, String)
            @test occursin("@article{test2026", content)
        end
    end

    @testset "addBibtexToProject merges references" begin
        docs = joinpath(homedir(), "Documents")
        isdir(docs) || mkpath(docs)
        mktempdir(docs) do parent
            project_path = joinpath(parent, "paper")
            WebViewApp.PaperProjects.create_project!(project_path, Dict{String,Any}(
                "id" => "test",
                "title" => "Test",
                "authors" => [Dict{String,Any}("name" => "Ada")],
                "sections" => [Dict{String,Any}("id" => "s", "title" => "S", "body" => "B")],
            ))

            open_status, open_payload = Backend.handle_request(
                "openPaperProject",
                JSON3.write([project_path]),
            )
            @test open_status == 0
            project_handle = String(JSON3.read(open_payload)["projectHandle"])

            bibtex = "@article{new2026, title={New}, year=2026}\n@book{old2020, title={Old}}"
            status, payload = Backend.handle_request(
                "addBibtexToProject",
                JSON3.write([project_handle, bibtex]),
            )
            @test status == 0
            result = JSON3.read(payload)
            @test result["added"] == 2
            @test result["totalReferences"] == 2
            @test result["projectHandle"] == project_handle

            bibtex2 = "@article{new2026, title={Updated}, year=2027}\n@inproceedings{extra, title={Extra}}"
            status2, payload2 = Backend.handle_request(
                "addBibtexToProject",
                JSON3.write([project_handle, bibtex2]),
            )
            @test status2 == 0
            result2 = JSON3.read(payload2)
            @test result2["added"] == 1
            @test result2["duplicates"] == 1
            @test result2["totalReferences"] == 3
        end
    end
end
