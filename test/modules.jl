using Test
using WebViewApp
using Aural
using WebViewApp.ManualWebview

@testset "internal modules" begin
    @testset "AudioAnalysisAdapter" begin
        features = AudioAnalysisAdapter.analyze_samples([0.0, 1.0, 0.0, -1.0], 8000)
        @test features["sample_count"] == 4
        @test features["sample_rate"] == 8000
        @test features["peak"] == 1.0
        @test features["rms"] ≈ 0.7071067812
        @test features["analysisSchema"] == 1
        @test features["engine"] == "Aural"
        @test_throws ArgumentError AudioAnalysisAdapter.analyze_samples(Float64[], 8000)
        @test_throws AudioAnalysisAdapter.AudioTooLargeError AudioAnalysisAdapter.analyze_samples(zeros(262145), 8000)

        mktempdir(homedir()) do directory
            path = joinpath(directory, "tone.wav")
            Aural.write_audio(path, Aural.AudioBuffer(Float64[0, 0.5, 0, -0.5], 8000))

            metadata = AudioAnalysisAdapter.read_metadata(path)
            @test metadata["sampleRate"] == 8000
            @test metadata["channels"] == 1
            @test metadata["durationSec"] ≈ 4 / 8000
            analysis = AudioAnalysisAdapter.analyze_file(path)
            @test analysis["sample_count"] == 4
            @test analysis["channels"] == 1
            @test !analysis["partial"]
            unsupported = joinpath(directory, "tone.mp3")
            cp(path, unsupported)
            @test_throws AudioAnalysisAdapter.AudioUnsupportedError AudioAnalysisAdapter.read_metadata(unsupported)
        end
    end

    @testset "FileTrees" begin
        mktempdir(homedir()) do directory
            mkdir(joinpath(directory, "packs"))
            write(joinpath(directory, "root.txt"), "root")
            write(joinpath(directory, "packs", "kick.wav"), "kick")
            report = FileTrees.scan(directory; max_depth=2)
            @test report.scanned_files == 2
            @test report.scanned_bytes == 8
            @test report.top_folders[1].first == "packs"
            @test report.by_extension[".wav"] == 1
        end
    end

    @testset "FileTrees bounds and callbacks" begin
        mktempdir(homedir()) do directory
            mkdir(joinpath(directory, "nested"))
            write(joinpath(directory, "root.txt"), "root")
            write(joinpath(directory, "nested", "child.txt"), "child")

            shallow = FileTrees.scan(directory; max_depth=0)
            @test shallow.scanned_files == 1
            @test shallow.files[1].relative_path == "root.txt"

            progress = FileTrees.ScanProgress[]
            report = FileTrees.scan(
                directory;
                max_depth=1,
                on_file=(entry, update) -> push!(progress, update),
            )
            @test report.scanned_files == 2
            @test length(progress) == 2
            @test progress[end].scanned_files == 2
            @test progress[end].scanned_bytes == report.scanned_bytes

            limited = FileTrees.scan(directory; max_entries=1)
            @test limited.scanned_files == 1
            @test limited.truncated

            cancelled = FileTrees.scan(directory; should_cancel=() -> true)
            @test cancelled.cancelled
            @test cancelled.scanned_files == 0
        end

        @test_throws ArgumentError FileTrees.scan("/definitely/missing")
        mktempdir() do directory
            @test_throws ArgumentError FileTrees.scan(directory; max_depth=-1)
            @test_throws ArgumentError FileTrees.scan(directory; max_entries=0)
        end
    end

    @testset "PDFGen" begin
        bytes = PDFGen.pdf_bytes("Title", "Hello (world)")
        @test startswith(String(bytes[1:8]), "%PDF-1.4")
        @test occursin("Hello \\(world\\)", String(bytes))

        long_body = join(fill("line", 60), "\n")
        @test count(" /Type /Page /Parent ", String(PDFGen.pdf_bytes("Title", long_body))) == 2

        mktempdir() do directory
            path = joinpath(directory, "generated.pdf")
            @test PDFGen.write_pdf(path, "Title", "Body") == path
            @test startswith(read(path, String), "%PDF-1.4")
        end
    end

    @testset "BibTeX" begin
        source = "@article{smith2026, title={A {nested} title}, author=\"Smith, Jane\", year=2026}"
        entries = BibTeX.parse_bibtex(source)
        @test length(entries) == 1
        @test entries[1].entry_type == "article"
        @test entries[1].key == "smith2026"
        @test entries[1].fields["title"] == "A {nested} title"
        rendered = BibTeX.write_bibtex(entries)
        @test occursin("@article{smith2026", rendered)
        @test occursin("year = {2026}", rendered)

        source = """
        @comment{ignored}
        @string{journal = "Journal"}
        @book(key,
            title = "A, title",
            note = {nested {braces}})
        @article{second}
        """
        parsed = BibTeX.parse_bibtex(source)
        @test [entry.key for entry in parsed] == ["key", "second"]
        @test parsed[1].fields["title"] == "A, title"
        @test parsed[1].fields["note"] == "nested {braces}"
        @test_throws ArgumentError BibTeX.parse_bibtex("@article{x, title={broken}")
    end

    @testset "BlendReader" begin
        mktempdir() do directory
            path = joinpath(directory, "scene.blend")
            write(path, UInt8[codeunits("BLENDER-v300")...])
            @test BlendReader.is_blend(path)
            header = BlendReader.read_header(path)
            @test header.pointer_size == 64
            @test header.byte_order == :little
            @test header.version == v"3.00.0"

            truncated = joinpath(directory, "truncated.blend")
            write(truncated, "BLENDER")
            @test !BlendReader.is_blend(truncated)
            @test_throws ArgumentError BlendReader.read_header(truncated)

            invalid = joinpath(directory, "invalid.blend")
            write(invalid, UInt8[codeunits("BLENDER?x300")...])
            @test BlendReader.is_blend(invalid)
            @test_throws ArgumentError BlendReader.read_header(invalid)
        end
    end

    @testset "ManualWebview null handles" begin
        window = ManualWebview.Window(C_NULL)
        queue = ManualWebview.Queue(C_NULL)
        @test !ManualWebview.is_open(window)
        @test ManualWebview.destroy!(window) === nothing
        @test ManualWebview.destroy_queue!(queue) === nothing
    end
end
