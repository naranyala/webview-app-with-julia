import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, test } from 'vitest';
import { MediaInspector } from './media-inspector.jsx';

describe('MediaInspector', () => {
  test('inspects and previews a local path with visible feedback', async () => {
    render(<MediaInspector />);
    const input = screen.getByLabelText('Absolute file path');
    fireEvent.input(input, { target: { value: '/home/user/example.md' } });
    fireEvent.click(screen.getByRole('button', { name: 'Inspect' }));

    expect(await screen.findByText('Inspection complete.')).toBeTruthy();
    expect(screen.getByText('MarkdownText')).toBeTruthy();
    expect(screen.getByText('text/markdown')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Preview text' }));
    expect(await screen.findByText('Browser mock text')).toBeTruthy();
  });

  test('plans and completes a conversion job', async () => {
    render(<MediaInspector />);
    fireEvent.input(screen.getByLabelText('Absolute file path'), {
      target: { value: '/home/user/example.md' }
    });
    fireEvent.input(screen.getByLabelText('Output path in Documents'), {
      target: { value: '/home/user/Documents/example.html' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Plan route' }));
    expect(await screen.findByText(/MarkdownText.*HTMLDocument/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Convert' }));
    expect(
      await screen.findByText('Saved to /home/user/Documents/example.html')
    ).toBeTruthy();
  });
});
