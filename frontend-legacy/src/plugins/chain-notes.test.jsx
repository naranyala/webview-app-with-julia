import { fireEvent, render, screen } from '@testing-library/preact';
import { beforeEach, describe, expect, test } from 'vitest';
import { ChainNotes } from './chain-notes.jsx';

beforeEach(() => {
  window.localStorage.clear();
});

describe('ChainNotes session log', () => {
  test('renders the empty session log', async () => {
    render(<ChainNotes />);
    expect(screen.getByText('Chain Notes')).toBeTruthy();
    expect(await screen.findByText('No notes found.')).toBeTruthy();
  });

  test('creates a note through the New button', async () => {
    render(<ChainNotes />);
    await screen.findByText('No notes found.');
    fireEvent.click(screen.getByRole('button', { name: '+ New' }));
    expect(await screen.findByText(/Chain \/ 01/)).toBeTruthy();
  });
});
