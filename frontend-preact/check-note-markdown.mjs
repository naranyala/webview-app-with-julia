// Markdown subset tests for `src/plugins/note-markdown.js`: block parsing,
// inline spans, HTML rendering, and the strict print reset.
// Run: `npm test`. `zig build test` runs it via `npm run test`.
import {
  blocksToHtml,
  FIGURE_BLOCK_PATTERN,
  parseInline,
  parseMarkdown,
  PRINT_CSS_RESET,
  sanitizeSvg
} from './src/plugins/note-markdown.js';

let failures = 0;

function check(name, condition, extra = '') {
  if (condition) {
    console.log(`ok: ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL: ${name}${extra ? ` (${extra})` : ''}`);
  }
}

check('empty input parses to no blocks', parseMarkdown('').length === 0);

const fence = parseMarkdown('Intro\n\n```js\nconst x = 1;\n  indented();\n```\n\nDone');
check(
  'fenced code keeps language and indentation',
  fence.length === 3 &&
    fence[1].type === 'code' &&
    fence[1].lang === 'js' &&
    fence[1].text === 'const x = 1;\n  indented();',
  JSON.stringify(fence.map((block) => block.type))
);

const unclosed = parseMarkdown('```py\nprint(1)');
check(
  'unclosed fence runs to end of input',
  unclosed.length === 1 &&
    unclosed[0].type === 'code' &&
    unclosed[0].text === 'print(1)'
);

const headings = parseMarkdown('# Title\n## Sub\n### S3\n#### S4\n#nospace');
check(
  'atx headings carry levels, #nospace stays a paragraph',
  headings.length === 5 &&
    headings[0].level === 1 &&
    headings[3].level === 4 &&
    headings[4].type === 'para'
);

const spans = parseInline('Use **bold** and *italic* with `code()` ok');
check(
  'inline spans split bold, italic, and code',
  spans.some((span) => span.t === 'bold' && span.b) &&
    spans.some((span) => span.t === 'italic' && span.i) &&
    spans.some((span) => span.t === 'code()' && span.c)
);

const unclosedInline = parseInline('Keep *literal and `open');
check(
  'unclosed markers stay literal',
  unclosedInline.some((span) => span.t.includes('*literal')) &&
    unclosedInline.some((span) => span.t.includes('`open'))
);

const list = parseMarkdown('- one\n- two\n\n1. first\n2. second');
check(
  'bullets and numbered lists group',
  list.length === 2 &&
    list[0].type === 'list' &&
    !list[0].ordered &&
    list[0].items.length === 2 &&
    list[1].ordered &&
    list[1].items.length === 2
);

const quote = parseMarkdown('> line one\n> line two');
check(
  'quote lines join one block',
  quote.length === 1 && quote[0].type === 'quote'
);

const rule = parseMarkdown('Above\n\n---\n\nBelow');
check(
  'rule splits paragraphs',
  rule.length === 3 && rule[1].type === 'rule'
);

const html = blocksToHtml(
  parseMarkdown('## Hi\n\n```js\nconst x = 1;\n```\n\n- a\n\n> q')
);
check(
  'html renders headings, code, lists, and quotes',
  html.includes('<h2>Hi</h2>') &&
    html.includes('<pre><code') &&
    html.includes('const x = 1;') &&
    html.includes('<ul><li>a</li></ul>') &&
    html.includes('<blockquote>q</blockquote>'),
  html
);

const escaped = blocksToHtml(parseMarkdown('<script>alert(1)</script>'));
check(
  'html escapes raw markup',
  !escaped.includes('<script>') && escaped.includes('&lt;script&gt;')
);

check(
  'print reset hides the app and styles code',
  PRINT_CSS_RESET.includes('#app{display:none!important}') &&
    PRINT_CSS_RESET.includes('#chain-print-root pre') &&
    PRINT_CSS_RESET.includes('@page{margin:15mm}')
);

const figureLine = '![Data flow](fig:architecture)';
check(
  'figure pattern matches full-line embeds only',
  FIGURE_BLOCK_PATTERN.test(figureLine) &&
    !FIGURE_BLOCK_PATTERN.test(`See ${figureLine} here`)
);
const figureBlock = parseMarkdown(`Intro\n\n${figureLine}\n\nDone`);
check(
  'figure markers parse to figure blocks with id and alt',
  figureBlock.length === 3 &&
    figureBlock[1].type === 'figure' &&
    figureBlock[1].id === 'architecture' &&
    figureBlock[1].alt === 'Data flow'
);
const figureHtml = blocksToHtml([
  {
    type: 'figure',
    id: 'fig-architecture',
    alt: 'Alt',
    number: 2,
    caption: 'Cap',
    figure: { id: 'fig-architecture', caption: 'Cap', svg: '<svg></svg>' }
  }
]);
check(
  'enriched figures render number, art, and caption',
  figureHtml.includes('Figure 2') &&
    figureHtml.includes('<svg></svg>') &&
    figureHtml.includes('<figcaption>Cap</figcaption>')
);
const unknownHtml = blocksToHtml([{ type: 'figure', id: 'fig-gone', alt: '' }]);
check(
  'unenriched figures label the missing id',
  unknownHtml.includes('Unknown figure: fig-gone')
);
check(
  'svg sanitize strips scripts and handlers',
  !sanitizeSvg(
    '<svg onclick="evil()"><script>alert(1)</script><a href="javascript:x">t</a></svg>'
  ).match(/script|onclick|javascript:/i)
);

if (failures > 0) process.exit(1);
console.log('note markdown: all tests passed');
