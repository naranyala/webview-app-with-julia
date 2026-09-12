using Test
using WebViewApp.Jobs

@testset "Jobs" begin
    @testset "constructor and creation" begin
        @test_throws ArgumentError JobManager(max_jobs=0)
        @test_throws ArgumentError JobManager(retention_seconds=-1)

        metadata = Dict("path" => "/tmp/assets", "options" => Dict("depth" => 2))
        manager = JobManager()
        id = create_job!(manager; kind="asset-scan", metadata=metadata)
        initial = snapshot(manager, id)

        @test id == initial["id"]
        @test startswith(id, "job-")
        @test initial["kind"] == "asset-scan"
        @test initial["state"] == "running"
        @test initial["progress"] == 0.0
        @test initial["metadata"]["path"] == "/tmp/assets"

        initial["metadata"]["options"]["depth"] = 99
        @test snapshot(manager, id)["metadata"]["options"]["depth"] == 2
    end

    @testset "cooperative updates and cancellation" begin
        manager = JobManager()
        id = create_job!(manager; kind="audio-analysis")

        @test update_job!(manager, id; progress=0.4, message="reading")
        current = snapshot(manager, id)
        @test current["progress"] == 0.4
        @test current["message"] == "reading"
        @test !is_cancelled(manager, id)

        @test cancel_job!(manager, id)
        @test is_cancelled(manager, id)
        @test snapshot(manager, id)["state"] == "cancelled"
        @test !update_job!(manager, id; progress=0.8)
        @test !complete_job!(manager, id)
        @test !cancel_job!(manager, id)
    end

    @testset "completion and failure" begin
        manager = JobManager()
        completed_id = create_job!(manager; kind="audio-analysis")
        result = Dict("sample_count" => 128, "features" => [1, 2, 3])
        @test complete_job!(manager, completed_id; result=result)

        completed = snapshot(manager, completed_id)
        @test completed["state"] == "completed"
        @test completed["progress"] == 1.0
        @test completed["result"]["sample_count"] == 128
        completed["result"]["features"][1] = 999
        @test snapshot(manager, completed_id)["result"]["features"][1] == 1

        failed_id = create_job!(manager; kind="asset-scan")
        @test fail_job!(manager, failed_id, ArgumentError("unreadable directory"))
        failed = snapshot(manager, failed_id)
        @test failed["state"] == "failed"
        @test occursin("unreadable directory", failed["error"])
        @test !fail_job!(manager, failed_id, "another error")
        @test_throws KeyError snapshot(manager, "missing")
    end

    @testset "thread-safe updates" begin
        manager = JobManager()
        id = create_job!(manager; kind="scan")

        Threads.@threads for worker in 1:8
            for step in 1:20
                update_job!(manager, id; progress=step / 20, message="worker $worker")
            end
        end

        current = snapshot(manager, id)
        @test current["state"] == "running"
        @test 0.0 <= current["progress"] <= 1.0
        @test length(snapshots(manager)) == 1
    end

    @testset "bounded retention" begin
        manager = JobManager(max_jobs=2, retention_seconds=3600)
        first_id = create_job!(manager)
        complete_job!(manager, first_id)
        second_id = create_job!(manager)
        fail_job!(manager, second_id, "failed")

        third_id = create_job!(manager)
        @test length(snapshots(manager)) == 2
        @test_throws KeyError snapshot(manager, first_id)
        @test snapshot(manager, second_id)["state"] == "failed"
        @test snapshot(manager, third_id)["state"] == "running"

        cleanup_manager = JobManager(retention_seconds=0)
        old_id = create_job!(cleanup_manager)
        complete_job!(cleanup_manager, old_id)
        @test cleanup!(cleanup_manager; now=time() + 1) == 1
        @test isempty(snapshots(cleanup_manager))

        full_manager = JobManager(max_jobs=1)
        create_job!(full_manager)
        @test_throws ArgumentError create_job!(full_manager)
    end
end
