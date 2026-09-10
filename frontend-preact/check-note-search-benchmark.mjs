// Automated form of `npm run benchmark:notes`: creates a small deterministic
// corpus, checks typo recall for every engine, and asserts the production
// engine (fuzzysort) stays faster than Fuse.js on this workload.
// Run: `npm test`. `zig build test` runs it via `npm run test`.
import {
  benchmarkEngine,
  createBenchmarkSearcher,
  makeBenchmarkNotes
} from './benchmark-notes-search.mjs';

let failures = 0;

function check(name, condition, extra = '') {
  if (condition) {
    console.log(`ok: ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL: ${name}${extra ? ` (${extra})` : ''}`);
  }
}

const notes = makeBenchmarkNotes(300);
check('benchmark corpus has 300 notes', notes.length === 300);

const typoResults = {};
for (const engineId of ['fuse', 'fuzzysort', 'fast-fuzzy', 'substring']) {
  const searcher = createBenchmarkSearcher(notes, engineId);
  check(
    `${engineId} empty query returns all`,
    searcher.search('').length === 300
  );
  typoResults[engineId] = searcher.search('persistnce').length;
}

check(
  'fuzzy engines recall typo the baseline misses',
  typoResults.substring === 0 &&
    typoResults.fuse > 0 &&
    typoResults.fuzzysort > 0 &&
    typoResults['fast-fuzzy'] > 0,
  JSON.stringify(typoResults)
);

const fuse = benchmarkEngine(notes, 'fuse', { iterations: 10, warmup: 2 });
const fuzzysort = benchmarkEngine(notes, 'fuzzysort', {
  iterations: 10,
  warmup: 2
});
console.log(
  `benchmark: fuse avg ${fuse.averageMs.toFixed(2)}ms, fuzzysort avg ${fuzzysort.averageMs.toFixed(2)}ms`
);
check(
  'fuzzysort stays faster than fuse',
  fuzzysort.averageMs < fuse.averageMs,
  `fuzzysort=${fuzzysort.averageMs.toFixed(2)} fuse=${fuse.averageMs.toFixed(2)}`
);
check('fuzzysort avg under 50ms', fuzzysort.averageMs < 50);

if (failures > 0) process.exit(1);
console.log('note search benchmark: all tests passed');
