import { useEffect, useRef, useState } from 'preact/hooks';
import { sx } from './stylex-styles.js';

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
      setCursor((value) => Math.min(value + 1, matches.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursor((value) => Math.max(value - 1, 0));
    } else if (event.key === 'Enter' && active) {
      onSelect(active.id);
    }
  }

  return (
    <div className={sx('tool-panel')} role="dialog" aria-label="Jump to tool">
      <input
        ref={inputRef}
        className={sx('search-field')}
        value={query}
        onInput={(event) => setQuery(event.currentTarget.value)}
        onKeyDown={onKey}
        placeholder="Jump to tool… (Esc to close)"
        aria-label="Jump to tool"
      />
      <ul className={sx('todo-list')}>
        {matches.map((plugin, index) => (
          <li key={plugin.id}>
            <button
              type="button"
              className={sx('text-button')}
              onClick={() => onSelect(plugin.id)}
              aria-current={plugin.id === active?.id ? 'true' : undefined}
            >
              {glyphFor(plugin.id)} {plugin.title}
              {index === cursor ? ' ←' : ''}
            </button>
          </li>
        ))}
      </ul>
      {matches.length === 0 && (
        <p className={sx('empty-notes')}>No tool matches.</p>
      )}
    </div>
  );
}
