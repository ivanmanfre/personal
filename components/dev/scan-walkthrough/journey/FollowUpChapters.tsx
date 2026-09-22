import React from 'react';
import { Avatar, Paragraphs } from './ReadingChapter';
import { newsletterDraft, tierOf, tierScores, type JourneyAction, type JourneyFixture, type JourneyState } from './model';

type Props = { fixture: JourneyFixture; state: JourneyState; dispatch: React.Dispatch<JourneyAction> };
export function NewsletterChapter({ fixture, state, dispatch }: Props) {
  const newsletter = fixture.samples.newsletter || newsletterDraft;
  return <>
    <label className="newsletter-optin"><input type="checkbox" checked={state.subscribed} onChange={e => dispatch({type:'subscription',value:e.target.checked})}/><span>Alex also chooses to get the newsletter.<small>Separate from taking the score. Demo only.</small></span></label>
    <article className="journey-email-issue" data-mockup="email" aria-label="Newsletter sample as an email">
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
    </article>
    <p className="source-note">{fixture.samples.newsletter ? 'Newsletter from the original scan.' : 'New newsletter draft for this preview. The original scan had no newsletter sample.'}</p>
  </>;
}
export function ConversationChapter({ fixture, state }: Props) {
  const followups = fixture.samples.follow_ups || [];
  const outreach = fixture.samples.engager_outreach?.samples?.[0];
  const tier = tierOf(state);
  return <>
    <div className="conversation-context"><span className="journey-eyebrow">The same person. The same result.</span><p>Alex · {tierScores[state.tier]} / 100 · {tier.name}</p><span className="source-note">{state.requested ? 'Example lead recorded' : 'Example of a reader who finished the score'}</span></div>
    <article className="journey-thread" data-mockup="linkedin" aria-label="LinkedIn message thread sample">
      <div className="thread-head"><span><b className="linkedin-mark">in</b> Messaging</span><span className="thread-with"><span className="demo-avatar" aria-hidden="true">A</span><b>Alex</b><small>{fixture.buyer.role}</small></span><span className="thread-tag">Warm outreach</span></div>
      <div className="thread-body">
        <div className="thread-day"><span>Day 1</span></div>
        <div className="thread-message is-new"><Avatar src={fixture.founder.avatarUrl} name={fixture.founder.name}/><div><div className="thread-meta"><b>Andrew Hayes</b><span>9:02 AM</span></div><p className="thread-bubble sample-body" data-testid="followup-context">Hi Alex, saw you finished the 99-1 score and landed in {tier.name}. {tier.firstStep}</p><span className="source-note opening-note">New opening for this preview, written from the result above</span></div></div>
        {followups.map((message,i) => <React.Fragment key={message.step}>
          {i > 0 && <div className="thread-day"><span>Day {message.day}</span></div>}
          <div className="thread-message"><Avatar src={fixture.founder.avatarUrl} name={fixture.founder.name}/><div><div className="thread-meta"><b>Andrew Hayes</b><span>{i===0?'9:03 AM':i===1?'8:40 AM':'10:15 AM'}</span></div><Paragraphs text={message.body} className="thread-bubble sample-body"/><span className="thread-purpose">{i===0?'Help them use it':i===1?'Give them another useful tip':'Invite a reply'} · original scan</span></div></div>
        </React.Fragment>)}
      </div>
      <div className="thread-composer" aria-hidden="true"><span>Write a message…</span><i>Send</i></div>
    </article>
    <p className="source-note">Three original follow-ups from your scan, shown as LinkedIn messages. Each one waits for the last; a reply from Alex stops the sequence.</p>
    <div className="outreach-entrance"><span className="journey-eyebrow">Another way in</span><h3>Some people<br/>won’t see your posts.</h3><p>You can also reach out when their work gives you a useful reason to talk.</p></div>
    <article className="journey-thread journey-thread-cold" data-mockup="linkedin" aria-label="Cold outreach sample">
      <div className="thread-head"><span><b className="linkedin-mark">in</b> Messaging</span><span className="thread-with"><span className="demo-avatar" aria-hidden="true">?</span><b>[First name]</b><small>Brand manager · verified product launch</small></span><span className="thread-tag is-cold">Cold outreach</span></div>
      <div className="thread-body">
        <div className="thread-message"><Avatar src={fixture.founder.avatarUrl} name={fixture.founder.name}/><div><div className="thread-meta"><b>Andrew Hayes</b><span>Draft</span></div><Paragraphs text={'Hi [first name],\n\nSaw you’re launching [verified product]. Have you spoken to people who recently switched from another brand in that category?\n\nI can send you the question we use to get their side of the story. Would that be useful?'} className="thread-bubble sample-body"/></div></div>
      </div>
      <p className="source-note">New draft for this preview. Check the person, role and launch before using it.</p>
    </article>
    {outreach && <div className="original-outreach"><span className="journey-eyebrow">When someone comments first</span><p className="source-note">Original scan example · {outreach.trigger}</p><blockquote className="sample-body">{outreach.dm}</blockquote></div>}
  </>;
}
