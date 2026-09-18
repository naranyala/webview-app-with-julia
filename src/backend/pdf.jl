# ── PDF ──────────────────────────────────────────────────────────────────────

function _save_pdf(args)
    length(args) >= 2 || return _err("InvalidArgument", "Filename and PDF data are required")
    filename, data_b64 = args[1], args[2]
    filename isa AbstractString || return _err("InvalidPdfName", "Filename must be text")
    data_b64 isa AbstractString || return _err("PdfDecodeFailed", "PDF data must be text")

    # Validate and sanitize filename
    isempty(filename) && return _err("InvalidPdfName", "Filename is required")
    !occursin(r"^[A-Za-z0-9][A-Za-z0-9._\-]{0,95}\.pdf$"i, filename) &&
        return _err("InvalidPdfName", "Filename must be alphanumeric with .pdf extension")

    dir = joinpath(homedir(), "Documents")
    path = _safe_path(dir, filename)
    path === nothing && return _err("InvalidPdfName", "Path traversal not allowed")

    ncodeunits(data_b64) <= ceil(Int, MAX_PDF_BYTES * 4 / 3) + 4 ||
        return _err("PdfTooLarge", "PDF data exceeds the $(MAX_PDF_BYTES)-byte limit")

    try
        bytes = base64decode(data_b64)
        length(bytes) <= MAX_PDF_BYTES || return _err("PdfTooLarge", "PDF exceeds the $(MAX_PDF_BYTES)-byte limit")
        Persistence.atomic_write!(path, bytes)
        _ok(Dict("path" => path, "size" => length(bytes)))
    catch e
        _err("PdfWriteFailed", "Failed to write PDF: $(sprint(showerror, e))")
    end
end
function _generate_pdf(args)
    length(args) >= 3 || return _err("InvalidArgument", "Filename, title, and body are required")
    all(value -> value isa AbstractString, args[1:3]) ||
        return _err("InvalidArgument", "Filename, title, and body must be text")
    filename, title, body = args[1], args[2], args[3]
    ncodeunits(body) <= MAX_NOTE_BODY ||
        return _err("PdfTooLarge", "PDF body exceeds the $(MAX_NOTE_BODY)-byte limit")
    # Optional fourth argument selects the academic layout. Existing three
    # argument calls keep the single-column default.
    layout = length(args) >= 4 ? args[4] : "single"
    layout isa AbstractString ||
        return _err("InvalidArgument", "Layout must be text")
    columns = layout == "single" ? 1 :
        (layout == "two-column" || layout == "double" ? 2 : nothing)
    columns === nothing &&
        return _err("InvalidArgument", "Layout must be \"single\" or \"two-column\"")
    occursin(r"^[A-Za-z0-9][A-Za-z0-9._\-]{0,95}\.pdf$"i, filename) ||
        return _err("InvalidPdfName", "Filename must be alphanumeric with .pdf extension")
    directory = joinpath(homedir(), "Documents")
    path = _safe_path(directory, filename)
    path === nothing && return _err("InvalidPdfName", "Path traversal not allowed")
    try
        PDFGen.write_pdf(path, title, body; columns=columns)
        _ok(Dict("path" => path, "size" => filesize(path)))
    catch error
        _err("PdfWriteFailed", sprint(showerror, error))
    end
end
