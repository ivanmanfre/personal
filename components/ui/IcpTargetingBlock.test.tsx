// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import IcpTargetingBlock from './IcpTargetingBlock';

const data = {
  icpLine: 'DTC skincare founders running $100k to $1M a month',
  segments: [{ label: 'DTC skincare', note: 'their current buyer' }],
  leads: [
    { name: 'Ada Lovelace', headline: 'Founder, Analytical Co', reason: 'Engaged your posts' },
    { name: 'Grace Hopper', headline: 'CEO, Compiler Labs', reason: 'Engaged your posts' },
    { name: 'Karen Sparck Jones', headline: 'Founder, Retrieval Ltd', reason: 'In your connections' },
  ],
  poolLabels: ['People who engage your posts', 'People who engage your competitors'],
};

describe('IcpTargetingBlock', () => {
  it('renders the ICP line, every lead, and every pool label', () => {
    render(<IcpTargetingBlock data={data} who="Ada" />);
    expect(screen.getByText(/DTC skincare founders running/)).toBeTruthy();
    expect(screen.getByText('Grace Hopper')).toBeTruthy();
    expect(screen.getByText('People who engage your competitors')).toBeTruthy();
  });

  it('describes the liveness check as process and never reports a result', () => {
    render(<IcpTargetingBlock data={data} who="Ada" />);
    const text = document.body.textContent || '';
    expect(text).toContain('before it enters the send queue');
    expect(text).not.toMatch(/\d+\s*(profiles?|of them)\s+(are|were)\s+active/i);
  });

  it('contains no em dash anywhere in rendered copy', () => {
    render(<IcpTargetingBlock data={data} who="Ada" />);
    expect(document.body.textContent || '').not.toContain('—');
  });
});
