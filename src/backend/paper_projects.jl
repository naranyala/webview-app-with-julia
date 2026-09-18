# Paper projects are directories under configured workspace roots (with
# ~/Documents always available). The manifest is written by PaperProjects;
# this layer owns user-path authorization and wire error codes.

const PAPER_PROJECT_HANDLES = Dict{String,String}()
const PAPER_PROJECT_HANDLES_LOCK = ReentrantLock()
const PAPER_PROJECT_HANDLE_ORDER = String[]
const MAX_PAPER_PROJECT_HANDLES = 256

function _prune_paper_project_handles!()
    while length(PAPER_PROJECT_HANDLE_ORDER) > MAX_PAPER_PROJECT_HANDLES
        delete!(PAPER_PROJECT_HANDLES, popfirst!(PAPER_PROJECT_HANDLE_ORDER))
    end
end

function _touch_paper_project_handle!(handle::AbstractString)
    index = findfirst(==(handle), PAPER_PROJECT_HANDLE_ORDER)
    index === nothing || deleteat!(PAPER_PROJECT_HANDLE_ORDER, index)
    push!(PAPER_PROJECT_HANDLE_ORDER, String(handle))
end

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
        nothing, _policy_error(error; missing_code=create ? "PathMissing" : "PaperProjectNotFound")
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
        _touch_paper_project_handle!(handle)
        _prune_paper_project_handles!()
    end
    handle
end

function _handle_path(value)
    value isa AbstractString || return nothing, nothing
    key = String(value)
    path = lock(PAPER_PROJECT_HANDLES_LOCK) do
        path = get(PAPER_PROJECT_HANDLES, key, nothing)
        path === nothing || _touch_paper_project_handle!(key)
        path
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

function _paper_export_path(value)
    value isa AbstractString && !isempty(strip(value)) ||
        return nothing, ("InvalidArgument", "paper export path is required")
    try
        WorkspacePolicy.authorize_write_file(
            value,
            _configured_workspace_roots();
            label="Paper export",
        ), nothing
    catch error
        error isa WorkspacePolicy.PolicyError ||
            return nothing, ("PathUnavailable", "could not resolve paper export path: $(sprint(showerror, error))")
        nothing, _policy_error(error; missing_code="PathMissing")
    end
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
    toc = get(project, "tableOfContents", nothing)
    toc_entries = toc isa AbstractDict ? get(toc, "entries", Any[]) : Any[]
    visible_toc = [entry for entry in toc_entries if entry isa AbstractDict && get(entry, "visible", true) === true]
    if !isempty(visible_toc)
        print(body, "# Table of Contents\n\n")
        for entry in visible_toc
            title = get(entry, "title", "")
            level = get(entry, "level", 1)
            title isa AbstractString || continue
            level isa Integer || (level = 1)
            print(body, repeat("  ", max(0, Int(level) - 1)), "- ", title, "\n")
        end
        print(body, "\n")
    end
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

function _validate_for_export(project)
    warnings = String[]
    sections = get(project, "sections", Any[])
    isempty(sections) && push!(warnings, "paper has no sections")
    for (index, section) in enumerate(sections)
        section isa AbstractDict || continue
        body = get(section, "body", "")
        body isa AbstractString && isempty(strip(body)) &&
            push!(warnings, "section $index ($(get(section, "title", ""))) has an empty body")
    end
    abstract_text = get(project, "abstract", "")
    abstract_text isa AbstractString && isempty(strip(abstract_text)) &&
        push!(warnings, "paper has an empty abstract")
    references = get(project, "references", Any[])
    isempty(references) && push!(warnings, "paper has no references")
    figures = get(project, "figures", Any[])
    for (index, figure) in enumerate(figures)
        figure isa AbstractDict || continue
        path = get(figure, "path", "")
        path isa AbstractString && !isempty(path) && !isfile(path) &&
            push!(warnings, "figure $index ($(get(figure, "id", ""))) references a missing file: $path")
    end
    layout = get(project, "layout", nothing)
    layout isa AbstractDict || push!(warnings, "paper has no layout configuration; using defaults")
    template = get(project, "template", nothing)
    template isa AbstractDict || push!(warnings, "paper has no template; using defaults")
    warnings
end

function _export_paper_project(args)
    length(args) >= 1 || return _err("InvalidArgument", "paper project path or handle is required")
    path, error = _paper_project_scope(args[1])
    error === nothing || return _err(error...)
    output_path = nothing
    if length(args) >= 2 && args[2] isa AbstractString && !isempty(strip(args[2]))
        output_path, error = _paper_export_path(args[2])
        error === nothing || return _err(error...)
    end
    columns = 2
    if length(args) >= 3 && args[3] isa AbstractDict
        columns = get(args[3], "columns", 2)
    end
    columns in (1, 2) || (columns = 2)
    try
        project = PaperProjects.load_project(path)
        export_warnings = _validate_for_export(project)
        title = get(project, "title", "Untitled")
        title_str = title isa AbstractString ? title : "Untitled"
        body = _project_to_pdf_body(project)
        if output_path === nothing
            safe_title = replace(lowercase(strip(title_str)), r"[^a-z0-9]+" => "-")
            safe_title = replace(safe_title, r"^-|-$" => "")
            isempty(safe_title) && (safe_title = "paper")
            output_path = joinpath(homedir(), "Documents", "$safe_title.pdf")
        end
        PDFGen.write_pdf(output_path, title_str, body; columns=columns)
        _ok(Dict(
            "path" => output_path,
            "columns" => columns,
            "title" => title_str,
            "sections" => length(get(project, "sections", Any[])),
            "warnings" => export_warnings,
            "renderer" => "PDFGen",
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

# ── Search provenance ─────────────────────────────────────────────────────────

function _add_search_source(args)
    length(args) >= 3 || return _err("InvalidArgument", "paper project path/handle, search URL, and query are required")
    path, error = _paper_project_scope(args[1])
    error === nothing || return _err(error...)
    search_url = args[2]
    search_url isa AbstractString && !isempty(strip(search_url)) ||
        return _err("InvalidArgument", "search URL must be non-empty text")
    query = args[3]
    query isa AbstractString && !isempty(strip(query)) ||
        return _err("InvalidArgument", "query must be non-empty text")
    provider = length(args) >= 4 && args[4] isa AbstractString ? args[4] : ""
    capture_date = length(args) >= 5 && args[5] isa AbstractString ? args[5] : string(Dates.now())
    try
        project = PaperProjects.load_project(path)
        provenance = get(project, "provenance", Dict{String,Any}())
        search_sources = get(provenance, "searchSources", Any[])
        new_source = Dict{String,Any}(
            "url" => String(search_url),
            "query" => String(query),
            "provider" => String(provider),
            "captureDate" => String(capture_date),
            "addedAt" => string(Dates.now()),
        )
        push!(search_sources, new_source)
        provenance["searchSources"] = search_sources
        project["provenance"] = provenance
        saved = PaperProjects.save_project!(path, project)
        handle, _ = _handle_path(args[1])
        handle === nothing && (handle = _new_paper_project_handle(path))
        _ok(_paper_result(path, saved, handle))
    catch exception
        _paper_error(exception)
    end
end

function _add_media_source(args)
    length(args) >= 2 || return _err("InvalidArgument", "paper project path/handle and media path are required")
    path, error = _paper_project_scope(args[1])
    error === nothing || return _err(error...)
    media_path = args[2]
    media_path isa AbstractString && !isempty(strip(media_path)) ||
        return _err("InvalidArgument", "media path must be non-empty text")
    source_url = length(args) >= 3 && args[3] isa AbstractString ? args[3] : ""
    license_text = length(args) >= 4 && args[4] isa AbstractString ? args[4] : ""
    kind = length(args) >= 5 && args[5] isa AbstractString ? args[5] : "unknown"
    try
        # Validate media path is readable
        authorized_path, auth_error = _validated_path(_validate_read_path, media_path, "Media source")
        auth_error === nothing || return auth_error
        project = PaperProjects.load_project(path)
        provenance = get(project, "provenance", Dict{String,Any}())
        media_sources = get(provenance, "mediaSources", Any[])
        new_source = Dict{String,Any}(
            "path" => String(media_path),
            "sourceUrl" => String(source_url),
            "license" => String(license_text),
            "kind" => String(kind),
            "addedAt" => string(Dates.now()),
        )
        push!(media_sources, new_source)
        provenance["mediaSources"] = media_sources
        project["provenance"] = provenance
        saved = PaperProjects.save_project!(path, project)
        handle, _ = _handle_path(args[1])
        handle === nothing && (handle = _new_paper_project_handle(path))
        _ok(_paper_result(path, saved, handle))
    catch exception
        _paper_error(exception)
    end
end

function _get_search_sources(args)
    length(args) >= 1 || return _err("InvalidArgument", "paper project path or handle is required")
    path, error = _paper_project_scope(args[1])
    error === nothing || return _err(error...)
    try
        project = PaperProjects.load_project(path)
        provenance = get(project, "provenance", Dict{String,Any}())
        search_sources = get(provenance, "searchSources", Any[])
        _ok(Dict("searchSources" => search_sources, "count" => length(search_sources)))
    catch exception
        _paper_error(exception)
    end
end
