import type {JourneyFixture,HeroRow,ScanHero,FirmSize} from '../../dev/scan-walkthrough/journey/model';
const record=(x:unknown):Record<string,any>=>x&&typeof x==='object'&&!Array.isArray(x)?x as Record<string,any>:{};
const str=(x:unknown)=>typeof x==='string'?x.trim():'';
const https=(x:unknown)=>/^https:\/\//.test(str(x))?str(x):undefined;
const storageRoot=`${((import.meta as any).env?.VITE_SUPABASE_URL||'https://bjbvqvzbzczjbatgmccb.supabase.co').replace(/\/$/,'')}/storage/v1/object/public/lm-og/`;
const storedAuditImage=(x:unknown,kind:'avatar'|'banner',slug:string)=>{
 const url=https(x);
 if(!url?.startsWith(storageRoot))return undefined;
 const key=url.slice(storageRoot.length).split(/[?#]/)[0];
 const prefixes=kind==='banner'?[`profile-banner-${slug}`]:[`avatar-${slug}`,`profile-photo-${slug}`];
 return prefixes.some(prefix=>key.startsWith(prefix)&&/^(?:-[a-f0-9]{20})?\.(?:jpe?g|png|webp)$/i.test(key.slice(prefix.length)))?url:undefined;
};
const TITLES=new Set(['dr','doctor','prof','professor','mr','mrs','ms','miss','mx','sir','dame','lord','lady','rev','fr','sr','hon','mag','eng','ing','dipl']);
const isTitle=(w:string)=>TITLES.has(w.toLowerCase().replace(/[.,]+$/,''));
const isInitial=(w:string)=>/^\p{L}\.?$/u.test(w);
/** Given name from a display name: skips leading titles ("Dr Sami K." gives "Sami") and initials. */
export function firstNameOf(full:string):string{
 const words=full.trim().split(/\s+/).filter(Boolean);
 const rest=words.filter((w,i)=>!(isTitle(w)&&i<words.length-1)).filter((w,_,a)=>!(isInitial(w)&&a.length>1));
 return (rest[0]||words[0]||'').replace(/[,;]+$/,'');
}
const LINKEDIN={in:/^https:\/\/(www\.)?linkedin\.com\/in\//,posts:/^https:\/\/(www\.)?linkedin\.com\/(posts|feed)\//};
const linkedin=(x:unknown,kind:'in'|'posts')=>{const u=https(x);return u&&LINKEDIN[kind].test(u)?u:undefined;};
const count=(x:unknown)=>Number.isInteger(x)&&(x as number)>=0?x as number:null;
const TIERS=['competitor_commenter','competitor_liker','own_engager','profile'] as const;
const isoDate=(x:unknown)=>{const s=str(x);return /^\d{4}-\d{2}-\d{2}/.test(s)&&!Number.isNaN(new Date(s).getTime())?s.slice(0,10):undefined;};
/** A real calendar day (2026-02-31 is rejected, not rolled into March); anything else gives no date. */
export const calendarDate=(x:unknown)=>{
 const s=str(x),m=/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(s);
 if(!m||Number.isNaN(new Date(s).getTime()))return undefined;
 const [y,mo,d]=[+m[1],+m[2],+m[3]],t=new Date(Date.UTC(y,mo-1,d));
 return t.getUTCFullYear()===y&&t.getUTCMonth()===mo-1&&t.getUTCDate()===d?s.slice(0,10):undefined;
};
function heroRow(x:unknown):HeroRow|null{
 const r=record(x),name=str(r.name);
 if(!name)return null;
 // The signal and its source are the sentence: a missing or unknown value rejects the row (and so the hero).
 const source=(['competitor','topic','own'] as const).find(v=>v===r.source),how=(['commented','liked','engaged'] as const).find(v=>v===r.how);
 if(!source||!how)return null;
 const date=calendarDate(r.date),dateKind=date?(['comment','post'] as const).find(v=>v===r.date_kind):undefined;
 const author=str(r.author)||undefined,profileUrl=linkedin(r.profile_url,'in'),postUrl=linkedin(r.post_url,'posts');
 return {name,role:str(r.role),headline:str(r.headline),source,how,postExcerpt:str(r.post_excerpt),reason:str(r.reason),...(profileUrl?{profileUrl}:{}),...(author?{author}:{}),...(postUrl?{postUrl}:{}),...(date?{date}:{}),...(dateKind?{dateKind}:{})};
}
/** The stored hero, kept only when every check passes; anything malformed gives today's layout. */
export function parseHero(x:unknown):ScanHero|undefined{
 const h=record(x),c=record(h.count);
 if(h.v!==1||!TIERS.includes(h.tier))return undefined;
 const buyers=count(c.buyers),own=count(c.own),outside=count(c.outside);
 if(buyers===null||own===null||outside===null||buyers!==own+outside)return undefined;
 const windowDays=Number.isInteger(c.window_days)&&c.window_days>0?c.window_days as number:undefined;
 const authors=Array.isArray(c.authors)?c.authors.map(str).filter(Boolean).slice(0,4):[];
 const ck=record(h.checked),people=count(ck.people),passed=count(ck.passed);
 const checked=people!==null&&passed!==null&&passed<=people?{people,passed}:undefined;
 const base={tier:h.tier as ScanHero['tier'],count:{buyers,own,outside,...(windowDays?{windowDays}:{}),authors},...(checked?{checked}:{})};
 if(h.tier==='profile'){
  const p=record(h.profile),quote=str(p.quote),fix=str(p.fix);
  return quote&&fix?{...base,rows:[],profile:{quote,fix}}:undefined;
 }
 const lead=heroRow(h.lead);
 if(!lead||!lead.role||!Array.isArray(h.rows))return undefined;
 const rows=h.rows.map(heroRow);
 if(rows.some(r=>!r))return undefined;
 return {...base,lead,rows:(rows as HeroRow[]).slice(0,3)};
}
function parseFirm(x:unknown):FirmSize{
 const f=record(x),band=(['small','larger','unknown'] as const).find(v=>v===f.band)??'unknown',staff=count(f.staff);
 return band==='unknown'||staff===null||staff===0?{band}:{staff,band};
}
/** Optional fields the new layout reads from an own-engager row, as strings or absent. Text keeps its spacing so today's layout reads the same. */
const text=(x:unknown)=>typeof x==='string'?x:'';
function ownSignal(n:Record<string,any>){
 const out:Record<string,string>={};
 if('role' in n)out.role=text(n.role);
 if('how' in n)out.how=n.how==='commented'||n.how==='liked'?n.how:'engaged';
 if('date' in n){const d=calendarDate(n.date);if(d)out.date=d;else out.date='';}
 if('profile_url' in n)out.profile_url=linkedin(n.profile_url,'in')||'';
 return out;
}
/** The plainest first screen for a rejected hero: the profile tier when the checked profile audit quotes the headline, else nothing. */
function rejectedHero(audit:{findings:{area:string;quote:string;fix:string}[]}|undefined):NonNullable<JourneyFixture['heroRejected']>{
 const f=audit?.findings.find(x=>x.area==='headline'&&x.quote&&x.fix);
 return f?{profile:{quote:f.quote,fix:f.fix}}:{};
}
export interface StoryScanRow {company_slug:string;company_name?:string|null;domain?:string|null;completed_at?:string|null;report_json:unknown}
/** No current-date, demo-person, fabricated metric or other-lead fallback. */
export function toStoryFixture(row:StoryScanRow):JourneyFixture {
 const report=record(row.report_json),cs=record(report.content_system),founder=record(cs.founder),samples=record(cs.sample_output),lm=record(samples.lm),brand=record(lm.brand);
 const name=str(founder.name)||str(row.company_name)||'Your team';
 const posts=Array.isArray(samples.posts)?samples.posts.filter(p=>p&&typeof p==='object'&&typeof p.hook==='string').map(p=>({...p,source_quote:str(p.source_quote)})):[];
 const a=record(cs.audience);
 const people=(v:unknown)=>Array.isArray(v)?v.filter(n=>n&&typeof n.name==='string'&&n.name.trim()).map(n=>({...n,headline:str(n.headline)})):[];
 const audience=Object.keys(a).length?{...a,named:Array.isArray(a.named)?a.named.filter(n=>n&&typeof n.name==='string').map(n=>({...n,headline:str(n.headline),...ownSignal(n)})):[],existing_clients:people(a.existing_clients)}:undefined;
 const icp=record(samples.icp_targeting),segments=Array.isArray(icp.segments)?icp.segments.filter(s=>s&&typeof s.label==='string'):[];
 const date=str(a.audited_at)||str(row.completed_at);
 // Profile audit (flagged builds only): shown when the report carries at least two complete findings.
 const pa=record(cs.profile_audit),paFindings=Array.isArray(pa.findings)?pa.findings.filter((f:any)=>f&&typeof f==='object'&&str(f.label)&&str(f.today)&&str(f.fix)).slice(0,5).map((f:any)=>({area:str(f.area),label:str(f.label),state:str(f.state),today:str(f.today),quote:str(f.quote),fix:str(f.fix)})):[];
 const auditAvatar=storedAuditImage(pa.avatar_url,'avatar',row.company_slug)||storedAuditImage(founder.avatar_url,'avatar',row.company_slug),auditBanner=storedAuditImage(pa.banner_url,'banner',row.company_slug);
 const missingCustomBanner=paFindings.some(f=>f.area==='banner'&&f.state==='present')&&!auditBanner;
 const profileAudit=pa.version===1&&paFindings.length>=2&&!missingCustomBanner&&(auditAvatar||auditBanner)?{findings:paFindings,avatarUrl:auditAvatar,bannerUrl:auditBanner}:undefined;
 // Competitor engagers: only people with a real LinkedIn profile link and a stated reason; none means no section.
 const ce=record(cs.competitor_engagers);
 const ceLink=(x:unknown,kind:'in'|'posts')=>{const u=https(x);return u&&new RegExp(`^https://(www\\.)?linkedin\\.com/${kind==='in'?'in/':'(posts|feed)/'}`).test(u)?u:undefined;};
 const cePeople=ce.version===1&&Array.isArray(ce.people)?ce.people.map(record).filter(p=>str(p.name)&&ceLink(p.profile_url,'in')&&ceLink(p.post_url,'posts')&&str(p.reason)&&str(p.competitor)&&(p.engaged==='liked'||p.engaged==='commented')).slice(0,15).map(p=>({name:str(p.name),headline:str(p.headline),company:str(p.company),profileUrl:ceLink(p.profile_url,'in')!,reason:str(p.reason),engaged:p.engaged,competitor:str(p.competitor),postUrl:ceLink(p.post_url,'posts')!,postExcerpt:str(p.post_excerpt),postedAt:str(p.posted_at),...(p.source==='topic'||p.source==='competitor'?{source:p.source}:{}),...(isoDate(p.commented_at)?{commentedAt:isoDate(p.commented_at)}:{})})):[];
 const ceNames=new Set(cePeople.map(p=>p.name));
 const competitorEngagers=cePeople.length?{count:Math.max(cePeople.length,Number.isInteger(ce.count)?ce.count:0),windowDays:Number.isInteger(ce.window_days)?ce.window_days:14,readOn:str(ce.at),competitors:Array.isArray(ce.competitors)?ce.competitors.map(record).map(c=>str(c.name)).filter(Boolean):[],postsRead:Number.isInteger(ce.posts_read)?ce.posts_read:0,engagersRead:Number.isInteger(ce.engagers_read)?ce.engagers_read:0,people:cePeople,notes:Array.isArray(ce.notes)?ce.notes.map(record).filter(n=>ceNames.has(str(n.to))&&str(n.note)).slice(0,2).map(n=>({to:str(n.to),headline:str(n.headline),note:str(n.note)})):[]}:undefined;
 const hero=parseHero(cs.hero),partnerStory=(['kyle','mattan','davorin'] as const).find(v=>v===record(cs.partner).story);
 // A hero that is present but fails the checks: no claim from it is printed, only the plainest first screen.
 const heroRejected=!hero&&cs.hero!==undefined&&cs.hero!==null?rejectedHero(profileAudit):undefined;
 return {slug:row.company_slug,ogImage:https(cs.og_image_url),domain:str(row.domain),founder:{name,firstName:(str(founder.first_name)&&!isTitle(str(founder.first_name))?str(founder.first_name):'')||firstNameOf(name),company:str(row.company_name),headline:str(founder.headline),avatarUrl:https(founder.avatar_url)},audience,pillars:cs.pillars&&record(cs.pillars),diagnosis:cs.story_diagnosis&&record(cs.story_diagnosis),thesis:str(cs.thesis),buyer:{role:str(segments[0]?.label),project:str(segments[0]?.note)||str(icp.icp_line)},samples:{...samples,posts,lm:{...lm,brand:{...brand,font_heading:str(brand.font_heading)}}},lm_cover_local:https(lm.cover_url)||'',source:{kind:'original-scan',url:`https://inboundonsteroids.com/scan/${encodeURIComponent(row.company_slug)}/`,capturedOn:date,quotes:Array.isArray(cs.story_evidence?.quotes)?cs.story_evidence.quotes.filter((q:unknown)=>typeof q==='string'):[]},...(profileAudit?{profileAudit}:{}),...(competitorEngagers?{competitorEngagers}:{}),...(hero?{hero}:{}),...(heroRejected?{heroRejected}:{}),firm:parseFirm(cs.firm),...(partnerStory?{partnerStory}:{})} as JourneyFixture;
}
