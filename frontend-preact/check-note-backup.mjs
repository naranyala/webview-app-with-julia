import {
  backupFileName,
  NOTE_BACKUP_SCHEMA_VERSION,
  parseNotesBackup,
  planNotesRestore,
  serializeNotesBackup
} from './src/plugins/note-backup.js';

let failures = 0;

function check(name, condition, extra = '') {
  if (condition) {
    console.log(`ok: ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL: ${name}${extra ? ` (${extra})` : ''}`);
  }
}

function expectThrow(name, fn, fragment) {
  try {
    fn();
    check(name, false, 'did not throw');
  } catch (error) {
    check(name, String(error?.message || error).includes(fragment), error?.message);
  }
}

const notes = [
  {
    id: 'note-1',
    title: 'First',
    tag: 'Draft',
    updated: '2026-01-01',
    body: 'Question:\nQ\n\nAnswer:\nA'
  },
  {
    id: 'note-2',
    title: 'Second',
    tag: 'Work',
    updated: '2026-01-02',
    body: 'plain body'
  }
];

const stampDate = new Date('2026-03-04T05:06:00.000Z');
const pad2 = (value) => String(value).padStart(2, '0');
const expectedStamp =
  `${stampDate.getFullYear()}${pad2(stampDate.getMonth() + 1)}${pad2(stampDate.getDate())}` +
  `-${pad2(stampDate.getHours())}${pad2(stampDate.getMinutes())}`;
const { filename, json } = serializeNotesBackup(notes, stampDate);
check('filename carries timestamp', filename === `chain-notes-backup-${expectedStamp}.json`, filename);
const envelope = JSON.parse(json);
check('envelope version', envelope.schemaVersion === NOTE_BACKUP_SCHEMA_VERSION);
check('envelope app tag', envelope.app === 'chain-notes');
check('envelope count', envelope.count === 2 && envelope.notes.length === 2);

const roundTrip = parseNotesBackup(json);
check('round trip keeps notes', roundTrip.notes.length === 2);
check('round trip keeps ids', roundTrip.notes[0].id === 'note-1');
check('no skips on valid file', roundTrip.skipped === 0);

expectThrow('rejects malformed json', () => parseNotesBackup('{nope'), 'not valid JSON');
expectThrow('rejects non-object', () => parseNotesBackup('[1,2]'), 'not a Chain Notes backup');
expectThrow(
  'rejects future version',
  () => parseNotesBackup(JSON.stringify({ schemaVersion: 99, notes: [] })),
  'Unsupported backup version 99'
);
expectThrow(
  'rejects missing notes',
  () => parseNotesBackup(JSON.stringify({ schemaVersion: 1 })),
  'no notes to restore'
);

const mixed = parseNotesBackup(
  JSON.stringify({
    schemaVersion: 1,
    notes: [
      { id: 'ok-1', title: 'Keep', tag: 't', updated: '', body: 'b' },
      { id: '', title: 'No id', body: 'b' },
      { id: 'big', title: 'Too big', body: 'x'.repeat(512 * 1024 + 1) },
      'garbage',
      { id: 'blank-title', title: '   ', tag: 't', body: 'b' }
    ]
  })
);
check('bad entries skipped', mixed.skipped === 3, `skipped=${mixed.skipped}`);
check('good entries kept', mixed.notes.length === 2);
check(
  'blank title coerced',
  mixed.notes.find((note) => note.id === 'blank-title')?.title === 'Untitled note'
);

const plan = planNotesRestore(
  [
    { id: 'note-1', title: 'First', tag: 'Draft', body: 'Question:\nQ\n\nAnswer:\nA' },
    { id: 'note-1b', title: 'Changed', tag: 'Draft', body: 'new' },
    { id: 'fresh', title: 'New', tag: '', body: 'b' }
  ],
  [
    { id: 'note-1', title: 'First', tag: 'Draft', body: 'Question:\nQ\n\nAnswer:\nA' },
    { id: 'note-1b', title: 'Old', tag: 'Draft', body: 'old' }
  ]
);
check('identical note unchanged', plan.unchanged === 1);
check('edited note updates', plan.toUpdate.length === 1 && plan.toUpdate[0].id === 'note-1b');
check('missing note creates', plan.toCreate.length === 1 && plan.toCreate[0].id === 'fresh');

const yearEnd = new Date('2026-12-31T23:59:00.000Z');
const expectedYearEnd =
  `${yearEnd.getFullYear()}${pad2(yearEnd.getMonth() + 1)}${pad2(yearEnd.getDate())}` +
  `-${pad2(yearEnd.getHours())}${pad2(yearEnd.getMinutes())}`;
check('backup filename default', backupFileName(yearEnd) === `chain-notes-backup-${expectedYearEnd}.json`);

if (failures > 0) process.exit(1);
console.log('note backup: all tests passed');
