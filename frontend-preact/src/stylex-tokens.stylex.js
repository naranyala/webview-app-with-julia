// Design tokens — the entire interface reads these, so a palette or theme
// change lands everywhere at once (shell, all 10 plugins, previews).
//
// Values are CSS `var()` references resolved by `stylex.css`, which defines
// every `--wb-*` variable twice: `:root` (dark) and
// `:root[data-theme='light']` (light), plus a `prefers-color-scheme`
// fallback. `App.jsx` switches themes by setting `data-theme` on
// `<html>` and persisting the choice in localStorage.
//
// Names are stable API: components must keep using these keys instead of
// hardcoding colors.
export const c = {
  bg: 'var(--wb-bg)',
  surface: 'var(--wb-surface)',
  surfaceAlt: 'var(--wb-surface-alt)',
  surfaceHover: 'var(--wb-surface-hover)',
  text: 'var(--wb-text)',
  textSecondary: 'var(--wb-text-secondary)',
  muted: 'var(--wb-muted)',
  border: 'var(--wb-border)',
  borderStrong: 'var(--wb-border-strong)',
  cyan: 'var(--wb-cyan)',
  cyanMuted: 'var(--wb-cyan-muted)',
  amber: 'var(--wb-amber)',
  amberMuted: 'var(--wb-amber-muted)',
  emerald: 'var(--wb-emerald)',
  emeraldMuted: 'var(--wb-emerald-muted)',
  red: 'var(--wb-red)',
  redMuted: 'var(--wb-red-muted)',
  blue: 'var(--wb-blue)',
  blueMuted: 'var(--wb-blue-muted)',
  purple: 'var(--wb-purple)',
  purpleMuted: 'var(--wb-purple-muted)',
  coral: 'var(--wb-coral)',
  coralMuted: 'var(--wb-coral-muted)',
  green: 'var(--wb-green)',
  greenMark: 'var(--wb-green-mark)',
  gold: 'var(--wb-gold)',
  goldMark: 'var(--wb-gold-mark)',
  // Workspace shell tokens.
  sidebar: 'var(--wb-sidebar)',
  sidebarHover: 'var(--wb-sidebar-hover)',
  accent: 'var(--wb-accent)',
  accentMuted: 'var(--wb-accent-muted)',
  teal: 'var(--wb-teal)',
  tealMuted: 'var(--wb-teal-muted)',
  orange: 'var(--wb-orange)',
  orangeMuted: 'var(--wb-orange-muted)',
  cyanMark: 'var(--wb-cyan-mark)',
  // Interaction helpers (theme-aware so hover/translucency work in both modes).
  accentStrong: 'var(--wb-cyan-strong)',
  amberStrong: 'var(--wb-amber-strong)',
  onAccent: 'var(--wb-ink-on-accent)',
  onDark: 'white',
  translucent: 'var(--wb-overlay)',
  overlay: 'var(--wb-scrim)',
  radius: 12,
  fontMono: 'var(--wb-font-mono)'
};
