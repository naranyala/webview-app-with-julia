// Bridge error-handling tests: normalization, timeouts, client-side
// validation, and mock/unavailable behavior in `src/backend.js`.
// Run: `npm test`.
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
  check('mock getStatus resolves ok', (await backend.getStatus()).status === 'ok');
  const note = await backend.createNote('Mock note', 'Test', 'Body');
  check('mock create note returns an id', note.id.startsWith('note-mock-'));
  check('mock list returns created note', (await backend.getNotes()).length === 1);
  const updated = await backend.updateNote(note.id, 'Updated mock note', 'Saved', 'Changed');
  check('mock update note changes title', updated.title === 'Updated mock note');
  await backend.deleteNote(note.id);
  check('mock delete note removes note', (await backend.getNotes()).length === 0);
});

// Optional StaticMediaCompanion bindings use browser-safe mocks without
// changing the core native capability check.
await withWindow({}, async () => {
  check('mock media inspection parses', (await backend.inspectMedia('demo.md')).mime === 'text/markdown');
  check('mock markdown rendering returns text', (await backend.markdownToHtml('# Demo')).includes('<h1>'));
  check('mock media plan parses', (await backend.planConversion('a.md', 'a.html')).backend === 'julia');
  check('mock media capabilities parse', (await backend.getMediaCapabilities()).tools !== undefined);
});

// 2. Native values pass through with args forwarded.
await withWindow(
  {
    increment: (delta) => Promise.resolve(delta * 2),
    getStatus: () => Promise.resolve('ok')
  },
  async () => {
    check('native increment forwards args', (await backend.increment(21)) === 42);
    check('native getStatus passes through', (await backend.getStatus()).status === 'ok');
  }
);

// 3. Structured envelope rejections normalize to code + message.
await withWindow(
  {
    increment: () =>
      Promise.reject(
        new Error('{"code":"MalformedJson","message":"arguments must be JSON","category":"validation","recoverable":true,"requestId":"req-test","operation":"increment"}')
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
      check('envelope category preserved', details.category === 'validation');
      check('envelope request id preserved', details.requestId === 'req-test');
      check('envelope operation preserved', details.operation === 'increment');
      check('envelope recoverability preserved', details.recoverable === true);
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
check(
  'media errors have friendly messages',
  errorDetails(new Error('{"code":"ConversionFailed"}')).message ===
    'The media conversion failed.'
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

await withWindow({}, async () => {
  check(
    'mock BibTeX parsing returns an empty list',
    (await backend.parseBibTeX('@article{demo}')).length === 0
  );
  check(
    'mock PDF generation returns a path',
    (await backend.generatePdf('demo.pdf', 'Title', 'Body')).path ===
      'Documents/demo.pdf'
  );
  try {
    await backend.generatePdf('demo.pdf', 'Title', 'Body', 'triple');
    check('PDF layout is validated client-side', false);
  } catch (error) {
    check(
      'PDF layout is validated client-side',
      errorDetails(error).code === 'InvalidArgument'
    );
  }
  try {
    await backend.inspectBlend('/tmp/demo.blend');
    check('mock Blender inspection is unavailable', false);
  } catch (error) {
    check('mock Blender inspection is unavailable', errorDetails(error).code === 'Unavailable');
  }
});

if (failures > 0) {
  console.error(`${failures} bridge error test(s) failed`);
  process.exit(1);
}
console.log('bridge error handling: all tests passed');
