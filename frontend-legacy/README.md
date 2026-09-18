# Frontend package

This directory contains the Preact application used by the Julia WebView
launcher. The repository-level documentation is the source of truth for the
whole project; start with [`../docs/README.md`](../docs/README.md).

## Commands

```sh
npm ci
npm run dev       # check, watch, and serve on http://localhost:3000
npm run test
npm run build
```

The production build runs Biome and the binding drift check before bundling.
It writes checked-in browser assets to `public/assets/` and a generated,
self-contained launcher document to `dist/index.html`.

## Frontend surface

The active registry exposes Sample Library, Monitor EQ, Tab Vault, MIR Papers,
MIR Lab, Media Inspector, Indonesia Map, Chain Notes, Blender Companion, and
Todos. MIR Papers supports academic single-/two-column layouts and extensible
Mermaid/MathJax content blocks.

The adapter in `src/backend.js` keeps browser development usable by providing
mock responses when `window.*` bindings are absent. See
[`../docs/backend.md`](../docs/backend.md) for the modeled binding contract and
the current native integration boundary.

## Data and checks

Indonesia map data is bundled for offline boundary rendering:

```sh
npm run map:refresh
npm run map:check
```

Set `INDONESIA_MAP_SOURCE_FILE` to a local GeoJSON file when refreshing without
network access. PDF, search, paper, MIR, schema, autosave, and component checks
are included in `npm test`.
