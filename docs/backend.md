# Backend and bridge

## Julia WebView wrapper

`src/ManualWebview.jl` is a small direct wrapper around the WebView C API. It
does not depend on a Julia WebView package. The exported surface includes:

- window lifecycle: `create`, `destroy!`, `run!`, `is_open`, `terminate!`;
- window content: `html!`, `init!`, `eval!`, `set_title!`, `set_size!`;
- event loop: `pump!`;
- bridge queue: `create_queue`, `destroy_queue!`, `bind_queue!`, `next!`;
- request access: `request_id`, `request_name`, `request_payload`, `Base.close`;
- responses: `return!`.

Library paths default to `native/lib/libwebview.so` and
`native/lib/libjulia_webview_bridge.so`, with environment overrides documented
in [Getting started](getting-started.md).

## Current Julia bindings

`bin/webview_app.jl` currently registers three names:

| Binding | Behavior |
| --- | --- |
| `calculateFibonacci` | Reads one JSON argument, validates `0 <= n <= 50`, and returns `{ "input": n, "result": fibonacci(n) }`. |
| `closeWindow` | Returns `null` and ends the Julia pump loop. |
| `closeApp` | Same shutdown path as `closeWindow`. |

Errors in the request loop are returned with status `1` and a JSON-encoded
error message. Each request is closed in a `finally` block.

The legacy `web/index.html` exercises these three bindings directly. The
current Preact frontend is loaded from `frontend-preact/dist/index.html`
instead, so the legacy Fibonacci page is not the active application UI.

## Frontend backend adapter

`frontend-preact/src/backend.js` exposes a stable Promise-based adapter. It
validates arguments, calls a native `window[name]` function when present, and
wraps the result in a five-second timeout by default. Use
`setDefaultTimeout(ms)` for tests or a different host environment.

The modeled contract includes these groups:

| Group | Functions |
| --- | --- |
| Diagnostics | `increment`, `reset`, `getSystemInfo`, `getTimestamp`, `getStatus` |
| Notes and exports | `getNotes`, `createNote`, `updateNote`, `deleteNote`, `savePdf` |
| Quiz storage | `quizList`, collection CRUD, question CRUD |
| MIR | `mirAnalyze` |
| Studio assets | `listVolumes`, `startAssetScan`, `getAssetScanStatus`, `cancelAssetScan`, `getAudioMetadata`, `analyzeAudio` |
| Window actions | `minimizeWindow`, `maximizeWindow`, `restoreWindow`, `closeWindow` |

In browser/mock mode, notes and quiz data are kept in local storage when it is
available, with an in-memory fallback. MIR analysis uses the JavaScript mirror;
asset and audio calls use deterministic mock responses or mock errors.

## Error handling

`errorDetails()` normalizes three forms into `{ code, message }`:

1. a structured JSON envelope such as `{ "code": "StorageCorrupt", "message": "..." }`;
2. a bare error name such as `NoteNotFound`; or
3. a local adapter error such as `Timeout`, `Unavailable`, or `InvalidArgument`.

The UI should switch on `code` and display `message`. `backendError()` is the
short display-only helper; `backendErrorWithCode()` is useful for diagnostics.

## Contract gap in this checkout

`frontend-preact/src/bindings.d.ts`, `backend.js`, and `check-bindings.cjs`
describe a larger Zig backend contract. The files referenced by the checker—
`src/backend/core_plugin.zig` and the related Zig backend tree—are absent from
the current repository. Consequently:

- the frontend's full `isNative()` check cannot become true with the current
  launcher;
- `npm run check:bindings` fails with a missing-file error; and
- the current native executable should be understood as a Julia/WebView
  Fibonacci bridge plus mock-capable frontend shell, not as the full modeled
  backend.

When implementing the missing backend, keep the names and payload shapes in
`bindings.d.ts` and `backend.js` aligned, then restore the binding check before
claiming full native mode.
