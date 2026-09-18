"""
    ErrorCodes

Centralized error-code registry. Every user-facing error code is defined here
with its category, recoverability, and description. This replaces the ad-hoc
string matching in `_error_category` and `_recoverable_error`.

Usage:
    ErrorCodes.lookup("PaperProjectNotFound")  # => (category="filesystem", recoverable=true, ...)
    ErrorCodes.category("StorageCorrupt")       # => "storage"
    ErrorCodes.recoverable("InternalError")     # => false
"""
module ErrorCodes

export lookup, category, recoverable, all_codes, describe

const SCHEMA_VERSION = 1

struct ErrorCode
    code::String
    category::String
    is_recoverable::Bool
    description::String
end

# ── Registry ──────────────────────────────────────────────────────────────────

const _REGISTRY = Dict{String,ErrorCode}()

function _register(code, cat, rec, desc)
    _REGISTRY[code] = ErrorCode(code, cat, rec, desc)
end

# Internal / infrastructure
_register("InternalError",          "internal",     false, "An unexpected backend error occurred")
_register("UnknownBinding",         "capability",   true,  "No handler for the requested binding")
_register("Unavailable",            "capability",   true,  "A required backend capability is unavailable")
_register("BackendUnavailable",     "capability",   true,  "A backend service is unavailable")

# Validation
_register("InvalidArgument",        "validation",   true,  "An argument is missing or has an invalid type")
_register("MalformedJson",          "validation",   true,  "The request payload is not valid JSON")
_register("PayloadTooLarge",        "validation",   true,  "The request payload exceeds the size limit")

# Storage
_register("StorageCorrupt",         "storage",      false, "The stored data is corrupted")
_register("StorageTooLarge",        "storage",      true,  "The stored data exceeds the size limit")
_register("StorageUnsupported",     "storage",      true,  "The storage schema version is unsupported")
_register("StorageUnavailable",     "storage",      true,  "The storage backend is unavailable")
_register("StorageWriteFailed",     "storage",      true,  "A storage write operation failed")

# Filesystem / paths
_register("PathMissing",            "filesystem",   true,  "The requested path does not exist")
_register("PathNotAllowed",         "filesystem",   false, "The path is outside the allowed workspace")
_register("PathUnavailable",        "filesystem",   true,  "The path could not be resolved")
_register("PathNotFound",           "filesystem",   true,  "The path was not found")

# Paper projects
_register("InvalidPaperProject",    "validation",   true,  "The paper project data is invalid")
_register("PaperProjectExists",     "validation",   true,  "A paper project already exists at this path")
_register("PaperProjectNotFound",   "filesystem",   true,  "The paper project was not found")
_register("PaperProjectUnsupported","validation",   true,  "The paper project schema version is unsupported")
_register("PaperProjectFailed",     "application",  true,  "The paper project operation failed")
_register("PaperProjectCorrupt",    "storage",      false, "The paper project data is corrupted")
_register("PaperProjectTooLarge",   "storage",      true,  "The paper project exceeds the size limit")
_register("PaperProjectWriteFailed","storage",      true,  "The paper project write operation failed")
_register("PaperProjectHandleNotFound","filesystem", true, "The paper project handle is no longer valid")

# Audio
_register("InvalidAudioInput",      "validation",   true,  "The audio input is invalid")
_register("InvalidAudio",           "validation",   true,  "The audio file is invalid")
_register("AudioTooLarge",          "validation",   true,  "The audio file exceeds the size limit")
_register("UnsupportedAudioFormat", "capability",   true,  "The audio format is not supported")

# Jobs
_register("JobLimitReached",        "resource",     true,  "The job manager has reached its capacity")
_register("AssetJobNotFound",       "filesystem",   true,  "The asset scan job was not found")
_register("AssetVolumeNotFound",    "filesystem",   true,  "The requested volume was not found")
_register("AudioJobNotFound",       "filesystem",   true,  "The audio analysis job was not found")

# Media
_register("MediaNotFound",          "filesystem",   true,  "The media file was not found")
_register("MediaTooLarge",          "validation",   true,  "The media file exceeds the size limit")
_register("UnsupportedMediaFormat", "capability",   true,  "The media format is not supported")
_register("MediaConversionFailed",  "application",  true,  "The media conversion operation failed")
_register("MediaJobNotFound",       "filesystem",   true,  "The media conversion job was not found")
_register("ConversionRequiresJob",  "validation",   true,  "External conversions must use startMediaConversion")
_register("DirectoryReadFailed",    "filesystem",   true,  "Could not read the directory")

# BibTeX
_register("InvalidBibTeX",          "validation",   true,  "The BibTeX source is invalid")
_register("BibTeXTooLarge",         "validation",   true,  "The BibTeX source exceeds the size limit")
_register("BibliographyExportFailed","storage",     true,  "The bibliography export failed")

# Blend
_register("InvalidBlendFile",       "validation",   true,  "The Blender file is invalid or corrupted")

# ── Public API ────────────────────────────────────────────────────────────────

"""
    lookup(code) -> (category, recoverable, description)

Look up an error code and return its metadata. Returns `nothing` for unknown codes.
"""
function lookup(code::AbstractString)
    entry = get(_REGISTRY, String(code), nothing)
    entry === nothing && return nothing
    (category=entry.category, recoverable=entry.is_recoverable, description=entry.description)
end

"""
    category(code) -> String

Return the error category for a code. Falls back to `"application"` for unknown codes.
"""
function category(code::AbstractString)
    entry = get(_REGISTRY, String(code), nothing)
    entry === nothing ? "application" : entry.category
end

"""
    recoverable(code) -> Bool

Return whether an error is recoverable. Falls back to `true` for unknown codes
(except "InternalError" which is always false).
"""
function recoverable(code::AbstractString)
    code == "InternalError" && return false
    entry = get(_REGISTRY, String(code), nothing)
    entry === nothing ? true : entry.is_recoverable
end

"""
    describe(code) -> String

Return a human-readable description for an error code.
"""
function describe(code::AbstractString)
    entry = get(_REGISTRY, String(code), nothing)
    entry === nothing ? "An error occurred" : entry.description
end

"""
    all_codes() -> Vector{Dict{String,Any}}

Return all registered error codes with their metadata.
"""
function all_codes()
    entries = sort!(collect(values(_REGISTRY)); by=e -> e.code)
    [Dict{String,Any}(
        "code" => e.code,
        "category" => e.category,
        "recoverable" => e.is_recoverable,
        "description" => e.description,
    ) for e in entries]
end

end
