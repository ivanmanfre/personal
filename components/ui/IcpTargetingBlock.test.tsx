// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

  it('never claims the leads match the ICP line', () => {
    render(<IcpTargetingBlock data={data} who="Ada" />);
    const text = document.body.textContent || '';
    expect(text).toContain('Real people already around you, Ada');
    // "A few of them" read as "a few of that ICP", which nothing on this page checks.
    expect(text).not.toContain('A few of them');
  });
});

// This component's classes are styled by the scoped `.bbrec` block inside ScanReportPage,
// which no render test loads. The block shipped once with zero matching rules, so the three
// spans in a lead row ran together into one string. Cross-check the two files directly.
describe('IcpTargetingBlock styling', () => {
  // vitest runs with cwd at the repo root.
  const source = readFileSync(resolve(process.cwd(), 'components/ui/IcpTargetingBlock.tsx'), 'utf8');
  const page = readFileSync(resolve(process.cwd(), 'components/ScanReportPage.tsx'), 'utf8');
  const used = [...new Set([...source.matchAll(/className="(icp-[a-z-]+)"/g)].map((m) => m[1]))];

  it('uses the icp- classes the block is built from', () => {
    expect(used.length).toBeGreaterThanOrEqual(10);
  });

  it('has a rule scoped under .bbrec for every class it uses', () => {
    const missing = used.filter((c) => !page.includes(`.bbrec .${c}`));
    expect(missing).toEqual([]);
  });

  it('lays the lead row out as a grid, so its three spans stay three fields', () => {
    const rule = page.match(/\.bbrec \.icp-lead-row\{[^}]*\}/)?.[0] || '';
    expect(rule).toContain('display:grid');
    expect(rule).toContain('grid-template-columns');
  });

  it('adds no border radius or shadow, matching the surrounding grammar', () => {
    const rules = [...page.matchAll(/\.bbrec \.icp-[a-z-]+[^{]*\{[^}]*\}/g)].map((m) => m[0]).join('\n');
    expect(rules).not.toMatch(/border-radius|box-shadow/);
  });
});
