// Academic paper abstraction: a storage-ready document model, citation
// resolution, and reading statistics. Section bodies reuse the markdown
// subset from `note-markdown.js`, so the reader, print path, and PDF
// exporters all share one content pipeline.
import {
  blocksToHtml,
  escapeHtml,
  FIGURE_BLOCK_PATTERN,
  parseMarkdown
} from './note-markdown.js';

export const CITATION_PATTERN = /\[@([\w-]+)\]/g;
export const PAPER_STATUSES = Object.freeze(['draft', 'final']);

export function slugifyTitle(title) {
  return (
    String(title || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'untitled-paper'
  );
}

export function createPaper(input = {}) {
  return {
    id: input.id || slugifyTitle(input.title),
    title: input.title || 'Untitled paper',
    subtitle: input.subtitle || '',
    authors: Array.isArray(input.authors) ? input.authors : [],
    venue: input.venue || '',
    year: input.year || '',
    status: PAPER_STATUSES.includes(input.status) ? input.status : 'draft',
    abstract: input.abstract || '',
    keywords: Array.isArray(input.keywords) ? input.keywords : [],
    sections: Array.isArray(input.sections) ? input.sections : [],
    references: Array.isArray(input.references) ? input.references : [],
    figures: Array.isArray(input.figures) ? input.figures : []
  };
}

export const MAX_FIGURE_BYTES = 1536 * 1024;

export function figureKind(figure) {
  if (!figure) return 'missing';
  if (typeof figure.svg === 'string' && figure.svg !== '') return 'svg';
  if (typeof figure.dataUrl === 'string') {
    if (figure.dataUrl.startsWith('data:image/png;base64,')) return 'png';
    if (figure.dataUrl.startsWith('data:image/jpeg;base64,')) return 'jpeg';
  }
  return 'unknown';
}

export function validatePaper(paper) {
  const errors = [];
  if (!paper || typeof paper !== 'object') return ['paper must be an object'];
  if (typeof paper.id !== 'string' || !/^[a-z0-9-]+$/.test(paper.id)) {
    errors.push('paper id must be a lowercase slug');
  }
  if (typeof paper.title !== 'string' || paper.title.trim() === '') {
    errors.push('paper title is required');
  }
  if (!PAPER_STATUSES.includes(paper.status)) {
    errors.push('paper status must be draft or final');
  }
  if (!Array.isArray(paper.authors) || paper.authors.length === 0) {
    errors.push('paper needs at least one author');
  } else {
    paper.authors.forEach((author, index) => {
      if (
        !author ||
        typeof author.name !== 'string' ||
        author.name.trim() === ''
      ) {
        errors.push(`author ${index + 1} needs a name`);
      }
    });
  }
  if (!Array.isArray(paper.sections) || paper.sections.length === 0) {
    errors.push('paper needs at least one section');
  } else {
    const seen = new Set();
    paper.sections.forEach((section, index) => {
      if (!section || typeof section.id !== 'string' || section.id === '') {
        errors.push(`section ${index + 1} needs an id`);
      } else if (seen.has(section.id)) {
        errors.push(`duplicate section id: ${section.id}`);
      } else {
        seen.add(section.id);
      }
      if (
        !section ||
        typeof section.title !== 'string' ||
        section.title === ''
      ) {
        errors.push(`section ${index + 1} needs a title`);
      }
      if (!section || typeof section.body !== 'string') {
        errors.push(`section ${index + 1} needs a body`);
      }
    });
  }
  if (!Array.isArray(paper.references)) {
    errors.push('paper references must be an array');
  } else {
    const seen = new Set();
    paper.references.forEach((reference, index) => {
      if (
        !reference ||
        typeof reference.key !== 'string' ||
        reference.key === ''
      ) {
        errors.push(`reference ${index + 1} needs a key`);
      } else if (seen.has(reference.key)) {
        errors.push(`duplicate reference key: ${reference.key}`);
      } else {
        seen.add(reference.key);
      }
      if (
        !reference ||
        typeof reference.text !== 'string' ||
        reference.text === ''
      ) {
        errors.push(`reference ${index + 1} needs text`);
      }
    });
  }
  const known = new Set(
    (paper.references || []).map((reference) => reference.key)
  );
  for (const key of citedKeys(paper)) {
    if (!known.has(key)) errors.push(`cited but unlisted reference: ${key}`);
  }
  if (!Array.isArray(paper.figures)) {
    errors.push('paper figures must be an array');
  } else {
    const seen = new Set();
    paper.figures.forEach((figure, index) => {
      if (
        !figure ||
        typeof figure.id !== 'string' ||
        !/^[\w-]+$/.test(figure.id)
      ) {
        errors.push(`figure ${index + 1} needs an id`);
      } else if (seen.has(figure.id)) {
        errors.push(`duplicate figure id: ${figure.id}`);
      } else {
        seen.add(figure.id);
      }
      if (
        !figure ||
        typeof figure.caption !== 'string' ||
        figure.caption.trim() === ''
      ) {
        errors.push(`figure ${index + 1} needs a caption`);
      }
      if (figureKind(figure) === 'unknown') {
        errors.push(`figure ${index + 1} needs SVG art or a PNG/JPEG upload`);
      }
    });
  }
  const figuresById = new Set((paper.figures || []).map((figure) => figure.id));
  for (const id of embeddedFigureIds(paper)) {
    if (!figuresById.has(id))
      errors.push(`embedded but unlisted figure: ${id}`);
  }
  return errors;
}

// Figure ids embedded via full-line ![alt](fig:id) markers, in order.
export function embeddedFigureIds(paper) {
  const ids = [];
  const scan = (text) => {
    const pattern = new RegExp(FIGURE_BLOCK_PATTERN.source, 'gm');
    let match = pattern.exec(text || '');
    while (match !== null) {
      const id = match[2].slice(4);
      if (!ids.includes(id)) ids.push(id);
      match = pattern.exec(text || '');
    }
  };
  scan(paper.abstract);
  for (const section of paper.sections || []) scan(section.body);
  return ids;
}

// Numbers embedded figures by first appearance for Figure N labels.
export function resolveFigures(paper) {
  const byId = new Map(
    (paper.figures || []).map((figure) => [figure.id, figure])
  );
  const order = embeddedFigureIds(paper);
  const numbered = new Map(
    order.map((id, index) => [
      id,
      { number: index + 1, figure: byId.get(id) || null }
    ])
  );
  return {
    order,
    numbered,
    unknown: order.filter((id) => !byId.has(id))
  };
}

// Attaches number/caption/asset to parsed figure blocks for renderers.
export function enrichFigureBlocks(blocks, figureResolution) {
  const assets = new Map(
    [...(figureResolution?.numbered || [])].map(([id, entry]) => [id, entry])
  );
  return blocks.map((block) => {
    if (block?.type !== 'figure') return block;
    const entry = assets.get(block.id);
    return {
      ...block,
      number: entry ? entry.number : 0,
      caption: block.alt || entry?.figure?.caption || '',
      figure: entry ? entry.figure : null
    };
  });
}

export function citedKeys(paper) {
  const keys = [];
  const collect = (text) => {
    CITATION_PATTERN.lastIndex = 0;
    let match = CITATION_PATTERN.exec(text || '');
    while (match !== null) {
      if (!keys.includes(match[1])) keys.push(match[1]);
      match = CITATION_PATTERN.exec(text || '');
    }
  };
  collect(paper.abstract);
  for (const section of paper.sections || []) collect(section.body);
  return keys;
}

// Citation occurrence counts per key, for the reference manager.
export function citationCounts(paper) {
  const counts = new Map();
  const collect = (text) => {
    CITATION_PATTERN.lastIndex = 0;
    let match = CITATION_PATTERN.exec(text || '');
    while (match !== null) {
      counts.set(match[1], (counts.get(match[1]) || 0) + 1);
      match = CITATION_PATTERN.exec(text || '');
    }
  };
  collect(paper.abstract);
  for (const section of paper.sections || []) collect(section.body);
  return counts;
}

// Numbers citations by first appearance (abstract first, then sections) and
// rewrites [@key] markers to [n]. Unknown keys keep their number with a
// "Missing reference." placeholder and are reported in `missing`.
export function resolveCitations(paper) {
  const order = [];
  const replace = (text) =>
    String(text || '').replace(CITATION_PATTERN, (_, key) => {
      let number = order.indexOf(key) + 1;
      if (number === 0) {
        order.push(key);
        number = order.length;
      }
      return `[${number}]`;
    });
  const known = new Map(
    (paper.references || []).map((reference) => [reference.key, reference.text])
  );
  return {
    abstract: replace(paper.abstract),
    sections: (paper.sections || []).map((section) => ({
      ...section,
      body: replace(section.body)
    })),
    references: order.map((key, index) => ({
      key,
      number: index + 1,
      text: known.get(key) || 'Missing reference.'
    })),
    missing: order.filter((key) => !known.has(key))
  };
}

function countWords(text) {
  const words = String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return words.length === 1 && words[0] === '' ? 0 : words.length;
}

export function paperStats(paper) {
  let words = countWords(paper.title) + countWords(paper.abstract);
  for (const section of paper.sections || []) {
    words += countWords(section.title) + countWords(section.body);
  }
  return {
    words,
    sections: (paper.sections || []).length,
    references: (paper.references || []).length,
    figures: (paper.figures || []).length,
    readingMinutes: Math.max(1, Math.ceil(words / 200))
  };
}

// One HTML builder for screen reading and print: title block, authors,
// abstract, keywords, sections (anchorable), and numbered references.
// `columnsClass` switches the section flow between one and two columns.
export function paperContentHtml(paper, resolved, columnsClass = '') {
  const figures = resolveFigures(paper);
  const renderBody = (body) =>
    blocksToHtml(enrichFigureBlocks(parseMarkdown(body), figures));
  const authors = (paper.authors || [])
    .map(
      (author) =>
        `<span class="paper-author"><strong>${escapeHtml(author.name)}</strong>` +
        (author.affiliation
          ? `<small>${escapeHtml(author.affiliation)}</small>`
          : '') +
        '</span>'
    )
    .join('');
  const venue = [paper.venue, paper.year].filter(Boolean).join(' · ');
  const keywords = (paper.keywords || [])
    .map((word) => `<span class="paper-keyword">${escapeHtml(word)}</span>`)
    .join('');
  const sections = resolved.sections
    .map(
      (section) =>
        `<section id="paper-${escapeHtml(section.id)}" class="paper-section">` +
        `<h2>${escapeHtml(section.title)}</h2>` +
        renderBody(section.body) +
        '</section>'
    )
    .join('');
  const references = resolved.references
    .map(
      (reference) =>
        `<li value="${reference.number}"><span class="ref-num">[${reference.number}]</span> ` +
        blocksToHtml(parseMarkdown(reference.text)) +
        '</li>'
    )
    .join('');
  return (
    `<header class="paper-header"><h1>${escapeHtml(paper.title)}</h1>` +
    (paper.subtitle
      ? `<p class="paper-subtitle">${escapeHtml(paper.subtitle)}</p>`
      : '') +
    (authors ? `<div class="paper-authors">${authors}</div>` : '') +
    (venue ? `<p class="paper-venue">${escapeHtml(venue)}</p>` : '') +
    '</header>' +
    `<div class="paper-abstract"><h3>Abstract</h3>` +
    blocksToHtml(
      enrichFigureBlocks(parseMarkdown(resolved.abstract || '—'), figures)
    ) +
    (keywords ? `<div class="paper-keywords">${keywords}</div>` : '') +
    '</div>' +
    `<div class="paper-body${columnsClass ? ` ${columnsClass}` : ''}">${sections}</div>` +
    (references
      ? `<div class="paper-references"><h2>References</h2><ol>${references}</ol></div>`
      : '')
  );
}

// Screen typography for the reader. Layout chrome (panels, nav, buttons)
// stays in StyleX; the two-column flow lives here so screen and print share
// one type scale. Narrow viewports collapse to one column automatically.
export const PAPER_SCREEN_CSS =
  '.paper-reading{font-family:Georgia,"Times New Roman",serif;color:#ece9e2}' +
  '.paper-reading .paper-columns{column-width:19rem;column-gap:2.2rem;column-rule:1px solid rgba(255,255,255,.09);text-align:justify;hyphens:auto}' +
  '.paper-reading .paper-single{max-width:44rem}' +
  '.paper-reading .paper-header h1{font-size:1.7rem;line-height:1.2;margin:0 0 .4rem;letter-spacing:-.01em}' +
  '.paper-reading .paper-subtitle{color:#a3a5ad;font-style:italic;margin:0 0 .8rem}' +
  '.paper-reading .paper-authors{display:flex;flex-wrap:wrap;gap:.4rem 1.2rem;margin:.6rem 0}' +
  '.paper-reading .paper-author{display:flex;flex-direction:column}' +
  '.paper-reading .paper-author small{color:#a3a5ad}' +
  '.paper-reading .paper-venue{color:#a3a5ad;font-size:.8rem;margin:0 0 .5rem}' +
  '.paper-reading .paper-abstract{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:10px;padding:.9rem 1rem;margin:0 0 1.2rem}' +
  '.paper-reading .paper-abstract h3,.paper-reading h3{font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;color:#82c99b;margin:0 0 .4rem}' +
  '.paper-reading .paper-keywords{display:flex;flex-wrap:wrap;gap:.3rem;margin-top:.6rem}' +
  '.paper-reading .paper-keyword{border:1px solid rgba(130,201,155,.4);border-radius:100px;padding:.1rem .6rem;font-size:.72rem;color:#82c99b;font-family:inherit}' +
  '.paper-reading .paper-body h2{font-size:1.15rem;line-height:1.3;margin:1.1rem 0 .5rem;break-after:avoid}' +
  '.paper-reading .paper-body p{margin:0 0 .7rem;line-height:1.65}' +
  '.paper-reading .paper-body ul,.paper-reading .paper-body ol{margin:0 0 .7rem 1.3rem;padding:0}' +
  '.paper-reading .paper-body li{margin:0 0 .25rem;line-height:1.6}' +
  '.paper-reading .paper-body blockquote{border-left:2px solid #82c99b;padding-left:.7rem;margin:0 0 .7rem;color:#c9cbd2;font-style:italic}' +
  '.paper-reading .paper-body hr{border:0;border-top:1px solid rgba(255,255,255,.14);margin:.9rem 0}' +
  '.paper-reading .paper-body pre{background:#141518;border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:.7rem .8rem;margin:0 0 .8rem;white-space:pre-wrap;overflow-wrap:anywhere;break-inside:avoid}' +
  '.paper-reading .paper-body pre code{display:block;font:0.8rem/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#e8e4da}' +
  '.paper-reading figure{margin:0 0 .9rem;break-inside:avoid}' +
  '.paper-reading .fig-num{font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;color:#82c99b;margin:0 0 .3rem}' +
  '.paper-reading figure svg,.paper-reading figure img{display:block;max-width:100%;height:auto;background:#e8e9ec;border-radius:8px}' +
  '.paper-reading figcaption{font-size:.8rem;color:#a3a5ad;margin:.35rem 0 0;font-family:inherit}' +
  '.paper-reading .paper-body p code,.paper-reading .paper-body li code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.85em;background:rgba(255,255,255,.08);padding:0 .3em;border-radius:4px}' +
  '.paper-reading .paper-references{margin-top:1.2rem}' +
  '.paper-reading .paper-references h2{font-size:1.15rem;margin:0 0 .5rem}' +
  '.paper-reading .paper-references ol{margin:0 0 0 1.3rem;padding:0}' +
  '.paper-reading .paper-references li{margin:0 0 .4rem;line-height:1.55;font-size:.92rem}' +
  '.paper-reading .paper-references li p{display:inline;margin:0}' +
  '.paper-reading .ref-num{color:#82c99b}';

// Print variant: same structure, strict reset for deterministic output.
export const PAPER_PRINT_CSS =
  '@page{margin:15mm}' +
  '@media screen{#paper-print-root{display:none}}' +
  '@media print{' +
  '#app{display:none!important}' +
  '#paper-print-root,#paper-print-root *{margin:0;padding:0;box-sizing:border-box;color:#000!important;background:transparent!important;box-shadow:none!important;text-shadow:none!important}' +
  '#paper-print-root{display:block!important;font:11pt/1.55 Georgia,"Times New Roman",serif;print-color-adjust:exact;-webkit-print-color-adjust:exact}' +
  '#paper-print-root h1{font-size:22pt;line-height:1.2;margin:0 0 4pt}' +
  '#paper-print-root .paper-subtitle{font-style:italic;margin:0 0 6pt}' +
  '#paper-print-root .paper-authors{margin:6pt 0}' +
  '#paper-print-root .paper-author{display:block;margin:0 0 2pt}' +
  '#paper-print-root .paper-author small{display:block;font-size:9pt;color:#333!important}' +
  '#paper-print-root .paper-venue{font-size:9pt;color:#333!important;margin:0 0 6pt}' +
  '#paper-print-root .paper-abstract{border:1pt solid #999;padding:8pt;margin:0 0 10pt}' +
  '#paper-print-root h3{font-size:9pt;letter-spacing:.06em;text-transform:uppercase;color:#333!important;margin:0 0 3pt}' +
  '#paper-print-root .paper-keywords{margin-top:6pt}' +
  '#paper-print-root .paper-keyword{border:1pt solid #666;padding:1pt 6pt;margin-right:4pt;font-size:9pt}' +
  '#paper-print-root .paper-columns{column-width:85mm;column-gap:8mm;column-rule:.5pt solid #999;text-align:justify;hyphens:auto}' +
  '#paper-print-root h2{font-size:13pt;margin:12pt 0 4pt;break-after:avoid}' +
  '#paper-print-root p{margin:0 0 5pt;overflow-wrap:break-word}' +
  '#paper-print-root ul,#paper-print-root ol{margin:0 0 5pt 12pt}' +
  '#paper-print-root li{margin:0 0 2pt}' +
  '#paper-print-root blockquote{border-left:2pt solid #666;padding-left:6pt;margin:0 0 5pt}' +
  '#paper-print-root hr{border:0;border-top:1pt solid #999;margin:8pt 0}' +
  '#paper-print-root pre{background:#f2f3f5!important;border:1pt solid #d5d7db;padding:6pt;margin:0 0 6pt;white-space:pre-wrap;overflow-wrap:anywhere}' +
  '#paper-print-root pre code{display:block;font:8.5pt/1.45 ui-monospace,Menlo,Consolas,monospace}' +
  '#paper-print-root p code,#paper-print-root li code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:9.5pt;background:#f2f3f5!important;padding:0 2pt}' +
  '#paper-print-root figure{margin:0 0 8pt;break-inside:avoid}' +
  '#paper-print-root .fig-num{font-size:9pt;letter-spacing:.06em;text-transform:uppercase;margin:0 0 3pt}' +
  '#paper-print-root figure svg,#paper-print-root figure img{display:block;max-width:100%;height:auto}' +
  '#paper-print-root figcaption{font-size:9pt;margin:3pt 0 0}' +
  '#paper-print-root .paper-references{margin-top:10pt}' +
  '#paper-print-root .paper-references li{font-size:10pt}' +
  '#paper-print-root section{break-inside:avoid-page}' +
  '}';
