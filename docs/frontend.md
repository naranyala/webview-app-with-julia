# Frontend guide

## Production application

The launcher loads the Octane/Rsbuild application in `frontend/`. Its source
entry point is `frontend/src/index.js`; the application shell is in
`frontend/src/App.tsrx`; and `frontend/src/backend.js` is the only browser-to-
Julia bridge adapter.

```sh
npm --prefix frontend ci
npm --prefix frontend run dev       # serve on :3000
npm --prefix frontend test          # bridge adapter tests
npm --prefix frontend run check     # Biome lint and formatting check
npm --prefix frontend run build     # check and produce the inline HTML bundle
npm --prefix frontend run verify    # check, test, and build
```

`frontend/dist/index.html` is generated and ignored by Git. The single-file
plugin in `frontend/scripts/single-file-html-plugin.js` inlines the local CSS
and JavaScript so the native launcher can load it with `webview_set_html`.

## Adding a tool

Add a tool to the relevant entry in `WORKSPACES` in `frontend/src/App.tsrx`,
then implement a renderer for that tool. Do not expose a tool card until its
view is reachable; otherwise a user can navigate into an empty workspace.

All native calls must go through `writingBackend` or `musicBackend` in
`frontend/src/backend.js`. Add a focused `node:test` case in `frontend/test/`
when expanding that adapter. Browser development intentionally rejects native
calls rather than returning fake data, which keeps the desktop contract
observable during development.

## Legacy frontend

`frontend-preact/` is retained as an archived reference implementation and
contains its historical plugin suite and tests. It is not built or launched by
`run.sh`; do not add production features or acceptance checks there.
