import {describe,it,expect} from 'vitest';
import {assessAudience} from './assessment';
import {fixture} from '../../dev/scan-walkthrough/journey/model';
import {reviewDraft} from './reviewDrafts';
import {validateEdition} from './validate';
const f=(a:any)=>({...fixture,audience:a});
const rubric='Brand research buyers';
describe('source-bound audience assessments',()=>{
 it('does not turn absent data into zero',()=>{expect(assessAudience(f(undefined)).state).toBe('unavailable');expect(assessAudience(f({})).buyers).toBeNull()});
 it('withholds counts without a buyer definition',()=>expect(assessAudience(f({posts:5,engagers:13,engager_icp_count:0})).state).toBe('unclassified'));
 it('reports actual zero only within the sample',()=>{const a=assessAudience(f({posts:5,engagers:13,engager_icp_count:0,buyer_definition:rubric}));expect(a.state).toBe('zero-buyers');expect(a.receipt).toContain('elsewhere')});
 it('distinguishes no content from no engagement',()=>{expect(assessAudience(f({posts:0,engagers:0})).state).toBe('no-posts');expect(assessAudience(f({posts:5,engagers:0})).state).toBe('no-engagement')});
 it('uses real network samples even when engager matches are zero',()=>{const a=assessAudience(f({posts:5,engagers:13,engager_icp_count:0,network_sample:100,network_icp_count:6,network_total:1000,buyer_definition:rubric}));expect(a.state).toBe('network');expect(a.heading).toContain('6 potential');expect(a.heading).not.toContain('60')});
 it('rejects impossible, fractional and string counts',()=>{for(const count of [-1,1.2,'9',Infinity,50]){expect(assessAudience(f({posts:5,engagers:13,engager_icp_count:count,buyer_definition:rubric})).buyers).toBeNull()}});
 it('does not report zeros from blocked or failed collection',()=>{for(const audit_status of ['blocked','error'])expect(assessAudience(f({audit_status,posts:0,engagers:0,engager_icp_count:0,buyer_definition:rubric})).state).toBe('unavailable')});
 it('ignores non-string audit dates',()=>expect(()=>assessAudience(f({audited_at:{toString:'invalid'}}))).not.toThrow());
 it('uses source dates and hides invalid dates',()=>{expect(assessAudience(f({audited_at:'bad'})).date).toBeNull();expect(assessAudience(f({audited_at:'2026-01-02'})).date).toBe('2 Jan 2026')});
});
describe('production story gate',()=>{
 const draft=reviewDraft(fixture)!;
 it('accepts the source-bound review candidate',()=>expect(validateEdition(draft,fixture).errors).toEqual([]));
 it('requires approval for production',()=>{expect(validateEdition(draft,fixture,true).edition).toBeNull();expect(validateEdition({...draft,reviewStatus:'approved'},fixture,true).edition).not.toBeNull()});
 it('never reuses another lead’s draft',()=>{expect(reviewDraft({...fixture,slug:'different-lead'})).toBeNull();expect(validateEdition({...draft,slug:'different-lead'},fixture).edition).toBeNull()});
 it('blocks missing samples, unsafe assets and untraceable quotes',()=>{for(const bad of [{...draft,slides:[]},{...draft,sourceQuote:'Invented claim'},{...draft,resource:{...draft.resource,brand:{...draft.resource.brand,logo:'javascript:alert(1)'}}},{...draft,flow:{...draft.flow,messages:null}},{...draft,resource:{...draft.resource,options:[{label:'bad'}]}}])expect(validateEdition(bad,fixture).edition).toBeNull()});
 it('rejects non-string colors without coercing objects',()=>{for(const surface of [{toString:'invalid'},null,42]){const bad={...draft,resource:{...draft.resource,brand:{...draft.resource.brand,surface}}};expect(()=>validateEdition(bad,fixture)).not.toThrow();expect(validateEdition(bad,fixture).edition).toBeNull()}});
 it('rejects malformed teams without throwing',()=>{for(const team of [{},[null]]){const bad={...draft,resource:{...draft.resource,options:[{label:'Broken',title:'Broken',coveredRole:'Producer',coveredJob:'Existing team',team}]}};expect(()=>validateEdition(bad,fixture)).not.toThrow();expect(validateEdition(bad,fixture).edition).toBeNull()}});
 it('handles malformed JSON without throwing',()=>{for(const raw of [null,[],{},'x',42,{version:1,slides:[null],segments:[],resource:null,flow:[],cover:null}])expect(()=>validateEdition(raw,fixture)).not.toThrow()});
});
