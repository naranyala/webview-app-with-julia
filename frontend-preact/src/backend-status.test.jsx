import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { BackendStatus } from './backend-status.jsx';

afterEach(() => {
  cleanup();
  delete window.getStatus;
  delete window.__PREACT_MOCK_BRIDGE__;
});

beforeEach(() => {
  window.localStorage.clear();
});

describe('BackendStatus', () => {
  test('reports mock health and refresh details', async () => {
    render(<BackendStatus />);

    expect(await screen.findByText('Backend (mock) · Backend ok')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(await screen.findByText(/Browser mock · t:\d+/)).toBeTruthy();
  });

  test('shows degraded health from a native status response', async () => {
    window.getStatus = () => Promise.resolve({ status: 'degraded' });
    render(<BackendStatus />);

    expect(
      await screen.findByText('Backend (mock) · Backend degraded')
    ).toBeTruthy();
    expect(
      screen.getByText('Backend health: Backend status: degraded')
    ).toBeTruthy();
  });

  test('shows a readable error when the bridge is unavailable', async () => {
    window.__PREACT_MOCK_BRIDGE__ = false;
    render(<BackendStatus compact />);

    expect(
      await screen.findByText('Backend (mock) · Backend unavailable')
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Backend health: getStatus is unavailable outside the native shell'
      )
    ).toBeTruthy();
  });
});
