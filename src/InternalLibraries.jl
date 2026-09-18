"""
    InternalLibraries

The package-shaped seams that may become standalone Julia libraries later.
This catalog is intentionally metadata-only: it does not duplicate or alias
implementation modules, so there is one source of truth while the extraction
work is staged. Each entry names the current module, its reusable responsibility,
and the boundary that must be stable before moving it to another repository.
"""
module InternalLibraries

export catalog, candidate_ids, candidate

const _CATALOG = [
    Dict{String,Any}(
        "id" => "atomic-stores",
        "module" => "Persistence",
        "source" => "src/Persistence.jl",
        "role" => "versioned JSON stores and atomic file replacement",
        "api" => ["Store", "load", "save!", "atomic_write!", "StorageError"],
        "extraction" => "ready-after-contract-tests",
    ),
    Dict{String,Any}(
        "id" => "cooperative-jobs",
        "module" => "Jobs",
        "source" => "src/Jobs.jl",
        "role" => "thread-safe progress, cancellation, retention, and correlation",
        "api" => ["JobManager", "create_job!", "update_job!", "cancel_job!", "snapshot"],
        "extraction" => "ready-after-dto-stabilization",
    ),
    Dict{String,Any}(
        "id" => "structured-diagnostics",
        "module" => "Diagnostics",
        "source" => "src/Diagnostics.jl",
        "role" => "bounded JSONL diagnostics with rotation and recent retrieval",
        "api" => ["configure!", "record!", "recent", "clear!"],
        "extraction" => "needs-redaction-and-recovery",
    ),
    Dict{String,Any}(
        "id" => "workspace-sandbox",
        "module" => "WorkspacePolicy",
        "source" => "src/WorkspacePolicy.jl",
        "role" => "canonical path authorization and stable policy errors",
        "api" => ["canonical_roots", "authorize_read_file", "authorize_write_file", "authorize_project"],
        "extraction" => "needs-race-hardening",
    ),
    Dict{String,Any}(
        "id" => "bibtex",
        "module" => "BibTeX",
        "source" => "src/bibtex/BibTeX.jl",
        "role" => "dependency-light BibTeX parsing and deterministic writing",
        "api" => ["BibEntry", "parse_bibtex", "read_bibtex", "write_bibtex"],
        "extraction" => "ready-after-fixture-expansion",
    ),
    Dict{String,Any}(
        "id" => "research-document-model",
        "module" => "PaperProjects",
        "source" => "src/PaperProjects.jl",
        "role" => "versioned scholarly document schema, validation, and reproducibility",
        "api" => ["normalize_project", "validate_project", "migrate_project", "reproducibility_manifest"],
        "extraction" => "needs-provenance-and-schema-stability",
    ),
    Dict{String,Any}(
        "id" => "renderer-capabilities",
        "module" => "RendererCapability",
        "source" => "src/RendererCapability.jl",
        "role" => "versioned renderer feature negotiation and degradation warnings",
        "api" => ["CapabilityReport", "check_capability", "merge_reports", "list_capabilities"],
        "extraction" => "ready-after-backend-adoption",
    ),
]

candidate_ids() = String[String(item["id"]) for item in _CATALOG]

"""Return detached metadata for all proposed internal library seams."""
catalog() = deepcopy(_CATALOG)

"""Return one candidate by id, or `nothing` when it is not cataloged."""
function candidate(id::AbstractString)
    item = findfirst(item -> item["id"] == String(id), _CATALOG)
    item === nothing ? nothing : deepcopy(_CATALOG[item])
end

end
