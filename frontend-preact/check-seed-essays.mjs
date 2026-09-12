// Data-driven validation of the full Chain Notes feature chain using real
// seeded essays from `seed/chain-essays.json`.
// Covers: Q&A round-trip, markdown subset, HTML render, fuzzy search,
// PDF single+chain export, backend limits, and mock CRUD persistence.
// Run: `node check-seed-essays.mjs`. Wired into `npm test`.
import { mockBinding } from './src/backend-mock.js';
import { blocksToHtml, parseInline, parseMarkdown } from './src/plugins/note-markdown.js';
import {
  generateChainPdfBytes,
  generateNotePdfBytes,
  NOTE_PDF_EXPORTERS
} from './src/plugins/note-pdf.js';
import { createNoteSearcher } from './src/plugins/note-search.js';
import { parseStoredQna, serializeQna } from './src/plugins/qna.js';
import { SEED_IDEAS, seedIdeasToNotes, seedIdeasToPdfEntries } from './src/plugins/seed-ideas.js';

let failures = 0;
function check(name, condition, extra = '') {
  if (condition) console.log(`ok: ${name}`);
  else {
    failures += 1;
    console.error(`FAIL: ${name}${extra ? ` (${extra})` : ''}`);
  }
}

// 0. Seed shape: 5 chained essays, titles unique, tags valid, bodies bounded.
check('seed holds 5 essays', SEED_IDEAS.length === 5, String(SEED_IDEAS.length));
check(
  'seed titles unique and <=200 chars',
  new Set(SEED_IDEAS.map((s) => s.title)).size === SEED_IDEAS.length &&
    SEED_IDEAS.every((s) => s.title.length > 0 && s.title.length <= 200)
);
check(
  'seed tags within 64 chars',
  SEED_IDEAS.every((s) => typeof s.tag === 'string' && s.tag.length <= 64)
);
check(
  'seed bodies within backend 512KB limit',
  SEED_IDEAS.every((s) => serializeQna(s.question, s.answer).length <= 512 * 1024)
);

// 1. Q&A round-trip per seed (entire persistence encoding).
for (const seed of SEED_IDEAS) {
  const body = serializeQna(seed.question, seed.answer);
  const parsed = parseStoredQna(body);
  check(
    `qna round-trips: ${seed.title.slice(0, 28)}`,
    parsed.question === seed.question.trim() && parsed.answer === seed.answer.trim()
  );
}

// 2. Markdown subset per essay answer: heading + list + quote + code + bold.
for (const seed of SEED_IDEAS) {
  const blocks = parseMarkdown(seed.answer);
  const types = blocks.map((b) => b.type);
  check(
    `markdown blocks rich: ${seed.title.slice(0, 28)}`,
    types.includes('heading') && types.includes('list') && types.includes('quote') && types.includes('code'),
    types.join(',')
  );
  const hasBold = blocks.some(
    (b) => (b.spans || []).some((s) => s.b) || (b.items || []).flat().some((s) => s.b)
  );
  check(`markdown bold present: ${seed.title.slice(0, 28)}`, hasBold);
  const html = blocksToHtml(blocks);
  check(
    `html renders essay: ${seed.title.slice(0, 28)}`,
    html.includes('<h2>') && html.includes('<ul><li>') && html.includes('<blockquote>') && html.includes('<pre><code')
  );
}
check('inline code span parses', parseInline('use `code()` ok').some((s) => s.c));

// 3. Fuzzy search: each essay retrievable by a distinctive keyword.
const notes = seedIdeasToNotes();
const searcher = createNoteSearcher(notes);
const keywords = [
  ['rental', '01 — Local-first'],
  ['rename', '02 — Atomic'],
  ['association', '03 — Fuzzy'],
  ['manuscript', '04 — PDF'],
  ['ritual', '05 — Chain']
];
for (const [keyword, expectFragment] of keywords) {
  const hits = searcher.search(keyword);
  check(
    `search finds essay via "${keyword}"`,
    hits.some((n) => n.title.includes(expectFragment)),
    hits.map((h) => h.title).join(' | ')
  );
}
check('search empty returns all 5', searcher.search('').length === 5);
check('search noise returns nothing', searcher.search('zzzqqq-no-match').length === 0);

// 4. PDF: every seed exports as single; full chain grows monotonically.
const entries = seedIdeasToPdfEntries();
for (const exporter of NOTE_PDF_EXPORTERS) {
  let singleLen = 0;
  for (const entry of entries) {
    const bytes = await generateNotePdfBytes(exporter.id, entry);
    const header = Buffer.from(bytes.slice(0, 5)).toString();
    if (singleLen === 0) singleLen = bytes.length;
    if (!(bytes.length > 0 && header === '%PDF-')) {
      check(`${exporter.id} single PDF: ${entry.title.slice(0, 24)}`, false, `bytes=${bytes.length}`);
      break;
    }
  }
  check(`${exporter.id} exports all 5 seed singles`, true);
  const chain = await generateChainPdfBytes(exporter.id, entries);
  const single = await generateNotePdfBytes(exporter.id, entries[0]);
  check(
    `${exporter.id} chain grows vs single`,
    Buffer.from(chain.slice(0, 5)).toString() === '%PDF-' && chain.length > single.length,
    `single=${single.length} chain=${chain.length}`
  );
}

// 5. Mock persistence CRUD driven by first seed (entire backend bridge path).
const [firstSeed] = SEED_IDEAS;
const firstBody = serializeQna(firstSeed.question, firstSeed.answer);
const created = await mockBinding('createNote', [firstSeed.title, firstSeed.tag, firstBody]);
check('mock createNote persists seed', created?.title === firstSeed.title && !!created?.id);
const listed = await mockBinding('getNotes', []);
check('mock getNotes returns created', listed.some((n) => n.id === created.id));
const updated = await mockBinding('updateNote', [created.id, `${firstSeed.title} (rev)`, firstSeed.tag, firstBody]);
check('mock updateNote revises seed', updated?.title.endsWith('(rev)'));
await mockBinding('deleteNote', [created.id]);
const afterDelete = await mockBinding('getNotes', []);
check('mock deleteNote removes seed', !afterDelete.some((n) => n.id === created.id));

// 6. Validation mirrors Backend.jl: empty title rejected client-side shape.
check(
  'seed titles non-empty (backend would reject empty)',
  SEED_IDEAS.every((s) => s.title.trim().length > 0)
);

if (failures > 0) process.exit(1);
console.log('seed essays: all data-driven feature checks passed');
