import { useEffect, useRef, useState } from 'preact/hooks';
import { AsyncFeedback } from '../async-feedback.jsx';
import { backend, backendError } from '../backend.js';
import { sx } from '../stylex-styles.js';

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return 'Unknown';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function MediaInspector() {
  const [inputPath, setInputPath] = useState('');
  const [outputPath, setOutputPath] = useState('');
  const [info, setInfo] = useState(null);
  const [preview, setPreview] = useState('');
  const [plan, setPlan] = useState(null);
  const [capabilities, setCapabilities] = useState(null);
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const jobRef = useRef(null);
  const pollRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    backend
      .getMediaCapabilities()
      .then((value) => mountedRef.current && setCapabilities(value))
      .catch(
        (failure) => mountedRef.current && setError(backendError(failure))
      );
    return () => {
      mountedRef.current = false;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  async function run(label, action, onSuccess) {
    if (pending) return;
    setPending(label);
    setError('');
    setMessage('');
    try {
      const value = await action();
      if (mountedRef.current) onSuccess(value);
    } catch (failure) {
      if (mountedRef.current) setError(backendError(failure));
    } finally {
      if (mountedRef.current) setPending('');
    }
  }

  function inspect() {
    void run(
      'Inspecting file...',
      () => backend.inspectMedia(inputPath.trim()),
      (value) => {
        setInfo(value);
        setPreview('');
        setPlan(null);
        setMessage('Inspection complete.');
      }
    );
  }

  function loadPreview() {
    void run(
      'Loading preview...',
      () => backend.readText(inputPath.trim()),
      (value) => {
        setPreview(value);
        setMessage('Text preview loaded.');
      }
    );
  }

  function planConversion() {
    void run(
      'Planning conversion...',
      () => backend.planConversion(inputPath.trim(), outputPath.trim()),
      (value) => {
        setPlan(value);
        setMessage('Conversion route is ready.');
      }
    );
  }

  async function pollConversion(jobId) {
    try {
      const job = await backend.getMediaConversionStatus(jobId);
      if (!mountedRef.current || jobRef.current !== jobId) return;
      if (job.state === 'running') {
        setPending(`Converting ${Math.round(job.progress * 100)}%...`);
        pollRef.current = setTimeout(() => void pollConversion(jobId), 200);
      } else if (job.state === 'completed') {
        setPending('');
        setMessage(`Saved to ${job.result.output}`);
      } else {
        setPending('');
        setError(job.error || `Conversion ${job.state}.`);
      }
    } catch (failure) {
      if (mountedRef.current && jobRef.current === jobId) {
        setPending('');
        setError(backendError(failure));
      }
    }
  }

  async function convert() {
    if (pending) return;
    setPending('Starting conversion...');
    setError('');
    setMessage('');
    try {
      const job = await backend.startMediaConversion(
        inputPath.trim(),
        outputPath.trim()
      );
      if (!mountedRef.current) return;
      jobRef.current = job.id;
      if (job.state === 'completed') {
        setPending('');
        setMessage(`Saved to ${job.result.output}`);
      } else {
        setPending(`Converting ${Math.round(job.progress * 100)}%...`);
        void pollConversion(job.id);
      }
    } catch (failure) {
      if (mountedRef.current) {
        setPending('');
        setError(backendError(failure));
      }
    }
  }

  async function cancelConversion() {
    if (!jobRef.current) return;
    try {
      await backend.cancelMediaConversion(jobRef.current);
      setPending('');
      setMessage('Conversion cancelled.');
    } catch (failure) {
      setError(backendError(failure));
    }
  }

  const availableTools = capabilities
    ? Object.entries(capabilities.tools)
        .filter(([, available]) => available)
        .map(([name]) => name)
    : [];

  return (
    <section className={sx('tool-page')}>
      <div className={sx('tool-heading')}>
        <div>
          <p className={sx('eyebrow')}>Local media</p>
          <h1 className={sx('pageTitle')}>Media Inspector</h1>
          <p className={sx('lede')}>
            Inspect, preview, and convert permitted files.
          </p>
        </div>
        <span className={sx('mock-badge')}>
          {backend.isNative() ? 'Native' : 'Mock'}
        </span>
      </div>

      <AsyncFeedback pending={pending} error={error} message={message} />

      <div className={sx('media-inspector-grid')}>
        <section className={sx('tool-panel')}>
          <div className={sx('panel-heading')}>
            <div>
              <span className={sx('panel-label')}>Source</span>
              <h2 className={sx('panel-title')}>Inspect a file</h2>
            </div>
          </div>
          <label className={sx('select-label')} htmlFor="media-input-path">
            Absolute file path
          </label>
          <input
            id="media-input-path"
            className={sx('media-path-input')}
            value={inputPath}
            onInput={(event) => setInputPath(event.currentTarget.value)}
            placeholder="/home/user/Documents/example.md"
            disabled={Boolean(pending)}
          />
          <div className={sx('media-actions')}>
            <button
              type="button"
              className={sx('primary')}
              onClick={inspect}
              disabled={Boolean(pending) || !inputPath.trim()}
            >
              Inspect
            </button>
            <button
              type="button"
              className={sx('text-button')}
              onClick={loadPreview}
              disabled={Boolean(pending) || !inputPath.trim()}
            >
              Preview text
            </button>
          </div>
          {info && (
            <dl className={sx('media-details')}>
              <div>
                <dt>Kind</dt>
                <dd>{info.kind}</dd>
              </div>
              <div>
                <dt>MIME</dt>
                <dd>{info.mime}</dd>
              </div>
              <div>
                <dt>Size</dt>
                <dd>{formatBytes(info.size)}</dd>
              </div>
              <div>
                <dt>Dimensions</dt>
                <dd>
                  {info.width && info.height
                    ? `${info.width} x ${info.height}`
                    : 'Not applicable'}
                </dd>
              </div>
            </dl>
          )}
        </section>

        <section className={sx('tool-panel')}>
          <div className={sx('panel-heading')}>
            <div>
              <span className={sx('panel-label')}>Route</span>
              <h2 className={sx('panel-title')}>Conversion</h2>
            </div>
          </div>
          <label className={sx('select-label')} htmlFor="media-output-path">
            Output path in Documents
          </label>
          <input
            id="media-output-path"
            className={sx('media-path-input')}
            value={outputPath}
            onInput={(event) => setOutputPath(event.currentTarget.value)}
            placeholder="/home/user/Documents/example.html"
            disabled={Boolean(pending)}
          />
          <div className={sx('media-actions')}>
            <button
              type="button"
              className={sx('primary')}
              onClick={planConversion}
              disabled={
                Boolean(pending) || !inputPath.trim() || !outputPath.trim()
              }
            >
              Plan route
            </button>
            <button
              type="button"
              className={sx('text-button')}
              onClick={() => void convert()}
              disabled={
                Boolean(pending) || !inputPath.trim() || !outputPath.trim()
              }
            >
              Convert
            </button>
            {pending.startsWith('Converting') && (
              <button
                type="button"
                className={sx('text-button')}
                onClick={cancelConversion}
              >
                Cancel
              </button>
            )}
          </div>
          {plan && (
            <p className={sx('media-route')}>
              {plan.sourceKind} → {plan.targetKind} via {plan.backend}
              {plan.requiresExternalTool ? ' (external tool)' : ''}
            </p>
          )}
          <p className={sx('note')}>
            Available tools:{' '}
            {availableTools.join(', ') || 'built-in routes only'}
          </p>
        </section>
      </div>

      {preview && (
        <section className={sx('tool-panel', 'media-preview-panel')}>
          <span className={sx('panel-label')}>Bounded text preview</span>
          <pre className={sx('media-preview')}>{preview}</pre>
        </section>
      )}
    </section>
  );
}
