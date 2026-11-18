import {describe,it,expect} from 'vitest';
import rows from './__fixtures__/review-rows.json';
import {toStoryFixture,firstNameOf} from './adapter';
import {reviewDraft} from './reviewDrafts';
import {validateEdition} from './validate';
import {assessAudience} from './assessment';
const stored=(key:string)=>`https://bjbvqvzbzczjbatgmccb.supabase.co/storage/v1/object/public/lm-og/${key}`;
describe('saved scan rows (invented, same shape as the stored rows)',()=>{
 for(const row of rows)it(`preserves identity and evidence for ${row.company_slug}`,()=>{
  const f=toStoryFixture(row),draft=reviewDraft(f),a=assessAudience(f);
  expect(f.founder.name).toBe(row.report_json.content_system.founder.name);
  expect(f.founder.company).toBe(row.company_name);
  expect(f.audience?.engagers).toBe(row.report_json.content_system.audience.engagers);
  expect(f.source.capturedOn).toBe(row.report_json.content_system.audience.audited_at);
  expect(validateEdition(draft,f).errors).toEqual([]);
  expect(validateEdition({...draft,reviewStatus:'approved'},f,true).errors).toEqual([]);
  expect(a.state).toBe(row.company_slug.startsWith('jarle')?'zero-buyers':'unclassified');
 });
 it('never inserts another company or today’s date into missing data',()=>{const f=toStoryFixture({company_slug:'empty',report_json:{}});expect(f.source.capturedOn).toBe('');expect(f.founder.name).toBe('Your team');expect(f.audience).toBeUndefined();expect(reviewDraft(f)).toBeNull()});
 it('carries the profile audit only when the report has one with two complete findings',()=>{
  const finding=(area:string)=>({area,label:area,state:'present',today:'Your headline reads:',quote:'q',fix:'Do one thing.'});
  const row=(pa?:unknown)=>({company_slug:'pa',report_json:{content_system:{founder:{name:'A',avatar_url:stored('avatar-pa.jpg')},...(pa===undefined?{}:{profile_audit:pa})}}});
  expect('profileAudit' in toStoryFixture(row())).toBe(false);
  expect(toStoryFixture(row({version:1,findings:[finding('headline')]})).profileAudit).toBeUndefined();
  expect(toStoryFixture(row({version:2,findings:[finding('headline'),finding('about')]})).profileAudit).toBeUndefined();
  expect(toStoryFixture(row({version:1,findings:[finding('headline'),{area:'about',label:'About'},null,{...finding('banner'),state:'absent'}]})).profileAudit?.findings.map(f=>f.area)).toEqual(['headline','banner']);
 });
 it('carries only hosted profile pictures into the audit',()=>{
  const finding=(area:string)=>({area,label:area,state:'present',today:'Read from LinkedIn',quote:'',fix:'Change this.'});
  const row=(banner_url:string)=>({company_slug:'piotr',report_json:{content_system:{founder:{name:'Piotr',avatar_url:stored('avatar-piotr.jpg')},profile_audit:{version:1,banner_url,findings:[finding('headline'),finding('banner')]}}}});
  expect(toStoryFixture(row(stored('profile-banner-piotr.jpg'))).profileAudit).toMatchObject({avatarUrl:stored('avatar-piotr.jpg'),bannerUrl:stored('profile-banner-piotr.jpg')});
  expect(toStoryFixture(row('javascript:alert(1)')).profileAudit?.bannerUrl).toBeUndefined();
 });
 it('does not reuse a temporary founder photo for a legacy audit',()=>{
  const finding=(area:string,state='present')=>({area,label:area,state,today:'Read from LinkedIn',quote:'',fix:'Change this.'});
  const row={company_slug:'old',report_json:{content_system:{founder:{name:'A',avatar_url:'https://media.licdn.com/expired.jpg'},profile_audit:{version:1,findings:[finding('headline'),finding('about')]}}}};
  expect(toStoryFixture(row).profileAudit).toBeUndefined();
 });
 it('does not show an old custom-banner audit without its captured banner',()=>{
  const finding=(area:string,state='present')=>({area,label:area,state,today:'Read from LinkedIn',quote:'',fix:'Change this.'});
  const row={company_slug:'old',report_json:{content_system:{founder:{name:'A',avatar_url:stored('avatar-old.jpg')},profile_audit:{version:1,findings:[finding('headline'),finding('banner')]}}}};
  expect(toStoryFixture(row).profileAudit).toBeUndefined();
  row.report_json.content_system.profile_audit.findings[1].state='absent';
  expect(toStoryFixture(row).profileAudit?.avatarUrl).toBe(stored('avatar-old.jpg'));
 });
 it('rejects another prospect’s stored photo and banner',()=>{
  const finding=(area:string,state='present')=>({area,label:area,state,today:'Read from LinkedIn',quote:'',fix:'Change this.'});
  const row={company_slug:'pell-ashcombe-5f',report_json:{content_system:{founder:{name:'Piotr',avatar_url:stored('avatar-rufus-pennick-fx8.jpg')},profile_audit:{version:1,findings:[finding('headline'),finding('about')]}}}};
  expect(toStoryFixture(row).profileAudit).toBeUndefined();
  const withBanner={...row,report_json:{content_system:{...row.report_json.content_system,profile_audit:{version:1,banner_url:stored('profile-banner-rufus-pennick-fx8.jpg'),findings:[finding('headline'),finding('banner')]}}}};
  expect(toStoryFixture(withBanner).profileAudit).toBeUndefined();
 });
 it('omits a text-only profile audit when neither source image was saved',()=>{
  const finding=(area:string)=>({area,label:area,state:'present',today:'Read from LinkedIn',quote:'',fix:'Change this.'});
  const row={company_slug:'empty',report_json:{content_system:{founder:{name:'A'},profile_audit:{version:1,findings:[finding('headline'),finding('about')]}}}};
  expect(toStoryFixture(row).profileAudit).toBeUndefined();
 });
 it('normalizes malformed posts and nameless audience entries safely',()=>{const f=toStoryFixture({company_slug:'bad',report_json:{content_system:{founder:null,audience:{named:[null,{}, {name:'Alex',headline:null}]},sample_output:{posts:[null,{}],lm:null}}}});expect(f.samples.posts).toEqual([]);expect(f.audience?.named).toEqual([{name:'Alex',headline:''}])});
});

describe('firstNameOf',()=>{
 it.each([['Dr Sami K.','Sami'],['Dr. Sami Khan','Sami'],['Prof. Ada Lovelace','Ada'],['Mrs Jane Doe','Jane'],['Sir Tim','Tim'],['J. Smith','Smith'],['Piotr Nowak','Piotr'],['Dr','Dr'],['Ana','Ana'],['Sami, MD','Sami']])('%s -> %s',(n,f)=>expect(firstNameOf(n)).toBe(f));
 it('guards a backend first_name that is only a title',()=>{expect(toStoryFixture({company_slug:'x',report_json:{content_system:{founder:{name:'Dr Sami K.',first_name:'Dr'}}}}).founder.firstName).toBe('Sami')});
});

describe('hero, firm and partner (plan B interface)',()=>{
 const lead={name:'Hollis Fernwhistle',role:'Head of Growth at Pebblefold',headline:'Head of Growth at Pebblefold',profile_url:'https://www.linkedin.com/in/hollis-f',source:'competitor',how:'commented',author:'Brindlemoor Partners',post_url:'https://www.linkedin.com/posts/bp_123',post_excerpt:'Creator campaigns that pay back.',date:'2026-11-10',date_kind:'comment',reason:'Leads growth at a brand.'};
 const hero=(over:Record<string,unknown>={})=>({v:1,tier:'competitor_commenter',lead,rows:[lead],count:{buyers:27,own:12,outside:15,window_days:14,authors:['Brindlemoor Partners','Quillreach']},profile:null,checked:{people:348,passed:15},...over});
 const row=(cs:Record<string,unknown>)=>({company_slug:'h',report_json:{content_system:{founder:{name:'A B'},...cs}}});
 it('keeps a valid hero',()=>{const f=toStoryFixture(row({hero:hero(),firm:{staff:6,band:'small'},partner:{story:'kyle'}}));expect(f.hero?.lead?.name).toBe('Hollis Fernwhistle');expect(f.hero?.lead?.profileUrl).toBe('https://www.linkedin.com/in/hollis-f');expect(f.hero?.lead?.postUrl).toBe('https://www.linkedin.com/posts/bp_123');expect(f.hero?.lead?.dateKind).toBe('comment');expect(f.hero?.count.windowDays).toBe(14);expect(f.hero?.checked).toEqual({people:348,passed:15});expect(f.firm).toEqual({staff:6,band:'small'});expect(f.partnerStory).toBe('kyle')});
 it('drops a hero whose counts do not add up',()=>expect(toStoryFixture(row({hero:hero({count:{buyers:20,own:12,outside:15,window_days:14,authors:[]}})})).hero).toBeUndefined());
 it('drops a hero with a negative or fractional count',()=>{expect(toStoryFixture(row({hero:hero({count:{buyers:0,own:-1,outside:1,authors:[]}})})).hero).toBeUndefined();expect(toStoryFixture(row({hero:hero({count:{buyers:2.5,own:1.5,outside:1,authors:[]}})})).hero).toBeUndefined()});
 it('drops a hero with the wrong version or tier',()=>{expect(toStoryFixture(row({hero:hero({v:2})})).hero).toBeUndefined();expect(toStoryFixture(row({hero:hero({tier:'loss'})})).hero).toBeUndefined()});
 it('drops a hero whose lead has no role',()=>expect(toStoryFixture(row({hero:hero({lead:{...lead,role:''}})})).hero).toBeUndefined());
 it('drops a non-LinkedIn profile link but keeps the row',()=>{const f=toStoryFixture(row({hero:hero({lead:{...lead,profile_url:'https://evil.example/x',post_url:'javascript:alert(1)'}})}));expect(f.hero?.lead?.name).toBe('Hollis Fernwhistle');expect(f.hero?.lead?.profileUrl).toBeUndefined();expect(f.hero?.lead?.postUrl).toBeUndefined()});
 it('drops an unparseable date and its kind',()=>{const f=toStoryFixture(row({hero:hero({lead:{...lead,date:'last week'}})}));expect(f.hero?.lead?.date).toBeUndefined();expect(f.hero?.lead?.dateKind).toBeUndefined()});
 it('caps rows at three',()=>expect(toStoryFixture(row({hero:hero({rows:[lead,lead,lead,lead,lead]})})).hero?.rows).toHaveLength(3));
 it('keeps a profile-tier hero with a quote and a fix',()=>{const f=toStoryFixture(row({hero:hero({tier:'profile',lead:null,rows:[],count:{buyers:0,own:0,outside:0,window_days:null,authors:[]},profile:{quote:'Writing about clinic bookings, in plain words',fix:'Open with your clinic buyers.'},checked:null})}));expect(f.hero?.tier).toBe('profile');expect(f.hero?.lead).toBeUndefined();expect(f.hero?.profile?.quote).toBe('Writing about clinic bookings, in plain words')});
 it('drops a profile-tier hero without a fix',()=>expect(toStoryFixture(row({hero:hero({tier:'profile',lead:null,rows:[],profile:{quote:'x',fix:''}})})).hero).toBeUndefined());
 it('old scans have no hero and an unknown firm',()=>{const f=toStoryFixture(row({}));expect(f.hero).toBeUndefined();expect(f.firm.band).toBe('unknown');expect(f.partnerStory).toBeUndefined()});
 it('an unknown band or partner reads as none',()=>{const f=toStoryFixture(row({firm:{staff:'many',band:'huge'},partner:{story:'someone'}}));expect(f.firm).toEqual({band:'unknown'});expect(f.partnerStory).toBeUndefined()});
});
