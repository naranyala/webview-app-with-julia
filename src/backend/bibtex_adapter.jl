# ── BibTeX adapter for paper projects ─────────────────────────────────────────

const MAX_BIBTEX_BYTES = 4 * 1024 * 1024

function _bib_entry_to_dict(entry::BibTeX.BibEntry)
    Dict{String,Any}(
        "key" => entry.key,
        "type" => entry.entry_type,
        "fields" => Dict{String,String}(k => v for (k, v) in entry.fields),
    )
end

function _parse_bibtex(args)
    length(args) >= 1 || return _err("InvalidArgument", "BibTeX source is required")
    source = args[1]
    source isa AbstractString || return _err("InvalidArgument", "BibTeX source must be text")
    ncodeunits(source) > MAX_BIBTEX_BYTES &&
        return _err("BibTeXTooLarge", "BibTeX source exceeds the $(MAX_BIBTEX_BYTES)-byte limit")
    try
        entries = BibTeX.parse_bibtex(source)
        _ok(Dict{String,Any}(
            "entries" => Any[_bib_entry_to_dict(e) for e in entries],
            "count" => length(entries),
        ))
    catch error
        _err("InvalidBibTeX", sprint(showerror, error))
    end
end

function _import_bibliography(args)
    length(args) >= 1 || return _err("InvalidArgument", "Bibliography path is required")
    path, path_error = _validate_read_path(args[1], "Bibliography")
    path_error !== nothing && return _err(path_error...)
    try
        entries = BibTeX.read_bibtex(path)
        _ok(Dict{String,Any}(
            "path" => path,
            "entries" => Any[_bib_entry_to_dict(e) for e in entries],
            "count" => length(entries),
        ))
    catch error
        _err("InvalidBibTeX", sprint(showerror, error))
    end
end

function _export_bibliography(args)
    length(args) >= 2 || return _err("InvalidArgument", "Output path and entries are required")
    path, path_error = _validate_write_path(args[1], "Bibliography output")
    path_error !== nothing && return _err(path_error...)
    entries_data = args[2]
    entries_data isa AbstractVector || return _err("InvalidArgument", "entries must be an array")
    try
        entries = BibTeX.BibEntry[]
        for item in entries_data
            item isa AbstractDict || continue
            key = get(item, "key", "")
            entry_type = get(item, "type", "misc")
            fields = Dict{String,String}()
            raw_fields = get(item, "fields", nothing)
            if raw_fields isa AbstractDict
                for (k, v) in raw_fields
                    v isa AbstractString && (fields[string(k)] = v)
                end
            end
            isempty(key) && continue
            push!(entries, BibTeX.BibEntry(String(entry_type), String(key), fields))
        end
        output = BibTeX.write_bibtex(entries)
        write(path, output)
        _ok(Dict{String,Any}("path" => path, "entries" => length(entries), "bytes" => ncodeunits(output)))
    catch error
        _err("BibTeXWriteFailed", sprint(showerror, error))
    end
end

function _add_bibtex_to_project(args)
    length(args) >= 2 || return _err("InvalidArgument", "Project handle and BibTeX source are required")
    project_path, path_error = _paper_project_scope(args[1])
    path_error !== nothing && return _err(path_error...)
    source = args[2]
    source isa AbstractString || return _err("InvalidArgument", "BibTeX source must be text")
    ncodeunits(source) > MAX_BIBTEX_BYTES &&
        return _err("BibTeXTooLarge", "BibTeX source exceeds the $(MAX_BIBTEX_BYTES)-byte limit")
    try
        project = PaperProjects.load_project(project_path)
        entries = BibTeX.parse_bibtex(source)
        new_refs = Any[]
        for entry in entries
            push!(new_refs, Dict{String,Any}(
                "key" => entry.key,
                "text" => _format_bib_reference(entry),
                "type" => entry.entry_type,
                "fields" => Dict{String,String}(k => v for (k, v) in entry.fields),
            ))
        end
        existing_keys = Set{String}()
        for ref in project["references"]
            ref isa AbstractDict && haskey(ref, "key") && push!(existing_keys, String(ref["key"]))
        end
        warnings = String[]
        added = 0
        for ref in new_refs
            if ref["key"] in existing_keys
                push!(warnings, "duplicate reference key skipped: $(ref["key"])")
            else
                push!(project["references"], ref)
                push!(existing_keys, ref["key"])
                added += 1
            end
        end
        PaperProjects.save_project!(project_path, project)
        handle, _ = _handle_path(args[1])
        handle === nothing && (handle = _new_paper_project_handle(project_path))
        _ok(Dict{String,Any}(
            "path" => project_path,
            "projectHandle" => handle,
            "added" => added,
            "duplicates" => length(new_refs) - added,
            "totalReferences" => length(project["references"]),
            "warnings" => warnings,
            "project" => project,
            "reproducibility" => _paper_reproducibility(project_path, project),
        ))
    catch error
        _paper_error(error)
    end
end

function _format_bib_reference(entry::BibTeX.BibEntry)
    parts = String[]
    author = get(entry.fields, "author", "")
    if !isempty(author)
        push!(parts, strip(author))
    end
    title = get(entry.fields, "title", "")
    if !isempty(title)
        push!(parts, strip(title))
    end
    year = get(entry.fields, "year", "")
    journal = get(entry.fields, "journal", nothing)
    booktitle = get(entry.fields, "booktitle", nothing)
    venue = journal !== nothing ? strip(journal) : (booktitle !== nothing ? strip(booktitle) : "")
    if !isempty(venue) && !isempty(year)
        push!(parts, "$(venue) $(year)")
    elseif !isempty(year)
        push!(parts, year)
    end
    isempty(parts) && return entry.key
    join(parts, ". ") * "."
end
