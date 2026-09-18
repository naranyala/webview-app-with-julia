// Keep browser-side validation/windowing aligned with AudioAnalysisAdapter.jl.
// 262,144 (2^18) bounds bridge payloads and is FFT-friendly for future profiles.
export const MIR_MAX_SAMPLES = 262144;
export const MIR_MAX_SAMPLE_RATE = 192000;

export function rootMeanSquare(samples) {
  if (!samples || samples.length === 0) return 0;
  let acc = 0;
  for (const s of samples) acc += s * s;
  return Math.sqrt(acc / samples.length);
}

export function peakAmplitude(samples) {
  let peak = 0;
  for (const s of samples) {
    const mag = Math.abs(s);
    if (mag > peak) peak = mag;
  }
  return peak;
}

export function zeroCrossingRate(samples) {
  if (!samples || samples.length < 2) return 0;
  let crossings = 0;
  let prev = samples[0] >= 0;
  for (let i = 1; i < samples.length; i += 1) {
    const positive = samples[i] >= 0;
    if (positive !== prev) crossings += 1;
    prev = positive;
  }
  return crossings / (samples.length - 1);
}

export function validateMirInput(samples, sampleRate) {
  if (!Array.isArray(samples) || samples.length === 0)
    return 'no audio samples were provided';
  if (samples.length > MIR_MAX_SAMPLES)
    return 'too many audio samples for one analysis window';
  if (
    typeof sampleRate !== 'number' ||
    !Number.isFinite(sampleRate) ||
    sampleRate <= 0 ||
    sampleRate > MIR_MAX_SAMPLE_RATE
  )
    return 'sample rate is invalid';
  if (!samples.every((s) => typeof s === 'number' && Number.isFinite(s)))
    return 'audio samples must be finite numbers';
  return null;
}

export function analyzeSamples(samples, sampleRate) {
  const error = validateMirInput(samples, sampleRate);
  if (error) throw new Error(error);
  return {
    rms: rootMeanSquare(samples),
    peak: peakAmplitude(samples),
    zcr: zeroCrossingRate(samples),
    sample_count: samples.length,
    sample_rate: sampleRate,
    duration_seconds: samples.length / sampleRate
  };
}

export function describeFeatures(features) {
  // These are presentation heuristics, not calibrated loudness standards:
  // RMS and ZCR classify a quick preview as a useful human-readable hint.
  const loudness =
    features.rms < 0.02
      ? 'near silence'
      : features.rms < 0.12
        ? 'quiet bed / dialogue level'
        : features.rms < 0.3
          ? 'healthy mix level'
          : 'hot — check headroom';
  const brightness =
    features.zcr < 0.02
      ? 'dark / bass-heavy'
      : features.zcr < 0.15
        ? 'midrange-focused'
        : 'bright / noisy / transient-rich';
  const spectral = [];
  if (Number.isFinite(features.spectralCentroidHz))
    spectral.push(`centroid ${Math.round(features.spectralCentroidHz)} Hz`);
  if (Number.isFinite(features.spectralRolloffHz))
    spectral.push(`rolloff ${Math.round(features.spectralRolloffHz)} Hz`);
  if (Number.isFinite(features.spectralFlatness))
    spectral.push(`flatness ${features.spectralFlatness.toFixed(3)}`);
  if (Number.isFinite(features.spectralFlux))
    spectral.push(`flux ${features.spectralFlux.toFixed(3)}`);
  return `${loudness}; ${brightness}${spectral.length ? `; ${spectral.join(', ')}` : ''}`;
}

// Downsample by stride instead of interpolation so the native analysis sees
// original sample values while keeping the cross-language payload bounded.
export function windowSamples(samples, max = MIR_MAX_SAMPLES) {
  if (samples.length <= max) return [...samples];
  const stride = Math.ceil(samples.length / max);
  const out = [];
  for (let i = 0; i < samples.length; i += stride) out.push(samples[i]);
  return out;
}

// --- Path-based studio metadata (ported from the vlang sibling's `mir.mjs`).
// Shapes match the native `getAudioMetadata` / `analyzeAudio` documents so
// the UI renders identically in native and browser-mirror modes. Pure
// functions: candidate for the future shared JS library as-is.

export const MOCK_AUDIO_FEATURES = {
  tempo: 124,
  key: 'A minor',
  loudnessDb: -9.5,
  durationSec: 142,
  chroma: [0.8, 0.2, 0.4, 0.1, 0.6, 0.3, 0.5, 0.7, 0.2, 0.4, 0.6, 0.3],
  spectralCentroidHz: 2450,
  mfccSummary: [12.4, -3.1, 5.6, 1.2, -0.8]
};

export function parseAudioFeatures(value) {
  if (!value || typeof value !== 'object') return null;
  const tempo = Number(value.tempo);
  const durationSec = Number(value.durationSec);
  if (!Number.isFinite(tempo) || tempo <= 0) return null;
  if (!Number.isFinite(durationSec) || durationSec < 0) return null;
  return {
    tempo,
    key: String(value.key || 'Unknown'),
    loudnessDb: Number(value.loudnessDb) || 0,
    durationSec,
    chroma: Array.isArray(value.chroma) ? value.chroma.map(Number) : [],
    spectralCentroidHz: Number(value.spectralCentroidHz) || 0,
    mfccSummary: Array.isArray(value.mfccSummary)
      ? value.mfccSummary.map(Number)
      : []
  };
}

export function formatTempo(features) {
  if (!features) return '-- BPM';
  return `${Math.round(features.tempo)} BPM · ${features.key}`;
}

export function formatDuration(totalSec) {
  const sec = Math.max(0, Math.round(Number(totalSec) || 0));
  const minutes = Math.floor(sec / 60);
  const rest = String(sec % 60).padStart(2, '0');
  return `${minutes}:${rest}`;
}

export function mixSimilarity(a, b) {
  if (!a || !b) return 0;
  const tempoDistance = Math.abs(a.tempo - b.tempo) / 40;
  const keyMatch = a.key === b.key ? 0 : 1;
  // Heuristic weighting: tempo contributes 70%, key compatibility 30%.
  return Math.max(0, 1 - (tempoDistance * 0.7 + keyMatch * 0.3));
}
