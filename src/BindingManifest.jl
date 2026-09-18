"""Versioned contract for bindings shared by the frontend and desktop host."""
module BindingManifest

export SCHEMA_VERSION, frontend_bindings, window_bindings, manifest,
    validate, required_bindings

const SCHEMA_VERSION = 1
const _FRONTEND = [
    "addBibTeXToProject", "cancelAssetScan", "cancelAudioAnalysis", "clearDiagnostics",
    "createNote", "createPaperProject", "deleteNote", "exportPaperProject",
    "generatePdf", "getAssetScanStatus", "getAudioAnalysisStatus", "getAudioMetadata",
    "getDiagnostics", "getMediaCapabilities", "getNotes", "getSettings", "inspectMedia",
    "listDirectory", "listVolumes", "markdownToHtml", "openPaperProject", "parseBibTeX",
    "planConversion", "savePaperProject", "saveSettings", "startAssetScan",
    "startAudioAnalysis", "updateNote", "validatePaperProject",
]
const _WINDOW = ["minimizeWindow", "maximizeWindow", "restoreWindow", "closeWindow"]

frontend_bindings() = copy(_FRONTEND)
window_bindings() = copy(_WINDOW)

function manifest(handler_names)
    handlers = sort!(unique(String.(handler_names)))
    Dict{String,Any}("schemaVersion" => SCHEMA_VERSION,
        "frontend" => frontend_bindings(), "backend" => handlers,
        "window" => window_bindings(),
        "all" => sort!(unique(vcat(handlers, window_bindings()))))
end

function validate(handler_names)
    backend = Set(String.(handler_names))
    frontend = Set(_FRONTEND)
    missing = sort!(collect(setdiff(frontend, backend)))
    Dict{String,Any}("schemaVersion" => SCHEMA_VERSION,
        "missingFrontend" => missing,
        "unusedBackend" => sort!(collect(setdiff(backend, frontend))),
        "valid" => isempty(missing))
end

required_bindings(handler_names) = manifest(handler_names)["all"]
end
