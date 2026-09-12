import { useEffect, useRef, useState } from 'preact/hooks';
import { backend, backendError } from '../backend.js';
import { styles, sx } from '../stylex-styles.js';
import { analyzeSamples, describeFeatures, windowSamples } from './mir.js';

// MIR UI with three input paths: a generated A4 tone, browser-decoded uploads,
// and native filesystem analysis through a cancellable Julia job.
export function MirLab() {
  const [features, setFeatures] = useState(null);
  const [detail, setDetail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState('demo 440Hz tone');
  const [nativePath, setNativePath] = useState('');
  const [metadata, setMetadata] = useState(null);
  const audioPollRef = useRef(null);
  const audioJobRef = useRef(null);

  useEffect(
    () => () => {
      if (audioPollRef.current) clearTimeout(audioPollRef.current);
    },
    []
  );

  async function runAnalysis(samples, sampleRate, label) {
    setBusy(true);
    setError('');
    try {
      // Bound the payload before crossing the WebView bridge. Browser uploads
      // can contain millions of samples even though the native profile is small.
      const windowed = windowSamples(samples);
      const result = backend.isNative()
        ? await backend.mirAnalyze(windowed, sampleRate)
        : analyzeSamples(windowed, sampleRate);
      setFeatures(result);
      setDetail(describeFeatures(result));
      setSource(label);
      setMetadata(null);
    } catch (failure) {
      setError(backendError(failure));
    } finally {
      setBusy(false);
    }
  }

  async function pollNativeAudio(jobId) {
    // The backend job is a small state machine. Poll only while it is running;
    // the active-job guard prevents an old request from overwriting a newer run.
    try {
      const job = await backend.getAudioAnalysisStatus(jobId);
      if (audioJobRef.current !== jobId) return;
      if (job.state === 'running') {
        audioPollRef.current = setTimeout(
          () => void pollNativeAudio(jobId),
          150
        );
        return;
      }
      if (job.state === 'cancelled') {
        setBusy(false);
        return;
      }
      if (job.state !== 'completed') {
        setError(job.error || 'The audio analysis failed.');
        setBusy(false);
        return;
      }
      setFeatures(job);
      setDetail(describeFeatures(job));
      setSource(nativePath.trim());
      setBusy(false);
    } catch (failure) {
      setError(backendError(failure));
      setBusy(false);
    }
  }

  async function analyzeNativePath() {
    if (!nativePath.trim() || busy || !backend.isNative()) return;
    setBusy(true);
    setError('');
    try {
      const audioMetadata = await backend.getAudioMetadata(nativePath.trim());
      setMetadata(audioMetadata);
      const job = await backend.startAudioAnalysis(nativePath.trim());
      audioJobRef.current = job.id;
      if (job.state === 'running') void pollNativeAudio(job.id);
      else if (job.state === 'completed') {
        setFeatures(job);
        setDetail(describeFeatures(job));
        setSource(nativePath.trim());
        setBusy(false);
      } else {
        setError(job.error || 'The audio analysis failed.');
        setBusy(false);
      }
    } catch (failure) {
      setError(backendError(failure));
      setBusy(false);
    }
  }

  async function cancelNativeAudio() {
    if (!audioJobRef.current) return;
    try {
      await backend.cancelAudioAnalysis(audioJobRef.current);
      audioJobRef.current = null;
      setBusy(false);
    } catch (failure) {
      setError(backendError(failure));
    }
  }

  function analyzeDemo() {
    // 440 Hz at 48 kHz is the standard A4 reference tone.
    const sampleRate = 48000;
    const samples = Array.from({ length: 48000 }, (_, i) =>
      Math.sin((2 * Math.PI * 440 * i) / sampleRate)
    );
    return runAnalysis(samples, sampleRate, 'demo 440Hz tone');
  }

  async function analyzeFile(event) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    try {
      const AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioCtx) {
        setError('Web Audio is unavailable in this shell.');
        return;
      }
      const ctx = new AudioCtx();
      const bytes = await file.arrayBuffer();
      const audio = await ctx.decodeAudioData(bytes);
      const channel = audio.getChannelData(0);
      await ctx.close?.();
      return runAnalysis([...channel], audio.sampleRate, file.name);
    } catch (failure) {
      setError(backendError(failure));
    }
  }

  async function logToNotes() {
    if (!features) return;
    const sampleCount = features.sample_count ?? features.sampleCount;
    const sampleRate = features.sample_rate ?? features.sampleRate;
    try {
      // Notes store a compact summary, not raw samples or feature matrices.
      await backend.createNote(
        `MIR: ${source}`,
        'MIR',
        `Source: ${source}\nRMS ${features.rms.toFixed(4)} / peak ${features.peak.toFixed(4)} / ZCR ${features.zcr.toFixed(4)}\n${detail}\nWindow: ${sampleCount} samples @ ${sampleRate}Hz`
      );
    } catch (failure) {
      setError(backendError(failure));
    }
  }

  return (
    <section className={sx('tool-page')}>
      <div className={sx('tool-heading')}>
        <div>
          <p className={sx('eyebrow')}>Music Information Retrieval</p>
          <h1 className={sx('page-title')}>MIR Lab</h1>
          <p className={sx('lede')}>
            Offline time-domain analysis. Native Julia/Aural when hosted, JS
            mirror in the browser.
          </p>
        </div>
        <span className={sx('mock-badge')}>
          {backend.isNative() ? 'Native' : 'Browser mirror'}
        </span>
      </div>
      <div className={sx('tool-panel')}>
        <div className={sx('notes-list-heading')}>
          <button
            type="button"
            className={sx('new-note-button')}
            onClick={analyzeDemo}
            disabled={busy}
          >
            Analyze demo tone
          </button>
          <label className={sx('text-button')}>
            Open audio file
            <input
              type="file"
              accept="audio/*"
              hidden
              onChange={analyzeFile}
              disabled={busy}
            />
          </label>
          {backend.isNative() && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void analyzeNativePath();
              }}
            >
              <label className={sx('sr-only')} htmlFor="native-audio-path">
                Native audio path
              </label>
              <input
                id="native-audio-path"
                className={sx('search-input')}
                placeholder="/home/me/audio.wav"
                value={nativePath}
                onInput={(event) => setNativePath(event.currentTarget.value)}
                disabled={busy}
              />
              <button
                type="submit"
                className={sx('text-button')}
                disabled={busy || !nativePath.trim()}
              >
                Analyze native file
              </button>
              {busy && (
                <button
                  type="button"
                  className={sx('text-button')}
                  onClick={cancelNativeAudio}
                >
                  Cancel analysis
                </button>
              )}
            </form>
          )}
          <button
            type="button"
            className={sx('text-button')}
            onClick={logToNotes}
            disabled={!features || busy}
          >
            Log to Session Notes
          </button>
        </div>
        {error && (
          <p className={sx('empty-notes')} role="alert">
            {error}
          </p>
        )}
        {features ? (
          <ul className={sx('todo-list')}>
            <li>Source: {source}</li>
            <li>RMS {features.rms.toFixed(4)}</li>
            <li>Peak {features.peak.toFixed(4)}</li>
            <li>ZCR {features.zcr.toFixed(4)}</li>
            <li>
              {features.sample_count ?? features.sampleCount} samples @{' '}
              {features.sample_rate ?? features.sampleRate}Hz (
              {(features.duration_seconds ?? features.durationSec).toFixed(2)}s)
            </li>
            {metadata && (
              <li>
                {metadata.format.toUpperCase()} · {metadata.channels} channels ·{' '}
                {metadata.durationSec.toFixed(2)}s · {metadata.sizeBytes} bytes
              </li>
            )}
            <li>{detail}</li>
          </ul>
        ) : (
          <p className={sx('empty-notes')}>
            No analysis yet. Files stay on device; only a bounded window is sent
            to the native analyzer.
          </p>
        )}
        <p className={sx('empty-notes')}>
          FFT chroma/tempo arrive after the KissFFT step; ZCR + level already
          triage brightness and headroom.
        </p>
      </div>
      <span className={styles.tabActive} hidden />
    </section>
  );
}
