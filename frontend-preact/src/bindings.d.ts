/**
 * Zig backend bindings available as `window.*` inside the native WebView.
 * See `src/main.zig` + `src/backend/core_plugin.zig`.
 * Under `npm run dev` these fall back to mocks via `src/backend.js`.
 */
declare global {
  interface Window {
    increment(delta: number): Promise<number>;
    reset(): Promise<number>;
    getSystemInfo(): Promise<string>;
    getTimestamp(): Promise<string>;
    getStatus(): Promise<string>;
    getNotes(): Promise<Note[]>;
    createNote(title: string, tag: string, body: string): Promise<Note>;
    updateNote(
      id: string,
      title: string,
      tag: string,
      body: string
    ): Promise<Note>;
    deleteNote(id: string): Promise<void>;
    savePdf(filename: string, dataBase64: string): Promise<SaveResult>;
    quizList(): Promise<QuizCollection[]>;
    quizCreateCollection(
      title: string,
      description: string,
      tone: string,
      level: string
    ): Promise<QuizCollection>;
    quizUpdateCollection(
      id: string,
      title: string,
      description: string
    ): Promise<QuizCollection>;
    quizDeleteCollection(id: string): Promise<void>;
    quizCreateQuestion(
      collectionId: string,
      topic: string,
      question: string,
      answer: string
    ): Promise<QuizQuestion>;
    quizUpdateQuestion(
      collectionId: string,
      id: string,
      topic: string,
      question: string,
      answer: string,
      explanation: string,
      difficulty: string,
      tagsCsv: string
    ): Promise<QuizQuestion>;
    quizDeleteQuestion(collectionId: string, id: string): Promise<void>;
    mirAnalyze(samples: number[], sampleRate: number): Promise<MirFeatures>;
    listVolumes(): Promise<StudioVolume[]>;
    startAssetScan(volumeId: string): Promise<AssetScanJob>;
    getAssetScanStatus(jobId: string): Promise<AssetScanJob>;
    cancelAssetScan(jobId: string): Promise<string>;
    getAudioMetadata(path: string): Promise<AudioMetadata>;
    analyzeAudio(path: string): Promise<AudioAnalysis>;
    minimizeWindow(): Promise<void>;
    maximizeWindow(): Promise<void>;
    restoreWindow(): Promise<void>;
    closeWindow(): Promise<void>;
    __PREACT_MOCK_BRIDGE__?: boolean;
  }
}

interface Note {
  id: string;
  title: string;
  tag: string;
  updated: string;
  body: string;
}

interface SaveResult {
  path: string;
}

interface MirFeatures {
  rms: number;
  peak: number;
  zcr: number;
  sample_count: number;
  sample_rate: number;
  duration_seconds: number;
}

interface StudioVolume {
  id: string;
  name: string;
  path: string;
  kind: string;
}

interface AssetScanJob {
  id: string;
  volumeId: string;
  state: string;
  scannedFiles: number;
  scannedBytes: number;
  blender: number;
  audio: number;
  render: number;
  other: number;
  truncated: boolean;
}

interface AudioMetadata {
  path: string;
  format: string;
  durationSec: number;
  sampleRate: number;
  channels: number;
  sizeBytes: number;
  measured: boolean;
}

interface AudioAnalysis {
  path: string;
  format: string;
  durationSec: number;
  sampleRate: number;
  channels: number;
  sampleCount: number;
  rms: number;
  peak: number;
  zcr: number;
  measured: boolean;
}

interface QuizQuestion {
  id: string;
  topic: string;
  question: string;
  answer: string;
  explanation: string;
  difficulty: string;
  tags: string[];
}

interface QuizCollection {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  tone: string;
  icon: string;
  level: string;
  questions: QuizQuestion[];
}

export {};
