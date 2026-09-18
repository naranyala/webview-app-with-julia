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
    search: (query) => {
      const trimmed = query.trim();
      if (!trimmed) return source;
      // Fuzzy rank first; union with exact substring so long essay bodies
      // (1500+ chars) remain retrievable even when fuzzysort scoring drops
      // a mid-body term like "rental".
      const fuzzy = fuzzysort
        .go(trimmed, index, { threshold: 0.3, limit: 100 })
        .map((result) => result.obj);
      const seen = new Set(fuzzy.map((note) => note.id));
      const lowered = trimmed.toLowerCase();
      for (const note of source) {
        if (seen.has(note.id)) continue;
        const haystack = `${note.title} ${note.tag} ${note.body}`.toLowerCase();
        if (haystack.includes(lowered)) {
          fuzzy.push(note);
          seen.add(note.id);
        }
      }
      return fuzzy;
    }
  };
}

export function searchNotes(notes, query) {
  return createNoteSearcher(notes).search(query);
}
