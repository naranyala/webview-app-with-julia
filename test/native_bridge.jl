using Test
using WebViewApp.ManualWebview

@testset "bounded native bridge queue" begin
    # This test talks to the production bridge shared library but does not
    # create a window, so it is safe in CI without a display server.
    queue = ManualWebview.create_queue()
    try
        capacity = ManualWebview.queue_capacity()
        @test capacity > 0
        @test ManualWebview.queue_size(queue) == 0

        for index in 1:capacity
            @test ManualWebview.queue_try_push!(queue, "getStatus", string(index), "[]") == 0
        end
        @test ManualWebview.queue_size(queue) == capacity
        @test ManualWebview.queue_try_push!(queue, "getStatus", "overflow", "[]") == -1
        @test ManualWebview.queue_try_push!(queue, "getStatus", "large", repeat("x", 1024 * 1024 + 1)) == -2

        for index in 1:capacity
            request = ManualWebview.next!(queue)
            @test request !== nothing
            @test ManualWebview.request_name(request) == "getStatus"
            @test ManualWebview.request_id(request) == string(index)
            close(request)
        end
        @test ManualWebview.next!(queue) === nothing
    finally
        ManualWebview.destroy_queue!(queue)
    end
end
