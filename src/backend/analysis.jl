# ── MIR ──────────────────────────────────────────────────────────────────────

function _mir_analyze(args)
    length(args) >= 2 || return _err("InvalidAudioInput", "Samples and sample rate are required")
    samples, sample_rate = args[1], args[2]
    try
        _ok(AudioAnalysisAdapter.analyze_samples(samples, sample_rate))
    catch error
        error isa AudioAnalysisAdapter.AudioTooLargeError &&
            return _err("AudioTooLarge", sprint(showerror, error))
        _err("InvalidAudioInput", sprint(showerror, error))
    end
end

# ── Asset scanning ───────────────────────────────────────────────────────────

function _discover_volumes()
    volumes = Dict{String,Any}[
        Dict("id" => "home", "name" => "Home Directory", "path" => homedir(), "kind" => "general"),
    ]

    # Add common directories
    for (name, kind) in [("projects", "blender"), ("samples", "audio"), ("renders", "render"), ("Documents", "general"), ("Music", "audio")]
        path = joinpath(homedir(), name)
        isdir(path) && push!(volumes, Dict("id" => lowercase(name), "name" => name, "path" => path, "kind" => kind))
    end

    # Try to discover mounted volumes via /proc/mounts
    try
        mounts = read("/proc/mounts", String)
        for line in split(mounts, "\n"; keepempty=false)
            parts = split(line)
            length(parts) < 2 && continue
            device, mountpoint = string(parts[1]), string(parts[2])
            # Skip virtual filesystems
            startswith(device, "/dev/") || continue
            startswith(mountpoint, "/home/") || startswith(mountpoint, "/mnt/") || startswith(mountpoint, "/media/") || continue
            # Skip if already in list
            any(v -> v["path"] == mountpoint, volumes) && continue
            label = basename(mountpoint)
            push!(volumes, Dict(
                "id" => "vol-$(_uuid()[1:8])",
                "name" => label,
                "path" => mountpoint,
                "kind" => "general",
            ))
        end
    catch
    end

    volumes
end

function _list_volumes(args)
    if isempty(STATE.volumes)
        STATE.volumes = _discover_volumes()
    end
    _ok(STATE.volumes)
end

function _start_asset_scan(args)
    length(args) >= 1 || return _err("InvalidArgument", "Volume id is required")
    volume_id = args[1]
    volume_id isa AbstractString && !isempty(strip(volume_id)) ||
        return _err("InvalidArgument", "Volume id is invalid")

    # Resolve the public volume id to a path from the discovered allowlist;
    # callers cannot submit an arbitrary filesystem path here.
    volume_path = ""
    if isempty(STATE.volumes)
        STATE.volumes = _discover_volumes()
    end
    for v in STATE.volumes
        if v["id"] == volume_id
            volume_path = v["path"]
            break
        end
    end
    isempty(volume_path) && return _err("AssetVolumeNotFound", "Volume $volume_id not found")

    Jobs.cleanup!(STATE.jobs)
    job_id = try
        Jobs.create_job!(STATE.jobs; kind="asset-scan", metadata=Dict(
            "volumeId" => String(volume_id),
            "path" => volume_path,
        ))
    catch error
        return _err("JobLimitReached", sprint(showerror, error))
    end
    job = Dict{String,Any}(
        "id" => job_id,
        "volumeId" => volume_id,
        "progress" => 0.0,
        "state" => "running",
        "scannedFiles" => 0,
        "scannedBytes" => 0,
        "blender" => 0,
        "audio" => 0,
        "render" => 0,
        "other" => 0,
        "truncated" => false,
    )
    STATE.scan_jobs[job_id] = job

    @async begin
        try
            _run_scan(job_id, job, volume_path)
        catch error
            Jobs.fail_job!(STATE.jobs, job_id, error)
        end
    end

    _ok(_scan_response(job_id))
end

function _scan_response(job_id::AbstractString)
    snapshot = try
        Jobs.snapshot(STATE.jobs, job_id)
    catch
        return nothing
    end
    details = get(STATE.scan_jobs, String(job_id), Dict{String,Any}())
    response = deepcopy(details)
    response["id"] = String(job_id)
    response["state"] = snapshot["state"]
    response["progress"] = snapshot["progress"]
    response["message"] = snapshot["message"]
    snapshot["error"] !== nothing && (response["error"] = snapshot["error"])
    response
end

function _run_scan(job_id::AbstractString, job::Dict{String,Any}, volume_path::AbstractString)
    isdir(volume_path) || throw(ArgumentError("scan root is no longer available: $volume_path"))
    audio_exts = Set([".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac", ".aiff"])
    render_exts = Set([".png", ".jpg", ".jpeg", ".exr", ".hdr", ".tiff"])
    blender_exts = Set([".blend", ".blend1"])
    # Depth and entry caps keep a broad volume scan responsive and prevent a
    # single job from producing an unbounded result set.
    report = FileTrees.scan(volume_path; max_depth=3, max_entries=100_000,
        should_cancel=() -> Jobs.is_cancelled(STATE.jobs, job_id),
        on_file=(entry, progress) -> begin
            job["scannedFiles"] = progress.scanned_files
            job["scannedBytes"] = progress.scanned_bytes
            Jobs.update_job!(STATE.jobs, job_id; message=progress.current_path)
            ext = entry.extension
            if ext in audio_exts
                job["audio"] += 1
            elseif ext in render_exts
                job["render"] += 1
            elseif ext in blender_exts
                job["blender"] += 1
            else
                job["other"] += 1
            end
        end)

    for (folder, size) in report.top_folders
        push!(get!(job, "topFolders", Any[]), Dict("name" => folder, "bytes" => size))
    end
    job["truncated"] = report.truncated
    if report.cancelled
        return
    end
    job["scannedFiles"] = report.scanned_files
    job["scannedBytes"] = report.scanned_bytes
    Jobs.complete_job!(STATE.jobs, job_id; result=deepcopy(job))
end

function _get_asset_scan_status(args)
    length(args) >= 1 || return _err("InvalidArgument", "Scan job id is required")
    job_id = args[1]
    job_id isa AbstractString || return _err("InvalidArgument", "Scan job id is invalid")
    haskey(STATE.scan_jobs, job_id) || return _err("AssetJobNotFound", "Scan job $job_id not found")
    _ok(_scan_response(job_id))
end

function _cancel_asset_scan(args)
    length(args) >= 1 || return _err("InvalidArgument", "Scan job id is required")
    job_id = args[1]
    job_id isa AbstractString || return _err("InvalidArgument", "Scan job id is invalid")
    haskey(STATE.scan_jobs, job_id) || return _err("AssetJobNotFound", "Scan job $job_id not found")
    Jobs.cancel_job!(STATE.jobs, job_id)
    _ok(_scan_response(job_id))
end

# ── Audio analysis adapter ───────────────────────────────────────────────────

function _audio_metadata_internal(args)
    length(args) >= 1 || return _err("InvalidArgument", "Audio path is required")
    path, path_error = _validate_read_path(args[1], "Audio")
    path_error !== nothing && return _err(path_error...)
    try
        metadata = AudioAnalysisAdapter.read_metadata(path)
        _ok(metadata)
    catch error
        error isa AudioAnalysisAdapter.AudioUnsupportedError &&
            return _err("UnsupportedAudioFormat", sprint(showerror, error))
        error isa AudioAnalysisAdapter.AudioTooLargeError &&
            return _err("AudioTooLarge", sprint(showerror, error))
        _err("InvalidAudio", sprint(showerror, error))
    end
end

function _audio_analysis_internal(args)
    length(args) >= 1 || return _err("InvalidArgument", "Audio path is required")
    path, path_error = _validate_read_path(args[1], "Audio")
    path_error !== nothing && return _err(path_error...)
    try
        values = AudioAnalysisAdapter.analyze_file(path; max_frames=262144)
        # Keep Julia's snake_case fields and add the frontend's camelCase
        # aliases during the migration; consumers can move independently.
        values["durationSec"] = values["duration_seconds"]
        values["sampleRate"] = values["sample_rate"]
        values["sampleCount"] = values["sample_count"]
        _ok(values)
    catch error
        error isa AudioAnalysisAdapter.AudioUnsupportedError &&
            return _err("UnsupportedAudioFormat", sprint(showerror, error))
        error isa AudioAnalysisAdapter.AudioTooLargeError &&
            return _err("AudioTooLarge", sprint(showerror, error))
        _err("InvalidAudio", sprint(showerror, error))
    end
end

function _audio_job_response(job_id::AbstractString)
    snapshot = try
        Jobs.snapshot(STATE.jobs, job_id)
    catch
        return nothing
    end
    path = get(STATE.audio_jobs, String(job_id), "")
    response = Dict{String,Any}(
        "id" => String(job_id),
        "path" => path,
        "state" => snapshot["state"],
        "progress" => snapshot["progress"],
        "message" => snapshot["message"],
    )
    snapshot["error"] !== nothing && (response["error"] = snapshot["error"])
    result = snapshot["result"]
    result isa AbstractDict && merge!(response, result)
    response
end

function _run_audio_analysis(job_id::AbstractString, path::AbstractString)
    try
        Jobs.update_job!(STATE.jobs, job_id; message="Reading audio file")
        result = AudioAnalysisAdapter.analyze_file(path; max_frames=262144)
        result["durationSec"] = result["duration_seconds"]
        result["sampleRate"] = result["sample_rate"]
        result["sampleCount"] = result["sample_count"]
        Jobs.complete_job!(STATE.jobs, job_id; result=result)
    catch error
        Jobs.fail_job!(STATE.jobs, job_id, error)
    end
end

function _start_audio_analysis(args)
    length(args) >= 1 || return _err("InvalidArgument", "Audio path is required")
    path, path_error = _validate_read_path(args[1], "Audio")
    path_error !== nothing && return _err(path_error...)
    Jobs.cleanup!(STATE.jobs)
    job_id = try
        Jobs.create_job!(STATE.jobs; kind="audio-analysis", metadata=Dict("path" => path))
    catch error
        return _err("JobLimitReached", sprint(showerror, error))
    end
    STATE.audio_jobs[job_id] = path
    Threads.@spawn _run_audio_analysis(job_id, path)
    _ok(_audio_job_response(job_id))
end

function _get_audio_analysis_status(args)
    length(args) >= 1 || return _err("InvalidArgument", "Audio job id is required")
    job_id = args[1]
    job_id isa AbstractString || return _err("InvalidArgument", "Audio job id is invalid")
    haskey(STATE.audio_jobs, job_id) || return _err("AudioJobNotFound", "Audio job $job_id not found")
    response = _audio_job_response(job_id)
    response === nothing && return _err("AudioJobNotFound", "Audio job $job_id not found")
    _ok(response)
end

function _cancel_audio_analysis(args)
    length(args) >= 1 || return _err("InvalidArgument", "Audio job id is required")
    job_id = args[1]
    job_id isa AbstractString || return _err("InvalidArgument", "Audio job id is invalid")
    haskey(STATE.audio_jobs, job_id) || return _err("AudioJobNotFound", "Audio job $job_id not found")
    Jobs.cancel_job!(STATE.jobs, job_id)
    _ok(_audio_job_response(job_id))
end

function _parse_bibtex(args)
    length(args) >= 1 || return _err("InvalidArgument", "BibTeX source is required")
    try
        entries = BibTeX.parse_bibtex(String(args[1]))
        _ok([Dict("type" => entry.entry_type, "key" => entry.key, "fields" => entry.fields) for entry in entries])
    catch error
        _err("InvalidBibTeX", sprint(showerror, error))
    end
end

function _inspect_blend(args)
    length(args) >= 1 || return _err("InvalidArgument", "Blend path is required")
    path, path_error = _validate_read_path(args[1], "Blender")
    path_error !== nothing && return _err(path_error...)
    try
        header = BlendReader.read_header(path)
        _ok(Dict(
            "path" => header.path,
            "pointerSize" => header.pointer_size,
            "byteOrder" => String(header.byte_order),
            "version" => string(header.version),
        ))
    catch error
        _err("InvalidBlendFile", sprint(showerror, error))
    end
end
