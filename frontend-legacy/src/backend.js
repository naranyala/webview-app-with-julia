/**
 * Julia backend bridge.
 *
 * Inside the native WebView each `window.*` function is bound by the Julia
 * Backend module (`src/Backend.jl`) via the webview queue system and returns
 * a Promise. Failures arrive in one of three shapes, all normalized by
 * `errorDetails()`:
 *
 * - Structured envelope from `backend.rejectWithCode`:
 *   `{"code":"MalformedJson","message":"..."}`.
 * - Bare error names from `rejectError`: `"InvalidState"`, possibly quoted.
 * - Local errors: timeouts (`code: 'Timeout'`), missing bindings outside the
 *   native shell (`code: 'Unavailable'`), and client-side validation
 *   (`code: 'InvalidArgument'`).
 *
 * Under `npm run dev` / esbuild serve those bindings don't exist, so every
 * helper falls back to a mock that keeps the UI usable in the browser.
 */

import { mockBinding } from './backend-mock.js';
import { recordFrontendDiagnostic } from './diagnostics-store.js';
import { validateMirInput } from './plugins/mir.js';
import {
  parseAddBibtexToProjectResult,
  parseAssetScanJob,
  parseAudioAnalysis,
  parseAudioAnalysisJob,
  parseAudioMetadata,
  parseBackendStatus,
  parseConversionPlan,
  parseConversionResult,
  parseDiagnosticsReport,
  parseExportPaperProjectResult,
  parseImportBibliographyResult,
  parseListDirectoryResult,
  parseListPaperProjectsResult,
  parseMediaCapabilities,
  parseMediaConversionJob,
  parseMediaInfo,
  parseMediaWriteResult,
  parsePaperProjectResult,
  parsePaperProjectValidation,
  parseSettings,
  parseStudioVolumeList,
  parseTextPayload
} from './schemas.js';

// Five seconds is long enough for normal local filesystem work while still
// surfacing a disconnected native bridge instead of leaving UI actions stuck.
const DEFAULT_TIMEOUT_MS = 5000;
let defaultTimeoutMs = DEFAULT_TIMEOUT_MS;

export function setDefaultTimeout(ms) {
  defaultTimeoutMs = typeof ms === 'number' && ms > 0 ? ms : DEFAULT_TIMEOUT_MS;
}

export function getDefaultTimeout() {
  return defaultTimeoutMs;
}

function hasBinding(name) {
  return typeof window !== 'undefined' && typeof window[name] === 'function';
}

const FRIENDLY_MESSAGES = Object.freeze({
  MalformedJson: 'The request was not valid JSON.',
  NotArgumentArray: 'The request arguments must be a JSON array.',
  WrongArgumentCount: 'The request takes exactly one argument.',
  NonIntegerArgument: 'The counter delta must be an integer.',
  InvalidArgument: 'A backend argument was invalid.',
  WindowUnavailable: 'The native window is unavailable.',
  WindowActionFailed: 'The window action failed.',
  PayloadTooLarge: 'The request payload is too large.',
  PathMissing: 'The requested file was not found.',
  PathNotAllowed: 'The requested path is outside the allowed workspace.',
  PathUnavailable: 'The requested path could not be resolved.',
  MediaNotFound: 'The media file was not found.',
  MediaUnsupported: 'The media format is unsupported.',
  MediaTooLarge: 'The media content is too large.',
  MediaInvalid: 'The media content is invalid.',
  MediaFailed: 'The media operation failed.',
  ConversionFailed: 'The media conversion failed.',
  ConversionRequiresJob: 'This conversion must run as a background job.',
  BackendUnavailable: 'The requested media backend is unavailable.',
  JobLimitReached: 'Too many background jobs are active.',
  InvalidResponse: 'The backend returned an invalid response.',
  StorageUnavailable: 'Persistent storage is unavailable.',
  StorageCorrupt: 'Persistent note data is corrupt.',
  StorageWriteFailed: 'The note could not be saved.',
  StorageTooLarge: 'Persistent note data is too large.',
  NoteNotFound: 'The note no longer exists.',
  InvalidPdfName: 'The PDF filename is invalid.',
  PdfTooLarge: 'The PDF is too large.',
  PdfDecodeFailed: 'The PDF data could not be decoded.',
  DocumentsUnavailable: 'The documents folder is unavailable.',
  PdfWriteFailed: 'The PDF could not be saved.',
  MirNoSamples: 'No audio samples were provided.',
  InvalidAudioInput: 'The audio input is invalid.',
  MirTooManySamples: 'Too many audio samples for one analysis window.',
  MirBadSampleRate: 'The sample rate is invalid.',
  InvalidScanPath: 'The scan path is invalid.',
  ScanPathMissing: 'The scan path was not found.',
  AssetVolumeNotFound: 'The selected scan volume was not found.',
  AssetScanFailed: 'The asset scan failed.',
  AssetJobNotFound: 'The asset scan job was not found.',
  AudioPathRequired: 'An audio path is required.',
  UnsupportedAudioFormat: 'Unsupported audio format.',
  AudioTooLarge: 'The audio file is too large.',
  AudioJobNotFound: 'The audio analysis job was not found.',
  MediaJobNotFound: 'The media conversion job was not found.',
  InvalidWav: 'The WAV data is invalid.',
  UnsupportedWav: 'The WAV format is unsupported.',
  InvalidBibTeX: 'The BibTeX document is invalid.',
  InvalidBlendFile: 'The Blender file header is invalid.',
  PathNotFound: 'The requested path was not found.',
  DirectoryReadFailed: 'Could not read the directory.'
});

function friendlyMessage(code, fallback) {
  if (code === 'Timeout') return fallback || 'The backend request timed out.';
  if (code === 'Unavailable')
    return fallback || 'The backend is unavailable outside the native shell.';
  return FRIENDLY_MESSAGES[code] || fallback || code;
}

/**
 * Normalize any backend failure into `{ code, message }`.
 * Codes are stable PascalCase tokens for UI switching; messages are display-ready.
 */
export function errorDetails(error) {
  const normalize = (code, message, source = {}) => ({
    code,
    message: message || friendlyMessage(code, '') || code,
    category:
      typeof source.category === 'string' ? source.category : 'application',
    recoverable: source.recoverable !== false,
    requestId: typeof source.requestId === 'string' ? source.requestId : '',
    operation: typeof source.operation === 'string' ? source.operation : '',
    details:
      source.details && typeof source.details === 'object' ? source.details : {}
  });
  if (error && typeof error === 'object' && typeof error.code === 'string') {
    const message =
      typeof error.message === 'string' && error.message
        ? error.message
        : friendlyMessage(error.code, '');
    return normalize(error.code, message, error);
  }

  const raw = error instanceof Error ? error.message : String(error ?? '');

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.code === 'string') {
        return normalize(
          parsed.code,
          typeof parsed.message === 'string' && parsed.message
            ? parsed.message
            : friendlyMessage(parsed.code, raw),
          parsed
        );
      }
    } catch {
      // Not an envelope; fall through to bare-name handling.
    }

    const name = raw.replace(/^"|"$/g, '');
    if (/^[A-Z][A-Za-z]*$/.test(name)) {
      return normalize(name, friendlyMessage(name, raw));
    }
  }

  return normalize('Unknown', raw || 'Backend request failed', {
    category: 'internal',
    recoverable: false
  });
}

export function backendError(error) {
  return errorDetails(error).message;
}

function withTimeout(promise, name, ms) {
  // Native calls can outlive a failed UI action. Clearing the timer in the
  // settled promise prevents one timer per request from accumulating.
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`${name} timed out after ${ms}ms`);
      error.code = 'Timeout';
      error.category = 'timeout';
      error.recoverable = true;
      reject(error);
    }, ms);
  });
  return Promise.race([
    Promise.resolve(promise).finally(() => {
      if (timer !== null) clearTimeout(timer);
    }),
    timeout
  ]);
}

function unavailable(name) {
  const error = new Error(`${name} is unavailable outside the native shell`);
  error.code = 'Unavailable';
  error.category = 'capability';
  return Promise.reject(error);
}

function invalidArgument(message) {
  const error = new Error(message);
  error.code = 'InvalidArgument';
  error.category = 'validation';
  return Promise.reject(error);
}

function invalidResponse(name) {
  const error = new Error(`${name} returned an invalid response`);
  error.code = 'InvalidResponse';
  error.category = 'contract';
  error.recoverable = false;
  return error;
}

function parsedBinding(name, promise, parser) {
  return promise.then((value) => {
    const parsed = parser(value);
    if (parsed === null) throw invalidResponse(name);
    return parsed;
  });
}

function validateNoteFields(id, title, tag, body) {
  if (id !== undefined && (typeof id !== 'string' || id.length === 0)) {
    return 'note id is required';
  }
  if (typeof title !== 'string' || title.trim().length === 0) {
    return 'note title is required';
  }
  if (title.length > 200) return 'note title is too long';
  if (typeof tag !== 'string' || tag.length > 64) return 'note tag is too long';
  if (typeof body !== 'string' || body.length > 512 * 1024) {
    return 'note body is too long';
  }
  return null;
}

function callBinding(name, ...args) {
  // Keep all bridge selection in one place:
  // 1. use the native window binding when hosted;
  // 2. fail explicitly when mock mode is disabled;
  // 3. otherwise use the browser mock for development and tests.
  let result;
  if (hasBinding(name)) {
    try {
      result = window[name](...args);
    } catch (error) {
      result = Promise.reject(error);
    }
  } else if (
    typeof window !== 'undefined' &&
    window.__PREACT_MOCK_BRIDGE__ === false
  ) {
    result = unavailable(name);
  } else {
    result = mockBinding(name, args);
  }
  const started =
    typeof performance !== 'undefined' ? performance.now() : Date.now();
  return withTimeout(result, name, defaultTimeoutMs).then(
    (value) => {
      const durationMs =
        (typeof performance !== 'undefined' ? performance.now() : Date.now()) -
        started;
      if (durationMs >= 250) {
        recordFrontendDiagnostic({
          level: 'warn',
          event: 'bridge.slow',
          operation: name,
          message: `${name} completed slowly`,
          category: 'performance',
          recoverable: true,
          durationMs
        });
      }
      return value;
    },
    (error) => {
      const details = errorDetails(error);
      recordFrontendDiagnostic({
        level: 'error',
        event: 'bridge.failed',
        operation: details.operation || name,
        requestId: details.requestId,
        code: details.code,
        message: details.message,
        category: details.category,
        recoverable: details.recoverable,
        durationMs:
          (typeof performance !== 'undefined'
            ? performance.now()
            : Date.now()) - started,
        details: details.details
      });
      throw error;
    }
  );
}

const CORE_BINDINGS = [
  'increment',
  'reset',
  'getSystemInfo',
  'getTimestamp',
  'getStatus',
  'getDiagnostics',
  'clearDiagnostics',
  'getNotes',
  'createNote',
  'updateNote',
  'deleteNote',
  'savePdf',
  'mirAnalyze',
  'listVolumes',
  'startAssetScan',
  'getAssetScanStatus',
  'cancelAssetScan',
  'getAudioMetadata',
  'analyzeAudio',
  'startAudioAnalysis',
  'getAudioAnalysisStatus',
  'cancelAudioAnalysis',
  'parseBibTeX',
  'importBibliography',
  'exportBibliography',
  'addBibtexToProject',
  'getSettings',
  'saveSettings',
  'createPaperProject',
  'openPaperProject',
  'savePaperProject',
  'validatePaperProject',
  'exportPaperProject',
  'listPaperProjects',
  'inspectBlend',
  'generatePdf',
  'listDirectory',
  'minimizeWindow',
  'maximizeWindow',
  'restoreWindow',
  'closeWindow'
];

// Public adapter used by UI components. Client-side validation avoids a
// needless bridge round-trip for obvious errors; Backend.jl repeats the
// validation because native callers cannot be trusted.
export const backend = {
  isNative: () => CORE_BINDINGS.every(hasBinding),
  increment: (delta) => {
    if (typeof delta !== 'number' || !Number.isInteger(delta)) {
      return invalidArgument('increment delta must be an integer');
    }
    return callBinding('increment', delta);
  },
  reset: () => callBinding('reset'),
  getSystemInfo: () => callBinding('getSystemInfo'),
  getTimestamp: () => callBinding('getTimestamp'),
  getStatus: () =>
    parsedBinding('getStatus', callBinding('getStatus'), parseBackendStatus),
  getDiagnostics: (limit = 200) =>
    parsedBinding(
      'getDiagnostics',
      callBinding('getDiagnostics', limit),
      parseDiagnosticsReport
    ),
  clearDiagnostics: () => callBinding('clearDiagnostics'),
  getSettings: () =>
    parsedBinding('getSettings', callBinding('getSettings'), parseSettings),
  saveSettings: (settings) =>
    parsedBinding(
      'saveSettings',
      callBinding('saveSettings', settings),
      parseSettings
    ),
  createPaperProject: (path, project) =>
    parsedBinding(
      'createPaperProject',
      callBinding('createPaperProject', path, project),
      parsePaperProjectResult
    ),
  openPaperProject: (path) =>
    parsedBinding(
      'openPaperProject',
      callBinding('openPaperProject', path),
      parsePaperProjectResult
    ),
  savePaperProject: (pathOrHandle, project) =>
    parsedBinding(
      'savePaperProject',
      callBinding('savePaperProject', pathOrHandle, project),
      parsePaperProjectResult
    ),
  validatePaperProject: (project) =>
    parsedBinding(
      'validatePaperProject',
      callBinding('validatePaperProject', project),
      parsePaperProjectValidation
    ),
  listPaperProjects: (root) =>
    parsedBinding(
      'listPaperProjects',
      callBinding('listPaperProjects', root),
      parseListPaperProjectsResult
    ),
  exportPaperProject: (pathOrHandle, options = {}) =>
    parsedBinding(
      'exportPaperProject',
      callBinding('exportPaperProject', pathOrHandle, options),
      parseExportPaperProjectResult
    ),
  importBibliography: (path) =>
    parsedBinding(
      'importBibliography',
      callBinding('importBibliography', path),
      parseImportBibliographyResult
    ),
  exportBibliography: (path, entries) =>
    callBinding('exportBibliography', path, entries),
  addBibTeXToProject: (pathOrHandle, source) =>
    parsedBinding(
      'addBibtexToProject',
      callBinding('addBibtexToProject', pathOrHandle, source),
      parseAddBibtexToProjectResult
    ),
  getNotes: () => callBinding('getNotes'),
  createNote: (title, tag, body) => {
    const validationError = validateNoteFields(undefined, title, tag, body);
    return validationError
      ? invalidArgument(validationError)
      : callBinding('createNote', title, tag, body);
  },
  updateNote: (id, title, tag, body) => {
    const validationError = validateNoteFields(id, title, tag, body);
    return validationError
      ? invalidArgument(validationError)
      : callBinding('updateNote', id, title, tag, body);
  },
  deleteNote: (id) =>
    typeof id !== 'string' || id.length === 0
      ? invalidArgument('note id is required')
      : callBinding('deleteNote', id),
  savePdf: (filename, dataBase64) => {
    if (
      typeof filename !== 'string' ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}\.pdf$/.test(filename) ||
      filename.length > 100
    ) {
      return invalidArgument('pdf filename is invalid');
    }
    if (
      typeof dataBase64 !== 'string' ||
      dataBase64.length === 0 ||
      dataBase64.length > 22400000
    ) {
      return invalidArgument('pdf data is invalid');
    }
    return callBinding('savePdf', filename, dataBase64);
  },
  mirAnalyze: (samples, sampleRate, profile = 'quick') => {
    const invalid =
      validateMirInput(samples, sampleRate) ||
      (samples.length > 262144 ? 'too many audio samples' : null);
    return invalid
      ? invalidArgument(invalid)
      : !['quick', 'spectral'].includes(profile)
        ? invalidArgument('analysis profile is invalid')
        : callBinding('mirAnalyze', [...samples], sampleRate, profile);
  },
  listVolumes: () =>
    parsedBinding(
      'listVolumes',
      callBinding('listVolumes'),
      parseStudioVolumeList
    ),
  startAssetScan: (volumeId) =>
    typeof volumeId !== 'string' || !volumeId.trim()
      ? invalidArgument('scan volume id is required')
      : parsedBinding(
          'startAssetScan',
          callBinding('startAssetScan', volumeId),
          parseAssetScanJob
        ),
  getAssetScanStatus: (jobId) =>
    typeof jobId !== 'string' || !jobId
      ? invalidArgument('scan job id is required')
      : parsedBinding(
          'getAssetScanStatus',
          callBinding('getAssetScanStatus', jobId),
          parseAssetScanJob
        ),
  cancelAssetScan: (jobId) =>
    typeof jobId !== 'string' || !jobId
      ? invalidArgument('scan job id is required')
      : parsedBinding(
          'cancelAssetScan',
          callBinding('cancelAssetScan', jobId),
          parseAssetScanJob
        ),
  getAudioMetadata: (path) =>
    typeof path !== 'string' || !path.trim()
      ? invalidArgument('audio path is required')
      : parsedBinding(
          'getAudioMetadata',
          callBinding('getAudioMetadata', path),
          parseAudioMetadata
        ),
  analyzeAudio: (path, profile = 'quick') =>
    typeof path !== 'string' || !path.trim()
      ? invalidArgument('audio path is required')
      : !['quick', 'spectral'].includes(profile)
        ? invalidArgument('analysis profile is invalid')
        : parsedBinding(
            'analyzeAudio',
            callBinding('analyzeAudio', path, profile),
            parseAudioAnalysis
          ),
  startAudioAnalysis: (path, profile = 'quick') =>
    typeof path !== 'string' || !path.trim()
      ? invalidArgument('audio path is required')
      : !['quick', 'spectral'].includes(profile)
        ? invalidArgument('analysis profile is invalid')
        : parsedBinding(
            'startAudioAnalysis',
            callBinding('startAudioAnalysis', path, profile),
            parseAudioAnalysisJob
          ),
  getAudioAnalysisStatus: (jobId) =>
    typeof jobId !== 'string' || !jobId
      ? invalidArgument('audio job id is required')
      : parsedBinding(
          'getAudioAnalysisStatus',
          callBinding('getAudioAnalysisStatus', jobId),
          parseAudioAnalysisJob
        ),
  cancelAudioAnalysis: (jobId) =>
    typeof jobId !== 'string' || !jobId
      ? invalidArgument('audio job id is required')
      : parsedBinding(
          'cancelAudioAnalysis',
          callBinding('cancelAudioAnalysis', jobId),
          parseAudioAnalysisJob
        ),
  // Optional StaticMediaCompanion feature bindings. They are intentionally
  // outside CORE_BINDINGS so existing browser/native detection remains stable.
  inspectMedia: (path) =>
    typeof path !== 'string' || !path.trim()
      ? invalidArgument('media path is required')
      : parsedBinding(
          'inspectMedia',
          callBinding('inspectMedia', path),
          parseMediaInfo
        ),
  markdownToHtml: (content) =>
    typeof content !== 'string' || !content
      ? invalidArgument('Markdown content is required')
      : parsedBinding(
          'markdownToHtml',
          callBinding('markdownToHtml', content),
          parseTextPayload
        ),
  readText: (path) =>
    typeof path !== 'string' || !path.trim()
      ? invalidArgument('text path is required')
      : parsedBinding(
          'readText',
          callBinding('readText', path),
          parseTextPayload
        ),
  writeText: (path, content) =>
    typeof path !== 'string' || !path.trim() || typeof content !== 'string'
      ? invalidArgument('text path or content is invalid')
      : parsedBinding(
          'writeText',
          callBinding('writeText', path, content),
          parseMediaWriteResult
        ),
  planConversion: (input, output) =>
    typeof input !== 'string' ||
    !input.trim() ||
    typeof output !== 'string' ||
    !output.trim()
      ? invalidArgument('conversion input or output is invalid')
      : parsedBinding(
          'planConversion',
          callBinding('planConversion', input, output),
          parseConversionPlan
        ),
  convertMedia: (input, output) =>
    typeof input !== 'string' ||
    !input.trim() ||
    typeof output !== 'string' ||
    !output.trim()
      ? invalidArgument('conversion input or output is invalid')
      : parsedBinding(
          'convertMedia',
          callBinding('convertMedia', input, output),
          parseConversionResult
        ),
  startMediaConversion: (input, output) =>
    typeof input !== 'string' ||
    !input.trim() ||
    typeof output !== 'string' ||
    !output.trim()
      ? invalidArgument('conversion input or output is invalid')
      : parsedBinding(
          'startMediaConversion',
          callBinding('startMediaConversion', input, output),
          parseMediaConversionJob
        ),
  getMediaConversionStatus: (jobId) =>
    typeof jobId !== 'string' || !jobId
      ? invalidArgument('media job id is required')
      : parsedBinding(
          'getMediaConversionStatus',
          callBinding('getMediaConversionStatus', jobId),
          parseMediaConversionJob
        ),
  cancelMediaConversion: (jobId) =>
    typeof jobId !== 'string' || !jobId
      ? invalidArgument('media job id is required')
      : parsedBinding(
          'cancelMediaConversion',
          callBinding('cancelMediaConversion', jobId),
          parseMediaConversionJob
        ),
  getMediaCapabilities: () =>
    parsedBinding(
      'getMediaCapabilities',
      callBinding('getMediaCapabilities'),
      parseMediaCapabilities
    ),
  htmlToText: (html) =>
    typeof html !== 'string'
      ? invalidArgument('HTML content must be text')
      : parsedBinding(
          'htmlToText',
          callBinding('htmlToText', html),
          parseTextPayload
        ),
  parseBibTeX: (source) =>
    typeof source !== 'string' || !source.trim()
      ? invalidArgument('BibTeX source is required')
      : callBinding('parseBibTeX', source),
  inspectBlend: (path) =>
    typeof path !== 'string' || !path.trim()
      ? invalidArgument('blend path is required')
      : callBinding('inspectBlend', path),
  generatePdf: (filename, title, body, layout = 'single') =>
    typeof filename !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}\.pdf$/.test(filename) ||
    typeof title !== 'string' ||
    typeof body !== 'string' ||
    (layout !== 'single' && layout !== 'two-column' && layout !== 'double')
      ? invalidArgument('PDF filename, title, body, or layout is invalid')
      : callBinding('generatePdf', filename, title, body, layout),
  listDirectory: (dirPath, options = {}) =>
    typeof dirPath !== 'string' || !dirPath.trim()
      ? invalidArgument('directory path is required')
      : parsedBinding(
          'listDirectory',
          callBinding('listDirectory', dirPath, options),
          parseListDirectoryResult
        ),
  minimizeWindow: () => callBinding('minimizeWindow'),
  maximizeWindow: () => callBinding('maximizeWindow'),
  restoreWindow: () => callBinding('restoreWindow'),
  closeWindow: () => callBinding('closeWindow')
};

export function backendErrorWithCode(error) {
  const details = errorDetails(error);
  return `${details.message} (${details.code})`;
}
