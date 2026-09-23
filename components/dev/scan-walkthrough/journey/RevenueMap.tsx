import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';
import { FileText, Eye, MessageCircle, UserSearch, Mail, Check, CalendarDays, Pause, Play } from 'lucide-react';
import {useStory} from '../../../scan/story/context';
import type { StoryKind } from './connectedModel';

const routes = [
  {id:'content', title:'Content & lead magnets', hint:'They ask for your resource.', Icon:FileText},
  {id:'signals', title:'Warm outreach', hint:'A profile visit or a relevant comment.', Icon:Eye},
  {id:'cold', title:'Signal-based cold outreach', hint:'A new project at a company that fits.', Icon:UserSearch},
];
const connections = [['content','conversation'],['signals','conversation'],['cold','conversation'],['conversation','qualification'],['qualification','booked'],['conversation','nurture'],['nurture','qualification']];

export function RevenueMap({kind,founder}:{kind:StoryKind;founder:string}) {
 const plan=useStory();
 const ref=useRef<HTMLDivElement>(null), svg=useRef<SVGSVGElement>(null);
 const visible=useInView(ref,{amount:.15});
 const reduced=useReducedMotion();
 const [paused,setPaused]=useState(false), [route,setRoute]=useState(0), [step,setStep]=useState(0);
 const currentStep=useRef(0);
 const [paths,setPaths]=useState<{from:string;to:string;d:string}[]>([]);
 const running=visible&&!reduced&&!paused;
 useEffect(()=>{if(!running)return;const id=window.setInterval(()=>{currentStep.current=(currentStep.current+1)%4;setStep(currentStep.current);if(currentStep.current===0)setRoute(v=>(v+1)%3);},2500);return()=>clearInterval(id)},[running]);
 useEffect(()=>{if(running)svg.current?.unpauseAnimations();else svg.current?.pauseAnimations()},[running,paths]);
 useLayoutEffect(()=>{
  const root=ref.current;if(!root)return;
  const update=()=>{const base=root.getBoundingClientRect(),mobile=window.matchMedia('(max-width:900px)').matches;
   setPaths(connections.map(([from,to])=>{const a=root.querySelector<HTMLElement>(`[data-flow="${from}"]`)!.getBoundingClientRect(),b=root.querySelector<HTMLElement>(`[data-flow="${to}"]`)!.getBoundingClientRect();
    let d:string;
    if(mobile){const sx=a.left+a.width/2-base.left,sy=a.bottom-base.top,ex=b.left+b.width/2-base.left,ey=b.top-base.top;const rail=base.width-11;
     if(from==='nurture'||from==='conversation'&&to==='qualification'){d=`M ${a.right-base.left} ${a.top+a.height/2-base.top} H ${rail} V ${b.top+b.height/2-base.top} H ${b.right-base.left}`}
     else if(routes.some(r=>r.id===from)){const rail=8;d=`M ${a.left-base.left} ${a.top+a.height/2-base.top} H ${rail} V ${b.top+b.height*.35-base.top} H ${b.left-base.left}`}
     else d=`M ${sx} ${sy} C ${sx} ${sy+20},${ex} ${ey-20},${ex} ${ey}`;
    }else{const sameColumn=Math.abs(a.left-b.left)<10;
     if(sameColumn){const sx=a.left+a.width/2-base.left,sy=a.bottom-base.top,ex=b.left+b.width/2-base.left,ey=b.top-base.top;d=`M ${sx} ${sy} L ${ex} ${ey}`}
     else{const sx=a.right-base.left,sy=a.top+a.height/2-base.top,ex=b.left-base.left,ey=b.top+b.height/2-base.top,mx=(sx+ex)/2;d=`M ${sx} ${sy} C ${mx} ${sy},${mx} ${ey},${ex} ${ey}`}
    }return{from,to,d};}));};
  const ro=new ResizeObserver(update);ro.observe(root);root.querySelectorAll('[data-flow]').forEach(e=>ro.observe(e));update();return()=>ro.disconnect();
 },[]);
 const source=routes[route];
 const shownStep=reduced?3:step;
 const messages=plan.flow.messages;
 return <div className={`lead-flow ${running?'is-running':''}`}>
  <header className="flow-toolbar"><span><i/>An example lead, from first interest to a call</span>{!reduced&&<button onClick={()=>setPaused(v=>!v)} aria-label={paused?'Play the lead journey':'Pause the lead journey'}>{paused?<Play size={15}/>:<Pause size={15}/>} {paused?'Play':'Pause'}</button>}</header>
  <div className="flow-board" ref={ref}>
   <svg ref={svg} className="flow-wires" aria-hidden="true"><defs><marker id="flow-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="#c1bbb1"/></marker></defs>{paths.map((p,i)=><g key={p.from+p.to}><path className="flow-wire" data-from={p.from} data-to={p.to} d={p.d} markerEnd="url(#flow-arrow)"/>{!reduced&&<>{p.from===source.id||p.from==='conversation'&&p.to==='qualification'||p.from==='qualification'?<g className="flow-traveller"><circle r="12" className="flow-lead-token"/><text className="flow-lead-letter">A</text><animateMotion dur={`${4+i*.3}s`} begin="0s" repeatCount="indefinite" path={p.d}/></g>:<circle r="4" className="flow-traveller"><animateMotion dur={`${4+i*.3}s`} begin="0s" repeatCount="indefinite" path={p.d}/></circle>}</>}</g>)}</svg>
   <div className="flow-sources"><h3>Meet the right people.</h3>{routes.map(({id,title,hint,Icon},i)=><button className={`flow-source ${route===i?'is-chosen':''}`} data-flow={id} key={id} aria-pressed={route===i} onClick={()=>{setRoute(i);setStep(0);currentStep.current=0}}><Icon size={21}/><b>{title}</b><p>{hint}</p>{id==='content'?<div className="mini-posts" aria-hidden="true"><span>in</span><i/><i/><i/><em>{`Comment ${plan.keyword}`}</em><small>Resource → email opt-in</small></div>:id==='signals'?<div className="signal-notice"><span>A</span><small>{`${plan.buyerRole} viewed your profile`}</small></div>:<div className="project-signal"><i/>{plan.flow.signal}</div>}</button>)}</div>
   <div className="flow-middle"><h3>Keep it going.</h3><div className="flow-conversation" data-flow="conversation"><header><span className="flow-avatar">A</span><div><b>Alex</b><small>{plan.buyerRole}</small></div><MessageCircle size={18}/></header><span className="flow-source-tag">{source.title}</span><div className="flow-chat-bubble" key={`${route}-${step}`}>{messages[shownStep]}</div><div className="flow-response"><span>We handle the reply</span><div className="typing-dots" aria-hidden="true"><i/><i/><i/></div></div></div><div className="flow-nurture" data-flow="nurture"><Mail size={22}/><b>Newsletter</b><p>With their email opt-in, useful notes keep the conversation open.</p><small>The subscriber list stays yours.</small><span>A reply brings them back ↑</span></div></div>
   <div className="flow-destination"><h3>Book a qualified call.</h3><div className="flow-qualification" data-flow="qualification"><b>Check the project fits.</b>{plan.flow.checks.map(({label:v,value},i)=><div key={v} className={shownStep>=i?'is-checked':''}><Check size={17}/><span>{v}{shownStep>=i&&<b>{value}</b>}</span></div>)}<small>Suggest a call when there’s a fit.</small></div><div className={`flow-booking ${shownStep===3?'is-booked':''}`} data-flow="booked"><CalendarDays size={27}/><div className="flow-calendar-days" aria-hidden="true">{['M','T','W','T','F'].map((v,i)=><i key={i}>{v}</i>)}</div><span>{shownStep===3?'In your calendar':'Once the project fits'}</span><b>{plan.flow.callTitle}</b><p>Alex + {founder}</p><div><Check size={16}/>{shownStep===3?'Brief attached':'Project details arrive with the call'}</div><p className="handoff-detail">{shownStep===3?plan.flow.brief:'The conversation becomes your call brief.'}</p></div></div>
  </div>
  <p className="flow-footnote">We run the posts, outreach and follow-up. Every call comes with the conversation and project details.</p>
 </div>;
}
