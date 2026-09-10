// Studio asset helper tests (ported from the vlang sibling's
// `assets.test.mjs`, adapted to this codebase's `check-*.mjs` suite style).
// Run: `npm test`. `zig build test` runs it via `npm run test`.
import {
  advanceAssetScanJob,
  classifyAsset,
  completeAssetScanJob,
  createAssetScanJob,
  parseAssetRecords,
  summarizeAssets
} from './src/plugins/assets.mjs';

let failures = 0;
function check(name, condition, extra = '') {
  if (condition) console.log(`ok: ${name}`);
  else {
    failures += 1;
    console.error(`FAIL: ${name}${extra ? ` (${extra})` : ''}`);
  }
}

check('blend classifies as blender', classifyAsset('scene.blend') === 'blender');
check('blend1 classifies as blender', classifyAsset('auto.blend1') === 'blender');
check('wav classifies as audio', classifyAsset('LOOP.WAV') === 'audio');
check('exr classifies as render', classifyAsset('frame0001.exr') === 'render');
check('txt classifies as other', classifyAsset('notes.txt') === 'other');

const records = parseAssetRecords([
  { path: '/s/kick.wav', size: 4000 },
  { path: '/s/scene.blend', kind: 'blender', size: 8000 },
  { id: '', path: '', size: 1 },
  null
]);
check('records drop empties', records.length === 2);
check('records infer kind', records[0].kind === 'audio');

const summary = summarizeAssets(records);
check('summary counts kinds', summary.audio === 1 && summary.blender === 1);
check('summary totals bytes', summary.bytes === 12000);

let job = createAssetScanJob('samples');
check('job starts queued', job.state === 'queued');
job = advanceAssetScanJob(job, records);
check('job accumulates files', job.scannedFiles === 2);
check('job tracks largest first', job.topEntries[0].path === '/s/scene.blend');
job = completeAssetScanJob(job);
check('job completes', job.state === 'completed');

if (failures > 0) {
  console.error(`${failures} asset test(s) failed`);
  process.exit(1);
}
console.log('studio assets: all tests passed');
