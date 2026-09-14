import * as stylex from '@stylexjs/stylex';

// Design tokens — the entire interface reads these, so a palette or theme
// change lands everywhere at once (shell, all 10 plugins, previews).
//
// Note: values MUST be static literals (no `var(--…)` references).
// StyleX 0.19 cannot compile cross-file `var()` constants — it emits
// dangling `var(--x…)` aliases with no definitions, which silently unstyles
// production. `defineVars` + `createTheme` is the supported theming path:
// `tokens` holds the dark theme, `lightTheme` overrides it, and `App.jsx`
// applies the theme class on the workspace root. Plain-CSS regions
// (`.jv-*`, `.essay-preview`) still follow `stylex.css` `--wb-*` variables
// via `data-theme`; keep both palettes in sync.
//
// Names are stable API: components must keep using these keys instead of
// hardcoding colors. Border shorthands containing tokens
// (`` `1px solid ${c.border}` ``) do NOT compile — use
// borderWidth/borderStyle/borderColor longhands instead.

export const tokens = stylex.defineVars({
  bg: '#111318',
  surface: '#191d25',
  surfaceAlt: '#232832',
  surfaceHover: '#2a313d',
  text: '#f5f1e8',
  textSecondary: '#b3b8c2',
  muted: '#7e8795',
  border: 'rgba(232, 236, 231, 0.13)',
  borderStrong: 'rgba(232, 236, 231, 0.22)',
  cyan: '#78d8d3',
  cyanMuted: 'rgba(120, 216, 211, 0.15)',
  amber: '#f2bf70',
  amberMuted: 'rgba(242, 191, 112, 0.16)',
  emerald: '#6ad3a4',
  emeraldMuted: 'rgba(106, 211, 164, 0.15)',
  red: '#f08a8a',
  redMuted: 'rgba(240, 138, 138, 0.15)',
  blue: '#8bb5e9',
  blueMuted: 'rgba(139, 181, 233, 0.15)',
  purple: '#c4a8eb',
  purpleMuted: 'rgba(196, 168, 235, 0.15)',
  coral: '#f3a078',
  coralMuted: 'rgba(243, 160, 120, 0.15)',
  green: '#6ad3a4',
  greenMark: 'rgba(106, 211, 164, 0.15)',
  gold: '#f2bf70',
  goldMark: 'rgba(242, 191, 112, 0.15)',
  sidebar: '#151820',
  sidebarHover: '#202630',
  accent: '#f2bf70',
  accentMuted: 'rgba(242, 191, 112, 0.16)',
  teal: '#70d4c7',
  tealMuted: 'rgba(112, 212, 199, 0.15)',
  orange: '#f2a071',
  orangeMuted: 'rgba(242, 160, 113, 0.15)',
  cyanMark: 'rgba(120, 216, 211, 0.15)',
  cyanStrong: '#9ae5e0',
  purpleStrong: '#d8c4f2',
  inkOnAccent: '#22180c',
  fontBody:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  gridLine: 'rgba(190, 198, 204, 0.1)',
  heroBackground:
    'radial-gradient(circle at 92% 18%, rgba(120, 216, 211, 0.18), transparent 14rem), linear-gradient(135deg, rgba(196, 168, 235, 0.08), transparent 55%)',
  mediaBackground: 'linear-gradient(145deg, #78d8d3, #2a7777)',
  sidebarBackground:
    'linear-gradient(180deg, rgba(120, 216, 211, 0.06), transparent 18rem)',
  shadowCard: '0 10px 28px rgba(4, 6, 10, 0.26)',
  shadowCardHover: '0 16px 32px rgba(4, 6, 10, 0.38)',
  shadowPanel: '0 12px 30px rgba(4, 6, 10, 0.22)',
  shadowSidebar: '12px 0 32px rgba(4, 6, 10, 0.34)',
  shadowModal: '0 28px 80px rgba(4, 6, 10, 0.48)',
  scrim: 'rgba(12, 14, 18, 0.58)',
  accentStrong: '#9ae5e0',
  amberStrong: '#ffd28e',
  onAccent: '#22180c',
  translucent: 'rgba(21, 24, 32, 0.9)',
  overlay: 'rgba(21, 24, 32, 0.9)'
});

export const lightTheme = stylex.createTheme(tokens, {
  bg: '#f4f1ea',
  surface: '#fffdf8',
  surfaceAlt: '#ece9e1',
  surfaceHover: '#e4e1d8',
  text: '#20262d',
  textSecondary: '#5f6974',
  muted: '#8c949b',
  border: 'rgba(32, 38, 45, 0.12)',
  borderStrong: 'rgba(32, 38, 45, 0.2)',
  cyan: '#2f8e89',
  cyanMuted: 'rgba(47, 142, 137, 0.13)',
  amber: '#b16f2d',
  amberMuted: 'rgba(177, 111, 45, 0.13)',
  emerald: '#2c8e68',
  emeraldMuted: 'rgba(44, 142, 104, 0.13)',
  red: '#c14d51',
  redMuted: 'rgba(193, 77, 81, 0.12)',
  blue: '#4e78ad',
  blueMuted: 'rgba(78, 120, 173, 0.13)',
  purple: '#7b5ba7',
  purpleMuted: 'rgba(123, 91, 167, 0.13)',
  coral: '#c96d43',
  coralMuted: 'rgba(201, 109, 67, 0.13)',
  green: '#2c8e68',
  greenMark: 'rgba(44, 142, 104, 0.13)',
  gold: '#b16f2d',
  goldMark: 'rgba(177, 111, 45, 0.13)',
  sidebar: '#ebe7de',
  sidebarHover: '#ddd8cc',
  accent: '#b16f2d',
  accentMuted: 'rgba(177, 111, 45, 0.13)',
  teal: '#2b8e83',
  tealMuted: 'rgba(43, 142, 131, 0.13)',
  orange: '#c96d43',
  orangeMuted: 'rgba(201, 109, 67, 0.13)',
  cyanMark: 'rgba(47, 142, 137, 0.13)',
  cyanStrong: '#26716d',
  purpleStrong: '#654789',
  inkOnAccent: '#fffdf8',
  gridLine: 'rgba(32, 38, 45, 0.1)',
  heroBackground:
    'radial-gradient(circle at 92% 18%, rgba(47, 142, 137, 0.14), transparent 14rem), linear-gradient(135deg, rgba(123, 91, 167, 0.07), transparent 55%)',
  mediaBackground: 'linear-gradient(145deg, #2f8e89, #1c5f60)',
  sidebarBackground:
    'linear-gradient(180deg, rgba(47, 142, 137, 0.08), transparent 18rem)',
  shadowCard: '0 10px 28px rgba(71, 61, 46, 0.1)',
  shadowCardHover: '0 16px 32px rgba(71, 61, 46, 0.16)',
  shadowPanel: '0 12px 30px rgba(71, 61, 46, 0.1)',
  shadowSidebar: '12px 0 32px rgba(71, 61, 46, 0.12)',
  shadowModal: '0 28px 80px rgba(71, 61, 46, 0.2)',
  scrim: 'rgba(32, 38, 45, 0.36)',
  accentStrong: '#26716d',
  amberStrong: '#8f541e',
  onAccent: '#fffdf8',
  translucent: 'rgba(255, 253, 248, 0.94)',
  overlay: 'rgba(255, 253, 248, 0.94)'
});

export const c = {
  ...tokens,
  radius: 12,
  fontMono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  onDark: 'white'
};
