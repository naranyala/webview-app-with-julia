import { fireEvent, render, screen } from '@testing-library/preact';
import { beforeEach, describe, expect, test } from 'vitest';
import { ChainNotes } from './chain-notes.jsx';

beforeEach(() => {
  window.localStorage.clear();
  URL.createObjectURL = () => 'blob:backup';
  URL.revokeObjectURL = () => {};
});

describe('ChainNotes backup & restore', () => {
  test('exports an empty library as a JSON download', async () => {
    render(<ChainNotes />);
    await screen.findByText('No notes found.');
    fireEvent.click(screen.getByRole('button', { name: 'Export JSON' }));
    expect(
      await screen.findByText(
        /Downloaded chain-notes-backup-.*\.json \(0 notes\)/
      )
    ).toBeTruthy();
  });

  test('rejects a malformed backup file on import', async () => {
    render(<ChainNotes />);
    await screen.findByText('No notes found.');
    const file = new File(['{not json'], 'backup.json', {
      type: 'application/json'
    });
    fireEvent.change(screen.getByLabelText('Backup file to import'), {
      target: { files: [file] }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Import JSON' }));
    expect(await screen.findByText(/Backup import failed/)).toBeTruthy();
  });

  test('imports a valid backup through the mock bridge', async () => {
    render(<ChainNotes />);
    await screen.findByText('No notes found.');
    const payload = JSON.stringify({
      schemaVersion: 1,
      app: 'chain-notes',
      exportedAt: '2026-01-01T00:00:00.000Z',
      count: 1,
      notes: [
        {
          id: 'restored-1',
          title: 'Restored essay',
          tag: 'Draft',
          updated: '',
          body: 'Question:\nQ\n\nAnswer:\nA'
        }
      ]
    });
    const file = new File([payload], 'backup.json', {
      type: 'application/json'
    });
    fireEvent.change(screen.getByLabelText('Backup file to import'), {
      target: { files: [file] }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Import JSON' }));
    expect(await screen.findByText(/Imported 1, updated 0/)).toBeTruthy();
    expect(await screen.findByText('Restored essay')).toBeTruthy();
  });
});
