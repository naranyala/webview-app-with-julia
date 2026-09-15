"""Versioned, atomic storage and validation for academic paper projects."""
module PaperProjects

using Dates
using SHA
using JSON3
using ..Persistence

export PROJECT_FILENAME, SCHEMA_VERSION, PaperProjectError, create_project!,
    REPRODUCIBILITY_FILENAME, content_hash, load_project, migrate_project, normalize_project,
    reproducibility_manifest, save_project!, save_reproducibility!, validate_project

const SCHEMA_VERSION = 1
const PROJECT_FILENAME = "paper.json"
const REPRODUCIBILITY_FILENAME = joinpath(".app", "reproducibility.json")
const MAX_PROJECT_BYTES = 16 * 1024 * 1024
const MAX_TITLE = 500
const MAX_BODY = 4 * 1024 * 1024

struct PaperProjectError <: Exception
    code::Symbol
    detail::String
end

Base.showerror(io::IO, error::PaperProjectError) = print(io, error.detail)

_objects(value) = value isa AbstractVector ? Any[
    item isa AbstractDict ? Persistence.normalize_json(item) : item for item in value
] : Any[]
_strings(value) = value isa AbstractVector ? String[
    item for item in value if item isa AbstractString
] : String[]
_text(value, default="") = value isa AbstractString ? String(value) : default

# Hash a canonical JSON projection so key insertion order cannot change the
# identity of a project or any future reproducibility record that embeds it.
function _canonical_json(value)
    if value isa AbstractDict
        return Dict{String,Any}(
            string(key) => _canonical_json(value[key]) for key in sort!(collect(keys(value)); by=string)
        )
    elseif value isa AbstractVector
        return Any[_canonical_json(item) for item in value]
    end
    value
end

function content_hash(value)
    data = Vector{UInt8}(codeunits(JSON3.write(_canonical_json(value))))
    bytes2hex(SHA.sha256(data))
end

_hash_bytes(value) = content_hash(value)

function _migrate_v0_to_v1(input)
    migrated = copy(input)
    !haskey(migrated, "references") && haskey(migrated, "bibliography") &&
        (migrated["references"] = migrated["bibliography"])
    !haskey(migrated, "supplementaryMaterial") && haskey(migrated, "supplementary") &&
        (migrated["supplementaryMaterial"] = migrated["supplementary"])
    !haskey(migrated, "extensionState") && get(migrated, "extensions", nothing) isa AbstractDict &&
        (migrated["extensionState"] = migrated["extensions"])
    get(migrated, "template", nothing) isa AbstractString &&
        (migrated["template"] = Dict("id" => migrated["template"], "version" => "1"))
    !haskey(migrated, "exportProfiles") && get(migrated, "exportProfile", nothing) isa AbstractDict &&
        (migrated["exportProfiles"] = Any[migrated["exportProfile"]])
    migrated["schemaVersion"] = 1
    migrated
end

function migrate_project(value)
    value isa AbstractDict || throw(PaperProjectError(:invalid, "paper project must be an object"))
    input = Persistence.normalize_json(value)
    version = get(input, "schemaVersion", 0)
    version isa Integer || throw(PaperProjectError(:invalid, "paper project schemaVersion must be an integer"))
    version >= 0 || throw(PaperProjectError(:invalid, "paper project schemaVersion must not be negative"))
    version <= SCHEMA_VERSION || throw(PaperProjectError(
        :unsupported,
        "paper project schema version $version is newer than $SCHEMA_VERSION",
    ))
    while version < SCHEMA_VERSION
        if version == 0
            input = _migrate_v0_to_v1(input)
        else
            throw(PaperProjectError(:unsupported, "no migration is available from paper project schema $version"))
        end
        version = input["schemaVersion"]
    end
    input
end

function normalize_project(value)
    input = migrate_project(value)
    project = Dict{String,Any}(
        "schemaVersion" => SCHEMA_VERSION,
        "id" => _text(get(input, "id", "")),
        "title" => _text(get(input, "title", "Untitled paper"), "Untitled paper"),
        "subtitle" => _text(get(input, "subtitle", "")),
        "authors" => _objects(get(input, "authors", Any[])),
        "affiliations" => _objects(get(input, "affiliations", Any[])),
        "venue" => _text(get(input, "venue", "")),
        "year" => _text(get(input, "year", "")),
        "status" => _text(get(input, "status", "draft"), "draft"),
        "abstract" => _text(get(input, "abstract", "")),
        "keywords" => _strings(get(input, "keywords", Any[])),
        "sections" => _objects(get(input, "sections", Any[])),
        "references" => _objects(get(input, "references", Any[])),
        "figures" => _objects(get(input, "figures", Any[])),
        "tables" => _objects(get(input, "tables", Any[])),
        "supplementaryMaterial" => _objects(get(input, "supplementaryMaterial", Any[])),
        "template" => get(input, "template", nothing) isa AbstractDict ?
            Persistence.normalize_json(input["template"]) : Dict("id" => "default", "version" => "1"),
        "exportProfiles" => _objects(get(input, "exportProfiles", Any[])),
        "extensionState" => get(input, "extensionState", nothing) isa AbstractDict ?
            Persistence.normalize_json(input["extensionState"]) : Dict{String,Any}(),
        "provenance" => get(input, "provenance", nothing) isa AbstractDict ?
            Persistence.normalize_json(input["provenance"]) : Dict{String,Any}(),
    )
    project
end

function _duplicate_errors(items, kind, key)
    errors = String[]
    seen = Set{String}()
    for (index, item) in enumerate(items)
        item isa AbstractDict || continue
        id = get(item, key, nothing)
        id isa AbstractString && !isempty(id) || continue
        if id in seen
            push!(errors, "duplicate $kind $key: $id")
        else
            push!(seen, id)
        end
    end
    errors
end

function validate_project(value)
    project = try
        normalize_project(value)
    catch error
        return Dict("valid" => false, "errors" => [sprint(showerror, error)],
            "warnings" => String[], "project" => nothing)
    end
    errors = String[]
    warnings = String[]
    id = project["id"]
    isempty(id) && push!(errors, "paper id is required")
    !isempty(id) && !occursin(r"^[a-z0-9][a-z0-9-]*$", id) &&
        push!(errors, "paper id must be a lowercase slug")
    title = project["title"]
    isempty(strip(title)) && push!(errors, "paper title is required")
    ncodeunits(title) > MAX_TITLE && push!(errors, "paper title is too long")
    project["status"] in ("draft", "final") || push!(errors, "paper status must be draft or final")

    authors = project["authors"]
    isempty(authors) && push!(errors, "paper needs at least one author")
    for (index, author) in enumerate(authors)
        author isa AbstractDict && get(author, "name", nothing) isa AbstractString &&
            !isempty(strip(author["name"])) || push!(errors, "author $index needs a name")
    end
    sections = project["sections"]
    isempty(sections) && push!(errors, "paper needs at least one section")
    for (index, section) in enumerate(sections)
        section isa AbstractDict || (push!(errors, "section $index must be an object"); continue)
        get(section, "id", nothing) isa AbstractString && !isempty(section["id"]) ||
            push!(errors, "section $index needs an id")
        get(section, "title", nothing) isa AbstractString && !isempty(section["title"]) ||
            push!(errors, "section $index needs a title")
        body = get(section, "body", nothing)
        body isa AbstractString || push!(errors, "section $index needs a body")
        body isa AbstractString && ncodeunits(body) > MAX_BODY && push!(errors, "section $index body is too large")
    end
    append!(errors, _duplicate_errors(sections, "section", "id"))
    append!(errors, _duplicate_errors(project["references"], "reference", "key"))
    append!(errors, _duplicate_errors(project["figures"], "figure", "id"))
    append!(errors, _duplicate_errors(project["tables"], "table", "id"))

    template = project["template"]
    isempty(_text(get(template, "id", ""))) && push!(errors, "template id is required")
    isempty(_text(get(template, "version", ""))) && push!(errors, "template version is required")
    isempty(project["exportProfiles"]) && push!(warnings, "paper has no export profiles")
    Dict("valid" => isempty(errors), "errors" => errors, "warnings" => warnings, "project" => project)
end

_store(directory) = Persistence.Store(joinpath(directory, PROJECT_FILENAME);
    schema_version=SCHEMA_VERSION, max_bytes=MAX_PROJECT_BYTES)

function _validated(value)
    result = validate_project(value)
    result["valid"] || throw(PaperProjectError(:invalid, join(result["errors"], "; ")))
    result["project"]
end

function reproducibility_manifest(value; app_version="0.1.0", plugins=Any[],
                                  toolchain=Dict("julia" => string(VERSION)),
                                  profile=nothing, input_hashes=Dict{String,String}(),
                                  output_hashes=Dict{String,String}(), warnings=String[])
    project = _validated(value)
    Dict{String,Any}(
        "schemaVersion" => 1,
        "generatedAt" => string(Dates.now()),
        "appVersion" => String(app_version),
        "projectSchemaVersion" => SCHEMA_VERSION,
        "projectId" => project["id"],
        "projectHash" => _hash_bytes(project),
        "inputHashes" => Dict{String,String}(String(key) => String(item) for (key, item) in pairs(input_hashes)),
        "outputHashes" => Dict{String,String}(String(key) => String(item) for (key, item) in pairs(output_hashes)),
        "plugins" => Persistence.normalize_json(plugins),
        "toolchain" => Persistence.normalize_json(toolchain),
        "profile" => profile === nothing ? Dict("template" => project["template"]) : Persistence.normalize_json(profile),
        "warnings" => String[String(item) for item in warnings],
    )
end

function save_reproducibility!(directory::AbstractString, value;
                               input_hashes=Dict{String,String}(), kwargs...)
    isdir(directory) || throw(PaperProjectError(:not_found, "paper project was not found: $directory"))
    project = _validated(value)
    paper_path = joinpath(directory, PROJECT_FILENAME)
    merged_input_hashes = Dict{String,String}(String(key) => String(item) for (key, item) in pairs(input_hashes))
    isfile(paper_path) && (merged_input_hashes[PROJECT_FILENAME] = _hash_bytes(read(paper_path, String)))
    manifest = reproducibility_manifest(project; input_hashes=merged_input_hashes, kwargs...)
    Persistence.atomic_write!(joinpath(directory, REPRODUCIBILITY_FILENAME), JSON3.write(manifest))
    manifest
end

function create_project!(directory::AbstractString, value)
    ispath(directory) && throw(PaperProjectError(:exists, "paper project already exists: $directory"))
    mkpath(directory)
    try
        project = _validated(value)
        Persistence.save!(_store(directory), project)
        save_reproducibility!(directory, project)
        project
    catch
        isdir(directory) && isempty(readdir(directory)) && rm(directory)
        rethrow()
    end
end

function load_project(directory::AbstractString)
    isdir(directory) || throw(PaperProjectError(:not_found, "paper project was not found: $directory"))
    path = joinpath(directory, PROJECT_FILENAME)
    isfile(path) || throw(PaperProjectError(:not_found, "paper project manifest was not found: $path"))
    value = Persistence.load(_store(directory))
    _validated(value)
end

function save_project!(directory::AbstractString, value)
    isdir(directory) || throw(PaperProjectError(:not_found, "paper project was not found: $directory"))
    project = _validated(value)
    Persistence.save!(_store(directory), project)
    save_reproducibility!(directory, project)
    project
end

end
