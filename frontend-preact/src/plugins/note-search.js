import fuzzysort from 'fuzzysort';

// Production note search uses a single engine: fuzzysort won the
// `npm run benchmark:notes` comparison (fastest index, ~4ms/search on
// 1,200 records, selective typo matches). The multi-engine comparison
// lives in `benchmark-notes-search.mjs` plus
// `check-note-search-benchmark.mjs` and is not bundled here.
export const NOTE_SEARCH_ENGINE = Object.freeze({
  id: 'fuzzysort',
  label: 'fuzzysort',
  detail: 'fuzzy search'
});

export function createNoteSearcher(notes) {
  const source = Array.isArray(notes) ? notes : [];
  const index = fuzzysort.snapshot(source, {
    keys: ['title', 'tag', 'body']
  });
  return {
    search: (query) =>
      query.trim()
        ? fuzzysort
            .go(query.trim(), index, { threshold: 0.3, limit: 100 })
            .map((result) => result.obj)
        : source
  };
}

export function searchNotes(notes, query) {
  return createNoteSearcher(notes).search(query);
}
