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

This section is authoritative for the current Julia migration. The historical
phase checklists below retain the original product roadmap; the current app
has 36 core bindings, while future media capabilities are tracked separately
as optional feature bindings.

### Completed in the current pass

- `[x]` `Jobs.jl`: thread-safe cooperative jobs with progress, cancellation,
  terminal states, bounded retention, and serialization-friendly snapshots.
- `[x]` `Persistence.jl`: versioned JSON envelopes, legacy raw JSON reads,
  size limits, atomic writes, and typed storage errors.
- `[x]` Notes and quizzes use transactional persistence; write failures are
  returned to the frontend instead of being swallowed.
- `[x]` Quiz JSON import/export is validated, size-limited, re-IDs imported
  records, and exports only into `~/Documents/`.
- `[x]` Asset scans use `Jobs.jl`; the frontend polls status and can cancel a
  running scan.
- `[x]` Audio and Blender path reads resolve symlinks and require paths under
  the home directory or discovered volume roots.
- `[x]` Native window actions call GTK through the bridge instead of being
  no-ops.
- `[x]` Frontend schemas cover volumes, scan jobs, audio metadata/analysis,
  backend status, and quiz payloads.
- `[x]` StaticMediaCompanion is integrated through an app-owned adapter with
  eight optional bindings; core binding detection remains unchanged.
- `[x]` WAV analysis reads only a bounded sample window after parsing the file
  header, avoiding full-file decode for asynchronous analysis jobs.

### High-leverage next steps

Ordered by impact: each item unblocks the most downstream work relative to
effort. All items assume the existing 36-binding baseline is stable.

#### 1. StaticMediaCompanion integration (8 optional feature bindings) `[~]`

**Why:** Largest single feature expansion. Unlocks document inspection, Markdown
preview, text I/O, format conversion, and capability reporting. The paper
plugin's `generatePdf` is already wired but cannot inspect source media
natively. The `media-inspector.jsx` plugin and future document workflows depend
on this.

**Scope:**
- [x] Add `../StaticMediaCompanion.jl` as a `[sources]` dependency in
  `Project.toml`.
- [x] Create `src/StaticMediaAdapter.jl` (app-owned adapter):
  - `inspect_media(path)` → calls `StaticMediaCompanion.media_info(path)`,
    returns `Dict{String,Any}` with kind, mime, extension, size, width, height.
  - `markdown_to_html(content)` → calls `StaticMediaCompanion.markdown_to_html(content)`,
    returns standalone HTML string with `safe=true`.
  - `read_text(path)` → calls `StaticMediaCompanion.read_text(path)`, enforces
    path policy and size cap.
  - `write_text(path, content)` → calls `StaticMediaCompanion.write_text(path, content)`,
    write path confined to `~/Documents/`.
  - `plan_conversion(input, output)` → calls `StaticMediaCompanion.plan_conversion(input, output)`,
    returns plan JSON without executing.
  - `convert_media(input, output)` → calls
    `StaticMediaCompanion.convert_media_result(input, output)` for compact
    synchronous routes. External conversion jobs remain follow-up work.
  - `get_media_capabilities()` → calls `StaticMediaCompanion.backend_capabilities()`
    + `StaticMediaCompanion.available_tools()`.
  - `html_to_text(html)` → calls `StaticMediaCompanion.html_to_text(html)`.
- [x] Register all 8 handlers in `Backend.jl` HANDLERS dict.
- [x] Register all 8 bindings in `bin/webview_app.jl` binding list.
- [x] Add 8 entries to the `backend` export object and schemas. Keep them out
  of `CORE_BINDINGS` until browser mocks and a corresponding UI feature exist.
- [x] Add 8 TypeScript entries to `frontend-preact/src/bindings.d.ts`.
- [x] Add frontend schemas for `MediaInfo`, `ConversionPlan`, `ConversionResult`
  to `schemas.js`.
- [x] Add `friendlyMessage` entries for `MediaNotFound`, `MediaUnsupported`,
  `ConversionFailed`, `BackendUnavailable`.
- [x] Enforce path policy: read paths under `~/` or volume roots, write paths
  under `~/Documents/`. Reuse existing `_validate_read_path` pattern.
- [x] Add tests in `test/backend.jl`: inspect valid file, inspect disallowed
  path, markdown round-trip, conversion plan, capability query.
- [x] Update `check-bindings.cjs` so the 36 core names remain mandatory and the
  optional media names are checked when registered.
- [x] Update `check-backend-errors.mjs` with new error codes.

**Remaining:** Move external ImageMagick/LibreOffice conversions into
`Jobs.jl` with cancellation and timeout reporting before enabling them in a
blocking UI workflow.

**Acceptance:** The 36 core bindings remain stable; when the media feature is
enabled, its bindings pass the binding checker, browser mocks, Julia tests, and
frontend checks. `inspectMedia` returns correct kind/MIME for a PNG file,
`markdownToHtml` renders a heading, and `planConversion` reports a route without
executing it.

#### 2. LinuxCompanion event loop integration

**Why:** Current main loop uses `sleep(0.01)` (100 Hz busy-wait). This wastes
CPU, adds 10ms latency to every request, and blocks efficient background
operations. Replacing with epoll enables inotify live directory watching,
sub-millisecond request latency, and resource-governed background tasks.

**Scope:**
- [ ] Read `../LinuxCompanion.jl` to identify available event loop primitives
  (epoll fd, inotify fd, timer fd).
- [ ] Modify `bin/webview_app.jl` main loop to:
  - Create an epoll fd via LinuxCompanion.
  - Register the WebView bridge queue fd for EPOLLIN.
  - Register a 10ms timer fd for periodic pump! calls.
  - Replace `sleep(0.01)` with `epoll_wait` (blocks until event or timeout).
- [ ] On EPOLLIN from bridge queue: drain all pending requests immediately
  (zero-latency wakeup).
- [ ] On timer fd: call `ManualWebview.pump!()` to process GTK events.
- [ ] Add `epoll_ctl`/`epoll_wait` wrappers in `ManualWebview.jl` if
  LinuxCompanion doesn't expose them directly.
- [ ] Preserve the `closeWindow`/`closeApp` exit path through the new loop.
- [ ] Add integration test: verify request latency < 1ms under idle load.

**Acceptance:** Main loop blocks on epoll instead of sleep, CPU usage drops to
near-zero when idle, request latency < 1ms, all existing tests pass.

#### 3. Spectral MIR features via Aural

**Why:** Current MIR analysis returns only RMS, peak, ZCR. Spectral features
(centroid, bandwidth, rolloff, flatness, flux) are the core value proposition
of a MIR workstation. The frontend `describeFeatures()` already handles
displaying unknown fields, so the UI work is minimal.

**Scope:**
- [ ] Extend `AudioAnalysisAdapter._summary()` to compute:
  - Spectral centroid (amplitude-weighted mean frequency)
  - Spectral bandwidth (spread around centroid)
  - Spectral rolloff (85th percentile of cumulative spectrum)
  - Spectral flatness (geometric mean / arithmetic mean of spectrum)
  - Spectral flux (frame-to-frame spectral change)
- [ ] Use Aural's FFT/stft primitives; document window size (2048), hop size
  (512), and FFT size (4096) in the adapter.
- [ ] Add `analysisProfile` field: `"spectral"` profile returns all features,
  `"quick"` profile returns only RMS/peak/ZCR (current behavior).
- [ ] Return features as a flat dict with explicit units in field names:
  `spectralCentroidHz`, `spectralBandwidthHz`, `spectralRolloffHz`,
  `spectralFlatness`, `spectralFlux`.
- [ ] Add golden tests: sine wave centroid ≈ 440Hz, white noise flatness ≈ 1.0.
- [ ] Update `describeFeatures()` in `mir.js` to describe new fields.
- [ ] Update frontend schemas to accept new fields.

**Acceptance:** Spectral features appear in analysis results, golden tests
pass within 5% tolerance, `describeFeatures()` mentions centroid/rolloff,
frontend displays new fields in MirLab.

#### 4. Bounded-window Aural file reader `[x]`

**Why:** Current `analyze_file` reads the entire WAV into memory before
windowing. A 1GB WAV file will OOM. This is a production safety blocker for
the async audio analysis feature.

**Scope:**
- [x] Add `_read_wav_window(path, max_frames)` to `AudioAnalysisAdapter.jl`:
  - Open file, read WAV header (channels, sample rate, bit depth).
  - Seek to data chunk, read only `max_frames` samples from the start.
  - Return mono-downmixed samples without loading the full file.
- [x] Read small and large WAVs through the same bounded header/data path.
- [x] Enforce a hard limit: `MAX_SAMPLE_COUNT = 262_144` (256k samples).
- [~] Keep the existing 512 MB file-size rejection; add a user-facing warning
  threshold separately if large-file UX needs it.
- [x] Add a bounded-window regression test and verify
  `analyze_file` returns results without loading the full file.
- [x] Update `analyze_file` to use `_read_wav_window` instead of full read.

**Acceptance:** 100MB WAV file analyzes in < 2 seconds with < 50MB memory,
existing small-file tests pass unchanged, large-file rejection returns
`AudioTooLarge` error.

#### 5. Backend debounced persistence

**Why:** Every `createNote`/`updateNote`/`deleteNote` call writes to disk
synchronously. Under heavy editing (auto-save at 350ms intervals), this causes
redundant I/O. The frontend already debounces; the backend should match.

**Scope:**
- [ ] Add `_pending_writes::Dict{String,Dict{String,Any}}` to `STATE` for
  coalesced note writes and `_pending_quiz_writes` for quiz writes.
- [ ] Add `_schedule_persist(key, data; delay=0.5)` that:
  - Stores the candidate in `_pending_writes[key]`.
  - If no timer is active for this key, starts a `Timer` that fires after
    `delay` seconds and calls `Persistence.save!` with the latest candidate.
- [ ] Modify `createNote`, `updateNote`, `deleteNote` to call
  `_schedule_persist("notes", candidate_notes)` instead of inline save.
- [ ] Add `_flush_pending()` that immediately persists all pending writes.
  Call from `closeWindow`/`closeApp` handler and from a ` shutdown` hook.
- [ ] Add quiz persistence debouncing with the same pattern.
- [ ] Ensure `getNotes`/`quizList` always return the in-memory state (which is
  authoritative), not the on-disk state.
- [ ] Add test: rapid note updates coalesce into fewer disk writes.

**Acceptance:** 10 rapid note updates produce 1-2 disk writes instead of 10,
navigation/close triggers flush, all existing tests pass.

## Scope Boundary

webview-app-with-julia owns:

- Preact frontend shell, plugin system, and UI components
- WebView bridge (ccall bindings to webview C API)
- Julia Backend module that handles the 36 frontend CORE_BINDINGS
- Application data models and versioned JSON DTOs (notes, quizzes, audio
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
- Filesystem operations (→ LinuxCompanion.jl Phase 2)
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

### Proposed feature bindings (8 initial capabilities)

| Binding | StaticMediaCompanion call | Notes |
|---|---|---|
| `inspectMedia` | `media_info(path; sniff=true)` | Returns kind, mime, extension, size, width, height |
| `markdownToHtml` | `markdown_to_html(content)` | Standalone HTML; safe=true by default |
| `readText` | `read_text(path)` | UTF-8 with newline normalization |
| `writeText` | `write_text(path, content)` | Adapter returns `{path, size}`; write path confined to workspace |
| `planConversion` | `plan_conversion(input, output)` | Dry-run; no file I/O |
| `convertMedia` | `convert_media_result(input, output)` | Small built-ins may be sync; external routes become jobs |
| `getMediaCapabilities` | `backend_capabilities()` + `available_tools()` | Reports backends and external tools |
| `htmlToText` | `html_to_text(html)` | Strips tags, decodes entities |

### Path policy

- Read paths (`inspectMedia`, `readText`, `planConversion` input,
  `convertMedia` input): resolve under `~/` or volume roots via `realpath`.
- Write paths (`writeText`, `convertMedia` output): confined to `~/Documents/`
  or a configured workspace root.
- Binary reads capped at `MAX_PDF_BYTES` (16 MB) unless header-only
  (e.g. `inspectMedia` reads only the first bytes for classification).

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
- External tool conversion (ImageMagick, LibreOffice) inherits the hardened
  command runner from LinuxCompanion.jl.
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

- Optional `media-inspector.jsx` plugin: native file pick → inspect → display
  metadata, render Markdown preview, plan/execute conversions.
- Core integration is the backend bindings; the plugin is UI convenience.

### App-specific compatibility work

- [ ] Define a Markdown profile for notes, papers, figures, and citations;
  document which constructs are intentionally not passed to the generic
  renderer.
- [ ] Add a media result schema version and backend provenance fields.
- [ ] Add a workspace-aware output naming/collision policy instead of allowing
  arbitrary destination paths.
- [ ] Add a user-visible capabilities panel showing available native backends,
  external tools, and degraded/fallback behavior.

## Static media product roadmap

This roadmap is application-facing. Reusable parsing, detection, metadata, and
conversion primitives belong in StaticMediaCompanion; these items describe how
the app turns them into safe, observable user workflows.

### Media workspace foundation — P0

- [ ] Add `StaticMediaCompanion` as a local development dependency and a tagged
  release dependency for distribution.
- [ ] Create `src/StaticMediaAdapter.jl` with typed helpers for inspection,
  text I/O, Markdown/HTML, planning, capabilities, and conversion jobs.
- [ ] Add adapter tests for allowed roots, symlink escapes, missing files,
  invalid UTF-8, oversized content, and unavailable native backends.
- [ ] Add versioned JSON schemas for `MediaInfo`, `ConversionPlan`,
  `ConversionResult`, capability diagnostics, and media job snapshots.
- [ ] Add a bounded media cache keyed by canonical path, file size, mtime,
  content hash when required, library version, backend, and options.

### Media Inspector — P0

- [ ] Add a native file-picker flow that displays kind, MIME, extension, size,
  image dimensions, and backend provenance.
- [ ] Add preview modes for text, Markdown, HTML text extraction, and image
  thumbnails without loading unbounded content into the WebView.
- [ ] Add clear states for unsupported, malformed, too-large, inaccessible,
  and backend-unavailable files.
- [ ] Add a “copy metadata” and “open containing folder” action with platform
  policy checks.

### Markdown and document workspace — P1

- [ ] Keep `note-markdown.js` as the application-specific renderer for figures,
  citations, print layout, and PDF exports.
- [ ] Add StaticMediaCompanion-backed generic Markdown preview/export for files
  that do not use application-specific extensions.
- [ ] Add profile selection: app Markdown, safe generic Markdown, CommonMark,
  and GFM when the native backend is available.
- [ ] Add HTML-to-text import for pasted web content, with script/style removal,
  source attribution, and a user-visible sanitization summary.
- [ ] Add front matter and document metadata preservation without mixing it
  into note/quiz DTOs.

### Conversion center — P1

- [ ] Add dry-run route previews with source/target kinds, selected backend,
  required tool, lossiness, estimated output, and warnings.
- [ ] Add `startMediaConversion`, `getMediaConversionStatus`, and
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

- [ ] Enforce all read/write roots after `realpath` resolution and test symlink
  and race-sensitive cases.
- [ ] Apply maximum input, output, nesting, and job-duration limits before
  invoking parsers or external tools.
- [ ] Keep network access disabled for HTML parsing and reject unsafe URL
  schemes in rendered content.
- [ ] Add cancellation and timeout handling for every external conversion.
- [ ] Add structured diagnostics that distinguish policy rejection, malformed
  input, unavailable capability, tool failure, and internal errors.
- [ ] Add native-shell smoke tests and browser/mock tests for each media feature.

### Acceptance criteria

The app can inspect a permitted local file, preview or extract its content,
explain available conversion routes, run expensive conversions as cancellable
jobs, and preserve enough provenance to reproduce the result. Generic media
behavior remains reusable in StaticMediaCompanion, while app-specific note,
paper, figure, citation, workspace, and UI behavior stays here.

## Phase 0: Julia Backend Bridge `[x]`

### WebView queue system

- `[x]` ManualWebview module with ccall bindings to webview C API.
- `[x]` Queue-based request routing (bind_queue!, next!, return!).
- `[x]` JSON serialization for request payloads and results.
- `[x]` Error handling with structured error envelopes.

### Backend module

- `[x]` Create `src/Backend.jl` with handler registry for all 36 CORE_BINDINGS.
- `[x]` Router: `handle_request(name, payload) -> (status, result_json)`.
- `[x]` State management: counter, notes, quizzes, scan jobs.
- `[x]` Window management bindings (minimize/maximize/restore/close) through
  the GTK bridge.

### Entry point

- `[x]` Update `bin/webview_app.jl` to register all 36 bindings on the queue.
- `[x]` Route all requests through `Backend.handle_request`.
- `[x]` Keep closeWindow/closeApp as special-cased exit signals.

### Dependency management

- `[x]` Add LinuxCompanion.jl as dev dependency in Project.toml.
- `[x]` Verify precompilation succeeds with all dependencies.

---

## Phase 1: Notes Backend `[x]`

### In-memory storage

- `[x]` `getNotes`: return all notes with id, title, tag, updated, body.
- `[x]` `createNote`: generate UUID-based id, set timestamp, return note.
- `[x]` `updateNote`: find by id, update fields, refresh timestamp.
- `[x]` `deleteNote`: find and remove by id.
- `[x]` Persistent storage: JSON file in ~/.config/julia-starter/notes.json.
- `[x]` Atomic writes with temporary file + rename.
- `[ ]` Auto-save with debouncing (match frontend note-save-coordinator timing).
- `[ ]` Migration from browser localStorage to Julia-persisted data.

### PDF export

- `[x]` `savePdf`: validate filename, sanitize for path traversal.
- [x] Actually write PDF bytes to ~/Documents/.
- [x] Create directory if it doesn't exist.
- [x] Return written file size and path.
- [x] Reject filenames with path traversal (../etc/passwd).

---

## Phase 2: Quiz Backend `[x]`

### In-memory storage

- `[x]` `quizList`: return all collections with nested questions.
- `[x]` `quizCreateCollection`: generate id, set defaults (tone, level).
- `[x]` `quizUpdateCollection`: find by id, update title/description.
- `[x]` `quizDeleteCollection`: remove collection and all its questions.
- `[x]` `quizCreateQuestion`: find parent collection, add question.
- `[x]` `quizUpdateQuestion`: find in collection, update all fields, parse tagsCsv.
- `[x]` `quizDeleteQuestion`: find in collection, remove question.
- [x] Persistent storage: JSON file in ~/.config/julia-starter/quizzes.json.
- [x] Import/export quiz collections as validated JSON.

---

## Phase 3: MIR Analysis Backend `[~]`

### Audio feature extraction

- `[x]` `mirAnalyze`: compute RMS, peak, ZCR from raw samples through Aural.
- `[x]` Return MirFeatures with sample_count, sample_rate, duration_seconds.
- `[x]` Add `../Aural.jl` as the reusable offline audio/MIR dependency.
- `[x]` Move Aural conversion and feature calls into
  `src/AudioAnalysisAdapter.jl`; keep `Backend.jl` focused on routing.
- `[x]` Preserve the current MirFeatures fields while adding a response schema
  version and explicit analysis profile metadata.
- `[ ]` Add spectral features (centroid, bandwidth, rolloff, flatness, flux)
  through Aural, with documented window/hop/FFT settings.
- `[ ]` Add MFCC/chroma summaries through Aural without returning unbounded
  frame matrices in the default response.
- `[ ]` Add peak dBFS, RMS/loudness summary, crest factor, DC offset, and ZCR
  with explicit numeric conventions.
- `[ ]` Add feature timestamps and provenance for every frame-based result.

### Ownership and validation

- `[x]` Validate finite samples, positive rate, maximum sample count, and
  maximum serialized payload in the Julia adapter.
- `[x]` Define mono-downmix and channel-selection behavior for file analysis.
- `[x]` Map `ArgumentError` and unsupported-format failures to stable frontend
  codes such as `InvalidAudioInput`, `UnsupportedAudioFormat`, and
  `AudioTooLarge`.
- `[~]` Add golden tests for sine, silence, impulse, stereo, and malformed WAV
  fixtures, comparing app JSON to Aural's documented results.
- `[ ]` Keep external `sox`/`ffprobe` use for format support or metadata only;
  do not duplicate Aural's in-memory DSP implementation in shell commands.

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
- `[x]` Use `find -maxdepth 3 -type f -printf "%s %p\n"` for file listing.
- `[x]` Classify files by extension (blender, audio, render, other).
- `[x]` `getAssetScanStatus`: return current job state and progress.
- `[x]` `cancelAssetScan`: request cooperative cancellation.
- [ ] Progress callbacks via channel instead of polling.
- [ ] Recursive depth configuration.
- [ ] Filter by file type (blender only, audio only, etc.).
- [ ] Integration with LinuxCompanion.jl inotify for live directory watching.

---

## Phase 5: Audio Metadata Backend `[~]`

### Metadata extraction

- `[x]` `getAudioMetadata`: return format, size from filesystem.
- `[x]` WAV header parsing for channels, sample rate, duration.
- `[x]` Fallback to soxi for AIFF/FLAC formats.
- [ ] Integration with LinuxCompanion.jl for running ffprobe/soxi.

### Audio analysis

- [x] `analyzeAudio`: dispatch supported WAV files through the Aural adapter.
- [~] Dispatch WAV files through a background Aural job and return a compact,
  versioned analysis summary.
- [ ] Keep sox/ffmpeg/ffprobe integration optional and explicit for formats
  Aural does not support.
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

## Phase 6: Frontend-Backend Integration `[x]`

### Remove Zig dependency

- [x] Backend module handles all 36 CORE_BINDINGS.
- [x] Remove `window.__PREACT_MOCK_BRIDGE__` checks (always native now).
- [x] Remove references to `src/main.zig` and `src/backend/core_plugin.zig` from docs.
- [x] Update bindings.d.ts to reference Julia backend instead of Zig.
- [x] Update backend.js comments to reference Julia Backend module.

### Register unregistered plugins

- [x] Register Chain Notes plugin in plugins/index.js.
- [x] Register Quiz plugin in plugins/index.js.
- [ ] Register Blender Companion plugin in plugins/index.js (if applicable).
- [ ] Register Todo plugin in plugins/index.js (if applicable).

### Backend status indicator

- [x] `getSystemInfo`: return actual Julia version, platform, LinuxCompanion version.
- [x] `getStatus`: return health status from LinuxCompanion `capabilities()`.
- [x] `backend-status.jsx`: show Julia backend version and connection status.

---

## Phase 7: Persistent Storage `[x]`

### Configuration directory

- [x] Create ~/.config/julia-starter/ on first run.
- [x] Store notes.json, quizzes.json.
- [x] Atomic writes with temporary file + rename.

### Data migration

- [ ] Import from browser localStorage when migrating from mock mode.
- [ ] Export to JSON for backup/restore.
- [ ] Schema versioning for forward compatibility.

### Settings

- [ ] Window size/position persistence.
- [ ] Plugin enable/disable state.
- [ ] Default scan paths configuration.

---

## Phase 8: LinuxCompanion.jl Integration `[~]`

### Process execution

- [x] Asset scanner uses LinuxCompanion.jl `Command` for `find` execution.
- [x] Asset scanner has timeout and cancellation support.
- [ ] Use LinuxCompanion.jl `Pipeline` for multi-step audio analysis (sox | soxi).
- [ ] Add `run_checked` for operations that must succeed.

### Filesystem operations (when available)

- [ ] Use LinuxCompanion.jl `Fd` for note file reads/writes.
- [ ] Use LinuxCompanion.jl `stat` for file metadata.
- [ ] Use LinuxCompanion.jl `watch` for live directory monitoring.
- [ ] Use LinuxCompanion.jl atomic writes for safe note persistence.

### Resource governance (when available)

- [ ] Use LinuxCompanion.jl cgroup limits for background scan processes.
- [ ] Use LinuxCompanion.jl capability diagnostics for privilege checking.

### Event loop (when available)

- [ ] Integrate LinuxCompanion.jl event loop with WebView pump.
- [ ] Use epoll for efficient request polling instead of sleep-based loop.

---

## Phase 9: Frontend Polish `[~]`

### Plugin registration

- [x] Add 8 plugins to the launcher (was 6, now 8 with Chain Notes and Quiz).
- [ ] Plugin enable/disable toggle in settings.
- [ ] Plugin ordering and favorites.

### UI improvements

- [ ] Loading states for async backend calls.
- [ ] Error toasts for failed operations.
- [ ] Offline indicator when backend is unavailable.
- [ ] Keyboard shortcuts for common actions.

### Testing

- [ ] Backend integration tests (Julia → frontend round-trip).
- [ ] Plugin unit tests for all registered plugins.
- [ ] E2E tests with WebView running.

---

## Phase 10: Build and Distribution `[ ]`

### Build pipeline

- [ ] Frontend production build optimization (tree-shaking, minification).
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

- [x] Validate all frontend inputs in Backend.jl (already partial).
- [x] Sanitize filenames for PDF export.
- [x] Prevent path traversal in asset scanning and PDF save.
- [ ] Rate limiting for backend requests.
- [ ] No secrets in repository (check for API keys, tokens).

---

## Documentation

- [x] README.md with installation and usage instructions.
- [ ] Backend API documentation (all 36 bindings with examples).
- [ ] Plugin development guide.
- [ ] Architecture diagram (frontend → queue → Julia Backend → LinuxCompanion).
- [ ] Contributing guidelines.
- [ ] Changelog.

---

## Definition Of Done

The application is complete when:
1. All 36 core frontend bindings work through the Julia Backend module.
2. Notes and quizzes persist across sessions with debounced writes.
3. Asset scanning uses LinuxCompanion.jl for process execution.
4. The frontend shows real system info from Julia/LinuxCompanion.
5. All registered plugins work without mock fallbacks.
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
12. Users can inspect waveform, spectral, tonal, and event results with clear
    unsupported/partial/error states and export compact, versioned artifacts.
13. Cross-project Aural contract tests pass for supported WAV inputs, malformed
    files, empty/short signals, numerical tolerances, and error translation.
13. The main loop uses epoll-based event dispatch instead of sleep-based
    polling, with sub-millisecond request latency and near-zero idle CPU.
