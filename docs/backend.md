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
| Notes and quizzes | Persistent note CRUD, quiz collection/question CRUD, validated JSON import/export, and PDF export. |
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
| Quiz storage | `quizList`, collection CRUD, question CRUD, `quizImport`, `quizExport` |
| MIR | `mirAnalyze` |
| Studio assets | `listVolumes`, `startAssetScan`, `getAssetScanStatus`, `cancelAssetScan`, `getAudioMetadata`, `analyzeAudio` |
| Audio jobs | `startAudioAnalysis`, `getAudioAnalysisStatus`, `cancelAudioAnalysis` |
| Window actions | `minimizeWindow`, `maximizeWindow`, `restoreWindow`, `closeWindow` |

In browser/mock mode, notes and quiz data are kept in local storage when it is
available, with an in-memory fallback. MIR analysis uses the JavaScript mirror;
asset and audio calls use deterministic mock responses or mock errors.

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

`src/Persistence.jl` stores notes and quizzes in versioned JSON envelopes. It
still reads the earlier raw-array format, limits serialized size, writes through
a same-directory temporary file, and raises typed errors for corrupt,
unavailable, unsupported, or oversized data. Backend mutations persist a
candidate copy before replacing in-memory state.

Read-only audio and Blender paths are canonicalized and must resolve beneath the
home directory or a discovered volume root. Quiz import accepts validated JSON
content rather than an arbitrary native path; exports are confined to
`~/Documents/`.

`frontend-preact/src/bindings.d.ts`, `backend.js`, and `check-bindings.cjs` are
kept aligned with `bin/webview_app.jl`. Run
`npm --prefix frontend-preact run check:bindings` to verify all registered
names. Browser mode remains available through the adapter's mocks.
