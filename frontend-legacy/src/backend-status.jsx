import { useEffect, useState } from 'preact/hooks';
import { backend, backendError, errorDetails } from './backend.js';
import { sx } from './stylex-styles.js';

// Small health probe used by the shell header. Calls are serialized locally so
// repeated clicks cannot overlap a bridge request or race their status text.
export function BackendStatus({ compact = false, hideCounter = false }) {
  const [count, setCount] = useState(null);
  const [systemInfo, setSystemInfo] = useState(null);
  const [timestamp, setTimestamp] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [health, setHealth] = useState('unknown');
  const [healthDetail, setHealthDetail] = useState('');

  async function run(fn) {
    if (pending) return;
    setPending(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(backendError(err));
    } finally {
      setPending(false);
    }
  }

  async function probe() {
    try {
      const status = await backend.getStatus();
      setHealth(status.status === 'ok' ? 'ok' : 'degraded');
      setHealthDetail(
        status.status === 'ok' ? '' : `Backend status: ${status.status}`
      );
    } catch (err) {
      setHealth('unavailable');
      setHealthDetail(errorDetails(err).message);
    }
  }

  useEffect(() => {
    // Probe once on mount without routing through the interactive `run` helper;
    // this initial check should not show a transient action error to the user.
    let cancelled = false;
    (async () => {
      try {
        const status = await backend.getStatus();
        if (!cancelled) {
          setHealth(status.status === 'ok' ? 'ok' : 'degraded');
          setHealthDetail(
            status.status === 'ok' ? '' : `Backend status: ${status.status}`
          );
        }
      } catch (err) {
        if (!cancelled) {
          setHealth('unavailable');
          setHealthDetail(errorDetails(err).message);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const healthBadge =
    health === 'ok'
      ? ' · Backend ok'
      : health === 'degraded'
        ? ' · Backend degraded'
        : health === 'unavailable'
          ? ' · Backend unavailable'
          : '';

  function formatSystemInfo(info) {
    if (!info) return '';
    try {
      const parsed = typeof info === 'string' ? JSON.parse(info) : info;
      const parts = [];
      if (parsed.julia_version) parts.push(`Julia ${parsed.julia_version}`);
      if (parsed.platform) parts.push(parsed.platform);
      if (parsed.features !== undefined)
        parts.push(`${parsed.features} features`);
      return parts.join(' · ') || '';
    } catch {
      return String(info);
    }
  }

  return (
    <div className={sx('backend-status')} aria-live="polite">
      <span className={sx('backend-status-label')}>
        Backend{backend.isNative() ? '' : ' (mock)'}
        {healthBadge}
      </span>
      <span className={sx('backend-status-value')}>
        {[
          formatSystemInfo(systemInfo),
          timestamp && `t:${timestamp}`,
          count !== null && `#${count}`
        ]
          .filter(Boolean)
          .join(' · ') ||
          (compact ? 'tap Refresh to connect' : 'not connected yet')}
      </span>
      <span className={sx('backend-status-actions')}>
        {!hideCounter && (
          <button
            className={sx('backendButton')}
            type="button"
            disabled={pending}
            onClick={() =>
              run(async () => setCount(await backend.increment(1)))
            }
          >
            +1
          </button>
        )}
        {!hideCounter && (
          <button
            className={sx('backendButton')}
            type="button"
            disabled={pending}
            onClick={() => run(async () => setCount(await backend.reset()))}
          >
            Reset
          </button>
        )}
        <button
          className={sx('backendButton')}
          type="button"
          disabled={pending}
          onClick={() =>
            run(async () => {
              await probe();
              setSystemInfo(await backend.getSystemInfo());
              setTimestamp(await backend.getTimestamp());
            })
          }
        >
          Refresh
        </button>
      </span>
      {(health === 'unavailable' || health === 'degraded') && healthDetail && (
        <span className={sx('backend-status-error')} role="alert">
          Backend health: {healthDetail}
        </span>
      )}
      {error && (
        <span className={sx('backend-status-error')} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
