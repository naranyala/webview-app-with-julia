module FileTrees

export FileEntry, ScanProgress, ScanReport, scan

struct FileEntry
    path::String
    relative_path::String
    size::Int
    modified::Float64
    extension::String
    kind::Symbol
end

struct ScanProgress
    scanned_files::Int
    scanned_bytes::Int
    current_path::String
end

mutable struct ScanReport
    root::String
    files::Vector{FileEntry}
    scanned_files::Int
    scanned_bytes::Int
    truncated::Bool
    cancelled::Bool
    top_folders::Vector{Pair{String,Int}}
    by_extension::Dict{String,Int}
end

function _kind(path::AbstractString)
    islink(path) && return :symlink
    isfile(path) && return :file
    isdir(path) && return :directory
    :other
end

function _relative(path, root)
    value = relpath(path, root)
    value == "." ? "" : value
end

function _top_folder(relative_path)
    isempty(relative_path) && return "."
    parts = splitpath(relative_path)
    length(parts) <= 1 ? "." : string(parts[1])
end

"""
    scan(root; max_depth=3, max_entries=100_000, follow_symlinks=false,
         should_cancel=nothing, on_file=nothing) -> ScanReport

Walk a directory using Julia's portable filesystem API. `on_file` receives a
`FileEntry` and `ScanProgress` after each file. `should_cancel` may be a
zero-argument function; cancellation is checked between entries.
"""
function scan(root::AbstractString; max_depth::Integer=3, max_entries::Integer=100_000,
              follow_symlinks::Bool=false, should_cancel=nothing, on_file=nothing)
    root_path = abspath(expanduser(root))
    isdir(root_path) || throw(ArgumentError("scan root is not a directory: $root"))
    max_depth >= 0 || throw(ArgumentError("max_depth must be non-negative"))
    max_entries > 0 || throw(ArgumentError("max_entries must be positive"))

    report = ScanReport(root_path, FileEntry[], 0, 0, false, false, Pair{String,Int}[], Dict{String,Int}())
    folders = Dict{String,Int}()

    for (directory, subdirectories, files) in walkdir(root_path; follow_symlinks=follow_symlinks, topdown=true)
        relative_directory = _relative(directory, root_path)
        depth = isempty(relative_directory) ? 0 : length(splitpath(relative_directory))
        if depth >= max_depth
            empty!(subdirectories)
        end

        for name in files
            if should_cancel !== nothing && should_cancel()
                report.cancelled = true
                return _finish!(report, folders)
            end
            if report.scanned_files >= max_entries
                report.truncated = true
                return _finish!(report, folders)
            end

            path = joinpath(directory, name)
            kind = _kind(path)
            kind == :file || continue
            size = try
                filesize(path)
            catch
                continue
            end
            modified = try
                stat(path).mtime
            catch
                0.0
            end
            relative_path = _relative(path, root_path)
            extension = lowercase(splitext(name)[2])
            entry = FileEntry(path, relative_path, size, modified, extension, kind)
            push!(report.files, entry)
            report.scanned_files += 1
            report.scanned_bytes += size
            folder = _top_folder(relative_path)
            folders[folder] = get(folders, folder, 0) + size
            report.by_extension[extension] = get(report.by_extension, extension, 0) + 1
            on_file !== nothing && on_file(entry, ScanProgress(report.scanned_files, report.scanned_bytes, path))
            report.scanned_files % 64 == 0 && yield()
        end
    end
    _finish!(report, folders)
end

function _finish!(report::ScanReport, folders::Dict{String,Int})
    report.top_folders = sort(collect(folders); by=pair -> pair.second, rev=true)
    report
end

end
