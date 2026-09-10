import { createNoteSearcher, searchNotes } from './src/plugins/note-search.js';

let failures = 0;

function check(name, condition, extra = '') {
  if (condition) {
    console.log(`ok: ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL: ${name}${extra ? ` (${extra})` : ''}`);
  }
}

const notes = [
  {
    id: 'note-1',
    title: 'Local persistence',
    tag: 'storage',
    updated: 'Just now',
    body: 'Question:\nHow should notes survive a restart?\n\nAnswer:\nUse an atomic local JSON file.'
  },
  {
    id: 'note-2',
    title: 'Atomic writes',
    tag: 'backend',
    updated: 'Just now',
    body: 'Question:\nWhy write a temporary file first?\n\nAnswer:\nA rename prevents partial reads.'
  },
  {
    id: 'note-3',
    title: 'Blender rendering',
    tag: 'reference',
    updated: 'Just now',
    body: 'Question:\nWhich render engine should I choose?\n\nAnswer:\nUse Eevee for speed.'
  }
];

const searcher = createNoteSearcher(notes);
check('empty query returns all', searcher.search('').length === 3);
check(
  'whitespace query returns all',
  searcher.search('   ').length === 3
);
check(
  'exact title ranks first',
  searchNotes(notes, 'persistence')[0]?.id === 'note-1'
);
// Omission-style typo: fuzzysort matches subsequences, not substitutions.
check(
  'typo tolerates missing letter',
  searchNotes(notes, 'persistnce').some((note) => note.id === 'note-1')
);
check(
  'unrelated query returns nothing',
  searchNotes(notes, 'zzzqqq').length === 0
);

if (failures > 0) process.exit(1);
console.log('note search: all tests passed');
