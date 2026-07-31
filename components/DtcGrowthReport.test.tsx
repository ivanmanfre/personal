// components/DtcGrowthReport.test.tsx
// Deterministic self-test for the DtcGrowthReport editorial long-read render. Renders the
// three hand-authored fixtures (rich / thin / blocked-heavy) to static HTML via
// react-dom/server and asserts with STRING checks (not eyeballing) that:
//   - no placeholder/broken-value artifact ever leaks into the output
//   - a blocked signal never emits a number (empty != blocked correctness spine)
//   - the honest fallbacks render exactly where the contract says they must
//   - the Profit Gap calculator's data-calc tagging survives
//   - the conversion layer (analyst byline, per-slot UTM CTAs, proof strip, close band,
//     Mattan photo, fee-card gate) renders, and the retired copy never reappears
// The useMetadata OG-title side-effect writes to document.head via useEffect, which never
// fires under renderToStaticMarkup, so it is not asserted here.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DtcGrowthReport } from './DtcGrowthReport';
import type { ReportJson, Scan } from '../lib/scanTypes';

const FIXTURES_DIR = path.join(__dirname, 'dev', 'scanlab');
const MATTAN_PHOTO = 'https://resources.risedtc.com/tools/assets/mattan.jpg';

function loadFixture(file: string) {
  const raw = fs.readFileSync(path.join(FIXTURES_DIR, file), 'utf-8');
  return JSON.parse(raw) as { company_name: string; label: string; dtc: NonNullable<ReportJson['dtc']> };
}

function renderDtc(dtc: NonNullable<ReportJson['dtc']>, companyName: string) {
  const report = { dtc } as unknown as ReportJson;
  const scan = {
    id: 'test-scan-id',
    company_slug: companyName.toLowerCase().replace(/\s+/g, '-'),
    domain: `${companyName.toLowerCase().replace(/\s+/g, '')}.com`,
    status: 'complete',
    created_at: '2026-07-20T12:00:00Z',
    completed_at: '2026-07-20T12:05:00Z',
    matched_offer: 'dtc_growth',
  } as unknown as Scan;
  return renderToStaticMarkup(<DtcGrowthReport report={report} scan={scan} companyName={companyName} />);
}

function renderFixture(file: string) {
  const fixture = loadFixture(file);
  return { fixture, html: renderDtc(fixture.dtc, fixture.company_name) };
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
  ['em or en dash in rendered output', /[—–]/],
  // Retired copy that must never come back.
  ['retired "Confidential"', /confidential/i],
  ['retired "Book a call"', /Book a call/],
  ['fabricated "150+ brands"', /150\+ brands/],
  ['fabricated "$725M"', /\$725M/],
  // Mattan's 07-27 ruling: no client brand names in any Rise case-study copy. The proof
  // strip runs vertical descriptors only; a named brand or person here is a regression.
  ['client name leak in proof strip', /Dickies|Tenth Street|Gobi Heat|Carson Finkle|Josie Maran|BARUEAT/],
  ['aphorism shape "worth running"', /worth running/],
];

function assertNoForbidden(html: string) {
  for (const [label, re] of FORBIDDEN_PATTERNS) {
    expect(html, `should not contain ${label}`).not.toMatch(re);
  }
}

// Every fixture, regardless of data richness, renders the static conversion layer.
function assertConversionLayer(html: string) {
  // Masthead: wordmark links to risedtc.com, dated label, named header CTA.
  expect(html).toContain('href="https://risedtc.com"');
  expect(html).toMatch(/Growth Scan · July (19|20), 2026/); // toLocaleDateString is local-tz
  expect(html).toContain('Book 30 min with Mattan');
  expect(html).toContain('data-cta="header"');
  expect(html).toContain('utm_source=scan');
  expect(html).toContain('utm_content=header');
  // Analyst byline card with the Mattan photo (rounded rect, never a circle).
  expect(html).toContain(MATTAN_PHOTO);
  expect(html).toContain('Mattan Danino');
  expect(html).toContain('CEO, RISE DTC');
  expect(html).toContain('My team ran this scan on');
  expect(html).toContain('The terms are at the end of this page.');
  // Proof strip: three anonymized engagements (vertical descriptors, numerals verbatim
  // from rise-company-facts) plus the foot line pointing at risedtc.com for the named cases.
  expect(html).toContain('Work RISE has run');
  expect(html).toContain('A heritage workwear brand.');
  expect(html).toContain('An apparel accessories brand.');
  // renderToStaticMarkup escapes the apostrophe in "women's", so match around it.
  expect(html).toContain('activewear brand.');
  expect(html).toContain('$2.2M to $6.5M+ in 24 months');
  expect(html).toContain('Full case studies at risedtc.com.');
  // Close band: headline, fee card with the qualifying-brands gate, signature CTA.
  expect(html).toContain('Want this math on');
  expect(html).toContain('your real numbers?');
  expect(html).toContain('How RISE charges');
  expect(html).toContain('Growth Model. Base from $2,000 per month');
  expect(html).toContain('for qualifying brands only');
  expect(html).toContain('No growth above the baseline means no performance fee.');
  expect(html).toContain('Which model fits your brand gets settled on the call.');
  expect(html).toContain('Direct with Mattan and the team. No pitch deck.');
  expect(html).toContain('Walk my scan with Mattan');
  expect(html).toContain('data-cta="close"');
  expect(html).toContain('utm_content=close');
  expect(html).toContain('Matt Moore');
  expect(html).toContain('starts within 48 hours of onboarding');
  // Footer + sticky pill.
  expect(html).toContain('Unlisted link, shared with you only.');
  expect(html).toContain('30 min with Mattan');
  expect(html).toContain('data-cta="sticky"');
  expect(html).toContain('utm_content=sticky');
}

describe('DtcGrowthReport — degradation-first correctness + conversion layer', () => {
  it('rodial (RICH): findings + profit-gap render, source labels derive from URLs, calculator spine intact', () => {
    const { html } = renderFixture('rodial-com.json');
    assertNoForbidden(html);
    assertConversionLayer(html);
    // findings present -> real finding titles render, never the thin-read fallback.
    expect(html).toContain('Where the growth is');
    expect(html).not.toContain('The public read gave us the basics');
    // source links derive from the finding URL: products.json -> storefront, /products/ -> PDP.
    expect(html).toContain('see this on your storefront');
    expect(html).toContain('see this on your product page');
    expect(html).not.toContain('read from your store<');
    // profit_gap present -> the climactic calculator renders with its data-calc tagging.
    expect(html).toContain('Profit per order, after CAC');
    expect(html).toContain('Contribution per order');
    expect(html).toContain('data-calc');
    expect(html).toContain('AOV seed is your public median product price');
    // CAC seeds at $0 (ads.meta is absent here, not empty -> the default intro renders).
    expect(html).toContain('$0.00');
    expect(html).toContain('CAC starts at $0');
    expect(html).not.toContain('shows no active ads on your brand right now');
    // assumption lead-in + attributed calculator CTA.
    expect(html).toContain('Seeded from public data. Every input is editable.');
    expect(html).toContain('See it on your real numbers');
    expect(html).toContain('This page stays yours either way.');
    expect(html).toContain('data-cta="profitgap"');
    expect(html).toContain('utm_content=profitgap');
    // credibility line: only sources actually read, fixed order, number-free.
    expect(html).toContain('Read from your storefront, your product pages, your public catalog and your homepage source.');
  });

  it('rodial with ads-empty: calculator intro switches to the no-active-ads read', () => {
    const fixture = loadFixture('rodial-com.json');
    const dtc = JSON.parse(JSON.stringify(fixture.dtc)) as NonNullable<ReportJson['dtc']>;
    (dtc as any).ads = { meta: { status: 'empty', data: null } };
    const html = renderDtc(dtc, fixture.company_name);
    expect(html).toContain('shows no active ads on your brand right now');
    expect(html).toContain('$0 of paid CAC');
    expect(html).not.toContain('CAC starts at $0:');
  });

  it('apple (THIN): honest thin-read fallback, calculator absent, blocked signals emit nothing', () => {
    const { html } = renderFixture('apple-com.json');
    assertNoForbidden(html);
    assertConversionLayer(html);
    // findings.length === 0 -> the honest thin-read section with its own attributed CTA.
    expect(html).toContain('The public read gave us the basics');
    expect(html).toContain('Get the full teardown live');
    expect(html).toContain('data-cta="thinread"');
    expect(html).toContain('utm_content=thinread');
    expect(html).toContain('30 minutes with Mattan Danino, CEO of RISE DTC. We go through your store live.');
    // profit_gap is null -> the calculator collapses entirely.
    expect(html).not.toContain('Profit per order, after CAC');
    // shopify + reviews BLOCKED -> no fabricated stat band, no catalog numbers.
    expect(html).not.toContain('The store, in numbers');
    expect(html).not.toMatch(/catalog_size|variant_depth|discount_depth/);
  });

  it('gopure (BLOCKED-HEAVY): reviews-empty renders as a real negative finding, blocked shopify emits no numbers', () => {
    const { html } = renderFixture('gopure-com.json');
    assertNoForbidden(html);
    assertConversionLayer(html);
    // reviews is a genuine EMPTY -> renders as the negative FINDING already in the payload.
    expect(html).toContain('No visible reviews on the page paid traffic hits');
    expect(html).not.toMatch(/0 reviews/i);
    // its source URL is a PDP -> the derived label.
    expect(html).toContain('see this on your product page');
    // shopify blocked -> none of the catalog fields leak, no stat band.
    expect(html).not.toMatch(/catalog_size|variant_depth|discount_depth/);
    expect(html).not.toContain('The store, in numbers');
    // profit_gap absent -> calculator collapses.
    expect(html).not.toContain('Profit per order, after CAC');
  });

  it('booking URL that already carries a query string gets &-joined UTMs', () => {
    const fixture = loadFixture('rodial-com.json');
    const dtc = JSON.parse(JSON.stringify(fixture.dtc)) as NonNullable<ReportJson['dtc']>;
    (dtc as any).brand.booking_url = 'https://example.com/book?ref=abc';
    const html = renderDtc(dtc, fixture.company_name);
    expect(html).toContain('https://example.com/book?ref=abc&amp;utm_source=scan');
    expect(html).not.toContain('book?ref=abc?utm_source');
  });
});
