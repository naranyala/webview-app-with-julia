# Tools

## Tools reachable from the launcher

The launcher registers ten entries from `frontendPlugins` and renders them in
`App.jsx`.

### Sample Library

Select a volume and start an asset scan. The native backend provides volume
metadata and bounded scan results grouped into Blender files, audio, renders,
and other files. Browser mode uses mock volumes; native scans read only the
selected volume.

### Monitor EQ

The equalizer is a UI-only control surface. It has Flat, Focus, Warm, and
Vocal presets, seven gain bands (`60`, `150`, `400`, `1k`, `2.4k`, `6k`, `14k`),
an enable/bypass switch, and a 0-100 master volume. It does not process audio
or persist settings.

### Tab Vault

Import JSON from a file, drag and drop, or paste it. Vaults can be searched,
renamed, deleted, exported individually, or exported together. The detail view
supports Tree and Raw modes; primitive leaf values can be edited as JSON.
Vaults are stored under the `tab-vault.collections` local-storage key.

### MIR Papers

The bundled academic-paper sample can be read in Draft (single-column) or
Final (two-column) mode. The Paper submenu contains:

- Reader: section navigation, citations, figures, reading statistics, print,
  and PDF export.
- Reference Manager: citation counts, missing/uncited references, key rename
  with cascade, add/delete, and BibTeX export.
- Image Assets: SVG paste or PNG/JPEG/SVG upload, caption/credit editing,
  usage tracking, and figure embedding.

Paper citations use `[@key]`. Figures use a full-line marker such as
`![Spectrogram](fig:spectrogram)`. Uploads are capped at 1.5 MiB. SVG is
sanitized for inline display; vector figures use a labeled placeholder in PDF
output. Paper edits are stored in memory and are lost on reload.

Three PDF engines are available through the shared adapter: jsPDF, pdf-lib,
and pdfmake. Browser mode downloads the result; a complete native `savePdf`
binding can write it to the user's Documents folder.

### MIR Lab

Analyze a generated 440 Hz tone or open an audio file. The browser mirror
computes RMS, peak amplitude, zero-crossing rate, sample count, sample rate,
and duration. Long mono buffers are reduced to at most 262,144 samples before a
native request. Results can be logged through `createNote` when that adapter is
available.

### Indonesia Map

The Leaflet map bundles 38 provinces and 514 kabupaten/kota
areas. Use Province overview or Kabupaten / Kota mode, search the visible list,
focus a province, click a region, and inspect the corresponding data table.
Boundaries and lookup data are bundled locally; no map tile service is required
for the boundary layer.

## Other registered tools

The following modules are also registered:

| Module | Implemented behavior |
| --- | --- |
| `chain-notes.jsx` | Searchable Q&A notes, autosave coordination, external-chat import, Markdown rendering, print, and three-engine PDF export. |
| `quiz.jsx` | Session mode plus an editor for three bundled read-only decks and editable user decks. |
| `todo.jsx` | Todo list with all/active/completed filters, due dates, hash filters, local storage, and calendar mode. |
| `blender-companion.jsx` | Local scene tracking with Blender engine/stage fields and logging to notes. |

Chain Notes and Blender Companion use note bindings, while Quiz uses the quiz
storage contract.
