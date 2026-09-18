import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSearchUrl,
  PUBLISHER_SEARCH_PROVIDERS,
  SCHOLARLY_SEARCH_PROVIDERS,
  TECH_REFERENCE_SEARCH_PROVIDERS,
  WEB_SEARCH_PROVIDERS,
} from '../src/search-providers.js';

const originalWindow = globalThis.window;
const { callBackend, setRequestTimeout, writingBackend, musicBackend } =
  await import('../src/backend.js');

test.after(() => {
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
});

test('rejects calls when the native bridge is unavailable', async () => {
  delete globalThis.window;
  await assert.rejects(
    callBackend('getNotes'),
    /only available inside the Julia WebView/,
  );
});

test('normalizes native errors and times out stalled calls', async () => {
  globalThis.window = {
    fails: () =>
      Promise.reject(
        '{"code":"PathNotAllowed","message":"Path is outside the workspace."}',
      ),
    stalls: () => new Promise(() => {}),
  };

  await assert.rejects(
    callBackend('fails'),
    (error) =>
      error.code === 'PathNotAllowed' &&
      error.message === 'Path is outside the workspace.',
  );

  setRequestTimeout(5);
  await assert.rejects(
    callBackend('stalls'),
    (error) => error.code === 'Timeout',
  );
  setRequestTimeout(30_000);
});

test('forwards writing and music calls to the native bridge', async () => {
  const calls = [];
  globalThis.window = new Proxy(
    {},
    {
      get(_target, name) {
        return (...args) => {
          calls.push([name, args]);
          return { name, args };
        };
      },
    },
  );

  assert.deepEqual(await writingBackend.createNote('Title', 'Draft', 'Body'), {
    name: 'createNote',
    args: ['Title', 'Draft', 'Body'],
  });
  assert.deepEqual(await musicBackend.cancelAudioAnalysis('job-1'), {
    name: 'cancelAudioAnalysis',
    args: ['job-1'],
  });
  assert.deepEqual(await writingBackend.validatePaperProject({ id: 'paper' }), {
    name: 'validatePaperProject',
    args: [{ id: 'paper' }],
  });
  assert.deepEqual(calls, [
    ['createNote', ['Title', 'Draft', 'Body']],
    ['cancelAudioAnalysis', ['job-1']],
    ['validatePaperProject', [{ id: 'paper' }]],
  ]);
});

test('builds direct scholarly search URLs from one query', () => {
  const googlePdf = SCHOLARLY_SEARCH_PROVIDERS.find(
    ({ id }) => id === 'google-pdf',
  );
  const pubmed = SCHOLARLY_SEARCH_PROVIDERS.find(({ id }) => id === 'pubmed');

  assert.equal(
    buildSearchUrl(googlePdf, 'trichoderma'),
    'https://www.google.com/search?q=filetype%3Apdf%20%22trichoderma%22&newwindow=1',
  );
  assert.equal(
    buildSearchUrl(pubmed, 'trichoderma biocontrol'),
    'https://pubmed.ncbi.nlm.nih.gov/?term=trichoderma%20biocontrol',
  );
  assert.equal(buildSearchUrl(googlePdf, '   '), '');
});

test('builds a full-text Wikipedia search URL', () => {
  const wikipedia = WEB_SEARCH_PROVIDERS.find(({ id }) => id === 'wikipedia');

  assert.equal(
    buildSearchUrl(wikipedia, 'trichoderma'),
    'https://en.wikipedia.org/w/index.php?title=Special:Search&fulltext=1&search=trichoderma&ns0=1',
  );
});

test('includes community search providers instead of Bing and DuckDuckGo', () => {
  const ids = WEB_SEARCH_PROVIDERS.map(({ id }) => id);
  const hackerNews = WEB_SEARCH_PROVIDERS.find(
    ({ id }) => id === 'hacker-news',
  );
  const reddit = WEB_SEARCH_PROVIDERS.find(({ id }) => id === 'reddit');

  assert.deepEqual(ids.includes('bing'), false);
  assert.deepEqual(ids.includes('duckduckgo'), false);
  assert.equal(
    buildSearchUrl(hackerNews, 'julia webview'),
    'https://hn.algolia.com/?q=julia%20webview',
  );
  assert.equal(
    buildSearchUrl(reddit, 'trichoderma'),
    'https://www.reddit.com/search/?q=trichoderma',
  );
});

test('uses the same query for publisher and technical sources', () => {
  const ieee = PUBLISHER_SEARCH_PROVIDERS.find(
    ({ id }) => id === 'ieee-xplore',
  );
  const stackOverflow = TECH_REFERENCE_SEARCH_PROVIDERS.find(
    ({ id }) => id === 'stack-overflow',
  );

  assert.equal(
    buildSearchUrl(ieee, 'webview julia'),
    'https://ieeexplore.ieee.org/search/searchresult.jsp?newsearch=true&queryText=webview%20julia',
  );
  assert.equal(
    buildSearchUrl(stackOverflow, 'webview julia'),
    'https://stackoverflow.com/search?q=webview%20julia',
  );
});

test('builds a usable URL for every Direct Search provider', () => {
  const providers = [
    ...SCHOLARLY_SEARCH_PROVIDERS,
    ...WEB_SEARCH_PROVIDERS,
    ...PUBLISHER_SEARCH_PROVIDERS,
    ...TECH_REFERENCE_SEARCH_PROVIDERS,
  ];

  assert.equal(new Set(providers.map(({ id }) => id)).size, providers.length);
  for (const provider of providers) {
    const url = new URL(buildSearchUrl(provider, 'alpha beta'));
    assert.equal(url.protocol, 'https:', provider.id);
    assert.match(url.toString(), /alpha(?:%20|\+)beta/, provider.id);
  }
});
