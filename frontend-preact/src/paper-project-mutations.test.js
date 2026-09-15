import { describe, expect, test } from 'vitest';
import {
  createProjectMutationQueue,
  flushBeforeProjectMutation
} from './paper-project-mutations.mjs';

describe('paper project mutation queue', () => {
  test('serializes mutations after a pending autosave flush', async () => {
    const events = [];
    const queue = createProjectMutationQueue();
    const first = queue.run(async () => {
      await flushBeforeProjectMutation(async () => {
        events.push('flush');
        return true;
      });
      events.push('import');
    });
    const second = queue.run(async () => events.push('save'));
    await Promise.all([first, second]);
    expect(events).toEqual(['flush', 'import', 'save']);
  });

  test('continues after a failed mutation and blocks on a failed flush', async () => {
    const queue = createProjectMutationQueue();
    await expect(
      queue.run(() => Promise.reject(new Error('failed')))
    ).rejects.toThrow('failed');
    await expect(
      queue.run(() => flushBeforeProjectMutation(async () => false))
    ).rejects.toThrow('could not be saved');
    await expect(queue.run(async () => 'recovered')).resolves.toBe('recovered');
  });
});
