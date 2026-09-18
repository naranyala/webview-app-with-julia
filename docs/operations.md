# Operations guide

## Build and run from a checkout

Install the frontend and Julia dependencies, then use the repository launcher:

```sh
npm --prefix frontend ci
julia --project=. -e 'using Pkg; Pkg.instantiate()'
./run.sh
```

`run.sh` checks Julia, Node, npm, CMake, `pkg-config`, GTK 3, and WebKitGTK
4.1. It rebuilds stale frontend/native artifacts and then starts
`bin/webview_app.jl`.

Inspect decisions without running subprocesses:

```sh
julia --startup-file=no bin/build.jl
julia --startup-file=no bin/build.jl --check
julia --startup-file=no bin/build.jl --json
```

## User-local installation

After a successful build, stage a user-owned installation:

```sh
julia --startup-file=no bin/install.jl --dry-run
julia --startup-file=no bin/install.jl
```

Defaults are `~/.local/opt/webview-app`, `~/.local/bin/webview-app`, and a
desktop entry under `~/.local/share/applications/`. Use `--prefix=...`,
`--bin-dir=...`, or `--no-desktop` to customize the installation. This is a
staging mechanism, not yet a distro-native package or self-contained Julia
runtime bundle.

## Troubleshooting

| Symptom | First check |
| --- | --- |
| Frontend missing/stale | `julia --startup-file=no bin/build.jl --check`; then `npm --prefix frontend run build` |
| Native library missing | `./native/build_webview.sh`; verify `native/lib/` |
| GTK/WebKit failure | `pkg-config --exists gtk+-3.0` and `pkg-config --exists webkit2gtk-4.1` |
| Julia startup is slow | Use a writable `JULIA_DEPOT_PATH`; first-run package precompilation can be lengthy |
| Browser UI shows unavailable errors | Expected: native operations require the Julia WebView host |
| Path rejected | Configure an allowed workspace root; do not bypass `WorkspacePolicy` |

The launcher currently truncates some dependency output while preparing Julia.
For diagnosis, run the instantiate command directly with a writable depot so
the full error is visible.

## Runtime overrides

`JULIA_FRONTEND_HTML`, `JULIA_WEBVIEW_LIBRARY`, and
`JULIA_WEBVIEW_BRIDGE_LIBRARY` override artifact locations. Set
`JULIA_WEBVIEW_DEBUG=1` or `JULIA_WEBVIEW_DEVTOOLS=1` for WebView diagnostics.
