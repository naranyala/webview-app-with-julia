// Bridge error-handling tests: normalization, timeouts, client-side
// validation, and mock/unavailable behavior in `src/backend.js`.
// Run: `npm test`. `zig build test` runs it via `npm run test`.
import {
  backend,
  backendError,
  errorDetails,
  getDefaultTimeout,
  setDefaultTimeout
} from './src/backend.js';

let failures = 0;

function check(name, condition, extra = '') {
  if (condition) {
    console.log(`ok: ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL: ${name}${extra ? ` (${extra})` : ''}`);
  }
}

function withWindow(stub, fn) {
  const previous = globalThis.window;
  globalThis.window = stub;
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      if (previous === undefined) delete globalThis.window;
      else globalThis.window = previous;
    });
}

// 1. Mock fallbacks when no bindings exist.
await withWindow({}, async () => {
  check('mock increment resolves 0', (await backend.increment(1)) === 0);
  check('mock getStatus resolves ok', (await backend.getStatus()) === 'ok');
  const note = await backend.createNote('Mock note', 'Test', 'Body');
  check('mock create note returns an id', note.id.startsWith('note-mock-'));
  check('mock list returns created note', (await backend.getNotes()).length === 1);
  const updated = await backend.updateNote(note.id, 'Updated mock note', 'Saved', 'Changed');
  check('mock update note changes title', updated.title === 'Updated mock note');
  await backend.deleteNote(note.id);
  check('mock delete note removes note', (await backend.getNotes()).length === 0);
});

// 2. Native values pass through with args forwarded.
await withWindow(
  {
    increment: (delta) => Promise.resolve(delta * 2),
    getStatus: () => Promise.resolve('ok')
  },
  async () => {
    check('native increment forwards args', (await backend.increment(21)) === 42);
    check('native getStatus passes through', (await backend.getStatus()) === 'ok');
  }
);

// 3. Structured envelope rejections normalize to code + message.
await withWindow(
  {
    increment: () =>
      Promise.reject(
        new Error('{"code":"MalformedJson","message":"arguments must be JSON"}')
      )
  },
  async () => {
    try {
      await backend.increment(1);
      check('envelope rejection surfaces', false);
    } catch (error) {
      const details = errorDetails(error);
      check('envelope code preserved', details.code === 'MalformedJson', details.code);
      check(
        'envelope message preserved',
        details.message === 'arguments must be JSON',
        details.message
      );
    }
  }
);

// 4. Bare backend error names map to friendly messages.
await withWindow(
  { minimizeWindow: () => Promise.reject(new Error('"WindowUnavailable"')) },
  async () => {
    try {
      await backend.minimizeWindow();
      check('bare-name rejection surfaces', false);
    } catch (error) {
      const details = errorDetails(error);
      check('bare-name code preserved', details.code === 'WindowUnavailable', details.code);
      check(
        'bare-name has friendly message',
        details.message === 'The native window is unavailable.',
        details.message
      );
    }
  }
);

// 5. Hanging bindings time out with code Timeout.
setDefaultTimeout(30);
await withWindow({ getStatus: () => new Promise(() => {}) }, async () => {
  try {
    await backend.getStatus();
    check('timeout fires', false);
  } catch (error) {
    check('timeout code is Timeout', errorDetails(error).code === 'Timeout');
  }
});
setDefaultTimeout(getDefaultTimeout() === 30 ? 5000 : getDefaultTimeout());
check('default timeout restored', getDefaultTimeout() === 5000);

// 6. Missing bindings with mocks disabled reject as Unavailable.
await withWindow({ __PREACT_MOCK_BRIDGE__: false }, async () => {
  try {
    await backend.reset();
    check('unavailable rejection surfaces', false);
  } catch (error) {
    check('unavailable code is Unavailable', errorDetails(error).code === 'Unavailable');
  }
});

// 7. Client-side validation rejects without touching the binding.
let bindingCalled = false;
await withWindow(
  {
    increment: () => {
      bindingCalled = true;
      return Promise.resolve(0);
    }
  },
  async () => {
    try {
      await backend.increment('two');
      check('invalid delta rejected', false);
    } catch (error) {
      check('invalid delta code is InvalidArgument', errorDetails(error).code === 'InvalidArgument');
      check('binding not called for invalid delta', bindingCalled === false);
    }
  }
);

// 8. backendError stays a display string for all shapes.
check(
  'backendError formats envelopes',
  backendError(new Error('{"code":"Timeout","message":"slow"}')) === 'slow'
);
check(
  'backendError formats unknown input',
  typeof backendError(null) === 'string' && backendError(null).length > 0
);
check(
  'storage errors have friendly messages',
  errorDetails(new Error('{"code":"StorageWriteFailed"}')).message ===
    'The note could not be saved.'
);

// 9. savePdf validates locally and resolves a path through the mock.
await withWindow({}, async () => {
  const saved = await backend.savePdf('chain-notes.pdf', 'aGVsbG8=');
  check('mock savePdf returns a path', saved.path === 'Documents/chain-notes.pdf');
  try {
    await backend.savePdf('../evil.pdf', 'aGVsbG8=');
    check('invalid pdf name rejected', false);
  } catch (error) {
    check('invalid pdf name code is InvalidArgument', errorDetails(error).code === 'InvalidArgument');
  }
  try {
    await backend.savePdf('chain-notes.pdf', '');
    check('empty pdf data rejected', false);
  } catch (error) {
    check('empty pdf data code is InvalidArgument', errorDetails(error).code === 'InvalidArgument');
  }
});
check(
  'pdf errors have friendly messages',
  errorDetails(new Error('{"code":"PdfWriteFailed"}')).message ===
    'The PDF could not be saved.'
);

// 10. quiz CRUD round-trips through the mock store.
await withWindow({}, async () => {
  check('mock quiz list starts empty', (await backend.quizList()).length === 0);
  const collection = await backend.quizCreateCollection(
    'Zig Basics',
    'First deck',
    'gold',
    'Custom'
  );
  check('mock quiz collection has an id', collection.id.startsWith('quiz-mock-col-'));
  check(
    'mock quiz list returns created deck',
    (await backend.quizList()).length === 1
  );
  const updated = await backend.quizUpdateCollection(
    collection.id,
    'Zig 101',
    'Renamed deck'
  );
  check('mock quiz collection renames', updated.title === 'Zig 101');
  const question = await backend.quizCreateQuestion(
    collection.id,
    'General',
    'What is Zig?',
    'A systems language.'
  );
  check('mock quiz question has an id', question.id.startsWith('quiz-mock-q-'));
  const edited = await backend.quizUpdateQuestion(
    collection.id,
    question.id,
    'General',
    'What is Zig?',
    'A systems programming language.',
    '',
    'Starter',
    'systems, languages'
  );
  check(
    'mock quiz question edits answer and tags',
    edited.answer === 'A systems programming language.' &&
      edited.tags.length === 2
  );
  await backend.quizDeleteQuestion(collection.id, question.id);
  check(
    'mock quiz question deletes',
    (await backend.quizList())[0].questions.length === 0
  );
  await backend.quizDeleteCollection(collection.id);
  check('mock quiz deck deletes', (await backend.quizList()).length === 0);
  try {
    await backend.quizUpdateCollection('missing', 'T', 'D');
    check('missing quiz deck rejected', false);
  } catch (error) {
    check('missing quiz deck code is QuizNotFound', errorDetails(error).code === 'QuizNotFound');
  }
  try {
    await backend.quizCreateCollection('', 'D', '', '');
    check('empty quiz title rejected', false);
  } catch (error) {
    check('empty quiz title code is InvalidArgument', errorDetails(error).code === 'InvalidArgument');
  }
});
check(
  'quiz errors have friendly messages',
  errorDetails(new Error('{"code":"QuizNotFound"}')).message ===
    'The quiz item no longer exists.'
);

if (failures > 0) {
  console.error(`${failures} bridge error test(s) failed`);
  process.exit(1);
}
console.log('bridge error handling: all tests passed');
