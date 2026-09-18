"""
    Jobs

Thin compatibility shim. The canonical implementation lives in
`packages/CooperativeJobManager.jl`. This module re-exports the public API
so existing `using ..Jobs` consumers work without changes.
"""
module Jobs

using ..CooperativeJobManager: JobManager, create_job!, update_job!,
    cancel_job!, is_cancelled, complete_job!, fail_job!, snapshot,
    snapshots, cleanup!

export JobManager, create_job!, update_job!, cancel_job!, is_cancelled,
    complete_job!, fail_job!, snapshot, snapshots, cleanup!

end
