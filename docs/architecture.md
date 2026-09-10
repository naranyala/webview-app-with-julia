# Architecture

## Runtime flow

```text
frontend-preact/src/main.jsx
        |
        v
Preact App shell + registered plugins
        |
        v
frontend-preact/dist/index.html  <-- generated from public/index.html + assets
        |
        v
bin/webview_app.jl
        |
        +--> src/ManualWebview.jl --> libwebview.so
        |
        +--> native/bridge.cc ------> libjulia_webview_bridge.so
```

The launcher creates a WebView window, sets its title and size, injects the
built HTML, and pumps the GLib main context. Native callbacks do not call into
Julia directly. Instead, `native/bridge.cc` copies each WebView request into a
mutex-protected queue; Julia polls that queue and returns a response by request
ID.

## Repository layers

| Layer | Location | Responsibility |
| --- | --- | --- |
| Julia package | `src/JuliaStarter.jl` | Example Julia logic, frontend loading, and CLI greeting. |
| Julia WebView wrapper | `src/ManualWebview.jl` | Direct `ccall` declarations for window, HTML, event loop, binding, and return APIs. |
| Desktop entry point | `bin/webview_app.jl` | Creates the window, registers the current native bindings, services the request queue, and shuts down cleanly. |
| C++ bridge | `native/bridge.cc` | Adapts WebView binding callbacks to a Julia-pollable request queue. |
| Native build | `native/build_webview.sh` | Fetches pinned WebView v0.12.0 and compiles the two shared libraries. |
| Frontend shell | `frontend-preact/src/App.jsx` | Home launcher, navigation rail, tool panels, command palette, autosave flush, and window controls. |
| Plugin registry | `frontend-preact/src/plugins/index.js` | Declares the tools that are actually reachable from the shell. |
| Frontend adapter | `frontend-preact/src/backend.js` | Validates arguments, calls `window.*`, normalizes errors, adds timeouts, and supplies mocks. |
| Frontend build | `frontend-preact/build.js` | Bundles Preact, extracts StyleX, emits assets, and creates the single-file HTML. |

## Frontend build artifacts

`frontend-preact/public/index.html` is the HTML template. The build writes
bundled CSS and JavaScript to `frontend-preact/public/assets/`, then the
`single-file-html` esbuild plugin inlines local CSS and JavaScript into
`frontend-preact/dist/index.html`.

The following outputs are intentionally ignored:

- `frontend-preact/node_modules/`
- `frontend-preact/dist/`
- `native/vendor/`
- `native/build/`
- `native/lib/`
- Julia's `Manifest.toml`

The checked-in `public/assets/` files are generated frontend assets. Treat the
source files under `frontend-preact/src/` and the build command as the source
of truth when changing the UI.

## Navigation and plugin lifecycle

`App.jsx` reads `frontendPlugins` and splits the entries into the primary rail
and the Tools submenu. Selecting a tool:

1. flushes registered autosaves;
2. records the tool as opened and makes it active;
3. updates the document title and scroll position; and
4. renders the plugin component with any mode-specific props.

The active shell passes `mode`, `selectedProvince`, and related callbacks to the
Indonesia Map and MIR Papers plugins. `Ctrl-K`/`Cmd-K` opens the command palette.

## Native versus mock mode

The frontend labels itself native only when every name in `CORE_BINDINGS` is a
function on `window`. The current Julia launcher registers only three names,
so the complete frontend contract is not satisfied in this checkout. Missing
bindings normally fall back to mocks; setting `window.__PREACT_MOCK_BRIDGE__ =
false` makes them reject as unavailable instead.

This distinction matters: a native WebView window can still be displaying a
frontend that is operating in mock mode.
