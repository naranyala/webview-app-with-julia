import { isEditableTarget, matchShortcut, SHORTCUTS } from './src/shortcuts.js';

let failures = 0;

function check(name, condition, extra = '') {
  if (condition) {
    console.log(`ok: ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL: ${name}${extra ? ` (${extra})` : ''}`);
  }
}

const key = (overrides) => ({
  key: '',
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  target: { tagName: 'BODY' },
  ...overrides
});

check(
  'ctrl+k opens palette',
  matchShortcut(key({ key: 'k', ctrlKey: true }))?.type === 'toggle-palette'
);
check(
  'cmd+k opens palette',
  matchShortcut(key({ key: 'K', metaKey: true }))?.type === 'toggle-palette'
);
check(
  'ctrl+k works inside inputs',
  matchShortcut(key({ key: 'k', ctrlKey: true, target: { tagName: 'INPUT' } }))
    ?.type === 'toggle-palette'
);
check(
  'escape dismisses',
  matchShortcut(key({ key: 'Escape' }))?.type === 'close-overlay'
);
check(
  'ctrl+b toggles sidebar',
  matchShortcut(key({ key: 'b', ctrlKey: true }))?.type === 'toggle-sidebar'
);
check(
  'ctrl+shift+l toggles theme',
  matchShortcut(key({ key: 'l', ctrlKey: true, shiftKey: true }))?.type ===
    'toggle-theme'
);
check(
  'plain l does nothing',
  matchShortcut(key({ key: 'l', target: { tagName: 'BODY' } })) === null
);
check(
  'alt+1 opens first tool',
  matchShortcut(key({ key: '1', altKey: true }))?.type === 'open-tool' &&
    matchShortcut(key({ key: '1', altKey: true }))?.index === 0
);
check(
  'alt+0 goes home',
  matchShortcut(key({ key: '0', altKey: true }))?.type === 'go-home'
);
check(
  'question mark shows help',
  matchShortcut(key({ key: '?', target: { tagName: 'BODY' } }))?.type ===
    'show-help'
);
check(
  'typing ? in textarea does nothing',
  matchShortcut(key({ key: '?', target: { tagName: 'TEXTAREA' } })) === null
);
check(
  'alt+digit in input does nothing',
  matchShortcut(key({ key: '2', altKey: true, target: { tagName: 'INPUT' } }))
    === null
);
check(
  'unrelated key does nothing',
  matchShortcut(key({ key: 'x', target: { tagName: 'BODY' } })) === null
);
check('input is editable', isEditableTarget({ tagName: 'INPUT' }) === true);
check(
  'contenteditable is editable',
  isEditableTarget({ tagName: 'DIV', isContentEditable: true }) === true
);
check('body is not editable', isEditableTarget({ tagName: 'BODY' }) === false);
check(
  'shortcut catalog covers all actions',
  ['palette', 'toggle-sidebar', 'toggle-theme', 'tool-jump', 'help', 'close-overlay'].every(
    (id) => SHORTCUTS.some((entry) => entry.id === id)
  )
);

if (failures > 0) process.exit(1);
console.log('shortcuts: all tests passed');
