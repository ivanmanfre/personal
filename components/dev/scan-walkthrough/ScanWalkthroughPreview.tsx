import React, { useReducer, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useGoogleFonts } from '../../../hooks/useGoogleFonts';
import { StorySound, ClientProof } from './StoryExhibits';
import { ReadingChapter } from './journey/ReadingChapter';
import { ContentChapter } from './journey/ContentChapter';
import { ResourceChapter } from './journey/ResourceChapter';
import { ConversationChapter, NewsletterChapter } from './journey/FollowUpChapters';
import { Buyer, BuyerPath } from './journey/BuyerPath';
import { fixture, initialJourneyState, journeyReducer } from './journey/model';
import './story-exhibits.css';
import './journey/journey.css';

export default function ScanWalkthroughPreview() {
  const rootRef=useRef<HTMLElement>(null);
  const reduced=useReducedMotion();
  useGoogleFonts([fixture.samples.lm?.brand?.font_heading, fixture.assessment.brand.fontHeading, fixture.assessment.brand.fontBody]);
  const [state,dispatch]=useReducer(journeyReducer,initialJourneyState);
  const props={fixture,state,dispatch};
  return <main className="scan-journey" ref={rootRef} id="top">
    <title>Andrew, here’s how it comes together · LinkedIn story preview</title><meta name="robots" content="noindex,nofollow"/>
    <a href="#content" className="journey-skip">Skip to your samples</a>
    <div className="journey-topbar"><a href="#top" className="journey-wordmark">inbound<span>onsteroids<i>.</i></span></a><StorySound/></div>
    <section className="journey-hero"><div className="hero-copy"><span className="journey-eyebrow">Andrew Hayes / CueVu / made for you</span><h1>A stranger.<br/>A story.<br/><span>A conversation.</span></h1><p>See how your LinkedIn content<br/>can lead someone to your work.</p><a className="journey-start" href="#content">Follow one reader <span aria-hidden="true">↓</span></a></div><div className="hero-route" aria-hidden="true"><span>scrolling</span><svg viewBox="0 0 680 120"><path d="M0 70H140C220 70 190 20 280 20S350 100 435 100S530 50 680 50"/></svg><div className="hero-person"><span className="rb-flip"><Buyer/></span></div><span>interested</span></div><div className="buyer-intro"><span className="buyer-label">Meet Alex.</span><p>A brand manager looking for better customer stories.<small>An example reader. Follow their path below.</small></p></div></section>
    <BuyerPath rootRef={rootRef}/>
    <ReadingChapter id="content" number="01" title="A story makes them stop." why="A familiar problem catches their eye. Your profile helps them see who can help."><ContentChapter fixture={fixture}/></ReadingChapter>
    <ReadingChapter id="inbound" number="02" title="Turn a reader into a lead." why="One useful thing they can take. The moment they take it, you have a name, a result and a reason to write."><ResourceChapter {...props}/></ReadingChapter>
    <ReadingChapter id="newsletter" number="03" title="Give them a reason to return." why="They might leave today. A useful newsletter keeps the conversation open for when they’re ready."><NewsletterChapter {...props}/></ReadingChapter>
    <ReadingChapter id="outreach" number="04" title="Start with what they need." why="Warm outreach begins with the score they just took. Give them something useful to reply to."><ConversationChapter {...props}/></ReadingChapter>
    <ReadingChapter id="together" number="05" title="Now it all comes together." why="Each piece gives the next one a purpose. Alex keeps moving through it; so does every reader after them."><div className="journey-loop" aria-label="The reader’s loop">
      <span className="loop-track" aria-hidden="true"/><span className="loop-runner" aria-hidden="true"><span className="rb-flip"><Buyer/></span></span>
      <ol className="loop-stations">{[
        ['content','The post','Stops them in the feed.','in'],['inbound','The score','Turns a reader into a name.','▤'],['newsletter','The newsletter','Brings them back next week.','↗'],['outreach','The message','Opens a real conversation.','↳'],['call','The call','On your calendar, already warm.','◉'],
      ].map(([id,title,why,icon],i)=><li key={id} style={{'--i':i} as React.CSSProperties}>{id==='call'?<span className="loop-item"><span className="recap-icon" aria-hidden="true">{icon}</span><span><b>{title}</b><small>{why}</small></span></span>:<a className="loop-item" href={`#${id}`}><span className="recap-icon" aria-hidden="true">{icon}</span><span><b>{title}</b><small>{why}</small></span><i aria-hidden="true">↑</i></a>}</li>)}</ol>
    </div><p className="recap-note">Comments feed the same loop: an engager gets the message, then the score, then the newsletter.</p><div className="service-note"><span className="journey-eyebrow">Your part</span><p>Share what you know on a call.<br/>Veto anything, though you rarely need to.<br/>Take the calls.</p></div></ReadingChapter>
    <ClientProof/>
    <section className="journey-close"><span className="journey-eyebrow">Andrew, this is the whole system</span><h2>Booked calls<br/>without the chase.</h2><p>The post, the score, the newsletter and the message above: we write them, publish them and work the replies, in your voice, every day. You take the calls.</p><a className="journey-button red" href="https://calendly.com/im-ivanmanfredi/30min" target="_blank" rel="noreferrer">Book the walkthrough <span aria-hidden="true">↗</span></a><span className="close-fine">30 minutes. Your samples, the weekly rhythm, and what it costs.</span></section>
    <footer className="journey-footer"><a href={fixture.source.url} target="_blank" rel="noreferrer">View the original scan ↗</a><span>Local design preview · proposed samples</span><a href="#top">Back to the start ↑</a></footer>
  </main>;
}
