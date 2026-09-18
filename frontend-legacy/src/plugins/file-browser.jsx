import { useEffect, useRef, useState } from 'preact/hooks';
import { AsyncFeedback } from '../async-feedback.jsx';
import { backend, backendError } from '../backend.js';
import { formatBytes } from '../format-bytes.js';
import { sx } from '../stylex-styles.js';

const MOCK_ROOT = '~/Documents';

const MOCK_ENTRIES = [
  { name: 'Projects', isDir: true, size: 0, modified: '2026-09-15T10:00:00Z' },
  { name: 'Music', isDir: true, size: 0, modified: '2026-09-14T08:30:00Z' },
  { name: 'Photos', isDir: true, size: 0, modified: '2026-09-10T12:00:00Z' },
  {
    name: 'readme.md',
    isDir: false,
    size: 2048,
    modified: '2026-09-16T14:22:00Z'
  },
  {
    name: 'notes.txt',
    isDir: false,
    size: 512,
    modified: '2026-09-15T09:10:00Z'
  },
  {
    name: 'budget.csv',
    isDir: false,
    size: 4096,
    modified: '2026-09-12T16:45:00Z'
  },
  {
    name: 'photo.png',
    isDir: false,
    size: 8192,
    modified: '2026-09-11T11:30:00Z'
  },
  {
    name: 'paper.pdf',
    isDir: false,
    size: 32768,
    modified: '2026-09-09T18:00:00Z'
  }
];

const QUICK_FILTERS = [
  { label: 'All', extensions: null },
  { label: 'Text', extensions: ['.md', '.txt', '.csv', '.json'] },
  {
    label: 'Images',
    extensions: ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp']
  },
  { label: 'Documents', extensions: ['.pdf', '.doc', '.docx', '.odt'] },
  { label: 'Audio', extensions: ['.wav', '.mp3', '.flac', '.ogg', '.m4a'] }
];

function parentPath(dirPath) {
  const parts = dirPath.replace(/\/+$/, '').split('/');
  parts.pop();
  return parts.join('/') || '/';
}

export function FileBrowser() {
  const [dirPath, setDirPath] = useState(MOCK_ROOT);
  const [inputValue, setInputValue] = useState(MOCK_ROOT);
  const [listing, setListing] = useState(null);
  const [activeFilter, setActiveFilter] = useState(0);
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [inspectInfo, setInspectInfo] = useState(null);
  const mountedRef = useRef(true);
  const native = backend.isNative();

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    loadDirectory(dirPath);
  }, [dirPath]);

  async function loadDirectory(path) {
    if (!path.trim()) return;
    setPending('Loading...');
    setError('');
    setMessage('');
    setInspectInfo(null);
    try {
      if (native) {
        const filter = QUICK_FILTERS[activeFilter];
        const options = filter.extensions
          ? { extensions: filter.extensions }
          : {};
        const result = await backend.listDirectory(path.trim(), options);
        if (!mountedRef.current) return;
        setListing(result);
        setMessage(
          `${result.count} items${result.truncated ? ' (truncated)' : ''}`
        );
      } else {
        await new Promise((r) => setTimeout(r, 150));
        if (!mountedRef.current) return;
        let entries = MOCK_ENTRIES;
        const filter = QUICK_FILTERS[activeFilter];
        if (filter.extensions) {
          entries = entries.filter(
            (e) =>
              e.isDir ||
              filter.extensions.some((ext) =>
                e.name.toLowerCase().endsWith(ext)
              )
          );
        }
        setListing({ path, entries, count: entries.length, truncated: false });
        setMessage(`${entries.length} items`);
      }
    } catch (failure) {
      if (mountedRef.current) setError(backendError(failure));
    } finally {
      if (mountedRef.current) setPending('');
    }
  }

  function navigateTo(entry) {
    if (entry.isDir) {
      const next = entry.path || `${dirPath.replace(/\/+$/, '')}/${entry.name}`;
      setDirPath(next);
      setInputValue(next);
    }
  }

  function navigateUp() {
    const parent = parentPath(dirPath);
    setDirPath(parent);
    setInputValue(parent);
  }

  function handleSubmit(event) {
    event.preventDefault();
    const trimmed = inputValue.trim();
    if (trimmed && trimmed !== dirPath) setDirPath(trimmed);
  }

  async function inspectFile(entry) {
    if (entry.isDir || !native) return;
    setPending(`Inspecting ${entry.name}...`);
    setError('');
    setMessage('');
    try {
      const info = await backend.inspectMedia(entry.path);
      if (!mountedRef.current) return;
      setInspectInfo(info);
      setMessage(`Inspected ${entry.name}.`);
    } catch (failure) {
      if (mountedRef.current) setError(backendError(failure));
    } finally {
      if (mountedRef.current) setPending('');
    }
  }

  const entries = listing?.entries ?? [];
  const dirs = entries.filter((e) => e.isDir);
  const files = entries.filter((e) => !e.isDir);

  return (
    <section className={sx('tool-page')}>
      <div className={sx('tool-heading')}>
        <div>
          <p className={sx('eyebrow')}>Local files</p>
          <h1 className={sx('pageTitle')}>File Browser</h1>
          <p className={sx('lede')}>
            Browse directories, inspect files, and convert media.
          </p>
        </div>
        <span className={sx('mock-badge')}>{native ? 'Native' : 'Mock'}</span>
      </div>

      <AsyncFeedback pending={pending} error={error} message={message} />

      <div className={sx('media-inspector-grid')}>
        <section className={sx('tool-panel')}>
          <div className={sx('panel-heading')}>
            <div>
              <span className={sx('panel-label')}>Navigate</span>
              <h2 className={sx('panel-title')}>Directory</h2>
            </div>
          </div>
          <form onSubmit={handleSubmit} className={sx('media-actions')}>
            <input
              className={sx('media-path-input')}
              value={inputValue}
              onInput={(e) => setInputValue(e.currentTarget.value)}
              placeholder="/home/user/Documents"
              disabled={Boolean(pending)}
            />
            <button
              type="submit"
              className={sx('primary')}
              disabled={Boolean(pending) || !inputValue.trim()}
            >
              Go
            </button>
            {dirPath !== '/' && !dirPath.endsWith(':') && (
              <button
                type="button"
                className={sx('text-button')}
                onClick={navigateUp}
                disabled={Boolean(pending)}
              >
                Up
              </button>
            )}
          </form>

          <div className={sx('media-actions')} style="margin-top: 0.5rem;">
            {QUICK_FILTERS.map((filter, i) => (
              <button
                key={filter.label}
                type="button"
                className={
                  i === activeFilter ? sx('primary') : sx('text-button')
                }
                onClick={() => {
                  setActiveFilter(i);
                  loadDirectory(dirPath);
                }}
                disabled={Boolean(pending)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </section>

        <section className={sx('tool-panel')}>
          <div className={sx('panel-heading')}>
            <div>
              <span className={sx('panel-label')}>Contents</span>
              <h2 className={sx('panel-title')}>{dirPath}</h2>
            </div>
            <span className={sx('panel-status')}>
              {listing ? `${listing.count} items` : '—'}
            </span>
          </div>

          {entries.length === 0 && !pending && (
            <p className={sx('empty-notes')}>This directory is empty.</p>
          )}

          {dirs.length > 0 && (
            <div>
              <span className={sx('panel-label')}>Folders</span>
              <div className={sx('folder-list')}>
                {dirs.map((entry) => (
                  <button
                    key={entry.name}
                    type="button"
                    className={sx('folder-copy')}
                    onClick={() => navigateTo(entry)}
                    style="width: 100%; text-align: left; background: none; border: none; cursor: pointer; padding: 0;"
                  >
                    <span>{entry.name}/</span>
                    <strong className={sx('folderStrong')}>
                      {formatBytes(0)}
                    </strong>
                  </button>
                ))}
              </div>
            </div>
          )}

          {files.length > 0 && (
            <div>
              <span className={sx('panel-label')}>Files</span>
              <div className={sx('folder-list')}>
                {files.map((entry) => (
                  <div key={entry.name} className={sx('folder-copy')}>
                    <span>{entry.name}</span>
                    <span className={sx('muted')}>
                      {formatBytes(entry.size)}
                    </span>
                    {native && (
                      <button
                        type="button"
                        className={sx('text-button')}
                        onClick={() => void inspectFile(entry)}
                        disabled={Boolean(pending)}
                        style="font-size: 0.75rem; padding: 0.1rem 0.4rem;"
                      >
                        Inspect
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {inspectInfo && (
        <section className={sx('tool-panel')}>
          <div className={sx('panel-heading')}>
            <div>
              <span className={sx('panel-label')}>File details</span>
              <h2 className={sx('panel-title')}>Inspector</h2>
            </div>
          </div>
          <dl className={sx('media-details')}>
            <div>
              <dt>Kind</dt>
              <dd>{inspectInfo.kind}</dd>
            </div>
            <div>
              <dt>MIME</dt>
              <dd>{inspectInfo.mime}</dd>
            </div>
            <div>
              <dt>Extension</dt>
              <dd>{inspectInfo.extension}</dd>
            </div>
            <div>
              <dt>Size</dt>
              <dd>{formatBytes(inspectInfo.size)}</dd>
            </div>
            <div>
              <dt>Dimensions</dt>
              <dd>
                {inspectInfo.width && inspectInfo.height
                  ? `${inspectInfo.width} x ${inspectInfo.height}`
                  : 'Not applicable'}
              </dd>
            </div>
          </dl>
        </section>
      )}
    </section>
  );
}
