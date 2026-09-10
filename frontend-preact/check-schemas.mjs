// Schema validation tests for `src/schemas.js`: quiz payloads normalize to
// safe shapes, invalid entries are dropped, and limits mirror the backend.
// Run: `npm test`. `zig build test` runs it via `npm run test`.
import {
  parseQuizCollection,
  parseQuizCollectionList,
  parseQuizQuestion
} from './src/schemas.js';

let failures = 0;

function check(name, condition, extra = '') {
  if (condition) {
    console.log(`ok: ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL: ${name}${extra ? ` (${extra})` : ''}`);
  }
}

const question = {
  id: 'q1',
  topic: 'General',
  question: 'What is Zig?',
  answer: 'A systems language.',
  explanation: 'Low-level control.',
  difficulty: 'Starter',
  tags: ['systems', '', 42, 'x'.repeat(65)]
};
const parsed = parseQuizQuestion(question);
check(
  'question normalizes tags and keeps fields',
  parsed !== null &&
    parsed.topic === 'General' &&
    parsed.tags.length === 1 &&
    parsed.tags[0] === 'systems'
);
check('question rejects empty prompt', parseQuizQuestion({ ...question, question: '  ' }) === null);
check('question rejects missing id', parseQuizQuestion({ ...question, id: '' }) === null);
check('question rejects oversized answer', parseQuizQuestion({ ...question, answer: 'x'.repeat(20001) }) === null);
check('question rejects non-objects', parseQuizQuestion(null) === null);

const collection = {
  id: 'c1',
  title: 'Zig Basics',
  description: 'First deck',
  tone: 'gold',
  level: 'Custom',
  questions: [question, { id: '', question: '', answer: '' }]
};
const parsedCollection = parseQuizCollection(collection);
check(
  'collection fills defaults and drops bad questions',
  parsedCollection !== null &&
    parsedCollection.shortTitle === 'Zig Basics' &&
    parsedCollection.questions.length === 1
);
check(
  'collection rejects empty titles',
  parseQuizCollection({ ...collection, title: '' }) === null
);
check(
  'collection list drops invalid entries',
  parseQuizCollectionList([collection, null, 'junk']).length === 1 &&
    parseQuizCollectionList('junk').length === 0
);

if (failures > 0) process.exit(1);
console.log('schemas: all tests passed');
