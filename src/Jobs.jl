"""
    Jobs

Thread-safe cooperative job manager. Jobs progress through states:
  running → completed | failed | cancelled

Callers (typically `@async` or `Threads.@spawn` tasks) check `is_cancelled`
cooperatively between units of work. The manager never starts tasks itself —
it only tracks state, progress, and results.

Terminal jobs (completed/failed/cancelled) are retained for at most
`retention_seconds` (default 1 hour) and bounded by `max_jobs` (default 256).
Eviction order: oldest `updated_at` first, ties broken by id.
"""
module Jobs

export JobManager, create_job!, update_job!, cancel_job!, is_cancelled,
    complete_job!, fail_job!, snapshot, snapshots, cleanup!

const _RUNNING = "running"
const _COMPLETED = "completed"
const _FAILED = "failed"
const _CANCELLED = "cancelled"

mutable struct _Job
    id::String
    kind::String
    state::String
    progress::Float64
    message::String
    metadata::Dict{String,Any}
    result::Any
    error::Union{Nothing,String}
    created_at::Float64
    updated_at::Float64
end

"""
    JobManager(; max_jobs=256, retention_seconds=3600.0)

Create an in-memory, thread-safe job manager. At most `max_jobs` jobs are
retained. Terminal jobs older than `retention_seconds` are removed by
`cleanup!` and opportunistically when a new job is created.

The manager does not start tasks or threads. A caller owns the work loop and
uses `update_job!`, `is_cancelled`, and one of the terminal transition
functions cooperatively.
"""
mutable struct JobManager
    lock::ReentrantLock
    jobs::Dict{String,_Job}
    max_jobs::Int
    retention_seconds::Float64
    next_id::UInt64
end

function JobManager(; max_jobs::Integer=256, retention_seconds::Real=3600.0)
    # Bool <: Integer in Julia, so `max_jobs=true` would pass the Integer
    # check. Explicitly reject Bool to catch this common mistake.
    max_jobs isa Bool && throw(ArgumentError("max_jobs must be a positive integer"))
    1 <= max_jobs <= typemax(Int) ||
        throw(ArgumentError("max_jobs must be a positive integer"))

    retention_seconds isa Bool &&
        throw(ArgumentError("retention_seconds must be a finite non-negative number"))
    retention = Float64(retention_seconds)
    isfinite(retention) && retention >= 0 ||
        throw(ArgumentError("retention_seconds must be a finite non-negative number"))

    return JobManager(
        ReentrantLock(),
        Dict{String,_Job}(),
        Int(max_jobs),
        retention,
        UInt64(0),
    )
end

_terminal(job::_Job) = job.state != _RUNNING

function _copy_metadata(metadata)
    metadata === nothing && return Dict{String,Any}()
    metadata isa AbstractDict || throw(ArgumentError("metadata must be a dictionary or nothing"))

    copied = Dict{String,Any}()
    for (key, value) in pairs(metadata)
        string_key = string(key)
        haskey(copied, string_key) &&
            throw(ArgumentError("metadata keys must be unique after string conversion"))
        copied[string_key] = deepcopy(value)
    end
    return copied
end

function _progress_value(progress)
    progress isa Bool && throw(ArgumentError("progress must be a finite number between 0 and 1"))
    progress isa Real || throw(ArgumentError("progress must be a finite number between 0 and 1"))
    value = Float64(progress)
    isfinite(value) && 0 <= value <= 1 ||
        throw(ArgumentError("progress must be a finite number between 0 and 1"))
    return value
end

function _lookup_locked(manager::JobManager, id::AbstractString)
    key = String(id)
    haskey(manager.jobs, key) || throw(KeyError(key))
    return manager.jobs[key]
end

function _oldest_terminal_locked(manager::JobManager)
    candidate = nothing
    for job in values(manager.jobs)
        if _terminal(job) && (
            candidate === nothing ||
            job.updated_at < candidate.updated_at ||
            (job.updated_at == candidate.updated_at && isless(job.id, candidate.id))
        )
            candidate = job
        end
    end
    return candidate
end

function _cleanup_locked!(manager::JobManager, now::Float64)
    removed = 0
    for id in collect(keys(manager.jobs))
        job = manager.jobs[id]
        if _terminal(job) && now - job.updated_at >= manager.retention_seconds
            delete!(manager.jobs, id)
            removed += 1
        end
    end
    return removed
end

function _make_room_locked!(manager::JobManager)
    while length(manager.jobs) >= manager.max_jobs
        oldest = _oldest_terminal_locked(manager)
        oldest === nothing && return false
        delete!(manager.jobs, oldest.id)
    end
    return true
end

function _next_id_locked!(manager::JobManager)
    manager.next_id == typemax(UInt64) && throw(ArgumentError("job id counter exhausted"))
    manager.next_id += UInt64(1)
    id = "job-$(manager.next_id)"
    while haskey(manager.jobs, id)
        manager.next_id == typemax(UInt64) && throw(ArgumentError("job id counter exhausted"))
        manager.next_id += UInt64(1)
        id = "job-$(manager.next_id)"
    end
    return id
end

"""
    create_job!(manager; kind="job", metadata=nothing) -> String

Create a running job and return its unique manager-local ID. `metadata` must
be a dictionary; its keys are converted to strings and its values are copied.
"""
function create_job!(manager::JobManager; kind::AbstractString="job", metadata=nothing)
    isempty(strip(kind)) && throw(ArgumentError("kind must not be empty"))
    kind_value = String(kind)
    metadata_value = _copy_metadata(metadata)

    return lock(manager.lock) do
        _cleanup_locked!(manager, Float64(time()))
        _make_room_locked!(manager) ||
            throw(ArgumentError("job manager is full; all retained jobs are active"))

        id = _next_id_locked!(manager)
        now = Float64(time())
        manager.jobs[id] = _Job(
            id,
            kind_value,
            _RUNNING,
            0.0,
            "",
            metadata_value,
            nothing,
            nothing,
            now,
            now,
        )
        return id
    end
end

"""
    update_job!(manager, id; progress=nothing, message=nothing) -> Bool

Update a running job. `progress`, when supplied, must be between `0` and `1`.
`message` is optional text. Returns `true` when the update is accepted and
`false` when the job has already reached a terminal state.
"""
function update_job!(
    manager::JobManager,
    id::AbstractString;
    progress=nothing,
    message=nothing,
)
    progress_value = progress === nothing ? nothing : _progress_value(progress)
    message_value = if message === nothing
        nothing
    elseif message isa AbstractString
        String(message)
    else
        throw(ArgumentError("message must be text"))
    end

    return lock(manager.lock) do
        job = _lookup_locked(manager, id)
        if job.state != _RUNNING
            false
        else
            progress_value !== nothing && (job.progress = progress_value)
            message_value !== nothing && (job.message = message_value)
            job.updated_at = Float64(time())
            true
        end
    end
end

"""
    cancel_job!(manager, id) -> Bool

Request cooperative cancellation. The job changes to `"cancelled"`
immediately; a worker should check `is_cancelled` between units of work.
Returns `true` only when this call changes a running job.
"""
function cancel_job!(manager::JobManager, id::AbstractString)
    return lock(manager.lock) do
        job = _lookup_locked(manager, id)
        if job.state != _RUNNING
            false
        else
            job.state = _CANCELLED
            job.updated_at = Float64(time())
            true
        end
    end
end

"""
    is_cancelled(manager, id) -> Bool

Return whether a job has been cancelled. Missing IDs throw `KeyError`.
"""
function is_cancelled(manager::JobManager, id::AbstractString)
    return lock(manager.lock) do
        _lookup_locked(manager, id).state == _CANCELLED
    end
end

"""
    complete_job!(manager, id; result=nothing) -> Bool

Complete a running job, set its progress to `1`, and optionally attach a
result. Returns `false` if the job is already terminal.
"""
function complete_job!(manager::JobManager, id::AbstractString; result=nothing)
    return lock(manager.lock) do
        job = _lookup_locked(manager, id)
        if job.state != _RUNNING
            false
        else
            job.result = deepcopy(result)
            job.progress = 1.0
            job.state = _COMPLETED
            job.updated_at = Float64(time())
            true
        end
    end
end

function _failure_message(value)
    return value isa AbstractString ? String(value) : sprint(showerror, value)
end

"""
    fail_job!(manager, id, error) -> Bool

Mark a running job as failed and store `error` as text. Exceptions are
formatted with `showerror`. Returns `false` if the job is already terminal.
"""
function fail_job!(manager::JobManager, id::AbstractString, error)
    error_message = _failure_message(error)
    return lock(manager.lock) do
        job = _lookup_locked(manager, id)
        if job.state != _RUNNING
            false
        else
            job.error = error_message
            job.state = _FAILED
            job.updated_at = Float64(time())
            true
        end
    end
end

function _snapshot(job::_Job)
    return Dict{String,Any}(
        "id" => job.id,
        "kind" => job.kind,
        "state" => job.state,
        "progress" => job.progress,
        "message" => job.message,
        "metadata" => deepcopy(job.metadata),
        "result" => deepcopy(job.result),
        "error" => job.error,
        "created_at" => job.created_at,
        "updated_at" => job.updated_at,
    )
end

"""
    snapshot(manager, id) -> Dict{String,Any}

Return a detached, serialization-friendly snapshot with string keys:
`id`, `kind`, `state`, `progress`, `message`, `metadata`, `result`, `error`,
`created_at`, and `updated_at`. Missing IDs throw `KeyError`.
"""
function snapshot(manager::JobManager, id::AbstractString)
    return lock(manager.lock) do
        _snapshot(_lookup_locked(manager, id))
    end
end

"""
    snapshots(manager) -> Vector{Dict{String,Any}}

Return detached snapshots for all retained jobs, ordered by creation time.
"""
function snapshots(manager::JobManager)
    return lock(manager.lock) do
        jobs = collect(values(manager.jobs))
        sort!(jobs; by=job -> (job.created_at, job.id))
        Dict{String,Any}[_snapshot(job) for job in jobs]
    end
end

"""
    cleanup!(manager; now=time()) -> Int

Remove terminal jobs whose last update is at least `retention_seconds` old.
Returns the number removed. The optional `now` keyword is useful for tests and
uses the same numeric time units as `time()`.
"""
function cleanup!(manager::JobManager; now::Real=time())
    now isa Bool && throw(ArgumentError("now must be a finite number"))
    timestamp = Float64(now)
    isfinite(timestamp) || throw(ArgumentError("now must be a finite number"))
    return lock(manager.lock) do
        _cleanup_locked!(manager, timestamp)
    end
end

end
