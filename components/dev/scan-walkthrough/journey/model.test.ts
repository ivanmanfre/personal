import { describe, expect, it } from 'vitest';
import source from './samples.json';
import { fixture, initialJourneyState, journeyReducer, tierOf, tierScores } from './model';
describe('public sample adapter', () => {
  it('preserves every source sample without rewriting or dropping paragraphs', () => {
    expect(fixture.samples).toEqual(source.samples);
    expect(fixture.samples.posts?.[2].body).toContain('After a few stories run, I ask the client to look at who came back.');
    expect(fixture.samples.posts?.[0].slides?.map(s => s.heading)).toEqual(['We ask them one question','What were you feeling when?','Words no brief produces','Why brand teams miss this','Use those answers as copy','Ask one customer today']);
    expect(fixture.samples.follow_ups).toHaveLength(3);
  });
  it('records the absent original newsletter rather than inventing source data', () => {
    expect(fixture.samples.newsletter).toBeUndefined();
    expect(fixture.source.url).toBe('https://inboundonsteroids.com/scan/andrew-hayes-94/');
  });
  it('describes the published assessment with its real sections and tiers', () => {
    expect(fixture.assessment.url).toBe('https://resources.ivanmanfredi.com/andrew-hayes-94-assessment/');
    expect(fixture.assessment.sections).toHaveLength(5);
    expect(fixture.assessment.tiers.map(t => t.name)).toEqual(['Developing','Growth Stage','Advanced']);
    const { low, mid } = fixture.assessment.thresholds;
    expect(tierScores.low).toBeLessThan(low); expect(tierScores.mid).toBeGreaterThanOrEqual(low); expect(tierScores.mid).toBeLessThan(mid); expect(tierScores.high).toBeGreaterThanOrEqual(mid);
  });
});
describe('resource hand-off', () => {
  it('retains the chosen tier when recording without subscribing', () => {
    const selected=journeyReducer(initialJourneyState,{type:'tier',value:'high'});
    expect(journeyReducer(selected,{type:'request'})).toMatchObject({tier:'high',requested:true,subscribed:false});
    expect(tierOf(selected).name).toBe('Advanced');
  });
  it('invalidates a recorded example when the tier changes', () => {
    const requested=journeyReducer(initialJourneyState,{type:'request'});
    expect(journeyReducer(requested,{type:'tier',value:'low'})).toMatchObject({tier:'low',requested:false});
  });
  it('keeps subscription separate from recording and changing the tier', () => {
    const subscribed=journeyReducer(initialJourneyState,{type:'subscription',value:true});
    expect(subscribed.requested).toBe(false);
    expect(journeyReducer(subscribed,{type:'tier',value:'low'}).subscribed).toBe(true);
  });
});
