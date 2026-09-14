import {
  getPaperExtension,
  listPaperExtensions,
  paperBlocksToHtml,
  parsePaperMarkdown,
  registerPaperExtension
} from './src/plugins/paper-extensions.js';

let failures = 0;
function check(name, condition) {
  if (condition) console.log(`ok: ${name}`);
  else {
    failures += 1;
    console.error(`FAIL: ${name}`);
  }
}

const source =
  'Inline $x^2$ and display \\(y = mx + b\\).\n\n' +
  '```mermaid\n' +
  'flowchart LR\nA --> B\n' +
  '```\n\n' +
  '```math\n\\frac{1}{2}\n```';
const blocks = parsePaperMarkdown(source);
check('built-in Mermaid extension is registered', getPaperExtension('mermaid'));
check('built-in MathJax extension is registered', getPaperExtension('mathjax'));
check('Mermaid fences become diagram blocks', blocks.some((block) => block.type === 'diagram'));
check('math fences become math blocks', blocks.some((block) => block.type === 'math'));
const html = paperBlocksToHtml(blocks);
check('Mermaid source is escaped and marked for enhancement', html.includes('data-mermaid="flowchart LR'));
check('Math source is marked for MathJax', html.includes('data-math="y = mx + b"'));
check('inline math is marked for MathJax', html.includes('data-math="x^2"'));
check(
  'inline math restores escaped comparison operators',
  paperBlocksToHtml(parsePaperMarkdown('Compare $a < b$')).includes(
    'data-math="a &lt; b"'
  )
);
const quoted = paperBlocksToHtml(
  parsePaperMarkdown('```mermaid\nA["Quoted node"]\n```')
);
check('extension attributes escape quotes', quoted.includes('&quot;Quoted node&quot;'));

registerPaperExtension({
  id: 'test-extension',
  matches: (block) => block.type === 'code' && block.lang === 'test',
  renderHtml: (block) => `<aside data-test-extension="true">${block.text}</aside>`
});
check('custom paper extensions can be registered', listPaperExtensions().some((entry) => entry.id === 'test-extension'));
check(
  'custom paper extensions render through the registry',
  paperBlocksToHtml(parsePaperMarkdown('```test\nhello\n```')).includes('data-test-extension="true"')
);

if (failures > 0) process.exit(1);
console.log('paper extensions: all tests passed');
