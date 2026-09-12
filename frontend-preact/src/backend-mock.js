import { analyzeSamples, validateMirInput } from './plugins/mir.js';
import { parseQuizCollection, parseQuizCollectionList } from './schemas.js';

const MOCK_NOTES_STORAGE_KEY = 'webview-app.chain-notes';
const MOCK_QUIZ_STORAGE_KEY = 'webview-app.quiz-collections';

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

export function mockBinding(name, args) {
  let result;
  if (name === 'getNotes') {
    result = Promise.resolve(mockNotes.map((note) => ({ ...note })));
  } else if (name === 'createNote') {
    const [title, tag, body] = args;
    const note = {
      id: `note-mock-${nextMockNoteId++}`,
      title: title.trim(),
      tag: tag || 'Draft',
      updated: 'Just now',
      body
    };
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
  } else if (name === 'savePdf' || name === 'generatePdf') {
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
    const collection = mockQuizCollections.find((item) => item.id === args[0]);
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
  } else if (name === 'getAssetScanStatus') {
    const [jobId] = args;
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
  } else if (
    name === 'getAudioAnalysisStatus' ||
    name === 'cancelAudioAnalysis'
  ) {
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
  return result;
}
