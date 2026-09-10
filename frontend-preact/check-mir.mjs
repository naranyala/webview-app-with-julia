// MIR lab tests: shared JS feature math plus the native/mirror bridge.
// Run: `npm test`. `zig build test` runs it via `npm run test`.
import { backend } from './src/backend.js';
import {
  analyzeSamples,
  describeFeatures,
  formatDuration,
  formatTempo,
  mixSimilarity,
  parseAudioFeatures,
  validateMirInput,
  windowSamples
} from './src/plugins/mir.js';

let failures = 0;
function check(name, condition, extra = '') {
  if (condition) console.log(`ok: ${name}`);
  else {
    failures += 1;
    console.error(`FAIL: ${name}${extra ? ` (${extra})` : ''}`);
  }
}

check('silence has zero energy', analyzeSamples([0, 0, 0, 0], 48000).rms === 0);
check(
  'dc maps to rms and peak',
  Math.abs(analyzeSamples([0.5, 0.5, 0.5, 0.5], 44100).rms - 0.5) < 1e-6
);
check(
  'alternating polarity maximizes zcr',
  Math.abs(analyzeSamples([1, -1, 1, -1], 48000).zcr - 1) < 1e-6
);
check('empty window rejected', validateMirInput([], 48000) !== null);
check('bad rate rejected', validateMirInput([0.1], 0) !== null);
check(
  'long buffer windowed to native limit',
  windowSamples(new Array(300000).fill(0)).length <= 262144
);
check(
  'features describe in words',
  describeFeatures({ rms: 0.4, peak: 0.9, zcr: 0.5 }).includes('hot')
);

const previous = globalThis.window;
globalThis.window = {};
try {
  const features = await backend.mirAnalyze([0.5, -0.5, 0.5], 48000);
  check('mirror bridge returns rms', features.rms > 0);
  check('mirror bridge keeps rate', features.sample_rate === 48000);
  try {
    await backend.mirAnalyze([], 48000);
    check('mirror bridge rejects empty', false);
  } catch {
    check('mirror bridge rejects empty', true);
  }
} finally {
  if (previous === undefined) delete globalThis.window;
  else globalThis.window = previous;
}

check(
  'feature document parses',
  parseAudioFeatures({
    tempo: 124,
    key: 'A minor',
    durationSec: 142
  })?.tempo === 124
);
check('feature document rejects junk', parseAudioFeatures(null) === null);
check(
  'tempo formats with key',
  formatTempo({ tempo: 124.4, key: 'A minor' }) === '124 BPM · A minor'
);
check('duration formats as minutes', formatDuration(142) === '2:22');
check(
  'identical mixes score one',
  mixSimilarity({ tempo: 120, key: 'C' }, { tempo: 120, key: 'C' }) === 1
);
check(
  'distant mixes score lower',
  mixSimilarity({ tempo: 80, key: 'C' }, { tempo: 160, key: 'G' }) < 0.5
);

if (failures > 0) {
  console.error(`${failures} mir test(s) failed`);
  process.exit(1);
}
console.log('mir lab: all tests passed');
