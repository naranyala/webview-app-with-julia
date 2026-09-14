// Schema validation tests for `src/schemas.js`: native payloads normalize to
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
  parseMediaConversionJob,
  parseMediaInfo,
  parseMediaWriteResult
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
const mediaContract = {
  schemaVersion: 1,
  provenance: {
    engine: 'StaticMediaCompanion',
    engineVersion: '0.1.0',
    backend: 'julia'
  }
};
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
  parseMediaInfo({ ...mediaContract, path: '/home/a.png', kind: 'ImageData', mime: 'image/png', extension: '.png', size: 12, width: 2, height: 3 })?.height === 3
);
check(
  'media info schema preserves contract provenance',
  parseMediaInfo({ ...mediaContract, path: '/home/a.png', kind: 'ImageData', mime: 'image/png', extension: '.png', size: 12 })?.provenance.backend === 'julia'
);
check(
  'conversion plan schema preserves route',
  parseConversionPlan({ ...mediaContract, input: '/home/a.md', output: '/home/Documents/a.html', backend: 'julia', sourceKind: 'MarkdownText', targetKind: 'HTMLDocument', requiresExternalTool: false, lossiness: 'format_dependent' })?.backend === 'julia'
);
check(
  'conversion result schema clamps warnings',
  parseConversionResult({ output: '/home/Documents/a.html', bytesWritten: 8, warnings: ['notice'] })?.warnings.length === 1
);
check(
  'media conversion job schema preserves a completed result',
  parseMediaConversionJob({
    id: 'job-2', input: '/home/a.md', output: '/home/Documents/a.html',
    state: 'completed', progress: 1,
    result: { output: '/home/Documents/a.html', bytesWritten: 8, warnings: [] }
  })?.result?.bytesWritten === 8
);
check(
  'media write schema requires a path',
  parseMediaWriteResult({ size: 4 }) === null
);
check(
  'media capabilities schema keeps tool flags',
  parseMediaCapabilities({ ...mediaContract, backend: {}, tools: { magick: true, pandoc: false } })?.tools.magick === true
);
if (failures > 0) process.exit(1);
console.log('schemas: all tests passed');
