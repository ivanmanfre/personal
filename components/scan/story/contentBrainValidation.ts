import type {ContentBrainMap} from './types';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown,max:number):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
/** Optional artwork fails closed without blocking a reviewed story. */
export function validateContentBrainMap(raw:unknown):ContentBrainMap|null {
 if(!object(raw)||raw.version!==1||!text(raw.sourceFingerprint,256)||!Array.isArray(raw.nodes)||!raw.nodes.length||raw.nodes.length>120||!Array.isArray(raw.edges)||raw.edges.length>400||!Array.isArray(raw.sources)||!raw.sources.length||raw.sources.length>120)return null;
 const sources=new Set<string>();
 for(const s of raw.sources){
  if(!object(s)||!text(s.id,120)||sources.has(s.id)||!text(s.label,200)||!['LinkedIn','Website','Blog','YouTube'].includes(s.kind as string))return null;
  if(s.url!==undefined){if(!text(s.url,2048))return null;try{const url=new URL(s.url);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)return null}catch{return null}}
  sources.add(s.id);
 }
 const provenance=(v:unknown)=>Array.isArray(v)&&v.length>0&&v.length<=sources.size&&new Set(v).size===v.length&&v.every(id=>typeof id==='string'&&sources.has(id));
 const nodes=new Map<string,Record<string,unknown>>();
 for(const n of raw.nodes){
  if(!object(n)||!text(n.id,120)||nodes.has(n.id)||!text(n.label,200)||!text(n.group,120)||!['cluster','topic','source'].includes(n.kind as string)||typeof n.x!=='number'||!Number.isFinite(n.x)||typeof n.y!=='number'||!Number.isFinite(n.y)||Math.abs(n.x)>1e6||Math.abs(n.y)>1e6||!provenance(n.sourceIds))return null;
  nodes.set(n.id,n);
 }
 for(const n of nodes.values())if(nodes.get(n.group as string)?.kind!=='cluster'||(n.kind==='cluster'&&n.group!==n.id))return null;
 for(const e of raw.edges)if(!object(e)||typeof e.a!=='string'||typeof e.b!=='string'||e.a===e.b||!nodes.has(e.a)||!nodes.has(e.b)||!['group','evidence','shared-source'].includes(e.kind as string)||!provenance(e.sourceIds))return null;
 return raw as unknown as ContentBrainMap;
}
