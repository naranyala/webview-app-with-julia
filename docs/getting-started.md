# Getting started

## Overview

This Linux desktop application uses Julia to create the native window and
communicate with an HTML frontend through the official
[webview](https://github.com/webview/webview) C API. The frontend is built with
Octane, Rsbuild, and Tailwind CSS, then emitted as a self-contained HTML document for
the desktop launcher.

The frontend can also run in a browser. Missing `window.*` bindings are handled
by the adapter in `frontend/src/backend.js`. The production application requires
the Julia WebView; unavailable browser calls reject with a clear error.

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
npm --prefix frontend ci
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

## User-local installation

After building the frontend and native libraries, install a runnable copy under
the current user's home directory:

```sh
julia --startup-file=no bin/install.jl --dry-run
julia --startup-file=no bin/install.jl
```

The default locations are `~/.local/opt/webview-app`, `~/.local/bin/webview-app`,
and `~/.local/share/applications/webview-app.desktop`. Use `--prefix=/path` or
`--bin-dir=/path` to choose another user-owned location; `--no-desktop` skips
the desktop entry. The installer does not use `sudo`; native distro packages
and a self-contained release bundle remain future work.

Options:

```sh
./run.sh --build       # force frontend and native rebuilds
./run.sh --dev         # launch with WebView developer tools enabled
./run.sh --devtools    # alias for --dev
./run.sh --build-dev   # force rebuild and enable developer tools
./run.sh --help
```

The native build downloads WebView v0.12.0 into the ignored
`native/vendor/webview/` directory and produces:

- `native/lib/libwebview.so`
- `native/lib/libjulia_webview_bridge.so`

Build the pieces independently when debugging a failure:

```sh
npm --prefix frontend run build
./native/build_webview.sh
julia --project=. bin/webview_app.jl
```

The production launcher loads `frontend/dist/index.html`. That file is
generated and ignored by Git, so a fresh checkout must build the frontend
before launching.

## Frontend-only development

Run the browser development server on port 3000:

```sh
npm --prefix frontend run dev
```

Open <http://localhost:3000>. Native operations are unavailable in this mode;
use the desktop launcher to exercise the Julia bridge.

`npm --prefix frontend run preview` serves a production build. The development
server starts with `npm --prefix frontend run dev`.

## Runtime overrides

The launcher supports these environment variables:

| Variable | Purpose |
| --- | --- |
| `JULIA_FRONTEND_HTML` | Use a different built `index.html`. |
| `JULIA_WEBVIEW_LIBRARY` | Override the WebView shared library path. |
| `JULIA_WEBVIEW_BRIDGE_LIBRARY` | Override the Julia queue bridge path. |
| `JULIA_WEBVIEW_DEBUG=1` | Enable WebView debug mode. |
| `JULIA_WEBVIEW_DEVTOOLS=1` | Enable WebView developer tools. |
