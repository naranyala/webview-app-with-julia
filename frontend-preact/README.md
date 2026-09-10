# Preact + esbuild (main frontend)

Blender + MIR studio shell built with Preact, esbuild, and StyleX. StyleX
styles are extracted at build time by `@stylexjs/unplugin`. Primary tools:
MIR Lab, Blender Studio, Session Notes (with PDF export via jspdf),
Trainer, and MIR Papers. Supporting tools: Production Tasks, Sample Library,
and Monitor EQ.

## Commands

```bash
npm install
npm run dev
```

Open <http://localhost:3000> while the development server is running.

Biome is included in the development loop:

```bash
npm run check          # lint and format check
npm run format         # format source files
npm run check:write    # apply safe Biome fixes
```

`npm run build` runs `npm run check` before creating production assets.

For the offline Indonesia Atlas data pipeline:

```bash
npm run map:refresh
npm run map:check
```

`map:refresh` uses the pinned geoBoundaries download. Set
`INDONESIA_MAP_SOURCE_FILE` to a local GeoJSON source when refreshing without a
network connection.

The Todos tool supports adding todos with optional due dates, completing and
deleting them, double-clicking to edit, toggling all todos, URL-hash filters
for all/active/completed, clear completed, and local storage persistence. The
Todos sidebar expands into Tasks and Calendar destinations with a monthly
picker; picking a day filters the list, and the full calendar shows per-day
dots for open and done tasks.

Chain Notes stores external AI conversations as local question-and-answer records.
Use `Import external chat` with `Question`/`Answer`, `Q`/`A`, `User`/`Assistant`,
or two paragraphs, then edit either field as needed. Native builds persist notes
through the Zig app-data store; browser development uses local storage when it is
available.

PDF export (`src/plugins/note-pdf.js`) supports three engines behind one
adapter: jsPDF (default), pdf-lib, and pdfmake. `Note ->` exports the active
exchange, `Chain ->` exports every visible exchange as one multi-page
document. Inside the native shell exports are written to the user's Documents
folder through the `savePdf` backend binding (unique filenames, `Saved to ...`
feedback); in the browser they download instead. `Print` renders the visible
chain into a print-only page so the system print dialog (including Save as
PDF) handles the output.

Q&A text is parsed as markdown (`src/plugins/note-markdown.js`: fenced code,
`#` headings, `-`/`1.` lists, `>` quotes, `---` rules, `**bold**` / `*italic*`
/ `` `code` ``). Code blocks render monospace with indentation preserved and a
shaded background in every engine; plain paragraphs keep the fast single-pass
layout. The print path uses a strict CSS reset (`PRINT_CSS_RESET`: `@page`
margins, normalized type scale, `pre-wrap` code treatment, page-break rules)
so output is deterministic across host WebViews.

```bash
npm run benchmark:pdf   # single-note + 20-entry chain benchmark per engine
npm test                # includes PDF generation + benchmark budget checks
```

Academic Paper (`src/plugins/paper.js`, `paper-data.js`, `academic-paper.jsx`)
is a document abstraction for reading papers: title, authors, venue, abstract,
keywords, markdown sections, figures, and `[@key]` citations numbered by first
appearance with a generated reference list. `Draft` reads single-column,
`Final` reads two-column (`column-width` flow with justified text and hyphenation).
`src/plugins/paper-pdf.js` converts the same model into the shared PDF block
pipeline (all three engines), reusing the existing `savePdf` backend binding,
browser download fallback, and print path.

The Paper sidebar expands into three destinations: Reader, Reference Manager
(`reference-manager.jsx`: citation counts, uncited/missing tracking, rename
with cascade, add/delete, BibTeX export), and Image Assets (`image-assets.jsx`:
SVG art plus PNG/JPEG uploads capped at 1.5 MB, usage tracking). Figures embed
with `![Caption](fig:id)` on its own line and render inline in the reader,
print, and every PDF engine (raster art embedded; vector art shows a labeled
placeholder in PDFs).

```bash
npm run benchmark:paper # sample-paper export benchmark per engine
```

`src/backend.js` wraps the Zig `window.*` RPC bindings and falls back to mocks
under `npm run dev`, so the UI runs standalone in the browser. The launcher
also includes a BackendStatus panel exercising `increment`/`reset`/`getSystemInfo`/
`getTimestamp` plus the native window controls.

For a production bundle:

```bash
npm run build
```

The bundled files are written to `public/assets/`.

The build also creates `dist/index.html`, a single self-contained HTML file
with the generated CSS and JavaScript inlined.
