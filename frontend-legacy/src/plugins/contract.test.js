import { describe, expect, test } from 'vitest';
import { defineFrontendPlugin } from './contract.js';

const completePlugin = {
  id: 'example',
  index: '01',
  title: 'Example',
  description: 'An example plugin.',
  tone: 'blue',
  component: () => null
};

describe('frontend plugin contract', () => {
  test('freezes a complete plugin manifest', () => {
    const plugin = defineFrontendPlugin({ ...completePlugin });

    expect(plugin).toMatchObject(completePlugin);
    expect(Object.isFrozen(plugin)).toBe(true);
  });

  test('rejects every missing required field', () => {
    for (const field of Object.keys(completePlugin)) {
      const invalid = { ...completePlugin, [field]: undefined };
      expect(() => defineFrontendPlugin(invalid)).toThrow(
        `Frontend plugin is missing ${field}`
      );
    }
  });
});
