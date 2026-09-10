import { useMemo, useState } from 'preact/hooks';
import { sx } from '../stylex-styles.js';
import { citationCounts, resolveCitations, validatePaper } from './paper.js';

function toBibtex(paper) {
  return paper.references
    .map(
      (reference) =>
        `@misc{${reference.key},\n  note = {${String(reference.text).replace(/[{}]/g, '')}}\n}`
    )
    .join('\n\n');
}

function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ReferenceManager({ paper, onChange }) {
  const [newKey, setNewKey] = useState('');
  const [newText, setNewText] = useState('');
  const [formError, setFormError] = useState('');
  const [bibtex, setBibtex] = useState('');
  const [copyState, setCopyState] = useState('');

  const resolved = useMemo(() => resolveCitations(paper), [paper]);
  const counts = useMemo(() => citationCounts(paper), [paper]);
  const problems = useMemo(
    () =>
      validatePaper(paper).filter(
        (error) =>
          error.includes('reference') ||
          error.includes('cited') ||
          error.includes('author')
      ),
    [paper]
  );

  function updateReference(index, patch) {
    onChange({
      ...paper,
      references: paper.references.map((reference, position) =>
        position === index ? { ...reference, ...patch } : reference
      )
    });
  }

  function renameReference(index, nextKey) {
    const previous = paper.references[index].key;
    if (nextKey === previous) return;
    const rewrite = (text) =>
      String(text || '')
        .split(`[@${previous}]`)
        .join(`[@${nextKey}]`);
    onChange({
      ...paper,
      abstract: rewrite(paper.abstract),
      sections: paper.sections.map((section) => ({
        ...section,
        body: rewrite(section.body)
      })),
      references: paper.references.map((reference, position) =>
        position === index ? { ...reference, key: nextKey } : reference
      )
    });
  }

  function deleteReference(index) {
    onChange({
      ...paper,
      references: paper.references.filter((_, position) => position !== index)
    });
  }

  function addReference(key, text) {
    const cleanKey = key.trim();
    if (!/^[\w-]+$/.test(cleanKey)) {
      setFormError('Keys use letters, digits, underscore, or dash.');
      return false;
    }
    if (paper.references.some((reference) => reference.key === cleanKey)) {
      setFormError(`Key ${cleanKey} already exists — rename instead.`);
      return false;
    }
    if (text.trim() === '') {
      setFormError('Reference text is required.');
      return false;
    }
    setFormError('');
    onChange({
      ...paper,
      references: [...paper.references, { key: cleanKey, text: text.trim() }]
    });
    return true;
  }

  async function copyBibtex() {
    try {
      await navigator.clipboard.writeText(toBibtex(paper));
      setCopyState('Copied');
    } catch {
      setCopyState('Copy unavailable — select the text manually.');
    }
  }

  return (
    <section className={sx('tool-page')}>
      <div className={sx('tool-heading')}>
        <div>
          <p className={sx('eyebrow')}>Paper · references</p>
          <h1 className={sx('page-title')}>Reference Manager</h1>
          <p className={sx('lede')}>
            {paper.references.length} tracked · {resolved.references.length}{' '}
            cited · {resolved.missing.length} missing
          </p>
        </div>
      </div>

      {problems.length > 0 && (
        <div className={sx('tool-panel')}>
          <span className={sx('panel-label')}>Needs attention</span>
          {problems.map((problem) => (
            <p key={problem} className={sx('error')} role="alert">
              {problem}
            </p>
          ))}
        </div>
      )}

      {resolved.missing.length > 0 && (
        <div className={sx('tool-panel')}>
          <span className={sx('panel-label')}>Cited but unlisted</span>
          {resolved.missing.map((key) => (
            <div key={key} className={sx('notes-list-heading')}>
              <span>
                [@<strong>{key}</strong>] appears {counts.get(key) || 0}×
              </span>
              <button
                type="button"
                className={sx('new-note-button')}
                onClick={() => {
                  setNewKey(key);
                  setNewText('');
                  setFormError('');
                }}
              >
                Track it
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={sx('tool-panel')}>
        <span className={sx('panel-label')}>
          Bibliography in citation order
        </span>
        <div className={sx('notes-list')}>
          {resolved.references.map((entry) => {
            const index = paper.references.findIndex(
              (reference) => reference.key === entry.key
            );
            const cited = counts.get(entry.key) || 0;
            if (index < 0) {
              return (
                <p key={entry.key} className={sx('empty-notes')}>
                  [{entry.number}] [@
                  {entry.key}] is cited {cited}× but has no record yet.
                </p>
              );
            }
            const record = paper.references[index];
            return (
              <div key={entry.key} className={sx('notes-list-heading')}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span className={sx('panel-label')}>
                    [{entry.number}] · cited {cited}×
                    {cited === 0 ? ' · uncited' : ''}
                  </span>
                  <input
                    className={sx('search-field')}
                    aria-label="Reference key"
                    value={record.key}
                    onInput={(event) =>
                      renameReference(index, event.currentTarget.value)
                    }
                  />
                  <textarea
                    className={sx('qna-import-input')}
                    aria-label="Reference text"
                    value={record.text}
                    onInput={(event) =>
                      updateReference(index, {
                        text: event.currentTarget.value
                      })
                    }
                  />
                </div>
                <button
                  type="button"
                  className={sx('text-button')}
                  onClick={() => deleteReference(index)}
                >
                  Delete
                </button>
              </div>
            );
          })}
          {resolved.references.length === 0 && (
            <p className={sx('empty-notes')}>No citations yet.</p>
          )}
        </div>
      </div>

      <div className={sx('tool-panel')}>
        <span className={sx('panel-label')}>Add reference</span>
        <label>
          <span className={sx('sr-only')}>New reference key</span>
          <input
            className={sx('search-field')}
            placeholder="key, e.g. doe2026"
            value={newKey}
            onInput={(event) => setNewKey(event.currentTarget.value)}
          />
        </label>
        <label>
          <span className={sx('sr-only')}>New reference text</span>
          <textarea
            className={sx('qna-import-input')}
            placeholder="Full reference text"
            value={newText}
            onInput={(event) => setNewText(event.currentTarget.value)}
          />
        </label>
        {formError && (
          <p className={sx('error')} role="alert">
            {formError}
          </p>
        )}
        <button
          type="button"
          className={sx('new-note-button')}
          onClick={() => {
            if (addReference(newKey, newText)) {
              setNewKey('');
              setNewText('');
            }
          }}
        >
          + Add
        </button>
      </div>

      <div className={sx('tool-panel')}>
        <span className={sx('panel-label')}>BibTeX export</span>
        <div className={sx('note-editor-footer')}>
          <button
            type="button"
            className={sx('text-button')}
            onClick={() => setBibtex(toBibtex(paper))}
          >
            Generate
          </button>
          {bibtex && (
            <button
              type="button"
              className={sx('text-button')}
              onClick={copyBibtex}
            >
              Copy
            </button>
          )}
          {bibtex && (
            <button
              type="button"
              className={sx('text-button')}
              onClick={() => downloadTextFile(`${paper.id}.bib`, bibtex)}
            >
              Download
            </button>
          )}
          {copyState && <span>{copyState}</span>}
        </div>
        {bibtex && (
          <textarea
            className={sx('qna-import-input')}
            aria-label="BibTeX output"
            readOnly
            value={bibtex}
          />
        )}
      </div>
    </section>
  );
}
