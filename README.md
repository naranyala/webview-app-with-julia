# WebViewApp

WebViewApp is a Linux desktop workspace for writing, research, music-information
retrieval (MIR), and local-media tasks. Julia owns the application services and
native window; an Octane frontend is compiled into one self-contained HTML file
and displayed with the [WebView](https://github.com/webview/webview) C API.

The project runs as a desktop application without a local web server. The same
frontend can be developed in a regular browser, where calls that require native
capabilities fail explicitly rather than silently returning mock data.

## What it includes

- **Writing** — manage notes, generate note PDFs, create and edit paper
  projects, export papers, and work with BibTeX references.
- **Analyze music** — inspect audio files and run MIR analysis through the
  Julia audio adapter.
- **Research** — open direct searches across scholarly, publisher, technical,
  and general-reference sources.
- **Media** — browse directories, inspect media metadata, scan disk usage, and
  explore image collections.
- **Desktop bridge** — safely carries WebView JavaScript requests to Julia via
  a bounded native queue, with structured responses and errors.

## Architecture

```text
Octane frontend (frontend/src/)
              |
              v
  self-contained frontend/dist/index.html
              |
              v
 Julia desktop host (bin/webview_app.jl)
       |                         |
       v                         v
 application backend       WebView C API + C++ queue bridge
       |
       v
 notes, papers, PDFs, BibTeX, media, and audio services
```

`run.sh` builds the HTML bundle and native libraries when required, prepares the
Julia environment, then launches the desktop host. The C++ bridge avoids
calling Julia directly from a WebView callback: it queues requests for Julia to
drain and resolves them by request ID.

For a deeper guide to the individual layers, see the
[documentation index](docs/README.md) and [architecture notes](docs/architecture.md).

## Requirements

- Linux desktop session with a display server
- Julia 1.10+
- Node.js and npm
- C++ compiler, CMake, Git, and `pkg-config`
- GTK 3 and WebKitGTK 4.1 development headers

On Debian or Ubuntu:

```sh
sudo apt install build-essential cmake git pkg-config \
  libgtk-3-dev libwebkit2gtk-4.1-dev
```

On Fedora-family systems, install the equivalent `gtk3-devel` and
`webkit2gtk4.1-devel` packages. The launcher verifies the `gtk+-3.0` and
`webkit2gtk-4.1` pkg-config entries before building.

## Get started

Clone this repository with its local Julia dependencies available beside it,
then install the frontend and Julia dependencies:

```sh
npm --prefix frontend ci
julia --project=. -e 'using Pkg; Pkg.instantiate()'
```

`Project.toml` currently points at local checkouts of `Aural.jl`,
`LinuxCompanion.jl`, and `StaticMediaCompanion.jl` in the parent directory.
Those checkouts must exist at the paths declared in `[sources]` before Julia can
instantiate the project.

Launch the app:

```sh
./run.sh
```

Useful launcher options:

```sh
./run.sh --build       # force frontend and native rebuilds
./run.sh --dev         # open WebView developer tools
./run.sh --devtools    # alias for --dev
./run.sh --build-dev   # force rebuild and open developer tools
./run.sh --help
```

The native build fetches the pinned WebView source into ignored build
directories and produces `native/lib/libwebview.so` and
`native/lib/libjulia_webview_bridge.so`. The frontend build produces the ignored
`frontend/dist/index.html` consumed by the desktop host.

## Frontend development

Run the browser development server:

```sh
npm --prefix frontend run dev
```

Then open <http://localhost:3000>. This is useful for UI work, but native Julia
operations are unavailable until the app is launched with `./run.sh`.

Build or check the frontend directly with:

```sh
npm --prefix frontend run build
npm --prefix frontend run check
```

The production source lives in `frontend/src/`; `frontend-legacy/` is retained
as historical implementation material and is not the active frontend.

## Test

Run the Julia suite and the production frontend verification suite:

```sh
julia --project=. -e 'using Pkg; Pkg.test()'
npm --prefix frontend verify
```

The Julia tests cover backend behavior, persistence, paper projects, jobs,
diagnostics, workspace policy, and bridge contracts. The frontend verification
builds the distributable HTML before running its tests. See
[docs/testing.md](docs/testing.md) for repository checks and maintenance tasks.

## Runtime overrides

| Variable | Effect |
| --- | --- |
| `JULIA_FRONTEND_HTML` | Use a different built frontend HTML file. |
| `JULIA_WEBVIEW_LIBRARY` | Override the WebView shared-library path. |
| `JULIA_WEBVIEW_BRIDGE_LIBRARY` | Override the C++ bridge shared-library path. |
| `JULIA_WEBVIEW_DEBUG=1` | Enable WebView debug mode. |
| `JULIA_WEBVIEW_DEVTOOLS=1` | Enable WebView developer tools. |

For example:

```sh
JULIA_WEBVIEW_DEVTOOLS=1 julia --project=. bin/webview_app.jl
```

## Repository map

```text
bin/             Julia entry points
src/             Julia package, backend handlers, and application services
native/          WebView build script and C++ request-queue bridge
frontend/        Active Octane/Rsbuild desktop frontend
frontend-legacy/ Historical frontend implementation
test/            Julia test suite
docs/            Detailed guides and operational notes
scripts/         Development and QA utilities
```

Generated dependencies and artifacts—including `frontend/node_modules/`,
`frontend/dist/`, `native/vendor/`, `native/build/`, `native/lib/`, and Julia's
`Manifest.toml`—are intentionally excluded from version control.
