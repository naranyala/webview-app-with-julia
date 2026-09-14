import { PDFDocument } from 'pdf-lib';
import { NOTE_PDF_EXPORTERS, renderBlocks } from './src/plugins/note-pdf.js';
import { samplePaper } from './src/plugins/paper-data.js';
import {
  generatePaperPdfBytes,
  PAPER_PDF_LAYOUTS,
  paperBlocks,
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
check(
  'paper exposes single- and two-column layouts',
  PAPER_PDF_LAYOUTS.map((layout) => layout.id).join(',') === 'single,double'
);
check(
  'paper body starts after the full-width academic front matter',
  paperBlocks(samplePaper).some((block) => block.type === 'columnsStart')
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

for (const layout of PAPER_PDF_LAYOUTS) {
  const bytes = await generatePaperPdfBytes('jspdf', samplePaper, layout.id);
  check(
    `jsPDF renders ${layout.label.toLowerCase()} academic layout`,
    bytes.length > 0 && Buffer.from(bytes.slice(0, 5)).toString() === '%PDF-'
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

// The columnsStart marker must be inert outside the two-column jsPDF flow:
// stripping it changes nothing in any single-column engine.
for (const exporter of NOTE_PDF_EXPORTERS) {
  const full = await generatePaperPdfBytes(exporter.id, samplePaper);
  const stripped = await renderBlocks(
    exporter.id,
    paperBlocks(samplePaper).filter((block) => block.type !== 'columnsStart')
  );
  const fullPages = (await PDFDocument.load(full)).getPageCount();
  const strippedPages = (await PDFDocument.load(stripped)).getPageCount();
  check(
    `${exporter.id} ignores the columnsStart marker`,
    fullPages === strippedPages,
    `${fullPages} vs ${strippedPages} pages`
  );
}

if (failures > 0) process.exit(1);
console.log('paper pdf: all tests passed');
