# Julia + Preact WebView App

A Linux-first desktop toolkit with a Julia/WebView shell and a Preact
frontend. Julia creates the native window through direct `ccall` bindings to
the official [webview C API](https://github.com/webview/webview); the frontend
is bundled into a single HTML file for the launcher and can also run in a
browser with mock backend behavior.

## Current status

The active launcher exposes six frontend tools:

- Sample Library
- Monitor EQ
- Tab Vault
- MIR Papers
- MIR Lab
- Indonesia Map

Chain Notes, Quiz, Todos, and Blender Companion components are present under
`frontend-preact/src/plugins/` but are not currently registered in the active
shell.

The native Julia entry point currently implements the small WebView bridge used
by the legacy Fibonacci example: `calculateFibonacci`, `closeWindow`, and
`closeApp`. The frontend adapter contains a broader modeled backend contract
and falls back to mocks when those bindings are unavailable. The Zig backend
tree referenced by the binding checker is not included in this checkout, so
the full frontend contract is not yet native-backed.

For the detailed repository guide, see [`docs/README.md`](docs/README.md).

## Requirements

- Julia 1.10 or newer
- Node.js and npm
- A C++ compiler, CMake, Git, and `pkg-config`
- A Linux desktop session with a display server
- GTK 3 development libraries
- WebKitGTK 4.1 development libraries

The launcher checks for `gtk+-3.0` and `webkit2gtk-4.1`. On Debian or Ubuntu,
the usual package set is:

```sh
sudo apt install build-essential cmake git pkg-config \
  libgtk-3-dev libwebkit2gtk-4.1-dev
```

On Fedora or AlmaLinux, install the corresponding `gtk3-devel` and
`webkit2gtk4.1-devel` packages.

## Install dependencies

```sh
npm --prefix frontend-preact ci
julia --project=. -e 'using Pkg; Pkg.instantiate()'
```

## Run the desktop app

```sh
./run.sh
```

The launcher checks prerequisites, builds the frontend when its generated
bundle is missing or stale, builds the native libraries when needed, prepares
Julia, and starts `bin/webview_app.jl`.

```sh
./run.sh --build       # force a full rebuild
./run.sh --dev         # enable WebView debug tools
./run.sh --build-dev   # rebuild and enable debug tools
./run.sh --help
```

The native build downloads WebView v0.12.0 into ignored build directories and
produces:

- `native/lib/libwebview.so`
- `native/lib/libjulia_webview_bridge.so`

## Frontend development

```sh
npm --prefix frontend-preact run dev
```

Open <http://localhost:3000>. This is the fastest way to work on Preact tools;
it uses the browser mock adapter and does not require the native toolchain.

Build the production bundle explicitly with:

```sh
npm --prefix frontend-preact run build
```

The source entry point is `frontend-preact/src/main.jsx`. The build writes
assets to `frontend-preact/public/assets/` and the single-file launcher bundle
to `frontend-preact/dist/index.html`.

## Tests and checks

```sh
julia --project=. -e 'using Pkg; Pkg.test()'
npm --prefix frontend-preact test
npm --prefix frontend-preact run map:check
```

The Julia tests cover the application logic and built HTML. The frontend suite
covers backend errors, schemas, Markdown, Q&A, paper/citation logic, MIR math,
asset helpers, map data, autosave, search, PDF output, and Preact components.

Current repository-state caveats are documented in
[`docs/testing.md`](docs/testing.md): the formatter reports existing changes in
`tab-vault.jsx` and StyleX files, and the binding checker references the absent
`src/backend/core_plugin.zig` tree. Since `npm run build` runs those checks
first, resolve them before relying on a clean production build from scratch.

## Runtime overrides

```sh
JULIA_FRONTEND_HTML=/path/to/index.html \
  julia --project=. bin/webview_app.jl

JULIA_WEBVIEW_LIBRARY=/path/to/libwebview.so \
JULIA_WEBVIEW_BRIDGE_LIBRARY=/path/to/libjulia_webview_bridge.so \
  julia --project=. bin/webview_app.jl

JULIA_WEBVIEW_DEBUG=1 julia --project=. bin/webview_app.jl
```

## Repository layout

```text
.
├── bin/                         Julia entry points
├── src/                         Julia package and manual WebView wrapper
├── native/                      C++ bridge and native build script
├── frontend-preact/
│   ├── src/                     Preact shell, adapter, and plugins
│   ├── public/                  HTML template and checked-in assets
│   ├── plugins/                 esbuild plugins
│   └── scripts/                 data-generation scripts
├── web/                         Legacy standalone Fibonacci HTML example
├── test/                        Julia tests
└── docs/                        Maintainer and user documentation
```

For architecture, backend payloads, tool behavior, and maintenance details,
start with [`docs/README.md`](docs/README.md).
