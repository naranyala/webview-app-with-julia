import { useEffect, useState } from 'octane';
import { musicBackend } from './backend.js';
import { message, Metric, IconLoader } from './utils.js';

function number(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : '-';
}

const POLL_INITIAL_MS = 150;
const POLL_MAX_MS = 2000;
const POLL_BACKOFF_FACTOR = 2;

export function MusicWorkspace({ onBack }) {
  const [path, setPath] = useState('');
  const [profile, setProfile] = useState('quick');
  const [metadata, setMetadata] = useState(null);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState('Enter the path to a WAV file to inspect it with Aural.');
  const [jobId, setJobId] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    let timer;
    let delay = POLL_INITIAL_MS;

    async function poll() {
      try {
        const job = await musicBackend.getAudioAnalysisStatus(jobId);
        if (cancelled) return;
        if (job.state === 'running') {
          setStatus(job.message || 'Analyzing audio...');
          timer = setTimeout(() => {
            delay = Math.min(delay * POLL_BACKOFF_FACTOR, POLL_MAX_MS);
            void poll();
          }, delay);
          return;
        }
        setJobId('');
        setAnalyzing(false);
        if (job.state === 'completed') {
          setResult(job);
          setStatus('Analysis complete.');
        } else if (job.state === 'cancelled') {
          setStatus('Analysis cancelled.');
        } else {
          setStatus(job.error || 'Analysis failed.');
        }
      } catch (error) {
        if (!cancelled) {
          setJobId('');
          setAnalyzing(false);
          setStatus(message(error));
        }
      }
    }

    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [jobId]);

  async function analyze() {
    const input = path.trim();
    if (!input || analyzing) return;
    try {
      setStatus('Reading WAV metadata...');
      setResult(null);
      setMetadata(await musicBackend.getAudioMetadata(input));
      const job = await musicBackend.startAudioAnalysis(input, profile);
      if (job.state === 'completed') {
        setResult(job);
        setStatus('Analysis complete.');
      } else {
        setJobId(job.id);
        setAnalyzing(true);
        setStatus('Analyzing audio...');
      }
    } catch (error) {
      setStatus(message(error));
    }
  }

  async function cancel() {
    try {
      await musicBackend.cancelAudioAnalysis(jobId);
      setJobId('');
      setAnalyzing(false);
      setStatus('Analysis cancelled.');
    } catch (error) {
      setStatus(message(error));
    }
  }

  return (
    <div class="panel">
      <div class="panel-header">
        <div class="panel-header-left">
          <div class="panel-header-icon">
            <IconLoader size="1rem" />
          </div>
          <div>
            <div class="panel-header-title">MIR lab</div>
            <div class="panel-header-subtitle">
              Music information retrieval
            </div>
          </div>
        </div>
      </div>

      <div class="panel-body">
        <div class="card" style={{ marginBottom: 'var(--space-6)' }}>
          <div class="card-header">
            <div class="card-title">Source</div>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); void analyze(); }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div class="form-group">
                <label class="form-label">WAV file path</label>
                <input
                  class="form-input"
                  value={path}
                  onInput={(e) => setPath(e.currentTarget.value)}
                  placeholder="/home/me/Music/recording.wav"
                  disabled={analyzing}
                />
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Analysis profile</label>
                  <select
                    class="form-input"
                    value={profile}
                    onChange={(e) => setProfile(e.currentTarget.value)}
                    disabled={analyzing}
                  >
                    <option value="quick">Quick summary</option>
                    <option value="spectral">Spectral summary</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button
                  class="btn btn-primary"
                  type="submit"
                  disabled={!path.trim() || analyzing}
                >
                  {analyzing ? 'Analyzing...' : 'Analyze WAV'}
                </button>
                {analyzing && (
                  <button
                    class="btn btn-secondary"
                    type="button"
                    onClick={() => void cancel()}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>

        {metadata && (
          <div class="card" style={{ marginBottom: 'var(--space-6)' }}>
            <div class="card-header">
              <div class="card-title">Source metadata</div>
            </div>
            <div class="metric-grid">
              <Metric label="Duration" value={`${number(metadata.durationSec)} sec`} />
              <Metric label="Sample rate" value={`${metadata.sampleRate} Hz`} />
              <Metric label="Channels" value={metadata.channels} />
              <Metric label="File size" value={`${number(metadata.sizeBytes / 1024 / 1024)} MB`} />
            </div>
          </div>
        )}

        {result && (
          <div class="card">
            <div class="card-header">
              <div class="card-title">Analysis results</div>
              <div class="card-subtitle">
                {result.analysisProfile === 'spectral' ? 'Spectral' : 'Quick'} profile
              </div>
            </div>
            <div class="metric-grid">
              <Metric label="RMS" value={number(result.rms, 4)} />
              <Metric label="Peak" value={number(result.peak, 4)} />
              <Metric label="Zero-crossing rate" value={number(result.zcr, 4)} />
              <Metric label="Window" value={`${result.sampleCount ?? result.sample_count} samples`} />
              {result.analysisProfile === 'spectral' && (
                <>
                  <Metric label="Centroid" value={`${number(result.spectralCentroidHz)} Hz`} />
                  <Metric label="Bandwidth" value={`${number(result.spectralBandwidthHz)} Hz`} />
                  <Metric label="Rolloff" value={`${number(result.spectralRolloffHz)} Hz`} />
                  <Metric label="Flatness" value={number(result.spectralFlatness, 4)} />
                  <Metric label="Flux" value={number(result.spectralFlux, 4)} />
                </>
              )}
            </div>
          </div>
        )}

        {!metadata && !result && !analyzing && (
          <div class="empty-state">
            <div class="empty-state-icon">
              <IconLoader size="1.5rem" />
            </div>
            <div class="empty-state-title">No analysis yet</div>
            <div class="empty-state-desc">
              Enter a WAV file path above to begin analysis. Results will appear
              here with detailed audio metrics.
            </div>
          </div>
        )}
      </div>

      <div class="status-bar">
        <div class="status-message">
          <span class={`status-icon ${analyzing ? 'status-icon--warning' : 'status-icon--info'}`} />
          {status}
        </div>
      </div>
    </div>
  );
}
