# Theming strategy

The frontend has two token layers that deliberately share the same semantic
roles:

- `src/stylex-tokens.stylex.js` is the source for component styling. New shell
  UI should use `appCanvas`, `appSheet`, `appSheetRaised`, `appPrimary`, and
  `appRadius` instead of choosing a raw colour.
- `src/stylex.css` mirrors those roles as `--wb-app-*` variables for legacy or
  third-party plain-CSS feature regions.

The older hue-based tokens remain a compatibility layer for existing tools.
Migrate a tool only when touching its visual code; do not replace its colours
ad hoc. This keeps a complete feature rewrite from becoming a theme rewrite.

Theme preference is `system`, `light`, or `dark`. It is saved under
`webview-workbench-theme`; `system` follows operating-system changes while the
app is open. `theme-preference.js` is intentionally framework-free so future
surfaces can use the same policy.

Mobile rules: design the 320px layout first, preserve a minimum 44px touch
target for interactive controls, respect safe-area insets, and only introduce
desktop columns at 900px or wider.
