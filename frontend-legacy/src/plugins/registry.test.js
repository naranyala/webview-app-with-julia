import { describe, expect, test } from 'vitest';
import { frontendPlugins, getFrontendPlugin } from './index.js';

describe('frontend plugin registry', () => {
  test('exposes the launcher tools in display order', () => {
    expect(frontendPlugins.map((plugin) => plugin.id)).toEqual([
      'disk',
      'equalizer',
      'tabs',
      'paper',
      'mir',
      'media',
      'map',
      'notes',
      'blender',
      'todo',
      'settings',
      'diagnostics',
      'files',
      'gallery'
    ]);
    expect(new Set(frontendPlugins.map((plugin) => plugin.id)).size).toBe(14);
    expect(
      frontendPlugins.every(
        (plugin) => plugin.title && plugin.description && plugin.component
      )
    ).toBe(true);
  });

  test('looks up registered tools and rejects unknown ids', () => {
    expect(getFrontendPlugin('paper')).toBe(frontendPlugins[3]);
    expect(getFrontendPlugin('unknown')).toBeUndefined();
  });
});
