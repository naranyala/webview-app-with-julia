import { performance } from 'node:perf_hooks';
import {
  generateChainPdfBytes,
  generateNotePdfBytes,
  NOTE_PDF_EXPORTERS
} from './src/plugins/note-pdf.js';

const ITERATIONS = 10;
const WARMUP = 2;

export const SAMPLE_NOTE = Object.freeze({
  title: 'Local persistence benchmark',
  question: 'How should notes survive a restart?',
  answer:
    'Use an atomic local JSON file. Write a temporary state file first, ' +
    'then rename it so readers never observe a partial write. This record ' +
    'carries enough body text to make layout and font work comparable ' +
    'across exporters.',
  date: '2026-09-04'
});

function percentile(values, percentage) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[
    Math.min(sorted.length - 1, Math.floor(sorted.length * percentage))
  ];
}

export async function benchmarkPdfExporter(
  exporterId,
  note = SAMPLE_NOTE,
  { iterations = ITERATIONS, warmup = WARMUP } = {}
) {
  for (let index = 0; index < warmup; index += 1) {
    await generateNotePdfBytes(exporterId, note);
  }

  const samples = [];
  let bytes = 0;
  const start = performance.now();
  for (let index = 0; index < iterations; index += 1) {
    const sampleStart = performance.now();
    const output = await generateNotePdfBytes(exporterId, note);
    samples.push(performance.now() - sampleStart);
    bytes = output.length;
  }

  return {
    bytes,
    totalMs: performance.now() - start,
    averageMs:
      samples.reduce((sum, value) => sum + value, 0) / samples.length,
    p95Ms: percentile(samples, 0.95)
  };
}

export const CHAIN_ENTRY_COUNT = 20;
export const CHAIN_ITERATIONS = 5;

export function makeChainEntries(count = CHAIN_ENTRY_COUNT) {
  return Array.from({ length: count }, (_, index) => ({
    title: `Exchange ${index + 1}`,
    question: `Question ${index + 1}: how should notes survive a restart?`,
    answer:
      `Answer ${index + 1}: use an atomic local JSON file. Write a temporary ` +
      `state file first, then rename it so readers never observe a partial write.`,
    date: '2026-09-04'
  }));
}

export async function benchmarkChainPdfExporter(
  exporterId,
  entries = makeChainEntries(),
  { iterations = CHAIN_ITERATIONS, warmup = 1 } = {}
) {
  for (let index = 0; index < warmup; index += 1) {
    await generateChainPdfBytes(exporterId, entries);
  }

  const samples = [];
  let bytes = 0;
  const start = performance.now();
  for (let index = 0; index < iterations; index += 1) {
    const sampleStart = performance.now();
    const output = await generateChainPdfBytes(exporterId, entries);
    samples.push(performance.now() - sampleStart);
    bytes = output.length;
  }

  return {
    bytes,
    totalMs: performance.now() - start,
    averageMs:
      samples.reduce((sum, value) => sum + value, 0) / samples.length,
    p95Ms: percentile(samples, 0.95)
  };
}

const isMain = process.argv[1]?.endsWith('benchmark-note-pdf.mjs');
if (isMain) {
  console.log(
    `Note PDF benchmark (${ITERATIONS} exports per engine, same Q&A record)`
  );
  console.log('');
  console.log('Engine     Avg ms  P95 ms  Bytes  Total ms');
  console.log('---------  ------  ------  -----  --------');

  for (const exporter of NOTE_PDF_EXPORTERS) {
    const result = await benchmarkPdfExporter(exporter.id);
    console.log(
      `${exporter.label.padEnd(9)}  ${result.averageMs.toFixed(2).padStart(6)}  ${result.p95Ms.toFixed(2).padStart(6)}  ${String(result.bytes).padStart(5)}  ${result.totalMs.toFixed(2).padStart(8)}`
    );
  }

  console.log('');
  console.log(
    `Chain PDF benchmark (${CHAIN_ITERATIONS} exports per engine, ${CHAIN_ENTRY_COUNT} Q&A entries)`
  );
  console.log('');
  console.log('Engine     Avg ms  P95 ms  Bytes  Total ms');
  console.log('---------  ------  ------  -----  --------');

  for (const exporter of NOTE_PDF_EXPORTERS) {
    const result = await benchmarkChainPdfExporter(exporter.id);
    console.log(
      `${exporter.label.padEnd(9)}  ${result.averageMs.toFixed(2).padStart(6)}  ${result.p95Ms.toFixed(2).padStart(6)}  ${String(result.bytes).padStart(5)}  ${result.totalMs.toFixed(2).padStart(8)}`
    );
  }
}
