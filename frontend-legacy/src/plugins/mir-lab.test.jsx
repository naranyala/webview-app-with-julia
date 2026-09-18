import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, test } from 'vitest';
import { MirLab } from './mir-lab.jsx';

describe('MirLab', () => {
  test('analyzes the demo tone in mirror mode', async () => {
    render(<MirLab />);
    expect(screen.getByText('MIR Lab')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Analyze demo tone' }));
    expect(await screen.findByText(/RMS/)).toBeTruthy();
    expect(screen.getByText(/48000Hz/)).toBeTruthy();
  });
});
