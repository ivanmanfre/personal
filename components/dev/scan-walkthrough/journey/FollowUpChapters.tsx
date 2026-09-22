import React, { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';
import { Avatar, Paragraphs, Reveal } from './ReadingChapter';
import { newsletterFor, readerFor, type JourneyAction, type JourneyFixture, type JourneyState } from './model';

type Props = { fixture: JourneyFixture; state: JourneyState; dispatch: React.Dispatch<JourneyAction> };
export function NewsletterChapter({ fixture }: Props) {
  const reader = readerFor(fixture);
  const n = newsletterFor(fixture, reader.first);
  const first = fixture.founder.firstName;
  return <Reveal as="article" className="journey-email-issue" data-mockup="email" aria-label="Newsletter as an email">
    <div className="email-chrome"><span aria-hidden="true">←</span><span className="email-chrome-title">Inbox</span><span className="email-chrome-tools" aria-hidden="true"><i/><i/><i/></span></div>
    <div className="email-head">
      <h3 className="email-subject-line">{n.subject}</h3>
      <div className="email-sender"><Avatar src={fixture.founder.avatarUrl} name={fixture.founder.name}/><div className="email-sender-meta"><b>{fixture.founder.name} <small>&lt;{first.toLowerCase()}@{fixture.domain}&gt;</small></b><span>to {reader.first}</span></div><span className="email-time">Tue, 9:14 AM</span></div>
    </div>
    <div className="email-body">
      <div className="issue-masthead" data-mockup="prospect"><b>{fixture.founder.company}</b><span>{n.issue}</span></div>
      <p className="issue-intro sample-body">{n.intro}</p>
      <h4>{n.section.h}</h4>
      <Paragraphs text={n.section.body} className="newsletter-body sample-body"/>
      <p className="newsletter-cta sample-body">{n.cta}</p>
      <div className="email-signature"><span>{first}<br/><small>{fixture.founder.company} · {fixture.domain}</small></span></div>
    </div>
    <div className="email-footer"><span>You’re getting this because you pulled {fixture.samples.lm?.title?.split(':')[0]}.</span><span>Unsubscribe · {fixture.founder.company}</span></div>
  </Reveal>;
}
/** Plays a thread in: typing dots, then each message, in order. Settled at once under reduced motion. */
function useThreadPlayback(count: number, step = 900) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: .25 });
  const reduced = useReducedMotion();
  const [shown,setShown] = useState(reduced ? count : 0);
  useEffect(() => { if (reduced) { setShown(count); return; } if (!inView) return; let i = 0; const timer = setInterval(() => { i += 1; setShown(i); if (i >= count) clearInterval(timer); }, step); return () => clearInterval(timer); }, [inView, reduced, count, step]);
  return { ref, shown, settled: shown >= count, typing: inView && shown < count };
}
function dateLabel(offsetDays: number) { const d = new Date(); d.setDate(d.getDate() - 12 + offsetDays); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
function Msg({ fixture, time, text }: { fixture: JourneyFixture; time: string; text: string }) {
  return <div className="li-msg"><Avatar src={fixture.founder.avatarUrl} name={fixture.founder.name}/><div><div className="li-msg-meta"><b>{fixture.founder.name}</b><span>{time}</span></div><Paragraphs text={text} className="li-msg-text sample-body"/></div></div>;
}
function Thread({ fixture, withName, withHeadline, withInitials, items, playback }: { fixture: JourneyFixture; withName: string; withHeadline: string; withInitials: string; items: { date: string; time: string; text: string }[]; playback: ReturnType<typeof useThreadPlayback> }) {
  return <article ref={playback.ref} className={`li-thread${playback.settled ? ' is-settled' : ''}`} data-mockup="linkedin" aria-label={`Messages with ${withName}`}>
    <div className="li-thread-head"><span className="demo-avatar" aria-hidden="true">{withInitials}</span><div><b>{withName}</b><small>{withHeadline}</small></div><span className="li-thread-tools" aria-hidden="true"><i/><i/></span></div>
    <div className="li-thread-body">
      {items.slice(0, playback.shown).map((m,i) => <React.Fragment key={i}>{(i === 0 || items[i-1].date !== m.date) && <div className="li-msg-date"><span>{m.date}</span></div>}<Msg fixture={fixture} time={m.time} text={m.text}/></React.Fragment>)}
      {playback.typing && <div className="thread-typing" aria-label="Typing"><i/><i/><i/></div>}
    </div>
    <div className="li-composer" aria-hidden="true"><span>Write a message…</span><i>Send</i></div>
  </article>;
}
export function ConversationChapter({ fixture }: Props) {
  const followups = fixture.samples.follow_ups || [];
  const engager = fixture.samples.engager_outreach;
  const sample = engager?.samples?.[0];
  const reader = readerFor(fixture);
  const warm = useThreadPlayback(followups.length);
  const cold = useThreadPlayback(sample ? 1 : 0);
  const items = followups.map((f,i) => ({ date: dateLabel(f.day || i * 4), time: i === 0 ? '9:02 AM' : i === 1 ? '8:40 AM' : '10:15 AM', text: f.body }));
  return <>
    <Thread fixture={fixture} withName={reader.name} withHeadline={reader.headline} withInitials={reader.initials} items={items} playback={warm}/>
    {sample && <>
      <Reveal className="outreach-entrance"><span className="journey-eyebrow">When someone comments first</span><h3>{sample.trigger}</h3></Reveal>
      <Thread fixture={fixture} withName={sample.engager?.name || 'A reader from your comments'} withHeadline={sample.engager?.headline || ''} withInitials={(sample.engager?.name || 'R').split(' ').map(n => n[0]).slice(0,2).join('')} items={[{ date: dateLabel(1), time: '2:12 PM', text: sample.dm }]} playback={cold}/>
    </>}
  </>;
}
