import { afterEach, describe, expect, test, vi } from 'vitest';
import { createNoteSaveCoordinator } from './note-save-coordinator.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('note save coordinator', () => {
  test('coalesces edits and never reports a stale response as saved', async () => {
    vi.useFakeTimers();
    const calls = [];
    let resolveFirst;
    const save = vi.fn((snapshot) => {
      calls.push(snapshot);
      if (calls.length === 1) {
        return new Promise((resolve) => {
          resolveFirst = () => resolve({ ...snapshot, updated: 'old' });
        });
      }
      return Promise.resolve({ ...snapshot, updated: 'new' });
    });
    const coordinator = createNoteSaveCoordinator({ save, delay: 10 });
    const events = [];
    const unsubscribe = coordinator.subscribe('note-1', (event) => {
      if (event.status === 'saved') events.push(event.result);
    });

    coordinator.schedule({
      id: 'note-1',
      title: 'Old',
      tag: 'Draft',
      body: 'A'
    });
    await vi.advanceTimersByTimeAsync(10);
    coordinator.schedule({
      id: 'note-1',
      title: 'New',
      tag: 'Draft',
      body: 'B'
    });
    resolveFirst();
    await coordinator.flush('note-1');

    expect(save).toHaveBeenCalledTimes(2);
    expect(calls[1].title).toBe('New');
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('New');
    unsubscribe();
  });

  test('retains a rejected snapshot for an explicit retry', async () => {
    let attempts = 0;
    const save = vi.fn((snapshot) => {
      attempts += 1;
      return attempts === 1
        ? Promise.reject(new Error('disk full'))
        : Promise.resolve(snapshot);
    });
    const coordinator = createNoteSaveCoordinator({ save });

    coordinator.schedule({
      id: 'note-2',
      title: 'Draft',
      tag: 'Draft',
      body: 'Body'
    });
    await expect(coordinator.flush('note-2')).rejects.toThrow('disk full');
    await expect(coordinator.retry('note-2')).resolves.toMatchObject({
      title: 'Draft'
    });
    expect(save).toHaveBeenCalledTimes(2);
  });
});
