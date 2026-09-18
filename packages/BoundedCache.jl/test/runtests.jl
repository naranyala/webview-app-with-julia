using Test
using BoundedCache

@testset "BoundedCache" begin
    @testset "constructor" begin
        store = CacheStore()
        stats = cache_stats(store)
        @test stats["entries"] == 0
        @test stats["maxEntries"] == 256

        store2 = CacheStore(max_entries=10, max_entry_bytes=512, max_total_bytes=4096)
        stats2 = cache_stats(store2)
        @test stats2["maxEntries"] == 10
        @test stats2["maxEntryBytes"] == 512
        @test stats2["maxTotalBytes"] == 4096

        @test_throws ArgumentError CacheStore(max_entries=0)
        @test_throws ArgumentError CacheStore(max_entry_bytes=0)
        @test_throws ArgumentError CacheStore(max_total_bytes=0)
    end

    @testset "put and get" begin
        store = CacheStore(max_entries=10, max_entry_bytes=1024, max_total_bytes=4096)

        @test cache_put!(store, "k1", "hello"; size_bytes=10)
        @test cache_get!(store, "k1") == "hello"
        @test cache_get!(store, "missing") === nothing
    end

    @testset "has and remove" begin
        store = CacheStore()
        cache_put!(store, "k1", "v1"; size_bytes=10)

        @test cache_has!(store, "k1")
        @test !cache_has!(store, "k2")

        @test cache_remove!(store, "k1")
        @test !cache_has!(store, "k1")
        @test !cache_remove!(store, "k1")
    end

    @testset "clear" begin
        store = CacheStore()
        cache_put!(store, "k1", "v1"; size_bytes=10)
        cache_put!(store, "k2", "v2"; size_bytes=10)
        @test cache_stats(store)["entries"] == 2

        cache_clear!(store)
        @test cache_stats(store)["entries"] == 0
        @test cache_stats(store)["totalBytes"] == 0
    end

    @testset "LRU eviction by entry count" begin
        store = CacheStore(max_entries=3, max_entry_bytes=1024, max_total_bytes=100000)

        cache_put!(store, "a", "1"; size_bytes=10)
        cache_put!(store, "b", "2"; size_bytes=10)
        cache_put!(store, "c", "3"; size_bytes=10)
        @test cache_stats(store)["entries"] == 3

        # Adding a 4th evicts oldest
        cache_put!(store, "d", "4"; size_bytes=10)
        @test cache_stats(store)["entries"] == 3
        @test !cache_has!(store, "a")
        @test cache_has!(store, "d")
    end

    @testset "LRU eviction by total bytes" begin
        store = CacheStore(max_entries=100, max_entry_bytes=1024, max_total_bytes=100)

        cache_put!(store, "a", "1"; size_bytes=50)
        cache_put!(store, "b", "2"; size_bytes=50)
        @test cache_stats(store)["totalBytes"] == 100

        cache_put!(store, "c", "3"; size_bytes=50)
        @test cache_stats(store)["totalBytes"] <= 100
    end

    @testset "oversized entry rejected" begin
        store = CacheStore(max_entries=10, max_entry_bytes=100, max_total_bytes=10000)
        @test !cache_put!(store, "big", "data"; size_bytes=200)
        @test !cache_has!(store, "big")
    end

    @testset "access order updates on get" begin
        store = CacheStore(max_entries=3, max_entry_bytes=1024, max_total_bytes=100000)

        cache_put!(store, "a", "1"; size_bytes=10)
        cache_put!(store, "b", "2"; size_bytes=10)
        cache_put!(store, "c", "3"; size_bytes=10)

        # Access "a" to make it recently used
        cache_get!(store, "a")

        # Adding "d" should evict "b" (oldest unaccessed), not "a"
        cache_put!(store, "d", "4"; size_bytes=10)
        @test cache_has!(store, "a")
        @test !cache_has!(store, "b")
    end

    @testset "keys order" begin
        store = CacheStore(max_entries=10, max_entry_bytes=1024, max_total_bytes=100000)
        cache_put!(store, "c", "3"; size_bytes=10)
        cache_put!(store, "a", "1"; size_bytes=10)
        cache_put!(store, "b", "2"; size_bytes=10)

        keys = cache_keys(store)
        @test keys == ["c", "a", "b"]
    end

    @testset "stats" begin
        store = CacheStore(max_entries=5, max_entry_bytes=1024, max_total_bytes=4096)
        cache_put!(store, "k1", "v1"; size_bytes=100)

        stats = cache_stats(store)
        @test stats["entries"] == 1
        @test stats["totalBytes"] == 100
        @test stats["utilization"] == 20.0
    end

    @testset "tags" begin
        store = CacheStore()
        cache_put!(store, "k1", "v1"; tags=Dict("type" => "image"))
        result = cache_get!(store, "k1"; tags=Dict("type" => "updated"))
        @test result == "v1"
    end
end
