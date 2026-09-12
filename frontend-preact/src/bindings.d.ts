/**
 * Julia backend bindings available as `window.*` inside the native WebView.
 * See `src/Backend.jl` in the Julia project.
 * Under `npm run dev` these fall back to mocks via `src/backend.js`.
 */
declare global {
  interface Window {
    increment(delta: number): Promise<number>;
    reset(): Promise<number>;
    getSystemInfo(): Promise<string>;
    getTimestamp(): Promise<string>;
    getStatus(): Promise<BackendStatus>;
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
    quizExport(collectionId: string): Promise<SaveResult>;
    quizImport(source: string): Promise<QuizCollection>;
    mirAnalyze(samples: number[], sampleRate: number): Promise<MirFeatures>;
    listVolumes(): Promise<StudioVolume[]>;
    startAssetScan(volumeId: string): Promise<AssetScanJob>;
    getAssetScanStatus(jobId: string): Promise<AssetScanJob>;
    cancelAssetScan(jobId: string): Promise<AssetScanJob>;
    getAudioMetadata(path: string): Promise<AudioMetadata>;
    analyzeAudio(path: string): Promise<AudioAnalysis>;
    startAudioAnalysis(path: string): Promise<AudioAnalysisJob>;
    getAudioAnalysisStatus(jobId: string): Promise<AudioAnalysisJob>;
    cancelAudioAnalysis(jobId: string): Promise<AudioAnalysisJob>;
    /** Optional StaticMediaCompanion-backed capabilities. */
    inspectMedia(path: string): Promise<MediaInfo>;
    markdownToHtml(content: string): Promise<string>;
    readText(path: string): Promise<string>;
    writeText(path: string, content: string): Promise<SaveResult>;
    planConversion(input: string, output: string): Promise<ConversionPlan>;
    convertMedia(input: string, output: string): Promise<ConversionResult>;
    getMediaCapabilities(): Promise<MediaCapabilities>;
    htmlToText(html: string): Promise<string>;
    parseBibTeX(source: string): Promise<BibEntry[]>;
    inspectBlend(path: string): Promise<BlendHeader>;
    generatePdf(filename: string, title: string, body: string): Promise<SaveResult>;
    minimizeWindow(): Promise<void>;
    maximizeWindow(): Promise<void>;
    restoreWindow(): Promise<void>;
    closeWindow(): Promise<void>;
    /** Set false in tests to prove the UI requires real native bindings. */
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
  size?: number;
}

interface MediaInfo {
  path: string;
  kind: string;
  mime: string;
  extension: string;
  size: number;
  width: number | null;
  height: number | null;
}

interface ConversionPlan {
  input: string;
  output: string;
  sourceKind: string;
  targetKind: string;
  backend: string;
  requiresExternalTool: boolean;
  lossiness: string;
}

interface ConversionResult {
  output: string;
  backend: string;
  sourceKind: string;
  targetKind: string;
  bytesWritten: number;
  warnings: string[];
}

interface MediaCapabilities {
  backend: Record<string, unknown>;
  tools: Record<string, boolean>;
}

interface MirFeatures {
  rms: number;
  peak: number;
  zcr: number;
  sample_count: number;
  sample_rate: number;
  duration_seconds: number;
  /** Version of the JSON feature contract, not the Aural package version. */
  analysisSchema?: number;
  /** Named analysis settings used to produce this summary. */
  analysisProfile?: string;
  /** How source channels were reduced for the summary. */
  channelPolicy?: string;
  /** Processing engine provenance, currently Aural for native jobs. */
  engine?: string;
}

interface BackendStatus {
  status: 'ok' | 'degraded' | 'unavailable';
  features?: number;
  availableFeatures?: number;
  storage?: { status: string };
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
  progress: number;
  message?: string;
  scannedFiles: number;
  scannedBytes: number;
  blender: number;
  audio: number;
  render: number;
  other: number;
  truncated: boolean;
  topFolders?: Array<{ name: string; bytes: number }>;
  error?: string;
}

interface AudioMetadata {
  path: string;
  format: string;
  durationSec: number;
  sampleRate: number;
  channels: number;
  sizeBytes: number;
  measured: boolean;
  engine?: string;
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
  partial?: boolean;
  analysisSchema?: number;
  analysisProfile?: string;
  channelPolicy?: string;
  engine?: string;
}

interface AudioAnalysisJob {
  id: string;
  path: string;
  state: string;
  progress: number;
  message?: string;
  error?: string;
  format?: string;
  durationSec?: number;
  sampleRate?: number;
  channels?: number;
  sizeBytes?: number;
  sampleCount?: number;
  rms?: number;
  peak?: number;
  zcr?: number;
  measured?: boolean;
}

interface BibEntry {
  type: string;
  key: string;
  fields: Record<string, string>;
}

interface BlendHeader {
  path: string;
  pointerSize: number;
  byteOrder: string;
  version: string;
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
