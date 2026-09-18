// Automated form of `npm run benchmark:paper`: exports the sample paper
// with every engine and asserts each stays within budget.
// Run: `npm test`. `zig build test` runs it via `npm run test`.
import { benchmarkPaperPdfExporter } from './benchmark-paper-pdf.mjs';
import { NOTE_PDF_EXPORTERS } from './src/plugins/note-pdf.js';
import { samplePaper } from './src/plugins/paper-data.js';

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
  const result = await benchmarkPaperPdfExporter(exporter.id, samplePaper, {
    iterations: 2,
    warmup: 1
  });
  console.log(
    `benchmark: ${exporter.id} paper avg ${result.averageMs.toFixed(2)}ms, ${result.bytes} bytes`
  );
  check(`${exporter.id} paper produces bytes`, result.bytes > 0);
  check(
    `${exporter.id} paper avg under 5000ms`,
    result.averageMs < 5000,
    `${result.averageMs.toFixed(2)}ms`
  );
}

if (failures > 0) process.exit(1);
console.log('paper pdf benchmark: all tests passed');
