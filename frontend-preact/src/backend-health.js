import { useEffect, useState } from 'preact/hooks';
import { backend, errorDetails } from './backend.js';

// Backend reachability for the shell's offline indicator.
//
// States: 'unknown' (before the first probe), 'ok', 'degraded',
// 'unavailable' (probe failed: bridge missing, timed out, or errored), and
// 'offline' (the browser reports no network). Pure `resolveHealth` stays
// testable without a bridge; the hook below is thin polling glue.

export function resolveHealth({ online, status, error }) {
  if (!online) {
    return {
      state: 'offline',
      detail: 'This device reports no network connection.'
    };
  }
  if (error) return { state: 'unavailable', detail: error };
  if (!status) return { state: 'unknown', detail: '' };
  if (status.status === 'ok') return { state: 'ok', detail: '' };
  return {
    state: 'degraded',
    detail: `Backend status: ${status.status}`
  };
}

export function healthLabel(state) {
  switch (state) {
    case 'ok':
      return 'Connected';
    case 'degraded':
      return 'Degraded';
    case 'unavailable':
      return 'Unavailable';
    case 'offline':
      return 'Offline';
    default:
      return 'Checking…';
  }
}

function initialOnline() {
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean')
    return navigator.onLine;
  return true;
}

export function useBackendHealth({ intervalMs = 30000 } = {}) {
  const [online, setOnline] = useState(initialOnline);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [round, setRound] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function probe() {
      try {
        const next = await backend.getStatus();
        if (!cancelled) {
          setStatus(next);
          setError('');
        }
      } catch (err) {
        if (!cancelled) {
          setStatus(null);
          setError(errorDetails(err).message);
        }
      }
    }
    probe();
    const timer = setInterval(probe, intervalMs);
    function goOnline() {
      setOnline(true);
      probe();
    }
    function goOffline() {
      setOnline(false);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('online', goOnline);
      window.addEventListener('offline', goOffline);
    }
    return () => {
      cancelled = true;
      clearInterval(timer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', goOnline);
        window.removeEventListener('offline', goOffline);
      }
    };
    // `round` re-triggers the effect for manual retries.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, round]);

  return {
    ...resolveHealth({ online, status, error }),
    online,
    refresh: () => setRound((value) => value + 1)
  };
}
