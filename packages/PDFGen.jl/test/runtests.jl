using Test
using PDFGen

@testset "PDFGen" begin
    @testset "pdf_bytes basic" begin
        bytes = pdf_bytes("Hello", "World")
        @test bytes isa Vector{UInt8}
        @test length(bytes) > 0
        str = String(bytes)
        @test startswith(str, "%PDF-1.4")
        @test occursin("Helvetica", str)
        @test occursin("Helvetica-Bold", str)
    end

    @testset "pdf_bytes two-column" begin
        bytes = pdf_bytes("Title", "Body text"; columns=2)
        @test length(bytes) > 0
        @test occursin("%PDF-1.4", String(bytes))
    end

    @testset "custom margins" begin
        bytes = pdf_bytes("Title", "Body"; margins=Dict("top" => 72, "bottom" => 72))
        @test length(bytes) > 0
    end

    @testset "page numbers" begin
        bytes_with = pdf_bytes("Title", "Line\n"^50; page_numbers=true)
        bytes_without = pdf_bytes("Title", "Line\n"^50; page_numbers=false)
        @test length(bytes_with) > length(bytes_without)
    end

    @testset "bookmarks" begin
        body = "# Chapter 1\nSome text\n## Section 1.1\nMore text"
        bytes_with = pdf_bytes("Title", body; bookmarks=true)
        bytes_without = pdf_bytes("Title", body; bookmarks=false)
        @test length(bytes_with) > length(bytes_without)
        @test occursin("Outlines", String(bytes_with))
    end

    @testset "write_pdf" begin
        mktempdir() do dir
            path = joinpath(dir, "test.pdf")
            result = write_pdf(path, "Title", "Hello World")
            @test result == path
            @test isfile(path)
            @test filesize(path) > 0
            @test startswith(String(read(path, String)), "%PDF-1.4")
        end
    end

    @testset "heading hierarchy" begin
        body = "# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6"
        bytes = pdf_bytes("Title", body)
        str = String(bytes)
        @test occursin("H1", str)
        @test occursin("H6", str)
    end

    @testset "inline formatting" begin
        body = "This is **bold** and *italic* and ***both***"
        bytes = pdf_bytes("Title", body)
        str = String(bytes)
        @test occursin("Helvetica-Bold", str)
        @test occursin("Helvetica-Oblique", str)
        @test occursin("Helvetica-BoldOblique", str)
    end

    @testset "margins struct" begin
        m = PDFGen.Margins(; top=60, bottom=60, left=72, right=72)
        @test m.top == 60
        @test m.bottom == 60
        @test m.left == 72
        @test m.right == 72
    end

    @testset "escapes special characters" begin
        body = "Text with (parens) and \\ backslash"
        bytes = pdf_bytes("Title", body)
        @test length(bytes) > 0
    end
end
