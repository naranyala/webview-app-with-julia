import { analyzeSamples, validateMirInput } from './plugins/mir.js';

const MOCK_NOTES_STORAGE_KEY = 'webview-app.chain-notes';

let mockNotes = loadMockNotes();
let mockDiagnostics = [];
let mockSettings = {
  schemaVersion: 1,
  workspace: { roots: [], defaultNotesPath: '' },
  ui: { theme: 'system', sidebarCollapsed: false, fontSize: 14 },
  plugins: { enabled: [], disabled: [] },
  paper: { defaultTemplateId: 'default', recentProjects: [] }
};
const MOCK_MEDIA_CONTRACT = Object.freeze({
  schemaVersion: 1,
  provenance: {
    engine: 'StaticMediaCompanion',
    engineVersion: 'browser-mock',
    backend: 'mock'
  }
});
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

const MOCK_HANDLERS = {
  getNotes: () => Promise.resolve(mockNotes.map((note) => ({ ...note }))),
  getDiagnostics: () =>
    Promise.resolve({
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      logPath: '',
      entries: [...mockDiagnostics]
    }),
  clearDiagnostics: () => {
    mockDiagnostics = [];
    return Promise.resolve({ cleared: true });
  },
  getSettings: () => Promise.resolve(structuredClone(mockSettings)),
  saveSettings: (args) => {
    mockSettings = structuredClone(args[0]);
    return Promise.resolve(structuredClone(mockSettings));
  },
  createNote: (args) => {
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
    return Promise.resolve({ ...note });
  },
  updateNote: (args) => {
    const [id, title, tag, body] = args;
    const note = mockNotes.find((item) => item.id === id);
    if (!note) return Promise.reject(new Error('NoteNotFound'));
    const updated = {
      ...note,
      title: title.trim(),
      tag: tag || 'Draft',
      body,
      updated: 'Just now'
    };
    mockNotes = mockNotes.map((item) => (item.id === id ? updated : item));
    persistMockNotes();
    return Promise.resolve({ ...updated });
  },
  deleteNote: (args) => {
    mockNotes = mockNotes.filter((note) => note.id !== args[0]);
    persistMockNotes();
    return Promise.resolve(undefined);
  },
  savePdf: (args) => Promise.resolve({ path: `Documents/${args[0]}` }),
  generatePdf: (args) => Promise.resolve({ path: `Documents/${args[0]}` }),
  mirAnalyze: (args) => {
    const [samples, sampleRate] = args;
    const invalid = validateMirInput(samples, sampleRate);
    if (invalid) return Promise.reject(new Error('InvalidArgument'));
    return Promise.resolve(analyzeSamples(samples, sampleRate));
  },
  listVolumes: () =>
    Promise.resolve([
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
    ]),
  startAssetScan: (args) =>
    Promise.resolve({
      id: `scan-mock-${Date.now()}`,
      volumeId: args[0],
      state: 'completed',
      scannedFiles: 0,
      scannedBytes: 0,
      blender: 0,
      audio: 0,
      render: 0,
      other: 0,
      truncated: false
    }),
  getAssetScanStatus: (args) =>
    Promise.resolve({
      id: args[0],
      volumeId: 'samples',
      state: 'completed',
      scannedFiles: 0,
      scannedBytes: 0,
      blender: 0,
      audio: 0,
      render: 0,
      other: 0,
      truncated: false
    }),
  cancelAssetScan: (args) =>
    Promise.resolve({
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
    }),
  getAudioMetadata: (args) => {
    const [path] = args;
    const format = String(path.split('.').pop() || '').toLowerCase();
    return Promise.resolve({
      path,
      format,
      durationSec: 0,
      sampleRate: 0,
      channels: 0,
      sizeBytes: 0,
      measured: false
    });
  },
  analyzeAudio: () => Promise.reject(new Error('UnsupportedAudioFormat')),
  startAudioAnalysis: (args) =>
    Promise.resolve({
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
    }),
  getAudioAnalysisStatus: () => Promise.reject(new Error('AudioJobNotFound')),
  cancelAudioAnalysis: () => Promise.reject(new Error('AudioJobNotFound')),
  inspectMedia: (args) =>
    Promise.resolve({
      ...MOCK_MEDIA_CONTRACT,
      path: args[0],
      kind: 'MarkdownText',
      mime: 'text/markdown',
      extension: '.md',
      size: 0,
      width: null,
      height: null
    }),
  markdownToHtml: () => Promise.resolve('<h1>Browser mock</h1>'),
  readText: () => Promise.resolve('Browser mock text'),
  writeText: (args) =>
    Promise.resolve({
      path: args[0],
      size: String(args[1] || '').length
    }),
  planConversion: (args) =>
    Promise.resolve({
      ...MOCK_MEDIA_CONTRACT,
      input: args[0],
      output: args[1],
      sourceKind: 'MarkdownText',
      targetKind: 'HTMLDocument',
      backend: 'julia',
      requiresExternalTool: false,
      lossiness: 'format_dependent'
    }),
  convertMedia: (args) =>
    Promise.resolve({
      ...MOCK_MEDIA_CONTRACT,
      output: args[1],
      backend: 'julia',
      sourceKind: 'MarkdownText',
      targetKind: 'HTMLDocument',
      bytesWritten: 0,
      warnings: []
    }),
  startMediaConversion: (args) =>
    Promise.resolve({
      ...MOCK_MEDIA_CONTRACT,
      id: `media-mock-${Date.now()}`,
      input: args[0],
      output: args[1],
      state: 'completed',
      progress: 1,
      message: 'Mock conversion',
      result: {
        ...MOCK_MEDIA_CONTRACT,
        output: args[1],
        backend: 'julia',
        sourceKind: 'MarkdownText',
        targetKind: 'HTMLDocument',
        bytesWritten: 0,
        warnings: []
      }
    }),
  getMediaConversionStatus: () => Promise.reject(new Error('MediaJobNotFound')),
  cancelMediaConversion: () => Promise.reject(new Error('MediaJobNotFound')),
  getMediaCapabilities: () =>
    Promise.resolve({
      ...MOCK_MEDIA_CONTRACT,
      backend: { mode: 'mock' },
      tools: {}
    }),
  htmlToText: (args) =>
    Promise.resolve(String(args[0] || '').replace(/<[^>]+>/g, '')),
  parseBibTeX: () => Promise.resolve([]),
  inspectBlend: () => Promise.reject(new Error('Unavailable')),
  listDirectory: (args) => {
    const [dirPath, options] = args;
    const mockEntries = [
      {
        name: 'Documents',
        path: `${dirPath}/Documents`,
        isDir: true,
        size: 0,
        modified: new Date().toISOString()
      },
      {
        name: 'readme.md',
        path: `${dirPath}/readme.md`,
        isDir: false,
        size: 2048,
        modified: new Date().toISOString()
      },
      {
        name: 'notes.txt',
        path: `${dirPath}/notes.txt`,
        isDir: false,
        size: 512,
        modified: new Date().toISOString()
      },
      {
        name: 'image.png',
        path: `${dirPath}/image.png`,
        isDir: false,
        size: 8192,
        modified: new Date().toISOString()
      },
      {
        name: 'data.csv',
        path: `${dirPath}/data.csv`,
        isDir: false,
        size: 4096,
        modified: new Date().toISOString()
      }
    ];
    let entries = mockEntries;
    if (options?.extensions?.length) {
      const exts = new Set(options.extensions.map((e) => e.toLowerCase()));
      entries = entries.filter(
        (e) => e.isDir || exts.has(e.name.split('.').pop())
      );
    }
    return Promise.resolve({
      path: dirPath,
      entries,
      count: entries.length,
      truncated: false
    });
  }
};

export function mockBinding(name, args) {
  const handler = MOCK_HANDLERS[name];
  if (handler) return handler(args);
  return Promise.resolve(mockValue(name));
}
