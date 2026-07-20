// components/DtcGrowthReport.test.tsx
// Deterministic self-test for the DtcGrowthReport degradation-first render. Renders all
// three hand-authored fixtures (rich / thin / blocked-heavy) to static HTML via
// react-dom/server and asserts with STRING checks — not eyeballing — that:
//   - no placeholder/broken-value artifact ever leaks into the output
//   - a blocked signal never emits a number (empty != blocked correctness spine)
//   - the honest fallbacks render exactly where the contract says they must
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DtcGrowthReport } from './DtcGrowthReport';
import type { ReportJson, Scan } from '../lib/scanTypes';

const FIXTURES_DIR =
  '/Users/ivanmanfredi/Desktop/Ivan - Content System/goal-runs/risedtc-growth-scan-output/fixtures';

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
    const { html } = renderFixture('rodial-com.fixture.json');
    for (const [label, re] of FORBIDDEN_PATTERNS) {
      expect(html, `should not contain ${label}`).not.toMatch(re);
    }
    // growth_score = 40, non-null -> caveat with breakdown length (3 levers: cro, paid_media, profit_visibility)
    expect(html).toContain('scored across 3 of your levers we could read');
    expect(html).toContain('40');
    // findings present -> real finding titles render, not the honest fallback line
    expect(html).toContain('The Profit Gap is running through your discount line');
    expect(html).not.toContain('A public read only surfaced the basics');
    // profit_gap present -> calculator renders with its source note
    expect(html).toContain('Your Profit Gap, self-computed');
    expect(html).toContain('AOV seed = your public median product price');
    // provenance strip: absent signals (ads.meta, pagespeed) show "not readable", never a number
    expect(html).toContain('not readable');
    expect(html).toContain('4 of 6 signals read');
    expect(html).toContain('Partial read');
  });

  it('apple (THIN): honest fallbacks everywhere, scorecard fully absent, no blocked signal emits a number', () => {
    const { html } = renderFixture('apple-com.fixture.json');
    for (const [label, re] of FORBIDDEN_PATTERNS) {
      expect(html, `should not contain ${label}`).not.toMatch(re);
    }
    // growth_score is null -> the entire scorecard section must be absent: no "/100", no caveat line
    expect(html).not.toContain('/100');
    expect(html).not.toMatch(/scored across \d+ of your levers/);
    // findings.length === 0 -> the single honest fallback line, never an empty list/section
    expect(html).toContain('A public read only surfaced the basics — the full teardown comes off a live look together.');
    // profit_gap is null -> calculator collapses entirely
    expect(html).not.toContain('Your Profit Gap, self-computed');
    // shopify + reviews are BLOCKED -> chips show "not readable", never a catalog/rating number
    expect(html).toContain('Shopify catalog · not readable');
    expect(html).toContain('Reviews · not readable');
    // signup is a genuine EMPTY (reachable, no capture markers found) -> "none found", no fabricated zero copy
    expect(html).toContain('Email capture · none found');
    expect(html).toContain('1 of 6 signals read');
    expect(html).toContain('Thin read');
  });

  it('gopure (BLOCKED-HEAVY): shopify emits no catalog numbers, reviews-empty renders as a real negative finding', () => {
    const { html } = renderFixture('gopure-com.fixture.json');
    for (const [label, re] of FORBIDDEN_PATTERNS) {
      expect(html, `should not contain ${label}`).not.toMatch(re);
    }
    // shopify is blocked here -> none of the rodial-fixture-style catalog numbers can appear
    // (this fixture carries no shopify.data at all, so grep the rendered HTML for the tell-tale
    // catalog fields that would only exist if the blocked signal were mistakenly rendered).
    expect(html).toContain('Shopify catalog · not readable');
    expect(html).not.toMatch(/catalog_size|variant_depth|discount_depth/);
    // reviews is a genuine EMPTY (PDP reachable, no JSON-LD rating) -> renders as the negative
    // FINDING already in the payload, never a fabricated "0 reviews" line from the renderer itself.
    expect(html).toContain('No visible reviews on the page paid traffic hits');
    expect(html).not.toMatch(/0 reviews/i);
    // growth_score = 40 present with only 1 scored lever (cro) -> caveat still renders
    expect(html).toContain('scored across 1 of your levers we could read');
    expect(html).toContain('2 of 6 signals read');
    expect(html).toContain('Thin read');
  });
});
