# webview-app-with-julia TODOs

A Linux-first desktop toolkit with a Julia/WebView shell and a Preact frontend.
This document is the implementation backlog. See also:
[LinuxCompanion.jl/TODOS.md](../LinuxCompanion.jl/TODOS.md) for the process
execution library backlog.

## Status Legend

- `[x]` Implemented and covered sufficiently for the current alpha.
- `[~]` Partially implemented; the remaining work is listed in the item.
- `[ ]` Not implemented.

---

## Current Implementation Snapshot

This section is authoritative for the current Julia migration. The app has 27
core bindings; the 11 StaticMediaCompanion bindings remain optional feature
bindings. Completed implementation history belongs in the changelog and Git
history rather than this backlog.

### High-leverage work

The event loop is the remaining high-leverage infrastructure task. It assumes
the existing 27-binding baseline is stable.

#### LinuxCompanion event loop integration

**Why:** The current main loop polls the mutex-backed bridge queue every 10ms.
An explicit wake-up mechanism could reduce idle polling and request latency,
but the bridge currently exposes no queue file descriptor and LinuxCompanion
does not yet provide event-loop primitives.

**Scope:**
- [ ] Measure current idle CPU usage and request-latency distribution.
- [ ] Expose a safe queue wake-up primitive from `native/bridge.cc`.
- [ ] Evaluate GTK/GLib-native wake-up integration versus an eventfd/epoll
  adapter; document ownership and thread-affinity constraints.
- [ ] Add reusable event-loop primitives to LinuxCompanion first if epoll,
  eventfd, or timerfd is selected; do not add generic Linux wrappers here.
- [ ] Replace fixed-interval polling only after the wake-up path is tested.
- [ ] Preserve the `closeWindow` exit path through the new loop.
- [ ] Add native integration tests for wake-up, burst draining, shutdown, idle
  CPU usage, and latency against measured targets.

**Acceptance:** The main loop waits efficiently without missed wake-ups, GTK
operations remain on the correct thread, measured idle CPU and latency improve
over the polling baseline, and all existing tests pass.

## Bug Fixes and Code Quality

This section tracks issues identified through code analysis. Items are grouped
by priority: critical bugs (P0), validation hardening (P1), and code
duplication/abstraction improvements (P2).

### Critical bugs — P0

- [x] Fix `_is_within_workspace` undefined function in `paper_projects.jl`.
  Replaced with `WorkspacePolicy.contains_path`.
- [x] Route `parseBibTeX` to the version with size validation. Removed duplicate
  from `analysis.jl`; renamed `_parse_bibtex_adapter` to `_parse_bibtex` in
  `bibtex_adapter.jl` which checks `MAX_BIBTEX_BYTES`.
- [x] Unify filename regex between `_save_pdf` and `_generate_pdf` in `pdf.jl`.
  Both now use case-insensitive matching with `\-` in the character class.
- [x] Fix `invalidResponse` in `backend.js` to return `Promise.reject(error)`
  instead of returning the Error object directly.
- [x] Fix `parseAudioAnalysisJob` in `schemas.js` to not discard valid jobs
  when analysis field parsing fails; return job structure without analysis.
- [x] Add null check to `parseAddBibtexToProjectResult` in `schemas.js` for
  the `parsePaperProject` return value.
- [x] Fix handler registration order in `router.jl` so `_get_diagnostics` and
  `_clear_diagnostics` are defined before the `HANDLERS` dict references them.
- [x] Add SHA stdlib to `Project.toml` with correct UUID for Julia 1.13.

### Validation hardening — P1

- [ ] Add LRU eviction or TTL-based pruning to `PAPER_PROJECT_HANDLES` dict
  in `paper_projects.jl` to prevent unbounded memory growth.
- [ ] Add type validation (`AbstractVector`, `Number`) to `_mir_analyze` in
  `analysis.jl` for `samples` and `sample_rate` arguments.
- [ ] Add `MAX_NOTE_BODY` size limit to `_generate_pdf` body argument in
  `pdf.jl` to prevent excessive memory usage.
- [ ] Add `MAX_BIBLIOGRAPHY_ENTRIES` limit to `_export_bibliography` entries
  array in `bibtex_adapter.jl`.
- [ ] Add `AbstractVector` check to `_add_bibtex_to_project` in
  `bibtex_adapter.jl` for `project["references"]`.
- [x] Fix `unmountedRef` in `disk-scanner.jsx` to reset on remount for
  React 18/Preact strict mode compatibility.
- [x] Await `selectNote(note)` call in `chain-notes.jsx` `createNote`
  function to prevent unhandled promise rejections.

### Code duplication and abstraction — P2

- [ ] Extract path validation + error-unpacking pattern into helper function.
  Currently repeated 10+ times across `media.jl`, `analysis.jl`, and
  `bibtex_adapter.jl`.
- [ ] Extract error-code mapping for `WorkspacePolicy.PolicyError` into shared
  helper. Currently duplicated in `Backend.jl`, `paper_projects.jl`.
- [ ] Extract `formatBytes` into shared utility module. Currently triplicated
  in `media-inspector.jsx`, `disk-scanner.jsx`, `tab-vault.jsx` with
  inconsistent behavior.
- [ ] Extract string validation helper in `backend.js` to reduce repeated
  `typeof x !== 'string' || !x.trim()` pattern (12+ occurrences).
- [ ] Convert `friendlyMessage` switch statement in `backend.js` to constant
  map for better readability and maintainability.
- [ ] Convert `mockBinding` if/else chain in `backend-mock.js` to dispatch
  table (330-line function).
- [ ] Add per-plugin error boundaries in `App.jsx` to prevent single plugin
  crash from taking down entire application.

## Scope Boundary

webview-app-with-julia owns:

- Preact frontend shell, plugin system, and UI components
- WebView bridge (ccall bindings to webview C API)
- Julia Backend module that handles the 27 frontend CORE_BINDINGS
- Application data models and versioned JSON DTOs (notes, audio
  feature summaries, asset scanning, and static-media responses)
- Product path authorization, workspace roots, size limits, job scheduling,
  cancellation, persistence, and user-facing error mapping
- Frontend build pipeline (npm, esbuild, production bundle)

webview-app-with-julia does NOT own:

- Reusable audio buffers, synthesis, DSP, MIR algorithms, or audio result
  semantics (→ `../Aural.jl`)
- Aural's internal types, numerical conventions, or dependency-specific APIs
  (→ `../Aural.jl`)
- Static media classification, metadata, Markdown rendering, text I/O, or
  file conversion logic (→ `../StaticMediaCompanion.jl`)
- Process execution primitives (→ LinuxCompanion.jl)
- Reusable low-level filesystem primitives (→ LinuxCompanion.jl); the app
  still owns traversal policy, allowed roots, and persistence behavior.
- Event loop and IPC (→ LinuxCompanion.jl Phase 3)
- Resource governance (→ LinuxCompanion.jl Phase 5)

### Integration rules

- Keep the dependency direction one-way: UI → app adapter/backend → reusable
  library. StaticMediaCompanion must never import this application.
- Keep all StaticMediaCompanion calls inside `src/StaticMediaAdapter.jl` (or a
  small equivalent module); `Backend.jl` should route and serialize, not learn
  native media-library details.
- Do not add generic media algorithms here just because the UI needs a new
  feature. Add the reusable primitive to StaticMediaCompanion first, then add
  the app adapter and product behavior here.
- Treat `MediaInfo`, `ConversionPlan`, and `ConversionResult` as library-side
  values. The app owns versioned JSON DTOs and may add UI-specific fields.
- Keep app-specific figure placeholders, paper citations, note formats,
  export profiles, and frontend rendering policy in this repository.

---

## Integration contract with Aural.jl

- Add `../Aural.jl` with `Pkg.develop(path="../Aural.jl")` during development;
  use a tagged or registered Aural release for distribution.
- Create an app-owned `src/AudioAnalysisAdapter.jl` (or equivalent) that is the
  only place translating between WebView payloads and Aural types.
- Call only exported Aural APIs. Do not include Aural source files directly or
  depend on private fields when an accessor is available.
- Convert incoming samples explicitly to a bounded, finite Julia vector and
  validate sample rate, channel policy, maximum frames, and file size in Julia
  even when the frontend already validates them.
- Keep the current `mirAnalyze(samples, sampleRate)` response compatible while
  adding richer fields only through a versioned response/profile. The frontend
  must never receive raw Julia structs or complex FFT coefficients by accident.
- Use `analyzeAudio(path)` for app-owned file jobs. Aural currently provides a
  WAV adapter; MP3/FLAC/OGG/AIFF support must be explicit and may remain with
  optional codec/process adapters.
- Return compact summaries by default. Store large spectra, feature matrices,
  and raw samples as app-owned artifacts or downsampled series with bounded
  response sizes.
- Keep analysis off the WebView request loop. The app owns worker scheduling,
  job ids, cancellation, progress, timeouts, and user-facing errors; Aural
  remains a synchronous offline library.
- Add cross-project tests for WAV round trips, mono/stereo conversion, short
  and empty inputs, malformed files, unsupported formats, numerical tolerances,
  response schemas, and error-code mapping.

The dependency direction is one-way:

```text
Preact UI → Backend/AudioAnalysisAdapter → Aural.jl → DSP/FFTW/WAV
                         │
                         └→ app cache, jobs, JSON contracts, and errors

Preact UI → Backend/StaticMediaAdapter → StaticMediaCompanion.jl → libxml2/libcmark
                          │
                          └→ app path policy, JSON contracts, and errors
```

Neither Aural nor the frontend should import the other project's private
implementation. Keep reusable algorithms in Aural and product policy in this
repository.

## Integration contract with StaticMediaCompanion.jl

- Add `../StaticMediaCompanion.jl` with `Pkg.develop(path="../StaticMediaCompanion.jl")`
  during development; use a tagged or registered release for distribution.
- Create an app-owned `src/StaticMediaAdapter.jl` that is the only place
  translating between WebView payloads and StaticMediaCompanion types.
- Call only exported StaticMediaCompanion APIs. Do not include source files
  directly or depend on private fields.
- The adapter normalizes return values to `Dict{String,Any}` JSON-friendly
  structures; the webview never receives StaticMediaCompanion structs directly.
- These are app-owned feature bindings, not automatically part of
  `CORE_BINDINGS`. Add them to the browser mock and core list only when a
  corresponding UI capability is ready.
- Use `convert_media_result` for synchronous diagnostics, but run real external
  conversions through `Jobs.jl` so ImageMagick/LibreOffice cannot block the
  WebView request loop.
- Preserve the existing frontend Markdown pipeline for notes, figures, papers,
  and citations until an explicit compatibility adapter is implemented.

### Media feature bindings

| Binding | StaticMediaCompanion call | Notes |
|---|---|---|
| `inspectMedia` | `media_info(path; sniff=true)` | Returns kind, mime, extension, size, width, height |
| `markdownToHtml` | `markdown_to_html(content)` | Standalone HTML; safe=true by default |
| `readText` | `read_text(path)` | UTF-8 with newline normalization |
| `writeText` | `write_text(path, content)` | Adapter returns `{path, size}`; write path confined to `~/Documents/` |
| `planConversion` | `plan_conversion(input, output)` | Dry-run; no file I/O |
| `convertMedia` | `convert_media_result(input, output)` | Small built-ins may be sync; external routes become jobs |
| `getMediaCapabilities` | `backend_capabilities()` + `available_tools()` | Reports backends and external tools |
| `htmlToText` | `html_to_text(html)` | Strips tags, decodes entities |
| `startMediaConversion` | app job wrapper around `convert_media_result` | Starts an external conversion job |
| `getMediaConversionStatus` | app job manager | Returns conversion progress and result |
| `cancelMediaConversion` | app job manager | Requests cooperative cancellation |

### Path policy

- Read paths (`inspectMedia`, `readText`, `planConversion` input,
  `convertMedia` input): resolve under `~/` or volume roots via `realpath`.
- Write paths (`writeText`, `convertMedia` output): currently confined to
  `~/Documents/`. A configured workspace root remains future work.
- Text and markup payloads are capped by `MAX_TEXT_BYTES` (16 MiB).
  `inspectMedia` performs bounded classification reads in the companion library.

### Error and resource policy

- Map `BackendUnavailableError` to a stable capability error rather than
  silently switching an explicitly requested backend.
- Map `ConversionError` to a user-facing conversion code while preserving a
  redacted diagnostic for logs.
- Enforce content limits before calling the library; do not rely only on the
  WebView or JavaScript validator.
- Never expose executable paths, full command lines, or native library handles
  to the frontend.
- Record library version, selected backend, external tool version, lossiness,
  and warnings in conversion/job results.

### Security

- Markdown rendering uses `safe=true`: blocks `javascript:`, `data:`,
  `vbscript:` URLs.
- HTML extraction runs with libxml2 network disabled (`NONET`).
- External tool conversion (ImageMagick, LibreOffice) uses
  StaticMediaCompanion's timeout- and cancellation-aware runner. Migration to
  LinuxCompanion remains a library-level decision.
- Output from `markdownToHtml` passes through existing frontend sanitization
  before DOM injection.

### Testing

- Adapter unit tests: valid paths, disallowed paths, symlinks, missing files,
  unsupported formats, oversized files.
- Round-trip: write markdown → `markdownToHtml` → verify HTML content.
- Conversion planning: `planConversion` returns correct backend without exec.
- Capability query: `getMediaCapabilities` returns non-empty tools map.
- StaticMediaCompanion's own test suite continues to pass independently.
- Add a no-native-library test path so the app remains functional with Julia
  fallbacks when libcmark/libxml2 are unavailable.
- Add a job test proving an external conversion can be cancelled or timed out
  without freezing the request router.

### Frontend (lower priority)

- [~] Optional `media-inspector.jsx` plugin: path entry → inspect → display
  metadata, preview bounded text, and plan/execute cancellable conversions.
  Native file picking and rich Markdown/image previews remain.
- Core integration is the backend bindings; the plugin is UI convenience.

### Research paper workspace — P0

- [x] Provide a paper reading surface plus reference/figure editing with
  selectable single-column preprint and two-column academic layouts.
- [x] Add a frontend paper-extension registry with Mermaid and MathJax-safe
  source fallbacks plus optional host-bundle enhancement.
- [x] Add a Julia backend handler registry so research plugins can expose
  validated RPC capabilities without editing the core router.
- [ ] Persist paper metadata, references, figures, and export preferences in a
  versioned project format.
- [ ] Add a structured section editor with autosave, Markdown preview, and
  validation feedback before export.
- [ ] Add citation import/validation and journal-style layout presets.
- [ ] Add researcher workflows for annotations, bibliography search, and
  reproducible export manifests.

### App-specific compatibility work

- [ ] Define a Markdown profile for notes, papers, figures, and citations;
  document which constructs are intentionally not passed to the generic
  renderer.
- [ ] Extend Media Inspector's existing available-tools display with selected
  backend details and explicit degraded/fallback states.

## Static media product roadmap

This roadmap is application-facing. Reusable parsing, detection, metadata, and
conversion primitives belong in StaticMediaCompanion; these items describe how
the app turns them into safe, observable user workflows.

### Media workspace foundation — P0

- [~] Complete adapter edge-case tests for invalid UTF-8, unavailable native
  backends, and external-job timeout. Missing paths, symlink escapes, and
  oversized text are covered.
- [x] Add explicit schema-version and backend-provenance fields to existing
  `MediaInfo`, `ConversionPlan`, `ConversionResult`, capability, and job DTOs.
- [ ] Add a bounded media cache keyed by canonical path, file size, mtime,
  content hash when required, library version, backend, and options.

### Media Inspector — P0 `[~]`

- [ ] Add a native file-picker flow that displays kind, MIME, extension, size,
  image dimensions, and backend provenance.
- [~] Add preview modes for text, Markdown, HTML text extraction, and image
  thumbnails without loading unbounded content into the WebView.
- [x] Add clear states for unsupported, malformed, too-large, inaccessible,
  and backend-unavailable files.
- [ ] Add a “copy metadata” and “open containing folder” action with platform
  policy checks.

### Markdown and document workspace — P1

`note-markdown.js` remains the application-specific renderer for figures,
citations, print layout, and PDF exports.

- [ ] Add StaticMediaCompanion-backed generic Markdown preview/export for files
  that do not use application-specific extensions.
- [ ] Add profile selection: app Markdown, safe generic Markdown, CommonMark,
  and GFM when the native backend is available.
- [ ] Add HTML-to-text import for pasted web content, with script/style removal,
  source attribution, and a user-visible sanitization summary.
- [ ] Add front matter and document metadata preservation without mixing it
  into note DTOs.

### Conversion center — P1

- [ ] Add dry-run route previews with source/target kinds, selected backend,
  required tool, lossiness, estimated output, and warnings.
- [x] Add `startMediaConversion`, `getMediaConversionStatus`, and
  `cancelMediaConversion` job bindings for external tools.
- [ ] Add output naming, overwrite, backup, collision, and atomic-publish
  policies at the application layer.
- [ ] Add per-job stdout/stderr summaries, tool versions, elapsed time, and
  reproducible option snapshots without exposing raw commands to the UI.
- [ ] Add batch conversion with bounded concurrency, stable ordering, retries,
  partial-success reporting, and a downloadable manifest.

### Asset catalog and enrichment — P1/P2

- [ ] Extend asset scanning with StaticMediaCompanion classification for text,
  Markdown, image, PDF, and office files alongside audio/Blender assets.
- [ ] Add content hashes, duplicate groups, extracted text previews, image
  dimensions, and document metadata to the catalog.
- [ ] Add thumbnail/preview generation with cache eviction and disk quotas.
- [ ] Add search facets for media kind, MIME type, extension, dimensions,
  modified time, source volume, and conversion availability.
- [ ] Add import/export of catalog metadata as a versioned JSON manifest.

### Security and operational quality — P0/P1

- [~] Read/write roots are enforced after canonicalization and symlink escapes
  are covered; complete replacement-race and other edge-case tests.
- [ ] Apply maximum input, output, nesting, and job-duration limits before
  invoking parsers or external tools.
- [~] Verify with application-level tests that HTML parsing remains offline and
  rendered content rejects unsafe URL schemes.
- [x] Add cancellation and timeout handling for every external conversion.
- [ ] Add structured diagnostics that distinguish policy rejection, malformed
  input, unavailable capability, tool failure, and internal errors.
- [ ] Add native-shell smoke tests and browser/mock tests for each media feature.

### Acceptance criteria

The app can inspect a permitted local file, preview or extract its content,
explain available conversion routes, run expensive conversions as cancellable
jobs, and preserve enough provenance to reproduce the result. Generic media
behavior remains reusable in StaticMediaCompanion, while app-specific note,
paper, figure, citation, workspace, and UI behavior stays here.

## Phase 2: MIR Analysis Backend `[~]`

### Audio feature extraction

- `[x]` `mirAnalyze`: compute RMS, peak, ZCR from raw samples through Aural.
- `[x]` Return MirFeatures with sample_count, sample_rate, duration_seconds.
- `[x]` Add `../Aural.jl` as the reusable offline audio/MIR dependency.
- `[x]` Move Aural conversion and feature calls into
  `src/AudioAnalysisAdapter.jl`; keep `Backend.jl` focused on routing.
- `[x]` Preserve the current MirFeatures fields while adding a response schema
  version and explicit analysis profile metadata.
- `[x]` Add spectral features (centroid, bandwidth, rolloff, flatness, flux)
  through Aural, with documented window/hop/FFT settings.
- Tonal/rhythmic summaries (MFCC/chroma, loudness/dBFS, crest factor, DC
  offset, timestamps/provenance) are tracked in `../Aural.jl`; app work here
  is limited to exposing them through versioned DTOs once Aural documents
  them.

### Ownership and validation

- `[x]` Validate finite samples, positive rate, maximum sample count, and
  maximum serialized payload in the Julia adapter.
- `[x]` Define mono-downmix and channel-selection behavior for file analysis.
- `[x]` Map `ArgumentError` and unsupported-format failures to stable frontend
  codes such as `InvalidAudioInput`, `UnsupportedAudioFormat`, and
  `AudioTooLarge`.
- `[~]` Add golden tests for sine, silence, impulse, stereo, and malformed WAV
  fixtures, comparing app JSON to Aural's documented results.
### Acceptance

The app can analyze a bounded WAV sample window through Aural, preserve the
existing MIR UI contract, expose an opt-in richer profile, report provenance
and warnings, and remain responsive while analysis is running.

---

## Phase 4: Asset Scanning Backend `[~]`

### Volume discovery

- `[x]` `listVolumes`: discover volumes from home dir and /proc/mounts.
- `[x]` Dynamic volume discovery via /proc/mounts for mounted drives.
- [ ] Respect XDG directories and user-configured paths.

### File scanning

- `[x]` `startAssetScan`: spawn a cooperative background task using `Jobs.jl`.
- `[x]` Use bounded Julia `walkdir` traversal with depth and entry limits.
- `[x]` Classify files by extension (blender, audio, render, other).
- `[x]` `getAssetScanStatus`: return current job state and progress.
- `[x]` `cancelAssetScan`: request cooperative cancellation.
- [ ] Recursive depth configuration.
- [ ] Filter by file type (blender only, audio only, etc.).
- [ ] Integration with LinuxCompanion.jl inotify for live directory watching.

---

## Phase 5: Audio Metadata Backend `[~]`

### Metadata extraction

- `[x]` `getAudioMetadata`: return format, size from filesystem.
- `[x]` WAV header parsing for channels, sample rate, duration.
- `[ ]` Add optional AIFF/FLAC metadata support through a governed
  `ffprobe`/`soxi` process adapter without duplicating Aural's in-memory DSP.

### Audio analysis

- [x] `analyzeAudio`: dispatch supported WAV files through the Aural adapter.
- [x] Dispatch WAV files through a background Aural job and return a compact,
  versioned analysis summary.
- [ ] Return clear `measured`, `partial`, `unsupported`, and `failed` states;
  never use zero-valued features to disguise an analysis failure.

---

## Phase 5B: Enriched Audio/MIR Workspace `[ ]`

Product features in this phase belong to the app. Reusable algorithms and
numerical definitions belong in `../Aural.jl`.

### Import and analysis profiles

- [ ] Add a local audio library with file selection, recent files, favorites,
  tags, source hashes, and duplicate detection.
- [ ] Define `quick`, `spectral`, `tonal`, and `rhythm` profiles with bounded
  defaults, visible settings, and a schema version.
- [ ] Show format, duration, sample rate, channels, file size, and analysis
  health before starting an expensive job.
- [ ] Add mono/stereo/channel-selection controls and preserve the source
  channel policy in result provenance.

### Enriched visual results

- [ ] Display waveform overview with zoomed selection and analysis window.
- [ ] Display spectrogram with frequency/time axes and a consistent color
  scale; distinguish squared magnitude from calibrated power/PSD.
- [ ] Display RMS/peak/loudness tracks, spectral centroid/rolloff/flux, and
  onset markers with timestamps.
- [ ] Display chroma/pitch-class summaries and MFCC heatmaps with clear
  normalization labels.
- [ ] Add optional pitch, tempo, beat, and key estimates only when Aural has
  a documented implementation and confidence/warning fields.

### Jobs, cache, and export

- [ ] Run full-file analysis as a bounded background job with progress,
  cancellation, retry, and restart-safe state.
- [ ] Cache results by source hash, Aural version, profile, and analysis
  configuration; invalidate stale results deterministically.
- [ ] Keep large matrices in app-owned cache artifacts and load only the
  visible/downsampled range into the frontend.
- [ ] Export feature summaries and annotations as versioned JSON/CSV/WAV
  companions with source and provenance metadata.
- [ ] Add a “log to notes” action that stores a compact human-readable summary
  plus a reference to the cached analysis artifact.

### Acceptance

Users can select a supported local audio file, run a named analysis profile,
watch progress without freezing the WebView, inspect time-aligned enriched
features, reopen cached results, understand unsupported/partial states, and
export results without coupling the UI to Aural internals.

---

## Phase 7: Persistent Storage `[~]`

### Configuration directory

- [x] Create ~/.config/julia-starter/ on first run.
- [x] Store notes.json.
- [x] Atomic writes with temporary file + rename.

### Data migration

- [ ] Import from browser localStorage when migrating from mock mode.
- [x] Export to JSON for backup/restore (Chain Notes backup panel with a
  versioned envelope via `note-backup.js`: native `writeText` save or browser
  download; restore adds missing notes and updates changed ones through the
  existing note bindings).
- [x] Version persisted JSON envelopes and preserve legacy raw JSON reads.

### Settings

- [ ] Window size/position persistence.
- [ ] Plugin enable/disable state.
- [ ] Default scan paths configuration.

---

## Phase 8: LinuxCompanion.jl Integration `[~]`

### Filesystem operations (when available)

- [ ] Use LinuxCompanion `watch` for live directory monitoring when its public
  filesystem API becomes available.
- [ ] Adopt future LinuxCompanion filesystem primitives only where they add
  safety or functionality beyond Julia's current atomic persistence and
  metadata APIs.

### Resource governance (when available)

- [ ] Apply cgroup limits to spawned external-tool jobs when delegated cgroups
  are available; in-process Julia scan tasks cannot be isolated this way.
- [ ] Use LinuxCompanion.jl capability diagnostics for privilege checking.

### Event loop (when available)

- [ ] Complete the measured queue wake-up work described in “LinuxCompanion
  event loop integration” above; use LinuxCompanion only if its public API
  gains the selected primitives.

---

## Phase 9: Frontend Polish `[~]`

### Plugin registration

- [x] Register all 10 current plugins through the frontend plugin registry.
- [ ] Plugin enable/disable toggle in settings.
- [ ] Plugin ordering and favorites.

### UI improvements `[~]`

- [~] Loading states for async backend calls. Media Inspector uses the reusable
  `AsyncFeedback` component; migrate remaining plugins as they are touched.
- [~] Error toasts for failed operations. Media Inspector exposes accessible
  inline alerts; a global queued toast system remains optional.
- [x] Offline indicator when backend is unavailable (topbar health badge plus
  a retry banner driven by `useBackendHealth`: `getStatus` polling combined
  with browser online/offline events).
- [x] Keyboard shortcuts for common actions (`shortcuts.js` catalog with a `?`
  help dialog: palette, sidebar, theme, and Alt-digit tool jumps; app
  shortcuts pause while typing).

### Testing

- [ ] Backend integration tests (Julia → frontend round-trip).
- [ ] Plugin unit tests for all registered plugins.
- [ ] E2E tests with WebView running.

---

## Diagnostics and error handling follow-up `[~]`

The first implementation pass now provides versioned error envelopes, request
IDs, error categories, recoverability hints, bounded frontend diagnostics, a
rotating backend JSONL log, and a searchable Diagnostics tool. The remaining
work was intentionally stopped and is tracked here:

- [ ] Add focused Julia tests for `Diagnostics.record!`, bounded retention,
  JSONL rotation, clearing, and failures when the log directory is unavailable.
- [ ] Add backend router contract tests proving every handler error includes
  `schemaVersion`, `requestId`, `operation`, `category`, and `recoverable`, and
  that internal exception details never cross the frontend boundary.
- [ ] Add frontend unit tests for diagnostics retention, immutable snapshots,
  filtering, copy/export, clearing, timeout logging, and invalid backend log
  entries.
- [ ] Complete a clean component-test run. The non-component frontend suite
  passed during implementation, but the Vitest component phase was interrupted
  before it emitted a result.
- [ ] Run the full Julia package suite and native bridge smoke test, including
  `getDiagnostics` and `clearDiagnostics`, after the restored paper/settings
  bindings have been reconciled with any concurrent edits.
- [ ] Harden shell-owned window-operation errors so they use the same envelope
  and diagnostic recorder as ordinary backend router failures.
- [ ] Define a centralized error-code registry instead of category inference
  from string prefixes; document ownership, user-facing wording, retry policy,
  and HTTP-like severity for each code.
- [ ] Add recursive redaction and size limits for diagnostic `details` before
  persistence/export (tokens, credentials, home paths, document content, and
  oversized stack traces).
- [ ] Load recent JSONL entries at startup so diagnostics survive application
  restarts, while tolerating malformed/truncated lines after a crash.
- [ ] Add correlation IDs to background scan, audio, and conversion jobs so a
  request can be followed through queued, running, completed, cancelled, and
  failed events.
- [ ] Add an opt-in support-bundle export containing diagnostics, app/runtime
  versions, capability status, and sanitized settings—never user documents.
- [ ] Update backend API and architecture documentation with the error envelope
  schema, JSONL event schema, log location/rotation policy, and examples for AI
  agents and human troubleshooting.
- [ ] Add CI assertions for schema backward compatibility and verify diagnostics
  failures can never fail the user operation being observed.

---

## Phase 10: Build and Distribution `[ ]`

### Build pipeline

- [x] Enable production bundling, tree-shaking, and minification through
  esbuild.
- [ ] Native library build script for multiple architectures.
- [ ] Julia package compilation for standalone distribution.

### Distribution

- [ ] AppImage or Flatpak packaging.
- [ ] Auto-update mechanism.
- [ ] Crash reporting and diagnostics.

### CI/CD

- [ ] GitHub Actions for Julia tests.
- [ ] GitHub Actions for frontend tests.
- [ ] GitHub Actions for native library builds.
- [ ] Release automation.

---

## Security

- [~] Validate backend inputs at each native boundary; document and test any
  handler-specific validation gaps.
- [x] Sanitize filenames for PDF export.
- [x] Prevent path traversal in asset scanning and PDF save.
- [ ] Add per-operation concurrency and resource budgets where payload limits
  and job-manager bounds are insufficient.
- [ ] Add automated secret scanning to CI as a recurring repository check.

---

## Documentation

- [x] README.md with installation and usage instructions.
- [ ] Backend API documentation for all core and optional bindings, with
  request/response examples.
- [ ] Plugin development guide.
- [x] Maintain the runtime-flow diagram in `docs/architecture.md`.
- [ ] Contributing guidelines.
- [ ] Changelog.

---

## Definition Of Done

The application is complete when:
1. All 27 core frontend bindings work through the Julia Backend module.
2. Notes persist across sessions with debounced writes.
3. Asset scanning uses bounded traversal with progress and cooperative
   cancellation; spawned enrichment tools use governed process execution.
4. The frontend shows real system info from Julia/LinuxCompanion.
5. Registered plugins use native bindings where required, and production mode
   reports unavailable capabilities instead of silently substituting mocks.
6. The application can be built and distributed as a standalone desktop app.
7. Aural.jl is consumed only through a declared dependency and an app-owned
   audio-analysis adapter; neither side imports the other's private files.
8. StaticMediaCompanion.jl is consumed only through a declared dependency and
   an app-owned adapter; neither side imports the other's private files.
9. Enabled media feature bindings have browser mocks, versioned response
   schemas, path-policy tests, capability diagnostics, and non-blocking job
   behavior for external conversions.
10. The current MIR response remains backward compatible while richer profiles
   use versioned JSON DTOs with units, timestamps, settings, and provenance.
11. Supported audio analysis runs in bounded background jobs with cache keys,
    cancellation/retry behavior, and no WebView event-loop freeze.
12. Cross-project Aural contract tests pass for supported WAV inputs, malformed
    files, empty/short signals, numerical tolerances, and error translation.

Future roadmap (not required for Done): enriched tonal/event inspection with
exportable versioned artifacts, and a tested queue wake-up mechanism replacing
fixed-interval polling with measurable latency and idle-CPU improvements.
