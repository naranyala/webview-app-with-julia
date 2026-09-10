import { parseInline, parseMarkdown } from './note-markdown.js';
import { downloadBytes, pdfFileName, renderBlocks } from './note-pdf.js';
import {
  enrichFigureBlocks,
  resolveCitations,
  resolveFigures
} from './paper.js';

// Paper → document blocks for the shared PDF renderers: full-width title
// block, abstract, then one heading per section and a numbered reference
// list. Screen reading is two-column CSS; the PDF stays single-column
// preprint style, which keeps all three engines consistent.
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
  for (const parsed of parseMarkdown(source)) {
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

export async function generatePaperPdfBytes(exporterId, paper) {
  return renderBlocks(exporterId, paperBlocks(paper));
}

export async function downloadPaperAsPdf(exporterId, paper) {
  const bytes = await generatePaperPdfBytes(exporterId, paper);
  downloadBytes(bytes, paperPdfFileName(paper));
  return bytes;
}
