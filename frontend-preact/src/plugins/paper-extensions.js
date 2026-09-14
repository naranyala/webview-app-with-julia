// Optional academic-content renderers. The paper model stays dependency-free:
// Mermaid and MathJax can be enhanced by the host when their bundles are
// available, while the safe source fallback remains readable offline.
import { blocksToHtml, escapeHtml, parseMarkdown } from './note-markdown.js';

const extensions = new Map();

function escapeAttribute(value) {
  return escapeHtml(value).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function decodeTextEntities(value) {
  return String(value || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

export function registerPaperExtension(extension) {
  if (!extension || typeof extension.id !== 'string' || !extension.id.trim()) {
    throw new Error('Paper extension needs a non-empty id');
  }
  if (
    typeof extension.matches !== 'function' ||
    typeof extension.renderHtml !== 'function'
  ) {
    throw new Error(
      `Paper extension ${extension.id} needs matches and renderHtml`
    );
  }
  extensions.set(extension.id, Object.freeze({ ...extension }));
  return extensions.get(extension.id);
}

export function getPaperExtension(id) {
  return extensions.get(id);
}

export function listPaperExtensions() {
  return [...extensions.values()];
}

const mermaidExtension = registerPaperExtension({
  id: 'mermaid',
  matches: (block) =>
    block?.type === 'code' && block.lang?.toLowerCase() === 'mermaid',
  renderHtml: (block) =>
    `<figure class="paper-diagram paper-mermaid" data-mermaid="${escapeAttribute(block.text)}">` +
    '<div class="paper-diagram-source"><span class="paper-diagram-label">Mermaid diagram</span>' +
    `<pre><code>${escapeHtml(block.text) || '<br>'}</code></pre></div></figure>`
});

const mathjaxExtension = registerPaperExtension({
  id: 'mathjax',
  matches: (block) => block?.type === 'math',
  renderHtml: (block) =>
    `<div class="paper-math paper-math-${block.display ? 'display' : 'inline'}" data-math="${escapeAttribute(block.source)}">` +
    `<span class="paper-math-source">${escapeHtml(block.source)}</span></div>`
});

export { mathjaxExtension, mermaidExtension };

export function parsePaperMarkdown(text) {
  return parseMarkdown(text).map((block) => {
    if (
      block.type === 'code' &&
      block.lang &&
      block.lang.toLowerCase() === 'mermaid'
    ) {
      return { ...block, type: 'diagram', engine: 'mermaid' };
    }
    if (
      block.type === 'code' &&
      ['math', 'latex', 'tex', 'mathjax'].includes(block.lang.toLowerCase())
    ) {
      return { type: 'math', display: true, source: block.text };
    }
    return block;
  });
}

function renderBlock(block) {
  const extension = [...extensions.values()].find((entry) =>
    entry.matches(block)
  );
  if (extension) return extension.renderHtml(block);
  if (block.type === 'diagram') {
    return mermaidExtension.renderHtml({
      ...block,
      type: 'code',
      lang: 'mermaid'
    });
  }
  return blocksToHtml([block]);
}

function renderInlineMath(html) {
  const renderParagraph = (_match, content) => {
    let rendered = content.replace(/\\\[([\s\S]*?)\\\]/g, (_, source) =>
      mathjaxExtension.renderHtml({
        type: 'math',
        display: true,
        source: decodeTextEntities(source)
      })
    );
    rendered = rendered.replace(/\$\$([\s\S]*?)\$\$/g, (_, source) =>
      mathjaxExtension.renderHtml({
        type: 'math',
        display: true,
        source: decodeTextEntities(source)
      })
    );
    rendered = rendered.replace(/\\\(([^\n]*?)\\\)/g, (_, source) =>
      mathjaxExtension.renderHtml({
        type: 'math',
        display: false,
        source: decodeTextEntities(source)
      })
    );
    rendered = rendered.replace(/(?<!\$)\$([^$\n]+)\$(?!\$)/g, (_, source) =>
      mathjaxExtension.renderHtml({
        type: 'math',
        display: false,
        source: decodeTextEntities(source)
      })
    );
    return `<p>${rendered}</p>`;
  };
  return html.replace(/<p>([\s\S]*?)<\/p>/g, renderParagraph);
}

export function paperBlocksToHtml(blocks) {
  return renderInlineMath(blocks.map(renderBlock).join(''));
}

export async function enhancePaperExtensions(root) {
  if (!root) return;
  const mermaid = globalThis.mermaid;
  if (mermaid && typeof mermaid.render === 'function') {
    const diagrams = [...root.querySelectorAll('[data-mermaid]')];
    for (const [index, node] of diagrams.entries()) {
      try {
        const rendered = await mermaid.render(
          `paper-mermaid-${index}`,
          node.dataset.mermaid
        );
        const svg = typeof rendered === 'string' ? rendered : rendered.svg;
        if (svg) node.innerHTML = svg;
      } catch {
        // Keep the escaped source fallback visible when Mermaid rejects input.
      }
    }
  }
  const mathJax = globalThis.MathJax;
  if (mathJax && typeof mathJax.typesetPromise === 'function') {
    const math = [...root.querySelectorAll('[data-math]')];
    for (const node of math) node.textContent = node.dataset.math || '';
    try {
      await mathJax.typesetPromise(math);
    } catch {
      // The TeX source remains visible as an offline fallback.
    }
  }
}
