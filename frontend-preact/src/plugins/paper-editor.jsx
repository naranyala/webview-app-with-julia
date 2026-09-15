import { useEffect, useMemo, useState } from 'preact/hooks';
import { sx } from '../stylex-styles.js';
import {
  PAPER_SCREEN_CSS,
  paperContentHtml,
  resolveCitations,
  slugifyTitle,
  validatePaper
} from './paper.js';

const HISTORY_LIMIT = 50;

function uniqueSectionId(paper, title = 'New section') {
  const base = slugifyTitle(title);
  const ids = new Set((paper.sections || []).map((section) => section.id));
  if (!ids.has(base)) return base;
  let suffix = 2;
  while (ids.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export function PaperEditor({ paper, onChange, workspaceControls }) {
  const [selectedId, setSelectedId] = useState(paper.sections[0]?.id || '');
  const [history, setHistory] = useState([paper]);
  const [historyIndex, setHistoryIndex] = useState(0);

  useEffect(() => {
    setSelectedId(paper.sections[0]?.id || '');
    setHistory([paper]);
    setHistoryIndex(0);
  }, [paper.id]);

  const selected =
    paper.sections.find((section) => section.id === selectedId) ||
    paper.sections[0];
  const selectedIndex = paper.sections.indexOf(selected);
  const problems = useMemo(() => validatePaper(paper), [paper]);
  const preview = useMemo(
    () => paperContentHtml(paper, resolveCitations(paper), 'paper-single'),
    [paper]
  );

  function commit(next) {
    const nextHistory = [...history.slice(0, historyIndex + 1), next].slice(
      -HISTORY_LIMIT
    );
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
    onChange(next);
  }

  function applyHistory(index) {
    const next = history[index];
    if (!next) return;
    setHistoryIndex(index);
    setSelectedId((current) =>
      next.sections.some((section) => section.id === current)
        ? current
        : next.sections[0]?.id || ''
    );
    onChange(next);
  }

  function updateMetadata(field, value) {
    commit({ ...paper, [field]: value });
  }

  function updateSection(field, value) {
    if (!selected) return;
    commit({
      ...paper,
      sections: paper.sections.map((section) =>
        section.id === selected.id ? { ...section, [field]: value } : section
      )
    });
  }

  function addSection() {
    const id = uniqueSectionId(paper);
    commit({
      ...paper,
      sections: [...paper.sections, { id, title: 'New section', body: '' }]
    });
    setSelectedId(id);
  }

  function deleteSection() {
    if (!selected || paper.sections.length <= 1) return;
    const sections = paper.sections.filter(
      (section) => section.id !== selected.id
    );
    commit({ ...paper, sections });
    setSelectedId(sections[Math.min(selectedIndex, sections.length - 1)].id);
  }

  function moveSection(offset) {
    const target = selectedIndex + offset;
    if (!selected || target < 0 || target >= paper.sections.length) return;
    const sections = [...paper.sections];
    [sections[selectedIndex], sections[target]] = [
      sections[target],
      sections[selectedIndex]
    ];
    commit({ ...paper, sections });
  }

  return (
    <section className={sx('tool-page')}>
      <style>{PAPER_SCREEN_CSS}</style>
      <div className={sx('tool-heading')}>
        <div>
          <p className={sx('eyebrow')}>Authoring</p>
          <h1 className={sx('page-title')}>Manuscript Editor</h1>
          <p className={sx('lede')}>
            Edit structured sections with Markdown preview and project autosave.
          </p>
        </div>
        <span className={sx('mock-badge')}>
          {problems.length === 0
            ? 'Valid project'
            : `${problems.length} issues`}
        </span>
      </div>

      {workspaceControls}

      <div className={sx('tool-panel')}>
        <div className={sx('notes-list-heading')}>
          <strong>Manuscript</strong>
          <button
            type="button"
            className={sx('text-button')}
            disabled={historyIndex === 0}
            onClick={() => applyHistory(historyIndex - 1)}
          >
            Undo
          </button>
          <button
            type="button"
            className={sx('text-button')}
            disabled={historyIndex >= history.length - 1}
            onClick={() => applyHistory(historyIndex + 1)}
          >
            Redo
          </button>
        </div>
        <label>
          <span className={sx('panel-label')}>Title</span>
          <input
            className={sx('search-field')}
            value={paper.title}
            onInput={(event) =>
              updateMetadata('title', event.currentTarget.value)
            }
          />
        </label>
        <label>
          <span className={sx('panel-label')}>Abstract</span>
          <textarea
            className={sx('note-textarea')}
            rows="5"
            value={paper.abstract}
            onInput={(event) =>
              updateMetadata('abstract', event.currentTarget.value)
            }
          />
        </label>
      </div>

      <div className={sx('tool-panel')}>
        <div className={sx('notes-list-heading')}>
          <nav className={sx('recent-strip')} aria-label="Manuscript sections">
            {paper.sections.map((section) => (
              <button
                type="button"
                key={section.id}
                className={sx('chip')}
                aria-pressed={section.id === selected?.id}
                onClick={() => setSelectedId(section.id)}
              >
                {section.title || 'Untitled section'}
              </button>
            ))}
          </nav>
          <button
            type="button"
            className={sx('new-note-button')}
            onClick={addSection}
          >
            Add section
          </button>
        </div>
        {selected && (
          <>
            <label>
              <span className={sx('panel-label')}>Section title</span>
              <input
                className={sx('search-field')}
                value={selected.title}
                onInput={(event) =>
                  updateSection('title', event.currentTarget.value)
                }
              />
            </label>
            <label>
              <span className={sx('panel-label')}>Markdown body</span>
              <textarea
                className={sx('note-textarea')}
                rows="16"
                value={selected.body}
                onInput={(event) =>
                  updateSection('body', event.currentTarget.value)
                }
              />
            </label>
            <div className={sx('note-editor-footer')}>
              <button
                type="button"
                className={sx('text-button')}
                disabled={selectedIndex <= 0}
                onClick={() => moveSection(-1)}
              >
                Move earlier
              </button>
              <button
                type="button"
                className={sx('text-button')}
                disabled={selectedIndex >= paper.sections.length - 1}
                onClick={() => moveSection(1)}
              >
                Move later
              </button>
              <button
                type="button"
                className={sx('text-button')}
                disabled={paper.sections.length <= 1}
                onClick={deleteSection}
              >
                Delete section
              </button>
            </div>
          </>
        )}
      </div>

      {problems.length > 0 && (
        <div className={sx('tool-panel')} role="alert">
          <span className={sx('panel-label')}>Validation</span>
          <p className={sx('error')}>{problems.join('; ')}</p>
        </div>
      )}

      <article className={sx('tool-panel')}>
        <span className={sx('panel-label')}>Live preview</span>
        <div
          className="paper-reading paper-single"
          dangerouslySetInnerHTML={{ __html: preview }}
        />
      </article>
    </section>
  );
}
