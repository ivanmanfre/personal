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
