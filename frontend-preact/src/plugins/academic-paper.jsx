import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { backend, backendError } from '../backend.js';
import { styles, sx } from '../stylex-styles.js';
import { ImageAssets } from './image-assets.jsx';
import {
  DEFAULT_NOTE_PDF_EXPORTER,
  NOTE_PDF_EXPORTERS,
  pdfBytesToBase64
} from './note-pdf.js';
import {
  PAPER_PRINT_CSS,
  PAPER_SCREEN_CSS,
  paperContentHtml,
  paperStats,
  resolveCitations
} from './paper.js';
import { bundledPapers, getPaper } from './paper-data.js';
import { enhancePaperExtensions } from './paper-extensions.js';
import {
  downloadPaperAsPdf,
  generatePaperPdfBytes,
  PAPER_PDF_LAYOUTS,
  paperPdfFileName
} from './paper-pdf.js';
import { ReferenceManager } from './reference-manager.jsx';

export function AcademicPaper({ mode = 'read' }) {
  const [papers, setPapers] = useState(bundledPapers);
  const [paperId, setPaperId] = useState(bundledPapers[0]?.id || '');
  const [layout, setLayout] = useState('double');
  const [exporter, setExporter] = useState(DEFAULT_NOTE_PDF_EXPORTER);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const paperRoot = useRef(null);

  const paper =
    papers.find((entry) => entry.id === paperId) ||
    papers[0] ||
    getPaper(paperId);

  const resolved = useMemo(() => resolveCitations(paper), [paper]);
  const stats = useMemo(() => paperStats(paper), [paper]);
  const html = useMemo(
    () =>
      paperContentHtml(
        paper,
        resolved,
        layout === 'double' ? 'paper-columns' : 'paper-single'
      ),
    [paper, resolved, layout]
  );

  useEffect(() => {
    void enhancePaperExtensions(paperRoot.current);
  }, [html]);

  function updatePaper(next) {
    setPapers((current) =>
      current.map((entry) => (entry.id === next.id ? next : entry))
    );
  }

  if (mode === 'references') {
    return <ReferenceManager paper={paper} onChange={updatePaper} />;
  }

  if (mode === 'images') {
    return <ImageAssets paper={paper} onChange={updatePaper} />;
  }
  function scrollToSection(id) {
    if (typeof document === 'undefined') return;
    document
      .getElementById(`paper-${id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function runExport() {
    if (!paper) return;
    const filename = paperPdfFileName(paper);
    try {
      setError('');
      setMessage('Exporting...');
      if (backend.isNative()) {
        const bytes = await generatePaperPdfBytes(exporter, paper, layout);
        const saved = await backend.savePdf(filename, pdfBytesToBase64(bytes));
        setMessage(`Saved to ${saved.path}`);
      } else {
        await downloadPaperAsPdf(exporter, paper, layout);
        setMessage('Downloaded');
      }
    } catch (failure) {
      setMessage('');
      setError(`PDF export failed (${exporter}): ${backendError(failure)}`);
    }
  }

  async function printPaper() {
    if (typeof document === 'undefined' || typeof window === 'undefined')
      return;
    const style = document.createElement('style');
    style.textContent = PAPER_PRINT_CSS;
    const root = document.createElement('div');
    root.id = 'paper-print-root';
    root.innerHTML = paperContentHtml(
      paper,
      resolved,
      layout === 'double' ? 'paper-columns' : 'paper-single'
    );
    const cleanup = () => {
      style.remove();
      root.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    document.body.append(style, root);
    await enhancePaperExtensions(root);
    window.print();
    setTimeout(cleanup, 2000);
  }

  return (
    <section className={sx('tool-page')}>
      <style>{PAPER_SCREEN_CSS}</style>
      <div className={sx('tool-heading')}>
        <div>
          <p className={sx('eyebrow')}>Reading</p>
          <h1 className={sx('page-title')}>Academic Paper</h1>
          <p className={sx('lede')}>
            {stats.sections} sections · {stats.words.toLocaleString()} words ·{' '}
            {stats.readingMinutes} min read · {stats.references} references ·{' '}
            {stats.figures} figures
          </p>
        </div>
        <span className={sx('mock-badge')}>
          {layout === 'double'
            ? 'Academic · two columns'
            : 'Preprint · one column'}
        </span>
      </div>

      <div className={sx('tool-panel')}>
        <div className={sx('notes-list-heading')}>
          <div className={sx('recent-strip')} style={{ padding: 0, margin: 0 }}>
            {papers.map((entry) => (
              <button
                type="button"
                key={entry.id}
                className={sx(
                  'chip',
                  paperId === entry.id && styles.sideItemActive
                )}
                onClick={() => setPaperId(entry.id)}
              >
                {entry.title}
              </button>
            ))}
          </div>
          <div>
            {PAPER_PDF_LAYOUTS.map((option) => (
              <button
                type="button"
                key={option.id}
                className={sx(
                  'chip',
                  layout === option.id && styles.sideItemActive
                )}
                onClick={() => setLayout(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <nav
          className={sx('recent-strip')}
          style={{ padding: 0 }}
          aria-label="Sections"
        >
          {paper.sections.map((section) => (
            <button
              type="button"
              key={section.id}
              className={sx('chip')}
              onClick={() => scrollToSection(section.id)}
            >
              {section.title}
            </button>
          ))}
        </nav>
      </div>

      <article className={sx('tool-panel')}>
        <div
          className="paper-reading"
          ref={paperRoot}
          dangerouslySetInnerHTML={{ __html: html }}
        />
        {resolved.missing.length > 0 && (
          <p className={sx('empty-notes')}>
            Missing references: {resolved.missing.join(', ')}
          </p>
        )}
        <div className={sx('note-editor-footer')}>
          <span>
            {message ||
              'Native exports save into Documents; otherwise the browser downloads.'}
          </span>
          {error && (
            <span className={sx('error')} role="alert">
              {error}
            </span>
          )}
          <label>
            <span className={sx('sr-only')}>PDF exporter</span>
            <select
              className={sx('select')}
              aria-label="PDF exporter"
              value={exporter}
              disabled={layout === 'double'}
              onChange={(event) => setExporter(event.currentTarget.value)}
            >
              {NOTE_PDF_EXPORTERS.map((option) => (
                <option value={option.id} key={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {layout === 'double' && <span>Two-column export uses jsPDF.</span>}
          <button
            type="button"
            className={sx('text-button')}
            onClick={runExport}
          >
            Export PDF
          </button>
          <button
            type="button"
            className={sx('text-button')}
            onClick={printPaper}
          >
            Print
          </button>
        </div>
      </article>
    </section>
  );
}
