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
  // Ivan 10-08: the proof section now names real RISE cases and links their risedtc.com pages.
  // Cases RISE's own pages can't carry stay out: a named person, the WEBITMD-credited case, the
  // case whose page contradicts its own starting spend.
  ['unsupported case on the page', /Gobi Heat|Carson Finkle|Mama Coco|WEBITMD|BARUEAT/],
  ['aphorism shape "worth running"', /worth running/],
  // Retired 07-31: the bare pull-stat band. A fact with no argument attached does not render.
  ['retired stat band "The store, in numbers"', /The store, in numbers/],
  // 2026-09-26: receipts speak human. No endpoint names or raw detector markers.
  ['machine source label', /products\.json|product \.js|wc\/store|woocommerce store api|\bprivy\b/i],
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
  const rowStrings: string[] = [dtc.hero_hook, dtc.hero?.headline];
  for (const f of dtc.findings || []) rowStrings.push(f.title, f.evidence, f.week_one);
  for (const b of [dtc.drop_off, dtc.second_order]) {
    rowStrings.push(b?.note);
    for (const it of b?.items || []) rowStrings.push(it.title, it.detail, it.fix, it.evidence?.label, it.evidence?.value, it.product?.title);
  }
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
function assertConversionLayer(html: string, masthead: RegExp = /Growth Scan · July (19|20), 2026/, legacyHero = true) {
  // Masthead: wordmark links to risedtc.com, dated label, named header CTA.
  expect(html).toContain('href="https://risedtc.com"');
  expect(html).toMatch(masthead); // toLocaleDateString is local-tz
  expect(html).toContain('Book 30 min with Mattan');
  expect(html).toContain('data-cta="header"');
  expect(html).toContain('utm_source=scan');
  expect(html).toContain('utm_content=header');
  // Analyst byline card with the Mattan photo (rounded rect, never a circle).
  expect(html).toContain(MATTAN_PHOTO);
  expect(html).toContain('Mattan Danino');
  expect(html).toContain('CEO, RISE DTC');
  if (legacyHero) {
    expect(html).toContain('My team ran this scan on');
    expect(html).toContain('The terms are at the end of this page.');
  } else {
    expect(html).toContain('on your live store in 30 minutes.');
  }
  // Proof: three real RISE cases, each linking its own risedtc.com case page.
  expect(html).toContain('Work RISE has run');
  expect((html.match(/data-case="/g) || []).length).toBe(3);
  expect(html).toMatch(/href="https:\/\/risedtc\.com\/projects\/[a-z-]+\/\?utm_source=scan&amp;utm_medium=case/);
  expect(html).toContain('Read the case study');
  expect(html).toContain('See all case studies');
  // Close band: headline, fee card with the qualifying-brands gate, signature CTA.
  expect(html).toContain('Want this read on');
  expect(html).toContain('your live store?');
  expect(html).toContain('How RISE charges');
  // Performance leads the fee card (Ivan 2026-08-11): accent-highlighted, gate intact.
  expect(html).toContain('Performance Model');
  expect(html).toContain('for qualifying brands');
  expect(html).toContain('Lower fixed monthly fee plus a share of net growth above an agreed baseline, after ad spend.');
  expect(html).toContain('Creative, tech and AI included.');
  expect(html).toContain('Base fee plus a percentage of ad spend');
  expect(html).not.toContain('typically 20%');
  expect(html).not.toContain('Base from $2,000');
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
    // reviews is a genuine EMPTY -> renders as the negative FINDING already in the payload,
    // minus the paid-traffic wording (no active Meta ads were read on this row).
    expect(html).toContain('No visible reviews on your product page');
    expect(html).not.toMatch(/paid traffic/i);
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
    expect(html).toContain('your catalog');

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
    expect(asideInner).not.toContain('your catalog');
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
      const readyLabel = html.match(/<div class="text-\[0\.75rem\][^"]*" style="([^"]*)">Ready when you are<\/div>/)![1];
      expect(readyLabel.toLowerCase()).not.toContain(accent.toLowerCase());
      const feeLabel = html.match(/<summary([^>]*)>How RISE charges<\/summary>/)![1];
      expect(feeLabel.toLowerCase()).not.toContain(accent.toLowerCase());
    }
    // The lever chip keeps its gold DOT but its border goes ink.
    const { html } = renderFixture('rodial-com.json');
    expect(html).toContain('border:1px solid #11111133');
    expect(html).toContain('<span class="w-1.5 h-1.5 rounded-full" style="background:#ffc71d">');
  });

  it('sticky booking bar: docked on an opaque ground, page reserves its height, other CTAs hide it', () => {
    for (const file of ['rodial-com.json', 'apple-com.json', 'gopure-com.json']) {
      const { html } = renderFixture(file);
      // SSR renders the bar visible, docked to the bottom edge, never a floating pill.
      expect(html).toMatch(/class="cedt-sticky fixed inset-x-0 bottom-0 z-40" data-sticky-bar="1" style="background:#ffffff/);
      expect(html).not.toMatch(/cedt-sticky[^>]*translateY\(110%\)/);
      expect(html).not.toContain('bottom-5 right-5');
      // The page reserves the bar's height so the last line clears it.
      expect(html).toMatch(/padding-bottom:calc\(64px \+ env\(safe-area-inset-bottom\)\)/);
      // The masthead CTA and the close band are the CTAs that hide it.
      expect((html.match(/data-pill-hide="1"/g) || []).length).toBeGreaterThanOrEqual(2);
      // The booking target is a 44px tap target.
      expect(html).toMatch(/min-h-\[44px\][^"]*"[^>]*>30 min with Mattan/);
    }
  });

  it('type floor: no rendered label is set below 12px', () => {
    for (const file of ['rodial-com.json', 'apple-com.json', 'gopure-com.json', 'panther-v3.json']) {
      const { html } = renderFixture(file);
      const tw = [...html.matchAll(/text-\[([0-9.]+)rem\]/g)].map((m) => Number(m[1]));
      expect(tw.filter((v) => v < 0.75), `${file} tailwind sizes`).toEqual([]);
      const css = [...html.matchAll(/font-size:\s*([0-9.]+)rem/g)].map((m) => Number(m[1]));
      expect(css.filter((v) => v < 0.75), `${file} css rem sizes`).toEqual([]);
      const px = [...html.matchAll(/font-size:\s*([0-9.]+)px/g)].map((m) => Number(m[1]));
      expect(px.filter((v) => v < 12), `${file} px sizes`).toEqual([]);
    }
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
    // the evidence rail names the source in human words
    expect(html).toContain('your catalog');
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
    expect(html).toContain('your catalog');
    expect(html).not.toContain('products.json');
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
      data: { creatives: [{ advertiser: 'Solara Home', start_date: '2026-07-17', keyword: 'air fry' },
                          { advertiser: 'Matero Cookware', start_date: '2026-08-01', keyword: 'air fry' }] },
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
    expect(row).not.toContain('your catalog');
    expect(row).toContain('your product pages');
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
        creatives: [{ advertiser: 'Theaheng Music', start_date: '2025-03-31', age_days: 504, keyword: 'music stand' },
                    { advertiser: 'Stand Co', keyword: 'music stand' }],
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

// ── Round 4 (09-26): competitor strip order, floor, recency; head-count case; axis label ──
describe('DtcGrowthReport — competitor strip round 4', () => {
  const withComp = (creatives: any[], google?: any) => {
    const fixture = loadFixture('rodial-com.json');
    const dtc = JSON.parse(JSON.stringify(fixture.dtc)) as NonNullable<ReportJson['dtc']>;
    (dtc as any).competitors = {
      status: 'present', checked_at: '2026-09-26T09:00:00Z',
      data: { advertisers_seen: 40, sampled_items: 90, keywords: ['grain free granola'], creatives },
    };
    if (google) (dtc as any).ads = { ...((dtc as any).ads || {}), google };
    return renderDtc(dtc, fixture.company_name);
  };
  // Paleonola's saved strip (09-26): the 12-day Paleovalley ad sat 5th, behind three older tiles.
  const paleonola = [
    { advertiser: 'Howdysnax', age_days: 46, start_date: '2026-08-11' },
    { advertiser: 'Carnivore Snax', age_days: 65, start_date: '2026-07-23' },
    { advertiser: 'Struesli', age_days: 107, start_date: '2026-06-11' },
    { advertiser: 'Seven Sundays', age_days: 42, start_date: '2026-08-15' },
    { advertiser: 'Paleovalley', age_days: 12, start_date: '2026-09-14' },
    { advertiser: 'Crazy Monkey Baking', age_days: 49, start_date: '2026-08-08' },
  ];
  // tile captions, in page order (tiles without an image render a text fallback, no alt)
  const tiles = (html: string) => [...html.matchAll(/<figcaption[\s\S]*?leading-tight" style="[^"]*">([^<]+)<\/span>/g)].map((m) => m[1]);

  it('days since the most recent competitor counts every kept tile, and the newest are shown', () => {
    const html = withComp(paleonola);
    expect(html).toMatch(/>12<\/span><span[^>]*>days<\/span><\/div><div[^>]*>since the most recent competitor start date/);
    expect(tiles(html)).toEqual(['Paleovalley', 'Seven Sundays', 'Howdysnax']);
  });

  it("the judge's relevance orders the tiles before recency", () => {
    const html = withComp([
      { advertiser: 'Old Direct', age_days: 90, relevance: 10 },
      { advertiser: 'New Loose', age_days: 3, relevance: 7 },
      { advertiser: 'Mid Direct', age_days: 30, relevance: 10 },
    ]);
    expect(tiles(html)).toEqual(['Mid Direct', 'Old Direct', 'New Loose']);
  });

  it('one kept advertiser is no strip at all', () => {
    const html = withComp([{ advertiser: 'Stocked Vintage', age_days: 348 }]);
    expect(html).not.toContain('Stocked Vintage');
    expect(html).not.toContain('The same keywords, other advertisers');
  });

  it('a capped Google count opening a sentence reads "At least", never ". at least"', () => {
    const html = withComp(paleonola.slice(0, 2), {
      status: 'present', fetched_at: '2026-09-26T09:00:00Z',
      data: { ads_found: 100, capped: true, checked_at: '2026-09-26', creatives: [], newest_first_shown: '2023-10-28' },
    });
    expect(html).toContain('At least 100 on Google.');
    expect(html).not.toMatch(/\. at least/);
  });

  it('the Google strip is labelled in plain words, never the vendor tool name (round 8)', () => {
    const html = withComp(paleonola.slice(0, 2), {
      status: 'present', fetched_at: '2026-09-26T09:00:00Z',
      data: { ads_found: 3, checked_at: '2026-09-26', creatives: [], newest_first_shown: '2023-10-28' },
    });
    expect(html).toContain('public ad library');
    expect(html).not.toMatch(/Ads Transparency/i);
  });

  it('the "your newest" label near the left end of the axis hangs inward, never off-screen', () => {
    const html = withComp(paleonola, {
      status: 'present', fetched_at: '2026-09-26T09:00:00Z',
      data: { ads_found: 3, checked_at: '2026-09-26', creatives: [], newest_first_shown: '2023-10-28' },
    });
    expect(html).toMatch(/class="mkl" style="left:[\d.]+%;color:[^;]+;transform:translateX\(0\)">your newest, 1064 days/);
  });
});

// ── 2026-09-26 "deliver the promise" contract ───────────────────────────────────────────
// The live RISE DM promises "where shoppers drop off + how to get more of them ordering a
// second time". Rows stamped with builder_version carry those two blocks and the page must
// lead with them; rows without it keep the legacy layout, minus the retired pieces.
describe('DtcGrowthReport — promise contract (builder_version dtc-2026-09-26)', () => {
  const idx = (html: string, needle: string) => {
    const i = html.indexOf(needle);
    expect(i, `expected to find ${needle}`).toBeGreaterThan(-1);
    return i;
  };

  it('tina (new contract): introduces the company and source date before the evidence', () => {
    const { fixture, html } = renderFixture('tina-new-contract.json');
    const d = fixture.dtc as any;
    assertNoForbidden(html);
    expect(html).toMatch(/<h1[^>]*>A growth scan for <span>Tina Cassaday Creations<\/span><\/h1>/);
    expect(html).toMatch(/September 26, 2026 at \d{2}:\d{2} UTC/);
    expect(html).toContain(d.brand.logo_url);
    expect(html).toContain('href="#drop-off"');
    expect(html).toContain('href="#second-order"');
    expect(html).not.toContain('data-cta="hero"');
    expect(html).not.toContain('data-sticky-bar');
    expect(html).toContain('Performance Model');
    expect(html).toContain('For qualifying brands.');
    expect(html).toContain('Lower fixed monthly fee plus a share of net growth above an agreed baseline, after ad spend. Creative, tech and AI included.');
    expect(html).toContain('Base fee plus a percentage of ad spend, senior strategist included.');
    expect(html).toContain('utm_content=close');
  });

  it('tina (new contract): every item renders title, detail, fix and a human evidence line, plus the notes', () => {
    const { fixture, html } = renderFixture('tina-new-contract.json');
    const d = fixture.dtc as any;
    for (const block of [d.drop_off, d.second_order]) {
      for (const it of block.items) {
        expect(html, it.id).toContain(`data-promise-item="${it.id}"`);
        for (const t of [it.title, it.detail, it.fix, it.evidence.label, it.evidence.value]) {
          expect(html, `${it.id}: ${t}`).toContain(escHtml(t));
        }
      }
      expect(html).toContain(escHtml(block.note));
    }
    // Evidence links land on a page a person can read, with human link text.
    expect(html).toContain('href="https://tinacassadaybh.com/policies/shipping-policy"');
    // The link follows "value." so it opens a sentence: capitalized, never ". see this".
    expect(html).toContain('See this on your product page');
    expect(html).not.toMatch(/\. <a[^>]*>see this/);
  });

  it('tina (new contract): order is hero, drop-off, second order, RISE side, ad records (folded), proof, close', () => {
    const { html } = renderFixture('tina-new-contract.json');
    const order = [
      'data-promise-hero="1"',
      'data-promise-section="drop-off"',
      'data-promise-section="second-order"',
      'data-ad-archive="1"',
      'Work RISE has run',
      'Walk through the findings with Mattan.',
    ].map((n) => idx(html, n));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // Inventory evidence leads; an unrelated store image cannot stand in for it.
    expect(html.slice(idx(html, 'data-promise-hero'), idx(html, 'data-promise-section="drop-off"'))).not.toContain('data-hero-proof');
    // Other advertisers sit behind a disclosure naming the keywords.
    expect(html).toMatch(/<details data-ad-archive="1"/);
    expect(html).toContain('Keywords: conditioner, oil');
  });

  it('tina (new contract): RISE findings only, no receipt, no week-one panel, no thin-read, no paid-traffic talk', () => {
    const { fixture, html } = renderFixture('tina-new-contract.json');
    const d = fixture.dtc as any;
    // An old unconfirmed zero cannot support a brand-wide absence claim.
    expect(html).not.toContain(escHtml("You're not running paid social right now"));
    const cro = d.findings.find((f: any) => f.lever === 'cro');
    expect(html).not.toContain(escHtml(cro.evidence));
    expect(html).not.toContain('Store vitals');
    expect(html).not.toContain('Who does what');
    expect(html).not.toContain('The public read gave us the basics');
    // Meta is empty on this row: no page string may talk about paid traffic or the engine.
    expect(html).not.toMatch(/paid traffic/i);
    expect(html).not.toMatch(/\bengine\b/i);
    expect(html).not.toMatch(/Email capture is already live/i);
  });

  it('new contract tolerates thin items: string price, no product, empty block with a note, stale hero ref', () => {
    const fixture = loadFixture('tina-new-contract.json');
    const dtc = JSON.parse(JSON.stringify(fixture.dtc)) as any;
    dtc.drop_off.items = [dtc.drop_off.items[2]]; // shipping: no product
    dtc.second_order = { items: [], note: 'Your repeat rate is private, so we did not guess it.' };
    dtc.hero = { headline: 'No free-shipping amount anywhere on your store.', item_ref: 'second_order.0' };
    const html = renderDtc(dtc, fixture.company_name);
    assertNoForbidden(html);
    assertNoRetiredChrome(html, dtc);
    // Stale ref falls back to the first drop-off item. It has no product, so a capture of some
    // other product page is NOT proof for it (09-26 validation): their homepage capture shows.
    expect(html).not.toContain(escHtml(dtc.screenshots.pdp_url));
    expect(html).not.toContain(escHtml(dtc.screenshots.homepage_url));
    // The empty block renders its honest note, and the hero drops its second row.
    expect(html).toContain('Your repeat-order rate needs store data to assess.');
    expect(html).not.toContain('href="#second-order"');
    expect(html).not.toContain('data-promise-section="second-order"');
    // A string price still formats.
    const dtc2 = JSON.parse(JSON.stringify(fixture.dtc)) as any;
    dtc2.drop_off.items[0].product.price = '25.00';
    dtc2.drop_off.items[0].id = 'product_choice';
    expect(renderDtc(dtc2, fixture.company_name)).toContain('$25');
  });

  it('builder_version without the promise blocks falls back to the legacy layout', () => {
    const fixture = loadFixture('tina-new-contract.json');
    const dtc = JSON.parse(JSON.stringify(fixture.dtc)) as any;
    delete dtc.drop_off;
    const html = renderDtc(dtc, fixture.company_name);
    expect(html).not.toContain('data-promise-hero');
    expect(html).toContain('Where the growth is');
  });

  it('tina (legacy live row): old layout minus the Profit Gap, the email-capture card and raw tokens', () => {
    const { fixture, html } = renderFixture('tina-legacy.json');
    const d = fixture.dtc as any;
    expect(d.builder_version).toBeUndefined();
    expect(d.profit_gap).toBeTruthy();
    assertNoForbidden(html);
    assertConversionLayer(html);
    expect(html).not.toContain('data-promise-hero');
    expect(html).toContain('A public read of your store, and where the growth is.');
    expect(html).toContain('Where the growth is');
    // Retired pieces stay gone on an old row.
    expect(html).not.toContain('Email capture is already live');
    expect(html).not.toContain('Working asset');
    expect(html).not.toMatch(/newsletter, subscribe/);
    // Possessive, and human receipt sources.
    expect(html).toContain('Tina Cassaday Creations&#x27; public data');
    expect(html).not.toContain('Creations&#x27;s');
    expect(html).toContain('your catalog');
    // Ad records still lead on the legacy layout, uncondensed.
    expect(html).not.toContain('data-comp-disclosure');
  });
});

// The builder's own output for Tina (backend fixture). Structure-level checks only: the copy
// is the builder's, so the renderer's own chrome is what these hold to the rules.
describe('DtcGrowthReport — promise contract, builder fixture', () => {
  it('renders every promised item in order, leads with her product image, keeps RISE-only findings', () => {
    const { fixture, html } = renderFixture('tina-new-contract-builder.json');
    const d = fixture.dtc as any;
    assertNoForbidden(chromeOnly(html, d));
    expect(html).toContain('data-promise-hero="1"');
    expect(html).toContain(escHtml(d.hero.headline));
    let last = html.indexOf('data-promise-hero="1"');
    for (const block of [d.drop_off, d.second_order]) {
      for (const it of block.items) {
        const at = html.indexOf(`data-promise-item="${it.id}"`);
        expect(at, it.id).toBeGreaterThan(last);
        last = at;
        expect(html).toContain(escHtml(it.title));
        expect(html).toContain(escHtml(it.fix));
      }
      expect(html).toContain(escHtml(block.note));
    }
    expect(html).toContain('data-promise-evidence="1"');
    // RISE side only: the builder's retention finding restates a second-order item.
    for (const f of d.findings) {
      const shown = html.includes(escHtml(f.title));
      expect(shown, f.title).toBe((f.lever === 'paid_media' || f.lever === 'performance_creative') && !(f.signal === 'ads.meta' && d.ads?.meta?.status === 'empty' && d.ads.meta.page_confirmed !== true));
    }
    expect(html).not.toMatch(/paid traffic/i);
  });
});

// ── 09-26 validation fixes ───────────────────────────────────────────────────────────
describe('DtcGrowthReport — 09-26 validation fixes', () => {
  it('a held row with no items in either section takes the legacy layout, never a blank hero', () => {
    const fixture = loadFixture('tina-new-contract.json');
    const dtc = JSON.parse(JSON.stringify(fixture.dtc)) as any;
    dtc.drop_off = { items: [], note: 'Nothing on your public pages stood out.' };
    dtc.second_order = { items: [], note: 'We could not see a clear second-order gap.' };
    dtc.hero = null;
    dtc.shippable = { ok: false, reason: 'Held: nothing we could show.' };
    const html = renderDtc(dtc, fixture.company_name);
    expect(html).not.toContain('data-promise-hero');
    expect(html).toContain('Where the growth is');
  });

  it('the finding shows a capture only when it is the capture of that item\'s product', () => {
    const fixture = loadFixture('tina-new-contract.json');
    const base = JSON.parse(JSON.stringify(fixture.dtc)) as any;
    const it = base.drop_off.items[0];
    it.product = { ...it.product, image_url: null, url: 'https://tinacassadaybh.com/products/banana-banana-sachet-6-pack' };
    base.hero = { headline: base.hero.headline, item_ref: 'drop_off.0' };
    // capture of another product: not shown
    const other = JSON.parse(JSON.stringify(base));
    other.screenshots.pdp_path = '/products/banana-bliss-shampoo';
    const h1 = renderDtc(other, fixture.company_name);
    expect(h1).not.toContain(escHtml(other.screenshots.pdp_url));
    // an old row (no pdp_path): not shown
    const old = JSON.parse(JSON.stringify(base));
    delete old.screenshots.pdp_path;
    expect(renderDtc(old, fixture.company_name)).not.toContain(escHtml(old.screenshots.pdp_url));
    // capture of this product (locale prefix ignored): shown
    const same = JSON.parse(JSON.stringify(base));
    same.screenshots.pdp_path = '/en-us/products/banana-banana-sachet-6-pack';
    const h3 = renderDtc(same, fixture.company_name);
    expect(h3).toContain(escHtml(same.screenshots.pdp_url));
    expect(h3).toMatch(/Captured September 26, 2026 at \d{2}:\d{2} UTC\./);
  });

  it('a second-order-only report numbers its first finding one without an empty purchase chapter', () => {
    const fixture = loadFixture('tina-new-contract.json');
    const d = structuredClone(fixture.dtc) as any;
    d.drop_off = { items: [], note: 'Nothing observed here.' };
    const html = renderDtc(d, fixture.company_name);
    expect(html).not.toContain('data-promise-section="drop-off"');
    expect(html).toContain('Finding 1 · Repeat purchase');
    expect(html).toContain(escHtml(d.second_order.items[0].title));
    expect(html).not.toContain('data-hero-proof');
  });

  it('a store-wide observation never uses unrelated photos or a homepage as proof', () => {
    const fixture = loadFixture('tina-new-contract.json');
    const d = structuredClone(fixture.dtc) as any;
    d.drop_off.items = [d.drop_off.items[2]];
    d.second_order = { items: [], note: '' };
    d.screenshots.pdp_path = '/products/unrelated';
    const html = renderDtc(d, fixture.company_name);
    expect(html).not.toContain(d.screenshots.pdp_url);
    expect(html).not.toContain(d.screenshots.homepage_url);
    expect(html).toContain(escHtml(d.drop_off.items[0].detail));
    expect(html).not.toContain('data-hero-proof');
  });

  it('compact ad records retain both platform counts and use singular day', () => {
    // Rebalance (09-26): 46 Meta ads, 1 Google creative; the headline led with "1 on Google."
    const fixture = loadFixture('tina-new-contract.json');
    const dtc = JSON.parse(JSON.stringify(fixture.dtc)) as any;
    dtc.ads.meta = { status: 'present', fetched_at: '2026-09-26T12:56:32Z', data: { active_ad_count: 46 } };
    dtc.ads.google = { status: 'present', fetched_at: '2026-09-26T10:47:49Z',
      data: { ads_found: 1, capped: false, advertiser: 'Rebalance Vintage', region: 'CA', checked_at: '2026-09-26T10:47:49Z',
              newest_first_shown: '2026-09-25', latest_last_shown: '2026-09-25', formats: { text: 0, image: 1, video: 0 }, creatives: [] } };
    delete dtc.ads.meta_sweep;
    const html = renderDtc(dtc, fixture.company_name);
    const spread = html.slice(html.indexOf('data-ad-archive'));
    const meta = spread.indexOf('46 active ads.');
    const goog = spread.indexOf('1 creatives in the returned records.');
    expect(meta).toBeGreaterThan(-1);
    expect(goog).toBeGreaterThan(meta);
    expect(spread).toContain('1 day before the check');
    expect(spread).not.toMatch(/>1<\/span>\s*<span[^>]*>days</);
    expect(spread).not.toContain('1 days');
  });

  it('a keyword sample does not imply brand-wide zero ads', () => {
    const { html } = renderFixture('tina-new-contract.json');
    const spread = html.slice(html.indexOf('data-ad-archive'));
    expect(spread).not.toContain('zero ads for your brand');
    expect(spread).toContain('identity-matched results');
    expect(spread).not.toContain('this brand');
  });
});

// ── Round 5 (2026-09-26): real saved rows ─────────────────────────────────────────────
// Fixtures are live rows read through the anon REST API (legacy) or saved by the builder
// validation run (promise), unedited.
describe('DtcGrowthReport — round 5 real rows', () => {
  const visible = (html: string) =>
    html.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');

  it('RPNZL (legacy): no retired phrase, no Profit Gap card, the surviving finding still renders', () => {
    const { fixture, html } = renderFixture('rpnzl-legacy.json');
    const d = fixture.dtc as any;
    expect(d.builder_version).toBeUndefined();
    expect(d.findings.map((f: any) => f.title)).toContain('The Profit Gap is running through your discount line');
    const text = visible(html);
    expect(text).not.toMatch(/profit gap|contribution profit|profit per order|paid engine/i);
    expect(html).not.toContain('data-calc');
    // Meta read errored on this row, so no paid wording either.
    expect(d.ads.meta.status).not.toBe('present');
    expect(text).not.toMatch(/paid traffic|paid clicks?/i);
    expect(html).not.toContain('data-promise-hero');
    expect(text).toContain('Where the growth is');
    expect(text).toContain('No subscribe-and-save path for repeat buyers');
  });

  it('RPNZL: a hook whose discount count no rendered finding carries takes the default; one finding = no Who-does-what panel', () => {
    const { fixture, html } = renderFixture('rpnzl-legacy.json');
    const d = fixture.dtc as any;
    expect(d.hero_hook).toMatch(/^9 of your 40 live products are discounted/);
    const text = visible(html);
    expect(text).not.toContain('9 of your 40');
    expect(text).toContain('A public read of your store, and where the growth is.');
    // one finding survives the scrub: no split bar, no panel restating it
    expect(html).not.toContain('data-weekone="1"');
    expect(html).not.toContain('Who does what');
    expect(html).not.toContain('cedt-splitbar"');
    // the same hook stays when a rendered finding carries its numbers
    const backed = JSON.parse(JSON.stringify(d));
    backed.findings.push({ signal: 'shopify', kind: 'gap', lever: 'cro', bucket: 'yours',
      title: 'Discounting is running across your catalog',
      evidence: '9 of your 40 live products are discounted, averaging 20.6% off.', source_url: 'https://rpnzlbeauty.com/products.json' });
    const out = visible(renderDtc(backed, fixture.company_name));
    expect(out).toContain('9 of your 40 live products are discounted right now, averaging 20.6% off.');
    expect(renderDtc(backed, fixture.company_name)).toContain('Who does what');
  });

  it('Brotherly Sole (legacy, Meta empty): no paid-traffic or engine wording, reviews title rewritten', () => {
    const { fixture, html } = renderFixture('brotherly-sole-legacy.json');
    expect((fixture.dtc as any).ads.meta.status).toBe('empty');
    const text = visible(html);
    expect(text).not.toMatch(/paid traffic|paid engine|paid clicks?|traffic you already pay for/i);
    expect(text).not.toMatch(/profit gap|contribution profit/i);
    expect(text).toContain('No visible reviews on your product page');
    expect(text).toContain("We couldn't find review markup on your product page.");
    expect(text).not.toContain("You're not running paid social right now");
    expect(text).not.toContain('The public Meta Ad Library shows zero active ads.');
    // Its hook closes on the retired margin angle, so the hero takes the default hook whole.
    expect((fixture.dtc as any).hero_hook).toMatch(/where your margin is going/);
    expect(text).not.toMatch(/margin is going/i);
    expect(text).toContain('A public read of your store, and where the growth is.');
  });

  it('em dashes in product titles become a comma break, a range between digits a hyphen', () => {
    const { fixture, html } = renderFixture('charleston-soy-works-promise.json');
    const d = JSON.parse(JSON.stringify(fixture.dtc)) as any;
    expect(JSON.stringify(d)).toContain('Magnolia Gardens Body Oil Candle— 10 oz');
    expect(html).toContain('Magnolia Gardens Body Oil Candle, 10 oz');
    expect(html).not.toMatch(/[—–]/);
    // Product cards render only with an image; give both items one so their titles show.
    const img = 'https://charlestonsoyworks.com/cdn/shop/files/candle.jpg';
    d.second_order.items[0].product = { ...d.second_order.items[0].product, image_url: img, title: 'Magnolia Gardens Body Oil Candle— 10 oz' };
    d.second_order.items[1].product = { ...d.second_order.items[0].product, title: 'Sampler Set 3–6 Pack — Lavender' };
    const out = renderDtc(d, fixture.company_name);
    expect(out).not.toMatch(/[—–]/);
    expect(out).toContain('Magnolia Gardens Body Oil Candle, 10 oz');
    expect(out).toContain('Sampler Set 3-6 Pack, Lavender');
    expect(out).not.toMatch(/,\s*,/);
  });

  it('held promise row (shippable.ok false) takes the legacy layout with no empty promised sections', () => {
    const { fixture, html } = renderFixture('realfruitpeelz-held.json');
    const d = fixture.dtc as any;
    expect(d.builder_version).toMatch(/^dtc-/);
    expect(d.shippable.ok).toBe(false);
    assertNoForbidden(html);
    expect(html).not.toContain('data-promise-hero');
    expect(html).not.toContain('data-promise-section');
    expect(html).not.toContain('Purchase path observations');
    expect(html).not.toContain('Repeat purchase observations');
    expect(html).toContain('A public read of your store, and where the growth is.');
    expect(html).toContain('The public read gave us the basics');

    // Held with items still on the row: the hold wins, never a half-promised page.
    const tina = loadFixture('tina-new-contract.json');
    const held = JSON.parse(JSON.stringify(tina.dtc)) as any;
    held.shippable = { ok: false, reason: 'Held: no second-order item.' };
    const heldHtml = renderDtc(held, tina.company_name);
    expect(heldHtml).not.toContain('data-promise-hero');
    expect(heldHtml).not.toContain('data-promise-section');
    expect(heldHtml).toContain('Where the growth is');
  });
});


describe('public evidence quality contract', () => {
  function returnConflictFixture() {
    const f = loadFixture('tina-new-contract.json');
    const d = structuredClone(f.dtc);
    const citations = [
      { url: 'https://example.com/pages/returns?policy=current#terms', quote: 'Returns are accepted within 14 days.' },
      { url: 'https://example.com/policies/refund-policy', quote: 'Returns are accepted within 30 days.' },
    ];
    d.drop_off!.items[0] = {
      id: 'public_terms_conflict',
      title: 'Your live return pages disagree',
      detail: 'The return window differs between your two public pages.',
      fix: 'Publish the same return window on both pages.',
      lever: 'cro',
      evidence: { label: 'Two live return pages', value: citations.map(c => c.quote).join(' | '), source_url: citations[0].url, citations },
    };
    d.hero = { ...d.hero, headline: 'Your live return pages disagree', item_ref: 'drop_off.0' };
    return { d, citations };
  }

  it('pairs each return-policy quote with its exact source and keeps single-source evidence intact', () => {
    const { d, citations } = returnConflictFixture();
    const html = renderDtc(d, 'Test Store');
    const rows = [...html.matchAll(/<blockquote data-promise-citation="1"[^>]*>([\s\S]*?)<\/blockquote>/g)].map(m => m[1]);
    expect(rows).toHaveLength(2);
    citations.forEach((citation, i) => {
      expect(rows[i]).toContain(escHtml(citation.quote));
      expect(rows[i]).toContain(`href="${escHtml(citation.url)}"`);
      expect(rows[i]).toMatch(/>Read source [12]<\/a>/);
      expect(rows[i]).not.toContain(`>${escHtml(citation.url)}<`);
    });
    expect(html).not.toContain(escHtml(d.drop_off!.items[0].evidence.value));
    expect(html).not.toContain('data-hero-proof="1"');
    const single = d.drop_off!.items[1].evidence;
    expect(html).toContain(escHtml(single.value));
    expect(html).toContain(`href="${escHtml(single.source_url)}"`);
    expect(html).toContain('See this on your storefront');
  });

  it.each(['unit_price_mismatch', 'broken_help_link'])('does not present a generic store image as proof of %s', (id) => {
    const { d } = returnConflictFixture();
    d.drop_off!.items[0].id = id;
    delete d.drop_off!.items[0].evidence.citations;
    d.screenshots = { homepage_url: 'https://example.com/home.png', captured_at: '2026-10-01T10:00:00Z' };
    const html = renderDtc(d, 'Test Store');
    expect(html).not.toContain('data-hero-proof="1"');
    expect(html).toContain('data-promise-evidence="1"');
  });

  it('does not turn unsafe citation or single-source URLs into active links', () => {
    const { d } = returnConflictFixture();
    d.drop_off!.items[0].evidence.citations![1].url = 'data:text/html,unsafe';
    d.drop_off!.items[1].evidence.source_url = 'javascript:alert(1)';
    const html = renderDtc(d, 'Test Store');
    expect(html).toContain('Returns are accepted within 30 days.');
    expect(html).not.toMatch(/href="(?:javascript:|data:)/i);
    expect(html).not.toContain('javascript:throw new Error');
  });

  it('keeps supporting ad records available behind a closed disclosure', () => {
    const f = loadFixture('tina-new-contract.json');
    const d = JSON.parse(JSON.stringify(f.dtc));
    d.ads.google = { status: 'present', data: { total_ads: 4, ads: [] } };
    const html = renderDtc(d, f.company_name);
    expect(html).toContain('Supporting public ad records');
    expect(html).toMatch(/<details data-ad-archive="1"[^>]*>/);
    expect(html).not.toMatch(/<details data-ad-archive="1"[^>]*\bopen/);
  });
  it('holds a reviewed page without resurrecting historical diagnoses', () => {
    const f = loadFixture('rodial-com.json');
    const d = { ...f.dtc, quality: { version: 'rise-quality-2026-09-30', approved: false } };
    const html = renderDtc(d, 'Test Store');
    expect(html).toContain('No recommendation qualified');
    expect(html).not.toContain('Testing sprawl');
    expect(html).not.toContain('Book a');
  });
});

describe('evidence-first scan repair', () => {
  function inventoryFixture() {
    const d = structuredClone(loadFixture('tina-new-contract.json').dtc) as any;
    const item = { id: 'bestseller_sold_out', title: 'A style is unavailable', detail: 'The boxed option cannot be ordered.', fix: 'Check stock before sending shoppers here.', lever: 'cro', product: { title: 'Round Cut', url: 'https://example.com/products/round', image_url: 'https://example.com/round.jpg', price: 11.99, currency: 'GBP' }, evidence: { label: 'Availability', value: 'Sold out', source_url: 'https://example.com/products/round' } };
    d.drop_off = { items: [item], note: '' };
    d.second_order = { items: [{ ...item, id: 'refill_sold_out', title: 'The refill is unavailable', detail: 'The same style cannot be reordered as a refill.' }, { ...item, id: 'no_new_products', title: 'Old catalog recommendation' }], note: '' };
    d.hero = { headline: item.title, item_ref: 'drop_off.0' };
    d.shopify = { status: 'present', source_url: 'https://example.com/products.json', fetched_at: '2026-10-08T22:00:16Z', data: { catalog_size: 2 }, catalog_items: [
      { title: 'Round Cut', handle: 'round', url: item.product.url, variants: [{ title: 'Round Cut with case', price: 25.99, currency: 'GBP', available: false }, { title: 'Round Cut Refill', price: 11.99, currency: 'GBP', available: false }] },
      { title: 'Oval Cut', handle: 'oval', url: 'https://example.com/products/oval', variants: [{ title: 'Oval Cut with case', price: 25.99, currency: 'GBP', available: true }, { title: 'Oval Cut Refill', price: null, currency: 'GBP', available: null }] },
    ] };
    d.screenshots = { pdp_path: '/products/round', pdp_url: 'https://example.com/round-proof.png', homepage_url: 'https://example.com/home-proof.png', captured_at: '2026-10-08T22:00:23Z' };
    d.completed_at = '2026-10-08T22:00:54Z';
    return d;
  }
  it('shows one sourced inventory exhibit with actual variant names, unknowns and no repeated stock photos', () => {
    const html = renderDtc(inventoryFixture(), 'Example');
    expect((html.match(/data-inventory-exhibit="1"/g) || [])).toHaveLength(1);
    expect(html).toContain('Round Cut with case');
    expect(html).toContain('Round Cut Refill');
    expect(html).toContain('£25.99');
    expect(html).toContain('£11.99');
    expect(html).toContain('Availability unknown');
    expect(html).toContain('Price unknown');
    expect(html).toContain('https://example.com/products/oval');
    expect(html).not.toContain('https://example.com/round.jpg');
    expect(html).toContain('data-promise-item="refill_sold_out"');
    expect(html).toContain('The same style cannot be reordered as a refill.');
    expect(html).not.toContain('Old catalog recommendation');
    expect(html).toContain('October 8, 2026 at 22:00 UTC');
  });
  it('matches a capture even when a product photograph exists, and never attaches an unrelated product capture', () => {
    const d = inventoryFixture();
    expect(renderDtc(d, 'Example')).toContain('https://example.com/round-proof.png');
    d.screenshots.pdp_path = '/products/unrelated';
    expect(renderDtc(d, 'Example')).not.toContain('https://example.com/round-proof.png');
  });
  it('does not leak catalog data from a blocked signal or held quality gate', () => {
    const d = inventoryFixture();
    d.shopify.status = 'blocked';
    expect(renderDtc(d, 'Example')).not.toContain('data-inventory-exhibit');
    d.shopify.status = 'present';
    d.quality = { version: 'rise-quality-2026-09-30', approved: false };
    expect(renderDtc(d, 'Example')).not.toContain('data-inventory-exhibit');
  });
  it('caps inventory samples honestly and never changes null into sold out', () => {
    const d = inventoryFixture();
    d.shopify.catalog_items = Array.from({ length: 20 }, (_, i) => ({ ...d.shopify.catalog_items[1], handle: `style-${i}`, title: `Style ${i}` }));
    const html = renderDtc(d, 'Example');
    expect(html).toContain('Showing 12 of 20 collected products');
    expect(html).not.toContain('Style 19');
  });
  it('shows source-grounded existing tools and omits unsupported observations', () => {
    const d = inventoryFixture();
    d.public_depth = { status: 'present', data: { store_features: [
      { kind: 'loyalty', title: 'Club rewards', detail: 'Points can be earned on purchases.', source_url: 'https://example.com/pages/club', quote: 'Earn five points per pound.', fetched_at: '2026-10-08T21:55:00Z' },
      { kind: 'try_on', title: 'Unsupported tool', detail: 'An unverified observation', source_url: '', quote: '' },
    ] } };
    const html = renderDtc(d, 'Example');
    expect(html).toContain('Already on your store');
    expect(html).toContain('Earn five points per pound.');
    expect(html).toContain('href="https://example.com/pages/club"');
    expect(html).not.toContain('Unsupported tool');
  });
  it('scopes zero ads to a confirmed page, dates cached searches and keeps coverage limits visible', () => {
    const d = inventoryFixture();
    d.ads = { meta: { status: 'empty', page_confirmed: true, fetched_at: '2026-10-08T22:00:48Z', source_url: 'https://facebook.com/example', data: { active_ad_count: 0 } }, meta_sweep: { status: 'empty', fetched_at: '2026-10-08T11:25:00Z', data: { from_cache: true, sampled_items: 0, identity_matched_ads: 0 } }, google: { status: 'empty', fetched_at: '2026-10-08T11:25:00Z', data: { from_cache: true, ads_found: 0 } } };
    d.competitors = { status: 'empty', fetched_at: '2026-10-08T11:25:00Z', data: { creatives: [] } };
    const html = renderDtc(d, 'Example');
    expect(html).toContain('No active ads on the identified Facebook page');
    expect(html).not.toMatch(/Zero on Meta|zero ads for your brand|first Meta campaign/i);
    expect(html).toContain('October 8, 2026 at 11:25 UTC');
    expect(html).toContain('Cached result');
    expect(html).toContain('No verified competitor creatives');
    d.ads.meta.page_confirmed = false;
    expect(renderDtc(d, 'Example')).not.toContain('No active ads on the identified Facebook page');
  });
  it('versions captured image URLs by capture time while preserving existing query parameters', () => {
    const d = inventoryFixture();
    d.screenshots.pdp_url = 'https://example.com/round-proof.png?download=1';
    const first = renderDtc(d, 'Example').match(/<img[^>]+src="([^"]*round-proof[^"]*)"/)?.[1];
    expect(first).toContain('download=1');
    expect(first).toContain('captured_at=2026-10-08T22%3A00%3A23Z');
    d.screenshots.captured_at = '2026-10-09T01:00:00Z';
    const next = renderDtc(d, 'Example').match(/<img[^>]+src="([^"]*round-proof[^"]*)"/)?.[1];
    expect(next).not.toBe(first);
  });
  it('remaps a removed hero reference to the same surviving item for headline and proof', () => {
    const d = inventoryFixture();
    d.drop_off.items[0] = { ...d.drop_off.items[0], id: 'purchase_a', title: 'Purchase A' };
    d.second_order.items = [{ ...d.second_order.items[1], title: 'Removed age finding' }, { ...d.second_order.items[0], id: 'retention_b', title: 'Retention B', product: { title: 'Another product', url: 'https://example.com/products/other', image_url: 'https://example.com/other.jpg' } }];
    d.hero = { headline: 'Removed age finding', item_ref: 'second_order.0' };
    const html = renderDtc(d, 'Example');
    const hero = html.slice(html.indexOf('data-promise-hero'), html.indexOf('data-promise-section'));
    expect(hero).toMatch(/<h1[^>]*>A growth scan for <span>Example<\/span><\/h1>/);
    expect(hero).not.toContain('round-proof.png');
    expect(html).toContain('round-proof.png');
    expect(html).toContain('Purchase A');
    expect(hero).not.toContain('other.jpg');
    expect(hero).not.toContain('Removed age finding');
  });
  it('does not merge different inventory aggregates that share a representative product', () => {
    const d = inventoryFixture();
    d.drop_off.items[0].title = '4 of 5 best sellers are sold out';
    d.second_order.items[0].title = '8 of 12 refills are sold out';
    expect(renderDtc(d, 'Example')).toContain('data-promise-item="refill_sold_out"');
  });
  it('shows one capture when multiple observed features cite the same product page', () => {
    const d = inventoryFixture();
    d.screenshots.pdp_path = '/products/other';
    d.public_depth = { status: 'present', data: { store_features: ['reviews', 'try_on'].map((kind) => ({ kind, title: kind, detail: 'Observed feature', quote: 'Observed feature', source_url: 'https://example.com/products/other', fetched_at: '2026-10-08T22:00:00Z' })) } };
    const html = renderDtc(d, 'Example');
    expect((html.match(/<img[^>]*round-proof\.png/g) || [])).toHaveLength(1);
  });
  it('keeps independent inventory causes and partial refill outages separate', () => {
    const d = inventoryFixture();
    d.second_order.items[0].product = { ...d.second_order.items[0].product, title: 'Oval Cut', url: 'https://example.com/products/oval' };
    expect(renderDtc(d, 'Example')).toContain('data-promise-item="refill_sold_out"');
    d.second_order.items[0].product = d.drop_off.items[0].product;
    d.shopify.catalog_items[0].variants[0].available = true;
    expect(renderDtc(d, 'Example')).toContain('data-promise-item="refill_sold_out"');
  });
  it('preserves verified page-scoped tracking facts while removing historical campaign assumptions', () => {
    const d = inventoryFixture();
    d.ads.meta = { status: 'empty', page_confirmed: true, fetched_at: '2026-10-08T22:00:00Z', source_url: 'https://facebook.com/example', data: { active_ad_count: 0 } };
    d.findings = [{ signal: 'ads.meta', kind: 'gap', lever: 'paid_media', title: 'Your Meta pixel is installed, and your Facebook page runs no ads', evidence: 'Your store loads the Meta pixel and your Facebook page is not currently running ads.', week_one: 'We test a first Meta campaign once purchase events are checked.', source_url: 'https://facebook.com/example' }];
    const html = renderDtc(d, 'Example');
    expect(html).toContain('Your store loads the Meta pixel and your Facebook page is not currently running ads.');
    expect(html).not.toContain('first Meta campaign');
  });
  it('keeps legacy rows without new evidence fields readable without fabricated exhibits', () => {
    const d = inventoryFixture();
    delete d.shopify.catalog_items;
    delete d.public_depth;
    const html = renderDtc(d, 'Example');
    expect(html).not.toContain('data-inventory-exhibit');
    expect(html).not.toContain('data-store-features');
    expect(html).toContain('A style is unavailable');
    expect(html).toContain('data-promise-item="refill_sold_out"');
  });
  it('does not repeat product photographs across the cover and findings', () => {
    const d = inventoryFixture();
    d.drop_off.items[0].id = 'variant_choice';
    const html = renderDtc(d, 'Example');
    expect(html).not.toContain('https://example.com/round.jpg');
    expect((html.match(/<img[^>]+round-proof\.png/g) || [])).toHaveLength(1);
    expect(html).toContain('rise-capture-image');
  });

  it('distinguishes one verified competitor creative from an empty search', () => {
    const d = inventoryFixture();
    d.competitors = { status: 'present', fetched_at: '2026-10-08T22:00:00Z', data: { creatives: [{ advertiser: 'Verified peer' }] } };
    const html = renderDtc(d, 'Example');
    expect(html).not.toContain('No verified competitor creatives');
    expect(html).toContain('Too few verified creatives for a comparison');
  });
  it.each([true, false])('keeps an empty repeat-order section neutral when verified features are present: %s', (hasFeatures) => {
    const d = inventoryFixture();
    d.drop_off.items[0].detail = 'The boxed option and refill cannot be ordered.';
    d.second_order = { items: [], note: "We couldn't see a clear second-order gap." };
    d.public_depth = { status: hasFeatures ? 'present' : 'blocked', data: { store_features: [{ kind: 'loyalty', title: 'Club rewards', quote: 'Earn five points per pound.', source_url: 'https://example.com/pages/club' }] } };
    const html = renderDtc(d, 'Example');
    expect(html).toContain('The boxed option and refill cannot be ordered.');
    expect(html).not.toContain('clear second-order gap');
    if (hasFeatures) {
      expect(html).toContain('Your repeat-order rate needs store data. The public features below show what is already available to shoppers.');
      expect(html).toContain('Already on your store');
    } else {
      expect(html).toContain('Your repeat-order rate needs store data to assess.');
      expect(html).not.toContain('public features below');
    }
  });
  it('introduces the report before evidence without a hero pitch or sticky booking bar', () => {
    const d = inventoryFixture();
    const html = renderDtc(d, 'Example');
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1].replace(/<[^>]*>/g, '');
    expect(h1).toBe('A growth scan for Example');
    expect(html.indexOf('public storefront')).toBeLessThan(html.indexOf('data-promise-item='));
    const intro = html.slice(html.indexOf('data-promise-hero'), html.indexOf('data-promise-item='));
    expect(intro).not.toContain('data-inventory-exhibit');
    expect(intro).not.toContain('data-hero-proof');
    expect(html).not.toContain('data-cta="hero"');
    expect(html).not.toContain('data-sticky-bar');
  });
  it('keeps exact evidence and all twelve variants in six product groups', () => {
    const d = inventoryFixture();
    d.shopify.catalog_items = ['Round', 'Oval', 'Square', 'Princess', 'Marquise', 'Radiant'].map((name) => ({ title: name, handle: name.toLowerCase(), url: `https://example.com/products/${name.toLowerCase()}`, variants: [{ title: `${name} with case`, price: 25.99, currency: 'GBP', available: false }, { title: `${name} Refill`, price: 11.99, currency: 'GBP', available: true }] }));
    d.drop_off.items.unshift({ id: 'refund_policy_mismatch', title: 'The refund link opens a different subject', detail: 'These are two different page purposes.', fix: 'Correct the link.', evidence: { label: 'Paired pages', value: 'Public wording', source_url: 'https://example.com/policies/refund-policy', citations: [{ url: 'https://example.com/policies/refund-policy', quote: 'We protect your personal information.' }, { url: 'https://example.com/pages/returns', quote: 'Returns require original unopened packaging.' }] } });
    const html = renderDtc(d, 'Example');
    expect((html.match(/data-inventory-product=/g) || [])).toHaveLength(6);
    expect((html.match(/data-variant="1"/g) || [])).toHaveLength(12);
    expect(html).toContain('We protect your personal information.');
    expect(html).toContain('Returns require original unopened packaging.');
    expect((html.match(/<img[^>]+round-proof\.png/g) || [])).toHaveLength(1);
    expect(html).toMatch(/<a[^>]+href="[^"]*round-proof\.png[^"]*"[^>]*><img/);
  });
  it('folds empty repeat-order coverage into existing features without an empty chapter', () => {
    const d = inventoryFixture();
    d.second_order = { items: [], note: 'Private rates need store data.' };
    d.public_depth = { status: 'present', data: { store_features: [{ kind: 'loyalty', title: 'Club rewards', quote: 'Earn points.', source_url: 'https://example.com/pages/club' }] } };
    const html = renderDtc(d, 'Example');
    expect(html).not.toContain('data-promise-section="second-order"');
    expect(html).toContain('Your repeat-order rate needs store data.');
    expect(html).toContain('Already on your store');
    expect(html).not.toContain('data-adspread');
  });
  it('keeps a capped variant notice outside product cells hidden on mobile', () => {
    const d = inventoryFixture();
    d.shopify.catalog_items = [{ ...d.shopify.catalog_items[0], variants: Array.from({ length: 10 }, (_, i) => ({ title: `Option ${i + 1}`, price: 10, currency: 'GBP', available: true })) }];
    const html = renderDtc(d, 'Example');
    expect((html.match(/data-variant="1"/g) || [])).toHaveLength(8);
    expect(html).toContain('First 8 of 10 variants');
    expect(html.indexOf('data-variant-cap="1"')).toBeGreaterThan(html.indexOf('</table>'));
    expect(html).not.toContain('Option 10');
  });
  it('keeps all three named cases in compact linked rows', () => {
    const html = renderDtc(inventoryFixture(), 'Example');
    expect(html).toContain('rise-case-rows');
    expect(html).not.toContain('data-additional-cases');
    expect((html.match(/data-case="/g) || [])).toHaveLength(3);
  });
});
