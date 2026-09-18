# Testing and maintenance

## Julia tests

The package test target is:

```sh
julia --project=. -e 'using Pkg; Pkg.test()'
```

It covers greetings, Fibonacci validation/calculation, the built frontend HTML,
the Julia backend, filesystem scanning, PDF/BibTeX/Blender boundaries,
persistence, job lifecycle validation, asynchronous audio analysis, and the
Aural/StaticMedia adapters. The direct diagnostic form is:

```sh
julia --project=. -e 'using Test; include("test/runtests.jl")'
```

If `Pkg.test()` cannot write Julia's global depot/log files, use a writable
`JULIA_DEPOT_PATH` or the direct test invocation above for a local diagnostic.

The abstraction edge suite also exercises binding-manifest normalization and
drift detection, error-registry invariants, invalid single-file artifacts,
deployment refusal for invalid builds, and diagnostics log rotation. These
cases live in `test/edge_cases.jl` and are included by the main runner.

## Frontend tests

Run the production frontend suite with:

```sh
npm --prefix frontend verify
```

The command runs Biome, the active frontend's Node tests, and a production
bundle build. It covers adapter forwarding, timeout/error normalization, paper
draft preservation, all direct-search URL generation, and rendered production
bundle workflows for Paper Desk, Direct Search, and MIR completion.

Useful focused commands include:

```sh
npm --prefix frontend test
npm --prefix frontend run check
npm --prefix frontend run build
```

`frontend-preact/` remains archived. Its historical benchmarks and component
tests are not release checks for the launched application.

## Native bridge and desktop smoke checks

The Julia suite includes a display-free native bridge burst test whenever the
built bridge library is available. It verifies bounded admission, overload
rejection, and FIFO draining. Rebuild it after changing `native/bridge.cc`:

```sh
./native/build_webview.sh
julia --project=. -e 'using Pkg; Pkg.test()'
```

The desktop host uses GLib's blocking main-context iteration rather than an
idle 10 ms sleep. Record the old polling baseline with:

```sh
/usr/bin/time -f '%U user %S system' julia --project=. scripts/measure_event_loop.jl
```

For a WebKitGTK smoke check, launch `./run.sh --dev`, open Research → Direct
web search, enter a query, and open one provider from each group. Providers
request a new window; if WebKitGTK blocks that popup, the app deliberately
navigates the current WebView as the safe fallback.

## CI and local Julia packages

The CI workflow checks out `Aural.jl`, `LinuxCompanion.jl`, and
`StaticMediaCompanion.jl beside this repository, matching the explicit
`[sources]` paths in `Project.toml`. Local development and distributable source
archives use the same side-by-side layout; binary packaging must either bundle
those packages as a Julia depot or replace the path sources with registered,
versioned releases before distribution.

Do not edit generated files manually. After a successful
frontend build, confirm that `frontend/dist/index.html` exists before
running the native launcher.
