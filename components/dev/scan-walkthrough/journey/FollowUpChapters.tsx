import React from 'react';
import { Avatar, Paragraphs } from './ReadingChapter';
import { newsletterDraft, purposes, type JourneyAction, type JourneyFixture, type JourneyState } from './model';

type Props = { fixture: JourneyFixture; state: JourneyState; dispatch: React.Dispatch<JourneyAction> };
export function NewsletterChapter({ fixture, state, dispatch }: Props) {
  const newsletter = fixture.samples.newsletter || newsletterDraft;
  return <>
    <label className="newsletter-optin"><input type="checkbox" checked={state.subscribed} onChange={e => dispatch({type:'subscription',value:e.target.checked})}/><span>Alex also chooses to get the newsletter.<small>Separate from requesting the checklist. Demo only.</small></span></label>
    <article className="journey-newsletter" data-mockup="email"><div className="email-envelope"><span>From: Andrew at CueVu</span><span>Newsletter sample</span></div><div className="email-subject"><span>Subject</span><h3>{newsletter.subject}</h3></div><div className="newsletter-paper"><div className="newsletter-masthead"><b>CueVu</b><span>Notes on stories</span></div><p className="newsletter-preview">{newsletter.preview}</p>{newsletter.sections.map((section,i) => <section key={i}><h4>{section.h}</h4><Paragraphs text={section.body} className="newsletter-body sample-body"/></section>)}<p className="newsletter-cta">{newsletter.cta}</p><div className="newsletter-signature"><Avatar src={fixture.founder.avatarUrl} name={fixture.founder.name}/><span>Andrew<br/><small>CueVu</small></span></div></div></article>
    <p className="source-note">{fixture.samples.newsletter ? 'Newsletter from the original scan.' : 'New newsletter draft for this preview. The original scan had no newsletter sample.'}</p>
  </>;
}
export function ConversationChapter({ fixture, state }: Props) {
  const followups = fixture.samples.follow_ups || [];
  const outreach = fixture.samples.engager_outreach?.samples?.[0];
  return <>
    <div className="conversation-context"><span className="journey-eyebrow">The same person. The same interest.</span><p>Alex · {state.category} · {purposes[state.purpose]}</p><span className="source-note">{state.requested ? 'Example request recorded' : 'Example of a reader who requests the checklist'}</span></div>
    <div className="followup-sequence">{followups.map((message,i) => <article className="journey-email" key={message.step} data-mockup="email"><div className="followup-day"><span>Day {message.day}</span><span>{i===0?'Help them use it':i===1?'Give them another useful tip':'Invite a reply'}</span></div><div className="followup-message"><h3>{message.subject}</h3>{i === 0 && <><p className="personalized-opening sample-body" data-testid="followup-context">Hi Alex, how is your {state.category.toLowerCase()} {purposes[state.purpose].toLowerCase()} coming along?</p><span className="source-note opening-note">Example opening above · original follow-up below</span></>}<Paragraphs text={message.body}/><span className="email-signoff">Andrew</span></div></article>)}</div>
    <div className="outreach-entrance"><span className="journey-eyebrow">Another way in</span><h3>Some people<br/>won’t see your posts.</h3><p>You can also reach out when their work gives you a useful reason to talk.</p></div>
    <article className="journey-dm" data-mockup="linkedin"><div className="platform-bar"><span><b className="linkedin-mark">in</b> A first conversation</span></div><div className="outreach-reason"><span className="sample-stamp">New outreach draft</span><p>For a brand manager with a <strong>verified product launch</strong>.</p></div><div className="dm-bubble"><Paragraphs text={'Hi [first name],\n\nSaw you’re launching [verified product]. Have you spoken to people who recently switched from another brand in that category?\n\nI can send you the question we use to get their side of the story. Would that be useful?'}/></div><p className="source-note">Check the person, role and launch before using this draft.</p></article>
    {outreach && <div className="original-outreach"><span className="journey-eyebrow">When someone comments first</span><p className="source-note">Original scan example · {outreach.trigger}</p><blockquote className="sample-body">{outreach.dm}</blockquote></div>}
  </>;
}
