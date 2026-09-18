"""
    RendererCapability

Declares which Markdown, citation, figure, table, font, and layout features
each PDF/media backend supports. Exporters must check capabilities before
rendering and emit warnings rather than silently degrading.
"""
module RendererCapability

export CapabilityReport, check_capability, supported_features, merge_reports

const SCHEMA_VERSION = 1

"""
    CapabilityReport

A versioned record of what a renderer backend supports. Each field is a set
of feature strings. An empty set means the feature is not supported.
"""
struct CapabilityReport
    schema_version::Int
    backend::String
    version::String
    markdown::Set{String}
    citations::Set{String}
    figures::Set{String}
    tables::Set{String}
    fonts::Set{String}
    layout::Set{String}
end

function CapabilityReport(;
    backend::AbstractString="unknown",
    version::AbstractString="0.0.0",
    markdown=Set{String}(),
    citations=Set{String}(),
    figures=Set{String}(),
    tables=Set{String}(),
    fonts=Set{String}(),
    layout=Set{String}(),
)
    CapabilityReport(SCHEMA_VERSION, String(backend), String(version),
        Set{String}(markdown), Set{String}(citations), Set{String}(figures),
        Set{String}(tables), Set{String}(fonts), Set{String}(layout))
end

function _to_dict(report::CapabilityReport)
    Dict{String,Any}(
        "schemaVersion" => report.schema_version,
        "backend" => report.backend,
        "version" => report.version,
        "markdown" => sort!(collect(report.markdown)),
        "citations" => sort!(collect(report.citations)),
        "figures" => sort!(collect(report.figures)),
        "tables" => sort!(collect(report.tables)),
        "fonts" => sort!(collect(report.fonts)),
        "layout" => sort!(collect(report.layout)),
    )
end

"""
    check_capability(report, category, feature) -> (supported::Bool, warnings::Vector{String})

Check whether a specific feature is supported in a given category. Returns
a tuple of (supported, warnings). Warnings explain what will be silently
omitted or degraded if the feature is missing.
"""
function check_capability(report::CapabilityReport, category::AbstractString, feature::AbstractString)
    features = if category == "markdown"
        report.markdown
    elseif category == "citations"
        report.citations
    elseif category == "figures"
        report.figures
    elseif category == "tables"
        report.tables
    elseif category == "fonts"
        report.fonts
    elseif category == "layout"
        report.layout
    else
        return false, ["unknown capability category: $category"]
    end
    if String(feature) in features
        return true, String[]
    end
    false, ["$(report.backend) does not support $category.$feature; it will be omitted or degraded"]
end

"""
    supported_features(report) -> Dict{String,Vector{String}}

Return all supported features grouped by category.
"""
function supported_features(report::CapabilityReport)
    Dict{String,Vector{String}}(
        "markdown" => sort!(collect(report.markdown)),
        "citations" => sort!(collect(report.citations)),
        "figures" => sort!(collect(report.figures)),
        "tables" => sort!(collect(report.tables)),
        "fonts" => sort!(collect(report.fonts)),
        "layout" => sort!(collect(report.layout)),
    )
end

"""
    merge_reports(reports...) -> CapabilityReport

Merge multiple capability reports. The result supports the intersection of
all reports (only features supported by ALL reports are included).
"""
function merge_reports(reports::CapabilityReport...)
    isempty(reports) && return CapabilityReport()
    first_report = reports[1]
    backend_names = join([r.backend for r in reports], "+")
    versions = join([r.version for r in reports], "+")
    merged_md = copy(first_report.markdown)
    merged_cit = copy(first_report.citations)
    merged_fig = copy(first_report.figures)
    merged_tbl = copy(first_report.tables)
    merged_fnt = copy(first_report.fonts)
    merged_lay = copy(first_report.layout)
    for r in reports[2:end]
        intersect!(merged_md, r.markdown)
        intersect!(merged_cit, r.citations)
        intersect!(merged_fig, r.figures)
        intersect!(merged_tbl, r.tables)
        intersect!(merged_fnt, r.fonts)
        intersect!(merged_lay, r.layout)
    end
    CapabilityReport(backend=backend_names, version=versions,
        markdown=merged_md, citations=merged_cit, figures=merged_fig,
        tables=merged_tbl, fonts=merged_fnt, layout=merged_lay)
end

"""
    pdfgen_capability() -> CapabilityReport

Return the capability report for the built-in PDFGen.jl renderer.
"""
function pdfgen_capability()
    CapabilityReport(
        backend="PDFGen",
        version="0.1.0",
        markdown=Set{String}(["headings", "bold", "plain-text"]),
        citations=Set{String}(["plain-text"]),
        figures=Set{String}(),
        tables=Set{String}(),
        fonts=Set{String}(["helvetica", "helvetica-bold"]),
        layout=Set{String}(["single-column", "two-column", "word-wrap", "pagination"]),
    )
end

"""
    report_to_dict(report) -> Dict{String,Any}

Serialize a capability report to a JSON-friendly dictionary.
"""
report_to_dict(report::CapabilityReport) = _to_dict(report)

"""
    list_capabilities() -> Vector{Dict{String,Any}}

Return capability reports for all known backends.
"""
function list_capabilities()
    [report_to_dict(pdfgen_capability())]
end

end
