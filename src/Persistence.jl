"""
    Persistence

Thin compatibility shim. The canonical implementation lives in
`packages/VersionedJSONStore.jl`. This module re-exports the public API
so existing `using ..Persistence` consumers work without changes.
"""
module Persistence

using ..VersionedJSONStore: Store, StorageError, atomic_write!, load,
    normalize_json, save!, parse_json, json_string

export Store, StorageError, atomic_write!, load, normalize_json, save!

end
