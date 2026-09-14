// Payload validators for backend data, in the codebase's hand-rolled style
// (no schema library: the limits mirror `src/Backend.jl` and `src/backend.js`
// so malformed native payloads degrade to safe defaults
// instead of crashing renderers). Each parser returns a normalized copy or
// null; list parsers drop invalid entries like `parseStoredQna` tolerates
// legacy note bodies.
const MAX_ID = 200;
const MAX_TITLE = 200;
const MAX_TEXT = 20000;
const MAX_PATH = 4096;

function cleanString(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function boundedNumber(value, fallback = 0) {
  // Native JSON may contain null, strings, or non-finite values. Renderers
  // receive a finite number instead of needing defensive checks everywhere.
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function parseStudioVolumeList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      id: cleanString(item.id).slice(0, MAX_ID),
      name: cleanString(item.name).slice(0, MAX_TITLE),
      path: cleanString(item.path).slice(0, MAX_PATH),
      kind: cleanString(item.kind, 'general').slice(0, MAX_TITLE)
    }))
    .filter((item) => item.id && item.name && item.path);
}

export function parseAssetScanJob(value) {
  if (!value || typeof value !== 'object') return null;
  if (typeof value.id !== 'string' || value.id.length === 0) return null;
  if (typeof value.volumeId !== 'string' || value.volumeId.length === 0) {
    return null;
  }
  const progress = Math.min(1, Math.max(0, boundedNumber(value.progress)));
  const state = ['running', 'completed', 'failed', 'cancelled'].includes(
    value.state
  )
    ? value.state
    : 'failed';
  // Keep the UI bounded even if a backend or older persisted job reports a
  // very large folder list.
  const topFolders = Array.isArray(value.topFolders)
    ? value.topFolders
        .filter((folder) => folder && typeof folder.name === 'string')
        .map((folder) => ({
          name: folder.name.slice(0, MAX_PATH),
          bytes: Math.max(0, boundedNumber(folder.bytes))
        }))
        .slice(0, 100)
    : [];
  return {
    id: value.id,
    volumeId: value.volumeId,
    state,
    progress,
    message: cleanString(value.message).slice(0, MAX_PATH),
    scannedFiles: Math.max(0, Math.floor(boundedNumber(value.scannedFiles))),
    scannedBytes: Math.max(0, Math.floor(boundedNumber(value.scannedBytes))),
    blender: Math.max(0, Math.floor(boundedNumber(value.blender))),
    audio: Math.max(0, Math.floor(boundedNumber(value.audio))),
    render: Math.max(0, Math.floor(boundedNumber(value.render))),
    other: Math.max(0, Math.floor(boundedNumber(value.other))),
    truncated: value.truncated === true,
    topFolders,
    error: cleanString(value.error)
  };
}

export function parseAudioMetadata(value) {
  if (!value || typeof value !== 'object') return null;
  if (typeof value.path !== 'string' || value.path.length === 0) return null;
  return {
    path: value.path.slice(0, MAX_PATH),
    format: cleanString(value.format, 'unknown').slice(0, 16),
    durationSec: Math.max(0, boundedNumber(value.durationSec)),
    sampleRate: Math.max(0, Math.floor(boundedNumber(value.sampleRate))),
    channels: Math.max(0, Math.floor(boundedNumber(value.channels))),
    sizeBytes: Math.max(0, Math.floor(boundedNumber(value.sizeBytes))),
    measured: value.measured === true,
    engine: cleanString(value.engine)
  };
}

export function parseAudioAnalysis(value) {
  if (!value || typeof value !== 'object') return null;
  const metadata = parseAudioMetadata(value);
  if (!metadata) return null;
  // Julia's canonical fields are snake_case; camelCase aliases are accepted
  // for the WebView DTO and for compatibility with the native metadata shape.
  const sampleCount = Math.max(
    0,
    Math.floor(boundedNumber(value.sampleCount ?? value.sample_count))
  );
  const sampleRate = Math.max(
    0,
    Math.floor(boundedNumber(value.sampleRate ?? value.sample_rate))
  );
  return {
    ...metadata,
    sampleCount,
    rms: Math.max(0, boundedNumber(value.rms)),
    peak: Math.max(0, boundedNumber(value.peak)),
    zcr: Math.max(0, boundedNumber(value.zcr)),
    ...(value.spectralCentroidHz !== undefined && {
      spectralCentroidHz: Math.max(0, boundedNumber(value.spectralCentroidHz))
    }),
    ...(value.spectralBandwidthHz !== undefined && {
      spectralBandwidthHz: Math.max(0, boundedNumber(value.spectralBandwidthHz))
    }),
    ...(value.spectralRolloffHz !== undefined && {
      spectralRolloffHz: Math.max(0, boundedNumber(value.spectralRolloffHz))
    }),
    ...(value.spectralFlatness !== undefined && {
      spectralFlatness: Math.max(0, boundedNumber(value.spectralFlatness))
    }),
    ...(value.spectralFlux !== undefined && {
      spectralFlux: Math.max(0, boundedNumber(value.spectralFlux))
    }),
    durationSeconds: Math.max(
      0,
      boundedNumber(value.duration_seconds ?? value.durationSec)
    ),
    sampleRate,
    partial: value.partial === true,
    analysisSchema: Math.max(
      0,
      Math.floor(boundedNumber(value.analysisSchema))
    ),
    analysisProfile: cleanString(value.analysisProfile),
    channelPolicy: cleanString(value.channelPolicy),
    engine: cleanString(value.engine)
  };
}

export function parseAudioAnalysisJob(value) {
  if (!value || typeof value !== 'object') return null;
  if (typeof value.id !== 'string' || value.id.length === 0) return null;
  if (typeof value.path !== 'string' || value.path.length === 0) return null;
  const state = ['running', 'completed', 'failed', 'cancelled'].includes(
    value.state
  )
    ? value.state
    : 'failed';
  const job = {
    id: value.id,
    path: value.path.slice(0, MAX_PATH),
    state,
    progress: Math.min(1, Math.max(0, boundedNumber(value.progress))),
    message: cleanString(value.message).slice(0, MAX_PATH),
    error: cleanString(value.error)
  };
  if (value.rms !== undefined) {
    const analysis = parseAudioAnalysis(value);
    if (!analysis) return null;
    return { ...job, ...analysis };
  }
  return job;
}

export function parseTextPayload(value) {
  return typeof value === 'string' ? value : null;
}

function parseMediaContract(value) {
  const provenance =
    value?.provenance && typeof value.provenance === 'object'
      ? value.provenance
      : {};
  return {
    schemaVersion: Math.max(
      1,
      Math.floor(boundedNumber(value?.schemaVersion, 1))
    ),
    provenance: {
      engine: cleanString(provenance.engine, 'StaticMediaCompanion').slice(
        0,
        MAX_TITLE
      ),
      engineVersion: cleanString(provenance.engineVersion, 'unknown').slice(
        0,
        MAX_TITLE
      ),
      backend: cleanString(provenance.backend, 'unknown').slice(0, MAX_TITLE)
    }
  };
}

export function parseMediaInfo(value) {
  if (!value || typeof value !== 'object') return null;
  if (typeof value.path !== 'string' || typeof value.kind !== 'string')
    return null;
  if (typeof value.mime !== 'string' || typeof value.extension !== 'string')
    return null;
  const dimension = (item) =>
    item === null || item === undefined
      ? null
      : Math.max(0, Math.floor(boundedNumber(item)));
  return {
    ...parseMediaContract(value),
    path: value.path.slice(0, MAX_PATH),
    kind: value.kind.slice(0, MAX_TITLE),
    mime: value.mime.slice(0, MAX_TITLE),
    extension: value.extension.slice(0, 32),
    size: Math.max(0, Math.floor(boundedNumber(value.size))),
    width: dimension(value.width),
    height: dimension(value.height)
  };
}

export function parseMediaWriteResult(value) {
  if (!value || typeof value !== 'object' || typeof value.path !== 'string') {
    return null;
  }
  return {
    path: value.path.slice(0, MAX_PATH),
    size: Math.max(0, Math.floor(boundedNumber(value.size)))
  };
}

export function parseConversionPlan(value) {
  if (!value || typeof value !== 'object') return null;
  if (typeof value.input !== 'string' || typeof value.output !== 'string')
    return null;
  return {
    ...parseMediaContract(value),
    input: value.input.slice(0, MAX_PATH),
    output: value.output.slice(0, MAX_PATH),
    sourceKind: cleanString(value.sourceKind, 'Unknown').slice(0, MAX_TITLE),
    targetKind: cleanString(value.targetKind, 'Unknown').slice(0, MAX_TITLE),
    backend: cleanString(value.backend, 'unsupported').slice(0, MAX_TITLE),
    requiresExternalTool: value.requiresExternalTool === true,
    lossiness: cleanString(value.lossiness, 'unsupported').slice(0, MAX_TITLE)
  };
}

export function parseConversionResult(value) {
  if (!value || typeof value !== 'object' || typeof value.output !== 'string') {
    return null;
  }
  return {
    ...parseMediaContract(value),
    output: value.output.slice(0, MAX_PATH),
    backend: cleanString(value.backend, 'unknown').slice(0, MAX_TITLE),
    sourceKind: cleanString(value.sourceKind, 'Unknown').slice(0, MAX_TITLE),
    targetKind: cleanString(value.targetKind, 'Unknown').slice(0, MAX_TITLE),
    bytesWritten: Math.max(0, Math.floor(boundedNumber(value.bytesWritten))),
    warnings: Array.isArray(value.warnings)
      ? value.warnings
          .filter((warning) => typeof warning === 'string')
          .map((warning) => warning.slice(0, MAX_TEXT))
          .slice(0, 32)
      : []
  };
}

export function parseMediaConversionJob(value) {
  if (!value || typeof value !== 'object' || typeof value.id !== 'string')
    return null;
  if (typeof value.input !== 'string' || typeof value.output !== 'string')
    return null;
  const state = ['running', 'completed', 'failed', 'cancelled'].includes(
    value.state
  )
    ? value.state
    : 'failed';
  const result =
    value.result === undefined
      ? undefined
      : parseConversionResult(value.result);
  if (value.result !== undefined && !result) return null;
  return {
    ...parseMediaContract(value),
    id: value.id.slice(0, MAX_ID),
    input: value.input.slice(0, MAX_PATH),
    output: value.output.slice(0, MAX_PATH),
    state,
    progress: Math.min(1, Math.max(0, boundedNumber(value.progress))),
    message: cleanString(value.message).slice(0, MAX_TEXT),
    error: cleanString(value.error).slice(0, MAX_TEXT),
    ...(result && { result })
  };
}

export function parseMediaCapabilities(value) {
  if (!value || typeof value !== 'object') return null;
  const backend =
    value.backend && typeof value.backend === 'object' ? value.backend : {};
  const tools =
    value.tools && typeof value.tools === 'object' ? value.tools : {};
  return {
    ...parseMediaContract(value),
    backend,
    tools: Object.fromEntries(
      Object.entries(tools).map(([name, available]) => [
        name.slice(0, MAX_TITLE),
        available === true
      ])
    )
  };
}

export function parseBackendStatus(value) {
  if (typeof value === 'string') return { status: value };
  if (!value || typeof value !== 'object') return null;
  if (!['ok', 'degraded', 'unavailable'].includes(value.status)) return null;
  return {
    status: value.status,
    features: Math.max(0, Math.floor(boundedNumber(value.features))),
    availableFeatures: Math.max(
      0,
      Math.floor(boundedNumber(value.availableFeatures))
    ),
    storage:
      value.storage && typeof value.storage === 'object'
        ? { status: cleanString(value.storage.status, 'unknown') }
        : undefined
  };
}
