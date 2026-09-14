import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, test } from 'vitest';
import { App } from './App.jsx';
import { SHORTCUTS } from './shortcuts.js';
import { ShortcutsHelp } from './shortcuts-help.jsx';

describe('ShortcutsHelp', () => {
  test('lists every catalogued shortcut', () => {
    render(<ShortcutsHelp onClose={() => {}} />);
    for (const entry of SHORTCUTS) {
      expect(screen.getByText(entry.description)).toBeTruthy();
      // Combos like Esc also appear in the dialog header hint.
      expect(screen.getAllByText(entry.combo).length).toBeGreaterThan(0);
    }
  });

  test('close button dismisses the dialog', () => {
    let closed = 0;
    render(
      <ShortcutsHelp
        onClose={() => {
          closed += 1;
        }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(closed).toBe(1);
  });
});

describe('App shell shortcuts and health', () => {
  test('shows a connected backend badge', async () => {
    render(<App />);
    expect(await screen.findByLabelText('Backend Connected')).toBeTruthy();
  });

  test('question mark opens the shortcut dialog, escape closes it', async () => {
    render(<App />);
    await screen.findByLabelText('Backend Connected');
    fireEvent.keyDown(window, { key: '?' });
    expect(
      screen.getByRole('dialog', { name: 'Keyboard shortcuts' })
    ).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(
      screen.queryByRole('dialog', { name: 'Keyboard shortcuts' })
    ).toBeNull();
  });
});
