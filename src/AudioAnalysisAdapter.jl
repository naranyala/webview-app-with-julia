"""
    AudioAnalysisAdapter

App-owned adapter between the WebView RPC layer and Aural.jl. This module is
the ONLY place that imports Aural; the rest of the app interacts with audio
analysis through the handler functions in Backend.jl.

Current constraints:
  - WAV-only (Aural's supported format)
  - Bounded window: at most 262,144 samples (2^18, FFT-friendly buffer size)
  - Max 192 kHz sample rate (pro audio ceiling)
  - Max 512 MB file size
  - Mono downmix for analysis (source channel count preserved in metadata)
"""
module AudioAnalysisAdapter

using Aural

export AudioTooLargeError, AudioUnsupportedError, analyze_file, analyze_samples,
    read_metadata

# ── Limits ────────────────────────────────────────────────────────────────
# 262,144 = 2^18: large enough for good frequency resolution, small enough
# to keep Aural's FFT allocations under ~8 MB per analysis.
const MAX_SAMPLE_COUNT = 262_144
# 192 kHz: pro audio ceiling; covers all common sample rates.
const MAX_SAMPLE_RATE = 192_000
# 512 MB: prevents accidental OOM on massive WAV files. This is a file-size
# limit, not a decoded-size limit — the bounded window handles the latter.
const MAX_FILE_BYTES = 512 * 1024 * 1024
const SUPPORTED_EXTENSIONS = Set(["wav", "wave"])
const SPECTRAL_WINDOW_SIZE = 2_048
const SPECTRAL_HOP_SIZE = 512
const SPECTRAL_FFT_SIZE = 4_096

struct AudioUnsupportedError <: Exception
    path::String
    format::String
end

Base.showerror(io::IO, error::AudioUnsupportedError) = print(
    io,
    "audio format .$(error.format) is not supported by Aural: ",
    error.path,
)

struct AudioTooLargeError <: Exception
    detail::String
end

Base.showerror(io::IO, error::AudioTooLargeError) = print(io, error.detail)

function _extension(path::AbstractString)
    extension = splitext(path)[2]
    isempty(extension) ? "" : lowercase(extension[2:end])
end

function _validate_path(path::AbstractString)
    isfile(path) || throw(ArgumentError("audio file not found: $path"))
    filesize(path) <= MAX_FILE_BYTES || throw(AudioTooLargeError(
        "audio file exceeds the $(MAX_FILE_BYTES)-byte limit: $path",
    ))
    format = _extension(path)
    format in SUPPORTED_EXTENSIONS || throw(AudioUnsupportedError(String(path), format))
    String(path), format
end

function _validate_samples(samples, sample_rate)
    sample_rate isa Real || throw(ArgumentError("sample rate must be numeric"))
    isfinite(sample_rate) && sample_rate > 0 || throw(ArgumentError("sample rate is invalid"))
    sample_rate <= MAX_SAMPLE_RATE || throw(ArgumentError("sample rate exceeds the supported limit"))
    samples isa AbstractVector || throw(ArgumentError("audio samples must be a vector"))
    isempty(samples) && throw(ArgumentError("no audio samples were provided"))
    length(samples) <= MAX_SAMPLE_COUNT || throw(AudioTooLargeError(
        "audio sample count exceeds the $(MAX_SAMPLE_COUNT)-sample limit",
    ))
    values = try
        Float64.(samples)
    catch
        throw(ArgumentError("audio samples must be real numbers"))
    end
    all(isfinite, values) || throw(ArgumentError("audio samples must be finite numbers"))
    values, round(Int, sample_rate)
end

# Core analysis: single-frame RMS, ZCR, and peak.
# window_size == hop_size means we treat the entire input as one analysis frame
# (a summary, not a time-series). This is intentional for the "quick" profile.
function _track_mean(track)
    track_values = Aural.values(track)
    isempty(track_values) ? 0.0 : sum(track_values) / length(track_values)
end

function _spectral_summary(audio, sample_count)
    window_size = min(SPECTRAL_WINDOW_SIZE, sample_count)
    hop_size = min(SPECTRAL_HOP_SIZE, window_size)
    spectrum = Aural.spectrogram(
        audio;
        window_size=window_size,
        hop_size=hop_size,
        nfft=SPECTRAL_FFT_SIZE,
        pad=true,
    )
    Dict{String,Any}(
        "spectralCentroidHz" => _track_mean(Aural.spectral_centroid(spectrum)),
        "spectralBandwidthHz" => _track_mean(Aural.spectral_bandwidth(spectrum)),
        "spectralRolloffHz" => _track_mean(Aural.spectral_rolloff(spectrum; fraction=0.85)),
        "spectralFlatness" => _track_mean(Aural.spectral_flatness(spectrum)),
        "spectralFlux" => _track_mean(Aural.spectral_flux(spectrum)),
        "spectralWindowSize" => SPECTRAL_WINDOW_SIZE,
        "spectralHopSize" => SPECTRAL_HOP_SIZE,
        "spectralFftSize" => SPECTRAL_FFT_SIZE,
    )
end

function _summary(values, sample_rate; source_channels=1,
                  source_sample_count=length(values), profile="quick")
    profile in ("quick", "spectral") || throw(ArgumentError("analysis profile must be quick or spectral"))
    audio = Aural.AudioBuffer(values, sample_rate)
    settings = Aural.AnalysisConfig(
        window_size=length(values),
        hop_size=length(values),
        channel=1,
        pad=false,
    )
    rms_track = Aural.rms(audio, settings)
    zcr_track = Aural.zero_crossing_rate(audio, settings)
    rms = Aural.values(rms_track)[1]
    zcr = Aural.values(zcr_track)[1]
    peak = maximum(abs, values)
    result = Dict{String,Any}(
        "rms" => rms,
        "peak" => peak,
        "zcr" => zcr,
        "sample_count" => length(values),
        "sample_rate" => sample_rate,
        "duration_seconds" => length(values) / sample_rate,
        "sourceChannels" => source_channels,
        "sourceSampleCount" => source_sample_count,
        "analysisSchema" => profile == "spectral" ? 2 : 1,
        "analysisProfile" => profile,
        "channelPolicy" => "mono",
        "engine" => "Aural",
    )
    profile == "spectral" && merge!(result, _spectral_summary(audio, length(values)))
    result
end

function analyze_samples(samples, sample_rate; profile="quick")
    values, rate = _validate_samples(samples, sample_rate)
    _summary(values, rate; profile=String(profile))
end

function read_metadata(path::AbstractString)
    path_string, format = _validate_path(path)
    audio = try
        Aural.read_audio(path_string; T=Float64)
    catch error
        throw(ArgumentError("could not read WAV audio: $(sprint(showerror, error))"))
    end
    Dict{String,Any}(
        "path" => path_string,
        "format" => format == "wave" ? "wav" : format,
        "durationSec" => Aural.duration(audio),
        "sampleRate" => Aural.samplerate(audio),
        "channels" => Aural.nchannels(audio),
        "sizeBytes" => filesize(path_string),
        "measured" => true,
        "engine" => "Aural",
    )
end

function _u16(bytes, offset)
    UInt16(bytes[offset]) | (UInt16(bytes[offset + 1]) << 8)
end

function _u32(bytes, offset)
    UInt32(bytes[offset]) |
        (UInt32(bytes[offset + 1]) << 8) |
        (UInt32(bytes[offset + 2]) << 16) |
        (UInt32(bytes[offset + 3]) << 24)
end

function _i24(bytes, offset)
    value = Int32(_u32(UInt8[bytes[offset], bytes[offset + 1], bytes[offset + 2], 0x00], 1))
    value & 0x00800000 != 0 ? value - 0x01000000 : value
end

function _decode_wav_sample(bytes, offset, format, bits)
    if format == 1
        if bits == 8
            (Float64(bytes[offset]) - 128.0) / 128.0
        elseif bits == 16
            unsigned = Int(_u16(bytes, offset))
            value = unsigned >= 0x8000 ? unsigned - 0x10000 : unsigned
            Float64(value) / 32768.0
        elseif bits == 24
            Float64(_i24(bytes, offset)) / 8388608.0
        elseif bits == 32
            unsigned = UInt64(_u32(bytes, offset))
            value = unsigned >= 0x80000000 ? Int64(unsigned) - 0x100000000 : Int64(unsigned)
            Float64(value) / 2147483648.0
        else
            throw(ArgumentError("unsupported PCM bit depth: $bits"))
        end
    elseif format == 3 && bits == 32
        Float64(reinterpret(Float32, [_u32(bytes, offset)])[1])
    elseif format == 3 && bits == 64
        bits_value = UInt64(0)
        for index in 0:7
            bits_value |= UInt64(bytes[offset + index]) << (8 * index)
        end
        reinterpret(Float64, [bits_value])[1]
    else
        throw(ArgumentError("unsupported WAV encoding or bit depth"))
    end
end

function _read_wav_window(path::AbstractString, max_frames::Integer)
    open(path, "r") do io
        read(io, 4) == UInt8['R', 'I', 'F', 'F'] ||
            throw(ArgumentError("WAV file must use RIFF container"))
        read(io, 4) # RIFF file size; not needed for bounded reads.
        read(io, 4) == UInt8['W', 'A', 'V', 'E'] ||
            throw(ArgumentError("WAV file must use WAVE format"))

        format = nothing
        channels = nothing
        sample_rate = nothing
        block_align = nothing
        bits = nothing
        data_offset = nothing
        data_size = nothing

        while !eof(io)
            chunk_id = read(io, 4)
            length(chunk_id) < 4 && break
            chunk_size_bytes = read(io, 4)
            length(chunk_size_bytes) < 4 && throw(ArgumentError("truncated WAV chunk"))
            chunk_size = Int(_u32(chunk_size_bytes, 1))
            chunk_start = position(io)
            if chunk_id == UInt8['f', 'm', 't', ' ']
                chunk_size >= 16 || throw(ArgumentError("WAV fmt chunk is too small"))
                header = read(io, min(chunk_size, 40))
                length(header) >= 16 || throw(ArgumentError("truncated WAV fmt chunk"))
                format = Int(_u16(header, 1))
                channels = Int(_u16(header, 3))
                sample_rate = Int(_u32(header, 5))
                block_align = Int(_u16(header, 13))
                bits = Int(_u16(header, 15))
                if format == 0xfffe
                    # WAVE_FORMAT_EXTENSIBLE stores the actual PCM/IEEE-float
                    # code in the first four bytes of its 16-byte subformat GUID.
                    length(header) >= 40 || throw(ArgumentError("WAV extensible fmt chunk is too small"))
                    format = Int(_u32(header, 25))
                end
            elseif chunk_id == UInt8['d', 'a', 't', 'a']
                data_offset = chunk_start
                data_size = chunk_size
            end
            seek(io, chunk_start + chunk_size + (chunk_size % 2))
        end

        all(value -> value !== nothing, (format, channels, sample_rate, block_align, bits, data_offset, data_size)) ||
            throw(ArgumentError("WAV file is missing fmt or data chunk"))
        channels > 0 || throw(ArgumentError("WAV channel count is invalid"))
        sample_rate > 0 || throw(ArgumentError("WAV sample rate is invalid"))
        bytes_per_sample = cld(bits, 8)
        block_align == channels * bytes_per_sample ||
            throw(ArgumentError("WAV block alignment is invalid"))
        source_frames = div(data_size, block_align)
        frames = min(source_frames, Int(max_frames))
        frames > 0 || throw(ArgumentError("WAV file contains no audio frames"))
        bytes_to_read = frames * block_align
        seek(io, data_offset)
        bytes = read(io, bytes_to_read)
        length(bytes) == bytes_to_read || throw(ArgumentError("WAV data chunk is truncated"))

        mono = Vector{Float64}(undef, frames)
        for frame in 1:frames
            total = 0.0
            for channel in 1:channels
                offset = (frame - 1) * block_align + (channel - 1) * bytes_per_sample + 1
                total += _decode_wav_sample(bytes, offset, format, bits)
            end
            mono[frame] = total / channels
        end
        all(isfinite, mono) || throw(ArgumentError("WAV samples must be finite numbers"))
        mono, sample_rate, channels, source_frames, frames
    end
end

# Analyze only the first bounded window. Header/chunk parsing seeks over the
# rest of the file, so a large WAV does not get decoded into memory first.
function analyze_file(path::AbstractString; max_frames::Integer=MAX_SAMPLE_COUNT, profile="quick")
    path_string, format = _validate_path(path)
    1 <= max_frames <= MAX_SAMPLE_COUNT || throw(ArgumentError("max_frames is invalid"))
    values, sample_rate, channels, source_frames, frames = try
        _read_wav_window(path_string, max_frames)
    catch error
        throw(ArgumentError("could not read WAV audio: $(sprint(showerror, error))"))
    end
    result = _summary(values, sample_rate; source_channels=channels,
        source_sample_count=source_frames, profile=String(profile))
    result["path"] = path_string
    result["format"] = format == "wave" ? "wav" : format
    result["channels"] = channels
    result["partial"] = frames < source_frames  # true when we clipped to max_frames
    result["measured"] = true  # distinguishes real analysis from stub/unsupported
    result
end

end
