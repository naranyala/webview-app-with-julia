// Minimal markdown subset for external AI chats: fenced code, ATX headings,
// bullet/ordered lists, blockquotes, rules, and **bold** / *italic* / `code`.
// Deterministic and dependency-free; feeds the PDF engines and print HTML.
export function parseInline(text) {
  const spans = [];
  const push = (raw, bold, italic, code) => {
    if (!raw) return;
    const clean = code ? raw : raw.replace(/\s+/g, ' ');
    if (!clean) return;
    const span = { t: clean };
    if (bold) span.b = true;
    if (italic) span.i = true;
    if (code) span.c = true;
    spans.push(span);
  };
  const pushStyled = (raw) => {
    const pattern = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/g;
    let last = 0;
    let match = pattern.exec(raw);
    while (match !== null) {
      push(raw.slice(last, match.index));
      const token = match[0];
      if (token.startsWith('**')) push(token.slice(2, -2), true);
      else if (token.startsWith('__')) push(token.slice(2, -2), true);
      else if (token.startsWith('*')) push(token.slice(1, -1), false, true);
      else push(token.slice(1, -1), false, true);
      last = match.index + token.length;
      match = pattern.exec(raw);
    }
    push(raw.slice(last));
  };

  const parts = String(text).split(/(`[^`]*`)/g);
  for (const part of parts) {
    if (!part) continue;
    if (part.length >= 2 && part.startsWith('`') && part.endsWith('`')) {
      push(part.slice(1, -1), false, false, true);
    } else {
      pushStyled(part);
    }
  }
  return spans.length > 0 ? spans : [{ t: '' }];
}

export function parseMarkdown(text) {
  const lines = String(text || '')
    .replace(/\r\n?/g, '\n')
    .split('\n');
  const blocks = [];
  let paragraph = [];
  const flush = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: 'para', spans: parseInline(paragraph.join('\n')) });
      paragraph = [];
    }
  };

  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const fence = line.match(/^\s*```(\w*)\s*$/);
    if (fence) {
      flush();
      const code = [];
      index += 1;
      while (index < lines.length && !/^\s*```/.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push({
        type: 'code',
        lang: fence[1] || '',
        text: code.join('\n')
      });
      continue;
    }
    const figure = line.match(FIGURE_BLOCK_PATTERN);
    if (figure) {
      flush();
      blocks.push({ type: 'figure', id: figure[2].slice(4), alt: figure[1] });
      index += 1;
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flush();
      blocks.push({
        type: 'heading',
        level: heading[1].length,
        text: heading[2].trim()
      });
      index += 1;
      continue;
    }
    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
      flush();
      blocks.push({ type: 'rule' });
      index += 1;
      continue;
    }
    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) {
      flush();
      const quoted = [quote[1]];
      index += 1;
      while (index < lines.length) {
        const next = lines[index].match(/^\s*>\s?(.*)$/);
        if (!next) break;
        quoted.push(next[1]);
        index += 1;
      }
      blocks.push({ type: 'quote', spans: parseInline(quoted.join('\n')) });
      continue;
    }
    const unordered = line.match(/^\s*[-*+]\s+(.*)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (unordered || ordered) {
      flush();
      const isOrdered = Boolean(ordered);
      const items = [];
      while (index < lines.length) {
        const item = isOrdered
          ? lines[index].match(/^\s*\d+[.)]\s+(.*)$/)
          : lines[index].match(/^\s*[-*+]\s+(.*)$/);
        if (!item) break;
        items.push(parseInline(item[1]));
        index += 1;
      }
      blocks.push({ type: 'list', ordered: isOrdered, items });
      continue;
    }
    if (/^\s*$/.test(line)) {
      flush();
      index += 1;
      continue;
    }
    paragraph.push(line.trim());
    index += 1;
  }
  flush();
  return blocks;
}

// Full-line figure embed: ![alt text](fig:some-id). Inline occurrences stay
// literal text so captions can mention the syntax itself.
export const FIGURE_BLOCK_PATTERN = /^!\[([^\]]*)\]\(\s*(fig:[\w-]+)\s*\)$/;

// Strips executable content from pasted SVG so figures are safe to inline
// in the reader DOM.
export function sanitizeSvg(svg) {
  return String(svg || '')
    .replace(/<script[\s\S]*?<\/script\s*>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/href\s*=\s*"javascript:[^"]*"/gi, 'href="#"')
    .replace(/href\s*=\s*'javascript:[^']*'/gi, "href='#'");
}

export function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function spansToHtml(spans) {
  return spans
    .map((span) => {
      let html = escapeHtml(span.t);
      if (span.c) return `<code>${html}</code>`;
      if (span.b) html = `<strong>${html}</strong>`;
      if (span.i) html = `<em>${html}</em>`;
      return html;
    })
    .join('');
}

export function blocksToHtml(blocks) {
  return blocks
    .map((block) => {
      switch (block.type) {
        case 'heading': {
          const level = Math.min(Math.max(block.level || 2, 1), 4);
          return `<h${level}>${escapeHtml(block.text)}</h${level}>`;
        }
        case 'code':
          return `<pre><code${block.lang ? ` data-lang="${escapeHtml(block.lang)}"` : ''}>${escapeHtml(block.text) || '<br>'}</code></pre>`;
        case 'list': {
          const tag = block.ordered ? 'ol' : 'ul';
          const items = block.items
            .map((spans) => `<li>${spansToHtml(spans)}</li>`)
            .join('');
          return `<${tag}>${items}</${tag}>`;
        }
        case 'quote':
          return `<blockquote>${spansToHtml(block.spans)}</blockquote>`;
        case 'figure': {
          const label =
            block.figure && block.number > 0
              ? `Figure ${block.number}`
              : `Unknown figure: ${escapeHtml(block.id)}`;
          const caption = block.caption || block.alt || '';
          let media = '';
          if (block.figure?.svg) {
            media = sanitizeSvg(block.figure.svg);
          } else if (block.figure?.dataUrl) {
            media = `<img src="${escapeHtml(block.figure.dataUrl)}" alt="${escapeHtml(caption)}">`;
          }
          return (
            `<figure><div class="fig-num">${escapeHtml(label)}</div>${media}` +
            (caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : '') +
            '</figure>'
          );
        }
        case 'rule':
          return '<hr>';
        default:
          return `<p>${spansToHtml(block.spans)}</p>`;
      }
    })
    .join('');
}

// Strict print reset: deterministic type, spacing, code treatment, and page
// rules regardless of app theme or host WebView defaults.
export const PRINT_CSS_RESET =
  '@page{margin:15mm}' +
  '@media screen{#chain-print-root{display:none}}' +
  '@media print{' +
  '#app{display:none!important}' +
  '#chain-print-root,#chain-print-root *{margin:0;padding:0;box-sizing:border-box;color:#000!important;background:transparent!important;box-shadow:none!important;text-shadow:none!important}' +
  '#chain-print-root{display:block!important;font:11pt/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;print-color-adjust:exact;-webkit-print-color-adjust:exact}' +
  '#chain-print-root h1{font-size:24pt;line-height:1.2;margin:0 0 4pt}' +
  '#chain-print-root h2{font-size:14pt;line-height:1.3;margin:16pt 0 6pt;break-after:avoid}' +
  '#chain-print-root h3{font-size:9pt;letter-spacing:.06em;text-transform:uppercase;color:#444!important;margin:10pt 0 2pt;break-after:avoid}' +
  '#chain-print-root p{margin:0 0 6pt;overflow-wrap:break-word}' +
  '#chain-print-root ul,#chain-print-root ol{margin:0 0 6pt 18pt;padding:0}' +
  '#chain-print-root li{margin:0 0 2pt}' +
  '#chain-print-root blockquote{border-left:2pt solid #888;padding-left:8pt;margin:0 0 6pt;color:#222!important}' +
  '#chain-print-root hr{border:0;border-top:1pt solid #999;margin:10pt 0}' +
  '#chain-print-root pre{background:#f2f3f5!important;border:1pt solid #d5d7db;padding:8pt;margin:0 0 8pt;white-space:pre-wrap;overflow-wrap:anywhere;break-inside:auto}' +
  '#chain-print-root pre code{display:block;font:9pt/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:transparent!important;padding:0}' +
  '#chain-print-root p code,#chain-print-root li code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10pt;background:#f2f3f5!important;padding:0 3pt}' +
  '#chain-print-root section{break-inside:avoid-page}' +
  '}';
