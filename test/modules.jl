using Test
using WebViewApp
using Aural

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

    @testset "PDFGen" begin
        bytes = PDFGen.pdf_bytes("Title", "Hello (world)")
        @test startswith(String(bytes[1:8]), "%PDF-1.4")
        @test occursin("Hello \\(world\\)", String(bytes))
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
        end
    end
end
