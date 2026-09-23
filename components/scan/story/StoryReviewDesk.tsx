import React,{useEffect,useRef,useState} from 'react';
import {supabase} from '../../../lib/supabase';
import DashboardAuth from '../../dashboard/DashboardAuth';
import ScanStoryReport from './ScanStoryReport';
import {toStoryFixture,type StoryScanRow} from './adapter';
import {validateEdition} from './validate';
import type {StoryEdition} from './types';
import './review-desk.css';

type Revision={id:string;scan_slug:string;revision:number;status:'generating'|'needs_review'|'failed'|'approved';created_at:string;feedback:string;source:{scan:StoryScanRow;corpus:string;website:{url:string;text:string};brand_status:string};edition:StoryEdition|null;review:{checked?:boolean;blockers?:string[];warnings?:string[]}};
const endpoint=import.meta.env.DEV?'/scan-stories':`${import.meta.env.VITE_SCAN_REVIEW_API||'https://claude-code-railway-production.up.railway.app'}/scan-stories`;
const editFields=[['post','Image post'],['plainPost','Text post'],['slides','Slides'],['magnetPost','Lead magnet post'],['resource','Lead magnet'],['email','Newsletter'],['message','Warm message'],['next','Follow-up'],['coldMessage','Cold message'],['flow','Full journey'],['all','Complete edition']] as const;

export default function StoryReviewDesk(){
 const slug=new URLSearchParams(location.search).get('slug')||'';
 const [rows,setRows]=useState<Revision[]>([]),[selected,setSelected]=useState(''),[feedback,setFeedback]=useState(''),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[error,setError]=useState(''),[login,setLogin]=useState(false),[ack,setAck]=useState(false),[override,setOverride]=useState(false),[editKey,setEditKey]=useState('post'),[editText,setEditText]=useState(''),[editing,setEditing]=useState(false),[notice,setNotice]=useState('');
 const pending=useRef<{key:string;signature:string}|null>(null),mounted=useRef(true);
 const current=rows.find(r=>r.id===selected)||rows[0],latest=rows[0];
 const stale=!!latest&&Date.now()-new Date(latest.created_at).getTime()>20*60*1000;
 const running=latest?.status==='generating'&&!stale;
 const fixture=current?toStoryFixture(current.source.scan):null;
 const checked=fixture&&current?.edition?validateEdition(current.edition,fixture):null;
 async function api(path:string,body?:unknown){
  const {data}=await supabase.auth.getSession();
  const r=await fetch(endpoint+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(data.session?{Authorization:`Bearer ${data.session.access_token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  if(r.status===401||r.status===403){setLogin(true);throw new Error('Sign in to review scans.');}
  const result=await r.json().catch(()=>({detail:'Review service is unavailable.'}));
  if(!r.ok)throw new Error(typeof result.detail==='string'?result.detail:'The review request failed.');return result;
 }
 async function refresh(){
  try{const result=await api(`/${encodeURIComponent(slug)}`);if(mounted.current){setRows(result.revisions);setLoaded(true);setError('');}}
  catch(e){if(mounted.current){setError((e as Error).message);setLoaded(true);}}
 }
 useEffect(()=>{mounted.current=true;setRows([]);setSelected('');setLoaded(false);if(slug)void refresh();return()=>{mounted.current=false};},[slug]);
 useEffect(()=>{if(!running)return;const timer=setInterval(()=>void refresh(),5000);return()=>clearInterval(timer);},[running,slug]);
 useEffect(()=>{setAck(false);setOverride(false);setEditing(false);},[current?.id]);
 async function generate(manual?:StoryEdition,refreshSources=false){
  setBusy(true);setError('');setNotice('');
  const body={parent_id:latest?.id||null,feedback,refresh_sources:refreshSources, ...(manual?{edition:manual}:{})};
  const signature=JSON.stringify(body);
  if(pending.current?.signature!==signature)pending.current={key:crypto.randomUUID(),signature};
  try{const result=await api(`/${encodeURIComponent(slug)}/generate`,{...body,request_key:pending.current.key});pending.current=null;setSelected(result.id);setEditing(false);await refresh();}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 function openEditor(key:string){setEditKey(key);const value=key==='all'?current?.edition:current?.edition?.[key as keyof StoryEdition];setEditText(typeof value==='string'?value:JSON.stringify(value,null,2));setEditing(true);}
 function saveEdit(){
  try{
   const original=current!.edition!;const isString=editKey!=='all'&&typeof original[editKey as keyof StoryEdition]==='string';
   const value=isString?editText:JSON.parse(editText);
   const edition=editKey==='all'?value:{...original,[editKey]:value};
   const result=validateEdition(edition,fixture!);if(!result.edition)throw new Error(result.errors.join(' '));
   void generate({...result.edition,reviewStatus:'draft'});
  }catch(e){setError((e as Error).message);}
 }
 async function approve(){
  setBusy(true);setError('');
  try{await api(`/${encodeURIComponent(slug)}/${current!.id}/approve`,{acknowledge_warnings:ack,override_blockers:override});await refresh();setNotice('Approved version saved to the public scan.');}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 if(login)return <DashboardAuth onSuccess={()=>{setLogin(false);void refresh();}}/>;
 return <>
  <section className="story-review-desk" aria-label="Scan review controls">
   <header><div><b>Scan review</b><span>{slug||'Choose a saved scan'}</span></div>{import.meta.env.DEV&&<a href="/dev/scan-release?slug=nerijus-danilevicius-43">Approved design reference</a>}</header>
   <form onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);location.search=`?slug=${encodeURIComponent(String(data.get('slug')||''))}`}}><label>Scan slug <input name="slug" defaultValue={slug} required pattern="[a-z0-9-]+"/></label><button type="submit">Open scan</button></form>
   {slug&&<>
    <div className="review-actions"><label>Saved revision <select aria-label="Saved revision" value={current?.id||''} onChange={e=>setSelected(e.target.value)} disabled={!rows.length}><option value="" disabled>No draft yet</option>{rows.map(r=><option key={r.id} value={r.id}>Version {r.revision} · {r.status.replace('_',' ')}</option>)}</select></label><span role="status">{!loaded?'Loading…':running?'Writing and checking the draft…':current?`Saved ${new Date(current.created_at).toLocaleString()}`:'Ready to generate from this lead’s data.'}</span></div>
    {(current?.review.blockers?.length||current?.review.warnings?.length||checked?.errors.length)?<div className="review-findings"><strong>Before this goes live</strong>{current?.review.blockers?.map((x,i)=><p key={`b${i}`}><b>Fix:</b> {x}</p>)}{current?.review.warnings?.map((x,i)=><p key={`w${i}`}>{x}</p>)}{checked?.errors.map((x,i)=><p key={`v${i}`}><b>Fix:</b> {x}</p>)}</div>:null}
    <label className="review-feedback">What should improve?<textarea value={feedback} onChange={e=>setFeedback(e.target.value)} placeholder="For example: make the resource useful for a founder preparing a launch. Keep the post and carousel." rows={3}/></label>
    <div className="review-actions"><button disabled={!loaded||busy||running} onClick={()=>void generate()}>{busy?'Working…':!latest?'Generate draft':latest.status==='failed'||latest.status==='generating'&&stale?'Retry generation':'Revise draft'}</button>{current?.edition&&<button disabled={busy||running} onClick={()=>openEditor(editKey)}>Edit content</button>}<button disabled={busy} onClick={()=>void refresh()}>Refresh status</button><button disabled={busy||running||!loaded} onClick={()=>void generate(undefined,true)}>Refresh sources</button></div>
    {editing&&<div className="review-editor"><label>Part to edit <select value={editKey} onChange={e=>openEditor(e.target.value)}>{editFields.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><textarea aria-label="Edit sample content" value={editText} onChange={e=>setEditText(e.target.value)} rows={12}/><button disabled={busy||running} onClick={saveEdit}>Save as new draft and check</button><button onClick={()=>setEditing(false)}>Cancel</button></div>}
    {current?.source&&<details><summary>Sources used</summary><p>Brand: {current.source.brand_status}. {current.source.corpus.length?`${current.source.corpus.length.toLocaleString()} characters of original post material.`:'No original posts available.'}</p>{current.source.website.url&&<a href={current.source.website.url} target="_blank" rel="noreferrer">Company website</a>}<pre>{current.source.corpus||current.source.website.text||'No source text was available.'}</pre></details>}
    {current?.edition&&<div className="review-publish">{!!current.review.blockers?.length&&<label><input type="checkbox" checked={override} onChange={e=>setOverride(e.target.checked)}/>I checked the "Fix" items and this version is right as it is.</label>}{!!current.review.warnings?.length&&<label><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/>I reviewed these evidence warnings.</label>}<button disabled={busy||running||current.id!==latest?.id||current.status!=='needs_review'||!current.review.checked||!!current.review.blockers?.length&&!override||!checked?.edition||!!current.review.warnings?.length&&!ack} onClick={()=>void approve()}>Approve and publish this version</button><small>Only this action updates the public scan. Drafts stay private.</small></div>}
   </>}
   {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice} <a href={`/scan/${encodeURIComponent(slug)}/`}>Open public scan</a></p>}
  </section>
  {fixture&&checked?.edition&&<ScanStoryReport key={current!.id} fixture={fixture} edition={checked.edition} review/>}
 </>;
}
