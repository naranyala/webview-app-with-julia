import { writeFile } from 'node:fs/promises';
import { samplePaper } from '../../frontend-preact/src/plugins/paper-data.js';
import { generatePaperPdfBytes } from '../../frontend-preact/src/plugins/paper-pdf.js';

for (const layout of ['single', 'double']) {
  const bytes = await generatePaperPdfBytes('jspdf', samplePaper, layout);
  await writeFile(`output/pdf/academic-paper-${layout}-column.pdf`, bytes);
}
