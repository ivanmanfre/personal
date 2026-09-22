import { describe, expect, it } from 'vitest';
import source from './samples.json';
import { fixture, initialJourneyState, journeyReducer, newsletterDraft } from './model';
describe('public sample adapter', () => {
  it('preserves every source sample without rewriting or dropping paragraphs', () => {
    expect(fixture.samples).toEqual(source.samples);
    expect(fixture.samples.posts?.[2].body).toContain('After a few stories run, I ask the client to look at who came back.');
    expect(fixture.samples.posts?.[0].slides?.map(s => s.heading)).toEqual(['We ask them one question','What were you feeling when?','Words no brief produces','Why brand teams miss this','Use those answers as copy','Ask one customer today']);
    expect(fixture.samples.lm?.whats_inside).toHaveLength(7);
    expect(fixture.samples.follow_ups).toHaveLength(3);
    expect(fixture.lm_cover_local).toBe('/scan-preview/cuevu-lm-cover.jpg');
  });
  it('records the absent original newsletter rather than inventing source data', () => {
    expect(fixture.samples.newsletter).toBeUndefined();
    expect(fixture.source.url).toBe('https://inboundonsteroids.com/scan/andrew-hayes-94/');
    expect(newsletterDraft.section.body.split(/\n\s*\n/)).toHaveLength(2);
  });
  it('keeps the newsletter choice as its own state', () => {
    expect(journeyReducer(initialJourneyState,{type:'subscription',value:true})).toEqual({subscribed:true});
  });
});
import { deriveHook, pillarRows } from './model';
describe('fold hook from the scan audit', () => {
  it('leads with the counted engager buyers, worded like the public report', () => {
    const h = deriveHook({ engagers: 37, posts: 5, engager_icp_count: 9, network_sample: 2, network_total: 1935, named: [{ name: 'Andrey Potekhin', headline: 'Creative director | Communication lead' }] }, undefined, 'Luiza');
    expect(h.headline).toBe('9 buyers are already in your comments, Luiza.');
    expect(h.count).toEqual({ prefix: '', value: 9, rest: 'buyers are already in your comments, Luiza.' });
    expect(h.receipts.map(r => [r.label, r.value])).toEqual([['Buyers in your comments', 9], ['People reached', 37], ['Posts read', 5]]);
    expect(h.gapLine).toBe('Your last 5 posts drew 37 people. 9 were buyers. The rest were not.');
    expect(h.named).toEqual([{ name: 'Andrey Potekhin', headline: 'Creative director | Communication lead' }]);
    expect(h.warning).toBe('Warning · buyers in your comments, no follow-up');
  });
  it('falls back to the public report line when the audit counted no buyers', () => {
    const h = deriveHook(fixture.audience, undefined, 'Andrew');
    expect(h.count).toBeUndefined();
    expect(h.headline).toBe('The attention is real. The mechanism that keeps it is the part that was never built.');
    expect(h.receipts).toEqual([]);
    expect(pillarRows(fixture.pillars).map(r => r.anchor)).toEqual(['content', 'inbound', 'outreach']);
  });
  it('scrubs approval language from the pillar cells the way the public report does', () => {
    const rows = pillarRows({ content: { found: 'She posts weekly.', projected: 'A week of posts goes out under her name, waiting for her approval.' }, outbound: { found: 'The corpus shows no follow-up.', projected: 'A short personal note goes out to every warm engager, drafted for her approval.' } });
    expect(rows.map(r => r.projected)).toEqual(['A week of posts under your name.', 'A short personal note goes out to every warm engager.']);
    expect(rows[1].found).toBe('Your public posts show no follow-up.');
  });
});
