# Getting started

## Overview

This Linux desktop application uses Julia to create the native window and
communicate with an HTML frontend through the official
[webview](https://github.com/webview/webview) C API. The frontend is built with
Preact, esbuild, and StyleX, then emitted as a self-contained HTML document for
the desktop launcher.

The frontend can also run in a browser. Missing `window.*` bindings are handled
by the adapter in `frontend-preact/src/backend.js`, so frontend development does
not require opening a native window.

## Prerequisites

- Julia 1.10 or newer
- Node.js and npm
- A C++ compiler, CMake, Git, and `pkg-config`
- A Linux desktop session with a display server
- GTK 3 development headers
- WebKitGTK 4.1 development headers

The launcher checks these commands and libraries itself. Package names vary by
distribution; the important `pkg-config` names are `gtk+-3.0` and
`webkit2gtk-4.1`.

For Debian or Ubuntu, install:

```sh
sudo apt install build-essential cmake git pkg-config \
  libgtk-3-dev libwebkit2gtk-4.1-dev
```

For Fedora or AlmaLinux, use the corresponding `gtk3-devel` and
`webkit2gtk4.1-devel` packages.

## Install dependencies

Install the frontend dependencies:

```sh
npm --prefix frontend-preact ci
```

Instantiate the Julia project:

```sh
julia --project=. -e 'using Pkg; Pkg.instantiate()'
```

`Project.toml` declares JSON3, LinuxCompanion, and the local development
dependency `../Aural.jl`; Julia's `Manifest.toml` is ignored by Git. Before
distributing the app, replace the local Aural source with a tagged or
registered Aural release.

## Build and run

Run the application with:

```sh
./run.sh
```

`run.sh` checks prerequisites, builds the frontend when `dist/index.html` is
missing or stale, builds the native WebView libraries when needed, instantiates
Julia dependencies, and launches `bin/webview_app.jl`.

Options:

```sh
./run.sh --build       # force frontend and native rebuilds
./run.sh --dev         # launch with WebView developer tools enabled
./run.sh --build-dev   # force rebuild and enable developer tools
./run.sh --help
```

The native build downloads WebView v0.12.0 into the ignored
`native/vendor/webview/` directory and produces:

- `native/lib/libwebview.so`
- `native/lib/libjulia_webview_bridge.so`

Build the pieces independently when debugging a failure:

```sh
npm --prefix frontend-preact run build
./native/build_webview.sh
julia --project=. bin/webview_app.jl
```

The production launcher loads `frontend-preact/dist/index.html`. That file is
generated and ignored by Git, so a fresh checkout must build the frontend
before launching.

## Frontend-only development

Run the browser development server on port 3000:

```sh
npm --prefix frontend-preact run dev
```

Open <http://localhost:3000>. The development server uses the mock backend and
does not require Julia, GTK, WebKitGTK, or the native libraries.

`npm --prefix frontend-preact run serve` serves the existing `public/` assets
without the check/watch step. `npm --prefix frontend-preact run dev` runs the
formatter/linter check first and then starts the esbuild watch server.

## Runtime overrides

The launcher supports these environment variables:

| Variable | Purpose |
| --- | --- |
| `JULIA_FRONTEND_HTML` | Use a different built `index.html`. |
| `JULIA_WEBVIEW_LIBRARY` | Override the WebView shared library path. |
| `JULIA_WEBVIEW_BRIDGE_LIBRARY` | Override the Julia queue bridge path. |
| `JULIA_WEBVIEW_DEBUG=1` | Enable WebView debug mode. |
