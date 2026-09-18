import { performance } from 'node:perf_hooks';
import { Searcher as FastFuzzySearcher } from 'fast-fuzzy';
import Fuse from 'fuse.js';
import fuzzysort from 'fuzzysort';

const NOTE_COUNT = 1200;
const ITERATIONS = 20;
const WARMUP = 5;

const ENGINES = [
  { id: 'fuse', label: 'Fuse.js' },
  { id: 'fuzzysort', label: 'fuzzysort' },
  { id: 'fast-fuzzy', label: 'fast-fuzzy' },
  { id: 'substring', label: 'Exact' }
];

const topics = [
  [
    'Local persistence',
    'storage',
    'How should notes survive a restart?',
    'Use an atomic local JSON file.'
  ],
  [
    'Atomic writes',
    'backend',
    'Why write a temporary state file first?',
    'A rename prevents partial state from being read.'
  ],
  [
    'Question parsing',
    'ai-chat',
    'How can an external AI answer be saved?',
    'Split the exchange into question and answer fields.'
  ],
  [
    'Search ranking',
    'frontend',
    'What makes fuzzy search useful?',
    'It tolerates typos while ranking close matches first.'
  ],
  [
    'WebView startup',
    'native',
    'How should the desktop shell check health?',
    'Expose a small status RPC before opening a workspace.'
  ],
  [
    'Blender rendering',
    'reference',
    'Which render engine should I choose?',
    'Use Eevee for speed and Cycles for physically based output.'
  ],
  [
    'Audio buffers',
    'reference',
    'What does a smaller audio buffer change?',
    'It lowers latency but leaves less room for scheduling jitter.'
  ],
  [
    'Schema migrations',
    'storage',
    'How should old note records be loaded?',
    'Read the version and migrate known fields without data loss.'
  ]
];
// Single-token omission typos keep every engine selective and comparable.
const queries = [
  'persistnce',
  'writs',
  'parsng',
  'serch',
  'helth',
  'rendring',
  'latncy',
  'migraton'
];

export function makeBenchmarkNotes(count = NOTE_COUNT) {
  return Array.from({ length: count }, (_, index) => {
    const topic = topics[index % topics.length];
    return {
      id: `note-benchmark-${index}`,
      title: `${topic[0]} ${index + 1}`,
      tag: topic[1],
      updated: 'Just now',
      body: `Question:\n${topic[2]}\n\nAnswer:\n${topic[3]} Local context ${index}.`
    };
  });
}

export function createBenchmarkSearcher(notes, engineId) {
  const source = Array.isArray(notes) ? notes : [];
  if (engineId === 'substring') {
    return {
      search: (query) =>
        query.trim()
          ? source.filter((note) =>
              `${note.title} ${note.tag} ${note.body}`
                .toLowerCase()
                .includes(query.trim().toLowerCase())
            )
          : source
    };
  }
  if (engineId === 'fuzzysort') {
    const index = fuzzysort.snapshot(source, {
      keys: ['title', 'tag', 'body']
    });
    return {
      search: (query) =>
        query.trim()
          ? fuzzysort
              .go(query.trim(), index, { threshold: 0.3, limit: 100 })
              .map((result) => result.obj)
          : source
    };
  }
  if (engineId === 'fast-fuzzy') {
    const index = new FastFuzzySearcher(source, {
      keySelector: (note) => [note.title, note.tag, note.body],
      threshold: 0.7,
      sortBy: 'bestMatch'
    });
    return {
      search: (query) => (query.trim() ? index.search(query.trim()) : source)
    };
  }
  const index = new Fuse(source, {
    includeScore: true,
    ignoreLocation: true,
    minMatchCharLength: 2,
    threshold: 0.35,
    keys: [
      { name: 'title', weight: 0.45 },
      { name: 'tag', weight: 0.15 },
      { name: 'body', weight: 0.4 }
    ]
  });
  return {
    search: (query) =>
      query.trim()
        ? index.search(query.trim()).map((result) => result.item)
        : source
  };
}

function percentile(values, percentage) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[
    Math.min(sorted.length - 1, Math.floor(sorted.length * percentage))
  ];
}

export function benchmarkEngine(
  notes,
  engineId,
  { iterations = ITERATIONS, warmup = WARMUP } = {}
) {
  const indexStart = performance.now();
  const searcher = createBenchmarkSearcher(notes, engineId);
  const indexMs = performance.now() - indexStart;

  for (let index = 0; index < warmup; index += 1) {
    searcher.search(queries[index % queries.length]);
  }

  const samples = [];
  let matchCount = 0;
  const searchStart = performance.now();
  for (let index = 0; index < iterations; index += 1) {
    const start = performance.now();
    matchCount += searcher.search(queries[index % queries.length]).length;
    samples.push(performance.now() - start);
  }

  return {
    indexMs,
    totalMs: performance.now() - searchStart,
    averageMs:
      samples.reduce((sum, value) => sum + value, 0) / samples.length,
    p95Ms: percentile(samples, 0.95),
    averageMatches: matchCount / iterations
  };
}

const isMain = process.argv[1]?.endsWith('benchmark-notes-search.mjs');
if (isMain) {
  const notes = makeBenchmarkNotes();
  console.log(
    `Notes search benchmark (${NOTE_COUNT.toLocaleString()} records, ${ITERATIONS} searches per engine)`
  );
  console.log(`Queries: ${queries.join(', ')}`);
  console.log('');
  console.log('Engine       Index ms  Avg ms  P95 ms  Avg matches  Total ms');
  console.log('-----------  --------  ------  ------  -----------  --------');

  for (const engine of ENGINES) {
    const result = benchmarkEngine(notes, engine.id);
    console.log(
      `${engine.label.padEnd(11)}  ${result.indexMs.toFixed(2).padStart(8)}  ${result.averageMs.toFixed(3).padStart(6)}  ${result.p95Ms.toFixed(3).padStart(6)}  ${result.averageMatches.toFixed(1).padStart(11)}  ${result.totalMs.toFixed(2).padStart(8)}`
    );
  }
}
