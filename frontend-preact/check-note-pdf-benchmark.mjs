// Automated form of `npm run benchmark:pdf`: exports the same Q&A record
// with every engine and asserts each stays within budget.
// Run: `npm test`. `zig build test` runs it via `npm run test`.
import {
  benchmarkChainPdfExporter,
  benchmarkPdfExporter,
  makeChainEntries,
  SAMPLE_NOTE
} from './benchmark-note-pdf.mjs';
import { NOTE_PDF_EXPORTERS } from './src/plugins/note-pdf.js';

let failures = 0;

function check(name, condition, extra = '') {
  if (condition) {
    console.log(`ok: ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL: ${name}${extra ? ` (${extra})` : ''}`);
  }
}

for (const exporter of NOTE_PDF_EXPORTERS) {
  const result = await benchmarkPdfExporter(exporter.id, SAMPLE_NOTE, {
    iterations: 3,
    warmup: 1
  });
  console.log(
    `benchmark: ${exporter.id} avg ${result.averageMs.toFixed(2)}ms, ${result.bytes} bytes`
  );
  check(`${exporter.id} produces bytes`, result.bytes > 0);
  check(
    `${exporter.id} avg under 2000ms`,
    result.averageMs < 2000,
    `${result.averageMs.toFixed(2)}ms`
  );
}

const chainEntries = makeChainEntries(5);
for (const exporter of NOTE_PDF_EXPORTERS) {
  const result = await benchmarkChainPdfExporter(exporter.id, chainEntries, {
    iterations: 2,
    warmup: 1
  });
  console.log(
    `benchmark: ${exporter.id} chain avg ${result.averageMs.toFixed(2)}ms, ${result.bytes} bytes`
  );
  check(`${exporter.id} chain produces bytes`, result.bytes > 0);
  check(
    `${exporter.id} chain avg under 5000ms`,
    result.averageMs < 5000,
    `${result.averageMs.toFixed(2)}ms`
  );
}

if (failures > 0) process.exit(1);
console.log('note pdf benchmark: all tests passed');
