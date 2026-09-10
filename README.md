# Julia Starter With Manual WebView Bindings

A Julia desktop application starter with an HTML/CSS/JavaScript frontend. The launcher uses direct `ccall` bindings to the official [`webview`](https://github.com/webview/webview) C API instead of a Julia WebView wrapper package.

## Requirements

- Julia 1.10 or newer
- GCC or Clang, CMake, and Git
- A desktop session with a display server
- GTK 3 and WebKitGTK development libraries on Linux

### Linux dependencies

For AlmaLinux or Fedora:

```sh
sudo dnf install gcc-c++ cmake git pkgconf-pkg-config gtk3-devel webkit2gtk3-devel
```

For Debian or Ubuntu:

```sh
sudo apt install build-essential cmake git pkg-config libgtk-3-dev libwebkit2gtk-4.0-dev
```

For Arch Linux:

```sh
sudo pacman -S base-devel cmake git webkit2gtk
```

## Build the frontend

The Julia launcher loads the self-contained production bundle from
`frontend-preact/dist/index.html`. Build it whenever the Preact source changes:

```sh
npm --prefix frontend-preact install
npm --prefix frontend-preact run build
```

## Install Julia dependencies

```sh
julia --project=. -e 'using Pkg; Pkg.instantiate()'
```

The Julia side uses `JSON3` for the binding request payloads. The WebView runtime is built separately from the official C library.

## Build the native WebView library

This downloads `webview` v0.12.0 into the ignored `native/vendor/` directory and builds `native/lib/libwebview.so` plus the Julia queue bridge:

```sh
./native/build_webview.sh
```

## Launch the desktop frontend

```sh
julia --project=. bin/webview_app.jl
```

The window loads the final Preact toolkit from `frontend-preact/dist/index.html`. Its JavaScript calls the native `window.*` bindings exposed by the launcher; bindings not implemented by the Julia starter use the frontend's browser-safe mock behavior.

Use a different native library path when needed:

```sh
JULIA_WEBVIEW_LIBRARY=/path/to/libwebview.so julia --project=. bin/webview_app.jl
```

Enable developer tools when supported:

```sh
JULIA_WEBVIEW_DEBUG=1 julia --project=. bin/webview_app.jl
```

Use a different built frontend path when needed:

```sh
JULIA_FRONTEND_HTML=/path/to/index.html julia --project=. bin/webview_app.jl
```

## Run the tests

```sh
julia --project=. -e 'using Pkg; Pkg.test()'
```

The tests cover the Julia calculation and frontend HTML without opening a GUI window.

## Project layout

- `Project.toml` describes the Julia project and dependencies.
- `src/JuliaStarter.jl` contains the application logic.
- `src/ManualWebview.jl` contains the direct C ABI bindings.
- `frontend-preact/dist/index.html` is the self-contained production frontend bundle.
- `bin/webview_app.jl` creates the native window and registers the bridge callbacks.
- `native/build_webview.sh` builds the pinned native `webview` library.
- `test/runtests.jl` contains the test suite.
