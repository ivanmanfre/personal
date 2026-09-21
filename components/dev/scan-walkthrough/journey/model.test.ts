import { describe, expect, it } from 'vitest';
import source from './samples.json';
import { checklistDownload, fixture, initialJourneyState, journeyReducer } from './model';
describe('public sample adapter', () => {
  it('preserves every source sample without rewriting or dropping paragraphs', () => {
    expect(fixture.samples).toEqual(source.samples);
    expect(fixture.samples.posts?.[2].body).toContain('After a few stories run, I ask the client to look at who came back.');
    expect(fixture.samples.posts?.[0].slides?.map(s => s.heading)).toEqual(['We ask them one question','What were you feeling when?','Words no brief produces','Why brand teams miss this','Use those answers as copy','Ask one customer today']);
    expect(fixture.samples.lm?.whats_inside).toHaveLength(7);
    expect(fixture.samples.follow_ups).toHaveLength(3);
  });
  it('records the absent original newsletter rather than inventing source data', () => {
    expect(fixture.samples.newsletter).toBeUndefined();
    expect(fixture.source.url).toBe('https://inboundonsteroids.com/scan/andrew-hayes-94/');
  });
});
describe('resource hand-off', () => {
  it('retains choices when requesting without subscribing', () => {
    const selected=journeyReducer(initialJourneyState,{type:'category',value:'Skincare'});
    expect(journeyReducer(selected,{type:'request'})).toMatchObject({category:'Skincare',requested:true,subscribed:false});
  });
  it('invalidates a request when its context or checklist changes', () => {
    const requested=journeyReducer(initialJourneyState,{type:'request'});
    expect(journeyReducer(requested,{type:'purpose',value:'launch'})).toMatchObject({purpose:'launch',requested:false});
    expect(journeyReducer(requested,{type:'check',index:2})).toMatchObject({checked:[0,1,2],requested:false});
  });
  it('keeps subscription separate from requesting and changing inputs', () => {
    const subscribed=journeyReducer(initialJourneyState,{type:'subscription',value:true});
    expect(subscribed.requested).toBe(false);
    expect(journeyReducer(subscribed,{type:'category',value:'Software'}).subscribed).toBe(true);
  });
  it('downloads selected context and every original question safely', () => {
    const chosen={...initialJourneyState,category:'<script>alert("test")</script>',purpose:'launch' as const};
    const html=checklistDownload(chosen,fixture.samples.lm!.whats_inside!);
    expect(html).toContain('&lt;script&gt;');expect(html).not.toContain('<script>');
    expect(html).toContain('Product launch');expect(html).toContain('2 of 7 checked');
    expect(html.match(/<li>/g)).toHaveLength(7);
  });
});
