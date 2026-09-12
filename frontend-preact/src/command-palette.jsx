import { useEffect, useRef, useState } from 'preact/hooks';
import { styles, sx } from './stylex-styles.js';

// Minimal Ctrl+K palette (vlang T07 parity, adapted to this shell's plugin
// registry). Filters `frontendPlugins` by title/description; Enter opens the
// highlighted tool. No additional dependencies.
export function CommandPalette({ plugins, glyphFor, onSelect, onClose }) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);

  const matches = plugins.filter((plugin) => {
    const haystack = `${plugin.title} ${plugin.description}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });
  const active = matches[Math.min(cursor, Math.max(matches.length - 1, 0))];

  useEffect(() => {
    inputRef.current?.focus();
    setCursor(0);
  }, [query]);

  function onKey(event) {
    if (event.key === 'Escape') onClose();
    else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursor((value) =>
        Math.min(value + 1, Math.max(matches.length - 1, 0))
      );
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursor((value) => Math.max(value - 1, 0));
    } else if (event.key === 'Enter' && active) {
      onSelect(active.id);
    }
  }

  return (
    <div className={sx('palette-overlay')}>
      <div
        className={sx('palette')}
        role="dialog"
        aria-label="Jump to tool"
        aria-modal="true"
      >
        <div className={sx('palette-header')}>
          <div>
            <span className={sx('panel-label')}>Quick switcher</span>
            <strong className={sx('palette-title')}>Jump to a workspace</strong>
          </div>
          <kbd className={sx('palette-hint')}>Esc</kbd>
        </div>
        <input
          ref={inputRef}
          className={sx('search-field')}
          value={query}
          onInput={(event) => setQuery(event.currentTarget.value)}
          onKeyDown={onKey}
          placeholder="Search tools, descriptions…"
          aria-label="Jump to tool"
        />
        <ul className={sx('palette-results')}>
          {matches.map((plugin, index) => (
            <li key={plugin.id}>
              <button
                type="button"
                className={sx(
                  'palette-item',
                  index === cursor && styles.paletteItemActive
                )}
                onClick={() => onSelect(plugin.id)}
                aria-current={plugin.id === active?.id ? 'true' : undefined}
              >
                <span className={sx('palette-glyph')} aria-hidden="true">
                  {glyphFor(plugin.id)}
                </span>
                <span className={sx('palette-copy')}>
                  <strong>{plugin.title}</strong>
                  <small className={sx('palette-copy-small')}>
                    {plugin.description}
                  </small>
                </span>
                <kbd className={sx('palette-key')}>
                  {String(index + 1).padStart(2, '0')}
                </kbd>
              </button>
            </li>
          ))}
        </ul>
        {matches.length === 0 && (
          <p className={sx('palette-empty')}>No tool matches.</p>
        )}
        <div className={sx('palette-footer')}>
          <span>↑↓ to move</span>
          <span>Enter to open</span>
        </div>
      </div>
    </div>
  );
}
