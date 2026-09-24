import type {JourneyFixture} from '../../dev/scan-walkthrough/journey/model';
const record=(x:unknown):Record<string,any>=>x&&typeof x==='object'&&!Array.isArray(x)?x as Record<string,any>:{};
const str=(x:unknown)=>typeof x==='string'?x.trim():'';
const https=(x:unknown)=>/^https:\/\//.test(str(x))?str(x):undefined;
export interface StoryScanRow {company_slug:string;company_name?:string|null;domain?:string|null;completed_at?:string|null;report_json:unknown}
/** No current-date, demo-person, fabricated metric or other-lead fallback. */
export function toStoryFixture(row:StoryScanRow):JourneyFixture {
 const report=record(row.report_json),cs=record(report.content_system),founder=record(cs.founder),samples=record(cs.sample_output),lm=record(samples.lm),brand=record(lm.brand);
 const name=str(founder.name)||str(row.company_name)||'Your team';
 const posts=Array.isArray(samples.posts)?samples.posts.filter(p=>p&&typeof p==='object'&&typeof p.hook==='string').map(p=>({...p,source_quote:str(p.source_quote)})):[];
 const a=record(cs.audience);
 const audience=Object.keys(a).length?{...a,named:Array.isArray(a.named)?a.named.filter(n=>n&&typeof n.name==='string').map(n=>({...n,headline:str(n.headline)})):[]}:undefined;
 const icp=record(samples.icp_targeting),segments=Array.isArray(icp.segments)?icp.segments.filter(s=>s&&typeof s.label==='string'):[];
 const date=str(a.audited_at)||str(row.completed_at);
 // Profile audit (flagged builds only): shown when the report carries at least two complete findings.
 const pa=record(cs.profile_audit),paFindings=Array.isArray(pa.findings)?pa.findings.filter((f:any)=>f&&typeof f==='object'&&str(f.label)&&str(f.today)&&str(f.fix)).slice(0,5).map((f:any)=>({area:str(f.area),label:str(f.label),state:str(f.state),today:str(f.today),quote:str(f.quote),fix:str(f.fix)})):[];
 const profileAudit=pa.version===1&&paFindings.length>=2?{findings:paFindings}:undefined;
 return {slug:row.company_slug,ogImage:https(cs.og_image_url),domain:str(row.domain),founder:{name,firstName:str(founder.first_name)||name.split(' ')[0],company:str(row.company_name),headline:str(founder.headline),avatarUrl:https(founder.avatar_url)},audience,pillars:cs.pillars&&record(cs.pillars),thesis:str(cs.thesis),buyer:{role:str(segments[0]?.label),project:str(segments[0]?.note)||str(icp.icp_line)},samples:{...samples,posts,lm:{...lm,brand:{...brand,font_heading:str(brand.font_heading)}}},lm_cover_local:https(lm.cover_url)||'',source:{kind:'original-scan',url:`https://inboundonsteroids.com/scan/${encodeURIComponent(row.company_slug)}/`,capturedOn:date,quotes:Array.isArray(cs.story_evidence?.quotes)?cs.story_evidence.quotes.filter((q:unknown)=>typeof q==='string'):[]},...(profileAudit?{profileAudit}:{})} as JourneyFixture;
}
