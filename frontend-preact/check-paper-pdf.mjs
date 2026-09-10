import { NOTE_PDF_EXPORTERS } from './src/plugins/note-pdf.js';
import { samplePaper } from './src/plugins/paper-data.js';
import {
  generatePaperPdfBytes,
  paperPdfFileName
} from './src/plugins/paper-pdf.js';

let failures = 0;

function check(name, condition, extra = '') {
  if (condition) {
    console.log(`ok: ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL: ${name}${extra ? ` (${extra})` : ''}`);
  }
}

check(
  'paper filename derives from title',
  paperPdfFileName({ title: 'Hello, World!' }) === 'hello-world.pdf'
);

for (const exporter of NOTE_PDF_EXPORTERS) {
  const bytes = await generatePaperPdfBytes(exporter.id, samplePaper);
  check(
    `${exporter.id} renders the paper`,
    bytes.length > 0 &&
      Buffer.from(bytes.slice(0, 5)).toString() === '%PDF-',
    `bytes=${bytes.length}`
  );
}

const pngPaper = {
  ...samplePaper,
  id: 'png-paper',
  figures: [
    {
      id: 'pixel',
      caption: 'Single pixel',
      dataUrl:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    }
  ],
  sections: [
    {
      id: 's',
      title: 'Pixel',
      body: 'Look:\n\n![Pixel](fig:pixel)'
    }
  ]
};

for (const exporter of NOTE_PDF_EXPORTERS) {
  const bytes = await generatePaperPdfBytes(exporter.id, pngPaper);
  check(
    `${exporter.id} embeds raster figures`,
    bytes.length > 0 &&
      Buffer.from(bytes.slice(0, 5)).toString() === '%PDF-'
  );
}

const fallback = await generatePaperPdfBytes('missing', samplePaper);
check(
  'unknown exporter falls back',
  fallback.length > 0 &&
    Buffer.from(fallback.slice(0, 5)).toString() === '%PDF-'
);

if (failures > 0) process.exit(1);
console.log('paper pdf: all tests passed');
