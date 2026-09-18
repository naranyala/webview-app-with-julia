// Autosave registry tests (ported from the vlang sibling's
// `autosave.test.mjs`, adapted to this codebase's `check-*.mjs` suite style).
// Run: `npm test`. `zig build test` runs it via `npm run test`.
import {
  createAutosave,
  flushRegisteredAutosaves,
  registerAutosave
} from './src/autosave.mjs';

let failures = 0;
function check(name, condition, extra = '') {
  if (condition) console.log(`ok: ${name}`);
  else {
    failures += 1;
    console.error(`FAIL: ${name}${extra ? ` (${extra})` : ''}`);
  }
}

{
  const writes = [];
  const save = createAutosave(async (value) => writes.push(value));
  save.schedule('a', 'old');
  save.schedule('a', 'latest');
  save.schedule('b', 'other note');
  check('flush keeps latest per key', (await save.flush()) === true);
  check(
    'latest wins per key',
    JSON.stringify(writes) === JSON.stringify(['latest', 'other note']),
    writes.join(',')
  );
}

{
  const writes = [];
  let release;
  const blocked = new Promise((resolve) => {
    release = resolve;
  });
  const save = createAutosave(async (value) => {
    if (value === 'first') await blocked;
    writes.push(value);
  });
  save.schedule('a', 'first');
  const first = save.flush();
  await Promise.resolve();
  save.schedule('a', 'second');
  const second = save.flush();
  check('slow write blocks newer start', writes.length === 0);
  release();
  await Promise.all([first, second]);
  check(
    'ordered writes after release',
    JSON.stringify(writes) === JSON.stringify(['first', 'second']),
    writes.join(',')
  );
}

{
  const errors = [];
  const writes = [];
  const save = createAutosave(
    async (value) => {
      if (value === 'bad') throw new Error('Disk full');
      writes.push(value);
    },
    { onError: (error) => errors.push(error.message) }
  );
  save.schedule('a', 'bad');
  check('failed flush reports false', (await save.flush()) === false);
  save.schedule('a', 'retry');
  check('retry flush reports true', (await save.flush()) === true);
  check('error surfaced', errors.join(',') === 'Disk full');
  check('only retry written', writes.join(',') === 'retry');
}

{
  const writes = [];
  const save = createAutosave(async (value) => writes.push(value));
  const unregister = registerAutosave(save.flush);
  save.schedule('note-1', 'latest');
  check('registry flushes', (await flushRegisteredAutosaves()) === true);
  check('registry wrote latest', writes.join(',') === 'latest');
  unregister();
  save.schedule('note-1', 'not flushed');
  await flushRegisteredAutosaves();
  check('unregistered flusher skipped', writes.join(',') === 'latest');
}

{
  const save = createAutosave(async () => {
    throw new Error('Disk full');
  });
  const unregister = registerAutosave(save.flush);
  save.schedule('note-1', 'pending');
  check('failed registry flush blocks close', (await flushRegisteredAutosaves()) === false);
  unregister();
}

if (failures > 0) {
  console.error(`${failures} autosave test(s) failed`);
  process.exit(1);
}
console.log('autosave registry: all tests passed');
