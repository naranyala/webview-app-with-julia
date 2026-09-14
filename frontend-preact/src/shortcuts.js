// Global keyboard shortcuts for the workbench shell.
//
// Framework-free on purpose: matching operates on plain `{key, ctrlKey,
// metaKey, altKey, shiftKey}` shapes so it can be unit-tested with node
// (`check-shortcuts.mjs`) without a DOM. `App.jsx` owns the wiring and skips
// app shortcuts while the user is typing (except palette and dismiss).

export const SHORTCUTS = [
  {
    id: 'palette',
    combo: 'Ctrl/⌘ K',
    description: 'Jump to any tool'
  },
  {
    id: 'toggle-sidebar',
    combo: 'Ctrl/⌘ B',
    description: 'Show or hide the sidebar'
  },
  {
    id: 'toggle-theme',
    combo: 'Ctrl/⌘ Shift L',
    description: 'Switch between dark and light mode'
  },
  {
    id: 'tool-jump',
    combo: 'Alt 1…9',
    description: 'Open a tool by position (Alt 0 goes home)'
  },
  {
    id: 'help',
    combo: '?',
    description: 'Show this shortcut list'
  },
  {
    id: 'close-overlay',
    combo: 'Esc',
    description: 'Close dialog, palette, or sidebar'
  }
];

function mod(event) {
  return event.ctrlKey || event.metaKey;
}

// True for text entry targets where single-key and Alt shortcuts must not
// fire. Ctrl/⌘ combos and Escape stay global so the palette is reachable
// while typing.
export function isEditableTarget(target) {
  if (!target || typeof target !== 'object') return false;
  if (target.isContentEditable) return true;
  const tag = typeof target.tagName === 'string' ? target.tagName : '';
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

// Match a key event to a shell action. Returns `{ type, ... }` or null.
// Pure: safe to call with synthetic event shapes in tests.
export function matchShortcut(event) {
  if (!event || typeof event.key !== 'string') return null;
  const key = event.key;

  if (key === 'Escape') return { type: 'close-overlay' };
  if (mod(event) && !event.altKey && key.toLowerCase() === 'k') {
    return { type: 'toggle-palette' };
  }
  // App shortcuts below stay out of text fields.
  if (isEditableTarget(event.target)) return null;
  if (mod(event) && !event.altKey && key.toLowerCase() === 'b') {
    return { type: 'toggle-sidebar' };
  }
  if (
    mod(event) &&
    !event.altKey &&
    event.shiftKey &&
    key.toLowerCase() === 'l'
  ) {
    return { type: 'toggle-theme' };
  }
  if (event.altKey && !mod(event) && !event.shiftKey && /^[0-9]$/.test(key)) {
    return key === '0'
      ? { type: 'go-home' }
      : { type: 'open-tool', index: Number(key) - 1 };
  }
  if (
    key === '?' &&
    !mod(event) &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey
  ) {
    return { type: 'show-help' };
  }
  return null;
}
