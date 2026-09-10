import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { backend, backendError } from '../backend.js';
import { noteSaveCoordinator } from '../note-save-coordinator.js';
import { styles, sx } from '../stylex-styles.js';
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
  const [importText, setImportText] = useState('');
  const [pdfExporter, setPdfExporter] = useState(DEFAULT_NOTE_PDF_EXPORTER);
  const [loadError, setLoadError] = useState('');
  const [saveState, setSaveState] = useState('');
  const [saveError, setSaveError] = useState('');
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
  }, []);

  const noteSearcher = useMemo(() => createNoteSearcher(notes), [notes]);
  const filteredNotes = useMemo(
    () => noteSearcher.search(noteQuery),
    [noteQuery, noteSearcher]
  );
  const noteWordCount = `${noteQuestion} ${noteAnswer}`.trim()
    ? `${noteQuestion} ${noteAnswer}`.trim().split(/\s+/).length
    : 0;

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
        'New AI chat',
        'AI Chat',
        serializeQna('', '')
      );
      setNotes((current) => [...current, note]);
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
      `<h3>Question</h3>${blocksToHtml(parseMarkdown(entry.question || '—'))}` +
      `<h3>Answer</h3>${blocksToHtml(parseMarkdown(entry.answer || '—'))}`;
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
      `<h1>Chain Notes</h1><p>${filteredNotes.length} exchange${filteredNotes.length === 1 ? '' : 's'} / ` +
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
    <section className={sx('tool-page')}>
      <div className={sx('tool-heading')}>
        <div>
          <p className={sx('eyebrow')}>Local knowledge base</p>
          <h1 className={sx('page-title')}>Chain Notes</h1>
          <p className={sx('lede')}>
            Save external AI conversations as searchable question-and-answer
            cards.
          </p>
        </div>
        <span className={sx('mock-badge')}>
          {backend.isNative() ? 'Stored' : 'Browser mock'}
        </span>
      </div>

      <div className={sx('notes-layout')}>
        <aside className={sx('tool-panel', 'notes-list-panel')}>
          <div className={sx('notes-list-heading')}>
            <div>
              <span className={sx('panel-label')}>Saved exchanges</span>
              <h2 className={sx('panel-title')}>{notes.length} chats</h2>
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
            <span className={sx('sr-only')}>Search chats</span>
            <input
              className={sx('search-field')}
              type="search"
              placeholder="Search chats..."
              value={noteQuery}
              onInput={(event) => setNoteQuery(event.currentTarget.value)}
            />
          </label>
          <p className={sx('search-engine-note')}>
            {NOTE_SEARCH_ENGINE.detail} / {filteredNotes.length} matches
          </p>
          <div className={sx('notes-list')}>
            {filteredNotes.map((note) => (
              <button
                type="button"
                key={note.id}
                className={sx(
                  'note-list-item',
                  activeNoteId === note.id && styles.noteItemActive
                )}
                onClick={() => selectNote(note)}
              >
                <span className={sx('note-list-meta')}>
                  <span>{note.tag}</span>
                  <span className={sx('note-list-updated')}>
                    {note.updated}
                  </span>
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

        <article className={sx('tool-panel', 'note-editor')}>
          <div className={sx('note-editor-heading')}>
            <div>
              <span className={sx('panel-label')}>
                Chain / {chainLabel(activeNoteId, notes)}
              </span>
              <span className={sx('note-saved')}>
                {saveState || 'Stored in app data'}
              </span>
            </div>
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
          <input
            className={sx('note-title-input')}
            aria-label="Chat title"
            placeholder="Chat title"
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
            <span>Question + answer</span>
          </div>
          <label className={sx('qna-field')}>
            <span className={sx('qna-label')}>Question</span>
            <textarea
              className={sx('qna-input', 'qna-question-input')}
              aria-label="Question"
              placeholder="Paste the question you asked..."
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
            <span className={sx('qna-label')}>Answer</span>
            <textarea
              className={sx('qna-input', 'qna-answer-input')}
              aria-label="Answer"
              placeholder="Paste the generated answer..."
              value={noteAnswer}
              disabled={!activeNoteId}
              onInput={(event) => {
                const next = event.currentTarget.value;
                setNoteAnswer(next);
                updateNote(noteTitle, noteQuestion, next);
              }}
            />
          </label>
          <details className={sx('qna-import')}>
            <summary>Import external chat</summary>
            <p className={sx('qna-help')}>
              Paste Question/Answer, Q/A, User/Assistant, or two paragraphs.
            </p>
            <textarea
              className={sx('qna-import-input')}
              aria-label="External chat to import"
              placeholder={'Question: ...\n\nAnswer: ...'}
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
              Extract Q&A
            </button>
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
              Note -&gt;
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
