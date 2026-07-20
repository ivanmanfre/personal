// components/DtcGrowthReport.test.tsx
// Deterministic self-test for the DtcGrowthReport degradation-first render (editorial
// long-read design). Renders all three hand-authored fixtures (rich / thin / blocked-heavy)
// to static HTML via react-dom/server and asserts with STRING checks — not eyeballing — that:
//   - no placeholder/broken-value artifact ever leaks into the output
//   - a blocked signal never emits a number (empty != blocked correctness spine)
//   - the honest fallbacks render exactly where the contract says they must
//   - the Profit Gap calculator's data-calc tagging survives
// Fixtures live alongside the dev tournament harness (components/dev/scanlab/*.json); the
// useMetadata OG-title side-effect writes to document.head via useEffect, which never fires
// under renderToStaticMarkup, so it is not (and never was) asserted here.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DtcGrowthReport } from './DtcGrowthReport';
import type { ReportJson, Scan } from '../lib/scanTypes';

const FIXTURES_DIR = path.join(__dirname, 'dev', 'scanlab');

function loadFixture(file: string) {
  const raw = fs.readFileSync(path.join(FIXTURES_DIR, file), 'utf-8');
  return JSON.parse(raw) as { company_name: string; label: string; dtc: NonNullable<ReportJson['dtc']> };
}

function renderFixture(file: string) {
  const fixture = loadFixture(file);
  const report = { dtc: fixture.dtc } as unknown as ReportJson;
  const scan = {
    id: 'test-scan-id',
    company_slug: fixture.company_name.toLowerCase().replace(/\s+/g, '-'),
    domain: `${fixture.company_name.toLowerCase().replace(/\s+/g, '')}.com`,
    status: 'complete',
    created_at: '2026-07-20T00:00:00Z',
    completed_at: '2026-07-20T00:05:00Z',
    matched_offer: 'dtc_growth',
  } as unknown as Scan;
  const html = renderToStaticMarkup(<DtcGrowthReport report={report} scan={scan} companyName={fixture.company_name} />);
  return { fixture, html };
}

// Assert a provenance marker for `label` carries `status` — scoped to the single marker <div>
// so the label and its status word are proven to belong to the same signal row (the grafted
// "read from" descriptor sits between them, so a naive adjacency check would not hold).
function markerRe(label: string, status: string): RegExp {
  return new RegExp(`${label}</span>(?:(?!</div>).)*${status}`);
}

// Artifacts that must NEVER appear in rendered output, regardless of fixture richness.
const FORBIDDEN_PATTERNS: Array<[string, RegExp]> = [
  ['literal N/A', /\bN\/A\b/],
  ['literal "undefined"', /\bundefined\b/],
  ['literal "null"', /\bnull\b/],
  ['literal "NaN"', /\bNaN\b/],
  ['bare "$" with no digits', /\$(?!\d)/],
  ['empty-value colon artifact ": ,"', /:\s*,/],
  ['empty-parens artifact "() "', /\(\)\s/],
];

describe('DtcGrowthReport — degradation-first correctness', () => {
  it('rodial (RICH): no forbidden artifacts, scorecard + findings + profit-gap all render', () => {
    const { html } = renderFixture('rodial-com.json');
    for (const [label, re] of FORBIDDEN_PATTERNS) {
      expect(html, `should not contain ${label}`).not.toMatch(re);
    }
    // growth_score = 40, non-null -> the editorial scorecard renders with lever breakdown.
    expect(html).toContain('Growth score');
    expect(html).toContain('40');
    expect(html).toContain('Profit visibility');
    expect(html).toContain('headroom identified');
    // findings present -> real finding titles render, not the honest thin-read fallback.
    expect(html).toContain('The Profit Gap is running through your discount line');
    expect(html).not.toContain('A public read only surfaced the basics');
    // profit_gap present -> the climactic calculator renders (calc-only labels + source note).
    expect(html).toContain('Profit per order, after CAC');
    expect(html).toContain('Contribution per order');
    expect(html).toContain('AOV seed is your public median product price');
    // the grafted source-log descriptor renders as a number-free "read from" line.
    expect(html).toContain('read from products.json');
    // provenance ledger: key-gated absent signals (ads.meta, pagespeed) read as live-look
    // items (distinct from blocked "not readable"), and never emit a number.
    expect(html).toMatch(markerRe('Meta ads', 'on the live look'));
    expect(html).toMatch(markerRe('Page speed', 'on the live look'));
    expect(html).toContain('4 of 6 signals read');
    expect(html).toContain('Partial read');
    // calculator tagging survives, and the editorial score has no "/100" denominator.
    expect(html).toContain('data-calc');
    expect(html).not.toContain('/100');
  });

  it('apple (THIN): honest fallbacks everywhere, scorecard fully absent, no blocked signal emits a number', () => {
    const { html } = renderFixture('apple-com.json');
    for (const [label, re] of FORBIDDEN_PATTERNS) {
      expect(html, `should not contain ${label}`).not.toMatch(re);
    }
    // growth_score is null -> the entire scorecard section must be absent: no "/100", no caveat line.
    expect(html).not.toContain('/100');
    expect(html).not.toMatch(/scored across \d+ of your levers/);
    // findings.length === 0 -> the single honest thin-read fallback, never an empty list/section.
    expect(html).toContain('A public read only surfaced the basics');
    expect(html).toContain('we are not going to invent a');
    // profit_gap is null -> the calculator collapses entirely.
    expect(html).not.toContain('Profit per order, after CAC');
    // shopify + reviews are BLOCKED -> their rows read "not readable", never a catalog/rating number.
    expect(html).toMatch(markerRe('Shopify catalog', 'not readable'));
    expect(html).toMatch(markerRe('Reviews', 'not readable'));
    // signup is a genuine EMPTY (reachable, no capture markers found) -> "none found", no fabricated zero.
    expect(html).toMatch(markerRe('Email capture', 'none found'));
    expect(html).toContain('1 of 6 signals read');
    expect(html).toContain('Thin read');
  });

  it('gopure (BLOCKED-HEAVY): shopify emits no catalog numbers, reviews-empty renders as a real negative finding', () => {
    const { html } = renderFixture('gopure-com.json');
    for (const [label, re] of FORBIDDEN_PATTERNS) {
      expect(html, `should not contain ${label}`).not.toMatch(re);
    }
    // shopify is blocked here -> the row reads "not readable" and none of the catalog fields leak.
    expect(html).toMatch(markerRe('Shopify catalog', 'not readable'));
    expect(html).not.toMatch(/catalog_size|variant_depth|discount_depth/);
    // reviews is a genuine EMPTY (PDP reachable, no JSON-LD rating) -> renders as the negative
    // FINDING already in the payload, AND the ledger row reads "none found" (never a fabricated zero).
    expect(html).toContain('No visible reviews on the page paid traffic hits');
    expect(html).toMatch(markerRe('Reviews', 'none found'));
    expect(html).not.toMatch(/0 reviews/i);
    // growth_score = 40 present with only 1 scored lever (cro) -> the scorecard still renders.
    expect(html).toContain('Growth score');
    expect(html).toContain('Conversion');
    expect(html).toContain('2 of 6 signals read');
    expect(html).toContain('Thin read');
  });
});
