import React from 'react';
import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {toStoryFixture} from './adapter';
import {CompetitorEngagersSection} from './StudioPlan';

const person=(n:number,over:Record<string,unknown>={})=>({name:`Person ${n}`,headline:`CMO at Firm ${n}`,company:`Firm ${n}`,profile_url:`https://www.linkedin.com/in/p${n}`,reason:`CMO at Firm ${n}, a buyer of this work.`,engaged:n%2?'commented':'liked',competitor:'Blue Array: SEO agency',post_url:`https://www.linkedin.com/posts/bluearray_x-activity-${n}`,post_excerpt:'x',posted_at:'2026-10-21T09:00:00+00:00',...over});
const row=(ce?:unknown)=>({company_slug:'ce',report_json:{content_system:{founder:{name:'Mark Cook'},...(ce===undefined?{}:{competitor_engagers:ce})}}});
const section=(people:unknown[],extra:Record<string,unknown>={})=>({version:1,at:'2026-10-27T15:00:00Z',window_days:14,competitors:[{name:'Blue Array: SEO agency'},{name:'Exposure Ninja'}],posts_read:8,engagers_read:117,count:people.length,people,notes:[],...extra});

describe('competitor engagers on the story page',()=>{
 it('keeps only people with a real profile link, post link, reason and engagement',()=>{
  const f=toStoryFixture(row(section([person(1),person(2,{profile_url:'https://evil.example/in/x'}),person(3,{reason:''}),person(4,{engaged:'shared'}),person(5,{post_url:'javascript:alert(1)'})],{count:9})));
  expect(f.competitorEngagers?.people.map(p=>p.name)).toEqual(['Person 1']);
  expect(f.competitorEngagers?.count).toBe(9);
 });
 it('has no section without a fit, a version or a report key',()=>{
  expect(toStoryFixture(row()).competitorEngagers).toBeUndefined();
  expect(toStoryFixture(row(section([]))).competitorEngagers).toBeUndefined();
  expect(toStoryFixture(row({...section([person(1)]),version:2})).competitorEngagers).toBeUndefined();
 });
 it('keeps notes only for people on the list and never counts fewer than it shows',()=>{
  const f=toStoryFixture(row(section([person(1),person(2)],{count:1,notes:[{to:'Person 2',headline:'CMO',note:'Hi Person, how is search going?'},{to:'Someone Else',note:'Hi'}]})));
  expect(f.competitorEngagers?.notes.map(n=>n.to)).toEqual(['Person 2']);
  expect(f.competitorEngagers?.count).toBe(2);
 });
 it('renders the count, short competitor names, the first five people and the notes',()=>{
  const f=toStoryFixture(row(section([1,2,3,4,5,6,7].map(n=>person(n)),{count:21,notes:[{to:'Person 1',headline:'CMO at Firm 1',note:'Hi Person, how does Firm 1 plan search this year?'}]})));
  const html=renderToStaticMarkup(<CompetitorEngagersSection data={f.competitorEngagers!}/>);
  expect(html).toContain('Buyers reading your competitors');
  expect(html).toContain('In the last two weeks, 21 people who fit the buyer you sell to liked or commented on LinkedIn posts from Blue Array and Exposure Ninja.');
  expect(html).toContain('Commented on a Blue Array post · 21 Oct');
  expect(html).toContain('Person 5');
  expect(html).not.toContain('Person 6');
  expect(html).toContain('Show 2 more people');
  expect(html).toContain('how does Firm 1 plan search this year?');
  expect(html).not.toMatch(/[—–]/);
 });
});
