# Paper projects are directories under configured workspace roots (with
# ~/Documents always available). The manifest is written by PaperProjects;
# this layer owns user-path authorization and wire error codes.

const PAPER_PROJECT_HANDLES = Dict{String,String}()
const PAPER_PROJECT_HANDLES_LOCK = ReentrantLock()

function _paper_project_path(value; create=false)
    value isa AbstractString && !isempty(strip(value)) ||
        return nothing, ("InvalidArgument", "paper project path is required")
    try
        documents = joinpath(homedir(), "Documents")
        isdir(documents) || mkpath(documents)
        WorkspacePolicy.authorize_project(
            value,
            _configured_workspace_roots();
            create=create,
        ), nothing
    catch error
        error isa WorkspacePolicy.PolicyError ||
            return nothing, ("PathUnavailable", "could not resolve paper project path: $(sprint(showerror, error))")
        code = error.code == :invalid ? "InvalidArgument" :
            error.code == :missing ? (create ? "PathMissing" : "PaperProjectNotFound") :
            error.code == :forbidden ? "PathNotAllowed" : "PathUnavailable"
        nothing, (code, error.detail)
    end
end

function _paper_error(error)
    if error isa PaperProjects.PaperProjectError
        code = error.code == :invalid ? "InvalidPaperProject" :
            error.code == :exists ? "PaperProjectExists" :
            error.code == :not_found ? "PaperProjectNotFound" :
            error.code == :unsupported ? "PaperProjectUnsupported" : "PaperProjectFailed"
        return _err(code, sprint(showerror, error))
    elseif error isa Persistence.StorageError
        code = error.code == :corrupt ? "PaperProjectCorrupt" :
            error.code == :too_large ? "PaperProjectTooLarge" :
            error.code == :unsupported ? "PaperProjectUnsupported" : "PaperProjectWriteFailed"
        return _err(code, sprint(showerror, error))
    end
    _err("PaperProjectFailed", sprint(showerror, error))
end

function _new_paper_project_handle(path::AbstractString)
    handle = "paper-project-$(_uuid())"
    lock(PAPER_PROJECT_HANDLES_LOCK) do
        PAPER_PROJECT_HANDLES[handle] = String(path)
    end
    handle
end

function _handle_path(value)
    value isa AbstractString || return nothing, nothing
    key = String(value)
    path = lock(PAPER_PROJECT_HANDLES_LOCK) do
        get(PAPER_PROJECT_HANDLES, key, nothing)
    end
    path === nothing ? (nothing, nothing) : (key, path)
end

function _paper_project_scope(value)
    value isa AbstractString && !isempty(strip(value)) ||
        return nothing, ("InvalidArgument", "paper project path or handle is required")
    _, handle_path = _handle_path(value)
    if handle_path !== nothing
        WorkspacePolicy.contains_path(handle_path, _configured_workspace_roots()) ||
            return nothing, ("PathNotAllowed", "paper project handle is outside the current workspace roots")
        return handle_path, nothing
    end
    startswith(String(value), "paper-project-") &&
        return nothing, ("PaperProjectHandleNotFound", "paper project handle is no longer valid")
    _paper_project_path(value)
end

function _paper_reproducibility(path::AbstractString, project)
    record_path = joinpath(path, PaperProjects.REPRODUCIBILITY_FILENAME)
    if isfile(record_path)
        try
            return Persistence.normalize_json(JSON3.read(read(record_path, String)))
        catch
        end
    end
    PaperProjects.reproducibility_manifest(project)
end

function _paper_result(path, project, handle)
    Dict(
        "schemaVersion" => PaperProjects.SCHEMA_VERSION,
        "projectHandle" => handle,
        # Kept for compatibility with the initial path-based API. Follow-up
        # mutations can use projectHandle and avoid sending the path again.
        "path" => path,
        "project" => project,
        "reproducibility" => _paper_reproducibility(path, project),
    )
end

function _validate_paper_project(args)
    length(args) == 1 || return _err("InvalidArgument", "paper project is required")
    result = PaperProjects.validate_project(args[1])
    _ok(result)
end

function _create_paper_project(args)
    length(args) == 2 || return _err("InvalidArgument", "paper project path and data are required")
    path, error = _paper_project_path(args[1]; create=true)
    error === nothing || return _err(error...)
    try
        project = PaperProjects.create_project!(path, args[2])
        handle = _new_paper_project_handle(path)
        _ok(_paper_result(path, project, handle))
    catch exception
        _paper_error(exception)
    end
end

function _open_paper_project(args)
    length(args) == 1 || return _err("InvalidArgument", "paper project path is required")
    path, error = _paper_project_path(args[1])
    error === nothing || return _err(error...)
    try
        project = PaperProjects.load_project(path)
        handle = _new_paper_project_handle(path)
        _ok(_paper_result(path, project, handle))
    catch exception
        _paper_error(exception)
    end
end

function _save_paper_project(args)
    length(args) == 2 || return _err("InvalidArgument", "paper project path and data are required")
    path, error = _paper_project_scope(args[1])
    error === nothing || return _err(error...)
    try
        project = PaperProjects.save_project!(path, args[2])
        handle, _ = _handle_path(args[1])
        handle === nothing && (handle = _new_paper_project_handle(path))
        _ok(_paper_result(path, project, handle))
    catch exception
        _paper_error(exception)
    end
end

function _project_to_pdf_body(project)
    sections = get(project, "sections", Any[])
    body = IOBuffer()
    abstract_text = get(project, "abstract", "")
    if abstract_text isa AbstractString && !isempty(abstract_text)
        print(body, "# Abstract\n\n")
        print(body, abstract_text, "\n\n")
    end
    for section in sections
        section isa AbstractDict || continue
        title = get(section, "title", "")
        title_text = title isa AbstractString ? strip(title) : ""
        section_body = get(section, "body", "")
        section_text = section_body isa AbstractString ? section_body : ""
        isempty(title_text) && continue
        print(body, "# ", title_text, "\n\n")
        print(body, section_text, "\n\n")
    end
    references = get(project, "references", Any[])
    if !isempty(references)
        print(body, "# References\n\n")
        for ref in references
            ref isa AbstractDict || continue
            key = get(ref, "key", "")
            ref_type = get(ref, "type", "misc")
            fields = get(ref, "fields", nothing)
            fields isa AbstractDict || (fields = Dict{String,Any}())
            title_val = get(fields, "title", "")
            title_str = title_val isa AbstractString ? title_val : ""
            author_val = get(fields, "author", "")
            author_str = author_val isa AbstractString ? author_val : ""
            year_val = get(fields, "year", "")
            year_str = year_val isa AbstractString ? year_val : ""
            entry = IOBuffer()
            key_str = key isa AbstractString ? key : ""
            print(entry, "[", key_str, "] ", ref_type, ".")
            !isempty(author_str) && print(entry, " ", author_str, ".")
            !isempty(title_str) && print(entry, " ", title_str, ".")
            !isempty(year_str) && print(entry, " ", year_str, ".")
            print(body, String(take!(entry)), "\n")
        end
    end
    String(take!(body))
end

function _export_paper_project(args)
    length(args) >= 1 || return _err("InvalidArgument", "paper project path or handle is required")
    path, error = _paper_project_scope(args[1])
    error === nothing || return _err(error...)
    output_path = nothing
    if length(args) >= 2 && args[2] isa AbstractString && !isempty(strip(args[2]))
        output_path = expanduser(strip(String(args[2])))
    end
    columns = 2
    if length(args) >= 3 && args[3] isa AbstractDict
        columns = get(args[3], "columns", 2)
    end
    columns in (1, 2) || (columns = 2)
    try
        project = PaperProjects.load_project(path)
        title = get(project, "title", "Untitled")
        title_str = title isa AbstractString ? title : "Untitled"
        body = _project_to_pdf_body(project)
        if output_path === nothing
            safe_title = replace(lowercase(strip(title_str)), r"[^a-z0-9]+" => "-")
            safe_title = replace(safe_title, r"^-|-$" => "")
            isempty(safe_title) && (safe_title = "paper")
            output_path = joinpath(homedir(), "Documents", "$safe_title.pdf")
        end
        parent_dir = dirname(output_path)
        isdir(parent_dir) || mkpath(parent_dir)
        WorkspacePolicy.contains_path(realpath(parent_dir), _configured_workspace_roots()) ||
            return _err("PathNotAllowed", "export path is outside the configured workspace roots")
        PDFGen.write_pdf(output_path, title_str, body; columns=columns)
        _ok(Dict(
            "path" => output_path,
            "columns" => columns,
            "title" => title_str,
            "sections" => length(get(project, "sections", Any[])),
        ))
    catch exception
        _paper_error(exception)
    end
end

function _list_paper_projects(args)
    scan_root = homedir()
    if length(args) >= 1 && args[1] isa AbstractString && !isempty(strip(args[1]))
        scan_root = expanduser(strip(String(args[1])))
        isdir(scan_root) || return _err("PathNotFound", "scan root was not found: $scan_root")
    end
    projects = Any[]
    max_results = 50
    try
        for (root, dirs, files) in walkdir(scan_root; topdown=true)
            length(projects) >= max_results && break
            "paper.json" in files || continue
            project_path = root
            canonical = try
                realpath(project_path)
            catch
                continue
            end
            WorkspacePolicy.contains_path(canonical, _configured_workspace_roots()) || continue
            paper_file = joinpath(project_path, "paper.json")
            try
                raw = read(paper_file, String)
                project = Persistence.normalize_json(JSON3.read(raw))
                project isa AbstractDict || continue
                title = get(project, "title", "")
                status = get(project, "status", "draft")
                id = get(project, "id", "")
                push!(projects, Dict{String,Any}(
                    "path" => canonical,
                    "title" => title isa AbstractString ? title : "",
                    "status" => status isa AbstractString ? status : "draft",
                    "id" => id isa AbstractString ? id : "",
                ))
            catch
                continue
            end
            length(projects) >= max_results && break
        end
    catch
    end
    _ok(Dict("projects" => projects, "count" => length(projects)))
end
