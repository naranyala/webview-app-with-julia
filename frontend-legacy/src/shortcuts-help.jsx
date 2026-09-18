import { SHORTCUTS } from './shortcuts.js';
import { sx } from './stylex-styles.js';

// Read-only list of shell shortcuts. Rendered inside the shared palette
// overlay so it inherits dialog styling without new StyleX definitions.
export function ShortcutsHelp({ onClose }) {
  return (
    <div className={sx('palette-overlay')}>
      <div
        className={sx('palette')}
        role="dialog"
        aria-label="Keyboard shortcuts"
        aria-modal="true"
      >
        <div className={sx('palette-header')}>
          <div>
            <span className={sx('panel-label')}>Workbench</span>
            <strong className={sx('palette-title')}>Keyboard shortcuts</strong>
          </div>
          <kbd className={sx('palette-hint')}>Esc</kbd>
        </div>
        <ul className={sx('palette-results')}>
          {SHORTCUTS.map((entry) => (
            <li key={entry.id}>
              <span
                className={sx('palette-item')}
                style={{ cursor: 'default' }}
              >
                <span className={sx('palette-copy')}>
                  <strong>{entry.description}</strong>
                </span>
                <kbd className={sx('palette-key')}>{entry.combo}</kbd>
              </span>
            </li>
          ))}
        </ul>
        <div className={sx('palette-footer')}>
          <span>Tool jumps follow sidebar order</span>
          <button type="button" className={sx('text-button')} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
