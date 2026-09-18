import { performance } from 'node:perf_hooks';
import { NOTE_PDF_EXPORTERS } from './src/plugins/note-pdf.js';
import { samplePaper } from './src/plugins/paper-data.js';
import { generatePaperPdfBytes } from './src/plugins/paper-pdf.js';

const ITERATIONS = 5;
const WARMUP = 1;

function percentile(values, percentage) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[
    Math.min(sorted.length - 1, Math.floor(sorted.length * percentage))
  ];
}

export async function benchmarkPaperPdfExporter(
  exporterId,
  paper = samplePaper,
  { iterations = ITERATIONS, warmup = WARMUP } = {}
) {
  for (let index = 0; index < warmup; index += 1) {
    await generatePaperPdfBytes(exporterId, paper);
  }

  const samples = [];
  let bytes = 0;
  const start = performance.now();
  for (let index = 0; index < iterations; index += 1) {
    const sampleStart = performance.now();
    const output = await generatePaperPdfBytes(exporterId, paper);
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

const isMain = process.argv[1]?.endsWith('benchmark-paper-pdf.mjs');
if (isMain) {
  console.log(
    `Paper PDF benchmark (${ITERATIONS} exports per engine, sample paper)`
  );
  console.log('');
  console.log('Engine     Avg ms  P95 ms  Bytes  Total ms');
  console.log('---------  ------  ------  -----  --------');

  for (const exporter of NOTE_PDF_EXPORTERS) {
    const result = await benchmarkPaperPdfExporter(exporter.id);
    console.log(
      `${exporter.label.padEnd(9)}  ${result.averageMs.toFixed(2).padStart(6)}  ${result.p95Ms.toFixed(2).padStart(6)}  ${String(result.bytes).padStart(5)}  ${result.totalMs.toFixed(2).padStart(8)}`
    );
  }
}
