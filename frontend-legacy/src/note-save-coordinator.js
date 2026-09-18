import { registerAutosave } from './autosave.mjs';
import { backend } from './backend.js';

export function createNoteSaveCoordinator({ save, delay = 350 }) {
  const entries = new Map();

  function getEntry(id) {
    let entry = entries.get(id);
    if (!entry) {
      entry = {
        id,
        version: 0,
        pending: null,
        timer: null,
        inFlight: null,
        listeners: new Set()
      };
      entries.set(id, entry);
    }
    return entry;
  }

  function notify(entry, event) {
    for (const listener of entry.listeners) {
      try {
        listener(event);
      } catch {
        // A stale component must not break the save pipeline.
      }
    }
  }

  async function drain(entry) {
    if (entry.inFlight) return entry.inFlight;

    const run = (async () => {
      let result;
      while (entry.pending) {
        if (entry.timer !== null) {
          clearTimeout(entry.timer);
          entry.timer = null;
        }

        const version = entry.version;
        const snapshot = entry.pending;
        entry.pending = null;
        notify(entry, { status: 'saving', snapshot, version });

        try {
          result = await save(snapshot);
        } catch (error) {
          if (entry.version === version) {
            entry.pending = snapshot;
            notify(entry, { status: 'error', error, snapshot, version });
            throw error;
          }
          // A newer local snapshot supersedes a failed older request.
        }

        if (entry.version === version) {
          notify(entry, { status: 'saved', result, snapshot, version });
        }
      }
      return result;
    })();

    entry.inFlight = run;
    try {
      return await run;
    } finally {
      entry.inFlight = null;
      if (
        !entry.pending &&
        entry.timer === null &&
        entry.listeners.size === 0
      ) {
        entries.delete(entry.id);
      }
    }
  }

  function subscribe(id, listener) {
    const entry = getEntry(id);
    entry.listeners.add(listener);
    return () => {
      entry.listeners.delete(listener);
      if (!entry.pending && entry.timer === null && !entry.inFlight) {
        entries.delete(id);
      }
    };
  }

  function schedule(snapshot) {
    const entry = getEntry(snapshot.id);
    entry.version += 1;
    entry.pending = snapshot;
    notify(entry, { status: 'queued', snapshot, version: entry.version });
    if (entry.timer !== null) clearTimeout(entry.timer);
    entry.timer = setTimeout(() => {
      entry.timer = null;
      void drain(entry).catch(() => {});
    }, delay);
    return entry.version;
  }

  function flush(id) {
    const entry = entries.get(id);
    if (!entry) return Promise.resolve(undefined);
    if (entry.timer !== null) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
    if (!entry.pending && !entry.inFlight) return Promise.resolve(undefined);
    return drain(entry);
  }

  async function flushAll() {
    const results = await Promise.allSettled(
      [...entries.keys()].map((id) => flush(id))
    );
    const failure = results.find((result) => result.status === 'rejected');
    if (failure) throw failure.reason;
  }

  function retry(id) {
    const entry = entries.get(id);
    if (!entry?.pending && !entry?.inFlight) return Promise.resolve(undefined);
    if (entry.timer !== null) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
    return drain(entry);
  }

  return { flush, flushAll, retry, schedule, subscribe };
}

export const noteSaveCoordinator = createNoteSaveCoordinator({
  save: (snapshot) =>
    backend.updateNote(snapshot.id, snapshot.title, snapshot.tag, snapshot.body)
});

export function flushPendingNoteSaves() {
  return noteSaveCoordinator.flushAll();
}

// Session Notes participates in the application-wide autosave registry so
// navigation and window close flush every workspace, not just notes.
registerAutosave(() => noteSaveCoordinator.flushAll().then(() => true));
