// Application-wide autosave registry (ported from the vlang sibling's
// `autosave.mjs`, adapted to this codebase's `check-*.mjs` suite style).
//
// Any workspace registers its flush function; navigation and window close
// flush every registered workspace in registration order. Individual
// coordinators (e.g. `note-save-coordinator.js`) keep their own ordering,
// coalescing, and retry semantics — this registry only owns the fan-out.
// Pure DOM-free module: candidate for the future shared JS library as-is.
const registeredFlushers = new Set();

export function registerAutosave(flush) {
  if (typeof flush !== 'function') {
    throw new TypeError('Autosave flusher must be a function');
  }
  registeredFlushers.add(flush);
  return () => registeredFlushers.delete(flush);
}

export async function flushRegisteredAutosaves() {
  let saved = true;
  for (const flush of [...registeredFlushers]) {
    try {
      saved = (await flush()) !== false && saved;
    } catch {
      saved = false;
    }
  }
  return saved;
}

export function createAutosave(write, { delay = 350, onError = () => {} } = {}) {
  const pending = new Map();
  let timer;
  let tail = Promise.resolve(true);

  function flush() {
    clearTimeout(timer);
    const batch = [...pending.values()];
    pending.clear();
    if (!batch.length) return tail;
    tail = tail.then(async () => {
      let saved = true;
      for (const value of batch) {
        try {
          await write(value);
        } catch (error) {
          saved = false;
          onError(error);
        }
      }
      return saved;
    });
    return tail;
  }

  return {
    schedule(key, value) {
      pending.set(key, value);
      clearTimeout(timer);
      timer = setTimeout(flush, delay);
    },
    flush
  };
}
