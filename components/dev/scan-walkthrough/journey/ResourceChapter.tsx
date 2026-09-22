import React, { useState } from 'react';
import { Reveal } from './ReadingChapter';
import { asset, type JourneyFixture } from './model';

export function ResourceChapter({ fixture }: {fixture: JourneyFixture}) {
  const lm = fixture.samples.lm!;
  const inside = lm.whats_inside || [];
  const [coverFailed,setCoverFailed] = useState(false);
  return <>
    <Reveal className="lm-figure" aria-label="Lead magnet">
      <div className="lm-cover" data-mockup="prospect">{coverFailed ? <span className="lm-cover-fallback"><b>{lm.title}</b><small>{fixture.founder.name} · {fixture.founder.company}</small></span> : <img src={/^https?:/.test(fixture.lm_cover_local) ? fixture.lm_cover_local : asset(fixture.lm_cover_local)} alt={`${lm.title}, cover in ${fixture.founder.company}’s brand`} loading="lazy" onError={() => setCoverFailed(true)}/>}</div>
      <div className="lm-body">
        <h3>{lm.title}</h3>
        <p className="lm-promise">{lm.promise}</p>
        <ol className="lm-inside" aria-label="What’s inside">{inside.map((line,i) => <li key={line}><span aria-hidden="true">{String(i+1).padStart(2,'0')}</span>{line}</li>)}</ol>
        <p className="lm-gate"><span aria-hidden="true">■</span> Gated on {fixture.domain} · every reader lands on your list</p>
      </div>
    </Reveal>
    <Reveal className="lead-card" aria-label="Lead record"><div className="lead-card-head"><span className="sample-stamp">New lead</span><span className="lead-time">just now</span></div><div className="demo-person"><span className="demo-avatar" aria-hidden="true">A</span><div><b>Alex</b><span>{fixture.buyer.role} · alex@example.com</span></div></div>
      <dl><div><dt>Came in through</dt><dd data-testid="record-context">LinkedIn → {lm.title}</dd></div><div><dt>Post they read first</dt><dd>{fixture.samples.posts?.[0]?.hook}</dd></div><div><dt>Next</dt><dd>Day 1 message goes out. Day {fixture.samples.follow_ups?.[1]?.day} and day {fixture.samples.follow_ups?.[2]?.day} follow if Alex stays quiet.</dd></div></dl></Reveal>
  </>;
}
