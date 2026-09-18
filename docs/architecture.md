# Architecture

## Runtime flow

```text
frontend/src/index.js
        |
        v
Rsbuild application
        |
        v
frontend/dist/index.html  <-- generated and inlined for WebView html!
        |
        v
bin/webview_app.jl
        |
        +--> src/ManualWebview.jl --> libwebview.so
        |
        +--> native/bridge.cc ------> libjulia_webview_bridge.so
        |
        +--> src/Backend.jl + src/backend/ --> Aural.jl / app services
```

The launcher creates a WebView window, sets its title and size, injects the
built HTML, and pumps the GLib main context. Native callbacks do not call into
Julia directly. Instead, `native/bridge.cc` copies each WebView request into a
bounded, mutex-protected queue; Julia drains that queue and returns a response
by request ID. GTK's blocking GLib iteration provides the wake-up path, so the
host is idle without a fixed polling sleep. Queue overflow and oversized bridge
payloads are rejected immediately with structured errors.

## Repository layers

| Layer | Location | Responsibility |
| --- | --- | --- |
| Julia package | `src/WebViewApp.jl` | Package exports, frontend loading, and CLI greeting. |
| Julia backend | `src/Backend.jl` + `src/backend/` | Facade for JSON RPC routing; handler groups cover notes, PDF, analysis, media, and routing separately, with startup plugin handler registration. |
| Audio adapter | `src/AudioAnalysisAdapter.jl` | Validates bridge input and translates bounded audio work through Aural.jl. |
| Julia WebView wrapper | `src/ManualWebview.jl` | Direct `ccall` declarations for window, HTML, event loop, binding, and return APIs. |
| Desktop entry point | `bin/webview_app.jl` | Creates the window, registers native bindings, services the request queue, and shuts down cleanly. |
| C++ bridge | `native/bridge.cc` | Adapts WebView binding callbacks to a Julia-pollable request queue. |
| Native build | `native/build_webview.sh` | Fetches pinned WebView v0.12.0 and compiles the two shared libraries. |
| Production frontend | `frontend/src/` | Rsbuild application loaded by the native WebView. |
| Frontend shell | `frontend/src/App.tsrx` | Declares the reachable writing and music tools. |
| Frontend adapter | `frontend/src/backend.js` | Calls native `window.*` bindings and rejects unavailable browser calls. |
| Tool views | `frontend/src/WritingWorkspace.tsrx` + `MusicWorkspace.tsrx` | Renders note, paper, references, and MIR workflows. |
| Build planning | `src/Build.jl` + `bin/build.jl` | Discovers inputs, checks generated-output freshness, and publishes canonical build commands without executing subprocesses. |
| User-local deployment | `src/Deploy.jl` + `bin/install.jl` | Plans and stages runtime inputs into a user-owned prefix, creates a launcher, and optionally registers a desktop entry. |
| RPC contract | `src/BindingManifest.jl` | Versioned frontend/backend/window binding names and drift reports used by the desktop launcher. |
| Frontend build | `frontend/rsbuild.config.js` + `frontend/scripts/single-file-html-plugin.js` | Builds the Rsbuild app and emits an inline HTML artifact for `html!`. |

## Frontend build artifacts

Rsbuild writes its initial output to `frontend/dist/`. The
The `single-file-html` Rsbuild plugin inlines local CSS and JavaScript into
`frontend/dist/index.html`, then defers embedded runtime execution until the DOM
is ready. This lets `webview_set_html` load the application without a document
URL or static file server.

The following outputs are ignored by Git:

- `frontend/node_modules/`
- `frontend/dist/`
- `native/vendor/`
- `native/build/`
- `native/lib/`
- Julia's `Manifest.toml`

Treat `frontend/src/` and `npm --prefix frontend run build` as the source of
truth for the production UI.

## Navigation and native bindings

`App.tsrx` keeps the active workspace and tool in local state and only exposes
tools with a corresponding view. Tool views call `frontend/src/backend.js`,
which forwards requests to the queue bindings registered by the Julia launcher.
When running in a regular browser, calls reject as unavailable rather than
simulating backend data.
