# Julia and Preact WebView App

A Linux desktop application with a Julia/WebView host and a Preact frontend.
Julia creates the native window through direct `ccall` bindings to the official
[webview C API](https://github.com/webview/webview). The frontend is bundled
into a single HTML file for the launcher and can also run in a browser with
mock backend behavior.

## Features

The launcher provides the following tools:

- Sample Library
- Monitor EQ
- Tab Vault
- MIR Papers
- MIR Lab
- Indonesia Map
- Chain Notes
- Quiz
- Blender Companion
- Todos

The Julia entry point routes frontend requests through the queue bridge. When
native bindings are unavailable, the frontend adapter uses browser mocks.
Audio and MIR file operations use the app-owned adapter around the local
Aural.jl dependency.

For the detailed repository guide, see [`docs/README.md`](docs/README.md).

## Requirements

- Julia 1.10 or newer
- Node.js and npm
- A C++ compiler, CMake, Git, and `pkg-config`
- A Linux desktop session with a display server
- GTK 3 development libraries
- WebKitGTK 4.1 development libraries

The launcher checks for `gtk+-3.0` and `webkit2gtk-4.1`. On Debian or Ubuntu,
install:

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

Open <http://localhost:3000>. The development server uses the browser mock
adapter and does not require the native toolchain.

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

The repository-state checks are documented in [`docs/testing.md`](docs/testing.md).
`npm --prefix frontend-preact run build` runs formatting and binding checks
before producing the bundle.

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
├── src/                         Julia package, backend groups, and WebView wrapper
├── native/                      C++ bridge and native build script
├── frontend-preact/
│   ├── src/                     Preact shell, adapter, and plugins
│   ├── public/                  HTML template and checked-in assets
│   ├── build-plugins/           esbuild build plugins
│   └── scripts/                 data-generation scripts
├── web/                         Legacy standalone Fibonacci HTML example
├── test/                        Julia tests
└── docs/                        Project documentation
```

For architecture, backend payloads, tool behavior, and maintenance details,
start with [`docs/README.md`](docs/README.md).
