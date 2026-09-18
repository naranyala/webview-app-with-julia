import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, test, vi } from 'vitest';
import { CommandPalette } from './command-palette.jsx';

const plugins = [
  {
    id: 'notes',
    title: 'Chain Notes',
    description: 'Persistent notes with tagging and search.'
  },
  {
    id: 'map',
    title: 'Indonesia Map',
    description: 'Browse provinces and districts.'
  }
];

function renderPalette(overrides = {}) {
  return render(
    <CommandPalette
      plugins={plugins}
      glyphFor={(id) => id.toUpperCase()}
      onSelect={vi.fn()}
      onClose={vi.fn()}
      {...overrides}
    />
  );
}

describe('CommandPalette', () => {
  test('filters by title and description and shows an empty state', () => {
    renderPalette();

    expect(screen.getByRole('button', { name: /Chain Notes/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Indonesia Map/ })).toBeTruthy();

    fireEvent.input(screen.getByRole('textbox', { name: 'Jump to tool' }), {
      target: { value: 'district' }
    });
    expect(screen.getByRole('button', { name: /Indonesia Map/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Chain Notes/ })).toBeNull();

    fireEvent.input(screen.getByRole('textbox', { name: 'Jump to tool' }), {
      target: { value: 'missing' }
    });
    expect(screen.getByText('No tool matches.')).toBeTruthy();
  });

  test('selects the highlighted tool and closes with Escape', async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    renderPalette({ onSelect, onClose });
    const input = screen.getByRole('textbox', { name: 'Jump to tool' });

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    await Promise.resolve();
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onSelect).toHaveBeenCalledWith('map');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
