import React, { useEffect, useReducer, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useGoogleFonts } from '../../../hooks/useGoogleFonts';
import { ClientProof } from './StoryExhibits';
import { ReadingChapter } from './journey/ReadingChapter';
import { ContentChapter } from './journey/ContentChapter';
import { ResourceChapter } from './journey/ResourceChapter';
import { ConversationChapter, NewsletterChapter } from './journey/FollowUpChapters';
import { Fold, MonthStrip, ProgressRail, SystemMap } from './journey/Fold';
import { fixture as andrew, initialJourneyState, journeyReducer, type JourneyFixture } from './journey/model';
import { loadFixture } from './journey/load';
import {StoryBody} from '../../scan/story/ScanStoryReport';
import {reviewDraft} from '../../scan/story/reviewDrafts';
import { storyKind } from './journey/connectedModel';
import './story-exhibits.css';
import './journey/journey.css';

const BOOK='https://calendly.com/im-ivanmanfredi/30min';
/** A quiet mid-page ask: one line and an ink button. Red stays reserved for the close. */
function Ask({ line }: { line: React.ReactNode }) {
  return <div className="journey-ask"><p>{line}</p><a className="journey-button ink" href={BOOK} target="_blank" rel="noreferrer">Book the walkthrough <span aria-hidden="true">→</span></a></div>;
}

export default function ScanWalkthroughPreview() {
  const rootRef=useRef<HTMLElement>(null);
  const reduced=useReducedMotion();
  const slug=typeof window!=='undefined'?(new URLSearchParams(window.location.search).get('slug')||new URLSearchParams(window.location.hash.replace(/^#/, '')).get('slug')||((window as unknown as {__SCAN_SLUG__?: string}).__SCAN_SLUG__||'').replace(/^%.*%$/, '')||null):null;
  const baked=typeof window!=='undefined'&&!!(window as unknown as {__SCAN_ROW__?: unknown}).__SCAN_ROW__;
  const [loaded,setLoaded]=useState<JourneyFixture|null>(!slug||(slug===andrew.slug&&!baked)?andrew:null);
  const [loadError,setLoadError]=useState<string|null>(null);
  useEffect(()=>{if(!slug||(slug===andrew.slug&&!baked))return;let live=true;loadFixture(slug).then(f=>{if(live)setLoaded(f);}).catch(e=>{if(live)setLoadError(String(e.message||e));});return()=>{live=false;};},[slug]);
  const fixture=loaded||andrew;
  useGoogleFonts([loaded?.samples.lm?.brand?.font_heading]);
  const [state,dispatch]=useReducer(journeyReducer,initialJourneyState);
  const props={fixture,state,dispatch};
  return <main className="scan-journey" ref={rootRef} id="top">
    <title>{`${fixture.founder.firstName}, your LinkedIn plan for qualified calls`}</title><meta name="robots" content="noindex,nofollow"/>
    <a href="#content" className="journey-skip">Skip to your samples</a>
    <div className="journey-topbar"><a href="#top" className="journey-wordmark" aria-label="InboundOnSteroids">INBOUND<b>ON</b>STEROIDS</a><a className="topbar-cta" href={BOOK} target="_blank" rel="noreferrer">Book a call</a></div>
    {!loaded ? <div className="journey-loading" role={loadError ? 'alert' : 'status'}>{loadError ? `Could not load this scan. Please refresh to try again.` : 'Loading your scan'}</div> : storyKind(loaded.slug) ? <StoryBody key={loaded.slug} fixture={loaded} edition={reviewDraft(loaded)!}/> : <>
    {loadError && <p className="journey-load-error" role="alert">Could not load the scan for “{slug}”: {loadError}. Showing the sample scan instead.</p>}
    <Fold fixture={fixture} ask={<Ask line={<>That is the read on {fixture.founder.company}, {fixture.founder.firstName}. The rest of this page is what we would run.</>}/>}/>
    <ProgressRail/>
    <ReadingChapter id="content" number="01" title="A story makes them stop." why="One carousel, three posts and a profile that says who you are."><ContentChapter fixture={fixture}/></ReadingChapter>
    <ReadingChapter id="inbound" number="02" title="Turn a reader into a lead." why="One gated asset in your brand. Every reader who takes it lands on your list."><ResourceChapter {...props}/><Ask line="On the call we go through this lead magnet and the posts that feed it."/></ReadingChapter>
    <ReadingChapter id="newsletter" number="03" title="Give them a reason to return." why="One idea a week, in your voice, to the list you own."><NewsletterChapter {...props}/></ReadingChapter>
    <ReadingChapter id="outreach" number="04" title="Start with what they need." why="Every message references what they took or what they said. No pitch."><ConversationChapter {...props}/><Ask line={<>Every reply gets worked in your voice. You take the calls, {fixture.founder.firstName}.</>}/></ReadingChapter>
    <ReadingChapter id="together" number="05" title="Now it all comes together." why="Two ways in, one place they land."><SystemMap fixture={fixture}/><MonthStrip fixture={fixture}/><Ask line="On the call we walk your samples live, and what it costs."/><div className="service-note"><span className="journey-eyebrow">Your part</span><p>Share what you know on a call.<br/>Veto anything, though you rarely need to.<br/>Take the calls.</p></div></ReadingChapter>
    <ClientProof/>
    <section className="journey-close"><h2>Booked calls<br/>without the chase.</h2><p>We write it, publish it and work the replies. You take the calls.</p><a className="journey-button red" href={BOOK} target="_blank" rel="noreferrer">Book the walkthrough <span aria-hidden="true">↗</span></a><span className="close-fine">30 minutes. Your samples, the weekly rhythm, the price.</span></section>
    <footer className="journey-footer"><a href={fixture.source.url} target="_blank" rel="noreferrer">View the original scan ↗</a><span>Local design preview · proposed samples</span><a href="#top">Back to the start ↑</a></footer>
    </>}
  </main>;
}
