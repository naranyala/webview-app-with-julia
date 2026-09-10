import {
  chainPdfFileName,
  DEFAULT_NOTE_PDF_EXPORTER,
  generateChainPdfBytes,
  generateNotePdfBytes,
  NOTE_PDF_EXPORTERS,
  pdfBytesToBase64,
  pdfFileName,
  renderBlocks
} from './src/plugins/note-pdf.js';

const ONE_PX_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

let failures = 0;

function check(name, condition, extra = '') {
  if (condition) {
    console.log(`ok: ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL: ${name}${extra ? ` (${extra})` : ''}`);
  }
}

const note = {
  title: 'Local persistence',
  question: 'How should notes survive a restart?',
  answer: 'Use an atomic local JSON file.',
  date: '2026-09-04'
};

check(
  'three exporters registered',
  NOTE_PDF_EXPORTERS.length === 3,
  String(NOTE_PDF_EXPORTERS.length)
);
check('default exporter is jsPDF', DEFAULT_NOTE_PDF_EXPORTER === 'jspdf');
check('filename is sanitized', pdfFileName('Hello, World!') === 'hello-world.pdf');

for (const exporter of NOTE_PDF_EXPORTERS) {
  const bytes = await generateNotePdfBytes(exporter.id, note);
  const header = Buffer.from(bytes.slice(0, 5)).toString();
  check(
    `${exporter.id} produces a PDF`,
    bytes.length > 0 && header === '%PDF-',
    `bytes=${bytes.length} header=${header}`
  );
  const empty = await generateNotePdfBytes(exporter.id, {
    title: '',
    question: '',
    answer: '',
    date: '2026-09-04'
  });
  check(`${exporter.id} handles empty Q&A`, empty.length > 0);
}

const chainEntries = [
  note,
  {
    title: 'Atomic writes',
    question: 'Why write a temporary file first?',
    answer: 'A rename prevents partial reads.',
    date: '2026-09-04'
  }
];

const markdownNote = {
  title: 'Markdown tour',
  question: 'What renders?\n\n## Sub head\n\n- one\n- two\n\n> quoted',
  answer: 'Code:\n\n```js\nconst x = 1;\n  indented();\n```\n\nUse **bold** and `code()`.',
  date: '2026-09-04'
};

for (const exporter of NOTE_PDF_EXPORTERS) {
  const markdown = await generateNotePdfBytes(exporter.id, markdownNote);
  check(
    `${exporter.id} renders markdown and code blocks`,
    Buffer.from(markdown.slice(0, 5)).toString() === '%PDF-' &&
      markdown.length > 0
  );
}

for (const exporter of NOTE_PDF_EXPORTERS) {
  const single = await generateNotePdfBytes(exporter.id, note);
  const chain = await generateChainPdfBytes(exporter.id, chainEntries);
  check(
    `${exporter.id} chain export grows with entries`,
    Buffer.from(chain.slice(0, 5)).toString() === '%PDF-' &&
      chain.length > single.length,
    `single=${single.length} chain=${chain.length}`
  );
}

const roundtrip = pdfBytesToBase64(new Uint8Array([37, 80, 68, 70]));
check(
  'base64 round-trips bytes',
  Buffer.from(roundtrip, 'base64').toString() === '%PDF'
);
check(
  'chain filename is dated',
  chainPdfFileName('2026-09-04') === 'chain-notes-2026-09-04.pdf'
);

for (const exporter of NOTE_PDF_EXPORTERS) {
  const svgFigure = await renderBlocks(exporter.id, [
    { type: 'title', text: 'Figures' },
    {
      type: 'figure',
      id: 'fig-demo',
      alt: '',
      number: 1,
      caption: 'Demo diagram',
      figure: { id: 'fig-demo', caption: 'Demo diagram', svg: '<svg></svg>' }
    }
  ]);
  const pngFigure = await renderBlocks(exporter.id, [
    { type: 'title', text: 'Figures' },
    {
      type: 'figure',
      id: 'fig-demo',
      alt: '',
      number: 1,
      caption: 'Demo diagram',
      figure: { id: 'fig-demo', caption: 'Demo diagram', dataUrl: ONE_PX_PNG }
    }
  ]);
  check(
    `${exporter.id} renders vector placeholders and raster embeds`,
    Buffer.from(svgFigure.slice(0, 5)).toString() === '%PDF-' &&
      svgFigure.length > 0 &&
      Buffer.from(pngFigure.slice(0, 5)).toString() === '%PDF-' &&
      pngFigure.length > 0
  );
}

const fallback = await generateNotePdfBytes('missing', note);
check(
  'unknown exporter falls back to jsPDF',
  fallback.length > 0 &&
    Buffer.from(fallback.slice(0, 5)).toString() === '%PDF-'
);

if (failures > 0) process.exit(1);
console.log('note pdf: all tests passed');
