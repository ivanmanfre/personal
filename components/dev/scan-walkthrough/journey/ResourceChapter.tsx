import React, { useState } from 'react';
import { Reveal } from './ReadingChapter';
import { asset, type JourneyFixture } from './model';

export function ResourceChapter({ fixture }: {fixture: JourneyFixture}) {
  const lm = fixture.samples.lm!;
  const inside = lm.whats_inside || [];
  const [coverFailed,setCoverFailed] = useState(false);
  return <>
    <Reveal className="lm-figure" aria-label="Lead magnet sample">
      <div className="lm-cover" data-mockup="prospect">{coverFailed ? <span className="lm-cover-fallback"><b>{lm.title}</b><small>{fixture.founder.name} · {fixture.founder.company}</small></span> : <img src={/^https?:/.test(fixture.lm_cover_local) ? fixture.lm_cover_local : asset(fixture.lm_cover_local)} alt={`${lm.title}, cover in ${fixture.founder.company}’s brand`} loading="lazy" onError={() => setCoverFailed(true)}/>}<span className="sample-stamp">Cover · your brand</span></div>
      <div className="lm-body">
        <span className="journey-eyebrow">Your lead magnet</span>
        <h3>{lm.title}</h3>
        <p className="lm-promise">{lm.promise}</p>
        <ol className="lm-inside" aria-label="What’s inside">{inside.map((line,i) => <li key={line}><span aria-hidden="true">{String(i+1).padStart(2,'0')}</span>{line}</li>)}</ol>
        <p className="lm-gate"><span aria-hidden="true">■</span> Gated on {fixture.domain} · names every reader onto a list you own</p>
      </div>
    </Reveal>
    <div className="journey-handoff"><Reveal className="handoff-intro"><span className="journey-eyebrow">What lands in your inbox</span><h3>A name, and the post<br/>that brought it.</h3><p>Alex takes it. This is what you see, before you write a word.</p></Reveal>
      <Reveal className="lead-card" aria-label="Example lead record"><div className="lead-card-head"><span className="sample-stamp">New lead · example</span><span className="lead-time">just now</span></div><div className="demo-person"><span className="demo-avatar" aria-hidden="true">A</span><div><b>Alex</b><span>{fixture.buyer.role} · alex@example.com</span></div></div>
        <dl><div><dt>Came in through</dt><dd data-testid="record-context">LinkedIn → {lm.title}</dd></div><div><dt>Post they read first</dt><dd>{fixture.samples.posts?.[0]?.hook}</dd></div><div><dt>Next</dt><dd>Day 1 message goes out automatically. Day 4 and day 10 follow if Alex stays quiet.</dd></div></dl></Reveal>
    </div>
  </>;
}
