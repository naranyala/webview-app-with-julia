import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { backend, backendError } from '../backend.js';
import { noteSaveCoordinator } from '../note-save-coordinator.js';
import { styles, sx } from '../stylex-styles.js';
import {
  parseNotesBackup,
  planNotesRestore,
  serializeNotesBackup
} from './note-backup.js';
import {
  blocksToHtml,
  escapeHtml,
  PRINT_CSS_RESET,
  parseMarkdown
} from './note-markdown.js';
import {
  chainPdfFileName,
  DEFAULT_NOTE_PDF_EXPORTER,
  downloadChainAsPdf,
  downloadNoteAsPdf,
  generateChainPdfBytes,
  generateNotePdfBytes,
  NOTE_PDF_EXPORTERS,
  pdfBytesToBase64,
  pdfFileName
} from './note-pdf.js';
import { createNoteSearcher, NOTE_SEARCH_ENGINE } from './note-search.js';
import { parseExternalChat, parseStoredQna, serializeQna } from './qna.js';

// Essay workspace: the sidebar lists the essay chain (seed ideas persist in
// `notes.json`), the editor grows a seed idea into a long-form essay with a
// Write/Preview loop. Storage encoding, search, and PDF export are unchanged.

function chainLabel(id, notes) {
  const index = notes.findIndex((note) => note.id === id);
  return index < 0 ? '01' : String(index + 1).padStart(2, '0');
}

function notePreview(note) {
  const qna = parseStoredQna(note.body);
  return (qna.question || qna.answer || 'Empty exchange')
    .replace(/\s+/g, ' ')
    .slice(0, 72);
}

export function ChainNotes() {
  const [notes, setNotes] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [noteQuery, setNoteQuery] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteQuestion, setNoteQuestion] = useState('');
  const [noteAnswer, setNoteAnswer] = useState('');
  const [editorMode, setEditorMode] = useState('write');
  const [importText, setImportText] = useState('');
  const [pdfExporter, setPdfExporter] = useState(DEFAULT_NOTE_PDF_EXPORTER);
  const [loadError, setLoadError] = useState('');
  const [saveState, setSaveState] = useState('');
  const [saveError, setSaveError] = useState('');
  const [backupState, setBackupState] = useState('');
  const [backupError, setBackupError] = useState('');
  const [backupFile, setBackupFile] = useState(null);
  const backupInputRef = useRef(null);
  const saveSubscription = useRef(null);

  useEffect(() => {
    let cancelled = false;
    backend
      .getNotes()
      .then((loadedNotes) => {
        if (cancelled) return;
        const nextNotes = Array.isArray(loadedNotes) ? loadedNotes : [];
        setNotes(nextNotes);
        if (nextNotes[0]) void selectNote(nextNotes[0]);
      })
      .catch((error) => {
        if (!cancelled) setLoadError(backendError(error));
      });
    return () => {
      cancelled = true;
      saveSubscription.current?.();
      saveSubscription.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const noteSearcher = useMemo(() => createNoteSearcher(notes), [notes]);
  const filteredNotes = useMemo(
    () => noteSearcher.search(noteQuery),
    [noteQuery, noteSearcher]
  );
  const noteWordCount = `${noteQuestion} ${noteAnswer}`.trim()
    ? `${noteQuestion} ${noteAnswer}`.trim().split(/\s+/).length
    : 0;
  const chainIndex = filteredNotes.findIndex(
    (note) => note.id === activeNoteId
  );
  const prevNote = chainIndex > 0 ? filteredNotes[chainIndex - 1] : null;
  const nextNote =
    chainIndex >= 0 && chainIndex < filteredNotes.length - 1
      ? filteredNotes[chainIndex + 1]
      : null;
  const previewHtml = useMemo(
    () => blocksToHtml(parseMarkdown(noteAnswer || '')),
    [noteAnswer]
  );
  const ideaHtml = useMemo(
    () => blocksToHtml(parseMarkdown(noteQuestion || '')),
    [noteQuestion]
  );

  async function selectNote(note) {
    if (activeNoteId && activeNoteId !== note.id) {
      try {
        await noteSaveCoordinator.flush(activeNoteId);
      } catch (error) {
        setLoadError(`Save failed: ${backendError(error)}`);
        return false;
      }
    }
    saveSubscription.current?.();
    saveSubscription.current = noteSaveCoordinator.subscribe(
      note.id,
      (event) => {
        if (event.status === 'queued' || event.status === 'saving') {
          setSaveError('');
          setSaveState('Saving...');
        } else if (event.status === 'saved') {
          setSaveError('');
          setNotes((current) =>
            current.map((item) =>
              item.id === event.result?.id ? event.result : item
            )
          );
          setSaveState('Saved');
        } else if (event.status === 'error') {
          setSaveError(backendError(event.error));
          setSaveState('Save failed');
        }
      }
    );
    const qna = parseStoredQna(note.body);
    setActiveNoteId(note.id);
    setNoteTitle(note.title);
    setNoteQuestion(qna.question);
    setNoteAnswer(qna.answer);
    setImportText('');
    setSaveState('');
    setSaveError('');
    return true;
  }

  function updateNote(title, question, answer) {
    if (!activeNoteId) return;
    const activeNote = notes.find((note) => note.id === activeNoteId);
    const body = serializeQna(question, answer);
    setNotes((current) =>
      current.map((item) =>
        item.id === activeNoteId
          ? {
              ...item,
              title: title || 'Untitled note',
              body,
              updated: 'Just now'
            }
          : item
      )
    );
    setSaveState('Saving...');
    setSaveError('');
    noteSaveCoordinator.schedule({
      id: activeNoteId,
      title: title || 'Untitled note',
      tag: activeNote?.tag || 'Draft',
      body
    });
  }

  async function createNote() {
    try {
      await noteSaveCoordinator.flushAll();
      const note = await backend.createNote(
        'New essay seed',
        'Draft',
        serializeQna('', '')
      );
      setNotes((current) => [...current, note]);
      setEditorMode('write');
      selectNote(note);
    } catch (error) {
      setLoadError(backendError(error));
    }
  }

  async function deleteActiveNote() {
    if (!activeNoteId) return;
    try {
      await noteSaveCoordinator.flush(activeNoteId);
      await backend.deleteNote(activeNoteId);
      const remaining = notes.filter((note) => note.id !== activeNoteId);
      setNotes(remaining);
      if (remaining[0]) void selectNote(remaining[0]);
      else {
        saveSubscription.current?.();
        saveSubscription.current = null;
        setActiveNoteId(null);
        setNoteTitle('');
        setNoteQuestion('');
        setNoteAnswer('');
      }
    } catch (error) {
      setLoadError(backendError(error));
    }
  }

  async function retrySave() {
    if (!activeNoteId) return;
    try {
      await noteSaveCoordinator.retry(activeNoteId);
    } catch (error) {
      setSaveError(backendError(error));
      setSaveState('Save failed');
    }
  }

  function importChat() {
    const qna = parseExternalChat(importText);
    if (!qna) {
      setLoadError('Paste a question and answer before importing.');
      return;
    }
    setLoadError('');
    setNoteQuestion(qna.question);
    setNoteAnswer(qna.answer);
    updateNote(noteTitle, qna.question, qna.answer);
    setImportText('');
  }

  function noteEntry(note) {
    const qna = parseStoredQna(note.body);
    return { title: note.title, question: qna.question, answer: qna.answer };
  }

  function hasNativeWriteText() {
    return (
      typeof window !== 'undefined' && typeof window.writeText === 'function'
    );
  }

  function downloadTextFile(filename, text) {
    if (
      typeof document === 'undefined' ||
      typeof URL === 'undefined' ||
      typeof URL.createObjectURL !== 'function'
    ) {
      throw new Error('File download is not available in this shell.');
    }
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    try {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  async function runBackupExport() {
    try {
      setBackupError('');
      setBackupState('Exporting…');
      await noteSaveCoordinator.flushAll();
      const fresh = await backend.getNotes();
      const all = Array.isArray(fresh) ? fresh : notes;
      const { filename, json } = serializeNotesBackup(all);
      if (hasNativeWriteText()) {
        const volumes = await backend.listVolumes();
        const home = volumes.find((volume) => volume.id === 'home');
        if (!home) throw new Error('Home volume is unavailable for backup.');
        const saved = await backend.writeText(
          `${home.path}/Documents/${filename}`,
          json
        );
        setBackupState(`Saved ${all.length} notes to ${saved.path}`);
      } else {
        downloadTextFile(filename, json);
        setBackupState(`Downloaded ${filename} (${all.length} notes)`);
      }
    } catch (error) {
      setBackupState('');
      setBackupError(`Backup export failed: ${backendError(error)}`);
    }
  }

  async function runBackupImport() {
    if (!backupFile) return;
    try {
      setBackupError('');
      setBackupState('Importing…');
      const text = await backupFile.text();
      const { notes: incoming, skipped } = parseNotesBackup(text);
      await noteSaveCoordinator.flushAll();
      const fresh = await backend.getNotes();
      const current = Array.isArray(fresh) ? fresh : [];
      const { toCreate, toUpdate, unchanged } = planNotesRestore(
        incoming,
        current
      );
      for (const note of toCreate) {
        await backend.createNote(note.title, note.tag, note.body);
      }
      for (const note of toUpdate) {
        await backend.updateNote(note.id, note.title, note.tag, note.body);
      }
      const reloaded = await backend.getNotes();
      setNotes(Array.isArray(reloaded) ? reloaded : current);
      if (reloaded[0]) void selectNote(reloaded[0]);
      setBackupState(
        `Imported ${toCreate.length}, updated ${toUpdate.length}, unchanged ${unchanged}` +
          (skipped > 0 ? `, skipped ${skipped}` : '')
      );
      setBackupFile(null);
      if (backupInputRef.current) backupInputRef.current.value = '';
    } catch (error) {
      setBackupState('');
      setBackupError(`Backup import failed: ${backendError(error)}`);
    }
  }

  async function runExport(kind) {
    const list =
      kind === 'chain'
        ? filteredNotes
        : notes.filter((note) => note.id === activeNoteId);
    if (list.length === 0) return;
    const entries = list.map(noteEntry);
    const filename =
      kind === 'chain' ? chainPdfFileName() : pdfFileName(noteTitle);
    try {
      setLoadError('');
      setSaveState('Exporting...');
      if (backend.isNative()) {
        const bytes =
          kind === 'chain'
            ? await generateChainPdfBytes(pdfExporter, entries)
            : await generateNotePdfBytes(pdfExporter, entries[0]);
        const saved = await backend.savePdf(filename, pdfBytesToBase64(bytes));
        setSaveState(`Saved to ${saved.path}`);
      } else {
        if (kind === 'chain')
          await downloadChainAsPdf(pdfExporter, entries, filename);
        else await downloadNoteAsPdf(pdfExporter, entries[0]);
        setSaveState('Downloaded');
      }
    } catch (error) {
      setSaveState('');
      setLoadError(
        `PDF export failed (${pdfExporter}): ${backendError(error)}`
      );
    }
  }

  function printChain() {
    if (typeof document === 'undefined' || typeof window === 'undefined')
      return;
    const renderEntry = (entry) =>
      `<h3>Seed idea</h3>${blocksToHtml(parseMarkdown(entry.question || '—'))}` +
      `<h3>Essay</h3>${blocksToHtml(parseMarkdown(entry.answer || '—'))}`;
    const sections = filteredNotes
      .map(noteEntry)
      .map(
        (entry) =>
          `<section><h2>${escapeHtml(entry.title)}</h2>${renderEntry(entry)}</section>`
      )
      .join('');
    const style = document.createElement('style');
    style.textContent = PRINT_CSS_RESET;
    const root = document.createElement('div');
    root.id = 'chain-print-root';
    root.innerHTML =
      `<h1>Chain Notes</h1><p>${filteredNotes.length} essay${filteredNotes.length === 1 ? '' : 's'} / ` +
      `${escapeHtml(new Date().toLocaleDateString())}</p><hr>${sections}`;
    const cleanup = () => {
      style.remove();
      root.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    document.body.append(style, root);
    window.print();
    setTimeout(cleanup, 2000);
  }

  return (
    <section className={sx('tool-page', 'essay-page')}>
      <div className={sx('essay-frame')}>
        <aside className={sx('essay-list-pane', 'frame-pane')}>
          <div className={sx('notes-list-heading')}>
            <div>
              <span className={sx('panel-label')}>Essay chain</span>
              <h2 className={sx('panel-title')}>{notes.length} essays</h2>
            </div>
            <button
              type="button"
              className={sx('new-note-button')}
              onClick={createNote}
            >
              + New
            </button>
          </div>
          <label>
            <span className={sx('sr-only')}>Search essays</span>
            <input
              className={sx('search-field')}
              type="search"
              placeholder="Search essays..."
              value={noteQuery}
              onInput={(event) => setNoteQuery(event.currentTarget.value)}
            />
          </label>
          <p className={sx('search-engine-note')}>
            {NOTE_SEARCH_ENGINE.detail} / {filteredNotes.length} matches
          </p>
          <div className={sx('divider')} aria-hidden="true" />
          <div className={sx('essay-list-scroll')}>
            {filteredNotes.map((note) => (
              <button
                type="button"
                key={note.id}
                className={sx(
                  'essay-item',
                  activeNoteId === note.id && styles.essayItemActive
                )}
                onClick={() => selectNote(note)}
              >
                <span className={sx('essay-chain-no')}>
                  {chainLabel(note.id, notes)} · {note.tag}
                </span>
                <strong className={sx('note-title')}>{note.title}</strong>
                <span className={sx('note-body')}>{notePreview(note)}</span>
              </button>
            ))}
            {filteredNotes.length === 0 && (
              <p className={sx('empty-notes')}>No notes found.</p>
            )}
          </div>
        </aside>

        <div className={sx('frame-divider-wide')} aria-hidden="true" />

        <article className={sx('essay-editor-pane', 'frame-pane')}>
          <div>
            <p className={sx('eyebrow')}>Essay workspace</p>
            <h1 className={sx('page-title')}>Chain Notes</h1>
            <p className={sx('lede')}>
              Grow a seed idea into a long-form essay, then publish the chain.
            </p>
          </div>
          <div className={sx('divider')} aria-hidden="true" />
          <div className={sx('note-editor-heading')}>
            <div>
              <span className={sx('panel-label')}>
                Chain / {chainLabel(activeNoteId, notes)}
              </span>
              <span className={sx('note-saved')}>
                {saveState || 'Stored in app data'}
              </span>
            </div>
            <fieldset className={sx('seg-group')}>
              <legend className={sx('sr-only')}>Editor mode</legend>
              <button
                type="button"
                className={sx(
                  'seg-button',
                  editorMode === 'write' && styles.segButtonActive
                )}
                onClick={() => setEditorMode('write')}
                aria-pressed={editorMode === 'write'}
              >
                Write
              </button>
              <button
                type="button"
                className={sx(
                  'seg-button',
                  editorMode === 'preview' && styles.segButtonActive
                )}
                onClick={() => setEditorMode('preview')}
                aria-pressed={editorMode === 'preview'}
                disabled={!activeNoteId}
              >
                Preview
              </button>
            </fieldset>
            <button
              type="button"
              className={sx('export-button')}
              onClick={() => runExport('note')}
              disabled={!activeNoteId}
            >
              PDF
            </button>
            <button
              type="button"
              className={sx('text-button')}
              onClick={deleteActiveNote}
              disabled={!activeNoteId}
            >
              Delete
            </button>
          </div>
          {loadError && <p className={sx('empty-notes')}>{loadError}</p>}
          {!activeNoteId ? (
            <p className={sx('empty-notes')}>
              Select an essay from the chain, or start a new seed.
            </p>
          ) : editorMode === 'preview' ? (
            <div>
              <h2 className={sx('panel-title')}>{noteTitle || 'Untitled'}</h2>
              <div className="essay-idea">
                <span className="essay-idea-kicker">Seed idea</span>
                <div
                  className="essay-preview"
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{
                    __html: ideaHtml || '<p>—</p>'
                  }}
                />
              </div>
              <div
                className={`${sx('preview-article')} essay-preview`}
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{
                  __html: previewHtml || '<p>—</p>'
                }}
              />
            </div>
          ) : (
            <div>
              <input
                className={sx('note-title-input')}
                aria-label="Essay title"
                placeholder="Essay title"
                value={noteTitle}
                disabled={!activeNoteId}
                onInput={(event) => {
                  const next = event.currentTarget.value;
                  setNoteTitle(next);
                  updateNote(next, noteQuestion, noteAnswer);
                }}
              />
              <div className={sx('note-meta-row')}>
                <span>{noteWordCount} words</span>
                <span className={sx('chain-nav')}>
                  <button
                    type="button"
                    className={sx('text-button')}
                    onClick={() => prevNote && selectNote(prevNote)}
                    disabled={!prevNote}
                    aria-label="Previous essay"
                  >
                    ← Prev
                  </button>
                  <span>
                    {chainIndex >= 0 ? chainIndex + 1 : '—'} /{' '}
                    {filteredNotes.length}
                  </span>
                  <button
                    type="button"
                    className={sx('text-button')}
                    onClick={() => nextNote && selectNote(nextNote)}
                    disabled={!nextNote}
                    aria-label="Next essay"
                  >
                    Next →
                  </button>
                </span>
              </div>
              <label className={sx('qna-field')}>
                <span className={sx('qna-label')}>Seed idea</span>
                <textarea
                  className={sx('qna-input', 'idea-input')}
                  aria-label="Seed idea"
                  placeholder="One-sentence core idea + brainstorm angles..."
                  value={noteQuestion}
                  disabled={!activeNoteId}
                  onInput={(event) => {
                    const next = event.currentTarget.value;
                    setNoteQuestion(next);
                    updateNote(noteTitle, next, noteAnswer);
                  }}
                />
              </label>
              <label className={sx('qna-field')}>
                <span className={sx('qna-label')}>Essay</span>
                <textarea
                  className={sx('qna-input', 'essay-input')}
                  aria-label="Essay"
                  placeholder="Elaborate the idea into a long-form essay (markdown supported)..."
                  value={noteAnswer}
                  disabled={!activeNoteId}
                  onInput={(event) => {
                    const next = event.currentTarget.value;
                    setNoteAnswer(next);
                    updateNote(noteTitle, noteQuestion, next);
                  }}
                />
              </label>
            </div>
          )}
          <details className={sx('qna-import')}>
            <summary>Import external chat</summary>
            <p className={sx('qna-help')}>
              Paste Question/Answer, Q/A, User/Assistant, or two paragraphs.
            </p>
            <textarea
              className={sx('qna-import-input')}
              aria-label="External chat to import"
              placeholder={'Seed idea: ...\n\nEssay: ...'}
              value={importText}
              disabled={!activeNoteId}
              onInput={(event) => setImportText(event.currentTarget.value)}
            />
            <button
              type="button"
              className={sx('text-button')}
              onClick={importChat}
              disabled={!activeNoteId || !importText.trim()}
            >
              Extract idea &amp; essay
            </button>
          </details>
          <details className={sx('qna-import')}>
            <summary>Backup &amp; restore</summary>
            <p className={sx('qna-help')}>
              Export all essays to a versioned JSON file, or restore from one.
              Restoring adds missing essays and updates changed ones; a clean
              restore assigns fresh ids.
            </p>
            <div className={sx('note-editor-footer')}>
              <button
                type="button"
                className={sx('text-button')}
                onClick={runBackupExport}
              >
                Export JSON
              </button>
              <label>
                <span className={sx('sr-only')}>Backup file to import</span>
                <input
                  ref={backupInputRef}
                  type="file"
                  accept="application/json,.json"
                  aria-label="Backup file to import"
                  onChange={(event) =>
                    setBackupFile(event.currentTarget.files?.[0] ?? null)
                  }
                />
              </label>
              <button
                type="button"
                className={sx('text-button')}
                onClick={runBackupImport}
                disabled={!backupFile}
              >
                Import JSON
              </button>
            </div>
            {backupState && <p className={sx('empty-notes')}>{backupState}</p>}
            {backupError && (
              <p className={sx('empty-notes')} role="alert">
                {backupError}
              </p>
            )}
          </details>
          <div className={sx('note-editor-footer')}>
            <span>
              Stored locally in app data. Native exports save into Documents;
              otherwise the browser downloads. Print opens the system dialog.
            </span>
            {saveError && (
              <button
                type="button"
                className={sx('text-button')}
                onClick={retrySave}
              >
                Retry save
              </button>
            )}
            <label>
              <span className={sx('sr-only')}>PDF exporter</span>
              <select
                className={sx('select')}
                aria-label="PDF exporter"
                value={pdfExporter}
                disabled={!activeNoteId}
                onChange={(event) => setPdfExporter(event.currentTarget.value)}
              >
                {NOTE_PDF_EXPORTERS.map((exporter) => (
                  <option value={exporter.id} key={exporter.id}>
                    {exporter.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className={sx('text-button')}
              onClick={() => runExport('note')}
              disabled={!activeNoteId}
            >
              Essay -&gt;
            </button>
            <button
              type="button"
              className={sx('text-button')}
              onClick={() => runExport('chain')}
              disabled={filteredNotes.length === 0}
            >
              Chain -&gt;
            </button>
            <button
              type="button"
              className={sx('text-button')}
              onClick={printChain}
              disabled={filteredNotes.length === 0}
            >
              Print
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}
