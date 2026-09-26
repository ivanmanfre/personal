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
//
// Receipt elevation (2026-07-31) adds four instrument-grade suites on top:
//   - GEOMETRY EQUALS DATA: the waterfall's segment widths are RECOMPUTED here from the
//     fixture's seed and the seeded slider defaults, then matched against the rendered
//     widths and ledger dollars. A drawing that drifts from its arithmetic fails.
//   - RECEIPT GATING: a line only ships when its fact is bound to rendered prose or to the
//     calculator seed, and under three bound lines the whole band collapses.
//   - MARGIN TAGS: every figure beside a finding is a verbatim substring of that finding.
//   - GOLD DISCIPLINE / STACK SILENCE: no eyebrow rule is gold, no tech_stack app name ships.
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
  const html = renderDtc(fixture.dtc, fixture.company_name);
  assertNoRetiredChrome(html, fixture.dtc);
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
  // Retired 07-31: the bare pull-stat band. A fact with no argument attached does not render.
  ['retired stat band "The store, in numbers"', /The store, in numbers/],
];

// Retired 2026-09-26 (Ivan): the profit-per-order angle. The page's own chrome never says it,
// on any row. Older rows can still carry it inside their stored finding prose, which the
// renderer shows verbatim, so these run against the page with the row's own prose removed.
const RETIRED_CHROME: Array<[string, RegExp]> = [
  ['retired "Profit Gap"', /Profit Gap/i],
  ['retired "profit per order"', /profit per order/i],
  ['retired "contribution profit"', /contribution profit/i],
  ['retired "Profit visibility" chip', /Profit visibility/i],
  ['retired "Profit Over Sales" pillar', /Profit Over Sales/i],
  ['retired calculator tag', /data-calc/],
];

function escHtml(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

// The page minus every string the ROW supplied (finding prose, hero hook). What is left is
// copy the renderer itself owns.
function chromeOnly(html: string, dtc: any): string {
  const rowStrings: string[] = [dtc.hero_hook];
  for (const f of dtc.findings || []) rowStrings.push(f.title, f.evidence, f.week_one);
  let out = html;
  for (const t of rowStrings) {
    if (typeof t !== 'string' || !t.trim()) continue;
    const cleaned = t.replace(/\s*[—–]\s*/g, ', ').replace(/\s+/g, ' ').trim();
    for (const v of [t, cleaned]) out = out.split(escHtml(v)).join('');
  }
  return out;
}

function assertNoRetiredChrome(html: string, dtc: any) {
  const chrome = chromeOnly(html, dtc);
  for (const [label, re] of RETIRED_CHROME) {
    expect(chrome, `page chrome should not contain ${label}`).not.toMatch(re);
  }
}

// The close-band bio is shipped conversion copy that happens to name Klaviyo as one of the
// publishers Mattan has written for. It is not a store fact read off the prospect, so the
// tech_stack silence check runs against the page WITHOUT it.
function stripConversionBio(html: string): string {
  return html.replace(/RISE DTC is run by Mattan Danino[\s\S]*?onboarding\./, '');
}

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
  expect(html).toContain('Want this read on');
  expect(html).toContain('your live store?');
  expect(html).toContain('How RISE charges');
  // Performance leads the fee card (Ivan 2026-08-11): accent-highlighted, gate intact.
  expect(html).toContain('Performance Model');
  expect(html).toContain('for qualifying brands');
  expect(html).toContain('Fixed monthly fee plus a share of growth above your baseline');
  expect(html).toContain('Base from $2,000 per month');
  expect(html.indexOf('Performance Model')).toBeLessThan(html.indexOf('Growth Model'));
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
  it('rodial (RICH): findings render, source labels derive from URLs, the retired calculator never does', () => {
    const { fixture, html } = renderFixture('rodial-com.json');
    assertNoForbidden(html);
    assertConversionLayer(html);
    // findings present -> real finding titles render, never the thin-read fallback.
    expect(html).toContain('Where the growth is');
    expect(html).not.toContain('The public read gave us the basics');
    // source links derive from the finding URL: products.json -> storefront, /products/ -> PDP.
    expect(html).toContain('see this on your storefront');
    expect(html).toContain('see this on your product page');
    expect(html).not.toContain('read from your store<');
    // profit_gap is still on this older row, and the retired calculator still never renders.
    expect(fixture.dtc.profit_gap).toBeTruthy();
    expect(html).not.toContain('AOV seed is your public median product price');
    expect(html).not.toContain('See it on your real numbers');
    expect(html).not.toContain('data-cta="profitgap"');
    // credibility line: only sources actually read, fixed order, number-free.
    expect(html).toContain('Read from your storefront, your product pages, your public catalog and your homepage source.');
  });

  it('rodial with ads-empty and no ads finding: nothing binds a Paid media receipt line any more', () => {
    // The $0 CAC seed used to bind this line on its own. With the calculator retired, only a
    // rendered ads finding can.
    const fixture = loadFixture('rodial-com.json');
    const dtc = JSON.parse(JSON.stringify(fixture.dtc)) as NonNullable<ReportJson['dtc']>;
    (dtc as any).ads = { meta: { status: 'empty', data: null } };
    const html = renderDtc(dtc, fixture.company_name);
    assertNoForbidden(html);
    assertNoRetiredChrome(html, dtc);
    expect(html).not.toContain('no active ads');
    expect(html).not.toContain('of paid CAC');
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
  });

  it('receipt: rodial renders the bound vitals lines, thin and blocked-heavy fixtures collapse the whole band', () => {
    const rich = renderFixture('rodial-com.json');
    expect(rich.html).toContain('Everything we read, and where');
    expect(rich.html).toContain('Store vitals');
    // One data-rcl marker per rendered line; the collapse floor is three.
    const lineCount = (rich.html.match(/data-rcl="1"/g) || []).length;
    expect(lineCount).toBeGreaterThanOrEqual(3);
    // The fixture's lead finding cites "59 of your 180 ... averaging 42.7% off", which is
    // what binds both the discount count line and the depth line.
    expect(rich.html).toContain('On discount');
    expect(rich.html).toContain('59 of 180');
    expect(rich.html).toContain('Average discount depth');
    expect(rich.html).toContain('42.7%');
    // Its reviews finding cites 4.7 across 23, which binds the rating line.
    expect(rich.html).toContain('Product page rating');
    expect(rich.html).toContain('4.7 from 23');
    // Nothing unbound leaks: no signup finding exists, so the capture markers never ship.
    expect(rich.html).not.toContain('Email capture');
    expect(rich.html).not.toContain('newsletter');
    // has_subscription is false but no finding mentions subscriptions, so the line is unbound.
    expect(rich.html).not.toContain('Subscription option');
    expect(rich.html).toContain('backs a finding below');
    // The single gold flag marks the number the LEAD finding argues with (the discount
    // count), never a context line like "Products live".
    const flagIdx = rich.html.indexOf('data-rcl-flag="1"');
    expect(flagIdx).toBeGreaterThan(-1);
    const flagChunk = rich.html.slice(flagIdx, flagIdx + 600);
    expect(flagChunk).toContain('On discount');
    expect((rich.html.match(/data-rcl-flag="1"/g) || []).length).toBe(1);

    // apple: everything that matters is blocked, so there is no receipt at all.
    const thin = renderFixture('apple-com.json');
    expect(thin.html).not.toContain('Store vitals');
    expect(thin.html).not.toContain('Everything we read, and where');
    // gopure: exactly one bindable line (reviews-empty), under the floor of three.
    const blocked = renderFixture('gopure-com.json');
    expect(blocked.html).not.toContain('Store vitals');
    expect((blocked.html.match(/data-rcl="1"/g) || []).length).toBe(0);
  });

  it('no stack chips: tech_stack app names never render, in any fixture', () => {
    for (const file of ['rodial-com.json', 'apple-com.json', 'gopure-com.json']) {
      const { fixture, html } = renderFixture(file);
      // The close-band bio names Klaviyo as one of Mattan's publishers. That is shipped
      // conversion copy, not a store fact, so it is excluded before the stack check.
      const body = stripConversionBio(html);
      const stack = (fixture.dtc as any).tech_stack?.data;
      const names: string[] = [...(stack?.confirmed || []), ...(stack?.missing_critical || [])];
      for (const name of names) {
        expect(body.toLowerCase(), `${file} must not render stack app ${name}`).not.toContain(name.toLowerCase());
      }
      expect(html).not.toContain('Not found on your pages');
    }
  });

  it('margin data tags: figures are verbatim substrings of their own finding, and a numeral-free finding renders an empty rail', () => {
    const { fixture, html } = renderFixture('rodial-com.json');
    const asides = [...html.matchAll(/<aside class="cedt-margin lg:col-span-3">(.*?)<\/aside>/gs)].map((m) => m[1]);
    expect(asides.length).toBe(fixture.dtc.findings.length);
    const figures = asides.map((a) => [...a.matchAll(/class="fig[^"]*"[^>]*>([^<]+)</g)].map((f) => f[1]));
    expect(figures.some((f) => f.length > 0)).toBe(true);
    // Every figure traces back verbatim to the prose of its own finding.
    figures.forEach((figs, i) => {
      const f = fixture.dtc.findings[i];
      const prose = `${f.title} ${f.evidence}`;
      for (const token of figs) expect(prose, `finding ${i} figure ${token}`).toContain(token);
      expect(figs.length).toBeLessThanOrEqual(2);
    });
    expect(html).toContain('shopify products.json');

    // A finding whose prose carries no whitelisted numeral renders NOTHING in the margin:
    // a source label floating on an empty rail reads as a half-populated component
    // (template-tell pass, 07-31). The under-finding source link carries the provenance.
    const dtc = JSON.parse(JSON.stringify(fixture.dtc)) as NonNullable<ReportJson['dtc']>;
    dtc.findings = [
      {
        signal: 'shopify',
        kind: 'gap',
        lever: 'cro',
        title: 'Your bundle path is doing the work of a landing page',
        evidence: 'The path a paid click lands on carries no bundle offer, so the order value rides on a single unit.',
        source_url: 'https://rodial.com/products.json',
      },
    ];
    const mutated = renderDtc(dtc, fixture.company_name);
    const aside = mutated.match(/<aside class="cedt-margin lg:col-span-3">(.*?)<\/aside>/s);
    const asideInner = aside ? aside[1] : '';
    expect(asideInner).not.toContain('class="fig');
    expect(asideInner).not.toContain('shopify products.json');
    expect(asideInner.trim()).toBe('');
  });

  it('gold discipline: no eyebrow rule is gold, the close-band label is not accent, chip borders go ink', () => {
    for (const file of ['rodial-com.json', 'apple-com.json', 'gopure-com.json']) {
      const { fixture, html } = renderFixture(file);
      const accent = (fixture.dtc as any).brand.accent_hex as string;
      const rules = [...html.matchAll(/<span class="h-px w-10" data-eyebrow-rule="1" style="([^"]*)"/g)].map((m) => m[1]);
      expect(rules.length).toBeGreaterThan(0);
      for (const style of rules) expect(style.toLowerCase()).not.toContain(accent.toLowerCase());
      // "Ready when you are" no longer carries the accent color.
      const readyLabel = html.match(/<div class="text-\[0\.72rem\][^"]*" style="([^"]*)">Ready when you are<\/div>/)![1];
      expect(readyLabel.toLowerCase()).not.toContain(accent.toLowerCase());
      const feeLabel = html.match(/<div class="text-\[0\.72rem\][^"]*" style="([^"]*)">How RISE charges<\/div>/)![1];
      expect(feeLabel.toLowerCase()).not.toContain(accent.toLowerCase());
    }
    // The lever chip keeps its gold DOT but its border goes ink.
    const { html } = renderFixture('rodial-com.json');
    expect(html).toContain('border:1px solid #11111133');
    expect(html).toContain('<span class="w-1.5 h-1.5 rounded-full" style="background:#ffc71d">');
  });

  it('sticky pill: dense panels are marked per rendered panel and the pill carries its hook class', () => {
    const rich = renderFixture('rodial-com.json');
    // receipt card only (the Profit Gap band is retired).
    expect((rich.html.match(/data-densepanel="1"/g) || []).length).toBe(1);
    const thin = renderFixture('apple-com.json');
    expect((thin.html.match(/data-densepanel="1"/g) || []).length).toBe(0);
    const blocked = renderFixture('gopure-com.json');
    expect((blocked.html.match(/data-densepanel="1"/g) || []).length).toBe(0);
    // SSR renders the pill visible, with the effect's className hook in place.
    expect(rich.html).toContain('cedt-sticky');
    expect(rich.html).toMatch(/data-cta="sticky"[^>]*cedt-sticky/);
    expect(rich.html).not.toMatch(/cedt-sticky[^>]*opacity:0[;"]/);
  });

  it('evidence plate: born-absent everywhere, renders once from a QA-passed capture, under the named finding', () => {
    // No fixture carries evidence_capture -> the plate never renders, no placeholder either.
    for (const f of ['rodial-com.json', 'apple-com.json', 'gopure-com.json']) {
      expect(renderFixture(f).html).not.toContain('data-evidence-plate');
    }
    // A QA-passed capture on the row lights exactly one plate, dated, on the attach signal.
    const fixture = loadFixture('rodial-com.json');
    const dtc = JSON.parse(JSON.stringify(fixture.dtc)) as NonNullable<ReportJson['dtc']>;
    (dtc as any).evidence_capture = {
      url: 'https://bjbvqvzbzczjbatgmccb.supabase.co/storage/v1/object/public/scan-screenshots/test.png',
      captured_at: '2026-07-31T12:00:00Z',
      attach_signal: 'reviews',
    };
    const html = renderDtc(dtc, fixture.company_name);
    expect((html.match(/data-evidence-plate="1"/g) || []).length).toBe(1);
    expect(html).toContain('scan-screenshots/test.png');
    expect(html).toMatch(/Your storefront, captured July 3[01], 2026/);
    // Attached under the reviews finding (rodial's 4th finding), not the lead.
    const plateIdx = html.indexOf('data-evidence-plate');
    const reviewsIdx = html.indexOf('4.7 rating');
    expect(plateIdx).toBeGreaterThan(reviewsIdx);
    // An unknown attach signal falls back to the lead finding rather than dropping the plate.
    (dtc as any).evidence_capture.attach_signal = 'pagespeed';
    const html2 = renderDtc(dtc, fixture.company_name);
    expect((html2.match(/data-evidence-plate="1"/g) || []).length).toBe(1);
  });

  it('booking URL that already carries a query string gets &-joined UTMs', () => {
    const fixture = loadFixture('rodial-com.json');
    const dtc = JSON.parse(JSON.stringify(fixture.dtc)) as NonNullable<ReportJson['dtc']>;
    (dtc as any).brand.booking_url = 'https://example.com/book?ref=abc';
    const html = renderDtc(dtc, fixture.company_name);
    expect(html).toContain('https://example.com/book?ref=abc&amp;utm_source=scan');
    expect(html).not.toContain('book?ref=abc?utm_source');
  });
  // ── 2026-08-15 accuracy pass (audit of scan/safecourt-kitchen-f8 vs its live sources) ──
  it('proof links land on a page a founder can read, not the raw JSON payload', () => {
    // The shipped Safecourt report pointed four findings at a 430KB products.json dump. The
    // evidence-table provenance stays "products.json"; only the human link moves.
    const { html } = renderFixture('rodial-com.json');
    expect(html).toContain('href="https://rodial.com/collections/all"');
    expect(html).not.toMatch(/href="https:\/\/rodial\.com\/products\.json"/);
    // label is unchanged, so the reader still knows where they are going
    expect(html).toContain('see this on your storefront');
    // provenance is untouched in the evidence rail
    expect(html).toContain('shopify products.json');
  });

  it('a WooCommerce store links to its storefront and the receipt names the Store API', () => {
    // StrollAir (2026-09-18) was the first Woo brand scanned. The collector reads Woo through
    // `/wp-json/wc/store/v1/products`, which no proofHref branch matched, so three findings
    // pointed the founder at a raw JSON dump, and the receipt tagged every catalogue number
    // "shopify products.json" under a store that serves no such payload.
    const fixture = loadFixture('rodial-com.json');
    const dtc = JSON.parse(JSON.stringify(fixture.dtc)) as NonNullable<ReportJson['dtc']>;
    const wooUrl = 'https://rodial.com/wp-json/wc/store/v1/products?per_page=100&page=1';
    (dtc as any).shopify.source_url = wooUrl;
    (dtc as any).shopify.data.platform = 'woocommerce';
    for (const f of (dtc as any).findings) {
      if (f.signal === 'shopify') f.source_url = wooUrl;
    }
    const html = renderDtc(dtc, fixture.company_name);
    expect(html).toContain('href="https://rodial.com"');
    expect(html).not.toContain('wp-json');
    expect(html).toContain('see this on your storefront');
    expect(html).toContain('woocommerce store api');
    expect(html).not.toContain('shopify products.json');
  });

  it('a per-product .js probe URL links to the product page and labels it as one', () => {
    const fixture = loadFixture('rodial-com.json');
    const dtc = JSON.parse(JSON.stringify(fixture.dtc)) as NonNullable<ReportJson['dtc']>;
    (dtc as any).findings[0].source_url = 'https://rodial.com/products/spf-50-drops-mini.js';
    const html = renderDtc(dtc, fixture.company_name);
    expect(html).toContain('href="https://rodial.com/products/spf-50-drops-mini"');
    expect(html).not.toContain('spf-50-drops-mini.js"');
    expect(html).toContain('see this on your product page');
  });

  it('the ad-archive count describes archives RENDERED, not archives attempted', () => {
    // gReadLong comes off google.fetched_at, stamped on every attempt including the ones that
    // render nothing. Safecourt shipped "Two public ad archives" above a Meta-only section.
    const fixture = loadFixture('rodial-com.json');
    const dtc = JSON.parse(JSON.stringify(fixture.dtc)) as NonNullable<ReportJson['dtc']>;
    // google ATTEMPTED (fetched_at stamped) but nothing renderable came back, while the meta
    // sweep did render — the exact Safecourt shape.
    (dtc as any).ads = {
      ...((dtc as any).ads || {}),
      google: { status: 'blocked', fetched_at: '2026-08-15T09:00:00Z' },
      // meta page READ fine (806 active ads) — this is what made metaReadDate truthy on the
      // shipped page, so the old `gReadLong && metaReadDate` test said "two".
      meta: { status: 'present', fetched_at: '2026-08-15T09:00:00Z',
              data: { active_ad_count: 806, oldest_active_run_days: 80, distinct_angles: 22 } },
    };
    // competitor creatives are what makes the section render at all (hasAdEvidence)
    (dtc as any).competitors = {
      status: 'present', checked_at: '2026-08-15T09:00:00Z',
      data: { creatives: [{ advertiser: 'Solara Home', start_date: '2026-07-17', keyword: 'air fry' }] },
    };
    const html = renderDtc(dtc, fixture.company_name);
    expect(html).not.toContain('Two public ad archives');
    expect(html).toContain('A public ad archive');
  });
  it('the vitals row never sources the subscription verdict to products.json', () => {
    // products.json cannot express selling_plan_groups, so it must not appear as the source of
    // "none found" in the evidence rail even though it sources every other catalogue line.
    const fixture = loadFixture('rodial-com.json');
    const dtc = JSON.parse(JSON.stringify(fixture.dtc)) as NonNullable<ReportJson['dtc']>;
    (dtc as any).shopify.data.has_subscription = false;
    (dtc as any).shopify.data.subscription_source_url = 'https://rodial.com/products/x.js';
    (dtc as any).findings[0].evidence += ' No subscription option we could find on the page.';
    const html = renderDtc(dtc, fixture.company_name);
    expect(html).toContain('Subscription option');
    const row = html.slice(html.indexOf('Subscription option'), html.indexOf('Subscription option') + 400);
    expect(row).not.toContain('products.json');
    expect(row).toContain('product .js');
  });

  // Noisy Clan (2026-08-17) shipped "504 days since the most recent competitor start date"
  // computed over ONE dated creative, while the same public archive held competitor starts
  // newer than the brand's own newest. A most-recent-X over a population of 1 is not a
  // population claim — below three dated creatives the corpus recency stats render as silence.
  it('corpus recency claims are silent when fewer than three competitor creatives carry dates', () => {
    const fixture = loadFixture('rodial-com.json');
    const dtc = JSON.parse(JSON.stringify(fixture.dtc)) as NonNullable<ReportJson['dtc']>;
    (dtc as any).competitors = {
      status: 'present', checked_at: '2026-08-17T09:00:00Z',
      data: {
        advertisers_seen: 81, sampled_items: 109, keywords: ['music stand'],
        creatives: [{ advertiser: 'Theaheng Music', start_date: '2025-03-31', age_days: 504, keyword: 'music stand' }],
      },
    };
    const html = renderDtc(dtc, fixture.company_name);
    // the honest parts stay: the sweep counts and the tile with its own per-creative age
    expect(html).toContain('separate advertisers seen on those keywords');
    expect(html).toContain('Theaheng Music');
    // the population claims go silent
    expect(html).not.toContain('since the most recent competitor start date');
    expect(html).not.toContain('competitor creatives shown carry a start date');
    expect(html).not.toContain('Start dates, drawn back from the read');
  });

  it('corpus recency claims render once three dated competitor creatives back them', () => {
    const fixture = loadFixture('rodial-com.json');
    const dtc = JSON.parse(JSON.stringify(fixture.dtc)) as NonNullable<ReportJson['dtc']>;
    (dtc as any).competitors = {
      status: 'present', checked_at: '2026-08-17T09:00:00Z',
      data: {
        advertisers_seen: 44, sampled_items: 120, keywords: ['blender'],
        creatives: [
          { advertiser: 'Rival One', start_date: '2026-08-01', age_days: 16, keyword: 'blender' },
          { advertiser: 'Rival Two', start_date: '2026-07-20', age_days: 28, keyword: 'blender' },
          { advertiser: 'Rival Three', start_date: '2026-06-30', age_days: 48, keyword: 'blender' },
        ],
      },
    };
    const html = renderDtc(dtc, fixture.company_name);
    expect(html).toContain('since the most recent competitor start date');
    expect(html).toContain('Start dates, drawn back from the read');
  });
});
