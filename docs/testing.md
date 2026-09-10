# Testing and maintenance

## Julia tests

The package test target is:

```sh
julia --project=. -e 'using Pkg; Pkg.test()'
```

It covers greetings, Fibonacci validation/calculation, and the presence of the
built frontend HTML. In this checkout the test body passes 11 tests when run
directly with:

```sh
julia --project=. -e 'using Test; include("test/runtests.jl")'
```

If `Pkg.test()` cannot write Julia's global depot/log files, use a writable
`JULIA_DEPOT_PATH` or the direct test invocation above for a local diagnostic.

## Frontend tests

Run the full frontend suite with:

```sh
npm --prefix frontend-preact test
```

The command runs the standalone `check-*.mjs` scripts, PDF/search benchmarks,
and Vitest component tests. The current suite passes the utility checks and 24
component tests across six test files.

Useful focused commands include:

```sh
npm --prefix frontend-preact run test:components
npm --prefix frontend-preact run benchmark:notes
npm --prefix frontend-preact run benchmark:pdf
npm --prefix frontend-preact run benchmark:paper
npm --prefix frontend-preact run map:check
```

The check scripts cover backend error normalization, quiz data, Q&A parsing,
Markdown, calendar helpers, schemas, paper/citation logic, MIR math, asset
classification, map integrity, autosave ordering, fuzzy note search, and PDF
generation.

## Map data refresh

`map:refresh` downloads the pinned GeoBoundaries ADM2 GeoJSON and rewrites
`src/plugins/indonesia-map-data.js`. To work offline, point
`INDONESIA_MAP_SOURCE_FILE` at a compatible local source:

```sh
INDONESIA_MAP_SOURCE_FILE=/path/to/indonesia-adm2.geojson \
  npm --prefix frontend-preact run map:refresh
npm --prefix frontend-preact run map:check
```

The validator expects 38 provinces, 514 administrative geometries, five
excluded non-administrative features, the pinned source revision, closed rings,
and coordinates within the Indonesia bounds used by the project.

## Known verification gaps

The following are repository-state issues rather than test-suite failures:

- `npm run check` currently reports Biome formatting changes in
  `src/plugins/tab-vault.jsx` and the already-modified StyleX files.
- `npm run check:bindings` currently fails because
  `src/backend/core_plugin.zig` is not present.
- `npm run build` runs both checks before bundling, so a clean production build
  is blocked until those two issues are resolved.

Keep generated files out of hand-edited source changes. After a successful
frontend build, confirm that `frontend-preact/dist/index.html` exists before
running the native launcher.
