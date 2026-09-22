import React, { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';
import { Avatar, Paragraphs, Reveal } from './ReadingChapter';
import { newsletterDraft, scoreOf, tierOf, type JourneyAction, type JourneyFixture, type JourneyState } from './model';

type Props = { fixture: JourneyFixture; state: JourneyState; dispatch: React.Dispatch<JourneyAction> };
export function NewsletterChapter({ fixture, state, dispatch }: Props) {
  const newsletter = fixture.samples.newsletter || newsletterDraft;
  return <>
    <label className="newsletter-optin"><input type="checkbox" checked={state.subscribed} onChange={e => dispatch({type:'subscription',value:e.target.checked})}/><span>Alex also chooses to get the newsletter.<small>Separate from taking the score. Demo only.</small></span></label>
    <Reveal as="article" className="journey-email-issue" data-mockup="email" aria-label="Newsletter sample as an email">
      <div className="email-chrome"><span aria-hidden="true">←</span><span className="email-chrome-title">Inbox</span><span className="email-chrome-tools" aria-hidden="true"><i/><i/><i/></span></div>
      <div className="email-head">
        <h3 className="email-subject-line">{newsletter.subject}</h3>
        <div className="email-sender"><Avatar src={fixture.founder.avatarUrl} name={fixture.founder.name}/><div className="email-sender-meta"><b>Andrew Hayes <small>&lt;andrew@cuevu.com&gt;</small></b><span>to Alex</span></div><span className="email-time">Tue, 9:14 AM</span></div>
        <p className="email-preheader">{newsletter.preview}</p>
      </div>
      <div className="email-body">
        <p className="email-greeting sample-body">Hi Alex,</p>
        {newsletter.sections.map((section,i) => <section key={i}><h4>{section.h}</h4><Paragraphs text={section.body} className="newsletter-body sample-body"/></section>)}
        <p className="newsletter-cta sample-body">{newsletter.cta}</p>
        <span className="email-button" aria-hidden="true">Reply with your three lines</span>
        <div className="email-signature"><span>Andrew<br/><small>CueVu · cuevu.com</small></span></div>
      </div>
      <div className="email-footer"><span>You’re getting this because you took {fixture.assessment.title}.</span><span>Unsubscribe · Update preferences · CueVu</span></div>
    </Reveal>
    <p className="source-note">{fixture.samples.newsletter ? 'Newsletter from the original scan.' : 'New newsletter draft for this preview. The original scan had no newsletter sample.'}</p>
  </>;
}
/** Plays a thread in: typing dots, then each bubble, in order. Settled at once under reduced motion. */
function useThreadPlayback(count: number, step = 950) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: .3 });
  const reduced = useReducedMotion();
  const [shown,setShown] = useState(reduced ? count : 0);
  useEffect(() => { if (reduced) { setShown(count); return; } if (!inView) return; let i = 0; const timer = setInterval(() => { i += 1; setShown(i); if (i >= count) clearInterval(timer); }, step); return () => clearInterval(timer); }, [inView, reduced, count, step]);
  return { ref, shown, settled: shown >= count, typing: inView && shown < count };
}
function Typing() { return <div className="thread-typing" aria-label="Typing"><i/><i/><i/></div>; }
function Message({ fixture, time, children, note, fresh }: { fixture: JourneyFixture; time: string; children: React.ReactNode; note?: string; fresh?: boolean }) {
  return <div className={`thread-message${fresh ? ' is-new' : ''}`}><Avatar src={fixture.founder.avatarUrl} name={fixture.founder.name}/><div><div className="thread-meta"><b>Andrew Hayes</b><span>{time}</span></div>{children}{note && <span className="thread-purpose">{note}</span>}</div></div>;
}
export function ConversationChapter({ fixture, state }: Props) {
  const followups = fixture.samples.follow_ups || [];
  const engager = fixture.samples.engager_outreach;
  const sample = engager?.samples?.[0];
  const tier = tierOf(state); const score = scoreOf(state);
  const [expanded,setExpanded] = useState(false);
  const later = followups.slice(1);
  const warm = useThreadPlayback(2);
  const cold = useThreadPlayback(1);
  return <>
    <div className="conversation-context"><span className="journey-eyebrow">The same person. The same result.</span><p>Alex · {score} / 100 · {tier.name}</p><span className="source-note">Written from the score Alex just took. Change an answer above and the opening changes.</span></div>
    <article ref={warm.ref} className={`journey-thread${warm.settled ? ' is-settled' : ''}`} data-mockup="linkedin" aria-label="LinkedIn message thread sample">
      <div className="thread-head"><span><b className="linkedin-mark">in</b> Messaging</span><span className="thread-with"><span className="demo-avatar" aria-hidden="true">A</span><b>Alex</b><small>{fixture.buyer.role}</small></span><span className="thread-tag">Warm outreach</span></div>
      <div className="thread-body">
        <div className="thread-day"><span>Day 1 · after the score</span></div>
        {warm.shown >= 1 && <Message fixture={fixture} time="9:02 AM" fresh note="New opening for this preview, written from the result above"><p className="thread-bubble sample-body" data-testid="followup-context">Hi Alex, saw you finished the 99-1 score and landed in {tier.name} at {score}. {tier.firstStep}</p></Message>}
        {warm.shown >= 2 && followups[0] && <Message fixture={fixture} time="9:03 AM" note="Help them use it · original scan"><Paragraphs text={followups[0].body} className="thread-bubble sample-body"/></Message>}
        {warm.typing && <Typing/>}
        {warm.settled && (expanded ? later.map((message,i) => <React.Fragment key={message.step}><div className="thread-day"><span>Day {message.day}</span></div><Message fixture={fixture} time={i===0?'8:40 AM':'10:15 AM'} note={`${i===0?'Give them another useful tip':'Invite a reply'} · original scan`}><Paragraphs text={message.body} className="thread-bubble sample-body"/></Message></React.Fragment>)
          : <button className="thread-more" onClick={() => setExpanded(true)} aria-expanded={false}>Show the next two messages <small>Day {later[0]?.day} and day {later[1]?.day} · sent only if Alex hasn’t replied</small><span aria-hidden="true">↓</span></button>)}
      </div>
    </article>
    <p className="source-note">Three original follow-ups from your scan, shown as LinkedIn messages. A reply from Alex stops the sequence.</p>
    <div className="outreach-entrance"><Reveal><span className="journey-eyebrow">Another way in</span><h3>Some people<br/>only comment.</h3><p>When someone engages with a post, that comment is the reason to write to them.</p></Reveal></div>
    {sample && <article ref={cold.ref} className={`journey-thread journey-thread-engager${cold.settled ? ' is-settled' : ''}`} data-mockup="linkedin" aria-label="Engager outreach sample">
      <div className="thread-head"><span><b className="linkedin-mark">in</b> Messaging</span><span className="thread-with"><span className="demo-avatar" aria-hidden="true">{(sample.engager?.name || 'L A').split(' ').map(n => n[0]).slice(0,2).join('')}</span><b>{sample.engager?.name}</b><small>{sample.engager?.headline}</small></span><span className="thread-tag">Warm outreach</span></div>
      <div className="thread-body">
        <div className="thread-day"><span>{sample.trigger}</span></div>
        {cold.shown >= 1 ? <Message fixture={fixture} time="Same day" note="Original scan example"><Paragraphs text={sample.dm} className="thread-bubble sample-body"/></Message> : cold.typing && <Typing/>}
      </div>
    </article>}
    {engager?.explainer && <p className="source-note">{engager.explainer}</p>}
  </>;
}
