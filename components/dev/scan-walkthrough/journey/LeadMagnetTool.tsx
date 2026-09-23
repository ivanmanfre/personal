import React, {useState} from 'react';
import {Check,Copy,Download,ArrowUpRight} from 'lucide-react';
import type {StoryKind} from './connectedModel';
import {useStory} from '../../../scan/story/context';
import {contrastInk,logoFilter} from '../../../scan/story/brandColors';

export function LeadMagnetTool({kind}:{kind:StoryKind}) {
 const plan=useStory(),resource=plan.resource;
 const [index,setIndex]=useState(0),[covered,setCovered]=useState(false),[copied,setCopied]=useState(false),[error,setError]=useState(false),[logoFailed,setLogoFailed]=useState(false);
 const o=resource.options[index];
 const team=o.team?.map(t=>covered&&t.role===o.coveredRole?{role:`${t.role} · already booked`,job:o.coveredJob!}:t);
 const text=[o.title,'Example scope: confirm the details with your team before using it.',team&&`Team\n${team.map(t=>`${t.role}: ${t.job}`).join('\n')}`,o.deliverables&&`Deliverables\n${o.deliverables.map(x=>`${x.label}: ${x.value}`).join('\n')}`,o.review&&`First client review\n${o.review}`,o.quote&&`Ask each team to quote the same scope\n${o.quote}`,o.changes&&`Price changes separately\n${o.changes}`,o.rights&&`Usage and rights\n${o.rights}`,o.question,o.people&&`Participants: ${o.people}`,o.record&&`Record: ${o.record}`,o.recruitment&&`Recruitment question: ${o.recruitment}`,o.sections?.map(s=>`${s.heading}\n${s.body}`).join('\n\n'),resource.mode==='question'?'Results file\nParticipant reference | Event and date | Original response | Possible campaign angle | Evidence still needed\n\nKeep the complete response with its context. Ask permission before publishing their words.':resource.mode==='planner'?'Before requesting a quote\nAdd your fee range, delivery date and the people who approve the work.':'',`Planning example by ${plan.brand}.`].filter(Boolean).join('\n\n');
 async function copy(){try{await navigator.clipboard.writeText(text);setCopied(true);setError(false)}catch{setError(true)}}
 function download(){const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`${plan.slug}-resource.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 return <article className={`lead-tool branded-resource tool-${kind}`} aria-label="Lead magnet sample" style={{background:resource.brand.surface,color:resource.brand.ink,fontFamily:plan.art==='creative'?undefined:'Arial, sans-serif','--resource-accent':resource.brand.accent,'--resource-accent-ink':contrastInk(resource.brand.accent)} as React.CSSProperties}>
  <header className="resource-brandbar">{resource.brand.logo&&!logoFailed?<img src={resource.brand.logo} style={{filter:logoFilter(resource.brand.logo,resource.brand.surface)}} alt={plan.brand} onError={()=>setLogoFailed(true)}/>:<b>{plan.brand}</b>}<span>{plan.magnet}</span><ArrowUpRight size={18}/></header>
  <div className="resource-workspace"><h3>{resource.title}</h3><div className="resource-options" aria-label={resource.mode==='question'?'Research event':'Project type'}>{resource.options.map((x,i)=><button key={x.label} aria-pressed={i===index} onClick={()=>{setIndex(i);setCovered(false);setCopied(false);setError(false)}}>{x.label}</button>)}</div>
  <div className={resource.mode==='question'?'study-output':'project-output'}>
   {o.coveredRole&&<label className="existing-team"><input type="checkbox" checked={covered} onChange={e=>{setCovered(e.target.checked);setCopied(false)}}/>We already have a {o.coveredRole.toLowerCase()}.</label>}
   {team&&<div className="project-team">{team.map((t,i)=><div key={t.role}><span aria-hidden="true" className={`role-shape role-${i}`}><i/><i/><i/></span><b>{t.role}</b><p>{t.job}</p></div>)}</div>}
   {o.deliverables&&<div className="project-delivery"><span>Example scope to send with your brief</span><dl className="scope-deliverables">{o.deliverables.map(x=><div key={x.label}><dt>{x.label}</dt><dd>{x.value}</dd></div>)}</dl></div>}
   {o.review&&<div className="project-review"><b>Agree on the first review.</b><p>{o.review}</p><div aria-label="Review sequence"><span>Team develops</span><i aria-hidden="true">→</i><span>Client reviews</span><i aria-hidden="true">→</i><span>Team revises</span></div></div>}
   {o.quote&&<div className="quote-comparison"><b>Make the quotes comparable.</b><p>{o.quote}</p>{o.changes&&<p><strong>Price changes separately:</strong> {o.changes}</p>}</div>}{o.rights&&<p className="project-rights">{o.rights}</p>}
   {o.question&&<blockquote>{o.question}</blockquote>}{o.people&&<dl><div><dt>Who takes part</dt><dd>{o.people}</dd></div><div><dt>Keep with the response</dt><dd>{o.record}</dd></div></dl>}
   {o.sections?.map(s=><div className="study-file" key={s.heading}><b>{s.heading}</b><p>{s.body}</p></div>)}
  </div>
  <div className="resource-actions"><button onClick={copy}>{copied?<Check size={16}/>:<Copy size={16}/>}<span aria-live="polite">{copied?'Copied':resource.mode==='question'?'Copy study question':resource.mode==='document'?'Copy the draft':'Copy project brief'}</span></button><button onClick={download} aria-label="Download the example"><Download size={18}/></button></div>
  <small>Example scope. Adjust it to your project before sending.</small>{error&&<p role="status">Copy is unavailable here. Use the download button to save the example.</p>}
  </div>
 </article>;
}
