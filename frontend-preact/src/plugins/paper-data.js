import { createPaper } from './paper.js';

// Bundled reading sample so the Academic Paper workspace opens with a
// complete two-column paper. Citations use [@key] markers resolved by
// `resolveCitations` in `paper.js`.
export const samplePaper = createPaper({
  id: 'local-first-chain-notes',
  title:
    'Local-First Chain Notes: Capturing AI Conversations as Searchable Records',
  subtitle: 'A practice report from building a desktop toolkit',
  authors: [
    {
      name: 'Ada Osei',
      affiliation: 'Independent Research',
      email: 'ada@example.org'
    },
    { name: 'Tunde Bakare', affiliation: 'Local Tools Lab' }
  ],
  venue: 'Workshop on Local-First Software',
  year: '2026',
  status: 'final',
  abstract:
    'AI assistants produce long, valuable conversations that usually evaporate when the chat window closes. ' +
    'This paper describes Chain Notes, a local-first workspace that stores external AI exchanges as ' +
    'question-and-answer records on the user’s own machine. Notes persist in a versioned JSON store, ' +
    'search tolerates typos through fuzzy matching [@fuzzysort], and each exchange exports to PDF or ' +
    'print. The design follows local-first principles [@kleppmann]: the application owns its data, works ' +
    'offline, and treats synchronization as a future concern rather than a precondition.',
  keywords: [
    'local-first software',
    'note-taking',
    'fuzzy search',
    'desktop applications'
  ],
  sections: [
    {
      id: 'introduction',
      title: '1  Introduction',
      body:
        'Conversations with AI systems have become working documents: debugging sessions, design reviews, ' +
        'and literature surveys now happen inside chat transcripts. Yet most assistants keep those transcripts ' +
        'behind a network boundary, searchable only by exact scrollback. When the session ends, the knowledge ' +
        'is effectively lost.\n\n' +
        'Chain Notes takes the opposite stance. Each exchange is saved locally the moment it is captured, ' +
        'as a small structured record with three fields:\n\n' +
        '- **Question** — what was asked, verbatim.\n' +
        '- **Answer** — what was generated, verbatim.\n' +
        '- **Title** — a short human label for scanning.\n\n' +
        'Three fields turn out to be enough. Titles make lists skimmable, questions preserve intent, and ' +
        'answers preserve evidence. Everything else — tags, timestamps, exports — is derived.'
    },
    {
      id: 'related-work',
      title: '2  Related Work',
      body:
        'Personal knowledge management has converged on two poles: plain-text systems that compose well ' +
        'with other tools [@obsidian], and database-backed applications with rich queries [@notion]. Chain ' +
        'Notes borrows the plain-text instinct — records are human-readable JSON — while keeping the query ' +
        'power of a database for search and export.\n\n' +
        '> The best note is the one you can find again six months later.\n\n' +
        'Local-first software [@kleppmann] argues that applications should own their data and work offline. ' +
        'Chain Notes applies that argument to AI transcripts specifically: because the content already exists ' +
        'as text, no server round-trip is ever required to read, search, or export it.'
    },
    {
      id: 'design',
      title: '3  Design',
      body:
        '## 3.1  Storage\n\n' +
        'Notes live in a single versioned JSON document (`{ "version": 1, "notes": [...] }`). Writes are ' +
        'atomic: the backend serializes to a temporary file and renames it, so readers never observe a ' +
        'partial state. The schema version leaves room for migrations without breaking existing installs.\n\n' +
        '## 3.2  Search\n\n' +
        'Exact substring search fails on typos, which are common when recalling half-remembered prompts. ' +
        'The workspace therefore benchmarks several fuzzy engines and ships the fastest selective one ' +
        '[@fuzzysort]. The benchmark harness stays in the repository so the choice can be revisited with ' +
        'evidence rather than opinion.\n\n' +
        '## 3.3  Export\n\n' +
        'Each exchange renders to PDF through one of three engines, or to the system print dialog for a ' +
        'true Save-as-PDF flow. Markdown in questions and answers — code fences, lists, quotes — survives ' +
        'export with monospace blocks and preserved indentation:'
    },
    {
      id: 'implementation',
      title: '4  Implementation Notes',
      body:
        'The desktop shell pairs a Zig backend with a Preact frontend over a small typed RPC bridge, ' +
        'as sketched in Figure 1:\n\n' +
        '![Native shell data flow](fig:architecture)\n\n' +
        'PDF bytes are generated in the frontend, encoded once, and handed to a `savePdf` binding that ' +
        'validates the filename and writes atomically into the user’s Documents folder. A typical save ' +
        'round-trips in well under a second:\n\n' +
        '```js\n' +
        'const bytes = await generateChainPdfBytes("jspdf", entries);\n' +
        'const saved = await backend.savePdf(filename, pdfBytesToBase64(bytes));\n' +
        '// saved.path -> "Documents/chain-notes-2026-09-04.pdf"\n' +
        '```\n\n' +
        'The same block model drives screen reading, print CSS, and all three PDF engines, so a layout ' +
        'fix lands everywhere at once [@webview].'
    },
    {
      id: 'conclusion',
      title: '5  Conclusion',
      body:
        'Saving AI conversations locally, as structured question-and-answer records, converts ephemeral ' +
        'chats into a durable personal corpus. Fuzzy search makes the corpus forgiving; PDF and print ' +
        'export make it portable. Future work includes cross-device sync with conflict-free merges and ' +
        'spaced-repetition review drawn from saved exchanges.'
    }
  ],
  figures: [
    {
      id: 'architecture',
      caption:
        'Native shell data flow: the Zig backend owns storage and file output while the Preact reader renders over a typed RPC bridge.',
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 190" role="img" aria-label="Native shell data flow"><rect x="6" y="60" width="140" height="70" rx="8" fill="#e8e9ec"/><text x="76" y="88" text-anchor="middle" font-size="12" font-family="sans-serif" fill="#232428">Zig backend</text><text x="76" y="106" text-anchor="middle" font-size="10" font-family="sans-serif" fill="#55565e">storage · savePdf</text><rect x="175" y="60" width="130" height="70" rx="8" fill="#e8e9ec"/><text x="240" y="88" text-anchor="middle" font-size="12" font-family="sans-serif" fill="#232428">RPC bridge</text><text x="240" y="106" text-anchor="middle" font-size="10" font-family="sans-serif" fill="#55565e">14 typed bindings</text><rect x="334" y="60" width="140" height="70" rx="8" fill="#e8e9ec"/><text x="404" y="88" text-anchor="middle" font-size="12" font-family="sans-serif" fill="#232428">Preact reader</text><text x="404" y="106" text-anchor="middle" font-size="10" font-family="sans-serif" fill="#55565e">two columns · print</text><line x1="146" y1="95" x2="175" y2="95" stroke="#55565e" stroke-width="2"/><polygon points="175,89 175,101 187,95" fill="#55565e"/><line x1="305" y1="95" x2="334" y2="95" stroke="#55565e" stroke-width="2"/><polygon points="334,89 334,101 346,95" fill="#55565e"/><rect x="175" y="148" width="130" height="34" rx="8" fill="#dfe3d4"/><text x="240" y="170" text-anchor="middle" font-size="10" font-family="sans-serif" fill="#232428">Documents/*.pdf</text><line x1="240" y1="130" x2="240" y2="148" stroke="#55565e" stroke-width="2"/></svg>'
    }
  ],
  references: [
    {
      key: 'kleppmann',
      text: 'M. Kleppmann et al. Local-first software: you own your data, in spite of the cloud. Onward! 2019.'
    },
    {
      key: 'fuzzysort',
      text: 'fuzzysort: fast SublimeText-like fuzzy search for JavaScript. MIT License.'
    },
    {
      key: 'obsidian',
      text: 'Obsidian: a second brain, on top of local Markdown files.'
    },
    {
      key: 'notion',
      text: 'Notion: connected workspace for docs, wikis, and projects.'
    },
    {
      key: 'webview',
      text: 'webview: a tiny cross-platform library for building modern desktop apps with web UIs.'
    }
  ]
});

export const bundledPapers = Object.freeze([samplePaper]);

export function getPaper(id) {
  return bundledPapers.find((paper) => paper.id === id) || null;
}
