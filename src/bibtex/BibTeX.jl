module BibTeX

export BibEntry, parse_bibtex, read_bibtex, write_bibtex

struct BibEntry
    entry_type::String
    key::String
    fields::Dict{String,String}
end

function _skip_space(source, position)
    while position <= lastindex(source) && isspace(source[position])
        position = nextind(source, position)
    end
    position
end

function _find_entry_end(source, opening_position, closing)
    depth = 1
    quoted = false
    escaped = false
    opening = source[opening_position]
    position = nextind(source, opening_position)
    while position <= lastindex(source)
        character = source[position]
        if quoted
            if escaped
                escaped = false
            elseif character == '\\'
                escaped = true
            elseif character == '"'
                quoted = false
            end
        elseif character == '"'
            quoted = true
        elseif character == opening
            depth += 1
        elseif character == closing
            depth -= 1
            depth == 0 && return position
        end
        position = nextind(source, position)
    end
    throw(ArgumentError("unterminated BibTeX entry"))
end

function _split_fields(content)
    parts = String[]
    start = firstindex(content)
    depth = 0
    quoted = false
    escaped = false
    position = start
    while position <= lastindex(content)
        character = content[position]
        if quoted
            if escaped
                escaped = false
            elseif character == '\\'
                escaped = true
            elseif character == '"'
                quoted = false
            end
        elseif character == '"'
            quoted = true
        elseif character == '{'
            depth += 1
        elseif character == '}'
            depth -= 1
        elseif character == ',' && depth == 0
            push!(parts, strip(content[start:prevind(content, position)]))
            start = nextind(content, position)
        end
        position = nextind(content, position)
    end
    start <= lastindex(content) && push!(parts, strip(content[start:end]))
    filter(!isempty, parts)
end

function _equals_position(field)
    depth = 0
    quoted = false
    escaped = false
    for position in eachindex(field)
        character = field[position]
        if quoted
            if escaped
                escaped = false
            elseif character == '\\'
                escaped = true
            elseif character == '"'
                quoted = false
            end
        elseif character == '"'
            quoted = true
        elseif character == '{'
            depth += 1
        elseif character == '}'
            depth -= 1
        elseif character == '=' && depth == 0
            return position
        end
    end
    nothing
end

function _clean_value(value)
    value = strip(value)
    if startswith(value, "{") && endswith(value, "}")
        return strip(value[2:prevind(value, lastindex(value))])
    elseif startswith(value, '"') && endswith(value, '"')
        return replace(value[2:prevind(value, lastindex(value))], r"\\([{}\"\\])" => s"\1")
    end
    value
end

function _parse_entry(source)
    at = findfirst(==('@'), source)
    at === nothing && throw(ArgumentError("BibTeX entry must start with @"))
    brace = findnext(c -> c == '{' || c == '(', source, at)
    brace === nothing && throw(ArgumentError("BibTeX entry delimiter is missing"))
    closing = source[brace] == '{' ? '}' : ')'
    ending = _find_entry_end(source, brace, closing)
    entry_type = lowercase(strip(source[nextind(source, at):prevind(source, brace)]))
    body = source[nextind(source, brace):prevind(source, ending)]
    comma = findfirst(==(','), body)
    comma === nothing && return BibEntry(entry_type, strip(body), Dict{String,String}())
    key = strip(body[firstindex(body):prevind(body, comma)])
    fields = Dict{String,String}()
    for field in _split_fields(body[nextind(body, comma):end])
        equals = _equals_position(field)
        equals === nothing && continue
        name = lowercase(strip(field[firstindex(field):prevind(field, equals)]))
        value_start = nextind(field, equals)
        fields[name] = _clean_value(field[value_start:end])
    end
    BibEntry(entry_type, key, fields), ending
end

function parse_bibtex(source::AbstractString)
    entries = BibEntry[]
    position = firstindex(source)
    while position <= lastindex(source)
        at = findnext(==('@'), source, position)
        at === nothing && break
        suffix = source[at:end]
        parsed = _parse_entry(suffix)
        entry, ending = parsed isa Tuple ? parsed : (parsed, lastindex(suffix))
        entry.entry_type in ("comment", "preamble", "string") || push!(entries, entry)
        position = at + ending
    end
    entries
end

read_bibtex(path::AbstractString) = parse_bibtex(read(path, String))

function _brace(value)
    "{" * replace(String(value), "}" => "\\}") * "}"
end

function write_bibtex(entries::AbstractVector{<:BibEntry})
    output = IOBuffer()
    for entry in entries
        print(output, "@", entry.entry_type, "{", entry.key)
        isempty(entry.fields) ? print(output, "}\n\n") : print(output, ",\n")
        names = sort!(collect(keys(entry.fields)))
        for (index, name) in enumerate(names)
            print(output, "  ", name, " = ", _brace(entry.fields[name]), index == length(names) ? "\n" : ",\n")
        end
        !isempty(entry.fields) && print(output, "}\n\n")
    end
    String(take!(output))
end

end
