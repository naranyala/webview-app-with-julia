"""
    PDFGen

Pure-Julia PDF 1.4 generator. Produces valid PDF files from title + body text
with support for:
  - Single or two-column academic layout
  - Configurable margins (top, bottom, left, right)
  - Font hierarchy: H1-H6 with proper sizing
  - Bold and italic inline font switching
  - Automatic page numbers
  - PDF bookmarks/outline from heading structure
"""
module PDFGen

export pdf_bytes, write_pdf

# ── PDF escaping ──────────────────────────────────────────────────────────────

function _escape(value::AbstractString)
    output = IOBuffer()
    for character in value
        if character == '\\'
            print(output, "\\\\")
        elseif character == '('
            print(output, "\\(")
        elseif character == ')'
            print(output, "\\)")
        elseif Int(character) < 32 || Int(character) > 126
            print(output, '?')
        else
            print(output, character)
        end
    end
    String(take!(output))
end

# ── Margins ───────────────────────────────────────────────────────────────────

struct Margins
    top::Int
    bottom::Int
    left::Int
    right::Int
end

Margins(; top=48, bottom=48, left=54, right=54) = Margins(top, bottom, left, right)
Margins(d::AbstractDict) = Margins(
    get(d, "top", 48), get(d, "bottom", 48),
    get(d, "left", 54), get(d, "right", 54))

const _DEFAULT_MARGINS = Margins()

# Page geometry (A4)
const _PAGE_W = 595
const _PAGE_H = 842
const _LINE_HEIGHT = 14

# ── Font hierarchy ────────────────────────────────────────────────────────────

# Font names: F1=Regular, F2=Bold, F3=Italic, F4=BoldItalic
const _HEADING_SIZES = Dict(
    1 => (font="F2", size=12),
    2 => (font="F2", size=11),
    3 => (font="F2", size=10),
    4 => (font="F2", size=10),
    5 => (font="F2", size=9),
    6 => (font="F2", size=9),
)

function _heading_level(raw::AbstractString)
    m = match(r"^(#{1,6})\s+", raw)
    m === nothing && return 0
    length(m.captures[1])
end

# ── Inline formatting ─────────────────────────────────────────────────────────

# Represents a run of text with a specific font.
struct TextRun
    font::String   # "F1", "F2", "F3", "F4"
    size::Int
    text::String
end

function _parse_inline_runs(text::AbstractString, base_font::AbstractString, base_size::Integer)
    runs = TextRun[]
    remaining = String(text)
    # Strip markdown bold/italic markers and track font state
    # Simple state machine: handle **bold**, *italic*, ***bolditalic***
    while !isempty(remaining)
        # Find the next formatting marker
        m_bolditalic = match(r"\*\*\*(.+?)\*\*\*", remaining)
        m_bold = match(r"\*\*(.+?)\*\*", remaining)
        m_italic = match(r"\*(?!\*)(.+?)\*(?!\*)", remaining)

        # Find the earliest match
        best_pos = ncodeunits(remaining) + 1
        best_match = nothing
        best_kind = :none

        if m_bolditalic !== nothing && m_bolditalic.offsets[1] < best_pos
            best_pos = m_bolditalic.offsets[1]
            best_match = m_bolditalic
            best_kind = :bolditalic
        end
        if m_bold !== nothing && m_bold.offsets[1] < best_pos
            best_pos = m_bold.offsets[1]
            best_match = m_bold
            best_kind = :bold
        end
        if m_italic !== nothing && m_italic.offsets[1] < best_pos
            best_pos = m_italic.offsets[1]
            best_match = m_italic
            best_kind = :italic
        end

        if best_match === nothing
            # No more formatting — emit remaining as base font
            !isempty(remaining) && push!(runs, TextRun(base_font, base_size, remaining))
            break
        end

        # Emit text before the match as base font
        prefix = SubString(remaining, 1, best_pos - 1)
        !isempty(prefix) && push!(runs, TextRun(base_font, base_size, String(prefix)))

        # Determine font for the matched content
        inner = best_match.captures[1]
        font = if best_kind === :bolditalic
            base_font == "F1" ? "F4" : "F4"
        elseif best_kind === :bold
            base_font == "F1" ? "F2" : "F2"
        else # :italic
            base_font == "F1" ? "F3" : "F3"
        end
        push!(runs, TextRun(font, base_size, String(inner)))

        # Advance past the match
        match_end = best_pos + ncodeunits(best_match.match) - 1
        remaining = SubString(remaining, match_end + 1)
    end
    isempty(runs) && push!(runs, TextRun(base_font, base_size, text))
    runs
end

# ── Line splitting ────────────────────────────────────────────────────────────

function _plain_lines(text::AbstractString; width=92)
    lines = String[]
    for source_line in split(replace(text, "\r\n" => "\n", '\r' => '\n'), '\n'; keepempty=true)
        line = replace(source_line, r"^#{1,6}\s*" => "")
        line = replace(line, r"\*\*|__|`" => "")
        isempty(line) && (push!(lines, ""); continue)
        words = split(line)
        current = ""
        for word in words
            if isempty(current)
                current = word
            elseif textwidth(current) + 1 + textwidth(word) <= width
                current *= " " * word
            else
                push!(lines, current)
                current = word
            end
        end
        !isempty(current) && push!(lines, current)
    end
    lines
end

# ── Flow lines with heading levels ────────────────────────────────────────────

# Returns (kind, text, level) tuples where kind is :title, :heading, or :body.
function _flow_lines(body::AbstractString; width=92)
    text = replace(String(body), "\r\n" => "\n", '\r' => '\n')
    flow = Tuple{Symbol,String,Int}[]
    for raw in split(text, '\n'; keepempty=true)
        level = _heading_level(raw)
        if level == 0
            for line in _plain_lines(raw; width=width)
                push!(flow, (:body, line, 0))
            end
        else
            inner = strip(replace(raw, r"^#{1,6}\s+" => ""))
            for line in _plain_lines(isempty(inner) ? " " : inner; width=width)
                push!(flow, (:heading, line, level))
            end
        end
    end
    flow
end

# ── Emit text blocks ──────────────────────────────────────────────────────────

# Emit one text block with inline formatting support.
function _emit_formatted(output::IOBuffer, text::AbstractString, base_font::AbstractString, base_size::Integer, x::Integer, y::Integer)
    runs = _parse_inline_runs(text, base_font, base_size)
    print(output, "BT\n$x $y Td\n")
    current_font = ""
    current_size = 0
    for run in runs
        font_op = "/$(run.font) $(run.size) Tf"
        if font_op != current_op_string(current_font, current_size)
            print(output, "/$(run.font) $(run.size) Tf\n")
            current_font = run.font
            current_size = run.size
        end
        print(output, "(", _escape(run.text), ") Tj\n")
    end
    print(output, "ET\n")
end

current_op_string(font, size) = "/$font $size Tf"

function _font_params(kind::Symbol, level::Int=0)
    if kind === :title
        return "F2", 14
    elseif kind === :heading
        params = get(_HEADING_SIZES, level, _HEADING_SIZES[6])
        return params.font, params.size
    end
    return "F1", 10
end

function _emit_lines(output::IOBuffer, lines, x::Integer, top_y::Integer)
    print(output, "BT\n$x $top_y Td\n")
    current = ""
    for (kind, text, level) in lines
        font, size = _font_params(kind, level)
        op = "/$font $size Tf"
        if op != current
            print(output, op, "\n")
            current = op
        end
        print(output, "(", _escape(text), ") Tj\n0 -$(_LINE_HEIGHT) Td\n")
    end
    print(output, "ET\n")
end

# ── Page numbers ──────────────────────────────────────────────────────────────

function _emit_page_number(output::IOBuffer, page_num::Int, total_pages::Int, margins::Margins)
    text = "$page_num / $total_pages"
    x = (_PAGE_W - margins.right) - 30
    y = margins.bottom - 10
    print(output, "BT\n/F1 8 Tf $x $y Td ($text) Tj ET\n")
end

# ── Pagination ────────────────────────────────────────────────────────────────

function _compute_layout(columns::Int, margins::Margins)
    content_w = _PAGE_W - margins.left - margins.right
    content_h = _PAGE_H - margins.top - margins.bottom
    left_x = margins.left
    right_x = margins.left + div(content_w, 2) + 10
    top_y = _PAGE_H - margins.top
    lines_per_page = max(1, div(content_h, _LINE_HEIGHT))
    col_width = columns == 2 ? div(content_w - 20, 2) : content_w
    (left_x=left_x, right_x=right_x, top_y=top_y, lines_per_page=lines_per_page, col_width=col_width)
end

function _frames(title_block, flow, columns::Integer, margins::Margins)
    columns == 1 || columns == 2 ||
        throw(ArgumentError("columns must be 1 or 2"))
    layout = _compute_layout(columns, margins)
    lpl = layout.lines_per_page

    if columns == 1
        combined = vcat(title_block, flow)
        pages = [[(layout.left_x, combined[index:min(end, index + lpl - 1)])]
                 for index in 1:lpl:length(combined)]
        return pages, []
    end

    pages = Vector{Vector{Tuple{Int,Vector{Tuple{Symbol,String,Int}}}}}()
    first_cap = max(lpl - length(title_block), 0)
    rest = copy(flow)
    if first_cap > 0
        left = rest[1:min(end, first_cap)]
        rest = rest[min(end, first_cap) + 1:end]
        right = rest[1:min(end, first_cap)]
        rest = rest[min(end, first_cap) + 1:end]
        push!(pages, [(layout.left_x, left), (layout.right_x, right)])
    else
        push!(pages, [])
    end
    while !isempty(rest)
        left = rest[1:min(end, lpl)]
        rest = rest[min(end, lpl) + 1:end]
        right = rest[1:min(end, lpl)]
        rest = rest[min(end, lpl) + 1:end]
        push!(pages, [(layout.left_x, left), (layout.right_x, right)])
    end
    while length(pages) > 1 && all(isempty(lines) for (_, lines) in pages[end])
        pop!(pages)
    end
    pages, title_block
end

# ── Bookmarks ─────────────────────────────────────────────────────────────────

function _collect_bookmarks(flow)
    bookmarks = Tuple{Int,String}[]  # (level, title)
    for (kind, text, level) in flow
        if kind === :heading && level >= 1 && level <= 6
            # Only add the first line of each heading as a bookmark
            isempty(bookmarks) || bookmarks[end][2] != text || continue
            push!(bookmarks, (level, text))
        end
    end
    bookmarks
end

# ── Main API ──────────────────────────────────────────────────────────────────

"""
    pdf_bytes(title, body; columns=1, margins=nothing, page_numbers=true, bookmarks=true)

Generate a PDF as a byte vector. Options:
  - `columns`: 1 or 2 column layout
  - `margins`: `Dict("top"=>48, "bottom"=>48, "left"=>54, "right"=>54)` or nothing for defaults
  - `page_numbers`: add page numbers at the bottom
  - `bookmarks`: add PDF outline from heading structure
"""
function pdf_bytes(title::AbstractString, body::AbstractString;
                   columns::Integer=1,
                   margins=nothing,
                   page_numbers::Bool=true,
                   bookmarks::Bool=true)
    columns == 1 || columns == 2 ||
        throw(ArgumentError("columns must be 1 or 2"))

    mg = margins === nothing ? _DEFAULT_MARGINS :
         margins isa AbstractDict ? Margins(margins) :
         margins isa Margins ? margins : _DEFAULT_MARGINS

    layout = _compute_layout(columns, mg)
    width = columns == 2 ? 44 : 92

    title_block = vcat(
        [(:title, line, 0) for line in _plain_lines(title; width=92)],
        [(:body, "", 0)],
    )
    flow = _flow_lines(body; width=width)
    pages, front = _frames(title_block, flow, columns, mg)
    top_y = columns == 2 ? layout.top_y - _LINE_HEIGHT * length(front) : layout.top_y

    npages = length(pages)

    # Collect bookmarks before generating content
    bookmark_entries = bookmarks ? _collect_bookmarks(flow) : Tuple{Int,String}[]

    # Generate page content streams
    contents = String[]
    for (page_index, frames) in enumerate(pages)
        output = IOBuffer()
        if page_index == 1 && columns == 2
            _emit_lines(output, front, layout.left_x, layout.top_y)
        end
        for (x, lines) in frames
            isempty(lines) && continue
            y = page_index == 1 && columns == 2 ? top_y : layout.top_y
            _emit_lines(output, lines, x, y)
        end
        if page_numbers
            _emit_page_number(output, page_index, npages, mg)
        end
        push!(contents, String(take!(output)))
    end

    # Build PDF objects
    objects = String[]

    # Object 1: Catalog
    if !isempty(bookmark_entries)
        push!(objects, "<< /Type /Catalog /Pages 2 0 R /Outlines $(2 + npages * 2 + 5) 0 R >>")
    else
        push!(objects, "<< /Type /Catalog /Pages 2 0 R >>")
    end

    # Object 2: Pages
    kids = join(["$(3 + (index - 1) * 2) 0 R" for index in 1:npages], " ")
    push!(objects, "<< /Type /Pages /Kids [$kids] /Count $npages >>")

    # Objects 3..2+npages*2: Page objects and content streams
    font_regular = 3 + npages * 2
    font_bold = 4 + npages * 2
    font_italic = 5 + npages * 2
    font_bolditalic = 6 + npages * 2

    for page in 1:npages
        push!(objects, string(
            "<< /Type /Page /Parent 2 0 R",
            " /MediaBox [0 0 $(_PAGE_W) $(_PAGE_H)]",
            " /Resources << /Font <<",
            " /F1 $font_regular 0 R",
            " /F2 $font_bold 0 R",
            " /F3 $font_italic 0 R",
            " /F4 $font_bolditalic 0 R",
            " >> >>",
            " /Contents $(4 + (page - 1) * 2) 0 R >>"))
        content = contents[page]
        push!(objects, "<< /Length $(ncodeunits(content)) >>\nstream\n$content\nendstream")
    end

    # Font objects
    push!(objects, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    push!(objects, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")
    push!(objects, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>")
    push!(objects, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-BoldOblique >>")

    # Outline objects (bookmarks)
    outline_root_idx = length(objects) + 1
    if !isempty(bookmark_entries)
        # Outline root
        first_child_idx = outline_root_idx + 1
        push!(objects, "<< /Type /Outlines /First $first_child_idx 0 R /Last $(first_child_idx + length(bookmark_entries) - 1) 0 R /Count $(length(bookmark_entries)) >>")

        # Outline items — each points to page 1 for now (heading-level bookmarks)
        for (bi, (level, title)) in enumerate(bookmark_entries)
            obj_idx = outline_root_idx + bi
            next_idx = bi < length(bookmark_entries) ? obj_idx + 1 : 0
            prev_idx = bi > 1 ? obj_idx - 1 : 0
            # Simple: all bookmarks point to the first page; a full implementation
            # would track which page each heading lands on.
            dest = "/Dest /GoTo /D [3 0 R /XYZ 0 $(_PAGE_H - mg.top) null]"
            push!(objects, string(
                "<< /Title (", _escape(title), ")",
                " /Parent $outline_root_idx 0 R",
                prev_idx > 0 ? " /Prev $prev_idx 0 R" : "",
                next_idx > 0 ? " /Next $next_idx 0 R" : "",
                " /Dest /GoTo /D [3 0 R /XYZ 0 $(_PAGE_H - mg.top) null]",
                " >>"))
        end
    end

    # Write PDF
    output = IOBuffer()
    print(output, "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = Int[0]
    for (index, object) in enumerate(objects)
        push!(offsets, position(output))
        print(output, "$index 0 obj\n$object\nendobj\n")
    end
    xref = position(output)
    print(output, "xref\n0 $(length(objects) + 1)\n0000000000 65535 f \n")
    for offset in offsets[2:end]
        print(output, lpad(string(offset), 10, '0'), " 00000 n \n")
    end
    print(output, "trailer\n<< /Size $(length(objects) + 1) /Root 1 0 R >>\nstartxref\n$xref\n%%EOF\n")
    take!(output)
end

"""
    write_pdf(path, title, body; columns=1, margins=nothing, page_numbers=true, bookmarks=true)

Write a PDF file to disk. Returns the path.
"""
function write_pdf(path::AbstractString, title::AbstractString, body::AbstractString;
                   columns::Integer=1, margins=nothing, page_numbers::Bool=true, bookmarks::Bool=true)
    bytes = pdf_bytes(title, body; columns=columns, margins=margins,
                      page_numbers=page_numbers, bookmarks=bookmarks)
    open(path, "w") do io
        write(io, bytes)
    end
    path
end

end
