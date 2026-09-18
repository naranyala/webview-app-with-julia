# Data and safety boundaries

WebViewApp keeps user data local and makes filesystem access explicit.

## Durable files

| Data | Boundary | Behavior |
| --- | --- | --- |
| Notes/settings | `Persistence` / `VersionedJSONStore` | Versioned JSON envelopes and atomic replacement writes |
| Paper projects | `PaperProjects` | `paper.json`, schema migration, validation, provenance, and reproducibility records |
| Diagnostics | `Diagnostics` / `StructuredDiagnostics` | Bounded in-memory entries and rotating JSONL logs |
| Background work | `Jobs` / `CooperativeJobManager` | Bounded retention, cancellation, progress, and correlation IDs |
| Media previews | `MediaCache` / `BoundedCache` | Bounded cache with explicit stats and clearing |

## Workspace authorization

Handlers should authorize a path before reading, writing, scanning, exporting,
or creating a project. `WorkspacePolicy` canonicalizes roots and resolves
symlinks before applying the read/write/project policy. Backend error mapping is
centralized so callers receive stable codes such as `PathNotAllowed`,
`PathMissing`, and `PathUnavailable`.

Do not add a direct `read`/`write` call to a handler when a policy helper
already exists. A new path-bearing operation needs a policy test for:

- a permitted child path;
- traversal outside the configured root;
- a symlink escaping the root;
- a missing parent or target;
- an invalid or oversized payload.

## Paper project shape

`paper.json` is a migratable contract, not a UI snapshot. It contains metadata,
sections, references, figures, layout, source provenance, export profiles, and
reproducibility information. New fields must be normalized, validated, and
covered by a migration fixture before the frontend depends on them.

## Failure semantics

RPC failures use a JSON envelope with a stable error code and message. Codes are
registered in `src/ErrorCodes.jl`; do not invent ad-hoc user-facing codes in a
handler. Diagnostics may record failure context, but must never turn a failed
operation into a second failure.
