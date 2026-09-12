// Guards `bindings.d.ts` + `src/backend.js` against drift from the Julia
// launcher's binding list in `bin/webview_app.jl`.
// Run: `npm run check:bindings`. CI runs it after `npm run check`.
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const launcher = fs.readFileSync(
  path.join(root, '..', 'bin', 'webview_app.jl'),
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
const namesBlock = launcher.match(
  /bindings\s*=\s*\[([\s\S]*?)\n\s*\]/
);
if (!namesBlock) {
  console.error('could not read bindings from bin/webview_app.jl');
  process.exit(1);
}
const expected = [...namesBlock[1].matchAll(/"([^"]+)"/g)].map(
  ([, name]) => name
);
const optionalMedia = new Set([
  'inspectMedia',
  'markdownToHtml',
  'readText',
  'writeText',
  'planConversion',
  'convertMedia',
  'getMediaCapabilities',
  'htmlToText'
]);

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
const optionalCount = expected.filter((name) => optionalMedia.has(name)).length;
console.log(
  `bindings in sync (${expected.length - optionalCount} core, ${optionalCount} optional)`
);
