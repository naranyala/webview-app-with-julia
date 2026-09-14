using Test
using WebViewApp
using WebViewApp.Backend
using JSON3
using Aural

# Reset state before tests
Backend.STATE.counter = 0
empty!(Backend.STATE.notes)
empty!(Backend.STATE.scan_jobs)
empty!(Backend.STATE.audio_jobs)
empty!(Backend.STATE.media_jobs)
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

        plugin_name = "testPluginBinding"
        Backend.register_handler!(plugin_name, _ -> Backend._ok(Dict("plugin" => true)))
        @test_throws ArgumentError Backend.register_handler!(
            plugin_name,
            _ -> Backend._ok(Dict("plugin" => false)),
        )
        @test_throws ArgumentError Backend.register_handler!(
            "closeWindow",
            _ -> Backend._ok(Dict("plugin" => false)),
        )
        @test Backend.register_handler!(
            plugin_name,
            _ -> Backend._ok(Dict("plugin" => true)),
            replace=true,
        ) == plugin_name
        status, payload = Backend.handle_request(plugin_name, "")
        @test status == 0
        @test JSON3.read(payload)["plugin"] == true
        @test plugin_name in Backend.handler_names()
        @test Backend.unregister_handler!(plugin_name)
        @test !Backend.unregister_handler!(plugin_name)
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
        @test length(Backend.STATE.pending_writes) == 1
        @test length(Backend.STATE.persist_timers) == 1
        @test Backend.flush_pending!()
        @test isempty(Backend.STATE.pending_writes)
    end

    @testset "note writes are trailing-edge coalesced" begin
        Backend._schedule_persist("notes", [Dict{String,Any}("body" => "first")]; delay=60)
        first_timer = Backend.STATE.persist_timers["notes"]
        Backend._schedule_persist("notes", [Dict{String,Any}("body" => "latest")]; delay=60)
        @test Backend.STATE.persist_timers["notes"] !== first_timer
        @test Backend.STATE.pending_writes["notes"][1]["body"] == "latest"
        @test Backend.flush_pending!()
        @test isempty(Backend.STATE.pending_writes)
        @test isempty(Backend.STATE.persist_timers)
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

        status, result = Backend.handle_request(
            "generatePdf",
            JSON3.write(["backend-layout-test.pdf", "Title", "# Heading\nBody", "two-column"]),
        )
        @test status == 0
        two_column = JSON3.read(result)
        @test isfile(two_column["path"])
        @test startswith(read(two_column["path"], String), "%PDF-1.4")

        status, result = Backend.handle_request(
            "generatePdf",
            JSON3.write(["backend-layout-test.pdf", "Title", "Body", "triple"]),
        )
        @test status == 1
        @test JSON3.read(result)["code"] == "InvalidArgument"
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
            @test info["schemaVersion"] == 1
            @test info["provenance"]["engine"] == "StaticMediaCompanion"

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

            escaped_path = joinpath(source_directory, "escaped.txt")
            symlink("/etc/hosts", escaped_path)
            status, result = Backend.handle_request("readText", JSON3.write([escaped_path]))
            @test status == 1
            @test JSON3.read(result)["code"] == "PathNotAllowed"

            missing_path = joinpath(source_directory, "missing.txt")
            status, result = Backend.handle_request("readText", JSON3.write([missing_path]))
            @test status == 1
            @test JSON3.read(result)["code"] == "PathMissing"

            oversized_path = joinpath(source_directory, "oversized.txt")
            open(oversized_path, "w") do io
                seek(io, StaticMediaAdapter.MAX_TEXT_BYTES)
                write(io, UInt8(0))
            end
            status, result = Backend.handle_request("readText", JSON3.write([oversized_path]))
            @test status == 1
            @test JSON3.read(result)["code"] == "MediaTooLarge"
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
            @test conversion["schemaVersion"] == 1
            @test conversion["provenance"]["backend"] == conversion["backend"]
            @test conversion["output"] == converted
            @test conversion["bytesWritten"] > 0
            @test occursin("Converted", read(converted, String))

            async_output = joinpath(output_directory, "converted-async.html")
            status, result = Backend.handle_request(
                "startMediaConversion",
                JSON3.write([input, async_output]),
            )
            @test status == 0
            media_job = JSON3.read(result)
            media_job_id = String(media_job["id"])
            current = media_job
            for _ in 1:100
                status, result = Backend.handle_request(
                    "getMediaConversionStatus",
                    JSON3.write([media_job_id]),
                )
                @test status == 0
                current = JSON3.read(result)
                current["state"] in ("completed", "failed", "cancelled") && break
                sleep(0.02)
            end
            @test current["state"] == "completed"
            @test current["schemaVersion"] == 1
            @test current["provenance"]["backend"] == current["result"]["backend"]
            @test current["result"]["output"] == async_output
            @test isfile(async_output)

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
            @test plan["schemaVersion"] == 1
            @test plan["provenance"]["backend"] == plan["backend"]
            rm(input; force=true)
        end

        status, result = Backend.handle_request("getMediaCapabilities", "")
        @test status == 0
        capabilities = JSON3.read(result)
        @test haskey(capabilities, "backend")
        @test haskey(capabilities, "tools")
        @test capabilities["schemaVersion"] == 1
        @test capabilities["provenance"]["engine"] == "StaticMediaCompanion"
    end

    @testset "window management" begin
        # These should not be routed through Backend (handled in webview_app.jl)
        status, _ = Backend.handle_request("minimizeWindow", "")
        @test status == 1  # UnknownBinding since handled at event loop level
    end

end
