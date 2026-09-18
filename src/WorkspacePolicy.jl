"""Canonical filesystem authorization shared by backend resources."""
module WorkspacePolicy

export PolicyError, authorize_project, authorize_read_file,
    authorize_write_file, canonical_roots, contains_path, error_code

struct PolicyError <: Exception
    code::Symbol
    detail::String
end

Base.showerror(io::IO, error::PolicyError) = print(io, error.detail)

"""Map a policy failure to the stable application error code used on the wire."""
function error_code(error::PolicyError; missing_code="PathMissing")
    error.code == :invalid && return "InvalidArgument"
    error.code == :missing && return String(missing_code)
    error.code == :forbidden && return "PathNotAllowed"
    "PathUnavailable"
end

function canonical_roots(candidates)
    roots = String[]
    for candidate in candidates
        candidate isa AbstractString || continue
        expanded = expanduser(strip(String(candidate)))
        isempty(expanded) && continue
        isdir(expanded) || continue
        resolved = try
            realpath(expanded)
        catch
            continue
        end
        resolved in roots || push!(roots, resolved)
    end
    roots
end

function contains_path(path::AbstractString, roots; allow_root=false)
    separator = string(Base.Filesystem.path_separator)
    any(roots) do root
        (allow_root && path == root) || startswith(path, root * separator)
    end
end

function _input(value, label)
    value isa AbstractString && !isempty(strip(value)) ||
        throw(PolicyError(:invalid, "$label path is required"))
    occursin('\0', value) && throw(PolicyError(:invalid, "$label path is invalid"))
    abspath(expanduser(String(value)))
end

function authorize_read_file(value, roots; label="Resource")
    target = _input(value, label)
    isfile(target) || throw(PolicyError(:missing, "$label file was not found"))
    canonical = try
        realpath(target)
    catch error
        throw(PolicyError(:unavailable, "could not resolve $label path: $(sprint(showerror, error))"))
    end
    contains_path(canonical, roots; allow_root=true) ||
        throw(PolicyError(:forbidden, "$label path is outside the allowed workspace roots"))
    canonical
end

function authorize_write_file(value, roots; label="Output")
    target = _input(value, label)
    parent = try
        realpath(dirname(target))
    catch error
        throw(PolicyError(:unavailable, "could not resolve $label parent: $(sprint(showerror, error))"))
    end
    canonical = ispath(target) ? realpath(target) : joinpath(parent, basename(target))
    contains_path(canonical, roots) ||
        throw(PolicyError(:forbidden, "$label path is outside the allowed workspace roots"))
    isdir(canonical) && throw(PolicyError(:invalid, "$label path must be a file"))
    canonical
end

function authorize_project(value, roots; create=false)
    target = _input(value, "paper project")
    if create
        parent = dirname(target)
        isdir(parent) || throw(PolicyError(:missing, "paper project parent directory was not found"))
        canonical = ispath(target) ? realpath(target) : joinpath(realpath(parent), basename(target))
    else
        isdir(target) || throw(PolicyError(:missing, "paper project was not found"))
        canonical = realpath(target)
    end
    contains_path(canonical, roots) || throw(PolicyError(
        :forbidden,
        "paper project is outside the configured workspace roots",
    ))
    canonical
end

end
