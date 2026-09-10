import { useEffect, useRef, useState } from 'preact/hooks';
import { backend, backendError } from '../backend.js';
import { sx } from '../stylex-styles.js';

// Sample Library scanner: native bounded scan when hosted, timer mock in the
// browser. Native results carry blender/audio/render/other counts from
// `src/backend/studio.zig`; the mock preserves the previous demo behavior.
const mockVolumes = [
  { id: 'main', name: 'Main drive', path: '/', kind: 'disk' },
  { id: 'archive', name: 'Archive', path: '/mnt/archive', kind: 'disk' },
  { id: 'backup', name: 'Backup disk', path: '/mnt/backup', kind: 'disk' }
];

const mockFolders = [
  { name: 'Projects', size: '182.4 GB', percent: 83 },
  { name: 'Media', size: '96.8 GB', percent: 58 },
  { name: 'Applications', size: '74.2 GB', percent: 42 },
  { name: 'System', size: '38.6 GB', percent: 25 }
];

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

export function DiskScanner() {
  const [volumes, setVolumes] = useState(mockVolumes);
  const [selectedVolumeId, setSelectedVolumeId] = useState('main');
  const [diskScanState, setDiskScanState] = useState('idle');
  const [diskScanProgress, setDiskScanProgress] = useState(0);
  const [summary, setSummary] = useState(null);
  const [scanError, setScanError] = useState('');
  const timerRef = useRef(null);
  const native = backend.isNative();
  const selectedVolume = volumes.find(
    (volume) => volume.id === selectedVolumeId
  );

  useEffect(() => {
    let cancelled = false;
    if (native) {
      backend
        .listVolumes()
        .then((nativeVolumes) => {
          if (cancelled || !Array.isArray(nativeVolumes)) return;
          if (nativeVolumes.length > 0) {
            setVolumes(nativeVolumes);
            setSelectedVolumeId(nativeVolumes[0].id);
          }
        })
        .catch((error) => {
          if (!cancelled) setScanError(backendError(error));
        });
    }
    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function startNativeScan() {
    setDiskScanState('scanning');
    setDiskScanProgress(0);
    setScanError('');
    try {
      const job = await backend.startAssetScan(selectedVolumeId);
      setSummary(job);
      setDiskScanProgress(100);
      setDiskScanState('complete');
    } catch (error) {
      setScanError(backendError(error));
      setDiskScanState('idle');
    }
  }

  function startMockScan() {
    if (diskScanState === 'scanning') return;
    setDiskScanState('scanning');
    setDiskScanProgress(0);
    setSummary(null);
    let progress = 0;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      progress += 20;
      setDiskScanProgress(progress);
      if (progress >= 100) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        setDiskScanState('complete');
      }
    }, 140);
  }

  function startDiskScan() {
    if (native) void startNativeScan();
    else startMockScan();
  }

  return (
    <section className={sx('tool-page')}>
      <div className={sx('tool-heading')}>
        <div>
          <p className={sx('eyebrow')}>Storage</p>
          <h1 className={sx('pageTitle')}>Sample Library</h1>
          <p className={sx('lede')}>Check usage, then scan a volume.</p>
        </div>
        <span className={sx('mock-badge')}>
          {native ? 'Native scan' : 'Mock'}
        </span>
      </div>

      <div className={sx('disk-grid')}>
        <div className={sx('tool-panel')}>
          <div className={sx('panel-heading')}>
            <div>
              <span className={sx('panel-label')}>Target</span>
              <h2 className={sx('panel-title')}>Volume</h2>
            </div>
            <span className={sx('panel-status')}>
              {diskScanState === 'complete' ? 'Done' : 'Ready'}
            </span>
          </div>
          <label className={sx('select-label')} htmlFor="volume-select">
            Volume
          </label>
          <select
            className={sx('select')}
            id="volume-select"
            value={selectedVolumeId}
            onChange={(event) => setSelectedVolumeId(event.currentTarget.value)}
            disabled={diskScanState === 'scanning'}
          >
            {volumes.map((volume) => (
              <option key={volume.id} value={volume.id}>
                {volume.name} - {volume.path}
              </option>
            ))}
          </select>
          {summary ? (
            <div className={sx('summaryRow')}>
              <div className={sx('summaryCopy')}>
                <strong>{summary.scannedFiles} files</strong>
                <span className={sx('muted')}>
                  {formatBytes(summary.scannedBytes)} · {summary.blender} blend
                  · {summary.audio} audio · {summary.render} renders
                  {summary.truncated ? ' · truncated' : ''}
                </span>
              </div>
            </div>
          ) : (
            selectedVolume && (
              <div className={sx('summaryRow')}>
                <div className={sx('summaryCopy')}>
                  <strong>{selectedVolume.name}</strong>
                  <span className={sx('muted')}>{selectedVolume.path}</span>
                </div>
              </div>
            )
          )}
          {scanError && (
            <p className={sx('empty-notes')} role="alert">
              {scanError}
            </p>
          )}
          <button
            type="button"
            className={sx('primary')}
            onClick={startDiskScan}
            disabled={diskScanState === 'scanning'}
          >
            {diskScanState === 'scanning'
              ? `Scanning ${diskScanProgress}%`
              : diskScanState === 'complete'
                ? 'Scan again'
                : native
                  ? 'Start scan'
                  : 'Start mock scan'}
          </button>
          {!native && (
            <p className={sx('note')}>Mock data only. No files are read.</p>
          )}
        </div>

        <div className={sx('tool-panel')}>
          <div className={sx('panel-heading')}>
            <div>
              <span className={sx('panel-label')}>Largest</span>
              <h2 className={sx('panel-title')}>Folders</h2>
            </div>
            <span className={sx('muted')}>never</span>
          </div>
          <div className={sx('folder-list')}>
            {mockFolders.map((folder) => (
              <div key={folder.name}>
                <div className={sx('folder-copy')}>
                  <span>{folder.name}</span>
                  <strong className={sx('folderStrong')}>{folder.size}</strong>
                </div>
                <div className={sx('barNoMargin')}>
                  <span
                    className={sx('barFill')}
                    style={`width: ${folder.percent}%`}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className={sx('footerRow')}>
            <span>Free space</span>
            <strong className={sx('strongGreen')}>286 GB</strong>
          </div>
        </div>
      </div>
    </section>
  );
}
