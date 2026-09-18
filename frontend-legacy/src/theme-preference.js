// Theme preference is intentionally separate from rendering. New screens can
// use this small policy module without coupling to an App component or a
// specific storage implementation.
export const THEME_PREFERENCES = Object.freeze(['system', 'light', 'dark']);

export function normalizeThemePreference(value) {
  return THEME_PREFERENCES.includes(value) ? value : 'system';
}

export function resolveTheme(preference, systemTheme = 'light') {
  const selected = normalizeThemePreference(preference);
  return selected === 'system' ? systemTheme : selected;
}

export function nextThemePreference(preference) {
  const index = THEME_PREFERENCES.indexOf(normalizeThemePreference(preference));
  return THEME_PREFERENCES[(index + 1) % THEME_PREFERENCES.length];
}
