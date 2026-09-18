using Test
using WebViewApp.WorkspacePolicy

@testset "WorkspacePolicy" begin
    mktempdir() do root
        nested = joinpath(root, "nested")
        mkpath(nested)
        source = joinpath(nested, "source.txt")
        write(source, "content")
        roots = canonical_roots([root, root, joinpath(root, "missing")])

        @test error_code(PolicyError(:invalid, "bad")) == "InvalidArgument"
        @test error_code(PolicyError(:missing, "missing")) == "PathMissing"
        @test error_code(PolicyError(:missing, "missing"); missing_code="ProjectMissing") == "ProjectMissing"
        @test error_code(PolicyError(:forbidden, "no")) == "PathNotAllowed"
        @test error_code(PolicyError(:unavailable, "no")) == "PathUnavailable"

        @test roots == [realpath(root)]
        @test authorize_read_file(source, roots) == realpath(source)
        @test authorize_write_file(joinpath(nested, "output.txt"), roots) ==
            joinpath(realpath(nested), "output.txt")
        @test authorize_project(joinpath(root, "project"), roots; create=true) ==
            joinpath(realpath(root), "project")
        @test_throws PolicyError authorize_write_file(joinpath(root, "..", "escape.txt"), roots)
        @test_throws PolicyError authorize_project(root, roots)

        outside = mktempdir()
        try
            link = joinpath(nested, "escape-link")
            symlink(outside, link)
            @test_throws PolicyError authorize_write_file(joinpath(link, "output.txt"), roots)
        finally
            rm(outside; recursive=true, force=true)
        end
    end
end
