import { parseInline } from './note-markdown.js';
import { downloadBytes, pdfFileName, renderBlocks } from './note-pdf.js';
import {
  enrichFigureBlocks,
  resolveCitations,
  resolveFigures
} from './paper.js';
import { parsePaperMarkdown } from './paper-extensions.js';

export const PAPER_PDF_LAYOUTS = Object.freeze([
  { id: 'single', label: 'Single column' },
  { id: 'double', label: 'Two columns' }
]);

// Paper -> document blocks: title metadata and abstract remain full-width;
// the columnsStart marker lets the academic renderer flow the body and
// references through one or two columns.
export function paperBlocks(paper) {
  const resolved = resolveCitations(paper);
  const figures = resolveFigures(paper);
  const blocks = [{ type: 'title', text: paper.title || 'Untitled paper' }];
  if (paper.subtitle) {
    blocks.push({ type: 'kicker', text: paper.subtitle });
  }
  const authors = (paper.authors || [])
    .map((author) =>
      author.affiliation
        ? `${author.name} · ${author.affiliation}`
        : author.name
    )
    .join('     ');
  if (authors) blocks.push({ type: 'kicker', text: authors });
  const venue = [paper.venue, paper.year].filter(Boolean).join(' · ');
  if (venue) blocks.push({ type: 'kicker', text: venue });
  blocks.push({ type: 'rule' });
  blocks.push({ type: 'label', text: 'Abstract' });
  blocks.push(...richBlocks(resolved.abstract || '—', figures));
  if ((paper.keywords || []).length > 0) {
    blocks.push({
      type: 'para',
      spans: [{ t: `Keywords: ${paper.keywords.join(', ')}`, i: true }]
    });
  }
  blocks.push({ type: 'columnsStart' });
  for (const section of resolved.sections) {
    blocks.push({ type: 'heading', level: 2, text: section.title });
    blocks.push(...richBlocks(section.body, figures));
  }
  if (resolved.references.length > 0) {
    blocks.push({ type: 'heading', level: 2, text: 'References' });
    blocks.push({
      type: 'list',
      ordered: true,
      items: resolved.references.map((reference) =>
        parseInline(`[${reference.number}] ${reference.text}`)
      )
    });
  }
  return blocks;
}

function richBlocks(text, figures) {
  const source = String(text || '');
  if (!source) return [{ type: 'body', text: '—' }];
  const blocks = [];
  for (const parsed of parsePaperMarkdown(source)) {
    if (parsed.type === 'diagram') {
      blocks.push({ type: 'code', lang: 'mermaid', text: parsed.text });
      continue;
    }
    if (parsed.type === 'math') {
      blocks.push({ type: 'para', spans: [{ t: parsed.source, i: true }] });
      continue;
    }
    if (parsed.type === 'para') {
      blocks.push({ type: 'para', spans: parsed.spans });
    } else {
      blocks.push(parsed);
    }
  }
  const enriched = figures ? enrichFigureBlocks(blocks, figures) : blocks;
  return enriched.length > 0 ? enriched : [{ type: 'body', text: '—' }];
}

export function paperPdfFileName(paper) {
  return pdfFileName(paper.title);
}

export async function generatePaperPdfBytes(
  exporterId,
  paper,
  layout = 'single'
) {
  const normalizedLayout = layout === 'double' ? 'double' : 'single';
  // The imperative renderer provides deterministic page-to-page column flow.
  // Single-column papers retain the user's selected rendering engine.
  const activeExporter = normalizedLayout === 'double' ? 'jspdf' : exporterId;
  return renderBlocks(activeExporter, paperBlocks(paper), {
    columns: normalizedLayout === 'double' ? 2 : 1
  });
}

export async function downloadPaperAsPdf(exporterId, paper, layout = 'single') {
  const bytes = await generatePaperPdfBytes(exporterId, paper, layout);
  downloadBytes(bytes, paperPdfFileName(paper));
  return bytes;
}
