// Academic paper abstraction tests: model defaults, validation, citation
// resolution, and statistics in `src/plugins/paper.js` plus the bundled
// sample in `src/plugins/paper-data.js`.
// Run: `npm test`. `zig build test` runs it via `npm run test`.
import {
  bundledPapers,
  getPaper,
  samplePaper
} from './src/plugins/paper-data.js';
import {
  citedKeys,
  createPaper,
  embeddedFigureIds,
  enrichFigureBlocks,
  figureKind,
  paperStats,
  resolveCitations,
  resolveFigures,
  validatePaper
} from './src/plugins/paper.js';

let failures = 0;

function check(name, condition, extra = '') {
  if (condition) {
    console.log(`ok: ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL: ${name}${extra ? ` (${extra})` : ''}`);
  }
}

check('sample paper validates clean', validatePaper(samplePaper).length === 0);
check('bundle is non-empty', bundledPapers.length > 0);
check('getPaper round-trips', getPaper(samplePaper.id) === samplePaper);

const defaults = createPaper({ title: 'Hello World' });
check('id slugifies from title', defaults.id === 'hello-world');
check('status defaults to draft', defaults.status === 'draft');
check(
  'unknown status falls back to draft',
  createPaper({ title: 'T', status: 'carved' }).status === 'draft'
);

check(
  'missing title is reported',
  validatePaper({
    id: 'x',
    title: '',
    status: 'draft',
    authors: [{ name: 'A' }],
    sections: [],
    references: []
  }).includes('paper title is required')
);
check(
  'missing authors are reported',
  validatePaper(createPaper({ title: 'T', sections: [] })).some((error) =>
    error.includes('author')
  )
);
check(
  'duplicate section ids are reported',
  validatePaper(
    createPaper({
      title: 'T',
      authors: [{ name: 'A' }],
      sections: [
        { id: 's', title: 'One', body: 'x' },
        { id: 's', title: 'Two', body: 'y' }
      ]
    })
  ).includes('duplicate section id: s')
);
check(
  'cited-but-missing references are reported',
  validatePaper(
    createPaper({
      title: 'T',
      authors: [{ name: 'A' }],
      sections: [{ id: 's', title: 'One', body: 'See [@ghost].' }]
    })
  ).includes('cited but unlisted reference: ghost')
);

const cited = createPaper({
  title: 'T',
  authors: [{ name: 'A' }],
  abstract: 'First [@beta] then [@alpha].',
  sections: [{ id: 's', title: 'One', body: 'Again [@alpha] and [@beta].' }],
  references: [
    { key: 'alpha', text: 'Alpha work.' },
    { key: 'beta', text: 'Beta work.' }
  ]
});
check(
  'cited keys dedupe in appearance order',
  JSON.stringify(citedKeys(cited)) === JSON.stringify(['beta', 'alpha'])
);
const resolved = resolveCitations(cited);
check(
  'numbers follow first appearance across abstract and sections',
  resolved.abstract.includes('[1]') &&
    resolved.sections[0].body.includes('[2]') &&
    resolved.sections[0].body.includes('[1]') &&
    resolved.references[0].key === 'beta' &&
    resolved.references[1].key === 'alpha'
);

const missing = resolveCitations(
  createPaper({
    title: 'T',
    authors: [{ name: 'A' }],
    sections: [{ id: 's', title: 'One', body: 'See [@ghost].' }]
  })
);
check(
  'unknown keys stay numbered with a placeholder reference',
  missing.sections[0].body.includes('[1]') &&
    missing.references[0].text === 'Missing reference.' &&
    missing.missing.includes('ghost')
);

const stats = paperStats(samplePaper);
check(
  'stats count sections and references',
  stats.sections === samplePaper.sections.length &&
    stats.references === samplePaper.references.length &&
    stats.words > 200 &&
    stats.readingMinutes >= 1,
  JSON.stringify(stats)
);

const withFigure = createPaper({
  title: 'F',
  authors: [{ name: 'A' }],
  sections: [
    { id: 's', title: 'One', body: 'See:\n\n![Flow](fig:flow)' },
    { id: 't', title: 'Two', body: 'Again:\n\n![Flow](fig:flow)\n\n![X](fig:ghost)' }
  ],
  figures: [
    { id: 'flow', caption: 'Flow diagram', svg: '<svg></svg>' }
  ]
});
check(
  'embedded figure ids dedupe in order',
  JSON.stringify(embeddedFigureIds(withFigure)) ===
    JSON.stringify(['flow', 'ghost'])
);
const figRes = resolveFigures(withFigure);
check(
  'figures number by first appearance with unknowns reported',
  figRes.order.length === 2 &&
    figRes.numbered.get('flow').number === 1 &&
    figRes.numbered.get('ghost').figure === null &&
    figRes.unknown.includes('ghost')
);
const enriched = enrichFigureBlocks(
  [{ type: 'figure', id: 'flow', alt: '' }],
  figRes
);
check(
  'figure blocks gain number, caption, and asset',
  enriched[0].number === 1 &&
    enriched[0].caption === 'Flow diagram' &&
    enriched[0].figure.id === 'flow'
);
check(
  'figure kinds classify svg, png, and junk',
  figureKind({ id: 'a', caption: 'c', svg: '<svg></svg>' }) === 'svg' &&
    figureKind({
      id: 'a',
      caption: 'c',
      dataUrl: 'data:image/png;base64,AAAA'
    }) === 'png' &&
    figureKind({ id: 'a', caption: 'c', dataUrl: 'data:text/plain,x' }) ===
      'unknown' &&
    figureKind(null) === 'missing'
);
check(
  'figure validation catches shape problems',
  validatePaper(
    createPaper({
      title: 'T',
      authors: [{ name: 'A' }],
      sections: [{ id: 's', title: 'One', body: '![X](fig:gone).' }],
      figures: [
        { id: 'dup', caption: 'One', svg: '<svg></svg>' },
        { id: 'dup', caption: '', dataUrl: 'data:text/plain,x' }
      ]
    })
  ).some((error) => error.includes('duplicate figure id')) &&
    validatePaper(withFigure).some((error) =>
      error.includes('embedded but unlisted figure: ghost')
    )
);
check(
  'stats count figures',
  paperStats(samplePaper).figures === samplePaper.figures.length &&
    samplePaper.figures.length === 1
);

if (failures > 0) process.exit(1);
console.log('academic paper: all tests passed');
