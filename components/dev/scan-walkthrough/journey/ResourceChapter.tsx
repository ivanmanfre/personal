import React, { useEffect, useState } from 'react';
import { Reveal } from './ReadingChapter';
import { tierOf, tierScores, type JourneyAction, type JourneyFixture, type JourneyState } from './model';

export function ResourceChapter({ fixture, state, dispatch }: {fixture: JourneyFixture; state: JourneyState; dispatch: React.Dispatch<JourneyAction>}) {
  const assessment = fixture.assessment;
  const tier = tierOf(state);
  const [live,setLive] = useState(false);
  const [mobile,setMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [imageFailed,setImageFailed] = useState(false);
  useEffect(() => { const query = window.matchMedia('(max-width: 767px)'); const update = () => {setMobile(query.matches); if(query.matches) setLive(false);}; query.addEventListener('change',update); return () => query.removeEventListener('change',update); }, []);
  return <>
    <section className="journey-resource" aria-labelledby="resource-title">
      <Reveal className="resource-intro"><span className="journey-eyebrow">Your lead magnet · published</span><h3 id="resource-title">{assessment.title}<span aria-hidden="true">.</span></h3><p>{assessment.subtitle}</p></Reveal>
      <Reveal>
        <dl className="resource-facts"><div><dt>Questions</dt><dd>{assessment.questions}</dd></div><div><dt>Time</dt><dd>{assessment.minutes} min</dd></div><div><dt>Sections</dt><dd>{assessment.sections.length}</dd></div><div><dt>Result</dt><dd>Score and tier</dd></div></dl>
        <div className={`sg-real-browser resource-browser${live ? ' is-live' : ''}`} data-mockup="browser">
          <div className="sg-browser-bar"><span className="sg-browser-dots" aria-hidden="true"><i/><i/><i/></span><span>resources.ivanmanfredi.com/andrew-hayes-94-assessment</span><a href={assessment.url} target="_blank" rel="noreferrer" aria-label="Open the assessment in a new tab">↗</a></div>
          <div className={`sg-real-browser-viewport${live ? ' is-live' : ''}`}>
            {live && !mobile ? <iframe src={assessment.url} title={`Live ${assessment.title}`} sandbox="allow-scripts allow-same-origin allow-forms allow-popups"/> : imageFailed ? <a className="tool-image-fallback" href={assessment.url} target="_blank" rel="noreferrer">Preview image unavailable. Open the assessment ↗</a> : <a href={assessment.url} target="_blank" rel="noreferrer" aria-label={`Open ${assessment.title}`}><img src={mobile ? assessment.imageMobile : assessment.image} alt={`The published ${assessment.title} page for CueVu`} loading="lazy" onError={() => setImageFailed(true)}/></a>}
          </div>
        </div>
        <div className="resource-actions">{mobile ? <a className="journey-button ink" href={assessment.url} target="_blank" rel="noreferrer">Open the live assessment <span aria-hidden="true">↗</span></a> : <button className="journey-button ink" onClick={() => setLive(v => !v)}>{live ? 'Back to the preview' : 'Try the live assessment'} <span aria-hidden="true">{live ? '↑' : '↗'}</span></button>}<p className="source-note">Real page, real questions. Answers stay on that page; the score and tier are free, the email unlocks the breakdown.</p></div>
      </Reveal>
      <Reveal><ol className="resource-sections" aria-label="Assessment sections">{assessment.sections.map((name,i) => <li key={name}><span aria-hidden="true">{String(i+1).padStart(2,'0')}</span>{name}</li>)}</ol>
      <p className="source-note">Live page, captured {assessment.capturedOn}. The written sample in your scan called it The 99-1 Story Checklist; this scored assessment is the version we publish.</p></Reveal>
    </section>
    <div className="journey-handoff"><Reveal className="handoff-intro"><span className="journey-eyebrow">From a reader to a name</span><h3>Now there’s a reason<br/>to follow up.</h3><p>When someone finishes the score, you know their result before you write a word.</p></Reveal>
      <Reveal className="request-demo"><span className="sample-stamp">Example lead · demo only</span><div className="demo-person"><span className="demo-avatar" aria-hidden="true">A</span><div><b>Alex</b><span>{fixture.buyer.role} · alex@example.com</span></div></div>
        <fieldset className="tier-picker"><legend>Pick Alex’s example result</legend>{assessment.tiers.map(t => <label key={t.id} className={state.tier === t.id ? 'is-selected' : ''}><input type="radio" name="tier" value={t.id} checked={state.tier === t.id} onChange={() => dispatch({type:'tier',value:t.id})}/><b>{tierScores[t.id]}</b><span>{t.name}</span></label>)}</fieldset>
        <dl><div><dt>Found you through</dt><dd>LinkedIn → {assessment.title}</dd></div><div><dt>Result</dt><dd data-testid="record-context">{tierScores[state.tier]} / 100 · {tier.name}</dd></div><div><dt>What the page told them</dt><dd>{tier.headline}</dd></div></dl>
        <button className="journey-button ink" disabled={state.requested} onClick={() => dispatch({type:'request'})}>{state.requested ? '✓ Example lead recorded' : 'Show the example lead'}<span aria-hidden="true">↗</span></button><p className="source-note" aria-live="polite">{state.requested ? 'Alex’s result is now attached to this example contact. No message was sent.' : 'Try it here. Nothing is sent or saved online.'}</p></Reveal>
    </div>
  </>;
}
