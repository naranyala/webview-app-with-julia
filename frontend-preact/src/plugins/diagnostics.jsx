import { useMemo, useState } from 'preact/hooks';
import { backend, backendError } from '../backend.js';
import {
  clearFrontendDiagnostics,
  frontendDiagnostics
} from '../diagnostics-store.js';
import { sx } from '../stylex-styles.js';

function downloadJson(value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `webview-diagnostics-${Date.now()}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Diagnostics() {
  const [report, setReport] = useState({
    schemaVersion: 1,
    generatedAt: '',
    logPath: '',
    entries: []
  });
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState('all');
  const [state, setState] = useState('idle');
  const [message, setMessage] = useState('');
  const combined = useMemo(
    () => [...report.entries, ...frontendDiagnostics()],
    [report]
  );
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return combined
      .filter((entry) => level === 'all' || entry.level === level)
      .filter(
        (entry) =>
          !needle ||
          [
            entry.source,
            entry.event,
            entry.operation,
            entry.code,
            entry.message
          ]
            .join(' ')
            .toLowerCase()
            .includes(needle)
      )
      .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
  }, [combined, level, query]);

  function snapshot() {
    return {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      backendLogPath: report.logPath,
      entries: combined
    };
  }

  async function refresh() {
    setState('loading');
    setMessage('');
    try {
      setReport(await backend.getDiagnostics(300));
      setState('ready');
    } catch (error) {
      setState('error');
      setMessage(backendError(error));
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(snapshot(), null, 2));
      setMessage('Diagnostic JSON copied');
    } catch {
      setMessage('Clipboard unavailable; use Export JSON.');
    }
  }

  async function clear() {
    setState('loading');
    try {
      await backend.clearDiagnostics();
      clearFrontendDiagnostics();
      setReport({
        schemaVersion: 1,
        generatedAt: '',
        logPath: '',
        entries: []
      });
      setState('ready');
      setMessage('Diagnostics cleared');
    } catch (error) {
      setState('error');
      setMessage(backendError(error));
    }
  }

  return (
    <section className={sx('tool-page')}>
      <div className={sx('tool-heading')}>
        <div>
          <p className={sx('eyebrow')}>Support</p>
          <h1 className={sx('page-title')}>Diagnostics</h1>
          <p className={sx('lede')}>
            Structured, bounded logs for troubleshooting by people and agents.
          </p>
        </div>
        <span className={sx('mock-badge')}>{state}</span>
      </div>
      <div className={sx('tool-panel')}>
        <div className={sx('notes-list-heading')}>
          <input
            className={sx('search-field')}
            aria-label="Search diagnostics"
            placeholder="Search operation, code, or message"
            value={query}
            onInput={(event) => setQuery(event.currentTarget.value)}
          />
          <select
            className={sx('select')}
            aria-label="Diagnostic level"
            value={level}
            onChange={(event) => setLevel(event.currentTarget.value)}
          >
            <option value="all">All levels</option>
            <option value="error">Errors</option>
            <option value="warn">Warnings</option>
            <option value="info">Information</option>
          </select>
          <button
            type="button"
            className={sx('new-note-button')}
            onClick={refresh}
          >
            Refresh
          </button>
          <button type="button" className={sx('text-button')} onClick={copy}>
            Copy JSON
          </button>
          <button
            type="button"
            className={sx('text-button')}
            onClick={() => downloadJson(snapshot())}
          >
            Export JSON
          </button>
          <button type="button" className={sx('text-button')} onClick={clear}>
            Clear
          </button>
        </div>
        <div className={sx('note-editor-footer')}>
          <span>
            {combined.length} entries · {visible.length} shown
          </span>
          {report.logPath && <span>JSONL: {report.logPath}</span>}
          {message && (
            <span className={state === 'error' ? sx('error') : undefined}>
              {message}
            </span>
          )}
        </div>
      </div>
      <div className={sx('notes-list')}>
        {visible.map((entry, index) => (
          <article
            className={sx('tool-panel')}
            key={`${entry.timestamp}-${entry.requestId}-${index}`}
          >
            <div className={sx('notes-list-heading')}>
              <strong>
                {entry.level.toUpperCase()} · {entry.event}
              </strong>
              <span>
                {entry.source} · {entry.timestamp}
              </span>
            </div>
            <p>{entry.message || entry.operation || 'Completed'}</p>
            <div className={sx('note-editor-footer')}>
              {entry.operation && <span>operation: {entry.operation}</span>}
              {entry.code && <span>code: {entry.code}</span>}
              {entry.requestId && <span>request: {entry.requestId}</span>}
              {entry.durationMs !== undefined && (
                <span>{entry.durationMs} ms</span>
              )}
              <span>
                {entry.category} ·{' '}
                {entry.recoverable ? 'recoverable' : 'terminal'}
              </span>
            </div>
            {Object.keys(entry.details || {}).length > 0 && (
              <pre className={sx('qna-import-input')}>
                {JSON.stringify(entry.details, null, 2)}
              </pre>
            )}
          </article>
        ))}
        {visible.length === 0 && (
          <p className={sx('empty-notes')}>
            Refresh to load diagnostic events.
          </p>
        )}
      </div>
    </section>
  );
}
