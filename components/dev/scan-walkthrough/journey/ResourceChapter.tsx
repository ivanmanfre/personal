import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { tierOf, tierScores, type JourneyAction, type JourneyFixture, type JourneyState } from './model';

export function ResourceChapter({ fixture, state, dispatch }: {fixture: JourneyFixture; state: JourneyState; dispatch: React.Dispatch<JourneyAction>}) {
  const carousel = fixture.samples.posts?.find(p => p.slides?.length || p.image_urls?.length);
  const slides = carousel?.slides || [];
  const count = Math.max(slides.length, carousel?.image_urls?.length || 0);
  const [slide,setSlide] = useState(0);
  const [failed,setFailed] = useState(false);
  const touch = useRef<{x:number;y:number}|null>(null);
  const reduced = useReducedMotion();
  const current = slides[slide];
  const assessment = fixture.assessment;
  const tier = tierOf(state);
  const [live,setLive] = useState(false);
  const [mobile,setMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [imageFailed,setImageFailed] = useState(false);
  useEffect(() => { const query = window.matchMedia('(max-width: 767px)'); const update = () => {setMobile(query.matches); if(query.matches) setLive(false);}; query.addEventListener('change',update); return () => query.removeEventListener('change',update); }, []);
  function move(amount: number) { setSlide(i => Math.min(count - 1, Math.max(0,i + amount)));setFailed(false); }
  return <>
    <div className="sample-caption"><span className="journey-eyebrow">Your carousel</span><p>A useful idea they can swipe through.</p></div>
    <div className="journey-deck" aria-label="Carousel sample" tabIndex={0} onKeyDown={e => { if(e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault();move(e.key === 'ArrowRight'?1:-1); } }} onTouchStart={e => {touch.current={x:e.touches[0].clientX,y:e.touches[0].clientY};}} onTouchEnd={e => {if(!touch.current)return;const dx=e.changedTouches[0].clientX-touch.current.x,dy=e.changedTouches[0].clientY-touch.current.y;if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5)move(dx<0?1:-1);touch.current=null;}}>
      <motion.article key={slide} className={`journey-slide slide-${current?.role || 'point'}`} data-mockup="cuevu" initial={reduced ? false : {opacity:.5,x:12}} animate={{opacity:1,x:0}} transition={{duration:reduced?0:.3,ease:[.22,.84,.36,1]}}>
        {carousel?.image_urls?.[slide] && !failed ? <img src={carousel.image_urls[slide]} alt={current?.heading || `Original carousel slide ${slide+1}`} onError={() => setFailed(true)}/> : <><div className="slide-top"><b>CueVu</b><span>{current?.kicker || 'Customer stories'}</span></div><span className="slide-ornament" aria-hidden="true">{slide === 0 ? '“' : String(slide+1).padStart(2,'0')}</span><div className="slide-copy"><h3>{current?.heading || 'Slide image unavailable'}</h3><p className="sample-body">{current?.body || 'Open the original scan to view this asset.'}</p></div><div className="slide-bottom"><span>Andrew Hayes</span><span>{String(slide+1).padStart(2,'0')} / {String(count).padStart(2,'0')}</span></div></>}
      </motion.article>
    </div>
    {carousel?.image_urls?.[slide] && current && <div className="slide-transcript"><h3>{current.heading}</h3><p className="sample-body">{current.body}</p></div>}
    <div className="carousel-controls"><button aria-label="Previous slide" disabled={slide === 0} onClick={() => move(-1)}>←</button><span aria-live="polite">Slide {slide+1} of {count}</span><button aria-label="Next slide" disabled={slide === count-1} onClick={() => move(1)}>→</button></div>
    <div className="journey-bridge"><span aria-hidden="true">↓</span><p>The carousel finds the story.<br/><strong>The score shows them where they stand.</strong></p></div>
    <section className="journey-resource" aria-labelledby="resource-title">
      <div className="resource-intro"><span className="journey-eyebrow">Your lead magnet · published</span><h3 id="resource-title">{assessment.title}<span aria-hidden="true">.</span></h3><p>{assessment.subtitle}</p></div>
      <dl className="resource-facts"><div><dt>Questions</dt><dd>{assessment.questions}</dd></div><div><dt>Time</dt><dd>{assessment.minutes} min</dd></div><div><dt>Sections</dt><dd>{assessment.sections.length}</dd></div><div><dt>Result</dt><dd>Score and tier</dd></div></dl>
      <div className={`sg-real-browser resource-browser${live ? ' is-live' : ''}`} data-mockup="browser">
        <div className="sg-browser-bar"><span className="sg-browser-dots" aria-hidden="true"><i/><i/><i/></span><span>resources.ivanmanfredi.com/andrew-hayes-94-assessment</span><a href={assessment.url} target="_blank" rel="noreferrer" aria-label="Open the assessment in a new tab">↗</a></div>
        <div className={`sg-real-browser-viewport${live ? ' is-live' : ''}`}>
          {live && !mobile ? <iframe src={assessment.url} title={`Live ${assessment.title}`} sandbox="allow-scripts allow-same-origin allow-forms allow-popups"/> : imageFailed ? <a className="tool-image-fallback" href={assessment.url} target="_blank" rel="noreferrer">Preview image unavailable. Open the assessment ↗</a> : <a href={assessment.url} target="_blank" rel="noreferrer" aria-label={`Open ${assessment.title}`}><img src={mobile ? assessment.imageMobile : assessment.image} alt={`The published ${assessment.title} page for CueVu`} loading="lazy" onError={() => setImageFailed(true)}/></a>}
        </div>
      </div>
      <div className="resource-actions">{mobile ? <a className="journey-button ink" href={assessment.url} target="_blank" rel="noreferrer">Open the live assessment <span aria-hidden="true">↗</span></a> : <button className="journey-button ink" onClick={() => setLive(v => !v)}>{live ? 'Back to the preview' : 'Try the live assessment'} <span aria-hidden="true">{live ? '↑' : '↗'}</span></button>}<p className="source-note">Real page, real questions. Answers stay on that page; the score and tier are free, the email unlocks the breakdown.</p></div>
      <ol className="resource-sections" aria-label="Assessment sections">{assessment.sections.map((name,i) => <li key={name}><span aria-hidden="true">{String(i+1).padStart(2,'0')}</span>{name}</li>)}</ol>
      <p className="source-note">Live page, captured {assessment.capturedOn}. The written sample in your scan called it The 99-1 Story Checklist; this scored assessment is the version we publish.</p>
    </section>
    <div className="journey-handoff"><div className="handoff-intro"><span className="journey-eyebrow">From a reader to a name</span><h3>Now there’s a reason<br/>to follow up.</h3><p>When someone finishes the score, you know their result before you write a word.</p></div>
      <div className="request-demo"><span className="sample-stamp">Example lead · demo only</span><div className="demo-person"><span className="demo-avatar" aria-hidden="true">A</span><div><b>Alex</b><span>{fixture.buyer.role} · alex@example.com</span></div></div>
        <fieldset className="tier-picker"><legend>Pick Alex’s example result</legend>{assessment.tiers.map(t => <label key={t.id} className={state.tier === t.id ? 'is-selected' : ''}><input type="radio" name="tier" value={t.id} checked={state.tier === t.id} onChange={() => dispatch({type:'tier',value:t.id})}/><b>{tierScores[t.id]}</b><span>{t.name}</span></label>)}</fieldset>
        <dl><div><dt>Found you through</dt><dd>LinkedIn → {assessment.title}</dd></div><div><dt>Result</dt><dd data-testid="record-context">{tierScores[state.tier]} / 100 · {tier.name}</dd></div><div><dt>What the page told them</dt><dd>{tier.headline}</dd></div></dl>
        <button className="journey-button ink" disabled={state.requested} onClick={() => dispatch({type:'request'})}>{state.requested ? '✓ Example lead recorded' : 'Show the example lead'}<span aria-hidden="true">↗</span></button><p className="source-note" aria-live="polite">{state.requested ? 'Alex’s result is now attached to this example contact. No message was sent.' : 'Try it here. Nothing is sent or saved online.'}</p></div>
    </div>
  </>;
}
