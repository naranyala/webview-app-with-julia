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

function _content(lines, page_lines, page_number)
    first_line = (page_number - 1) * page_lines + 1
    last_line = min(length(lines), page_number * page_lines)
    output = IOBuffer()
    print(output, "BT\n/F1 10 Tf\n54 788 Td\n")
    for index in first_line:last_line
        print(output, "(", _escape(lines[index]), ") Tj\n0 -14 Td\n")
    end
    print(output, "ET\n")
    String(take!(output))
end

function pdf_bytes(title::AbstractString, body::AbstractString)
    lines = String[title, "", _plain_lines(body)...]
    page_lines = 51
    pages = max(1, cld(length(lines), page_lines))

    objects = String[]
    push!(objects, "<< /Type /Catalog /Pages 2 0 R >>")
    kids = join(["$(3 + (index - 1) * 2) 0 R" for index in 1:pages], " ")
    push!(objects, "<< /Type /Pages /Kids [$kids] /Count $pages >>")
    for page in 1:pages
        push!(objects, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 $(3 + pages * 2) 0 R >> >> /Contents $(4 + (page - 1) * 2) 0 R >>")
        content = _content(lines, page_lines, page)
        push!(objects, "<< /Length $(ncodeunits(content)) >>\nstream\n$content\nendstream")
    end
    push!(objects, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

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

function write_pdf(path::AbstractString, title::AbstractString, body::AbstractString)
    bytes = pdf_bytes(title, body)
    open(path, "w") do io
        write(io, bytes)
    end
    path
end

end
