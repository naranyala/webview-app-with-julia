module PDFGen

export pdf_bytes, write_pdf

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

# Academic structure: markdown `#` headings become bold full-width lines so a
# native paper keeps its section outline in either layout. Returns
# `(kind, text)` tuples with kind in (:title, :heading, :body).
function _flow_lines(body::AbstractString; width=92)
    text = replace(String(body), "\r\n" => "\n", '\r' => '\n')
    flow = Tuple{Symbol,String}[]
    for raw in split(text, '\n'; keepempty=true)
        m = match(r"^#{1,6}\s+(.*)$", raw)
        if m === nothing
            for line in _plain_lines(raw; width=width)
                push!(flow, (:body, line))
            end
        else
            inner = strip(m.captures[1])
            for line in _plain_lines(isempty(inner) ? " " : inner; width=width)
                push!(flow, (:heading, line))
            end
        end
    end
    flow
end

function _font_op(kind::Symbol)
    kind === :title && return "/F2 14 Tf"
    kind === :heading && return "/F2 12 Tf"
    "/F1 10 Tf"
end

# Emit one text block of (kind, text) lines at an absolute origin. The font
# operator is rewritten only when the kind changes, keeping streams compact.
function _emit_lines(output::IOBuffer, lines, x::Integer, top_y::Integer)
    print(output, "BT\n$x $top_y Td\n")
    current = ""
    for (kind, text) in lines
        op = _font_op(kind)
        if op != current
            print(output, op, "\n")
            current = op
        end
        print(output, "(", _escape(text), ") Tj\n0 -14 Td\n")
    end
    print(output, "ET\n")
end

const _PAGE_LINES = 51
const _LEFT_X = 54
const _RIGHT_X = 310
const _TOP_Y = 788

# Paginate into (column x, lines) frames. Single-column is one full-width
# frame per page; two-column keeps the title block full-width and flows the
# body through left/right column frames with equal page-1 capacity.
function _frames(title_block, flow, columns::Integer)
    columns == 1 || columns == 2 ||
        throw(ArgumentError("columns must be 1 or 2"))
    if columns == 1
        combined = vcat(title_block, flow)
        pages = [[(_LEFT_X, combined[index:min(end, index + _PAGE_LINES - 1)])]
                 for index in 1:_PAGE_LINES:length(combined)]
        return pages, []
    end
    pages = Vector{Vector{Tuple{Int,Vector{Tuple{Symbol,String}}}}}()
    first_cap = max(_PAGE_LINES - length(title_block), 0)
    rest = copy(flow)
    if first_cap > 0
        left = rest[1:min(end, first_cap)]
        rest = rest[min(end, first_cap) + 1:end]
        right = rest[1:min(end, first_cap)]
        rest = rest[min(end, first_cap) + 1:end]
        push!(pages, [(_LEFT_X, left), (_RIGHT_X, right)])
    else
        push!(pages, [])
    end
    while !isempty(rest)
        left = rest[1:min(end, _PAGE_LINES)]
        rest = rest[min(end, _PAGE_LINES) + 1:end]
        right = rest[1:min(end, _PAGE_LINES)]
        rest = rest[min(end, _PAGE_LINES) + 1:end]
        push!(pages, [(_LEFT_X, left), (_RIGHT_X, right)])
    end
    # Drop a trailing page whose columns are both empty (exact-fit content).
    while length(pages) > 1 && all(isempty(lines) for (_, lines) in pages[end])
        pop!(pages)
    end
    pages, title_block
end

function pdf_bytes(title::AbstractString, body::AbstractString; columns::Integer=1)
    columns == 1 || columns == 2 ||
        throw(ArgumentError("columns must be 1 or 2"))
    width = columns == 2 ? 44 : 92
    title_block = vcat(
        [(:title, line) for line in _plain_lines(title; width=92)],
        [(:body, "")],
    )
    flow = _flow_lines(body; width=width)
    pages, front = _frames(title_block, flow, columns)
    top_y = columns == 2 ? _TOP_Y - 14 * length(front) : _TOP_Y

    contents = String[]
    for (page_index, frames) in enumerate(pages)
        output = IOBuffer()
        if page_index == 1 && columns == 2
            _emit_lines(output, front, _LEFT_X, _TOP_Y)
        end
        for (x, lines) in frames
            isempty(lines) && continue
            y = page_index == 1 && columns == 2 ? top_y : _TOP_Y
            _emit_lines(output, lines, x, y)
        end
        push!(contents, String(take!(output)))
    end
    npages = length(contents)

    objects = String[]
    push!(objects, "<< /Type /Catalog /Pages 2 0 R >>")
    kids = join(["$(3 + (index - 1) * 2) 0 R" for index in 1:npages], " ")
    push!(objects, "<< /Type /Pages /Kids [$kids] /Count $npages >>")
    font_regular = 3 + npages * 2
    font_bold = 4 + npages * 2
    for page in 1:npages
        push!(objects, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 $font_regular 0 R /F2 $font_bold 0 R >> >> /Contents $(4 + (page - 1) * 2) 0 R >>")
        content = contents[page]
        push!(objects, "<< /Length $(ncodeunits(content)) >>\nstream\n$content\nendstream")
    end
    push!(objects, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    push!(objects, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")

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

function write_pdf(path::AbstractString, title::AbstractString, body::AbstractString; columns::Integer=1)
    bytes = pdf_bytes(title, body; columns=columns)
    open(path, "w") do io
        write(io, bytes)
    end
    path
end

end
