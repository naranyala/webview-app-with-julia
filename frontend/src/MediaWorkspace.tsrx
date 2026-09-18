import { useEffect, useState } from 'octane';
import { mediaBackend } from './backend.js';
import { message, formatBytes, debounce, Metric, IconFolder, IconFile, IconImage, IconRefresh, IconSearch, IconX, IconChevronLeft, IconChevronRight, IconScan, IconGrid } from './utils.js';

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.tiff', '.ico'];

const POLL_INITIAL_MS = 150;
const POLL_MAX_MS = 2000;
const POLL_BACKOFF_FACTOR = 2;

function DirectoryPicker({ path, onChange, onLoad, onRefresh, loading }) {
  return (
    <form class="card" onSubmit={(e) => { e.preventDefault(); onLoad(); }}>
      <div class="card-header">
        <div class="card-title">Directory</div>
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
        <div class="form-group" style={{ flex: 1 }}>
          <label class="form-label">Path</label>
          <input
            class="form-input"
            value={path}
            onInput={(e) => onChange(e.currentTarget.value)}
            placeholder="~/Pictures or /home/me/media"
            disabled={loading}
          />
        </div>
        <button class="btn btn-primary" type="submit" disabled={!path.trim() || loading}>
          Load
        </button>
        <button class="btn btn-secondary btn-icon" type="button" onClick={onRefresh} disabled={!path.trim() || loading} title="Refresh">
          <IconRefresh size="1rem" />
        </button>
      </div>
    </form>
  );
}

function FileBrowser({ onBack }) {
  const [path, setPath] = useState('');
  const [entries, setEntries] = useState([]);
  const [status, setStatus] = useState('Enter a directory path to browse files.');
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const debouncedSetFilter = debounce((value) => setFilter(value), 200);

  async function load() {
    const p = path.trim();
    if (!p) return;
    setLoading(true);
    try {
      const result = await mediaBackend.listDirectory(p);
      setEntries(Array.isArray(result.entries) ? result.entries : []);
      setStatus(`${result.count} item${result.count === 1 ? '' : 's'} in ${result.path}`);
    } catch (error) {
      setStatus(message(error));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }

  const displayed = filter
    ? entries.filter((e) => e.name.toLowerCase().includes(filter.toLowerCase()))
    : entries;

  return (
    <div class="panel">
      <div class="panel-header">
        <div class="panel-header-left">
          <div class="panel-header-icon">
            <IconFolder size="1rem" />
          </div>
          <div>
            <div class="panel-header-title">File browser</div>
            <div class="panel-header-subtitle">
              Browse directory contents and filter files
            </div>
          </div>
        </div>
      </div>

      <div class="panel-body">
        <DirectoryPicker path={path} onChange={setPath} onLoad={load} onRefresh={load} loading={loading} />

        {entries.length > 0 && (
          <div style={{ marginTop: 'var(--space-4)' }}>
            <div class="search-input-wrapper">
              <span class="search-input-icon">
                <IconSearch size="0.9rem" />
              </span>
              <input
                class="form-input"
                value={filter}
                onInput={(e) => debouncedSetFilter(e.currentTarget.value)}
                placeholder="Filter files..."
                style={{ paddingLeft: '2.5rem' }}
              />
            </div>
          </div>
        )}

        {displayed.length > 0 && (
          <div style={{ marginTop: 'var(--space-4)' }}>
            <div class="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div class="file-list">
                {displayed.map((entry) => (
                  <div class="file-item" key={entry.path}>
                    <span class="file-item-icon">
                      {entry.isDir ? <IconFolder size="1rem" /> : <IconFile size="1rem" />}
                    </span>
                    <span class="file-item-name">{entry.name}</span>
                    <span class="file-item-meta">
                      {entry.isDir ? 'Directory' : formatBytes(entry.size)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {displayed.length === 0 && entries.length > 0 && (
          <div class="empty-state" style={{ padding: 'var(--space-8)' }}>
            <div class="empty-state-title">No files match "{filter}"</div>
          </div>
        )}

        {entries.length === 0 && !loading && (
          <div class="empty-state">
            <div class="empty-state-icon">
              <IconFolder size="1.5rem" />
            </div>
            <div class="empty-state-title">No directory loaded</div>
            <div class="empty-state-desc">
              Enter a directory path above to browse its contents.
            </div>
          </div>
        )}
      </div>

      <div class="status-bar">
        <div class="status-message">
          <span class="status-icon status-icon--info" />
          {status}
        </div>
      </div>
    </div>
  );
}

function MediaInspector({ onBack }) {
  const [path, setPath] = useState('');
  const [info, setInfo] = useState(null);
  const [status, setStatus] = useState('Enter a file path to inspect its media properties.');

  async function inspect() {
    const p = path.trim();
    if (!p) return;
    try {
      const result = await mediaBackend.inspectMedia(p);
      setInfo(result);
      setStatus('Inspection complete.');
    } catch (error) {
      setStatus(message(error));
      setInfo(null);
    }
  }

  return (
    <div class="panel">
      <div class="panel-header">
        <div class="panel-header-left">
          <div class="panel-header-icon">
            <IconSearch size="1rem" />
          </div>
          <div>
            <div class="panel-header-title">Media inspector</div>
            <div class="panel-header-subtitle">
              Check image, video, and audio file properties
            </div>
          </div>
        </div>
      </div>

      <div class="panel-body">
        <div class="card" style={{ marginBottom: 'var(--space-6)' }}>
          <div class="card-header">
            <div class="card-title">File</div>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); void inspect(); }}>
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
              <div class="form-group" style={{ flex: 1 }}>
                <label class="form-label">Path</label>
                <input
                  class="form-input"
                  value={path}
                  onInput={(e) => setPath(e.currentTarget.value)}
                  placeholder="/path/to/image.png"
                />
              </div>
              <button class="btn btn-primary" type="submit" disabled={!path.trim()}>
                Inspect
              </button>
            </div>
          </form>
        </div>

        {info && (
          <div class="card">
            <div class="card-header">
              <div class="card-title">Properties</div>
            </div>
            <div class="metric-grid">
              {info.kind && <Metric label="Kind" value={info.kind} />}
              {info.mimeType && <Metric label="MIME" value={info.mimeType} />}
              {info.width && info.height && <Metric label="Dimensions" value={`${info.width} × ${info.height}`} />}
              {info.format && <Metric label="Format" value={info.format} />}
              {info.sizeBytes != null && <Metric label="Size" value={formatBytes(info.sizeBytes)} />}
              {info.backend && <Metric label="Backend" value={info.backend} />}
              {info.provenance && <Metric label="Provenance" value={info.provenance} />}
            </div>
          </div>
        )}

        {!info && (
          <div class="empty-state">
            <div class="empty-state-icon">
              <IconSearch size="1.5rem" />
            </div>
            <div class="empty-state-title">No inspection results</div>
            <div class="empty-state-desc">
              Enter a file path above to inspect its media properties.
            </div>
          </div>
        )}
      </div>

      <div class="status-bar">
        <div class="status-message">
          <span class="status-icon status-icon--info" />
          {status}
        </div>
      </div>
    </div>
  );
}

function DiskScanner({ onBack }) {
  const [paths, setPaths] = useState('');
  const [jobId, setJobId] = useState('');
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState('Enter directories to scan for media assets.');

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    let timer;
    let delay = POLL_INITIAL_MS;

    async function poll() {
      try {
        const job = await mediaBackend.getAssetScanStatus(jobId);
        if (cancelled) return;
        if (job.state === 'running') {
          setStatus(job.message || 'Scanning...');
          timer = setTimeout(() => {
            delay = Math.min(delay * POLL_BACKOFF_FACTOR, POLL_MAX_MS);
            void poll();
          }, delay);
          return;
        }
        setJobId('');
        if (job.state === 'completed') {
          setResult(job.result || job);
          setStatus('Scan complete.');
        } else if (job.state === 'cancelled') {
          setStatus('Scan cancelled.');
        } else {
          setStatus(job.error || 'Scan failed.');
        }
      } catch (error) {
        if (!cancelled) {
          setJobId('');
          setStatus(message(error));
        }
      }
    }

    void poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [jobId]);

  async function startScan() {
    const raw = paths.trim();
    if (!raw || jobId) return;
    const list = raw.split('\n').map((s) => s.trim()).filter(Boolean);
    try {
      setResult(null);
      const job = await mediaBackend.startAssetScan(list);
      if (job.state === 'completed') {
        setResult(job.result || job);
        setStatus('Scan complete.');
      } else {
        setJobId(job.id);
        setStatus('Scanning...');
      }
    } catch (error) {
      setStatus(message(error));
    }
  }

  async function cancelScan() {
    try {
      await mediaBackend.cancelAssetScan(jobId);
      setJobId('');
      setStatus('Scan cancelled.');
    } catch (error) {
      setStatus(message(error));
    }
  }

  const scanning = Boolean(jobId);

  return (
    <div class="panel">
      <div class="panel-header">
        <div class="panel-header-left">
          <div class="panel-header-icon">
            <IconScan size="1rem" />
          </div>
          <div>
            <div class="panel-header-title">Disk scanner</div>
            <div class="panel-header-subtitle">
              Scan directories for media assets
            </div>
          </div>
        </div>
      </div>

      <div class="panel-body">
        <div class="card" style={{ marginBottom: 'var(--space-6)' }}>
          <div class="card-header">
            <div class="card-title">Directories</div>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); void startScan(); }}>
            <div class="form-group" style={{ marginBottom: 'var(--space-4)' }}>
              <label class="form-label">Directories (one per line)</label>
              <textarea
                class="form-input"
                value={paths}
                onInput={(e) => setPaths(e.currentTarget.value)}
                placeholder="/home/me/Music&#10;/home/me/Pictures"
                disabled={scanning}
                style={{ minHeight: '8rem' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button class="btn btn-primary" type="submit" disabled={!paths.trim() || scanning}>
                {scanning ? 'Scanning...' : 'Scan'}
              </button>
              {scanning && (
                <button class="btn btn-secondary" type="button" onClick={() => void cancelScan()}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {result && (
          <div class="card">
            <div class="card-header">
              <div class="card-title">Results</div>
            </div>
            <div class="metric-grid">
              {result.totalFiles != null && <Metric label="Total files" value={result.totalFiles} />}
              {result.totalSize != null && <Metric label="Total size" value={formatBytes(result.totalSize)} />}
              {result.byKind && Object.entries(result.byKind).map(([kind, count]) => (
                <Metric key={kind} label={kind} value={count} />
              ))}
            </div>
          </div>
        )}

        {!result && !scanning && (
          <div class="empty-state">
            <div class="empty-state-icon">
              <IconScan size="1.5rem" />
            </div>
            <div class="empty-state-title">No scan results</div>
            <div class="empty-state-desc">
              Enter directory paths above and click Scan to find media assets.
            </div>
          </div>
        )}
      </div>

      <div class="status-bar">
        <div class="status-message">
          <span class={`status-icon ${scanning ? 'status-icon--warning' : 'status-icon--info'}`} />
          {status}
        </div>
      </div>
    </div>
  );
}

function ImageGallery({ onBack }) {
  const [path, setPath] = useState('');
  const [images, setImages] = useState([]);
  const [status, setStatus] = useState('Enter a directory to browse images.');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  async function load() {
    const p = path.trim();
    if (!p) return;
    setLoading(true);
    try {
      const result = await mediaBackend.listDirectory(p, { extensions: IMAGE_EXTENSIONS });
      const entries = Array.isArray(result.entries) ? result.entries : [];
      setImages(entries);
      setStatus(`${entries.length} image${entries.length === 1 ? '' : 's'} in ${result.path}`);
    } catch (error) {
      setStatus(message(error));
      setImages([]);
    } finally {
      setLoading(false);
    }
  }

  function openLightbox(index) {
    setSelected(index);
  }

  function closeLightbox() {
    setSelected(null);
  }

  function prevImage() {
    setSelected((i) => (i > 0 ? i - 1 : images.length - 1));
  }

  function nextImage() {
    setSelected((i) => (i < images.length - 1 ? i + 1 : 0));
  }

  const current = selected != null ? images[selected] : null;

  return (
    <div class="panel">
      <div class="panel-header">
        <div class="panel-header-left">
          <div class="panel-header-icon">
            <IconGrid size="1rem" />
          </div>
          <div>
            <div class="panel-header-title">Image gallery</div>
            <div class="panel-header-subtitle">
              Browse and preview images in a visual grid
            </div>
          </div>
        </div>
      </div>

      <div class="panel-body">
        <DirectoryPicker path={path} onChange={setPath} onLoad={load} onRefresh={load} loading={loading} />

        {images.length > 0 && (
          <div style={{ marginTop: 'var(--space-4)' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(10rem, 1fr))',
              gap: 'var(--space-3)',
            }}>
              {images.map((img, index) => (
                <button
                  class="card"
                  type="button"
                  key={img.path}
                  onClick={() => openLightbox(index)}
                  style={{
                    padding: 'var(--space-4)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                    textAlign: 'center',
                  }}
                >
                  <IconImage size="2rem" style={{ color: 'var(--text-tertiary)' }} />
                  <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {img.name}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--accent)',
                    background: 'var(--accent-muted)',
                    padding: '0.1rem 0.4rem',
                    borderRadius: 'var(--radius-sm)',
                  }}>
                    {img.name.split('.').pop()?.toUpperCase()}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {images.length === 0 && !loading && (
          <div class="empty-state">
            <div class="empty-state-icon">
              <IconImage size="1.5rem" />
            </div>
            <div class="empty-state-title">No images found</div>
            <div class="empty-state-desc">
              Enter a directory path above to browse images.
            </div>
          </div>
        )}
      </div>

      <div class="status-bar">
        <div class="status-message">
          <span class="status-icon status-icon--info" />
          {status}
        </div>
      </div>

      {current && (
        <div
          class="lightbox-overlay"
          tabIndex={-1}
          onClick={(e) => { if (e.target === e.currentTarget) closeLightbox(); }}
          onKeyDown={(e) => { if (e.key === 'Escape') closeLightbox(); }}
          role="dialog"
          aria-modal="true"
          aria-label="Image lightbox"
        >
          <div class="lightbox-content">
            <div class="lightbox-header">
              <span class="lightbox-name">{current.name}</span>
              <span class="lightbox-counter">{selected + 1} / {images.length}</span>
              <span class="lightbox-size">{formatBytes(current.size)}</span>
            </div>
            <div class="lightbox-body">
              <button class="lightbox-nav" type="button" onClick={prevImage}>
                <IconChevronLeft size="1.25rem" />
              </button>
              <div class="lightbox-image">
                <IconImage size="4rem" style={{ color: 'var(--text-tertiary)' }} />
              </div>
              <button class="lightbox-nav" type="button" onClick={nextImage}>
                <IconChevronRight size="1.25rem" />
              </button>
            </div>
            <button class="lightbox-close" type="button" onClick={closeLightbox}>
              <IconX size="1rem" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function MediaWorkspace({ tool, onBack }) {
  if (tool === 'files') return <FileBrowser onBack={onBack} />;
  if (tool === 'inspect') return <MediaInspector onBack={onBack} />;
  if (tool === 'scan') return <DiskScanner onBack={onBack} />;
  if (tool === 'gallery') return <ImageGallery onBack={onBack} />;

  return (
    <div class="panel">
      <div class="panel-header">
        <div class="panel-header-left">
          <div class="panel-header-icon">
            <IconFolder size="1rem" />
          </div>
          <div>
            <div class="panel-header-title">Media manager</div>
            <div class="panel-header-subtitle">
              Browse, inspect, scan, and preview media files
            </div>
          </div>
        </div>
      </div>
      <div class="panel-body">
        <div class="empty-state">
          <div class="empty-state-icon">
            <IconFolder size="1.5rem" />
          </div>
          <div class="empty-state-title">Select a media tool</div>
          <div class="empty-state-desc">
            Choose a tool from the sidebar to get started.
          </div>
        </div>
      </div>
    </div>
  );
}
