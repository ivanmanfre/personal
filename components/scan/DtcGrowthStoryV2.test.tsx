// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DtcInsightStory, canShowStory } from './DtcInsightStory';
import { canShowStandardStoryV2 } from './DtcGrowthStoryV2';
import { casesForVertical, caseUrl } from '../riseCases';

const AD = 'https://www.facebook.com/ads/library/?id=2187403562155683', PET = 'https://tvati.com/products/tvati-pet', SEEN = '2026-11-14T20:05:39Z';
const GAP0 = 'Your ad says vet approved. Your page never says it.', GAP1 = 'Your pet page asks for size before packs.';
const tests = [
  { title: 'Compare ad messages', gap: GAP0, finding_type: 'ad_vs_page', absent_terms: ['vet'], observation: 'Two ads lead differently.', test: 'Run both ads side by side.', measure: 'Purchases per 100 clicks.', evidence: [{ kind: 'ad', source_url: AD, quote: 'Vet-approved joint and mobility support' }, { kind: 'store', source_url: PET, quote: 'No tablets, chews or powders.' }] },
  { title: 'Recommend one pack', gap: GAP1, observation: 'Size comes before packs.', test: 'Preselect one pack.', measure: 'Revenue per visitor.', evidence: [{ kind: 'store', source_url: PET, quote: 'WHAT SIZE IS YOUR PET?' }] },
];
const mark = { x: .5, y: .48, w: .4, h: .04 };
const strip = { read: 12, active: 31, capped: true, observed_at: SEEN, source_url: 'https://www.facebook.com/ads/library/', summary: '9 of the 12 ads we read link to Tvati Pet.', items: [
  { ad_url: AD, image_url: 'https://x.supabase.co/m0.jpg', start_date: '2026-11-10', opening: 'Vet-approved joint support', destination: PET, destination_kind: 'product', destination_title: 'Tvati Pet' },
  { ad_url: 'https://www.facebook.com/ads/library/?id=99', image_url: null, start_date: '2026-11-01', opening: 'Shop now', destination: 'http://fb.me/', destination_kind: 'other_site' }] };
const story = () => structuredClone({ status: 'present', tests, journeys: [{ ad_url: AD, destinations: [PET], observed_at: SEEN }], presentation: {
  version: 'rise-standard-2026-11-17', domain: 'tvati.com', requested_domain: 'tvati.com', headline: GAP0, intro: 'We read your store pages and 12 of your public ads on 14 Nov 2026.',
  review: { approved: true, checked_at: SEEN }, proof: { vertical: null },
  first_screen: { case: 'advertiser', lead_test_index: 0, ads_line: '31 active Meta ads on 14 Nov 2026. We read 12.' },
  ads_strip: strip,
  sections: [
    { test_index: 0, headline: GAP0, test_title: tests[0].title, kind: 'ad_vs_page', body: tests[0].observation, action: tests[0].test, lane: 'paid', ad: { url: AD, quote: tests[0].evidence[0].quote, destinations: [PET], observed_at: SEEN },
      captures: [{ kind: 'ad', url: 'https://x.supabase.co/ad.png', source_url: AD, captured_at: SEEN, quote: 'Vet-approved joint and mobility support' }, { kind: 'page', url: 'https://x.supabase.co/p1.png', source_url: PET, captured_at: SEEN, quote: 'No tablets, chews or powders.', mark, crop_url: 'https://x.supabase.co/p1-crop.webp', crop_mark: { x: .1, y: .4, w: .6, h: .1 } }] },
    { test_index: 1, headline: GAP1, test_title: tests[1].title, body: tests[1].observation, action: tests[1].test, lane: 'store', captures: [{ kind: 'page', url: 'https://x.supabase.co/p2.png', source_url: PET, captured_at: SEEN, quote: 'WHAT SIZE IS YOUR PET?', mark }] },
  ] } }) as any;
const page = (data: any, extra: any = {}) => <DtcInsightStory companyName="Tvati" domain="tvati.com" data={data} ads={{}} bookingUrl="https://example.com/meeting" logo="https://example.com/logo.png" {...extra} />;
const html = (data: any, extra: any = {}) => { const c = document.createElement('div'); c.innerHTML = renderToStaticMarkup(page(data, extra)); return c; };
const v1 = () => { const d = story(); d.tests = d.tests.map(({ gap, finding_type, absent_terms, ...t }: any) => t); d.presentation = { version: 'rise-standard-2026-10-14', domain: 'tvati.com', headline: tests[0].title, intro: 'We reviewed your store pages and public ads.', review: { approved: true, checked_at: SEEN }, sections: d.presentation.sections.map(({ test_title, kind, headline, ...x }: any) => ({ ...x, headline: d.tests[x.test_index].title, captures: x.captures.map(({ crop_url, crop_mark, ...c }: any) => c) })) }; return d; };

describe('validator and routing (2026-11-17)', () => {
  it('accepts a valid 2026-11-17 story and still accepts a 2026-10-14 story', () => {
    expect(canShowStandardStoryV2(story())).toBe(true);
    expect(canShowStory(story(), undefined, 'tvati.com')).toBe(true);
    expect(canShowStory(v1(), undefined, 'tvati.com')).toBe(true);
  });
  it('refuses a section whose headline is not its test gap', () => { const d = story(); d.presentation.sections[1].headline = tests[1].title; expect(canShowStandardStoryV2(d)).toBe(false); });
  it('refuses a test_title that is not the test title', () => { const d = story(); d.presentation.sections[1].test_title = 'x'; expect(canShowStandardStoryV2(d)).toBe(false); });
  it('refuses ad_vs_page on a store-lane section', () => { const d = story(); d.tests[1].finding_type = 'ad_vs_page'; d.presentation.sections[1].kind = 'ad_vs_page'; expect(canShowStandardStoryV2(d)).toBe(false); });
  it('refuses drafts on a section that is not a proposed paid test', () => { const d = story(); const dr = [{ product_url: PET, hook: 'h', body: 'b', proof_quote: 'q q q', proof_source_url: PET }]; d.tests[1].ad_drafts = dr; d.presentation.sections[1].drafts = dr; expect(canShowStandardStoryV2(d)).toBe(false); });
  it('refuses a crop_url without a valid crop_mark', () => { const d = story(); d.presentation.sections[0].captures[1].crop_mark = { x: .9, y: .1, w: .5, h: .1 }; expect(canShowStandardStoryV2(d)).toBe(false); });
  it('refuses a paid section after a store section', () => { const d = story(); d.presentation.sections.reverse(); d.presentation.first_screen.lead_test_index = 1; d.presentation.headline = GAP1; expect(canShowStandardStoryV2(d)).toBe(false); });
  it('refuses an unknown first-screen case and an unsafe strip link', () => {
    const d = story(); d.presentation.first_screen.case = 'maybe'; expect(canShowStandardStoryV2(d)).toBe(false);
    const e = story(); e.presentation.ads_strip.items[0].ad_url = 'javascript:alert(1)'; expect(canShowStandardStoryV2(e)).toBe(false);
  });
  it('routes each version to its own component', () => {
    expect(html(story()).querySelector('[data-rise-story]')!.getAttribute('data-rise-story')).toBe('rise-standard-2026-11-17');
    expect(html(v1()).querySelector('[data-rise-story]')!.getAttribute('data-rise-story')).toBe('rise-standard-2026-10-14');
  });
});

describe('layout (2026-11-17)', () => {
  it('keeps the brand name as h1 and shows the lead gap as the lede', () => {
    const c = html(story());
    expect(c.querySelector('h1')!.textContent).toBe('Tvati');
    expect(c.querySelector('.rv2-lede')!.textContent).toBe(GAP0);
    expect(c.querySelector('.ris-hero')!.textContent).not.toContain('Each finding below explains');
  });
  it('shows the DM line only when dm_quote is present', () => {
    expect(html(story()).querySelector('.rv2-said')).toBeNull();
    const d = story(); d.presentation.dm_quote = { quote: 'Meta ads are the gap for us right now', said_on: '2026-11-10' };
    expect(html(d).querySelector('.rv2-said')!.textContent).toBe('You said: “Meta ads are the gap for us right now”');
  });
  it('advertiser first screen pairs the ad with the page crop', () => {
    const labels = [...html(story()).querySelectorAll('.rv2-hero .rv2-shot-label')].map(n => n.textContent);
    expect(labels).toEqual(['Your ad', 'Your page']);
    expect(html(story()).querySelector('.rv2-hero .rv2-shot-page img')!.getAttribute('src')).toBe('https://x.supabase.co/p1-crop.webp');
  });
  it('zero_ads first screen shows the rival ad with its start date and no count', () => {
    const d = story(); d.presentation.first_screen = { case: 'zero_ads', lead_test_index: 0, ads_line: 'No active Meta ads on 14 Nov 2026.' }; delete d.presentation.ads_strip;
    d.presentation.rival = { advertiser: 'Pawfect', ad_url: 'https://www.facebook.com/ads/library/?id=5', image_url: 'https://x.supabase.co/r.jpg', opening_text: 'Joint chews dogs love', start_date: '2026-11-02', observed_at: SEEN };
    const hero = html(d).querySelector('.rv2-hero')!;
    expect(hero.textContent).toContain('Pawfect\'s ad, started 2 Nov 2026, live on 14 Nov 2026');
    expect(hero.querySelector('.rv2-hero-rival figcaption')!.textContent).not.toMatch(/\d+ ads/);
  });
  it('ads_unknown first screen never mentions the failed read', () => {
    const d = story(); d.presentation.first_screen = { case: 'ads_unknown', lead_test_index: 0, ads_line: null, ads_note: "Meta's public ad library did not give us a usable read of your ads on 14 Nov 2026, so how many ads you run is unknown here." }; delete d.presentation.ads_strip;
    const c = html(d);
    expect(c.querySelector('.ris-hero')!.textContent).not.toMatch(/could not|did not give|unknown/);
    expect(c.querySelector('.rv2-footnote')!.textContent).toContain('unknown');
  });
  it('strip heading says "The 12 ads we read" and labels another site', () => {
    const c = html(story());
    expect(c.querySelector('.rv2-strip h2')!.textContent).toBe('The 12 ads we read');
    expect([...c.querySelectorAll('.rv2-strip-row b')].map(n => n.textContent)).toEqual(['→ Tvati Pet', '→ Another site']);
    expect(c.querySelector('.rv2-strip')!.textContent).toContain('Public ad records do not show spend or sales.');
  });
  it('finding headline is the gap and the test is inside a closed details', () => {
    const c = html(story());
    expect(c.querySelector('#finding-1 h2')!.textContent).toBe(GAP1);
    const det = c.querySelector('#finding-1 details.rv2-test') as HTMLDetailsElement;
    expect(det.open).toBe(false); expect(det.querySelector('summary')!.textContent).toContain('The test we would run');
    expect(det.textContent).toContain('Recommend one pack');
    expect(c.textContent).not.toMatch(/equal budget|50\/50/);
  });
  it('ad_vs_page renders both quotes under Your ad says / Your page says', () => {
    const pair = html(story()).querySelector('#finding-0 .rv2-pair')!;
    expect([...pair.querySelectorAll('.rv2-pair-label')].map(n => n.textContent)).toEqual(['Your ad says', 'Your page says']);
    expect(pair.textContent).toContain('Vet-approved joint and mobility support');
    expect(pair.textContent).toContain('We did not find “vet” on this page.');
  });
  it('renders at most three draft ads labelled Draft ad, not running', () => {
    const d = story(); const dr = [1, 2, 3].map(n => ({ product_url: `https://tvati.com/products/p${n}`, hook: `Hook ${n}`, body: 'Body', proof_quote: 'Our dog walks again', proof_source_url: PET }));
    d.tests[1] = { ...d.tests[1], proposal_type: 'paid_creative', ad_drafts: dr }; Object.assign(d.presentation.sections[1], { proposal_type: 'paid_creative', drafts: dr });
    expect(canShowStandardStoryV2(d)).toBe(true);
    const tags = [...html(d).querySelectorAll('#finding-1 .rv2-draft-tag')].map(n => n.textContent);
    expect(tags).toEqual(['Draft ad, not running', 'Draft ad, not running', 'Draft ad, not running']);
  });
  it('shows no client results when proofVertical is null', () => {
    expect(casesForVertical(null)).toEqual([]);
    expect(casesForVertical('beauty').map(c => c.name)).toContain('Josie Maran');
    expect(html(story(), { cases: [] }).textContent).not.toContain('Published client results');
    const withCases = html(story(), { cases: casesForVertical('home').slice(0, 2).map(c => ({ name: c.name, url: caseUrl(c), headline: c.headline, image: c.image })) });
    expect(withCases.textContent).toContain('Published client results'); expect(withCases.textContent).toContain('LEUCHTTURM');
  });
  it('inline evidence uses crop_url and the zoom uses the full url', () => {
    const c = html(story());
    expect([...c.querySelectorAll('#finding-0 img')].map(i => i.getAttribute('src'))).toContain('https://x.supabase.co/p1-crop.webp');
    expect(c.innerHTML).not.toContain('https://x.supabase.co/p1.png');
  });
  it('static markup contains every finding without JavaScript', () => {
    const c = html(story());
    expect(c.querySelector('#finding-0')).not.toBeNull(); expect(c.querySelector('#finding-1')).not.toBeNull();
    expect(c.textContent).not.toMatch(/[—–]/);
  });
  it('keeps the performance-model sentence and Mattan booking action word for word', () => {
    const c = html(story());
    expect(c.querySelector('a[data-cta="close"]')!.getAttribute('href')).toBe('https://example.com/meeting');
    expect(c.querySelector('#rise-conversation')!.textContent).toContain('Get 30 min with Mattan');
    expect(c.querySelector('.ris-close-model')!.textContent).toBe(html(v1()).querySelector('.ris-close-model')!.textContent);
  });
});
