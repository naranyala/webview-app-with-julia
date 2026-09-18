import { useMemo, useState } from 'preact/hooks';
import { sx } from '../stylex-styles.js';
import { sanitizeSvg } from './note-markdown.js';
import { embeddedFigureIds, figureKind, MAX_FIGURE_BYTES } from './paper.js';

function suggestId(caption, figures) {
  const base =
    String(caption || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'figure';
  let candidate = base;
  let counter = 2;
  const taken = new Set(figures.map((figure) => figure.id));
  while (taken.has(candidate)) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }
  return candidate;
}

function usedInSections(paper, id) {
  return (paper.sections || [])
    .filter((section) => String(section.body || '').includes(`(fig:${id})`))
    .map((section) => section.title);
}

export function ImageAssets({ paper, onChange }) {
  const [caption, setCaption] = useState('');
  const [credit, setCredit] = useState('');
  const [svgText, setSvgText] = useState('');
  const [formError, setFormError] = useState('');

  const figures = paper.figures || [];
  const usage = useMemo(() => {
    const ids = new Set(embeddedFigureIds(paper));
    return { embedded: ids };
  }, [paper]);

  function addFigure(record) {
    if (
      !record ||
      typeof record.id !== 'string' ||
      !/^[\w-]+$/.test(record.id)
    ) {
      setFormError('Figure ids use letters, digits, underscore, or dash.');
      return false;
    }
    if (figures.some((figure) => figure.id === record.id)) {
      setFormError(`Figure ${record.id} already exists.`);
      return false;
    }
    if (!record.caption || record.caption.trim() === '') {
      setFormError('A caption is required.');
      return false;
    }
    setFormError('');
    onChange({ ...paper, figures: [...figures, record] });
    return true;
  }

  function updateFigure(id, patch) {
    onChange({
      ...paper,
      figures: figures.map((figure) =>
        figure.id === id ? { ...figure, ...patch } : figure
      )
    });
  }

  function deleteFigure(id) {
    onChange({
      ...paper,
      figures: figures.filter((figure) => figure.id !== id)
    });
  }

  function handleFiles(files) {
    const file = files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/svg+xml'].includes(file.type)) {
      setFormError('Upload PNG, JPEG, or SVG artwork.');
      return;
    }
    if (file.size > MAX_FIGURE_BYTES) {
      setFormError('Artwork must be 1.5 MB or smaller.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (file.type === 'image/svg+xml') {
        const text = String(reader.result || '');
        if (
          addFigure({
            id: suggestId(caption, figures),
            caption: caption.trim(),
            credit: credit.trim(),
            svg: text
          })
        ) {
          setCaption('');
          setCredit('');
        }
      } else if (
        addFigure({
          id: suggestId(caption, figures),
          caption: caption.trim(),
          credit: credit.trim(),
          dataUrl: String(reader.result || '')
        })
      ) {
        setCaption('');
        setCredit('');
      }
    };
    if (file.type === 'image/svg+xml') reader.readAsText(file);
    else reader.readAsDataURL(file);
  }

  function addSvgPaste() {
    if (svgText.trim() === '') {
      setFormError('Paste SVG markup first.');
      return;
    }
    if (
      addFigure({
        id: suggestId(caption, figures),
        caption: caption.trim(),
        credit: credit.trim(),
        svg: svgText
      })
    ) {
      setCaption('');
      setCredit('');
      setSvgText('');
    }
  }

  return (
    <section className={sx('tool-page')}>
      <div className={sx('tool-heading')}>
        <div>
          <p className={sx('eyebrow')}>Paper · figures</p>
          <h1 className={sx('page-title')}>Image Assets</h1>
          <p className={sx('lede')}>
            {figures.length} figures · embed with ![Caption](fig:id) on its own
            line
          </p>
        </div>
      </div>

      <div className={sx('tool-panel')}>
        <span className={sx('panel-label')}>Figure library</span>
        <div className={sx('notes-list')}>
          {figures.map((figure, index) => (
            <div key={figure.id} className={sx('notes-list-heading')}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span className={sx('panel-label')}>
                  Figure {index + 1} · {figureKind(figure)} · {figure.id}
                </span>
                <div
                  dangerouslySetInnerHTML={{
                    __html:
                      figureKind(figure) === 'svg'
                        ? sanitizeSvg(figure.svg)
                        : ''
                  }}
                />
                {figureKind(figure) !== 'svg' && figure.dataUrl && (
                  <img
                    src={figure.dataUrl}
                    alt={figure.caption}
                    style={{ maxWidth: '100%' }}
                  />
                )}
                <input
                  className={sx('search-field')}
                  aria-label="Figure caption"
                  value={figure.caption}
                  onInput={(event) =>
                    updateFigure(figure.id, {
                      caption: event.currentTarget.value
                    })
                  }
                />
                <input
                  className={sx('search-field')}
                  aria-label="Figure credit"
                  placeholder="Credit (optional)"
                  value={figure.credit || ''}
                  onInput={(event) =>
                    updateFigure(figure.id, {
                      credit: event.currentTarget.value
                    })
                  }
                />
                <p className={sx('empty-notes')}>
                  {usedInSections(paper, figure.id).length > 0
                    ? `Used in: ${usedInSections(paper, figure.id).join(', ')}`
                    : usage.embedded.has(figure.id)
                      ? 'Embedded'
                      : 'Not embedded yet'}
                </p>
              </div>
              <button
                type="button"
                className={sx('text-button')}
                onClick={() => deleteFigure(figure.id)}
              >
                Delete
              </button>
            </div>
          ))}
          {figures.length === 0 && (
            <p className={sx('empty-notes')}>No figures yet.</p>
          )}
        </div>
      </div>

      <div className={sx('tool-panel')}>
        <span className={sx('panel-label')}>Add figure</span>
        <label>
          <span className={sx('sr-only')}>Caption</span>
          <input
            className={sx('search-field')}
            placeholder="Caption"
            value={caption}
            onInput={(event) => setCaption(event.currentTarget.value)}
          />
        </label>
        <label>
          <span className={sx('sr-only')}>Credit</span>
          <input
            className={sx('search-field')}
            placeholder="Credit (optional)"
            value={credit}
            onInput={(event) => setCredit(event.currentTarget.value)}
          />
        </label>
        <label>
          <span className={sx('sr-only')}>Upload artwork</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/svg+xml"
            onChange={(event) => handleFiles(event.currentTarget.files)}
          />
        </label>
        <label>
          <span className={sx('sr-only')}>Or paste SVG markup</span>
          <textarea
            className={sx('qna-import-input')}
            placeholder="…or paste <svg> markup here, then Add SVG"
            value={svgText}
            onInput={(event) => setSvgText(event.currentTarget.value)}
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
          onClick={addSvgPaste}
        >
          + Add SVG
        </button>
        <p className={sx('empty-notes')}>
          Uploads become PNG/JPEG embeds everywhere; SVG renders inline in the
          reader and print, with a labeled placeholder in PDFs.
        </p>
      </div>
    </section>
  );
}
