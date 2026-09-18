"""Application-compatible facade over the zero-dependency diagnostics store."""
module Diagnostics

using ..StructuredDiagnostics: DiagnosticsStore
import ..StructuredDiagnostics
import ..VersionedJSONStore

export clear!, configure!, log_path, recent, record!

const _default = DiagnosticsStore()

function configure!(path::AbstractString)
    configured = StructuredDiagnostics.configure!(_default, path)
    StructuredDiagnostics.recover!(_default, VersionedJSONStore.parse_json)
    configured
end
log_path() = StructuredDiagnostics.log_path(_default)
recent(limit::Integer=200) = StructuredDiagnostics.recent(_default, limit)
clear!() = StructuredDiagnostics.clear!(_default)
record!(; kwargs...) = StructuredDiagnostics.record!(_default; kwargs...)

end
