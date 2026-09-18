import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, test } from 'vitest';
import { App } from './App.jsx';
import { frontendPlugins } from './plugins/index.js';
import { WORKSPACES } from './workspace-catalog.js';

describe('Focused workspace shell', () => {
  test('starts with only Writing and Analyze Music', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /writing/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /analyze music/i })).toBeTruthy();
    expect(screen.queryByText('All tools')).toBeNull();
  });

  test('opens Writing with a right-side feature grid', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /writing/i }));
    expect(await screen.findByLabelText('Writing workspace')).toBeTruthy();
    const menu = screen.getByLabelText('Writing feature menu');
    expect(menu).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Chain Notes' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'MIR Papers' })).toBeTruthy();
  });

  test('opens Analyze Music with a right-side feature grid', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /analyze music/i }));
    expect(
      await screen.findByLabelText('Analyze Music workspace')
    ).toBeTruthy();
    expect(screen.getByLabelText('Analyze Music feature menu')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'MIR Lab' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Monitor EQ' })).toBeTruthy();
  });

  test('keeps every registered feature in one workspace catalog', () => {
    const catalogIds = WORKSPACES.flatMap((workspace) => workspace.featureIds);
    expect(new Set(catalogIds)).toEqual(
      new Set(frontendPlugins.map((plugin) => plugin.id))
    );
  });
});
