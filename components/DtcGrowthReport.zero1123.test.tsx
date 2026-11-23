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

describe('story intro sentence that states a Meta zero (real-row render 11-23)', () => {
  it('drops it beside an unverified read and keeps it beside a stamped page zero', async () => {
    const { metaZeroScrub } = await import('./scan/adPool');
    const intro = 'We read your homepage and two product pages. Meta’s ad library shows no active ads on your Facebook page. Our Google check found none.';
    for (const meta of [{ status: 'empty', page_confirmed: true, fetched_at: AT }, { status: 'error' }, undefined, { status: 'present', data: { active_ad_count: 0 } }]) {
      const out = metaZeroScrub(intro, meta);
      expect(out).not.toMatch(/no active ads/i);
      expect(out).toBe('We read your homepage and two product pages. Our Google check found none.');
    }
    expect(metaZeroScrub(intro, zero())).toBe(intro);
    expect(metaZeroScrub("Your Facebook page isn't currently running ads.", { status: 'error' })).toMatch(/^We reviewed your store pages/);
    const plain = 'We reviewed your store pages and public ads.';
    expect(metaZeroScrub(plain, { status: 'error' })).toBe(plain);
  });
});
