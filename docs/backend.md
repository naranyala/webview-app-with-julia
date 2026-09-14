# Backend and bridge

## Julia WebView wrapper

`src/ManualWebview.jl` is a direct wrapper around the WebView C API. It
does not depend on a Julia WebView package. The exported surface includes:

- window lifecycle: `create`, `destroy!`, `run!`, `is_open`, `terminate!`;
- GTK actions: `minimize!`, `maximize!`, `restore!`, `close!`;
- window content: `html!`, `init!`, `eval!`, `set_title!`, `set_size!`;
- event loop: `pump!`;
- bridge queue: `create_queue`, `destroy_queue!`, `bind_queue!`, `next!`;
- request access: `request_id`, `request_name`, `request_payload`, `Base.close`;
- responses: `return!`.

Library paths default to `native/lib/libwebview.so` and
`native/lib/libjulia_webview_bridge.so`, with environment overrides documented
in [Getting started](getting-started.md).

## Julia bindings

`bin/webview_app.jl` registers the frontend contract on the queue:

| Binding | Behavior |
| --- | --- |
| Diagnostics | Counter, reset, status, system information, and timestamp. |
| Notes and exports | Persistent note CRUD and PDF export. |
| MIR/audio | Bounded sample analysis plus Aural-backed WAV metadata and file analysis jobs. |
| Assets | Volume discovery and cancellable bounded scans. |
| Documents | BibTeX parsing, Blender header inspection, and native PDF generation. |
| Window actions | Minimize, maximize, restore, and close queue bindings. |

Errors in the request loop are returned with status `1` and a JSON-encoded
error message. Each request is closed in a `finally` block.

The legacy `web/index.html` exercises these three bindings directly. The Preact
frontend loads from `frontend-preact/dist/index.html`; the legacy Fibonacci page
is not part of the application UI.

## Frontend backend adapter

`frontend-preact/src/backend.js` exposes a Promise-based adapter. It
validates arguments, calls a native `window[name]` function when present, and
wraps the result in a five-second timeout by default. Use
`setDefaultTimeout(ms)` for tests or a different host environment.

The adapter exposes the following groups:

| Group | Functions |
| --- | --- |
| Diagnostics | `increment`, `reset`, `getSystemInfo`, `getTimestamp`, `getStatus` |
| Notes and exports | `getNotes`, `createNote`, `updateNote`, `deleteNote`, `savePdf` |
| MIR | `mirAnalyze` |
| Studio assets | `listVolumes`, `startAssetScan`, `getAssetScanStatus`, `cancelAssetScan`, `getAudioMetadata`, `analyzeAudio` |
| Audio jobs | `startAudioAnalysis`, `getAudioAnalysisStatus`, `cancelAudioAnalysis` |
| Window actions | `minimizeWindow`, `maximizeWindow`, `restoreWindow`, `closeWindow` |

In browser/mock mode, note data is kept in local storage when it is available,
with an in-memory fallback. MIR analysis uses the JavaScript mirror; asset and
audio calls use deterministic mock responses or mock errors.

## Error handling

`errorDetails()` normalizes three forms into `{ code, message }`:

1. a structured JSON envelope such as `{ "code": "StorageCorrupt", "message": "..." }`;
2. a bare error name such as `NoteNotFound`; or
3. a local adapter error such as `Timeout`, `Unavailable`, or `InvalidArgument`.

The UI should switch on `code` and display `message`. `backendError()` returns a
short display string; `backendErrorWithCode()` preserves the error code for
diagnostics.

## Jobs and persistence

`src/Jobs.jl` owns cooperative background job state. Asset scans and full-file
audio analysis report `running`, `completed`, `failed`, or `cancelled` snapshots;
workers must check cancellation between units of work. Terminal jobs are bounded
by age and count.

`src/Persistence.jl` stores notes in a versioned JSON envelope. It still reads
the earlier raw-array format, limits serialized size, writes through a
same-directory temporary file, and raises typed errors for corrupt,
unavailable, unsupported, or oversized data. Backend mutations persist a
candidate copy before replacing in-memory state.

Read-only audio and Blender paths are canonicalized and must resolve beneath the
home directory or a discovered volume root. PDF exports are confined to
`~/Documents/`.

`generatePdf` renders a native academic PDF from `(filename, title, body)`:
`#`-prefixed lines become bold section headings and the remaining text is
wrapped into one column by default. An optional fourth argument selects the
layout — `"single"` (default), `"two-column"`, or `"double"` (alias) — which
keeps the title block full-width and flows the body through two columns.
Anything else returns `InvalidArgument`. The rich frontend paper pipeline
(`paper-pdf.js` layout selector across jsPDF/pdf-lib/pdfmake, plus the
two-column print CSS) covers full papers with figures, citations, and
references; `generatePdf` is the lightweight native fallback.

`frontend-preact/src/bindings.d.ts`, `backend.js`, and `check-bindings.cjs` are
kept aligned with `bin/webview_app.jl`. Run
`npm --prefix frontend-preact run check:bindings` to verify all registered
names. Browser mode remains available through the adapter's mocks.

### Plugin extension points

Frontend paper-content extensions are registered with
`registerPaperExtension({ id, matches, renderHtml })`. The built-in Mermaid and
MathJax adapters render readable escaped source offline, then enhance it when a
host supplies `globalThis.mermaid` or `globalThis.MathJax`.

Julia integrations can register an RPC handler during startup with
`Backend.register_handler!(name, handler)`. A handler receives the decoded
argument vector and returns `(status, json)`; `handler_names()` exposes the
registered names for a shell or plugin manifest, and
`unregister_handler!` removes a plugin handler. The native launcher includes
startup-registered names automatically; a handler added after the WebView has
started still needs an explicit native binding registration by the shell. The
window-action names (`minimizeWindow`, `maximizeWindow`, `restoreWindow`, and
`closeWindow`) remain reserved for the shell.
