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

import { analyzeSamples, validateMirInput } from './plugins/mir.js';
import {
  parseAssetScanJob,
  parseAudioAnalysis,
  parseAudioAnalysisJob,
  parseAudioMetadata,
  parseBackendStatus,
  parseConversionPlan,
  parseConversionResult,
  parseMediaCapabilities,
  parseMediaInfo,
  parseMediaWriteResult,
  parseQuizCollection,
  parseQuizCollectionList,
  parseStudioVolumeList,
  parseTextPayload
} from './schemas.js';

// Five seconds is long enough for normal local filesystem work while still
// surfacing a disconnected native bridge instead of leaving UI actions stuck.
const DEFAULT_TIMEOUT_MS = 5000;
const MOCK_NOTES_STORAGE_KEY = 'webview-app.chain-notes';
const MOCK_QUIZ_STORAGE_KEY = 'webview-app.quiz-collections';

let defaultTimeoutMs = DEFAULT_TIMEOUT_MS;
let mockNotes = loadMockNotes();
// IDs are derived from localStorage on startup so browser reloads cannot
// reuse an existing mock record id.
let nextMockNoteId =
  mockNotes.reduce((highest, note) => {
    const match = /^note-mock-(\d+)$/.exec(note.id || '');
    return Math.max(highest, match ? Number(match[1]) : 0);
  }, 0) + 1;

function loadMockNotes() {
  try {
    const raw = globalThis.window?.localStorage?.getItem(
      MOCK_NOTES_STORAGE_KEY
    );
    const notes = raw ? JSON.parse(raw) : [];
    return Array.isArray(notes) ? notes : [];
  } catch {
    // Native WebViews can expose an opaque origin where localStorage throws.
    return [];
  }
}

function persistMockNotes() {
  try {
    globalThis.window?.localStorage?.setItem(
      MOCK_NOTES_STORAGE_KEY,
      JSON.stringify(mockNotes)
    );
  } catch {
    // The in-memory mock remains usable when browser storage is unavailable.
  }
}

let mockQuizCollections = loadMockQuizCollections();
// Quiz ids share one counter for collections and questions; this avoids
// collisions when both kinds are persisted in the same mock document.
let nextMockQuizId =
  mockQuizCollections.reduce((highest, collection) => {
    const match = /^quiz-mock-(?:col|q)-(\d+)$/.exec(collection.id || '');
    const questionBest = (collection.questions || []).reduce(
      (inner, question) => {
        const innerMatch = /^quiz-mock-(?:col|q)-(\d+)$/.exec(
          question.id || ''
        );
        return Math.max(inner, innerMatch ? Number(innerMatch[1]) : 0);
      },
      0
    );
    return Math.max(highest, match ? Number(match[1]) : 0, questionBest);
  }, 0) + 1;

function loadMockQuizCollections() {
  try {
    const raw = globalThis.window?.localStorage?.getItem(MOCK_QUIZ_STORAGE_KEY);
    const collections = raw ? JSON.parse(raw) : [];
    return parseQuizCollectionList(collections);
  } catch {
    return [];
  }
}

function persistMockQuizCollections() {
  try {
    globalThis.window?.localStorage?.setItem(
      MOCK_QUIZ_STORAGE_KEY,
      JSON.stringify(mockQuizCollections)
    );
  } catch {
    // The in-memory mock remains usable when browser storage is unavailable.
  }
}

function parseCsvTags(tagsCsv) {
  return String(tagsCsv || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function cloneQuizCollection(collection) {
  return {
    ...collection,
    questions: collection.questions.map((question) => ({
      ...question,
      tags: [...question.tags]
    }))
  };
}

function mockQuizCollection(title, description, tone, level) {
  return {
    id: `quiz-mock-col-${nextMockQuizId++}`,
    title: title.trim(),
    shortTitle: title.trim(),
    description,
    tone: tone || 'gold',
    icon: '',
    level: level || 'Custom',
    questions: []
  };
}

function mockQuizQuestion(topic, question, answer) {
  return {
    id: `quiz-mock-q-${nextMockQuizId++}`,
    topic: topic || '',
    question,
    answer,
    explanation: '',
    difficulty: '',
    tags: []
  };
}

export function setDefaultTimeout(ms) {
  defaultTimeoutMs = typeof ms === 'number' && ms > 0 ? ms : DEFAULT_TIMEOUT_MS;
}

export function getDefaultTimeout() {
  return defaultTimeoutMs;
}

function hasBinding(name) {
  return typeof window !== 'undefined' && typeof window[name] === 'function';
}

function mockValue(name) {
  switch (name) {
    case 'increment':
    case 'reset':
      return 0;
    case 'getSystemInfo':
      return 'Browser mock';
    case 'getTimestamp':
      return String(Math.floor(Date.now() / 1000));
    case 'getStatus':
      return 'ok';
    default:
      return undefined;
  }
}

function friendlyMessage(code, fallback) {
  switch (code) {
    case 'MalformedJson':
      return 'The request was not valid JSON.';
    case 'NotArgumentArray':
      return 'The request arguments must be a JSON array.';
    case 'WrongArgumentCount':
      return 'The request takes exactly one argument.';
    case 'NonIntegerArgument':
      return 'The counter delta must be an integer.';
    case 'InvalidArgument':
      return 'A backend argument was invalid.';
    case 'WindowUnavailable':
      return 'The native window is unavailable.';
    case 'WindowActionFailed':
      return 'The window action failed.';
    case 'Timeout':
      return fallback || 'The backend request timed out.';
    case 'Unavailable':
      return fallback || 'The backend is unavailable outside the native shell.';
    case 'PayloadTooLarge':
      return 'The request payload is too large.';
    case 'PathMissing':
      return 'The requested file was not found.';
    case 'PathNotAllowed':
      return 'The requested path is outside the allowed workspace.';
    case 'PathUnavailable':
      return 'The requested path could not be resolved.';
    case 'MediaNotFound':
      return 'The media file was not found.';
    case 'MediaUnsupported':
      return 'The media format is unsupported.';
    case 'MediaTooLarge':
      return 'The media content is too large.';
    case 'MediaInvalid':
      return 'The media content is invalid.';
    case 'MediaFailed':
      return 'The media operation failed.';
    case 'ConversionFailed':
      return 'The media conversion failed.';
    case 'BackendUnavailable':
      return 'The requested media backend is unavailable.';
    case 'JobLimitReached':
      return 'Too many background jobs are active.';
    case 'InvalidResponse':
      return 'The backend returned an invalid response.';
    case 'StorageUnavailable':
      return 'Persistent storage is unavailable.';
    case 'StorageCorrupt':
      return 'Persistent note data is corrupt.';
    case 'StorageWriteFailed':
      return 'The note could not be saved.';
    case 'StorageTooLarge':
      return 'Persistent note data is too large.';
    case 'NoteNotFound':
      return 'The note no longer exists.';
    case 'QuizUnavailable':
      return 'Quiz storage is unavailable.';
    case 'QuizCorrupt':
      return 'Quiz data is corrupt.';
    case 'QuizWriteFailed':
      return 'Quiz data could not be saved.';
    case 'QuizTooLarge':
      return 'Quiz data is too large.';
    case 'QuizNotFound':
      return 'The quiz item no longer exists.';
    case 'QuizLimitReached':
      return 'The quiz storage limit was reached.';
    case 'QuizTitleEmpty':
      return 'Collection title is required.';
    case 'QuizTitleTooLong':
      return 'Collection title is too long.';
    case 'QuizIdEmpty':
      return 'Quiz id is required.';
    case 'QuizIdTooLong':
      return 'Quiz id is too long.';
    case 'QuizTextEmpty':
      return 'Question and answer are required.';
    case 'QuizTextTooLong':
      return 'Quiz text is too long.';
    case 'QuizTagTooLong':
      return 'A quiz tag is too long.';
    case 'QuizTooManyTags':
      return 'Too many quiz tags were provided.';
    case 'InvalidPdfName':
      return 'The PDF filename is invalid.';
    case 'PdfTooLarge':
      return 'The PDF is too large.';
    case 'PdfDecodeFailed':
      return 'The PDF data could not be decoded.';
    case 'DocumentsUnavailable':
      return 'The documents folder is unavailable.';
    case 'PdfWriteFailed':
      return 'The PDF could not be saved.';
    case 'MirNoSamples':
      return 'No audio samples were provided.';
    case 'InvalidAudioInput':
      return 'The audio input is invalid.';
    case 'MirTooManySamples':
      return 'Too many audio samples for one analysis window.';
    case 'MirBadSampleRate':
      return 'The sample rate is invalid.';
    case 'InvalidScanPath':
      return 'The scan path is invalid.';
    case 'ScanPathMissing':
      return 'The scan path was not found.';
    case 'AssetVolumeNotFound':
      return 'The selected scan volume was not found.';
    case 'AssetScanFailed':
      return 'The asset scan failed.';
    case 'AssetJobNotFound':
      return 'The asset scan job was not found.';
    case 'AudioPathRequired':
      return 'An audio path is required.';
    case 'UnsupportedAudioFormat':
      return 'Unsupported audio format.';
    case 'AudioTooLarge':
      return 'The audio file is too large.';
    case 'AudioJobNotFound':
      return 'The audio analysis job was not found.';
    case 'InvalidWav':
      return 'The WAV data is invalid.';
    case 'UnsupportedWav':
      return 'The WAV format is unsupported.';
    case 'InvalidBibTeX':
      return 'The BibTeX document is invalid.';
    case 'InvalidBlendFile':
      return 'The Blender file header is invalid.';
    default:
      return fallback || code;
  }
}

/**
 * Normalize any backend failure into `{ code, message }`.
 * Codes are stable PascalCase tokens for UI switching; messages are display-ready.
 */
export function errorDetails(error) {
  if (error && typeof error === 'object' && typeof error.code === 'string') {
    const message =
      typeof error.message === 'string' && error.message
        ? error.message
        : friendlyMessage(error.code, '');
    return { code: error.code, message: message || error.code };
  }

  const raw = error instanceof Error ? error.message : String(error ?? '');

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.code === 'string') {
        return {
          code: parsed.code,
          message:
            typeof parsed.message === 'string' && parsed.message
              ? parsed.message
              : friendlyMessage(parsed.code, raw)
        };
      }
    } catch {
      // Not an envelope; fall through to bare-name handling.
    }

    const name = raw.replace(/^"|"$/g, '');
    if (/^[A-Z][A-Za-z]*$/.test(name)) {
      return { code: name, message: friendlyMessage(name, raw) };
    }
  }

  return { code: 'Unknown', message: raw || 'Backend request failed' };
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
  return Promise.reject(error);
}

function invalidArgument(message) {
  const error = new Error(message);
  error.code = 'InvalidArgument';
  return Promise.reject(error);
}

function invalidResponse(name) {
  const error = new Error(`${name} returned an invalid response`);
  error.code = 'InvalidResponse';
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

function mockNote(title, tag, body) {
  return {
    id: `note-mock-${nextMockNoteId++}`,
    title: title.trim(),
    tag: tag || 'Draft',
    updated: 'Just now',
    body
  };
}

function validateQuizId(id) {
  if (typeof id !== 'string' || id.length === 0) {
    return 'quiz id is required';
  }
  if (id.length > 200) return 'quiz id is too long';
  return null;
}

function validateCollectionFields(title, description, tone, level) {
  if (typeof title !== 'string' || title.trim().length === 0) {
    return 'collection title is required';
  }
  if (title.length > 200) return 'collection title is too long';
  if (typeof description !== 'string' || description.length > 20000) {
    return 'collection description is too long';
  }
  if (typeof tone !== 'string' || tone.length > 200) {
    return 'collection tone is too long';
  }
  if (typeof level !== 'string' || level.length > 200) {
    return 'collection level is too long';
  }
  return null;
}

function validateQuestionFields(collectionId, topic, question, answer) {
  const idError = validateQuizId(collectionId);
  if (idError) return idError;
  if (typeof topic !== 'string' || topic.length > 200) {
    return 'question topic is too long';
  }
  if (typeof question !== 'string' || question.trim().length === 0) {
    return 'question text is required';
  }
  if (typeof answer !== 'string' || answer.trim().length === 0) {
    return 'answer text is required';
  }
  if (question.length > 20000 || answer.length > 20000) {
    return 'question text is too long';
  }
  return null;
}

function validateFullQuestionFields(
  id,
  collectionId,
  topic,
  question,
  answer,
  explanation,
  difficulty,
  tagsCsv
) {
  const idError = validateQuizId(id);
  if (idError) return idError;
  const baseError = validateQuestionFields(
    collectionId,
    topic,
    question,
    answer
  );
  if (baseError) return baseError;
  if (typeof explanation !== 'string' || explanation.length > 20000) {
    return 'question explanation is too long';
  }
  if (typeof difficulty !== 'string' || difficulty.length > 64) {
    return 'question difficulty is too long';
  }
  if (typeof tagsCsv !== 'string') return 'question tags are invalid';
  const tags = tagsCsv
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
  if (tags.length > 16) return 'too many question tags';
  if (tags.some((tag) => tag.length > 64)) return 'question tag is too long';
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
    if (name === 'getNotes') {
      result = Promise.resolve(mockNotes.map((note) => ({ ...note })));
    } else if (name === 'createNote') {
      const note = mockNote(...args);
      mockNotes = [...mockNotes, note];
      persistMockNotes();
      result = Promise.resolve({ ...note });
    } else if (name === 'updateNote') {
      const [id, title, tag, body] = args;
      const note = mockNotes.find((item) => item.id === id);
      if (!note) result = Promise.reject(new Error('NoteNotFound'));
      else {
        const updated = {
          ...note,
          title: title.trim(),
          tag: tag || 'Draft',
          body,
          updated: 'Just now'
        };
        mockNotes = mockNotes.map((item) => (item.id === id ? updated : item));
        persistMockNotes();
        result = Promise.resolve({ ...updated });
      }
    } else if (name === 'deleteNote') {
      mockNotes = mockNotes.filter((note) => note.id !== args[0]);
      persistMockNotes();
      result = Promise.resolve(undefined);
    } else if (name === 'savePdf') {
      result = Promise.resolve({ path: `Documents/${args[0]}` });
    } else if (name === 'generatePdf') {
      result = Promise.resolve({ path: `Documents/${args[0]}` });
    } else if (name === 'quizList') {
      result = Promise.resolve(mockQuizCollections.map(cloneQuizCollection));
    } else if (name === 'quizCreateCollection') {
      const collection = mockQuizCollection(...args);
      mockQuizCollections = [...mockQuizCollections, collection];
      persistMockQuizCollections();
      result = Promise.resolve(cloneQuizCollection(collection));
    } else if (name === 'quizUpdateCollection') {
      const [id, title, description] = args;
      const found = mockQuizCollections.find((item) => item.id === id);
      if (!found) result = Promise.reject(new Error('QuizNotFound'));
      else {
        const updated = { ...found, title: title.trim(), description };
        mockQuizCollections = mockQuizCollections.map((item) =>
          item.id === id ? updated : item
        );
        persistMockQuizCollections();
        result = Promise.resolve(cloneQuizCollection(updated));
      }
    } else if (name === 'quizDeleteCollection') {
      const found = mockQuizCollections.some(
        (collection) => collection.id === args[0]
      );
      if (!found) result = Promise.reject(new Error('QuizNotFound'));
      else {
        mockQuizCollections = mockQuizCollections.filter(
          (collection) => collection.id !== args[0]
        );
        persistMockQuizCollections();
        result = Promise.resolve(undefined);
      }
    } else if (name === 'quizCreateQuestion') {
      const [collectionId, topic, question, answer] = args;
      const collection = mockQuizCollections.find(
        (item) => item.id === collectionId
      );
      if (!collection) result = Promise.reject(new Error('QuizNotFound'));
      else {
        const created = mockQuizQuestion(topic, question, answer);
        collection.questions = [...collection.questions, created];
        persistMockQuizCollections();
        result = Promise.resolve({ ...created, tags: [...created.tags] });
      }
    } else if (name === 'quizUpdateQuestion') {
      const [
        collectionId,
        id,
        topic,
        question,
        answer,
        explanation,
        difficulty,
        tagsCsv
      ] = args;
      const collection = mockQuizCollections.find(
        (item) => item.id === collectionId
      );
      const found = collection?.questions.find((item) => item.id === id);
      if (!found) result = Promise.reject(new Error('QuizNotFound'));
      else {
        const updated = {
          ...found,
          topic,
          question,
          answer,
          explanation,
          difficulty,
          tags: parseCsvTags(tagsCsv)
        };
        collection.questions = collection.questions.map((item) =>
          item.id === id ? updated : item
        );
        persistMockQuizCollections();
        result = Promise.resolve({ ...updated, tags: [...updated.tags] });
      }
    } else if (name === 'quizDeleteQuestion') {
      const [collectionId, id] = args;
      const collection = mockQuizCollections.find(
        (item) => item.id === collectionId
      );
      const found = collection?.questions.some((item) => item.id === id);
      if (!found) result = Promise.reject(new Error('QuizNotFound'));
      else {
        collection.questions = collection.questions.filter(
          (item) => item.id !== id
        );
        persistMockQuizCollections();
        result = Promise.resolve(undefined);
      }
    } else if (name === 'quizExport') {
      const collection = mockQuizCollections.find(
        (item) => item.id === args[0]
      );
      if (!collection) result = Promise.reject(new Error('QuizNotFound'));
      else {
        const data = JSON.stringify(collection);
        result = Promise.resolve({
          path: `Downloads/quiz-${collection.title || 'collection'}.json`,
          size: data.length
        });
      }
    } else if (name === 'quizImport') {
      try {
        const imported = parseQuizCollection(JSON.parse(args[0]));
        if (!imported) throw new Error('InvalidArgument');
        const collection = {
          ...imported,
          id: `quiz-mock-col-${nextMockQuizId++}`,
          questions: imported.questions.map((question) => ({
            ...question,
            id: `quiz-mock-q-${nextMockQuizId++}`
          }))
        };
        mockQuizCollections = [...mockQuizCollections, collection];
        persistMockQuizCollections();
        result = Promise.resolve(cloneQuizCollection(collection));
      } catch (error) {
        result = Promise.reject(error);
      }
    } else if (name === 'mirAnalyze') {
      const [samples, sampleRate] = args;
      const invalid = validateMirInput(samples, sampleRate);
      if (invalid) result = Promise.reject(new Error('InvalidArgument'));
      else result = Promise.resolve(analyzeSamples(samples, sampleRate));
    } else if (name === 'listVolumes') {
      result = Promise.resolve([
        {
          id: 'projects',
          name: 'Blender Projects',
          path: '~/projects',
          kind: 'blender'
        },
        {
          id: 'samples',
          name: 'Sample Library',
          path: '~/samples',
          kind: 'audio'
        },
        { id: 'renders', name: 'Renders', path: '~/renders', kind: 'render' }
      ]);
    } else if (name === 'startAssetScan') {
      const [volumeId] = args;
      if (typeof volumeId !== 'string' || !volumeId.trim()) {
        result = Promise.reject(new Error('InvalidArgument'));
      } else {
        result = Promise.resolve({
          id: `scan-mock-${Date.now()}`,
          volumeId,
          state: 'completed',
          scannedFiles: 0,
          scannedBytes: 0,
          blender: 0,
          audio: 0,
          render: 0,
          other: 0,
          truncated: false
        });
      }
    } else if (name === 'getAssetScanStatus') {
      const [jobId] = args;
      if (typeof jobId !== 'string' || !jobId) {
        result = Promise.reject(new Error('InvalidArgument'));
      } else {
        result = Promise.resolve({
          id: jobId,
          volumeId: 'samples',
          state: 'completed',
          scannedFiles: 0,
          scannedBytes: 0,
          blender: 0,
          audio: 0,
          render: 0,
          other: 0,
          truncated: false
        });
      }
    } else if (name === 'cancelAssetScan') {
      result = Promise.resolve({
        id: args[0],
        volumeId: 'samples',
        state: 'cancelled',
        progress: 0,
        scannedFiles: 0,
        scannedBytes: 0,
        blender: 0,
        audio: 0,
        render: 0,
        other: 0,
        truncated: false
      });
    } else if (name === 'getAudioMetadata') {
      const [path] = args;
      if (typeof path !== 'string' || !path.trim()) {
        result = Promise.reject(new Error('InvalidArgument'));
      } else {
        const format = String(path.split('.').pop() || '').toLowerCase();
        result = Promise.resolve({
          path,
          format,
          durationSec: 0,
          sampleRate: 0,
          channels: 0,
          sizeBytes: 0,
          measured: false
        });
      }
    } else if (name === 'analyzeAudio') {
      result = Promise.reject(new Error('UnsupportedAudioFormat'));
    } else if (name === 'startAudioAnalysis') {
      result = Promise.resolve({
        id: `audio-mock-${Date.now()}`,
        path: args[0],
        state: 'completed',
        progress: 1,
        message: 'Mock analysis',
        format: 'wav',
        durationSec: 0,
        sampleRate: 0,
        channels: 0,
        sizeBytes: 0,
        sampleCount: 0,
        rms: 0,
        peak: 0,
        zcr: 0,
        measured: false
      });
    } else if (name === 'getAudioAnalysisStatus') {
      result = Promise.reject(new Error('AudioJobNotFound'));
    } else if (name === 'cancelAudioAnalysis') {
      result = Promise.reject(new Error('AudioJobNotFound'));
    } else if (name === 'inspectMedia') {
      result = Promise.resolve({
        path: args[0],
        kind: 'MarkdownText',
        mime: 'text/markdown',
        extension: '.md',
        size: 0,
        width: null,
        height: null
      });
    } else if (name === 'markdownToHtml') {
      result = Promise.resolve('<h1>Browser mock</h1>');
    } else if (name === 'readText') {
      result = Promise.resolve('Browser mock text');
    } else if (name === 'writeText') {
      result = Promise.resolve({
        path: args[0],
        size: String(args[1] || '').length
      });
    } else if (name === 'planConversion') {
      result = Promise.resolve({
        input: args[0],
        output: args[1],
        sourceKind: 'MarkdownText',
        targetKind: 'HTMLDocument',
        backend: 'julia',
        requiresExternalTool: false,
        lossiness: 'format_dependent'
      });
    } else if (name === 'convertMedia') {
      result = Promise.resolve({
        output: args[1],
        backend: 'julia',
        sourceKind: 'MarkdownText',
        targetKind: 'HTMLDocument',
        bytesWritten: 0,
        warnings: []
      });
    } else if (name === 'getMediaCapabilities') {
      result = Promise.resolve({ backend: {}, tools: {} });
    } else if (name === 'htmlToText') {
      result = Promise.resolve(String(args[0] || '').replace(/<[^>]+>/g, ''));
    } else if (name === 'parseBibTeX') {
      result = Promise.resolve([]);
    } else if (name === 'inspectBlend') {
      result = Promise.reject(new Error('Unavailable'));
    } else {
      result = Promise.resolve(mockValue(name));
    }
  }
  return withTimeout(result, name, defaultTimeoutMs);
}

const CORE_BINDINGS = [
  'increment',
  'reset',
  'getSystemInfo',
  'getTimestamp',
  'getStatus',
  'getNotes',
  'createNote',
  'updateNote',
  'deleteNote',
  'savePdf',
  'quizList',
  'quizCreateCollection',
  'quizUpdateCollection',
  'quizDeleteCollection',
  'quizCreateQuestion',
  'quizUpdateQuestion',
  'quizDeleteQuestion',
  'quizExport',
  'quizImport',
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
  'inspectBlend',
  'generatePdf',
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
  quizList: () =>
    parsedBinding('quizList', callBinding('quizList'), parseQuizCollectionList),
  quizCreateCollection: (title, description, tone, level) => {
    const validationError = validateCollectionFields(
      title,
      description,
      tone,
      level
    );
    return validationError
      ? invalidArgument(validationError)
      : callBinding('quizCreateCollection', title, description, tone, level);
  },
  quizUpdateCollection: (id, title, description) => {
    const idError = validateQuizId(id);
    if (idError) return invalidArgument(idError);
    const validationError = validateCollectionFields(
      title,
      description,
      '',
      ''
    );
    if (validationError) return invalidArgument(validationError);
    return callBinding('quizUpdateCollection', id, title, description);
  },
  quizDeleteCollection: (id) => {
    const idError = validateQuizId(id);
    return idError
      ? invalidArgument(idError)
      : callBinding('quizDeleteCollection', id);
  },
  quizCreateQuestion: (collectionId, topic, question, answer) => {
    const validationError = validateQuestionFields(
      collectionId,
      topic,
      question,
      answer
    );
    return validationError
      ? invalidArgument(validationError)
      : callBinding(
          'quizCreateQuestion',
          collectionId,
          topic,
          question,
          answer
        );
  },
  quizUpdateQuestion: (
    collectionId,
    id,
    topic,
    question,
    answer,
    explanation,
    difficulty,
    tagsCsv
  ) => {
    const validationError = validateFullQuestionFields(
      id,
      collectionId,
      topic,
      question,
      answer,
      explanation,
      difficulty,
      tagsCsv
    );
    return validationError
      ? invalidArgument(validationError)
      : callBinding(
          'quizUpdateQuestion',
          collectionId,
          id,
          topic,
          question,
          answer,
          explanation,
          difficulty,
          tagsCsv
        );
  },
  quizDeleteQuestion: (collectionId, id) => {
    const collectionError = validateQuizId(collectionId);
    if (collectionError) return invalidArgument(collectionError);
    const idError = validateQuizId(id);
    if (idError) return invalidArgument(idError);
    return callBinding('quizDeleteQuestion', collectionId, id);
  },
  quizExport: (collectionId) => {
    const idError = validateQuizId(collectionId);
    return idError
      ? invalidArgument(idError)
      : callBinding('quizExport', collectionId);
  },
  quizImport: (source) => {
    if (typeof source !== 'string' || source.length === 0) {
      return invalidArgument('quiz JSON is required');
    }
    if (source.length > 2 * 1024 * 1024) {
      return invalidArgument('quiz JSON is too large');
    }
    return parsedBinding(
      'quizImport',
      callBinding('quizImport', source),
      parseQuizCollection
    );
  },
  mirAnalyze: (samples, sampleRate) => {
    const invalid =
      validateMirInput(samples, sampleRate) ||
      (samples.length > 262144 ? 'too many audio samples' : null);
    return invalid
      ? invalidArgument(invalid)
      : callBinding('mirAnalyze', [...samples], sampleRate);
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
  analyzeAudio: (path) =>
    typeof path !== 'string' || !path.trim()
      ? invalidArgument('audio path is required')
      : parsedBinding(
          'analyzeAudio',
          callBinding('analyzeAudio', path),
          parseAudioAnalysis
        ),
  startAudioAnalysis: (path) =>
    typeof path !== 'string' || !path.trim()
      ? invalidArgument('audio path is required')
      : parsedBinding(
          'startAudioAnalysis',
          callBinding('startAudioAnalysis', path),
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
  generatePdf: (filename, title, body) =>
    typeof filename !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}\.pdf$/.test(filename) ||
    typeof title !== 'string' ||
    typeof body !== 'string'
      ? invalidArgument('PDF filename, title, or body is invalid')
      : callBinding('generatePdf', filename, title, body),
  minimizeWindow: () => callBinding('minimizeWindow'),
  maximizeWindow: () => callBinding('maximizeWindow'),
  restoreWindow: () => callBinding('restoreWindow'),
  closeWindow: () => callBinding('closeWindow')
};

export function backendErrorWithCode(error) {
  const details = errorDetails(error);
  return `${details.message} (${details.code})`;
}
