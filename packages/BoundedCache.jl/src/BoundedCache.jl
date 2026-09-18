"""
    BoundedCache

Bounded in-memory LRU cache with per-entry and total byte limits.
Entries are keyed by string keys with configurable maximum entries,
per-entry size limits, and total memory budget. Eviction uses LRU
(oldest access first).

Zero external dependencies — uses only Julia stdlib.

# Example

```julia
using BoundedCache

store = CacheStore(max_entries=100, max_entry_bytes=1024*1024, max_total_bytes=64*1024*1024)

cache_put!(store, "thumb:/path/to/image", thumbnail_data; tags=Dict("type" => "image"))
data = cache_get!(store, "thumb:/path/to/image")
stats = cache_stats(store)
```
"""
module BoundedCache

export CacheStore, cache_get!, cache_put!, cache_has!, cache_remove!,
    cache_clear!, cache_stats, cache_keys

const DEFAULT_MAX_ENTRIES = 256
const DEFAULT_MAX_ENTRY_BYTES = 1 * 1024 * 1024
const DEFAULT_MAX_TOTAL_BYTES = 256 * 1024 * 1024

struct CacheEntry
    key::String
    data::Any
    size_bytes::Int
    created_at::Float64
    accessed_at::Float64
    tags::Dict{String,String}
end

"""
    CacheStore(; max_entries=256, max_entry_bytes=1MB, max_total_bytes=256MB)

Create a bounded, thread-safe, in-memory LRU cache.
"""
mutable struct CacheStore
    lock::ReentrantLock
    entries::Dict{String,CacheEntry}
    access_order::Vector{String}
    max_entries::Int
    max_entry_bytes::Int
    max_total_bytes::Int
    total_bytes::Int
end

function CacheStore(;
    max_entries::Integer=DEFAULT_MAX_ENTRIES,
    max_entry_bytes::Integer=DEFAULT_MAX_ENTRY_BYTES,
    max_total_bytes::Integer=DEFAULT_MAX_TOTAL_BYTES,
)
    max_entries > 0 || throw(ArgumentError("max_entries must be positive"))
    max_entry_bytes > 0 || throw(ArgumentError("max_entry_bytes must be positive"))
    max_total_bytes > 0 || throw(ArgumentError("max_total_bytes must be positive"))

    CacheStore(
        ReentrantLock(),
        Dict{String,CacheEntry}(),
        String[],
        Int(max_entries),
        Int(max_entry_bytes),
        Int(max_total_bytes),
        0,
    )
end

function _touch_locked!(store::CacheStore, key::String)
    index = findfirst(==(key), store.access_order)
    index === nothing || deleteat!(store.access_order, index)
    push!(store.access_order, key)
end

function _evict_lru_locked!(store::CacheStore)
    while length(store.entries) >= store.max_entries || store.total_bytes >= store.max_total_bytes
        isempty(store.access_order) && return
        oldest_key = popfirst!(store.access_order)
        entry = pop!(store.entries, oldest_key, nothing)
        entry === nothing || (store.total_bytes -= entry.size_bytes)
    end
end

"""
    cache_get!(store, key; tags=nothing) -> Any

Retrieve a cached value by key. Returns `nothing` on miss. Updates access
order for LRU eviction. If `tags` is provided, the entry's tags are updated.
"""
function cache_get!(store::CacheStore, key::AbstractString; tags=nothing)
    key_str = String(key)
    lock(store.lock) do
        entry = get(store.entries, key_str, nothing)
        entry === nothing && return nothing
        _touch_locked!(store, key_str)
        updated = CacheEntry(entry.key, entry.data, entry.size_bytes,
            entry.created_at, Float64(time()),
            tags === nothing ? entry.tags : Dict{String,String}(string(k) => string(v) for (k, v) in pairs(tags)))
        store.entries[key_str] = updated
        deepcopy(entry.data)
    end
end

"""
    cache_put!(store, key, data; tags=nothing, size_bytes=nothing) -> Bool

Store a value in the cache. Returns `true` if stored, `false` if the value
exceeds `max_entry_bytes`. Evicts LRU entries if necessary.
"""
function cache_put!(store::CacheStore, key::AbstractString, data; tags=nothing, size_bytes=nothing)
    key_str = String(key)
    entry_size = size_bytes === nothing ? _estimate_size(data) : Int(size_bytes)
    entry_size > store.max_entry_bytes && return false

    tag_dict = tags === nothing ? Dict{String,String}() :
        Dict{String,String}(string(k) => string(v) for (k, v) in pairs(tags))

    lock(store.lock) do
        old = pop!(store.entries, key_str, nothing)
        old === nothing || (store.total_bytes -= old.size_bytes)
        index = findfirst(==(key_str), store.access_order)
        index === nothing || deleteat!(store.access_order, index)

        _evict_lru_locked!(store)

        now = Float64(time())
        store.entries[key_str] = CacheEntry(key_str, deepcopy(data), entry_size, now, now, tag_dict)
        store.total_bytes += entry_size
        _touch_locked!(store, key_str)
        true
    end
end

"""
    cache_has!(store, key) -> Bool

Check if a key exists in the cache without updating access order.
"""
function cache_has!(store::CacheStore, key::AbstractString)
    lock(store.lock) do
        haskey(store.entries, String(key))
    end
end

"""
    cache_remove!(store, key) -> Bool

Remove an entry from the cache. Returns `true` if the entry existed.
"""
function cache_remove!(store::CacheStore, key::AbstractString)
    key_str = String(key)
    lock(store.lock) do
        entry = pop!(store.entries, key_str, nothing)
        entry === nothing && return false
        store.total_bytes -= entry.size_bytes
        index = findfirst(==(key_str), store.access_order)
        index === nothing || deleteat!(store.access_order, index)
        true
    end
end

"""
    cache_clear!(store) -> Nothing

Remove all entries from the cache.
"""
function cache_clear!(store::CacheStore)
    lock(store.lock) do
        empty!(store.entries)
        empty!(store.access_order)
        store.total_bytes = 0
    end
    nothing
end

"""
    cache_stats(store) -> Dict{String,Any}

Return cache statistics: entry count, total bytes, max limits, utilization.
"""
function cache_stats(store::CacheStore)
    lock(store.lock) do
        Dict{String,Any}(
            "entries" => length(store.entries),
            "totalBytes" => store.total_bytes,
            "maxEntries" => store.max_entries,
            "maxEntryBytes" => store.max_entry_bytes,
            "maxTotalBytes" => store.max_total_bytes,
            "utilization" => store.max_entries > 0 ?
                round(length(store.entries) / store.max_entries * 100; digits=1) : 0.0,
        )
    end
end

"""
    cache_keys(store) -> Vector{String}

Return all cached keys in LRU order (oldest first).
"""
function cache_keys(store::CacheStore)
    lock(store.lock) do
        copy(store.access_order)
    end
end

function _estimate_size(data)
    str = sprint(show, data)
    max(ncodeunits(str), 256)
end

end
