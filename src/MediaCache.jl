"""
    MediaCache

Thin compatibility shim. The canonical implementation lives in
`packages/BoundedCache.jl`. This module re-exports the public API
so existing `using ..MediaCache` consumers work without changes.
"""
module MediaCache

using ..BoundedCache: CacheStore, cache_get!, cache_put!, cache_has!,
    cache_remove!, cache_clear!, cache_stats, cache_keys

export CacheStore, cache_get!, cache_put!, cache_has!, cache_remove!,
    cache_clear!, cache_stats, cache_keys

end
