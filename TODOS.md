# TODOS.md — Pyramid Gap Register

Every item below is a gap preventing `PYRAMID-OF-INTENTS.md` from being true.
Items are grouped by pyramid layer (bottom-up). Within each layer, items are
tagged as:

- **[F]** Feature — new user-facing capability or data field
- **[A]** Abstraction — shared code, contract, or architecture piece
- **[3P]** Third-party — external library, tool, or platform integration

## Status Legend

- `[x]` Done — implemented and tested
- `[~]` Partial — exists but incomplete
- `[ ]` Not started

---

## Internal libraryization plan

The candidate libraries from the intent review are implemented first as
package-shaped internal modules. This keeps one repository and one test suite
while forcing stable APIs before any external split. `InternalLibraries` is the
catalog and boundary contract; it must remain metadata-only and must not become
another implementation layer.

### Candidate seams

| Candidate | Current module | Package | Status | Extraction gate |
| --- | --- | --- | --- | --- |
| Atomic stores | `Persistence` | `VersionedJSONStore` | `[x]` | Integrated through shim; PaperProjects and persistence tests pass. |
| Cooperative jobs | `Jobs` | `CooperativeJobManager` | `[x]` | Integrated through shim with correlation IDs; job tests pass. |
| Structured diagnostics | `Diagnostics` | `StructuredDiagnostics` | `[x]` | Integrated through instance-backed shim; redaction, recovery, and support export remain. |
| Workspace sandbox | `WorkspacePolicy` | — | `[~]` | Complete replacement-race/symlink tests and keep policy-free core primitives. |
| BibTeX | `BibTeX` | — | `[~]` | Expand parser fixtures and define compatibility/error policy. |
| Research document model | `PaperProjects` | — | `[~]` | Stabilize schema, provenance/artifacts, migrations, and renderer-neutral validation. |
| Renderer capabilities | `RendererCapability` | — | `[~]` | Make PDF/media exporters consume reports before rendering. |
| PDF generation | `PDFGen` | `PDFGen` | `[x]` | Canonical package is loaded by the app; historical source path forwards to it. |
| Bounded cache | `MediaCache` | `BoundedCache` | `[x]` | Integrated through shim; Backend state and RPC handlers added. |

### Package integration plan

Five packages have been extracted to `packages/`. Each must be integrated back
as the canonical internal module, replacing the current in-tree implementation.
The goal is **one source of truth per abstraction** — the package under
`packages/` is the implementation; the `src/` module becomes a thin re-export
or is deleted.

#### 1. CooperativeJobManager.jl → replaces `src/Jobs.jl`

**Current state:** `packages/CooperativeJobManager.jl` is canonical and carries
the app's `correlation_id` field. `src/Jobs.jl` is a compatibility shim.

- [x] **IJ-01** — Add `correlation_id` field to `_Job` struct and
  `create_job!` in `packages/CooperativeJobManager.jl`. Accept
  `correlation_id` kwarg with default `""`.
- [x] **IJ-02** — Include `correlation_id` in `_snapshot()` output dict.
- [x] **IJ-03** — Add `include("packages/CooperativeJobManager.jl/src/CooperativeJobManager.jl")`
  to `src/WebViewApp.jl` or add package as dev dependency in `Project.toml`.
- [x] **IJ-04** — Update `src/Backend.jl`: retain the stable `Jobs` shim over
  `using ..CooperativeJobManager` (or re-export from Jobs shim).
- [x] **IJ-05** — Update all consumers (`router.jl`, `analysis.jl`,
  `media.jl`) to use `CooperativeJobManager` API. Verify `correlation_id`
  flows through `create_job!` calls.
- [x] **IJ-06** — Delete or thin-wrap `src/Jobs.jl` to re-export from package.
- [x] **IJ-07** — Run `test/jobs.jl` (48 tests) — must pass unchanged.

#### 2. StructuredDiagnostics.jl → replaces `src/Diagnostics.jl`

**Current state:** `src/Diagnostics.jl` (83 lines) uses module-level globals.
Package `packages/StructuredDiagnostics.jl` (254 lines) is instance-based.

- [x] **ID-01** — Add `include("packages/StructuredDiagnostics.jl/src/StructuredDiagnostics.jl")`
  to `src/WebViewApp.jl` or add as dev dependency.
- [x] **ID-02** — Create `src/Diagnostics.jl` shim that creates a default
  `DiagnosticsStore()` and re-exports module-level `record!`, `recent`,
  `clear!`, `configure!`, `log_path` that delegate to the default store.
    ```julia
    module Diagnostics
    using ..StructuredDiagnostics: DiagnosticsStore, record!, recent, clear!, configure!, log_path
    const _default = DiagnosticsStore()
    record!(; kwargs...) = record!(_default; kwargs...)
    recent(n=200) = recent(_default, n)
    clear!() = clear!(_default)
    configure!(p) = configure!(_default, p)
    log_path() = log_path(_default)
    end
    ```
- [x] **ID-03** — Update `src/WebViewApp.jl` to `include` both
  `StructuredDiagnostics` (the package) and the `Diagnostics` shim.
- [x] **ID-04** — Verify all consumers (`router.jl`, `analysis.jl`,
  `media.jl`, `paper_projects.jl`) still work through the shim.
- [x] **ID-05** — Run `test/diagnostics.jl` or equivalent — must pass.

#### 3. VersionedJSONStore.jl → replaces `src/Persistence.jl`

**Current state:** `packages/VersionedJSONStore.jl` is canonical and zero-dep
with a strict inline JSON parser. `src/Persistence.jl` is a compatibility shim.

- [x] **IP-01** — Add `include("packages/VersionedJSONStore.jl/src/VersionedJSONStore.jl")`
  to `src/WebViewApp.jl` or add as dev dependency.
- [x] **IP-02** — Replace `src/Persistence.jl` with a thin shim:
    ```julia
    module Persistence
    using ..VersionedJSONStore: Store, StorageError, atomic_write!, load,
        normalize_json, save!, parse_json, json_string
    export Store, StorageError, atomic_write!, load, normalize_json, save!
    end
    ```
- [x] **IP-03** — Update `src/WebViewApp.jl` include order:
  `VersionedJSONStore` must come before `Persistence` shim.
- [x] **IP-04** — Verify `PaperProjects.jl` still works (it imports
  `..Persistence` for `Store`, `save!`, `load`, `normalize_json`,
  `atomic_write!`).
- [x] **IP-05** — Run `test/paper_projects.jl` (31 tests) — must pass.

#### 4. PDFGen.jl → align internal copy with package

**Current state:** `packages/PDFGen.jl/src/PDFGen.jl` is canonical. The app
loads it directly, and `src/pdf/PDFGen.jl` forwards legacy includes to it.

- [x] **IG-01** — Make `src/pdf/PDFGen.jl` a thin forwarding include:
    ```julia
    module PDFGen
    include("../../packages/PDFGen.jl/src/PDFGen.jl")
    end
    ```
    Or add package as dev dependency and `using ..PDFGen`.
- [x] **IG-02** — Verify `RendererCapability.jl` still calls
  `PDFGen.pdf_bytes` and `PDFGen.pdfgen_capability` correctly.
- [x] **IG-03** — Run module tests — must pass.

#### 5. BoundedCache.jl → replaces `src/MediaCache.jl`

**Current state:** `packages/BoundedCache.jl` is canonical and zero-dep.
`src/MediaCache.jl` is a compatibility shim; Backend owns the configured
application cache instance.

- [x] **IB-01** — Add `include("packages/BoundedCache.jl/src/BoundedCache.jl")`
  to `src/WebViewApp.jl` or add as dev dependency.
- [x] **IB-02** — Replace `src/MediaCache.jl` with a thin shim:
    ```julia
    module MediaCache
    using ..BoundedCache: CacheStore, cache_get!, cache_put!, cache_has!,
        cache_remove!, cache_clear!, cache_stats, cache_keys
    export CacheStore, cache_get!, cache_put!, cache_has!, cache_remove!,
        cache_clear!, cache_stats, cache_keys
    end
    ```
- [x] **IB-03** — Wire `BoundedCache` into `Backend.jl` STATE:
  create `STATE.media_cache = BoundedCache.CacheStore(...)`.
- [x] **IB-04** — Add `getMediaCacheStats` and `clearMediaCache` handlers
  in `router.jl` using the new cache API.
- [x] **IB-05** — Run cache-related tests — must pass.

### Integration execution order

The dependencies between packages dictate the order:

```
1. VersionedJSONStore  ← no deps, used by PaperProjects
2. CooperativeJobManager ← no deps, used by jobs/analysis/media
3. StructuredDiagnostics ← no deps, used by router
4. BoundedCache ← no deps, new in Backend
5. PDFGen ← no deps, used by RendererCapability
```

Each step follows: **copy → shim → rewire consumers → delete old → test**.

### Phased execution

- [x] **Phase 0 — Catalog seams.** Add `InternalLibraries.catalog()` and
  `candidate(id)` so module ownership and extraction readiness are inspectable.
- [x] **Phase 0.5 — Extract packages.** Five candidate libraries extracted to
  `packages/` as standalone Julia packages with zero external deps:
  `CooperativeJobManager`, `StructuredDiagnostics`, `VersionedJSONStore`,
  `PDFGen`, `BoundedCache`. All pass independent test suites (180 tests total).
- [x] **Phase 0.6 — Integrate packages as internal modules.** Wire extracted
  packages back into the app as canonical implementations. IP, IJ, ID, IB,
  and IG are complete. See "Package integration plan" above for the 5
  integration tracks (IJ, ID, IP, IG, IB). Each track follows: copy → shim →
  rewire consumers → delete old → test.
- [ ] **Phase 1 — Contract tests.** Give every candidate public-API tests,
  serialization fixtures, failure semantics, and dependency checks proving it
  does not import WebView, frontend, or backend routing code.
- [ ] **Phase 2 — Remove app policy from cores.** Move paths such as
  `~/Documents`, frontend error wording, RPC envelopes, and UI defaults to
  adapters; keep internal modules generic and deterministic.
- [ ] **Phase 3 — Internal consumers.** Make Backend, Paper Desk, and jobs use
  only the candidate public APIs. No consumer may reach private fields or
  helper functions across a candidate boundary.
- [ ] **Phase 4 — Independent package smoke builds.** In temporary package
  environments, load each candidate with only declared dependencies and run its
  contract tests. Do not publish until this passes.
- [ ] **Phase 5 — External extraction.** Extract one library at a time, pin a
  tagged sibling release, retain a compatibility adapter, and keep the app's
  DTO/policy layer in this repository.

### Explicit non-candidates

`AudioAnalysisAdapter`, `StaticMediaAdapter`, `ManualWebview`, and the native
launcher remain application adapters. Audio algorithms belong in `Aural.jl`,
generic media primitives in `StaticMediaCompanion.jl`, and desktop lifecycle
code in the host/companion layer. Extracting those adapters now would merely
relocate coupling rather than create a reusable library.

---

## Build.jl internal build system

`src/Build.jl` is the build-system seam for this repository. It is deliberately
pure: it plans and validates builds but never runs a subprocess. `run.sh`, CI,
and future packaging commands remain execution adapters.

- [x] Define `ProjectLayout` for frontend, native, generated outputs, and Julia
  entry points.
- [x] Discover frontend inputs and determine output freshness.
- [x] Determine native-library freshness and forced rebuild behavior.
- [x] Publish canonical frontend, native, and Julia command specifications.
- [x] Add `bin/build.jl` for human/CI build-plan inspection and stale-output
  checks.
- [x] Add isolated tests for layout discovery, freshness, force mode, and
  command specifications.
- [ ] Migrate `run.sh` prerequisite/build decisions to consume `Build.jl` plan
  output while keeping shell execution and colored UX.
- [x] Add a native build plan for pinned WebView source/version, compiler,
  pkg-config requirements, and bridge outputs; make failures structured.
- [x] Add frontend artifact verification to the plan: single-file HTML,
  inlined scripts/styles, root element, and no external asset references.
- [ ] Add CI/package profiles (`dev`, `test`, `release`) with explicit output
  directories and reproducible environment metadata.
- [x] Add a dry-run JSON output mode for CI and support tooling.

## User-local deployment

- [x] Add pure deployment planning for runtime inputs, user prefix, launcher,
  and desktop entry paths.
- [x] Add `bin/install.jl` for dry-run or user-local installation without root.
- [ ] Add distro-native packages (AppImage/deb/rpm) after the clean-install
  gate confirms dependency and sibling-package release policy.
- [ ] Add upgrade/uninstall commands with versioned migrations and rollback.

## Testing coverage audit

- [x] Add abstraction edge cases for binding drift, error registry invariants,
  invalid build/deployment artifacts, and diagnostics rotation.
- [ ] Run the complete Julia suite in a writable clean depot with all sibling
  dependencies available; retain the result as a release check.
- [ ] Add property-based/fuzz fixtures for JSON persistence, BibTeX nesting,
  RPC payload limits, and workspace path normalization.
- [ ] Add a display-backed desktop smoke test covering startup, one RPC round
  trip, and orderly window shutdown on each supported WebKitGTK release.

---

## L5 — Foundation (Platform & Infrastructure)

*What the app stands on. Remove these, everything collapses.*

### 5.1 Linux/GTK + WebKitGTK 4.1

- [x] GTK3 window lifecycle (minimize, maximize, restore, close)
- [x] WebKitGTK HTML loading via `webview_set_html()`
- [x] GLib main-context iteration replacing fixed-poll event loop
- [ ] **[A] P5-PLATFORM-01** — Define and test the supported Linux release
  contract: GTK/WebKit versions, native library discovery, display/no-display
  behavior, packaging/install prerequisites, upgrade/migration on supported
  distros.

### 5.2 Julia Backend

- [x] Julia 1.10+ runtime with `Project.toml` / `Manifest.toml`
- [x] 40 RPC handlers registered and dispatched
- [~] **[A] P4-RPC-01** — Centralize request contracts. Generate or validate a
  versioned binding manifest for frontend adapters, Julia handlers, argument
  limits, result schemas, and error codes; reject drift in CI.
  - **UPDATED (2026-09-18):** Added `BindingManifest.jl` with a versioned
    frontend/backend/window binding contract, launcher integration, and drift
    reports. Argument/result schema validation and CI enforcement remain.
- [~] **[A] P3-EXPORT-01** — Add a renderer capability contract. Declare which
  Markdown, citation, figure, table, font, and layout features each PDF/media
  backend supports; the internal `RendererCapability` module exists, but
  exporter adoption and warning enforcement remain.
  - **DONE (2026-09-18):** Created `src/RendererCapability.jl` with `CapabilityReport`
    struct, `check_capability()`, `merge_reports()`, `pdfgen_capability()`, and
    `list_capabilities()`. New `getRendererCapabilities` handler exposes capabilities
    to frontend. PDFGen reports: headings, bold, plain-text, helvetica, single/two-column.

### 5.3 Webview Frontend (Octane + Tailwind)

- [x] Single self-contained HTML output (Rsbuild)
- [x] Tailwind CSS design system
- [x] Workspace routing (Writing, Music, Research, Media)
- [~] **[F] P4-UX-01** — Expose settings and failure states. Persist window
  state, workspace roots, default paths, plugin state, recent projects, and
  explicit native capability/degraded-mode indicators in the active frontend.
  Active frontend now exposes theme/font settings and recent diagnostics;
  persistence of the remaining settings and native capability states remains.
- [x] **[F] P4-DATA-01** — Add backup/restore for the active project model.
  Export and restore notes, projects, provenance, and reproducibility records
  with schema checks, conflict handling, and no accidental overwrite.
  - **DONE (2026-09-18):** Added `backupPaperProject`, `restorePaperProject`, and
    `listPaperProjectBackups` handlers. Backups stored in `.backups/` directory
    within the project with timestamped filenames.

### 5.4 C++ Bridge (Mutex-Protected Queue)

- [x] Bounded thread-safe queue between GTK and Julia
- [x] `webview_return()` for frontend responses
- [x] Burst-drain integration tests
- [x] Display-free native integration coverage

### 5.5 Security Model

- [x] Workspace policy (canonical paths, symlink resolution)
- [x] Path traversal blocking
- [x] Payload size limits (MIR ≤16 MB, general ≤32 MB, BibTeX ≤4 MB, PDF ≤16 MB)
- [x] Filename sanitization
- [~] **[A] P4-SAFE-01** — Complete path-policy hardening. Test replacement
  races, symlink changes between validation and use, configured roots, volume
  roots, export destinations, and project handles. Keep policy mapping in one
  shared abstraction.
- [ ] **[F] P4-PERF-01** — Add per-operation concurrency and resource budgets
  where payload limits and job-manager bounds are insufficient.
- [ ] **[F] Security scan** — Add automated secret scanning to CI as a
  recurring repository check.

---

## L4 — Lower (Core Data & Storage)

*The plumbing. Data flows through these before it becomes visible.*

### 4.1 Atomic File Persistence

- [x] `atomic_write!` with `tempname()` + `mv()`
- [x] Notes, settings, paper projects all use atomic writes
- [x] Schema-versioned JSON envelopes with legacy compat
- [x] **[A] IP-INT** — Integrate `VersionedJSONStore` package as canonical
  `Persistence` module. Replace JSON3-dependent implementation with zero-dep
  package. Shim `src/Persistence.jl` to re-export package API.
  - Package at `packages/VersionedJSONStore.jl` (393 lines, 39 tests, zero deps).
  - **DONE:** IP-01 through IP-05. `Persistence` is now a compatibility shim;
    PaperProjects and persistence tests pass.

### 4.2 paper.json Manifest

- [x] Basic schema: metadata, sections, references, layout, source
- [x] Schema migration (v0 → v1)
- [x] Reproducibility manifest with content hash
- [~] **[F] P3-MODEL-01** — Version the complete paper schema. Persist
  metadata, references, figures, tables, layout, source provenance, plugin
  state, and export profile as one migratable project contract; add schema
  migration and fixture tests.
  - **DONE (2026-09-18):** `paper.json` now includes `figures` (id, path, caption,
    position), `layout` (columns, margins, fonts), `source` (importedFrom, importedAt),
    and `provenance` (artifacts, searchSources, mediaSources, audioSources, importWarnings).
    Validation added for figures (id, path required) and provenance artifacts (id, kind required).
- [x] **[F] figures field** — Add `figures` array to `paper.json`:
  `[{id, path, caption, position}]` for tracking embedded images.
  - **DONE (2026-09-18):** Figures array normalized and validated in PaperProjects.jl.
- [x] **[F] layout field** — Add `layout` object to `paper.json`:
  `{columns, margins, fonts}` for per-project layout preferences.
- [x] **[F] source field** — Add `source` object to `paper.json`:
  `{importedFrom, importedAt}` for tracking original PDF provenance.

### 4.3 RPC Handler Dispatch

- [x] Router with `HANDLERS` dict, 40+ registered bindings
- [x] Request ID, structured error envelopes
- [~] **[A] P4-RPC-01** — Centralize request contracts (see 5.2)
  - **DONE (2026-09-18):** Created `src/ErrorCodes.jl` with 44 centralized error codes.
    `_error_category()` and `_recoverable_error()` in router.jl now delegate to ErrorCodes module.
    New handlers: `getRendererCapabilities`, `getErrorCodes`.

### 4.4 Diagnostics (JSONL Logging)

- [x] `Diagnostics.record!` with JSONL rotation at 2 MB
- [x] Bounded recent-entry retrieval
- [x] Clear operation
- [x] **[A] ID-INT** — Integrate `StructuredDiagnostics` package as canonical
  `Diagnostics` module. Replace module-global implementation with instance-based
  zero-dep package. Shim `src/Diagnostics.jl` to re-export via default store.
  - Package at `packages/StructuredDiagnostics.jl` (254 lines, 34 tests, zero deps).
  - Tracks: ID-01 through ID-05.
- [~] **[A] P4-OBS-01** — Make diagnostics actionable. Add UI access to
  recent diagnostics, operation correlation, redaction tests, retention checks,
  and recoverable guidance for policy, storage, capability, timeout, and tool
  failures.
  - **DONE (2026-09-18):** Correlation IDs added to Jobs.jl (`correlation_id` field on
    every job). All background jobs (asset scan, audio analysis, media conversion)
    now carry correlation IDs for request tracing.
- [x] **[F] Correlation IDs** — Add correlation IDs to background scan, audio,
  and conversion jobs so a request can be followed through queued, running,
  completed, cancelled, and failed events.
- [ ] **[F] Startup recovery** — Load recent JSONL entries at startup so
  diagnostics survive application restarts, while tolerating
  malformed/truncated lines after a crash.
- [ ] **[F] Support bundle** — Add opt-in support-bundle export containing
  diagnostics, app/runtime versions, capability status, and sanitized
  settings — never user documents.
- [ ] **[F] Redaction** — Add recursive redaction and size limits for
  diagnostic `details` before persistence/export (tokens, credentials, home
  paths, document content, oversized stack traces).

### 4.5 Jobs System

- [x] `Jobs.jl` with cooperative cancellation, bounded retention
- [x] Lock-protected job state
- [x] Thread-safe completion, failure, eviction
- [x] **[A] IJ-INT** — Integrate `CooperativeJobManager` package as canonical
  `Jobs` module. Port `correlation_id` field into package, then replace
  in-tree implementation. Shim `src/Jobs.jl` to re-export package API.
  - Package at `packages/CooperativeJobManager.jl` (382 lines, 48 tests, zero deps).
  - **DONE:** IJ-01 through IJ-07. `correlation_id` is part of the package DTO;
    `Jobs` is now a compatibility shim and all job consumers remain compatible.
- [~] **[A] P3-JOBS-01** — Finish job lifecycle governance. Add TTL cleanup,
  durable/restart-aware status where appropriate, progress semantics, and a
  common job DTO across scans, audio, and media conversion.
- [x] **[F] TTL cleanup** — Clean up completed jobs from `STATE.scan_jobs`,
  `STATE.audio_jobs`, and `STATE.media_jobs` dicts after a configurable TTL
  (e.g. 5 minutes) to prevent unbounded memory growth during long sessions.
  Compatibility views are now pruned whenever the shared `Jobs.JobManager`
  cleans up retained jobs.

---

## L3 — Middle (Tools & Workspaces)

*Each tool serves a specific role in the workflow.*

### 3.1 Notes

- [x] CRUD (create, read, update, delete)
- [x] Debounced JSON persistence
- [x] Single-column PDF export
- [x] Backup/restore via frontend

### 3.2 Paper Desk (The Hub)

- [x] Create, open, save, validate paper projects
- [x] Export to PDF (text-only, two-column)
- [x] Project handle lifecycle with LRU eviction
- [~] **[F] P2-COMP-01** — Complete structured paper editing. Add
  multi-section editing, section tree operations, autosave, Markdown preview,
  validation feedback, and full TOC editing.
  - **DONE (2026-09-18):** Export validation feedback added. `_validate_for_export()`
    checks for empty sections, empty abstract, missing references, missing figure files,
    and missing layout/template. Warnings returned in export response.
- [~] **[F] P2-DELIVER-01** — Add user-facing delivery controls. Implement
  export profiles, destination/overwrite policy, output naming, PDF preview,
  and clear measured/partial/unsupported export states. Layout selection and
  validation are now exposed; profiles and preview remain.
- [ ] **[F] Inline section editor** — Edit Markdown section body with a
  rendered PDF preview panel showing approximate layout.
- [ ] **[F] Export profiles** — Academic, report, letter, custom — preset
  margins, column layout, font choices, heading styles, and header/footer
  content.

### 3.3 References (BibTeX)

- [x] Parse BibTeX source (≤4 MB)
- [x] Import/export `.bib` files
- [x] Merge entries into paper project
- [x] Deduplication by key
- [~] **[F] P2-COMP-02** — Make references project-local and verifiable.
  Resolve citations, detect missing/duplicate/unused entries, support explicit
  merge and manual correction, and record bibliography style/provenance.
- [ ] **[F] Per-PDF references model** — Versioned project-local `references`
  model with stable citation keys, bibliographic fields, citation usage,
  ordering, source provenance, and validation state.
- [~] **[F] Citation resolution** — Resolve citations against the active
  project's references; missing and unused keys are now reported during
  validation. Duplicate, malformed, and richer citation reconciliation remain.
- [ ] **[F] Bibliography styles** — Configurable deterministic bibliography
  styles; record style, ordering, imports, and normalization decisions in
  export provenance.
- [ ] **[F] Import reconciliation** — Recover bibliography entries and citation
  links during PDF import; mark uncertain matches, provide manual
  reconciliation tools.

### 3.4 MIR Lab

- [x] WAV file analysis (quick + spectral profiles)
- [x] RMS, peak, ZCR, spectral features
- [x] Async job with cancellation
- [ ] **[3P] P5-AUDIO-01** — Govern optional audio codecs. Decide whether
  AIFF, FLAC, and OGG are supported through an explicit `ffprobe`/`soxi` or
  Julia codec adapter; document licensing, executable discovery, size/time
  limits, and measured/partial/unsupported results. Keep DSP in Aural.jl.
- [ ] **[F] Richer profiles** — Tonal/rhythmic summaries (MFCC/chroma,
  loudness/dBFS, crest factor, DC offset, timestamps/provenance) through
  Aural, exposed through versioned DTOs.

### 3.5 Media Tools (File Browser, Inspector, Scanner, Gallery)

- [x] Directory listing with extension filter
- [x] Media inspection (kind, MIME, dimensions)
- [x] Async volume scanning with classification
- [x] Image gallery with lightbox
- [x] `StaticMediaCompanion` adapter (inspect, markdown, read/write, convert)
- [~] **[3P] P5-MEDIA-01** — Complete `StaticMediaCompanion` integration.
  Finish capability/provenance/error DTOs, bounded previews, cache behavior,
  and cancellable external conversion; keep reusable parsing/conversion in the
  companion library.
- [ ] **[3P] P5-FILES-01** — Add governed native file selection. Integrate a
  GTK file chooser (or WebView-safe bridge) for files/directories, enforce the
  same canonical path policy, and test cancellation and blocked paths.
- [ ] **[F] Bounded media cache** — Cache thumbnails, extracted text, PDF
  import intermediates, and audio summaries by canonical path/content hash/tool
  version/options, with eviction and quotas.
  - **Package extracted:** `packages/BoundedCache.jl` (218 lines, 34 tests, zero deps).
  - Integration tracks: IB-01 through IB-05.
- [ ] **[F] Native file picker** — Add a native file-picker flow for media
  inspection that displays kind, MIME, extension, size, image dimensions, and
  backend provenance.
- [ ] **[F] Media preview modes** — Preview text, Markdown, HTML text
  extraction, and image thumbnails without loading unbounded content into the
  WebView.

### 3.6 Direct Search

- [x] 23 search provider URLs
- [x] Opens in external browser
- [x] Provider URL encoding and popup-blocked fallback
- [ ] **[F] P2-RESEARCH-01** — Turn discovery into deliberate inputs. Let a
  user attach search URLs, map sources, media paths, and audio findings to a
  paper with capture date, license/attribution, source hash, and explicit
  consent.
- [ ] **[F] Map figures** — Support map-related research as PDF figure input:
  import permitted map images/data, preserve attribution/provenance, and place
  selected map media in paper figures.
- [ ] **[F] Search provenance** — Add paper-project provenance for search
  source URLs, map source/license, capture date, and any manual figure
  transformations.

---

## L2 — Upper (PDF Round-Trip — The Core Workflow)

*The reason the tools exist. This is the loop that produces documents.*

### 2.1 Import PDF → Extract Text + Structure + Images

- [ ] **[3P] P5-PDF-01** — Select and integrate a maintained PDF parser.
  Evaluate `Poppler_jl`/`PDFIO.jl` (or equivalent) for text geometry, images,
  fonts, metadata, outlines, malformed files, and licensing/build costs; pin
  it in `Project.toml` only after a fixture-backed spike.
- [ ] **[F] PDFReader.jl** — Create `src/pdf/PDFReader.jl` module: parse PDF
  structure, extract text blocks with positional metadata (page, column,
  y-offset, font), extract embedded images as separate files, detect heading
  structure from font sizes.
- [ ] **[F] importPdf handler** — Backend handler that validates the source
  PDF, preserves it as an immutable source artifact, and returns structured
  content.
- [ ] **[F] Extraction report** — Produce an extraction report covering
  uncertain text, missing fonts, unsupported vectors/tables/OCR, and
  approximate geometry.
- [ ] **[F] PDF import UI** — Paper Desk file picker → import → populate
  sections/figures in `paper.json` with extracted content and images.

### 2.2 Edit Extracted Content In-App

- [x] **[F] Multi-section editing** — Edit all sections, not just the first.
- [~] **[F] Section tree operations** — Add, remove, and reorder sections;
  nesting remains.
- [x] **[F] Autosave** — Debounced persistence during editing when enabled in
  Paper Desk; validation failures prevent writes.
- [~] **[F] Markdown preview** — On-demand rendered preview of section content
  now uses the safe StaticMediaCompanion Markdown binding; live preview remains.
- [x] **[F] Validation feedback** — Show errors/warnings before save/export.
- [~] **[F] Full TOC editing** — Edit all TOC titles, hierarchy levels, and
  visibility without duplicating section content; ordering controls remain.
- [ ] **[F] Figure placement UI** — Browse images from gallery, set caption
  text, choose position/size, preview placement before export.

### 2.3 Export High-Quality PDF

- [x] Basic PDF 1.4 generation (Helvetica, 1/2-column)
- [x] Title + body text rendering
- [x] Save to `~/Documents`
- [x] Export from paper project
- [x] **[A] IG-INT** — Align `src/pdf/PDFGen.jl` with standalone package.
  Make internal copy a thin re-export of `packages/PDFGen.jl` to eliminate
  duplication. Verify `RendererCapability` still works.
  - Package at `packages/PDFGen.jl` (469 lines, 25 tests, zero deps).
  - **DONE:** IG-01 through IG-03. The app loads the package implementation;
    the historical source path is a forwarding include.
- [ ] **[3P] P5-PDF-02** — Upgrade native PDF generation or add a layout
  engine. Support image XObjects, tables, font variants, page numbers,
  bookmarks, configurable geometry, and deterministic output. Keep the
  dependency behind `PDFGen.jl` and record its version in reproducibility
  metadata.
- [ ] **[F] Image embedding** — Extend `PDFGen.jl` to support image objects:
  PNG and JPEG XObject streams with proper coordinate placement, scaling, and
  aspect-ratio preservation.
- [ ] **[F] Configurable margins** — Top, bottom, left, right margins, column
  gaps, and line spacing (leading) with sensible defaults.
  - **DONE (2026-09-18):** `pdf_bytes()` and `write_pdf()` accept `margins`
    parameter as Dict or `Margins` struct. Default: top=48, bottom=48, left=54,
    right=54. Layout dynamically computed from margins.
- [ ] **[F] Page numbers** — Automatic page numbers with configurable position
  (top/bottom, left/center/right).
  - **DONE (2026-09-18):** Automatic page numbers at bottom-right of every page.
    Enabled by default via `page_numbers=true` parameter.
- [ ] **[F] Headers/footers** — Running headers/footers with configurable
  content (title, section name, page N).
- [x] **[F] PDF bookmarks/outline** — Generate from heading structure with
  proper nesting depth for section navigation.
  - **DONE (2026-09-18):** PDF outline objects generated from heading structure.
    Each `#`/`##`/`###` heading becomes a bookmark entry. Enabled via
    `bookmarks=true` parameter. Outline root + items written as PDF objects.
- [ ] **[F] Bold/italic fonts** — Extend `PDFGen.jl` to support inline font
  switching for `**bold**` and `*italic*` Markdown.
  - **DONE (2026-09-18):** Added Helvetica-Oblique (F3) and Helvetica-BoldOblique
    (F4) fonts. Inline parsing: `**bold**` → F2, `*italic*` → F3,
    `***bold italic***` → F4.
- [x] **[F] Font hierarchy** — H1-H6 with proper sizing (replace current
  heading-as-bold-body).
  - **DONE (2026-09-18):** H1=12pt, H2=11pt, H3-H4=10pt, H5-H6=9pt (all bold F2).
    Title=14pt bold. Heading level parsed from markdown `#` markers.
- [ ] **[F] Image extraction during import** — Detect and save embedded images
  to project `images/` directory with generated filenames.

### 2.4 Re-Import to Verify (Round-Trip)

- [ ] **[F] verifyPdf handler** — Import exported PDF, compare structure
  (sections, word count, image count, heading count) to source `paper.json`,
  report differences as a structured diff.
- [ ] **[F] Visual diff** — Show original content vs. re-imported content
  side-by-side with highlighted additions/removals/changes.
- [ ] **[F] Text fidelity** — No character loss, no encoding corruption, no
  whitespace normalization across export → import round-trips.
- [ ] **[F] Image fidelity** — Embedded images match source files (byte-level
  comparison or perceptual hash).

---

## L1 — Peak (The Ultimate Purpose)

*Why this app exists. Everything below serves this goal.*

### 1.1 Produce high-quality, hand-tuned PDFs

- [~] **[F] P1-OUT-01** — Close the authoring-to-delivery loop. Paper Desk
  must edit the full validated project model, export all supported content, and
  reopen the saved source without losing fields. Current UI edits all sections
  and TOC entries with validation; export is still primarily textual.
- [ ] **[F] P1-OUT-02** — Establish export fidelity. Add fixture-based
  semantic and visual checks for headings, citations, references, tables,
  figures, metadata, page geometry, and selected export profiles.
- [ ] **[F] P1-OUT-03** — Add safe PDF reconstruction. Import an existing PDF
  into a new project while preserving the original source artifact, extraction
  warnings, provenance, and a user review step.

---

## Cross-Pyramid Completion Gates

These are end-to-end acceptance tests that prove the pyramid holds.

- [ ] **GATE-01 — End-to-end paper fixture.** Note/BibTeX/source media →
  validated `paper.json` → PDF export → reopen/verify, with no source
  overwrite.
- [ ] **GATE-02 — Failure matrix.** Every user-facing operation has tests for
  invalid input, missing/forbidden path, oversize input, unavailable backend,
  cancellation/timeout, storage failure, and structured recovery guidance.
- [ ] **GATE-03 — Clean installation.** A fresh supported Linux environment
  can install dependencies, build the single-file frontend/native bridge, run
  the test suite, and launch with the documented commands.

---

## Third-Party Integration Tracker

External dependencies that must be selected, integrated, and governed.

| ID | Library/Tool | Purpose | Status | Notes |
|---|---|---|---|---|
| P5-PDF-01 | `Poppler_jl` or `PDFIO.jl` | PDF parsing (text, images, fonts, metadata) | `[ ]` Not started | Evaluate in a fixture-backed spike before pinning |
| P5-PDF-02 | PDF layout engine (TBD) | Image XObjects, tables, fonts, page numbers, bookmarks | `[ ]` Not started | May extend `PDFGen.jl` or add new dependency |
| P5-AUDIO-01 | `ffprobe`/`soxi` or Julia codec | AIFF/FLAC/OGG metadata support | `[~]` Partial | WAV only; optional codecs governed separately |
| P5-MEDIA-01 | `StaticMediaCompanion.jl` | Media detection, Markdown, text I/O, conversion | `[~]` Partial | Local path `../StaticMediaCompanion.jl` |
| P5-FILES-01 | GTK file chooser or WebView bridge | Native file/directory selection | `[ ]` Not started | Must enforce workspace policy |
| P5-DIST-01 | Tagged releases for sibling packages | `Aural.jl`, `LinuxCompanion.jl`, `StaticMediaCompanion.jl` | `[~]` Partial | Currently local-path-only development |
| — | `Aural.jl` | Audio analysis (MIR, DSP, WAV) | `[x]` Integrated | Local path `../Aural.jl` |
| — | `LinuxCompanion.jl` | Linux system capabilities, process execution | `[x]` Integrated | Local path `../LinuxCompanion.jl` |

---

## Abstraction Tracker

Shared code, contracts, or architecture pieces that need building or completion.

| ID | Abstraction | Layer | Status | Notes |
|---|---|---|---|---|
| P3-MODEL-01 | Complete paper schema versioning | L3 | `[~]` Partial | `paper.json` now has figures, layout, source, provenance; migration fixtures remain |
| P3-MODEL-02 | Provenance and artifact records | L3 | `[x]` Done | Provenance model with artifacts, searchSources, mediaSources, audioSources implemented |
| P3-MODEL-03 | Bounded preview/cache abstraction | L3 | `[x]` Done | Package `BoundedCache` integrated; Backend state and cache handlers are available |
| P3-JOBS-01 | Common job DTO | L3/L4 | `[x]` Done | Package `CooperativeJobManager` integrated; correlation IDs and retention are covered |
| P3-EXPORT-01 | Renderer capability contract | L3 | `[x]` Done | `RendererCapability.jl` with CapabilityReport, check_capability, pdfgen_capability |
| P4-RPC-01 | Versioned binding manifest | L4/L5 | `[~]` Partial | `BindingManifest.jl` centralizes frontend/backend/window names; argument/result schemas and CI enforcement remain |
| P4-SAFE-01 | Single path-policy abstraction | L4 | `[~]` Partial | Exists; needs replacement-race and edge-case hardening |
| P4-OBS-01 | Actionable diagnostics | L4 | `[~]` Partial | Package-backed `Diagnostics` shim is integrated; UI access, redaction, recovery, and support export remain |
| IP-INT | VersionedJSONStore integration | L4 | `[x]` Done | Package extracted (393 lines, 39 tests); `Persistence` shim and consumers integrated |
| ID-INT | StructuredDiagnostics integration | L4 | `[x]` Done | Package-backed `Diagnostics` shim is canonical; consumers retain the stable module-level API |
| IJ-INT | CooperativeJobManager integration | L4 | `[x]` Done | Package extracted (382 lines, 48 tests); correlation_id port and `Jobs` shim integrated |
| IG-INT | PDFGen package alignment | L2 | `[x]` Done | Package extracted (469 lines, 25 tests); app and legacy path use the canonical implementation |
| IB-INT | BoundedCache integration | L3 | `[x]` Done | Package extracted (218 lines, 34 tests); Backend state and cache RPC handlers integrated |

---

## Feature Tracker (by User Capability)

Maps each user capability from L2 to the specific features needed.

### Capture and Develop

| Feature | Status | Dependencies |
|---|---|---|
| Persistent notes with title, tag, body | `[x]` | — |
| Single-column PDF export for notes | `[x]` | PDFGen.jl |
| Backup/restore notes | `[x]` | writeText, readText |

### Compose a Structured Paper

| Feature | Status | Dependencies |
|---|---|---|
| Create/open/save paper projects | `[x]` | PaperProjects.jl |
| Metadata, sections, TOC, references | `[~]` | paper.json schema |
| Multi-section editing | `[x]` | Frontend UI |
| Section tree operations | `[~]` | Frontend UI; nesting remains |
| Autosave | `[x]` | Frontend + backend |
| Markdown preview | `[~]` | StaticMediaCompanion; on-demand preview exists |
| Validation feedback | `[x]` | paper.json schema + Paper Desk |
| Full TOC editing | `[~]` | paper.json schema |
| Figures array in paper.json | `[ ]` | paper.json schema |
| Layout object in paper.json | `[x]` | paper.json schema |
| Export profiles | `[~]` | PDFGen.jl + UI; column selection exists |

### Substantiate Claims

| Feature | Status | Dependencies |
|---|---|---|
| Parse BibTeX source | `[x]` | BibTeX.jl |
| Import/export .bib files | `[x]` | BibTeX.jl |
| Merge into paper project | `[x]` | paper_projects.jl |
| Per-project reference isolation | `[ ]` | paper.json schema |
| Citation resolution | `[~]` | BibTeX.jl + paper.json; missing/unused checks exist |
| Missing/duplicate/unused detection | `[~]` | BibTeX.jl; missing/unused checks exist |
| Bibliography style presets | `[ ]` | PDFGen.jl |

### Find Supporting Material

| Feature | Status | Dependencies |
|---|---|---|
| Direct search (23 providers) | `[x]` | Frontend only |
| Directory browsing | `[x]` | media.jl |
| Media inspection | `[x]` | StaticMediaCompanion |
| Asset scanning | `[x]` | FileTrees.jl |
| Image gallery with lightbox | `[x]` | Frontend |
| Native file picker | `[ ]` | GTK/WebView bridge |
| Search → paper attachment | `[ ]` | paper.json + UI |
| Map figure import | `[ ]` | PDF import + media |

### Understand Audio Material

| Feature | Status | Dependencies |
|---|---|---|
| WAV metadata | `[x]` | AudioAnalysisAdapter |
| Quick/spectral MIR analysis | `[x]` | Aural.jl |
| Async job with cancellation | `[x]` | Jobs.jl |
| AIFF/FLAC/OGG support | `[~]` | ffprobe/soxi (optional) |
| Richer tonal/rhythmic profiles | `[ ]` | Aural.jl |

### Deliver and Revisit

| Feature | Status | Dependencies |
|---|---|---|
| Native PDF generation | `[x]` | PDFGen.jl |
| Two-column layout | `[x]` | PDFGen.jl |
| Save to ~/Documents | `[x]` | Persistence.jl |
| Project open/save/validate | `[x]` | PaperProjects.jl |
| Reproducibility manifest | `[x]` | SHA, paper_projects.jl |
| Image embedding in PDF | `[ ]` | PDFGen.jl extension |
| Configurable margins/leading | `[x]` | PDFGen.jl — `margins` parameter |
| Page numbers, headers/footers | `[x]` | PDFGen.jl — `page_numbers` parameter |
| PDF bookmarks/outline | `[x]` | PDFGen.jl — `bookmarks` parameter |
| Bold/italic font variants | `[x]` | PDFGen.jl — F3/F4 fonts + inline parsing |
| Font hierarchy (H1-H6) | `[x]` | PDFGen.jl — `_HEADING_SIZES` dict |
| PDF import from existing file | `[ ]` | PDF parser (3P) |
| Round-trip verification | `[ ]` | PDF parser + PDFGen |
| Safe PDF reconstruction | `[ ]` | PDF parser + PaperProjects |

---

## Summary: Gap Count by Layer

| Layer | Features | Abstractions | 3P Integrations | Total |
|---|---|---|---|---|
| L5 — Foundation | 3 | 2 | 1 | 6 |
| L4 — Lower | 4 | 5 | 0 | 9 |
| L3 — Middle | 15 | 1 | 3 | 19 |
| L2 — Upper | 15 | 1 | 2 | 18 |
| L1 — Peak | 3 | 0 | 0 | 3 |
| **Total** | **40** | **9** | **6** | **55** |

**Completed since initial audit (15 items):**
- P3-MODEL-01: paper.json schema (figures, layout, source, provenance) — DONE
- P3-JOBS-01: TTL cleanup already integrated — DONE
- P3-MODEL-02: Provenance/artifact model — DONE
- P3-EXPORT-01: Renderer capability contract — DONE
- P4-DATA-01: Backup/restore for project model — DONE
- P4-OBS-01: Correlation IDs for background jobs — DONE
- P4-RPC-01: Centralized error-code registry — DONE
- P2-COMP-01: Export validation feedback — DONE
- PDFGen: Page numbers — DONE
- PDFGen: Configurable margins — DONE
- PDFGen: Bold/italic fonts — DONE
- PDFGen: Font hierarchy (H1-H6) — DONE
- PDFGen: PDF bookmarks/outline — DONE
- P3-MODEL-03: Bounded media cache — DONE
- P2-RESEARCH-01: Search provenance — DONE

**Packages extracted (5 libraries, 178 tests, 0 deps):**
- `CooperativeJobManager.jl` — 48 tests, replaces `Jobs.jl`
- `StructuredDiagnostics.jl` — 34 tests, replaces `Diagnostics.jl`
- `VersionedJSONStore.jl` — 39 tests, replaces `Persistence.jl`
- `PDFGen.jl` — 25 tests, aligns with `src/pdf/PDFGen.jl`
- `BoundedCache.jl` — 34 tests, replaces `MediaCache.jl`

**The bottleneck is L2 (Upper) and L3 (Middle).** The foundation (L5) is
solid. The data layer (L4) is mostly complete. But the core PDF workflow (L2)
and the tools that feed it (L3) have the most gaps. The highest-leverage work
is:

1. **Package integration** (IJ/ID/IP/IG/IB) — wire 5 extracted packages back
   into the app as canonical modules, eliminating duplication and enabling
   independent testing.
2. **PDF parser integration** (P5-PDF-01) — unblocks L2.1 (import) and L2.4
   (round-trip verification)
3. **Image embedding** (P5-PDF-02) — unblocks L2.3 (export) and makes papers
   visually complete
4. **Complete paper editing** (P2-COMP-01) — unblocks L2.2 (edit) and L1
   (outcome)

Until these land, the pyramid peak remains an aspiration.
