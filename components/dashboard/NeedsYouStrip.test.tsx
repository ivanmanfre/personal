// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NeedsYouStrip } from './NeedsYouStrip';

describe('NeedsYouStrip', () => {
  it('renders nothing when all counts are zero', () => {
    const { container } = render(<NeedsYouStrip items={[{ label: 'errors', count: 0, tone: 'bad', onJump: () => {} }]} />);
    expect(container.firstChild).toBeNull();
  });
  it('renders only non-zero items and fires onJump', () => {
    const jump = vi.fn();
    render(<NeedsYouStrip items={[
      { label: 'errors', count: 2, tone: 'bad', onJump: jump },
      { label: 'in review', count: 0, tone: 'warn', onJump: () => {} },
    ]} />);
    expect(screen.queryByText(/in review/)).toBeNull();
    screen.getByRole('button', { name: /2 errors/ }).click();
    expect(jump).toHaveBeenCalled();
  });
});
