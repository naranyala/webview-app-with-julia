using Test
using WebViewApp
using WebViewApp.Backend
using JSON3
using Aural

# Reset state before tests
Backend.STATE.counter = 0
empty!(Backend.STATE.notes)
empty!(Backend.STATE.quizzes)
empty!(Backend.STATE.scan_jobs)
empty!(Backend.STATE.audio_jobs)
empty!(Backend.STATE.jobs.jobs)
empty!(Backend.STATE.volumes)

@testset "Backend.jl" begin

    @testset "router" begin
        status, payload = Backend.handle_request("unknownBinding", "")
        @test status == 1
        result = JSON3.read(payload)
        @test result["code"] == "UnknownBinding"

        status, payload = Backend.handle_request("increment", "{")
        @test status == 1
        @test JSON3.read(payload)["code"] == "InternalError"

        status, payload = Backend.handle_request("increment", "")
        @test status == 1
        @test JSON3.read(payload)["code"] == "InvalidArgument"
    end

    @testset "increment and reset" begin
        status, result = Backend.handle_request("increment", "[5]")
        @test status == 0
        @test JSON3.read(result) == 5

        status, result = Backend.handle_request("increment", "[3]")
        @test status == 0
        @test JSON3.read(result) == 8

        status, result = Backend.handle_request("reset", "")
        @test status == 0
        @test JSON3.read(result) == 0
    end

    @testset "getTimestamp" begin
        status, result = Backend.handle_request("getTimestamp", "")
        @test status == 0
        ts = parse(Int, JSON3.read(result))
        @test ts > 0
    end

    @testset "getSystemInfo" begin
        status, result = Backend.handle_request("getSystemInfo", "")
        @test status == 0
        # getSystemInfo returns a JSON string
        info = JSON3.read(result)
        @test info isa AbstractString
        parsed = JSON3.read(info)
        @test haskey(parsed, "julia_version")
        @test haskey(parsed, "platform")
    end

    @testset "getStatus" begin
        status, result = Backend.handle_request("getStatus", "")
        @test status == 0
        info = JSON3.read(result)
        @test info["status"] == "ok"
    end

    @testset "notes CRUD" begin
        # Create
        status, result = Backend.handle_request("createNote", "[\"Test Note\", \"Draft\", \"Hello body\"]")
        @test status == 0
        # result is a JSON string of a dict
        note = JSON3.read(result)
        @test note["title"] == "Test Note"
        @test note["tag"] == "Draft"
        @test note["body"] == "Hello body"
        note_id = note["id"]

        # Get all
        status, result = Backend.handle_request("getNotes", "")
        @test status == 0
        notes = JSON3.read(result)
        @test length(notes) >= 1

        # Update
        status, result = Backend.handle_request("updateNote", "[\"$note_id\", \"Updated\", \"Work\", \"New body\"]")
        @test status == 0
        updated = JSON3.read(result)
        @test updated["title"] == "Updated"
        @test updated["tag"] == "Work"
        @test updated["body"] == "New body"

        # Delete
        status, result = Backend.handle_request("deleteNote", "[\"$note_id\"]")
        @test status == 0
    end

    @testset "note validation" begin
        # Empty title
        status, result = Backend.handle_request("createNote", "[\"\", \"Draft\", \"body\"]")
        @test status == 1
        err = JSON3.read(result)
        @test err["code"] == "InvalidArgument"

        # Title too long
        long_title = repeat("a", 201)
        status, result = Backend.handle_request("createNote", "[\"$long_title\", \"Draft\", \"body\"]")
        @test status == 1

        # Missing arguments
        status, result = Backend.handle_request("createNote", "[\"only title\"]")
        @test status == 1
    end

    @testset "note not found" begin
        status, result = Backend.handle_request("updateNote", "[\"nonexistent\", \"T\", \"tag\", \"body\"]")
        @test status == 1
        err = JSON3.read(result)
        @test err["code"] == "NoteNotFound"

        status, result = Backend.handle_request("deleteNote", "[\"nonexistent\"]")
        @test status == 1
        err = JSON3.read(result)
        @test err["code"] == "NoteNotFound"
    end

    @testset "quiz CRUD" begin
        # Create collection
        status, result = Backend.handle_request("quizCreateCollection", "[\"Test Quiz\", \"A test quiz\", \"gold\", \"Beginner\"]")
        @test status == 0
        col = JSON3.read(result)
        @test col["title"] == "Test Quiz"
        @test col["tone"] == "gold"
        col_id = col["id"]

        # List
        status, result = Backend.handle_request("quizList", "")
        @test status == 0
        quizzes = JSON3.read(result)
        @test length(quizzes) >= 1

        # Update collection
        status, result = Backend.handle_request("quizUpdateCollection", "[\"$col_id\", \"Updated Quiz\", \"New desc\"]")
        @test status == 0
        updated = JSON3.read(result)
        @test updated["title"] == "Updated Quiz"

        # Create question
        status, result = Backend.handle_request("quizCreateQuestion", "[\"$col_id\", \"math\", \"What is 2+2?\", \"4\"]")
        @test status == 0
        q = JSON3.read(result)
        @test q["question"] == "What is 2+2?"
        q_id = q["id"]

        # Update question
        status, result = Backend.handle_request("quizUpdateQuestion", "[\"$col_id\", \"$q_id\", \"math\", \"What is 3+3?\", \"6\", \"Basic math\", \"easy\", \"math,addition\"]")
        @test status == 0
        updated_q = JSON3.read(result)
        @test updated_q["question"] == "What is 3+3?"
        @test "math" in updated_q["tags"]
        @test "addition" in updated_q["tags"]

        # Delete question
        status, result = Backend.handle_request("quizDeleteQuestion", "[\"$col_id\", \"$q_id\"]")
        @test status == 0

        # Delete collection
        status, result = Backend.handle_request("quizDeleteCollection", "[\"$col_id\"]")
        @test status == 0
    end

    @testset "quiz not found" begin
        status, result = Backend.handle_request("quizUpdateCollection", "[\"nonexistent\", \"T\", \"D\"]")
        @test status == 1
        err = JSON3.read(result)
        @test err["code"] == "QuizNotFound"
    end

    @testset "quiz import and export" begin
        source = JSON3.write(Dict(
            "title" => "Imported deck",
            "description" => "Imported safely",
            "questions" => [Dict("question" => "Prompt", "answer" => "Answer")],
        ))
        status, result = Backend.handle_request("quizImport", JSON3.write([source]))
        @test status == 0
        imported = JSON3.read(result)
        @test imported["title"] == "Imported deck"
        @test imported["questions"][1]["id"] != ""

        status, result = Backend.handle_request("quizExport", JSON3.write([imported["id"]]))
        @test status == 0
        exported = JSON3.read(result)
        @test isfile(exported["path"])
        @test exported["size"] > 0
    end

    @testset "MIR analysis" begin
        status, result = Backend.handle_request("mirAnalyze", "[[0.5, -0.5, 0.3, -0.3], 44100]")
        @test status == 0
        features = JSON3.read(result)
        @test features["sample_count"] == 4
        @test features["sample_rate"] == 44100
        @test features["rms"] > 0
        @test features["peak"] == 0.5
        @test features["zcr"] > 0

        # Empty samples
        status, result = Backend.handle_request("mirAnalyze", "[[], 44100]")
        @test status == 1
        err = JSON3.read(result)
        @test err["code"] == "InvalidAudioInput"
    end

    @testset "audio handlers" begin
        mktempdir(homedir()) do directory
            path = joinpath(directory, "stereo.wav")
            left = Aural.tone(440, 0.05; samplerate=8000, amplitude=0.5)
            Aural.write_audio(path, Aural.join_channels(left, Aural.gain(left, 0.5)))
            payload = JSON3.write([path])

            status, result = Backend.handle_request("getAudioMetadata", payload)
            @test status == 0
            metadata = JSON3.read(result)
            @test metadata["channels"] == 2
            @test metadata["sampleRate"] == 8000
            @test metadata["engine"] == "Aural"

            status, result = Backend.handle_request("analyzeAudio", payload)
            @test status == 0
            analysis = JSON3.read(result)
            @test analysis["channels"] == 2
            @test analysis["sampleCount"] == 400
            @test analysis["analysisSchema"] == 1

            bounded = AudioAnalysisAdapter.analyze_file(path; max_frames=64)
            @test bounded["sample_count"] == 64
            @test bounded["sourceSampleCount"] == 400
            @test bounded["partial"] == true

            unsupported = joinpath(directory, "stereo.mp3")
            cp(path, unsupported)
            status, result = Backend.handle_request("getAudioMetadata", JSON3.write([unsupported]))
            @test status == 1
            @test JSON3.read(result)["code"] == "UnsupportedAudioFormat"

            status, result = Backend.handle_request("getAudioMetadata", JSON3.write(["/etc/hosts"]))
            @test status == 1
            @test JSON3.read(result)["code"] == "PathNotAllowed"
        end
    end

    @testset "asynchronous audio analysis" begin
        mktempdir(homedir()) do directory
            path = joinpath(directory, "async.wav")
            tone = Aural.tone(440, 0.05; samplerate=8000, amplitude=0.5)
            Aural.write_audio(path, tone)

            status, result = Backend.handle_request("startAudioAnalysis", JSON3.write([path]))
            @test status == 0
            job = JSON3.read(result)
            job_id = String(job["id"])
            current = job
            for _ in 1:100
                current_status, current_result = Backend.handle_request(
                    "getAudioAnalysisStatus",
                    JSON3.write([job_id]),
                )
                @test current_status == 0
                current = JSON3.read(current_result)
                current["state"] in ("completed", "failed", "cancelled") && break
                sleep(0.02)
            end

            @test current["state"] == "completed"
            @test current["sampleCount"] == 400
            @test current["analysisSchema"] == 1
            delete!(Backend.STATE.audio_jobs, job_id)
        end
    end

    @testset "document handlers" begin
        source = "@article{smith2026, title={A title}, author={Smith}}"
        status, result = Backend.handle_request("parseBibTeX", JSON3.write([source]))
        @test status == 0
        entries = JSON3.read(result)
        @test length(entries) == 1
        @test entries[1]["key"] == "smith2026"

        mktempdir(homedir()) do directory
            blend_path = joinpath(directory, "scene.blend")
            write(blend_path, UInt8[codeunits("BLENDER-v300")...])
            status, result = Backend.handle_request("inspectBlend", JSON3.write([blend_path]))
            @test status == 0
            header = JSON3.read(result)
            @test header["pointerSize"] == 64
            @test header["version"] == "3.0.0"
        end

        status, result = Backend.handle_request(
            "generatePdf",
            JSON3.write(["backend-handler-test.pdf", "Title", "Body"]),
        )
        @test status == 0
        pdf = JSON3.read(result)
        @test isfile(pdf["path"])
        @test startswith(read(pdf["path"], String), "%PDF-1.4")
    end

    @testset "PDF save" begin
        # Valid filename
        status, result = Backend.handle_request("savePdf", "[\"test.pdf\", \"dGVzdA==\"]")
        @test status == 0
        info = JSON3.read(result)
        @test isfile(info["path"])

        # Path traversal blocked
        status, result = Backend.handle_request("savePdf", "[\"../../../etc/passwd.pdf\", \"dGVzdA==\"]")
        @test status == 1

        # Invalid filename
        status, result = Backend.handle_request("savePdf", "[\"no ext\", \"dGVzdA==\"]")
        @test status == 1
    end

    @testset "volume discovery" begin
        status, result = Backend.handle_request("listVolumes", "")
        @test status == 0
        volumes = JSON3.read(result)
        @test length(volumes) >= 1
        @test any(v -> v["id"] == "home", volumes)
    end

    @testset "asset scan job lifecycle" begin
        mktempdir(homedir()) do directory
            write(joinpath(directory, "kick.wav"), "sample")
            Backend.STATE.volumes = [Dict{String,Any}(
                "id" => "test-volume",
                "name" => "Test volume",
                "path" => directory,
                "kind" => "general",
            )]
            status, result = Backend.handle_request("startAssetScan", "[\"test-volume\"]")
            @test status == 0
            job = JSON3.read(result)
            @test job["state"] == "running"

            status, result = Backend.handle_request("cancelAssetScan", JSON3.write([job["id"]]))
            @test status == 0
            cancelled = JSON3.read(result)
            @test cancelled["state"] in ("cancelled", "completed")
        end
    end

    @testset "static media handlers" begin
        mktempdir(homedir()) do source_directory
            markdown_path = joinpath(source_directory, "readme.md")
            write(markdown_path, "# Native media\n\nReadable text.")

            status, result = Backend.handle_request("inspectMedia", JSON3.write([markdown_path]))
            @test status == 0
            info = JSON3.read(result)
            @test info["mime"] == "text/markdown"
            @test info["extension"] == ".md"

            status, result = Backend.handle_request("readText", JSON3.write([markdown_path]))
            @test status == 0
            @test occursin("Native media", JSON3.read(result))

            status, result = Backend.handle_request("markdownToHtml", JSON3.write(["# Heading"]))
            @test status == 0
            @test occursin("Heading", JSON3.read(result))

            status, result = Backend.handle_request("htmlToText", JSON3.write(["<h1>Heading</h1>"]))
            @test status == 0
            @test JSON3.read(result) == "Heading"

            status, result = Backend.handle_request("inspectMedia", JSON3.write(["/etc/hosts"]))
            @test status == 1
            @test JSON3.read(result)["code"] == "PathNotAllowed"
        end

        mktempdir(joinpath(homedir(), "Documents")) do output_directory
            output = joinpath(output_directory, "written.txt")
            status, result = Backend.handle_request(
                "writeText",
                JSON3.write([output, "written by native media"]),
            )
            @test status == 0
            @test isfile(output)
            @test JSON3.read(result)["size"] > 0

            input = joinpath(output_directory, "convert.md")
            write(input, "# Converted\n\nBody")
            converted = joinpath(output_directory, "converted.html")
            status, result = Backend.handle_request(
                "convertMedia",
                JSON3.write([input, converted]),
            )
            @test status == 0
            conversion = JSON3.read(result)
            @test conversion["output"] == converted
            @test conversion["bytesWritten"] > 0
            @test occursin("Converted", read(converted, String))

            input = joinpath(homedir(), ".config", "julia-starter", "media-plan.md")
            write(input, "# Plan")
            planned_output = joinpath(output_directory, "media-plan.html")
            status, result = Backend.handle_request(
                "planConversion",
                JSON3.write([input, planned_output]),
            )
            @test status == 0
            plan = JSON3.read(result)
            @test plan["targetKind"] == "html"
            rm(input; force=true)
        end

        status, result = Backend.handle_request("getMediaCapabilities", "")
        @test status == 0
        capabilities = JSON3.read(result)
        @test haskey(capabilities, "backend")
        @test haskey(capabilities, "tools")
    end

    @testset "window management" begin
        # These should not be routed through Backend (handled in webview_app.jl)
        status, _ = Backend.handle_request("minimizeWindow", "")
        @test status == 1  # UnknownBinding since handled at event loop level
    end

end
