module BlendReader

export BlendHeader, is_blend, read_header

struct BlendHeader
    path::String
    pointer_size::Int
    byte_order::Symbol
    version::VersionNumber
end

function is_blend(path::AbstractString)
    isfile(path) || return false
    open(path, "r") do io
        length(read(io, min(7, filesize(path)))) == 7 || return false
        seekstart(io)
        read(io, 7) == UInt8[codeunits("BLENDER")...]
    end
end

function read_header(path::AbstractString)
    isfile(path) || throw(ArgumentError("Blend file not found: $path"))
    data = open(path, "r") do io
        read(io, min(filesize(path), 12))
    end
    length(data) == 12 || throw(ArgumentError("Blend header is truncated"))
    data[1:7] == UInt8[codeunits("BLENDER")...] || throw(ArgumentError("not a Blender file"))
    pointer_size = data[8] == UInt8('-') ? 64 : data[8] == UInt8('_') ? 32 : 0
    pointer_size > 0 || throw(ArgumentError("unknown Blender pointer-size marker"))
    byte_order = data[9] == UInt8('v') ? :little : data[9] == UInt8('V') ? :big : :unknown
    byte_order == :unknown && throw(ArgumentError("unknown Blender byte-order marker"))
    version_text = String(UInt8[data[10:12]...])
    version = try
        VersionNumber("$(version_text[1]).$(version_text[2:3])")
    catch
        throw(ArgumentError("invalid Blender version in header"))
    end
    BlendHeader(String(path), pointer_size, byte_order, version)
end

end
