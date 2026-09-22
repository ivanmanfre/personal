import { describe, expect, it } from 'vitest';
import source from './samples.json';
import { fixture, initialJourneyState, journeyReducer, scoreOf, tierOf } from './model';
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
  it('describes the published assessment with its real sections, questions and tiers', () => {
    expect(fixture.assessment.url).toBe('https://resources.ivanmanfredi.com/andrew-hayes-94-assessment/');
    expect(fixture.assessment.sections).toHaveLength(5);
    expect(fixture.assessment.questions_sample).toHaveLength(3);
    for (const q of fixture.assessment.questions_sample) expect(q.answers.map(a => a.score)).toEqual([1,2,3,4,5]);
    expect(fixture.assessment.tiers.map(t => t.name)).toEqual(['Developing','Growth Stage','Advanced']);
  });
});
describe('example score', () => {
  it('scores the default answers into the middle tier', () => {
    expect(scoreOf(initialJourneyState)).toBe(60);
    expect(tierOf(initialJourneyState).name).toBe('Growth Stage');
  });
  it('moves across the live thresholds as answers change', () => {
    const low = [0,1,2].reduce((s,i) => journeyReducer(s,{type:'answer',index:i,score:1}), initialJourneyState);
    expect(scoreOf(low)).toBe(20); expect(tierOf(low).id).toBe('low');
    const high = [0,1,2].reduce((s,i) => journeyReducer(s,{type:'answer',index:i,score:5}), initialJourneyState);
    expect(scoreOf(high)).toBe(100); expect(tierOf(high).id).toBe('high');
  });
  it('keeps subscription separate from answering', () => {
    const subscribed = journeyReducer(initialJourneyState,{type:'subscription',value:true});
    expect(journeyReducer(subscribed,{type:'answer',index:0,score:5}).subscribed).toBe(true);
  });
});
