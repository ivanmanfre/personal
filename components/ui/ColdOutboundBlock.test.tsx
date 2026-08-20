// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ColdOutboundBlock from './ColdOutboundBlock';

const data = {
  note: 'We build a fresh list of Italian store owners who have never heard of you.',
  sources: [
    { label: 'Followers of rival email agencies', detail: 'They already believe email drives revenue' },
    { label: 'Italian brands running paid social', detail: 'Live spend means live budget' },
    { label: 'Stores hiring a retention lead', detail: 'Email is a funded priority now' },
  ],
  filters: ['Other email agencies like you', 'Anyone already in your pipeline'],
};

describe('ColdOutboundBlock', () => {
  it('renders the note, every source and every filter', () => {
    render(<ColdOutboundBlock data={data} who="Daniele" />);
    const text = document.body.textContent || '';
    expect(text).toContain('never heard of you');
    for (const s of data.sources) expect(text).toContain(s.label);
    for (const f of data.filters) expect(text).toContain(f);
  });

  it('addresses the founder by name', () => {
    // `{who}` is its own text node inside the span, so getByText cannot match across it.
    const { container } = render(<ColdOutboundBlock data={data} who="Daniele" />);
    expect(container.querySelector('.cold-k')?.textContent).toBe('How we build your cold list, Daniele');
  });

  // This lane counted nothing for this prospect. A volume claim would be the one number on
  // the chapter a reader could ask us to produce, and we could not.
  it('never claims a pool size', () => {
    render(<ColdOutboundBlock data={data} who="Daniele" />);
    const text = document.body.textContent || '';
    expect(text).not.toMatch(/\d[\d,]*\s+(people|profiles|leads|companies|brands|prospects)/i);
    expect(text).not.toMatch(/hundreds|thousands|millions/i);
  });

  it('renders the sources without filters rather than an empty frame', () => {
    const { container } = render(<ColdOutboundBlock data={{ ...data, filters: [] }} who="Daniele" />);
    expect(container.querySelector('.cold-cut')).toBeNull();
    expect(container.querySelectorAll('.cold-srcs li').length).toBe(3);
  });

  it('renders a source with no detail without printing undefined', () => {
    const bare = { ...data, sources: [{ label: 'Rival engagers', detail: '' }, { label: 'Live ad spend', detail: '' }] };
    render(<ColdOutboundBlock data={bare} who="Daniele" />);
    expect(document.body.textContent || '').not.toContain('undefined');
  });

  it('contains no em dash anywhere in rendered copy', () => {
    render(<ColdOutboundBlock data={data} who="Daniele" />);
    expect(document.body.textContent || '').not.toContain('—');
  });
});

// Same cross-check as the targeting block: these classes are styled by the scoped `.bbrec`
// block inside ScanReportPage, which no render test loads. That block shipped once with zero
// matching rules and its spans ran together into one string.
describe('ColdOutboundBlock styling', () => {
  const source = readFileSync(resolve(process.cwd(), 'components/ui/ColdOutboundBlock.tsx'), 'utf8');
  const page = readFileSync(resolve(process.cwd(), 'components/ScanReportPage.tsx'), 'utf8');
  const used = [...new Set([...source.matchAll(/className="(cold-[a-z-]+)"/g)].map((m) => m[1]))];

  it('uses the cold- classes the block is built from', () => {
    expect(used.length).toBeGreaterThanOrEqual(8);
  });

  it('has a rule scoped under .bbrec for every class it uses', () => {
    expect(used.filter((c) => !page.includes(`.bbrec .${c}`))).toEqual([]);
  });

  it('lays a source row out as a grid, so its three spans stay three fields', () => {
    const rule = page.match(/\.bbrec \.cold-srcs li\{[^}]*\}/)?.[0] || '';
    expect(rule).toContain('display:grid');
    expect(rule).toContain('grid-template-columns');
  });

  it('adds no border radius or shadow, matching the surrounding grammar', () => {
    const rules = [...page.matchAll(/\.bbrec \.cold-[a-z-]+[^{]*\{[^}]*\}/g)].map((m) => m[0]).join('\n');
    expect(rules).not.toMatch(/border-radius|box-shadow/);
  });
});
