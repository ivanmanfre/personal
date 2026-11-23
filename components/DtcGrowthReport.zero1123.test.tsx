// 2026-11-23 r1-final review reproducers (#4, #5, #7): a Meta zero prints only with its verified stamp.
// Invented store and invented reads only.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DtcGrowthReport } from './DtcGrowthReport';
import type { ReportJson, Scan } from '../lib/scanTypes';

vi.mock('../hooks/useMetadata', () => ({ useMetadata: vi.fn() }));

const FIX = path.join(__dirname, 'dev', 'scanlab');
const STAMP = 'page-zero+search-nomatch-2026-11-21';
const AT = '2026-11-20T10:00:00Z';
const PAGE = 'https://www.facebook.com/invented-store-page';
const NOT_RUNNING = "You're not running paid social right now";

function base(file: string): any {
  const d = structuredClone(JSON.parse(fs.readFileSync(path.join(FIX, file), 'utf-8')).dtc) as any;
  return d;
}
function render(d: any) {
  const scan = { id: 't', company_slug: 'invented-co', domain: 'invented-co.example', status: 'complete',
    created_at: '2026-11-20T12:00:00Z', completed_at: '2026-11-20T12:05:00Z', matched_offer: 'dtc_growth' } as unknown as Scan;
  return renderToStaticMarkup(<DtcGrowthReport report={{ dtc: d } as unknown as ReportJson} scan={scan} companyName="Invented Co" />);
}
const zero = (extra: any = {}) => ({ status: 'empty', page_confirmed: true, zero_verified: STAMP, fetched_at: AT, source_url: PAGE, data: { active_ad_count: 0 }, ...extra });
const sweepEmpty = { status: 'empty', fetched_at: AT, data: { checked_at: AT, sampled_items: 12, identity_matched_ads: 0, keywords: ['invented'] } };

describe('legacy spread: the big Meta 0 (r1-final #4)', () => {
  it('prints the 0 only for a stamped page zero, never for a failed page read beside an empty keyword sample', () => {
    const d = base('marla-legacy.json');
    d.ads = { ...d.ads, meta: { status: 'error', fetched_at: AT, reason: 'ads_archive http 503' }, meta_sweep: sweepEmpty };
    const failed = render(d);
    expect(failed).toContain('Meta Ad Library');            // the sample statement still shows
    expect(failed).toContain('traced none of the sampled ads');
    expect(failed).not.toContain('data-meta-zero');
    d.ads.meta = zero();
    expect(render(d)).toContain('data-meta-zero="1"');
    d.ads.meta = zero({ zero_verified: undefined });          // unstamped page zero: no 0
    expect(render(d)).not.toContain('data-meta-zero');
  });
});

describe('compact records: a present read with count 0 (r1-final #4, #7)', () => {
  it('never prints "Identified Facebook page: 0 active ads" and says the count is unconfirmed', () => {
    const d = base('marla-new-contract.json');
    d.ads = { ...d.ads, meta: { status: 'present', fetched_at: AT, source_url: PAGE, data: { active_ad_count: 0 } } };
    const html = render(d);
    expect(html).not.toMatch(/Identified Facebook page: 0 active/);
    expect(html).toContain('No confirmed count; page activity unknown.');
    d.ads.meta.data.active_ad_count = 3;
    const three = render(d);
    expect(three).toContain('Identified Facebook page: 3 active ads.');
    expect(three).not.toContain('No confirmed count; page activity unknown.');
  });
  it('an old unstamped page zero shows an unknown-activity status, a stamped one does not (r1-final #7)', () => {
    const d = base('marla-new-contract.json');
    d.ads = { ...d.ads, meta: zero({ zero_verified: undefined }) };
    const old = render(d);
    expect(old).toMatch(/<strong>Facebook page<\/strong> · Checked [^<]*\. No confirmed count; page activity unknown\./);
    expect(old).not.toContain('No active ads on the identified Facebook page');
    d.ads.meta = zero();
    const ok = render(d);
    expect(ok).not.toContain('No confirmed count; page activity unknown.');
    expect(ok).toContain('No active ads on the identified Facebook page');
  });
});

describe('"not running paid social" under every Meta status (r1-final #5)', () => {
  const finding = (title = NOT_RUNNING) => ({ signal: 'ads.meta', kind: 'gap', lever: 'paid_media', title,
    evidence: 'No active ads were found for your brand.', week_one: 'We test a Meta campaign.', source_url: PAGE });
  for (const meta of [{ status: 'error', fetched_at: AT }, { status: 'blocked', fetched_at: AT }, { status: 'skipped', fetched_at: AT },
                      { status: 'present', fetched_at: AT, data: { active_ad_count: 0 } }, zero({ zero_verified: undefined })]) {
    it(`drops the stored absence finding and hook when the Meta read is ${meta.status}${(meta as any).page_confirmed ? ' (unstamped)' : ''}`, () => {
      const d = base('marla-legacy.json');
      d.ads = { ...d.ads, meta };
      d.findings = [...(d.findings || []).filter((f: any) => f.signal !== 'ads.meta'), finding(), finding('You’re not running paid social right now.')];
      d.hero_hook = "You're not running paid social right now.";
      const html = render(d);
      expect(html).not.toMatch(/not running paid social/i);
    });
  }
  it('keeps it (as the page-scoped wording) beside a stamped page zero', () => {
    const d = base('marla-legacy.json');
    d.ads = { ...d.ads, meta: zero() };
    d.findings = [...(d.findings || []).filter((f: any) => f.signal !== 'ads.meta'), finding()];
    expect(render(d)).toContain('No active ads on the identified Facebook page');
  });
});

describe('Sol r2 reproducers', () => {
  it('a builder no-ads finding (padded, punctuated or curly) drops beside an error read and shows beside a stamp', () => {
    const d = base('marla-legacy.json');
    d.ads = { ...d.ads, meta: { status: 'error', fetched_at: AT } };
    d.findings = [...(d.findings || []).filter((f: any) => f.signal !== 'ads.meta'),
      { signal: 'ads.meta', kind: 'gap', lever: 'paid_media', title: ' You’re not  running paid social right now. ', evidence: 'None found.', source_url: PAGE },
      { signal: 'ads.meta', kind: 'gap', lever: 'paid_media', title: 'Your Meta pixel is installed, and your Facebook page runs no ads', evidence: 'Pixel found.', source_url: PAGE }];
    const text = render(d).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    expect(text).not.toMatch(/not running paid social/i);
    expect(text).not.toMatch(/runs no ads/i);
  });
  it('the legacy insight story never prints a present-0 Meta count', async () => {
    const { DtcInsightStory } = await import('./scan/DtcInsightStory');
    // the repo's existing legacy story fixture (the same one DtcInsightStory.test.tsx uses), with invented Meta reads
    const fx = JSON.parse(fs.readFileSync(path.join(FIX, 'yananails-story.json'), 'utf-8'));
    const data = { ...fx.commercial, presentation: fx.presentation } as any;
    const html = (meta: any) => renderToStaticMarkup(<DtcInsightStory companyName="Invented Co" domain={fx.presentation.domain} data={data} ads={{ meta }} bookingUrl="https://example.com/book" logo="https://example.com/logo.png" />);
    const zeroHtml = html({ status: 'present', fetched_at: AT, source_url: PAGE, data: { active_ad_count: 0 } });
    expect(zeroHtml).not.toContain('<strong>0</strong><span>Active Meta ads');
    expect(zeroHtml).toContain('Meta: no confirmed count for this review.');
    const four = html({ status: 'present', fetched_at: AT, source_url: PAGE, data: { active_ad_count: 4 } });
    expect(four).toContain('<strong>4</strong><span>Active Meta ads on the identified page');
  });
});

describe('model copy is rendered as stored (11-23 design)', () => {
  // The page never edits model-written copy: the Railway editor checks every field for a Meta count claim before a
  // page passes (meta_claims). The only Meta count the page prints is its own fixed line from the stored read.
  const story = (intro: string, body: string) => {
    const t = { title: 'Test a starter-plan page', observation: body, test: 'Proposed: compare plan and product messages.', measure: 'First-order revenue per visitor.', proposal_type: 'paid_creative', evidence: [{ kind: 'store', source_url: 'https://invented-co.example/', quote: 'starter plan' }] };
    return { status: 'present', tests: [t], journeys: [], presentation: { version: 'rise-standard-2026-10-14', domain: 'invented-co.example', headline: t.title, intro, review: { approved: true, checked_at: '2026-11-20T00:00:00Z' }, sections: [{ test_index: 0, headline: t.title, body, action: t.test, lane: 'store', proposal_type: 'paid_creative' }] } } as any;
  };
  const html = async (data: any, meta: any) => {
    const { DtcInsightStory } = await import('./scan/DtcInsightStory');
    return renderToStaticMarkup(<DtcInsightStory companyName="Invented Co" domain="invented-co.example" data={data} ads={{ meta }} bookingUrl="https://example.com/book" logo="https://example.com/logo.png" />).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  };
  it('renders intro and body verbatim and words an unverified read as not checked', async () => {
    const data = story('We read your homepage and two product pages.', 'Your store offers a starter plan.\n\nIt ships in two sizes.');
    const err = await html(data, { status: 'error' });
    expect(err).toContain('We read your homepage and two product pages.');
    expect(err).toContain('Your store offers a starter plan.');
    expect(err).toContain('It ships in two sizes.');
    expect(err).not.toMatch(/\b0\s+Active Meta ads/i);
  });
  it('metaNoAdsFinding matches only the builder titles', async () => {
    const { metaNoAdsFinding } = await import('./scan/adPool');
    expect(metaNoAdsFinding("You're not running paid social right now")).toBe(true);
    expect(metaNoAdsFinding('YOU’RE NOT RUNNING PAID SOCIAL RIGHT NOW!')).toBe(true);
    expect(metaNoAdsFinding('Your Meta pixel is installed, and your Facebook page runs no ads.')).toBe(true);
    expect(metaNoAdsFinding('Testing sprawl with no consolidated winner')).toBe(false);
    expect(metaNoAdsFinding(undefined)).toBe(false);
  });
});

describe('Sol r1 (new design): model copy prints only after the Meta claim check', () => {
  const CHECK = { version: 'meta-claims-editor-2026-11-23', at: AT };
  const withStory = (check: any) => {
    const fx = JSON.parse(fs.readFileSync(path.join(FIX, 'lunanails-standard.json'), 'utf-8'));
    const d = structuredClone(fx.dtc);
    d.commercial_evidence.presentation.intro = 'Invented intro sentence about the reviewed pages.';
    if (check) d.meta_claim_check = check; else delete d.meta_claim_check;
    return { d, domain: fx.domain };
  };
  const renderAt = (d: any, domain: string) => renderToStaticMarkup(<DtcGrowthReport report={{ dtc: d } as unknown as ReportJson}
    scan={{ id: 't', company_slug: 'invented-co', domain, status: 'complete', created_at: AT, completed_at: AT, matched_offer: 'dtc_growth' } as unknown as Scan} companyName="Invented Co" />);
  it('hides the story and its tests without the check and shows them with it', () => {
    const a = withStory(null);
    expect(renderAt(a.d, a.domain)).not.toContain('Invented intro sentence');
    const b = withStory(CHECK);
    expect(renderAt(b.d, b.domain)).toContain('Invented intro sentence');
    const c = withStory({ version: 'something-else' });
    expect(renderAt(c.d, c.domain)).not.toContain('Invented intro sentence');
  });
  it('the legacy spread says not checked for an error read with no sample', () => {
    const d = base('marla-legacy.json');
    d.ads = { meta: { status: 'error', fetched_at: AT, reason: 'ads_archive http 503' } };
    const html = render(d);
    expect(html).toContain('data-meta-unconfirmed="1"');
    expect(html).not.toMatch(/\bnull\b/);
  });
});

describe('Sol r2: fallback layouts keep the verified Meta line; older story layouts are withheld', () => {
  it('a link zero and a domain count still print when the page falls back to the legacy layout', () => {
    const d = base('marla-legacy.json');
    d.ads = { meta: { status: 'empty', page_confirmed: false, zero_verified: 'store-link-search-nomatch-2026-11-23', fetched_at: AT, source_url: PAGE, data: { active_ad_count: 0 } } };
    const a = render(d);
    expect(a).toContain('data-meta-verified="1"');
    expect(a).not.toContain('data-meta-unconfirmed="1"');
    d.ads = { meta: { status: 'present', fetched_at: AT, source_url: PAGE, data: { active_ad_count: null },
      domain_count: { verified: 'store-link-search-count-2026-11-23', count: 7, fetched_at: AT, source_url: PAGE } } };
    const b = render(d).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    expect(b).toMatch(/7 active meta ads showing your domain/i);
  });
  it('an older story layout keeps its checked tests but not its presentation', async () => {
    const { DtcInsightStory } = await import('./scan/DtcInsightStory');
    void DtcInsightStory;
    const fx = JSON.parse(fs.readFileSync(path.join(FIX, 'yananails-story.json'), 'utf-8'));
    const d = { ...base('marla-new-contract.json'), commercial_evidence: { ...fx.commercial, presentation: { ...fx.presentation, route: { ...fx.presentation.route, body: 'Invented nested route body.' } } },
      meta_claim_check: { version: 'meta-claims-backfill-2026-11-23', at: AT } };
    expect(render(d)).not.toContain('Invented nested route body.');
  });
  it('the two-archive heading never prints a null date', () => {
    const d = base('marla-legacy.json');
    d.ads = { meta: zero(), google: { status: 'present', data: { ads_found: 3 } } };
    expect(render(d)).not.toMatch(/read on (null|undefined)/);
  });
});

describe('Sol r3: a paged Meta read prints as a lower bound in the fallback layouts', () => {
  it('says at least', () => {
    const d = base('marla-legacy.json');
    d.ads = { meta: { status: 'present', fetched_at: AT, source_url: PAGE, data: { active_ad_count: 100, capped: true } } };
    const t = render(d).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    expect(t).toMatch(/at least 100/i);
  });
});

describe('Sol r4: the legacy receipt prints a paged Meta read as a lower bound too', () => {
  it('never says "100 active" without "at least"', () => {
    const d = base('marla-legacy.json');
    d.ads = { ...d.ads, meta: { status: 'present', fetched_at: AT, source_url: PAGE, data: { active_ad_count: 100, capped: true } } };
    d.findings = [...(d.findings || []), { signal: 'ads.meta', title: 'Invented Meta finding', evidence: 'Invented evidence.', severity: 'medium' }];
    const t = render(d).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    expect(t).toMatch(/at least 100 active/i);
    expect(t.replace(/at least 100 active/gi, '')).not.toMatch(/100 active/i);
  });
});
