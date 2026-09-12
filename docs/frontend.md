# Frontend guide

## Stack and commands

The frontend uses Preact 10, esbuild, StyleX, Leaflet, and client-side PDF
libraries. The package scripts are defined in `frontend-preact/package.json`.

```sh
npm --prefix frontend-preact run dev          # check, watch, serve on :3000
npm --prefix frontend-preact run build        # check, binding check, bundle
npm --prefix frontend-preact run check        # Biome check
npm --prefix frontend-preact run check:write  # apply safe Biome fixes
npm --prefix frontend-preact run test         # utility checks + component tests
npm --prefix frontend-preact run map:check    # validate bundled map data
```

The source entry point is `src/main.jsx`; it imports the global CSS, mounts
`App`, and wraps the application in `ErrorBoundary`.

## Adding a tool

Plugins implement the manifest contract in `src/plugins/contract.js`:

```js
defineFrontendPlugin({
  id: 'example',
  index: '10',
  title: 'Example',
  description: 'Short launcher description.',
  tone: 'blue',
  symbol: 'EXAMPLE',
  component: Example
});
```

To make a component reachable, import it in `src/plugins/index.js`, create a
manifest entry, and add that entry to `registeredPlugins`. The registry checks
for duplicate IDs. The shell automatically exposes non-tool entries on the
primary rail and entries in `TOOL_IDS` under Tools.

Keep plugin state inside the plugin. Use `backend.js` for native
operations and the shared autosave registry when a workspace has pending data
that must be flushed before navigation or window close.

## Data and rendering conventions

- `stylex-styles.js` exposes the shared StyleX facade; token and style definitions
  are grouped in `stylex-tokens.stylex.js` and the domain-specific `stylex-*.js`
  modules.
- `stylex.css` contains global CSS and third-party/legacy styles that are not
  emitted by StyleX.
- `note-markdown.js` provides a deterministic Markdown subset used by notes and
  paper content.
- `paper.js` and `note-pdf.js` use shared block models so screen output, print
  output, and PDF output stay aligned.
- `note-pdf-jspdf.js` owns the jsPDF renderer while `note-pdf.js` keeps block
  construction and exporter selection.
- `schemas.js` normalizes malformed quiz payloads instead of allowing invalid
  backend data to reach renderers.

Avoid importing a plugin component into the shell without registering it. A
component can be fully implemented and tested while remaining invisible to the
user if it is absent from `registeredPlugins`.

## Bundled map data

`src/plugins/indonesia-map-data.js` is generated, checked-in data containing 38
provinces and 514 administrative areas. Refresh it with:

```sh
npm --prefix frontend-preact run map:refresh
npm --prefix frontend-preact run map:check
```

`src/plugins/indonesia-map-crosswalk.js` is the matching administrative
name/type/code reference data. These large files are data artifacts, not
behavioral modules, so they remain separate from the map logic.

The refresh script downloads the pinned GeoBoundaries source revision unless
`INDONESIA_MAP_SOURCE_FILE` points to a local GeoJSON file. It applies the
crosswalk in `indonesia-map-crosswalk.js`, excludes five non-administrative
features, simplifies coordinates with tolerance `0.03`, and writes the module
used by the offline map.
