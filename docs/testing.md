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

## Frontend tests

Run the full frontend suite with:

```sh
npm --prefix frontend-preact test
```

The command runs the standalone `check-*.mjs` scripts, PDF/search benchmarks,
and Vitest component tests. Component tests cover shell navigation, backend
health states, error recovery, and plugin registration.

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
generation. Component tests additionally cover shell navigation, backend health
states, error recovery, and plugin registration.

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

Do not edit generated files manually. After a successful
frontend build, confirm that `frontend-preact/dist/index.html` exists before
running the native launcher.
