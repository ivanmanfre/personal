import React, { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Reveal } from './ReadingChapter';
import { scoreOf, tierOf, type JourneyAction, type JourneyFixture, type JourneyState } from './model';

/** Counts a number toward its target; immediate under reduced motion. */
function useCountUp(target: number) {
  const reduced = useReducedMotion();
  const [value,setValue] = useState(target);
  useEffect(() => {
    if (reduced) { setValue(target); return; }
    let frame = 0; const start = performance.now(); const from = value;
    const tick = (now: number) => { const t = Math.min(1,(now - start) / 650); const eased = 1 - Math.pow(1 - t,3); setValue(Math.round(from + (target - from) * eased)); if (t < 1) frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, reduced]);
  return value;
}
export function ResourceChapter({ fixture, state, dispatch }: {fixture: JourneyFixture; state: JourneyState; dispatch: React.Dispatch<JourneyAction>}) {
  const a = fixture.assessment;
  const score = scoreOf(state);
  const tier = tierOf(state);
  const shown = useCountUp(score);
  const style = { '--cv-ink': a.brand.ink, '--cv-paper': a.brand.paper, '--cv-accent': a.brand.accent, '--cv-accent-deep': a.brand.accentDeep, '--cv-heading': `'${a.brand.fontHeading}', 'Open Sans', Arial, sans-serif`, '--cv-body': `'${a.brand.fontBody}', Arial, sans-serif` } as React.CSSProperties;
  return <>
    <Reveal className="resource-intro"><span className="journey-eyebrow">Your lead magnet · live on resources.ivanmanfredi.com</span><h3 id="resource-title">{a.title}<span aria-hidden="true">.</span></h3><p>{a.subtitle}</p></Reveal>
    <Reveal>
      <div className="cv-score" data-mockup="cuevu" style={style} aria-label="Interactive preview of the published assessment">
        <header className="cv-top"><span className="cv-logo" aria-hidden="true">C</span><span className="cv-domain">cuevu.com</span><span className="cv-badge">{a.badge}</span></header>
        <div className="cv-hero"><span className="cv-kicker">Issued instrument</span><h4>{a.title}</h4><p>{a.subtitle}</p><dl className="cv-meta"><div><dd>{a.questions}</dd><dt>questions</dt></div><div><dd>{a.minutes}</dd><dt>min</dt></div><div><dd>{a.sections.length}</dd><dt>sections</dt></div></dl></div>
        <div className="cv-body">
          <div className="cv-questions">
            <p className="cv-note">Alex answers three of the {a.questions}. Change them and watch the score.</p>
            {a.questions_sample.map((q,i) => <fieldset key={i}><legend><span aria-hidden="true">{String(i+1).padStart(2,'0')}</span>{q.text}</legend>{q.answers.map(ans => <label key={ans.score} className={state.answers[i] === ans.score ? 'is-on' : ''}><input type="radio" name={`q${i}`} value={ans.score} checked={state.answers[i] === ans.score} onChange={() => dispatch({type:'answer',index:i,score:ans.score})}/><span>{ans.label}</span></label>)}</fieldset>)}
          </div>
          <aside className="cv-result" aria-live="polite">
            <span className="cv-kicker">Alex’s score</span>
            <div className="cv-number"><b data-testid="score-value">{shown}</b><span>/100</span></div>
            <div className="cv-meter" aria-hidden="true"><i style={{width:`${score}%`}}/><span className="cv-tick" style={{left:`${a.thresholds.low}%`}}/><span className="cv-tick" style={{left:`${a.thresholds.mid}%`}}/></div>
            <div className="cv-tier"><span className="cv-tier-name" data-testid="tier-name">{tier.name}</span><p>{tier.headline}</p></div>
            <div className="cv-gate"><span>{a.gate}</span><div className="cv-input" aria-hidden="true"><span>you@company.com</span><b>Unlock</b></div></div>
          </aside>
        </div>
        <footer className="cv-foot"><span>Andrew Hayes · CueVu</span><a href={a.url} target="_blank" rel="noreferrer" aria-label="Open the live assessment">Full {a.questions}-question version ↗</a></footer>
      </div>
      <p className="source-note">Built in CueVu’s colours and type from cuevu.com. Questions, tiers and thresholds are the live page’s own. Nothing typed here leaves this preview.</p>
    </Reveal>
    <div className="journey-handoff"><Reveal className="handoff-intro"><span className="journey-eyebrow">What lands in your inbox</span><h3>A name, a result,<br/>a reason to write.</h3><p>The moment Alex unlocks the breakdown, this is what you see.</p></Reveal>
      <Reveal className="lead-card" aria-label="Example lead record"><div className="lead-card-head"><span className="sample-stamp">New lead · example</span><span className="lead-time">just now</span></div><div className="demo-person"><span className="demo-avatar" aria-hidden="true">A</span><div><b>Alex</b><span>{fixture.buyer.role} · alex@example.com</span></div></div>
        <dl><div><dt>Came in through</dt><dd>LinkedIn → {a.title}</dd></div><div><dt>Result</dt><dd data-testid="record-context">{score} / 100 · {tier.name}</dd></div><div><dt>What the page told them</dt><dd>{tier.headline}</dd></div><div><dt>First suggested step</dt><dd>{tier.firstStep}</dd></div></dl></Reveal>
    </div>
  </>;
}
