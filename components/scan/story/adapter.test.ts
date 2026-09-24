import {describe,it,expect} from 'vitest';
import rows from './__fixtures__/review-rows.json';
import {toStoryFixture} from './adapter';
import {reviewDraft} from './reviewDrafts';
import {validateEdition} from './validate';
import {assessAudience} from './assessment';
describe('actual saved scan rows',()=>{
 for(const row of rows)it(`preserves identity and evidence for ${row.company_slug}`,()=>{
  const f=toStoryFixture(row),draft=reviewDraft(f),a=assessAudience(f);
  expect(f.founder.name).toBe(row.report_json.content_system.founder.name);
  expect(f.founder.company).toBe(row.company_name);
  expect(f.audience?.engagers).toBe(row.report_json.content_system.audience.engagers);
  expect(f.source.capturedOn).toBe(row.report_json.content_system.audience.audited_at);
  expect(validateEdition(draft,f).errors).toEqual([]);
  expect(validateEdition({...draft,reviewStatus:'approved'},f,true).errors).toEqual([]);
  expect(a.state).toBe(row.company_slug.startsWith('nerijus')?'zero-buyers':'unclassified');
 });
 it('never inserts another company or today’s date into missing data',()=>{const f=toStoryFixture({company_slug:'empty',report_json:{}});expect(f.source.capturedOn).toBe('');expect(f.founder.name).toBe('Your team');expect(f.audience).toBeUndefined();expect(reviewDraft(f)).toBeNull()});
 it('carries the profile audit only when the report has one with two complete findings',()=>{
  const finding=(area:string)=>({area,label:area,state:'present',today:'Your headline reads:',quote:'q',fix:'Do one thing.'});
  const row=(pa?:unknown)=>({company_slug:'pa',report_json:{content_system:{founder:{name:'A'},...(pa===undefined?{}:{profile_audit:pa})}}});
  expect('profileAudit' in toStoryFixture(row())).toBe(false);
  expect(toStoryFixture(row({version:1,findings:[finding('headline')]})).profileAudit).toBeUndefined();
  expect(toStoryFixture(row({version:2,findings:[finding('headline'),finding('about')]})).profileAudit).toBeUndefined();
  expect(toStoryFixture(row({version:1,findings:[finding('headline'),{area:'about',label:'About'},null,finding('banner')]})).profileAudit?.findings.map(f=>f.area)).toEqual(['headline','banner']);
 });
 it('normalizes malformed posts and nameless audience entries safely',()=>{const f=toStoryFixture({company_slug:'bad',report_json:{content_system:{founder:null,audience:{named:[null,{}, {name:'Alex',headline:null}]},sample_output:{posts:[null,{}],lm:null}}}});expect(f.samples.posts).toEqual([]);expect(f.audience?.named).toEqual([{name:'Alex',headline:''}])});
});
