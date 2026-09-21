import React, { useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { checklistDownload, purposes, type JourneyAction, type JourneyFixture, type JourneyState, type ResearchPurpose } from './model';

export function ResourceChapter({ fixture, state, dispatch }: {fixture: JourneyFixture; state: JourneyState; dispatch: React.Dispatch<JourneyAction>}) {
  const carousel = fixture.samples.posts?.find(p => p.slides?.length || p.image_urls?.length);
  const slides = carousel?.slides || [];
  const count = Math.max(slides.length, carousel?.image_urls?.length || 0);
  const [slide,setSlide] = useState(0);
  const [failed,setFailed] = useState(false);
  const touch = useRef<{x:number;y:number}|null>(null);
  const reduced = useReducedMotion();
  const current = slides[slide];
  const lm = fixture.samples.lm!;
  const questions = lm.whats_inside || [];
  const firstUnchecked = questions.findIndex((_,i) => !state.checked.includes(i));
  function move(amount: number) { setSlide(i => Math.min(count - 1, Math.max(0,i + amount)));setFailed(false); }
  function download() { const url = URL.createObjectURL(new Blob([checklistDownload(state,questions)],{type:'text/html'})); const a=document.createElement('a');a.href=url;a.download='cuevu-story-checklist.html';a.click();setTimeout(() => URL.revokeObjectURL(url),1000); }
  return <>
    <div className="sample-caption"><span className="journey-eyebrow">Your carousel</span><p>A useful idea they can swipe through.</p></div>
    <div className="journey-deck" aria-label="Carousel sample" tabIndex={0} onKeyDown={e => { if(e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault();move(e.key === 'ArrowRight'?1:-1); } }} onTouchStart={e => {touch.current={x:e.touches[0].clientX,y:e.touches[0].clientY};}} onTouchEnd={e => {if(!touch.current)return;const dx=e.changedTouches[0].clientX-touch.current.x,dy=e.changedTouches[0].clientY-touch.current.y;if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5)move(dx<0?1:-1);touch.current=null;}}>
      <motion.article key={slide} className={`journey-slide slide-${current?.role || 'point'}`} data-mockup="cuevu" initial={reduced ? false : {opacity:.5,x:12}} animate={{opacity:1,x:0}} transition={{duration:reduced?0:.3,ease:[.22,.84,.36,1]}}>
        {carousel?.image_urls?.[slide] && !failed ? <img src={carousel.image_urls[slide]} alt={current?.heading || `Original carousel slide ${slide+1}`} onError={() => setFailed(true)}/> : <><div className="slide-top"><b>CueVu</b><span>{current?.kicker || 'Customer stories'}</span></div><span className="slide-ornament" aria-hidden="true">{slide === 0 ? '“' : String(slide+1).padStart(2,'0')}</span><div className="slide-copy"><h3>{current?.heading || 'Slide image unavailable'}</h3><p className="sample-body">{current?.body || 'Open the original scan to view this asset.'}</p></div><div className="slide-bottom"><span>Andrew Hayes</span><span>{String(slide+1).padStart(2,'0')} / {String(count).padStart(2,'0')}</span></div></>}
      </motion.article>
    </div>
    {carousel?.image_urls?.[slide] && current && <div className="slide-transcript"><h3>{current.heading}</h3><p className="sample-body">{current.body}</p></div>}
    <div className="carousel-controls"><button aria-label="Previous slide" disabled={slide === 0} onClick={() => move(-1)}>←</button><span aria-live="polite">Slide {slide+1} of {count}</span><button aria-label="Next slide" disabled={slide === count-1} onClick={() => move(1)}>→</button></div>
    <div className="journey-bridge"><span aria-hidden="true">↓</span><p>The carousel finds the story.<br/><strong>The checklist helps write it.</strong></p></div>
    <article className="journey-resource" data-mockup="cuevu">
      <div className="resource-masthead"><b>CueVu</b><span>Interactive preview</span></div>
      <div className="resource-intro"><span className="journey-eyebrow">Your lead magnet</span><h3>The 99-1<br/>Story Checklist<span aria-hidden="true">.</span></h3><p>7 questions before you hit publish.</p><p className="source-note">Original questions. New interactive presentation.</p></div>
      <div className="resource-fields"><label>Example category<select value={state.category} onChange={e => dispatch({type:'category',value:e.target.value})}><option>Coffee</option><option>Skincare</option><option>Software</option></select></label><label>What you’re writing<select value={state.purpose} onChange={e => dispatch({type:'purpose',value:e.target.value as ResearchPurpose})}>{Object.entries(purposes).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
      <div className="checklist-result" role="status"><div><strong>{state.checked.length}<span>/{questions.length}</span></strong><span>questions checked</span></div><p>{firstUnchecked === -1 ? 'All seven checked. Read your draft aloud once more.' : `Try question ${firstUnchecked+1} next.`}</p></div>
      <div className="journey-questions">{questions.map((q,i) => <label key={q} className={state.checked.includes(i)?'is-checked':''}><input type="checkbox" checked={state.checked.includes(i)} onChange={() => dispatch({type:'check',index:i})}/><span className="question-number" aria-hidden="true">{String(i+1).padStart(2,'0')}</span><span>{q}</span></label>)}</div>
      <div className="resource-download"><button className="journey-button ink" onClick={download}>Download this checklist <span aria-hidden="true">↓</span></button><p className="source-note">Saves your choices. No email needed in this preview.</p></div>
    </article>
    <div className="journey-handoff"><div className="handoff-intro"><span className="journey-eyebrow">From a reader to a name</span><h3>Now there’s a reason<br/>to follow up.</h3><p>When someone asks for the resource, you know what brought them here.</p></div>
      <div className="request-demo"><span className="sample-stamp">Example contact · demo only</span><div className="demo-person"><span className="demo-avatar" aria-hidden="true">A</span><div><b>Alex</b><span>alex@example.com</span></div></div><dl><div><dt>Found you through</dt><dd>LinkedIn → story checklist</dd></div><div><dt>Interested in</dt><dd data-testid="record-context">{state.category} · {purposes[state.purpose]}</dd></div></dl><button className="journey-button ink" disabled={state.requested} onClick={() => dispatch({type:'request'})}>{state.requested ? '✓ Example request recorded' : 'Show the example request'}<span aria-hidden="true">↗</span></button><p className="source-note" aria-live="polite">{state.requested ? 'Alex’s interest is now attached to this example contact. No message was sent.' : 'Try it here. Nothing is sent or saved online.'}</p></div>
    </div>
  </>;
}
