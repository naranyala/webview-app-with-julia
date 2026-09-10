// Guards `bindings.d.ts` + `src/backend.js` against drift from
// `src/backend/core_plugin.zig` (`bound_names`).
// Run: `npm run check:bindings`. CI runs it after `npm run check`.
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const corePlugin = fs.readFileSync(
  path.join(root, '..', 'src', 'backend', 'core_plugin.zig'),
  'utf8'
);
const bindings = fs.readFileSync(
  path.join(root, 'src', 'bindings.d.ts'),
  'utf8'
);
const bridge = fs.readFileSync(
  path.join(root, 'src', 'backend.js'),
  'utf8'
);
const namesBlock = corePlugin.match(
  /pub const bound_names:[\s\S]*?= &\.\{([\s\S]*?)\};/
);
if (!namesBlock) {
  console.error('could not read bound_names from src/backend/core_plugin.zig');
  process.exit(1);
}
const expected = [...namesBlock[1].matchAll(/"([^"]+)"/g)].map(
  ([, name]) => name
);

let failed = false;
for (const name of expected) {
  if (!bindings.includes(name)) {
    console.error(`missing ${name} in src/bindings.d.ts`);
    failed = true;
  }
  if (!bridge.includes(name)) {
    console.error(`missing ${name} in src/backend.js`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log(`bindings in sync (${expected.length} names)`);
