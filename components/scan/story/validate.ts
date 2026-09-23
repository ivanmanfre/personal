import type {StoryEdition} from './types';
import type {JourneyFixture} from '../../dev/scan-walkthrough/journey/model';
const object=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown):v is string=>typeof v==='string'&&v.trim().length>0;
const strings=(v:unknown,n?:number)=>Array.isArray(v)&&v.length>0&&(n===undefined||v.length===n)&&v.every(text);
const fields=(v:unknown,keys:string[])=>object(v)&&keys.every(k=>text(v[k]));
const items=(v:unknown,keys:string[],min=1)=>Array.isArray(v)&&v.length>=min&&v.every(x=>fields(x,keys));
export function validateEdition(raw:unknown,f:JourneyFixture,production=false):{edition:StoryEdition|null;errors:string[]}{
 const errors:string[]=[];
 if(!object(raw))return{edition:null,errors:['Story content is missing.']};
 if(raw.version!==1)errors.push('Unsupported story version.');
 if(raw.slug!==f.slug||raw.founderName!==f.founder.name||raw.companyName!==f.founder.company)errors.push('Story belongs to a different lead.');
 if(!['draft','approved'].includes(raw.reviewStatus)||(production&&raw.reviewStatus!=='approved'))errors.push('Story needs editorial approval.');
 if(!fields(raw,['brand','post','plainPost','magnet','magnetPost','keyword','message','reply','next','subject','email','contentHeading','contentWhy','magnetWhy','researchNote','buyerRole','coldTrigger','coldMessage','newsletterNote','nurtureNote']))errors.push('A required sample or explanation is missing.');
 if(!['creative','research','custom'].includes(raw.art))errors.push('Unknown artwork style.');
 if(!items(raw.slides,['title','body'],2)||raw.slides.length>12||raw.slides.some((s:any)=>s.title.length>140||s.body.length>950||(s.note!==undefined&&typeof s.note!=='string')))errors.push('Slides need 2–12 readable pages.');
 if(!items(raw.segments,['label','note'])||raw.segments.length>5)errors.push('Buyer segments are missing or invalid.');
 if(typeof raw.sourceQuote!=='string'||(raw.sourceQuote&&!f.source.quotes?.includes(raw.sourceQuote)&&!f.samples.posts?.some(p=>p.source_quote===raw.sourceQuote)))errors.push('Source quote cannot be traced to this scan.');
 const r=raw.resource;
 if(!fields(r,['title','mode'])||!['planner','question','document'].includes(r.mode)||!object(r.brand)||!['surface','ink','accent'].every(k=>typeof r.brand[k]==='string'&&/^#[\da-f]{6}$/i.test(r.brand[k]))||!Array.isArray(r.options)||!r.options.length||r.options.length>8)errors.push('Resource content or brand is invalid.');
 else {
  if(r.brand.logo!==undefined&&!(typeof r.brand.logo==='string'&&/^https:\/\//.test(r.brand.logo)))errors.push('Resource logo must use HTTPS.');
  for(const o of r.options){
   if(!fields(o,['label','title'])){errors.push('Resource option is invalid.');continue;}
   for(const [k,keys] of [['team',['role','job']],['deliverables',['label','value']],['sections',['heading','body']]] as const)if(o[k]!==undefined&&!items(o[k],[...keys]))errors.push(`Invalid resource ${k}.`);
   for(const k of ['review','quote','changes','rights','coveredRole','coveredJob','question','people','record','recruitment'])if(o[k]!==undefined&&!text(o[k]))errors.push(`Invalid resource ${k}.`);
   if(o.coveredRole&&(!o.coveredJob||!(Array.isArray(o.team)&&o.team.some((t:any)=>object(t)&&t.role===o.coveredRole))))errors.push('Existing-team choice has no matching role.');
   if(r.mode==='planner'&&(!items(o.team,['role','job'])||!items(o.deliverables,['label','value'])))errors.push('Planner needs a team and deliverables.');
   if(r.mode==='question'&&!fields(o,['question','people','record']))errors.push('Question resource is incomplete.');
   if(r.mode==='document'&&!items(o.sections,['heading','body']))errors.push('Document resource is empty.');
  }
 }
 if(!object(raw.cover)||!strings(raw.cover.lines,2)||!strings(raw.cover.details,2)||!fields(raw.cover,['left','right']))errors.push('Lead-magnet cover is incomplete.');
 if(!object(raw.flow)||!strings(raw.flow.messages,4)||!items(raw.flow.checks,['label','value'])||raw.flow.checks.length!==3||!fields(raw.flow,['signal','callTitle','brief']))errors.push('The example lead journey is incomplete.');
 return{edition:errors.length?null:raw as unknown as StoryEdition,errors};
}
