import { render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { ErrorBoundary } from './error-boundary.jsx';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ErrorBoundary', () => {
  test('renders a recovery screen when a child throws', () => {
    function BrokenChild() {
      throw new Error('fixture failure');
    }

    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <BrokenChild />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('fixture failure')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Reload workspace' })
    ).toBeTruthy();
  });
});
