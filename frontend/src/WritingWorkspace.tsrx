import { useEffect, useState } from 'octane';
import { writingBackend } from './backend.js';
import { message, IconPlus, IconSave, IconTrash, IconDownload } from './utils.js';
import {
  createPaperProjectDraft,
  addSection,
  moveSection,
  removeSection,
  updateSection,
  updateTableOfContentsEntry,
  updatePaperField,
} from './paper-project-draft.js';

function Notes({ onBack }) {
  const [notes, setNotes] = useState([]);
  const [activeId, setActiveId] = useState('');
  const [title, setTitle] = useState('');
  const [tag, setTag] = useState('Draft');
  const [body, setBody] = useState('');
  const [status, setStatus] = useState('Loading notes...');

  const active = notes.find((note) => note.id === activeId);

  async function loadNotes() {
    try {
      const loaded = await writingBackend.getNotes();
      const next = Array.isArray(loaded) ? loaded : [];
      setNotes(next);
      if (next[0]) selectNote(next[0]);
      setStatus(next.length ? '' : 'Create your first note.');
    } catch (error) {
      setStatus(message(error));
    }
  }

  useEffect(() => {
    void loadNotes();
  }, []);

  function selectNote(note) {
    setActiveId(note.id);
    setTitle(note.title);
    setTag(note.tag || 'Draft');
    setBody(note.body || '');
  }

  async function createNote() {
    try {
      const note = await writingBackend.createNote('Untitled note', 'Draft', '');
      setNotes((current) => [...current, note]);
      selectNote(note);
      setStatus('New note created.');
    } catch (error) {
      setStatus(message(error));
    }
  }

  async function saveNote() {
    if (!active) return;
    try {
      const saved = await writingBackend.updateNote(active.id, title, tag, body);
      setNotes((current) =>
        current.map((note) => (note.id === saved.id ? saved : note)),
      );
      setStatus('Saved.');
    } catch (error) {
      setStatus(message(error));
    }
  }

  async function deleteNote() {
    if (!active) return;
    try {
      await writingBackend.deleteNote(active.id);
      const remaining = notes.filter((note) => note.id !== active.id);
      setNotes(remaining);
      if (remaining[0]) selectNote(remaining[0]);
      else {
        setActiveId('');
        setTitle('');
        setBody('');
      }
      setStatus('Note deleted.');
    } catch (error) {
      setStatus(message(error));
    }
  }

  async function exportNote() {
    if (!active) return;
    try {
      const filename = `${(title || 'note').replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '') || 'note'}.pdf`;
      const result = await writingBackend.generatePdf(filename, title, body, 'single');
      setStatus(`PDF written to ${result.path}`);
    } catch (error) {
      setStatus(message(error));
    }
  }

  return (
    <div class="panel">
      <div class="panel-header">
        <div class="panel-header-left">
          <div class="panel-header-icon">
            <IconSave size="1rem" />
          </div>
          <div>
            <div class="panel-header-title">Notes</div>
            <div class="panel-header-subtitle">
              {notes.length} note{notes.length === 1 ? '' : 's'}
            </div>
          </div>
        </div>
        <button class="btn btn-primary btn-sm" type="button" onClick={createNote}>
          <IconPlus size="0.85rem" /> New
        </button>
      </div>

      <div class="panel-body panel-body--split">
        <div class="panel-sidebar">
          <div class="panel-sidebar-list">
            {notes.map((note) => (
              <button
                class={`panel-sidebar-item ${note.id === activeId ? 'panel-sidebar-item--active' : ''}`}
                type="button"
                key={note.id}
                onClick={() => selectNote(note)}
              >
                <span class="panel-sidebar-item-title">{note.title}</span>
                <span class="panel-sidebar-item-meta">{note.tag}</span>
              </button>
            ))}
            {notes.length === 0 && (
              <div class="empty-state">
                <div class="empty-state-title">No notes yet</div>
                <div class="empty-state-desc">
                  Create your first note to get started.
                </div>
              </div>
            )}
          </div>
        </div>

        <div class="editor-area">
          <div class="editor-toolbar">
            <div class="editor-toolbar-left">
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                {active ? title || 'Untitled' : 'Select a note'}
              </span>
            </div>
            <div class="editor-toolbar-right">
              <button
                class="btn btn-primary btn-sm"
                type="button"
                onClick={saveNote}
                disabled={!active}
              >
                <IconSave size="0.85rem" /> Save
              </button>
              <button
                class="btn btn-secondary btn-sm"
                type="button"
                onClick={exportNote}
                disabled={!active}
              >
                <IconDownload size="0.85rem" /> Export PDF
              </button>
              <button
                class="btn btn-danger btn-sm"
                type="button"
                onClick={deleteNote}
                disabled={!active}
              >
                <IconTrash size="0.85rem" />
              </button>
            </div>
          </div>

          {active ? (
            <div class="editor-content">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">Title</label>
                    <input
                      class="form-input"
                      value={title}
                      onInput={(e) => setTitle(e.currentTarget.value)}
                      placeholder="Note title"
                    />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Tag</label>
                    <input
                      class="form-input"
                      value={tag}
                      onInput={(e) => setTag(e.currentTarget.value)}
                      placeholder="Draft"
                    />
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label">Content</label>
                  <textarea
                    class="form-input"
                    value={body}
                    onInput={(e) => setBody(e.currentTarget.value)}
                    placeholder="Write in plain text or Markdown..."
                    style={{ minHeight: '24rem' }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div class="empty-state">
              <div class="empty-state-icon">
                <IconSave size="1.5rem" />
              </div>
              <div class="empty-state-title">No note selected</div>
              <div class="empty-state-desc">
                Select a note from the sidebar or create a new one.
              </div>
            </div>
          )}
        </div>
      </div>

      {status && (
        <div class="status-bar">
          <div class="status-message">
            <span class="status-icon status-icon--info" />
            {status}
          </div>
        </div>
      )}
    </div>
  );
}

function PaperDesk({ onBack }) {
  const [path, setPath] = useState('');
  const [paper, setPaper] = useState(createPaperProjectDraft());
  const [projectHandle, setProjectHandle] = useState('');
  const [status, setStatus] = useState('Enter a project directory to create or open a paper.');
  const [columns, setColumns] = useState(2);
  const [validation, setValidation] = useState(null);
  const [autosave, setAutosave] = useState(false);
  const [preview, setPreview] = useState({ id: '', html: '' });

  const sections = Array.isArray(paper.sections) ? paper.sections : [];
  const tocEntries = Array.isArray(paper.tableOfContents?.entries)
    ? paper.tableOfContents.entries
    : [];

  useEffect(() => {
    if (!autosave || !projectHandle) return undefined;
    const timer = setTimeout(async () => {
      try {
        const checked = await writingBackend.validatePaperProject(paper);
        setValidation(checked);
        if (!checked.valid) {
          setStatus(`Autosave skipped: ${checked.errors.join('; ')}`);
          return;
        }
        await writingBackend.savePaperProject(projectHandle, paper);
        setStatus('Autosaved.');
      } catch (error) {
        setStatus(`Autosave failed: ${message(error)}`);
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [paper, projectHandle, autosave]);

  function applyProject(result) {
    const paper = result.project;
    setProjectHandle(result.projectHandle || '');
    setPath(result.path || path);
    setPaper(paper);
  }

  async function createProject() {
    try {
      const result = await writingBackend.createPaperProject(path, paper);
      applyProject(result);
      setStatus('Paper project created.');
    } catch (error) {
      setStatus(message(error));
    }
  }

  async function openProject() {
    try {
      const result = await writingBackend.openPaperProject(path);
      applyProject(result);
      setStatus('Paper project opened.');
    } catch (error) {
      setStatus(message(error));
    }
  }

  async function saveProject() {
    try {
      const checked = await writingBackend.validatePaperProject(paper);
      setValidation(checked);
      if (!checked.valid) {
        setStatus(`Validation failed: ${checked.errors.join('; ')}`);
        return;
      }
      const result = await writingBackend.savePaperProject(projectHandle || path, paper);
      applyProject(result);
      setStatus('Paper project saved.');
    } catch (error) {
      setStatus(message(error));
    }
  }

  async function exportProject() {
    try {
      const checked = await writingBackend.validatePaperProject(paper);
      setValidation(checked);
      if (!checked.valid) {
        setStatus(`Validation failed: ${checked.errors.join('; ')}`);
        return;
      }
      const result = await writingBackend.exportPaperProject(projectHandle || path, '', { columns });
      setStatus(`${columns === 1 ? 'Single' : 'Two'}-column PDF written to ${result.path}`);
    } catch (error) {
      setStatus(message(error));
    }
  }

  async function previewSection(section) {
    try {
      const html = await writingBackend.markdownToHtml(section.body || '');
      setPreview({ id: section.id, html });
      setStatus(`Preview ready for ${section.title || 'section'}.`);
    } catch (error) {
      setStatus(message(error));
    }
  }

  return (
    <div class="panel">
      <div class="panel-header">
        <div class="panel-header-left">
          <div class="panel-header-icon">
            <IconDownload size="1rem" />
          </div>
          <div>
            <div class="panel-header-title">Paper desk</div>
            <div class="panel-header-subtitle">
              Draft, save, and export research papers
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button class="btn btn-secondary btn-sm" type="button" onClick={createProject}>
            Create
          </button>
          <button class="btn btn-secondary btn-sm" type="button" onClick={openProject}>
            Open
          </button>
          <button class="btn btn-primary btn-sm" type="button" onClick={saveProject}>
            <IconSave size="0.85rem" /> Save
          </button>
          <button class="btn btn-secondary btn-sm" type="button" onClick={async () => { const result = await writingBackend.validatePaperProject(paper); setValidation(result); setStatus(result.valid ? 'Paper is valid.' : `Validation failed: ${result.errors.join('; ')}`); }}>
            Validate
          </button>
          <select class="form-input" value={columns} onChange={(e) => setColumns(Number(e.currentTarget.value))} style={{ width: 'auto' }} aria-label="PDF columns">
            <option value="1">Single column</option>
            <option value="2">Two columns</option>
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontSize: '0.78rem' }}><input type="checkbox" checked={autosave} onChange={(e) => setAutosave(e.currentTarget.checked)} /> Autosave</label>
          <button class="btn btn-primary btn-sm" type="button" onClick={exportProject}>
            <IconDownload size="0.85rem" /> Export PDF
          </button>
        </div>
      </div>

      <div class="panel-body">
        {validation && (validation.errors?.length > 0 || validation.warnings?.length > 0) && (
          <div class="card" style={{ marginBottom: 'var(--space-6)' }}>
            <div class="card-header"><div class="card-title">Validation feedback</div></div>
            {validation.errors?.map((error) => <div key={`error-${error}`} style={{ color: 'var(--danger)' }}>Error: {error}</div>)}
            {validation.warnings?.map((warning) => <div key={`warning-${warning}`} style={{ color: 'var(--warning)' }}>Warning: {warning}</div>)}
          </div>
        )}
        <div class="card" style={{ marginBottom: 'var(--space-6)' }}>
          <div class="card-header">
            <div class="card-title">Project</div>
          </div>
          <div class="form-group">
            <label class="form-label">Project directory</label>
            <input
              class="form-input"
              value={path}
              onInput={(e) => setPath(e.currentTarget.value)}
              placeholder="~/Documents/my-paper"
            />
          </div>
        </div>

        <div class="card" style={{ marginBottom: 'var(--space-6)' }}>
          <div class="card-header">
            <div class="card-title">Paper</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div class="form-group">
              <label class="form-label">Title</label>
              <input
                class="form-input"
                value={paper.title || ''}
                onInput={(e) => setPaper((p) => updatePaperField(p, 'title', e.currentTarget.value))}
              />
            </div>
            <div class="form-group">
              <label class="form-label">Abstract</label>
              <textarea
                class="form-input"
                value={paper.abstract || ''}
                onInput={(e) => setPaper((p) => updatePaperField(p, 'abstract', e.currentTarget.value))}
                style={{ minHeight: '8rem' }}
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
          {sections.map((section, index) => (
            <div class="card" key={section.id || index}>
              <div class="card-header">
                <div class="card-title">Section {index + 1}</div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button class="btn btn-secondary btn-sm" type="button" onClick={() => setPaper((p) => moveSection(p, section.id, -1))} disabled={index === 0}>Up</button>
                  <button class="btn btn-secondary btn-sm" type="button" onClick={() => setPaper((p) => moveSection(p, section.id, 1))} disabled={index === sections.length - 1}>Down</button>
                  <button class="btn btn-secondary btn-sm" type="button" onClick={() => void previewSection(section)}>Preview</button>
                  <button class="btn btn-danger btn-sm" type="button" onClick={() => setPaper((p) => removeSection(p, section.id))} disabled={sections.length <= 1}>Remove</button>
                </div>
                {preview.id === section.id && <div class="card" style={{ marginTop: 'var(--space-3)' }}><div class="card-title">Markdown preview</div><div class="paper-preview" dangerouslySetInnerHTML={{ __html: preview.html }} /></div>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div class="form-group">
                  <label class="form-label">Section title</label>
                  <input class="form-input" value={section.title || ''} onInput={(e) => setPaper((p) => updateSection(p, section.id, 'title', e.currentTarget.value))} />
                </div>
                <div class="form-group">
                  <label class="form-label">Section body</label>
                  <textarea class="form-input" value={section.body || ''} onInput={(e) => setPaper((p) => updateSection(p, section.id, 'body', e.currentTarget.value))} placeholder="Write in Markdown..." style={{ minHeight: '12rem' }} />
                </div>
              </div>
            </div>
          ))}
          <button class="btn btn-secondary" type="button" onClick={() => setPaper((p) => addSection(p))}>Add section</button>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">Table of contents</div>
          </div>
          {tocEntries.map((entry, index) => (
            <div class="form-row" key={entry.id || index} style={{ marginBottom: 'var(--space-3)' }}>
              <div class="form-group"><label class="form-label">Entry title</label><input class="form-input" value={entry.title || ''} onInput={(e) => setPaper((p) => updateTableOfContentsEntry(p, entry.id, 'title', e.currentTarget.value))} /></div>
              <div class="form-group"><label class="form-label">Level</label><input class="form-input" type="number" min="1" max="6" value={entry.level || 1} onInput={(e) => setPaper((p) => updateTableOfContentsEntry(p, entry.id, 'level', Number(e.currentTarget.value) || 1))} /></div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-6)', fontSize: '0.82rem', color: 'var(--text-secondary)', cursor: 'pointer' }}><input type="checkbox" checked={entry.visible !== false} onChange={(e) => setPaper((p) => updateTableOfContentsEntry(p, entry.id, 'visible', e.currentTarget.checked))} style={{ width: '1rem', height: '1rem', accentColor: 'var(--accent)' }} /> Include</label>
            </div>
          ))}
        </div>
      </div>

      {status && (
        <div class="status-bar">
          <div class="status-message">
            <span class="status-icon status-icon--info" />
            {status}
          </div>
        </div>
      )}
    </div>
  );
}

function References({ onBack }) {
  const [source, setSource] = useState('');
  const [project, setProject] = useState('');
  const [result, setResult] = useState('Paste BibTeX to inspect its entries.');

  async function parse() {
    try {
      const parsed = await writingBackend.parseBibTeX(source);
      setResult(`${parsed.count} reference${parsed.count === 1 ? '' : 's'} parsed.`);
    } catch (error) {
      setResult(message(error));
    }
  }

  async function addToProject() {
    try {
      const added = await writingBackend.addBibTeXToProject(project, source);
      setResult(`${added.added} reference${added.added === 1 ? '' : 's'} added; ${added.duplicates} duplicate${added.duplicates === 1 ? '' : 's'} skipped.`);
    } catch (error) {
      setResult(message(error));
    }
  }

  return (
    <div class="panel">
      <div class="panel-header">
        <div class="panel-header-left">
          <div class="panel-header-icon">
            <IconDownload size="1rem" />
          </div>
          <div>
            <div class="panel-header-title">References</div>
            <div class="panel-header-subtitle">
              Parse BibTeX and add citations to your project
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button class="btn btn-primary btn-sm" type="button" onClick={parse}>
            Parse BibTeX
          </button>
          <button class="btn btn-secondary btn-sm" type="button" onClick={addToProject}>
            Add to project
          </button>
        </div>
      </div>

      <div class="panel-body">
        <div class="card" style={{ marginBottom: 'var(--space-6)' }}>
          <div class="card-header">
            <div class="card-title">BibTeX source</div>
          </div>
          <div class="form-group">
            <textarea
              class="form-input"
              value={source}
              onInput={(e) => setSource(e.currentTarget.value)}
              placeholder="@article{...}"
              style={{ minHeight: '16rem', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}
            />
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">Project</div>
          </div>
          <div class="form-group">
            <label class="form-label">Paper project path or handle</label>
            <input
              class="form-input"
              value={project}
              onInput={(e) => setProject(e.currentTarget.value)}
              placeholder="Optional for parsing; required to add references"
            />
          </div>
        </div>
      </div>

      {result && (
        <div class="status-bar">
          <div class="status-message">
            <span class="status-icon status-icon--info" />
            {result}
          </div>
        </div>
      )}
    </div>
  );
}

export function WritingWorkspace({ tool, onBack }) {
  if (tool === 'notes') return <Notes onBack={onBack} />;
  if (tool === 'paper') return <PaperDesk onBack={onBack} />;
  return <References onBack={onBack} />;
}
