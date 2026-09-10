import { useEffect, useState } from 'preact/hooks';
import { backend, backendError, errorDetails } from './backend.js';
import { sx } from './stylex-styles.js';

export function BackendStatus({ compact = false }) {
  const [count, setCount] = useState(null);
  const [systemInfo, setSystemInfo] = useState('');
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
      await backend.getStatus();
      setHealth('ok');
      setHealthDetail('');
    } catch (err) {
      setHealth('unavailable');
      setHealthDetail(errorDetails(err).message);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await backend.getStatus();
        if (!cancelled) {
          setHealth('ok');
          setHealthDetail('');
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
      : health === 'unavailable'
        ? ' · Backend unavailable'
        : '';

  return (
    <div className={sx('backend-status')} aria-live="polite">
      <span className={sx('backend-status-label')}>
        Backend{backend.isNative() ? '' : ' (mock)'}
        {healthBadge}
      </span>
      <span className={sx('backend-status-value')}>
        {[
          systemInfo && `${systemInfo}`,
          timestamp && `t:${timestamp}`,
          count !== null && `#${count}`
        ]
          .filter(Boolean)
          .join(' · ') ||
          (compact ? 'tap Refresh to connect' : 'not connected yet')}
      </span>
      <span className={sx('backend-status-actions')}>
        <button
          className={sx('backendButton')}
          type="button"
          disabled={pending}
          onClick={() => run(async () => setCount(await backend.increment(1)))}
        >
          +1
        </button>
        <button
          className={sx('backendButton')}
          type="button"
          disabled={pending}
          onClick={() => run(async () => setCount(await backend.reset()))}
        >
          Reset
        </button>
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
      {health === 'unavailable' && healthDetail && (
        <span className={sx('backend-status-error')} role="alert">
          Backend unavailable: {healthDetail}
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
