// Schema validation tests for `src/schemas.js`: quiz payloads normalize to
// safe shapes, invalid entries are dropped, and limits mirror the backend.
// Run: `npm test`. `zig build test` runs it via `npm run test`.
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
  parseQuizQuestion
} from './src/schemas.js';

let failures = 0;

function check(name, condition, extra = '') {
  if (condition) {
    console.log(`ok: ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL: ${name}${extra ? ` (${extra})` : ''}`);
  }
}

const question = {
  id: 'q1',
  topic: 'General',
  question: 'What is Zig?',
  answer: 'A systems language.',
  explanation: 'Low-level control.',
  difficulty: 'Starter',
  tags: ['systems', '', 42, 'x'.repeat(65)]
};
const parsed = parseQuizQuestion(question);
check(
  'question normalizes tags and keeps fields',
  parsed !== null &&
    parsed.topic === 'General' &&
    parsed.tags.length === 1 &&
    parsed.tags[0] === 'systems'
);

const scan = parseAssetScanJob({
  id: 'job-1',
  volumeId: 'home',
  state: 'running',
  progress: 0.4,
  scannedFiles: 4,
  scannedBytes: 10
});
check('scan schema clamps and preserves progress', scan !== null && scan.progress === 0.4 && scan.scannedFiles === 4);
check('scan schema rejects missing ids', parseAssetScanJob({ state: 'running' }) === null);

const metadata = parseAudioMetadata({
  path: '/home/audio.wav',
  format: 'wav',
  durationSec: 2,
  sampleRate: 48000,
  channels: 2,
  sizeBytes: 100,
  measured: true
});
check('audio metadata schema normalizes measured metadata', metadata !== null && metadata.channels === 2);
check(
  'audio analysis schema accepts Julia aliases',
  parseAudioAnalysis({ ...metadata, sample_count: 100, sample_rate: 48000, rms: 0.2, peak: 0.4, zcr: 0.1 })?.sampleCount === 100
);
check(
  'audio job schema accepts running jobs',
  parseAudioAnalysisJob({ id: 'job-1', path: '/home/audio.wav', state: 'running' })?.progress === 0
);
check('status schema keeps degraded state', parseBackendStatus({ status: 'degraded' })?.status === 'degraded');
check(
  'media info schema preserves image dimensions',
  parseMediaInfo({ path: '/home/a.png', kind: 'ImageData', mime: 'image/png', extension: '.png', size: 12, width: 2, height: 3 })?.height === 3
);
check(
  'conversion plan schema preserves route',
  parseConversionPlan({ input: '/home/a.md', output: '/home/Documents/a.html', backend: 'julia', sourceKind: 'MarkdownText', targetKind: 'HTMLDocument', requiresExternalTool: false, lossiness: 'format_dependent' })?.backend === 'julia'
);
check(
  'conversion result schema clamps warnings',
  parseConversionResult({ output: '/home/Documents/a.html', bytesWritten: 8, warnings: ['notice'] })?.warnings.length === 1
);
check(
  'media write schema requires a path',
  parseMediaWriteResult({ size: 4 }) === null
);
check(
  'media capabilities schema keeps tool flags',
  parseMediaCapabilities({ backend: {}, tools: { magick: true, pandoc: false } })?.tools.magick === true
);
check('question rejects empty prompt', parseQuizQuestion({ ...question, question: '  ' }) === null);
check('question rejects missing id', parseQuizQuestion({ ...question, id: '' }) === null);
check('question rejects oversized answer', parseQuizQuestion({ ...question, answer: 'x'.repeat(20001) }) === null);
check('question rejects non-objects', parseQuizQuestion(null) === null);

const collection = {
  id: 'c1',
  title: 'Zig Basics',
  description: 'First deck',
  tone: 'gold',
  level: 'Custom',
  questions: [question, { id: '', question: '', answer: '' }]
};
const parsedCollection = parseQuizCollection(collection);
check(
  'collection fills defaults and drops bad questions',
  parsedCollection !== null &&
    parsedCollection.shortTitle === 'Zig Basics' &&
    parsedCollection.questions.length === 1
);
check(
  'collection rejects empty titles',
  parseQuizCollection({ ...collection, title: '' }) === null
);
check(
  'collection list drops invalid entries',
  parseQuizCollectionList([collection, null, 'junk']).length === 1 &&
    parseQuizCollectionList('junk').length === 0
);

if (failures > 0) process.exit(1);
console.log('schemas: all tests passed');
