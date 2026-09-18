import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const bundle = await readFile(
  new URL('../dist/index.html', import.meta.url),
  'utf8',
);

async function renderApp(bindings = {}) {
  const opened = [];
  const dom = new JSDOM(bundle, {
    runScripts: 'dangerously',
    url: 'https://desktop.test/',
    beforeParse(window) {
      Object.assign(window, bindings);
      window.open = (url) => {
        opened.push(url);
        return {};
      };
    },
  });
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  await new Promise((resolve) => setTimeout(resolve, 75));
  return { dom, opened };
}

async function click(window, element) {
  assert.ok(element, 'expected the rendered control to exist');
  element.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function input(window, element, value) {
  element.value = value;
  element.dispatchEvent(new window.Event('input', { bubbles: true }));
}

test('production bundle routes to Paper Desk and preserves disabled save state', async () => {
  const { dom } = await renderApp();
  const { document } = dom.window;
  await click(
    dom.window,
    [...document.querySelectorAll('.workspace-card')].find((node) =>
      node.textContent.includes('Writing'),
    ),
  );
  await click(
    dom.window,
    [...document.querySelectorAll('.tool-card')].find((node) =>
      node.textContent.includes('Paper desk'),
    ),
  );

  assert.equal(document.querySelector('h2').textContent, 'Paper desk');
  assert.ok(
    [...document.querySelectorAll('.editor-actions button')].some(
      (node) => node.textContent === 'Save',
    ),
  );
  assert.match(document.body.textContent, /Enter a project directory/);
  dom.window.close();
});

test('production bundle sends one Direct Search query to a provider', async () => {
  const { dom, opened } = await renderApp();
  const { document } = dom.window;
  await click(
    dom.window,
    [...document.querySelectorAll('.workspace-card')].find((node) =>
      node.textContent.includes('Research'),
    ),
  );
  await click(dom.window, document.querySelector('.tool-card'));

  const query = document.querySelector('.search-box input');
  input(dom.window, query, 'trichoderma');
  const wikipedia = [...document.querySelectorAll('.search-provider')].find(
    (node) => node.textContent.includes('Wikipedia'),
  );
  assert.equal(wikipedia.disabled, false);
  await click(dom.window, wikipedia);

  assert.deepEqual(opened, [
    'https://en.wikipedia.org/w/index.php?title=Special:Search&fulltext=1&search=trichoderma&ns0=1',
  ]);
  assert.match(
    document.querySelector('[role=status]').textContent,
    /Opening Wikipedia/,
  );
  dom.window.close();
});

test('production bundle polls a MIR job through the native bridge', async () => {
  const { dom } = await renderApp({
    getAudioMetadata: async () => ({
      durationSec: 2,
      sampleRate: 44100,
      channels: 2,
      sizeBytes: 1024,
    }),
    startAudioAnalysis: async () => ({
      state: 'completed',
      rms: 0.1,
      peak: 0.2,
      zcr: 0.3,
      sampleCount: 16,
    }),
  });
  const { document } = dom.window;
  await click(
    dom.window,
    [...document.querySelectorAll('.workspace-card')].find((node) =>
      node.textContent.includes('Analyze music'),
    ),
  );
  await click(dom.window, document.querySelector('.tool-card'));

  const path = document.querySelector('.mir-form input');
  input(dom.window, path, '/tmp/example.wav');
  const submit = document.querySelector('.mir-form button');
  assert.equal(submit.disabled, false);
  await click(dom.window, submit);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.match(document.body.textContent, /Analysis complete/);
  assert.match(document.body.textContent, /44\.10 kHz|44100 Hz/);
  dom.window.close();
});
