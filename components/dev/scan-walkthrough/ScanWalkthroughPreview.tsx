import React, { useEffect, useReducer, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useGoogleFonts } from '../../../hooks/useGoogleFonts';
import { StorySound, ClientProof } from './StoryExhibits';
import { ReadingChapter } from './journey/ReadingChapter';
import { ContentChapter } from './journey/ContentChapter';
import { ResourceChapter } from './journey/ResourceChapter';
import { ConversationChapter, NewsletterChapter } from './journey/FollowUpChapters';
import { Fold, LoopStations } from './journey/Fold';
import { fixture as andrew, initialJourneyState, journeyReducer, type JourneyFixture } from './journey/model';
import { loadFixture } from './journey/load';
import './story-exhibits.css';
import './journey/journey.css';

export default function ScanWalkthroughPreview() {
  const rootRef=useRef<HTMLElement>(null);
  const reduced=useReducedMotion();
  const slug=typeof window!=='undefined'?(new URLSearchParams(window.location.search).get('slug')||new URLSearchParams(window.location.hash.replace(/^#/, '')).get('slug')||((window as unknown as {__SCAN_SLUG__?: string}).__SCAN_SLUG__||'').replace(/^%.*%$/, '')||null):null;
  const [fixture,setFixture]=useState<JourneyFixture>(andrew);
  const [loadError,setLoadError]=useState<string|null>(null);
  useEffect(()=>{if(!slug||slug===andrew.slug)return;let live=true;loadFixture(slug).then(f=>{if(live)setFixture(f);}).catch(e=>{if(live)setLoadError(String(e.message||e));});return()=>{live=false;};},[slug]);
  useGoogleFonts([fixture.samples.lm?.brand?.font_heading]);
  const [state,dispatch]=useReducer(journeyReducer,initialJourneyState);
  const props={fixture,state,dispatch};
  return <main className="scan-journey" ref={rootRef} id="top">
    <title>{`${fixture.founder.firstName}, here’s how it comes together · LinkedIn story preview`}</title><meta name="robots" content="noindex,nofollow"/>
    <a href="#content" className="journey-skip">Skip to your samples</a>
    <div className="journey-topbar"><a href="#top" className="journey-wordmark">inbound<span>onsteroids<i>.</i></span></a><StorySound/></div>
    {loadError && <p className="journey-load-error" role="alert">Could not load the scan for “{slug}”: {loadError}. Showing the sample scan instead.</p>}
    <Fold fixture={fixture}/>
    <ReadingChapter id="content" number="01" title="A story makes them stop." why="One carousel, three posts and a profile that says who you are."><ContentChapter fixture={fixture}/></ReadingChapter>
    <ReadingChapter id="inbound" number="02" title="Turn a reader into a lead." why="One gated asset in your brand. Every reader who takes it lands on your list."><ResourceChapter {...props}/></ReadingChapter>
    <ReadingChapter id="newsletter" number="03" title="Give them a reason to return." why="One idea a week, in your voice, to the list you own."><NewsletterChapter {...props}/></ReadingChapter>
    <ReadingChapter id="outreach" number="04" title="Start with what they need." why="Every message references what they took or what they said. No pitch."><ConversationChapter {...props}/></ReadingChapter>
    <ReadingChapter id="together" number="05" title="Now it all comes together." why="Each piece gives the next one a purpose."><LoopStations/><p className="recap-note">Comments feed the same loop: an engager gets the message, then the score, then the newsletter.</p><div className="service-note"><span className="journey-eyebrow">Your part</span><p>Share what you know on a call.<br/>Veto anything, though you rarely need to.<br/>Take the calls.</p></div></ReadingChapter>
    <ClientProof/>
    <section className="journey-close"><span className="journey-eyebrow">{fixture.founder.firstName}, this is the whole system</span><h2>Booked calls<br/>without the chase.</h2><p>The posts, the lead magnet, the newsletter and the messages above: we write them, publish them and work the replies, in your voice, every day. You take the calls.</p><a className="journey-button red" href="https://calendly.com/im-ivanmanfredi/30min" target="_blank" rel="noreferrer">Book the walkthrough <span aria-hidden="true">↗</span></a><span className="close-fine">30 minutes. Your samples, the weekly rhythm, and what it costs.</span></section>
    <footer className="journey-footer"><a href={fixture.source.url} target="_blank" rel="noreferrer">View the original scan ↗</a><span>Local design preview · proposed samples</span><a href="#top">Back to the start ↑</a></footer>
  </main>;
}
