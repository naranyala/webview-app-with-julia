/**
 * Storage + location-hash helpers for the Todos plugin.
 *
 * Inside the native WebView the frontend is loaded from embedded HTML with
 * an opaque origin, where `window.localStorage` access throws a
 * SecurityError. Previously `TodoApp` called `localStorage.setItem` in an
 * effect with no guard, so opening the Todos workspace crashed the UI into
 * the error boundary. These helpers fall back to in-memory state when the
 * DOM storage or location APIs are unavailable or throw.
 */

const memoryStore = new Map();

function domStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

export function storageGet(key) {
  const storage = domStorage();
  if (storage) {
    try {
      return storage.getItem(key);
    } catch {
      // Fall through to the in-memory copy below.
    }
  }
  return memoryStore.has(key) ? memoryStore.get(key) : null;
}

export function storageSet(key, value) {
  const storage = domStorage();
  if (storage) {
    try {
      storage.setItem(key, value);
      return;
    } catch {
      // Fall through to the in-memory copy below.
    }
  }
  memoryStore.set(key, value);
}

export function readHash() {
  if (typeof window === 'undefined') return '';
  try {
    return window.location.hash;
  } catch {
    return '';
  }
}

export function writeHash(hash) {
  if (typeof window === 'undefined') return;
  try {
    if (window.location.hash !== hash) window.location.hash = hash;
  } catch {
    // Hash navigation is unavailable (e.g. opaque origin); ignore.
  }
}

export function onHashChange(listener) {
  if (typeof window === 'undefined') return () => {};
  try {
    window.addEventListener('hashchange', listener);
    return () => {
      try {
        window.removeEventListener('hashchange', listener);
      } catch {
        // Ignore cleanup failures on exotic hosts.
      }
    };
  } catch {
    return () => {};
  }
}
