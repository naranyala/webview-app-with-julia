import { useState } from 'preact/hooks';
import { backend, backendError } from '../backend.js';
import { styles, sx } from '../stylex-styles.js';
import { analyzeSamples, describeFeatures, windowSamples } from './mir.js';

export function MirLab() {
  const [features, setFeatures] = useState(null);
  const [detail, setDetail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState('demo 440Hz tone');

  async function runAnalysis(samples, sampleRate, label) {
    setBusy(true);
    setError('');
    try {
      const windowed = windowSamples(samples);
      const result = backend.isNative()
        ? await backend.mirAnalyze(windowed, sampleRate)
        : analyzeSamples(windowed, sampleRate);
      setFeatures(result);
      setDetail(describeFeatures(result));
      setSource(label);
    } catch (failure) {
      setError(backendError(failure));
    } finally {
      setBusy(false);
    }
  }

  function analyzeDemo() {
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
    try {
      await backend.createNote(
        `MIR: ${source}`,
        'MIR',
        `Source: ${source}\nRMS ${features.rms.toFixed(4)} / peak ${features.peak.toFixed(4)} / ZCR ${features.zcr.toFixed(4)}\n${detail}\nWindow: ${features.sample_count} samples @ ${features.sample_rate}Hz`
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
            Offline time-domain analysis. Native Zig when hosted, JS mirror in
            the browser.
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
              {features.sample_count} samples @ {features.sample_rate}Hz (
              {features.duration_seconds.toFixed(2)}s)
            </li>
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
