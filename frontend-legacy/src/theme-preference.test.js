import { describe, expect, test } from 'vitest';
import {
  nextThemePreference,
  normalizeThemePreference,
  resolveTheme
} from './theme-preference.js';

describe('theme preference policy', () => {
  test('uses system preference when no valid choice is stored', () => {
    expect(normalizeThemePreference(null)).toBe('system');
    expect(resolveTheme('system', 'dark')).toBe('dark');
  });

  test('honors an explicit light or dark preference', () => {
    expect(resolveTheme('light', 'dark')).toBe('light');
    expect(resolveTheme('dark', 'light')).toBe('dark');
  });

  test('cycles through every supported preference', () => {
    expect(nextThemePreference('system')).toBe('light');
    expect(nextThemePreference('light')).toBe('dark');
    expect(nextThemePreference('dark')).toBe('system');
  });
});
