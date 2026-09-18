let requestTimeoutMs = 30_000;

const _FRIENDLY_MESSAGES = {
  UnknownBinding: 'This feature is not available.',
  InvalidArgument: 'The input was invalid.',
  PayloadTooLarge: 'The request is too large.',
  AudioTooLarge: 'The audio file is too large.',
  UnsupportedAudioFormat: 'This audio format is not supported.',
  InvalidAudioInput: 'The audio input is invalid.',
  PathNotAllowed: 'This path is not allowed.',
  PathNotFound: 'The path was not found.',
  PathMissing: 'The file does not exist.',
  PathUnavailable: 'The path could not be resolved.',
  NoteNotFound: 'The note was not found.',
  Unavailable: 'This feature is only available inside the Julia WebView.',
  Timeout: 'The request timed out.',
  InternalError: 'An unexpected error occurred.',
};

function _requireString(value) {
  return typeof value === 'string' && value.trim();
}

function backendError(name, error) {
  if (error instanceof Error) return error;

  let details = error;
  if (typeof error === 'string') {
    try {
      details = JSON.parse(error);
    } catch {
      details = { message: error };
    }
  }

  const message =
    details && typeof details.message === 'string'
      ? details.message
      : `${name} failed.`;
  const normalized = new Error(message);
  if (details && typeof details.code === 'string')
    normalized.code = details.code;
  return normalized;
}

function unavailable(name) {
  const error = new Error(
    `${name} is only available inside the Julia WebView.`,
  );
  error.code = 'Unavailable';
  return Promise.reject(error);
}

function withTimeout(name, request) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new Error(
        `${name} timed out after ${requestTimeoutMs / 1000} seconds.`,
      );
      error.code = 'Timeout';
      reject(error);
    }, requestTimeoutMs);
    Promise.resolve(request).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(backendError(name, error));
      },
    );
  });
}

export function setRequestTimeout(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
    throw new TypeError('Request timeout must be a positive number.');
  }
  requestTimeoutMs = milliseconds;
}

export function callBackend(name, ...args) {
  if (typeof window === 'undefined' || typeof window[name] !== 'function') {
    return unavailable(name);
  }
  return withTimeout(
    name,
    Promise.resolve().then(() => window[name](...args)),
  );
}

export const writingBackend = {
  getNotes: () => callBackend('getNotes'),
  createNote: (title, tag, body) => callBackend('createNote', title, tag, body),
  updateNote: (id, title, tag, body) =>
    callBackend('updateNote', id, title, tag, body),
  deleteNote: (id) => callBackend('deleteNote', id),
  generatePdf: (filename, title, body, layout) =>
    callBackend('generatePdf', filename, title, body, layout),
  createPaperProject: (path, project) =>
    callBackend('createPaperProject', path, project),
  openPaperProject: (path) => callBackend('openPaperProject', path),
  savePaperProject: (pathOrHandle, project) =>
    callBackend('savePaperProject', pathOrHandle, project),
  exportPaperProject: (pathOrHandle, outputPath, options) =>
    callBackend('exportPaperProject', pathOrHandle, outputPath, options),
  parseBibTeX: (source) => callBackend('parseBibTeX', source),
  addBibTeXToProject: (pathOrHandle, source) =>
    callBackend('addBibTeXToProject', pathOrHandle, source),
  validatePaperProject: (project) =>
    callBackend('validatePaperProject', project),
};

export const mediaBackend = {
  inspectMedia: (path) => callBackend('inspectMedia', path),
  listDirectory: (path, options) =>
    callBackend('listDirectory', path, options || {}),
  listVolumes: () => callBackend('listVolumes'),
  startAssetScan: (paths) => callBackend('startAssetScan', paths),
  getAssetScanStatus: (jobId) => callBackend('getAssetScanStatus', jobId),
  cancelAssetScan: (jobId) => callBackend('cancelAssetScan', jobId),
  markdownToHtml: (content) => callBackend('markdownToHtml', content),
  planConversion: (input, output) =>
    callBackend('planConversion', input, output),
  getMediaCapabilities: () => callBackend('getMediaCapabilities'),
};

export const musicBackend = {
  getAudioMetadata: (path) => callBackend('getAudioMetadata', path),
  startAudioAnalysis: (path, profile) =>
    callBackend('startAudioAnalysis', path, profile),
  getAudioAnalysisStatus: (jobId) =>
    callBackend('getAudioAnalysisStatus', jobId),
  cancelAudioAnalysis: (jobId) => callBackend('cancelAudioAnalysis', jobId),
};

export const appBackend = {
  getSettings: () => callBackend('getSettings'),
  saveSettings: (settings) => callBackend('saveSettings', settings),
  getDiagnostics: (limit) => callBackend('getDiagnostics', limit),
  clearDiagnostics: () => callBackend('clearDiagnostics'),
};
