import {
  parseExternalChat,
  parseStoredQna,
  serializeQna
} from './src/plugins/qna.js';

let failures = 0;

function check(name, condition) {
  if (condition) console.log(`ok: ${name}`);
  else {
    failures += 1;
    console.error(`FAIL: ${name}`);
  }
}

const stored = serializeQna('How do I cache a response?', 'Use a local file store.');
const parsedStored = parseStoredQna(stored);
check(
  'stored Q&A round trips',
  parsedStored.question === 'How do I cache a response?' &&
    parsedStored.answer === 'Use a local file store.'
);

const emptyStored = parseStoredQna(serializeQna('', ''));
check('empty Q&A records remain valid', emptyStored.question === '' && emptyStored.answer === '');

const legacy = parseStoredQna('An older free-form note.');
check(
  'legacy notes remain readable',
  legacy.question === '' && legacy.answer === 'An older free-form note.'
);

const labeled = parseExternalChat(
  'Question: What is local storage?\n\nAnswer: Browser storage for small values.'
);
check(
  'Question and Answer labels import',
  labeled?.question === 'What is local storage?' &&
    labeled.answer === 'Browser storage for small values.'
);

const roles = parseExternalChat(
  'User: Explain atomic writes.\n\nAssistant: Write a temporary file, then rename it.'
);
check(
  'User and Assistant labels import',
  roles?.question === 'Explain atomic writes.' &&
    roles.answer === 'Write a temporary file, then rename it.'
);

const paragraphs = parseExternalChat(
  'Why keep notes locally?\n\nThey remain available without a network connection.'
);
check(
  'two-paragraph chats import',
  paragraphs?.question === 'Why keep notes locally?' &&
    paragraphs.answer === 'They remain available without a network connection.'
);

if (failures > 0) process.exit(1);
console.log('Q&A parsing: all tests passed');
