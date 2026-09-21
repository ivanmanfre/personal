import React, { useReducer, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useGoogleFonts } from '../../../hooks/useGoogleFonts';
import { StorySound, ClientToolsShowcase } from './StoryExhibits';
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
  useGoogleFonts([fixture.samples.lm?.brand?.font_heading]);
  const [state,dispatch]=useReducer(journeyReducer,initialJourneyState);
  const props={fixture,state,dispatch};
  return <main className="scan-journey" ref={rootRef} id="top">
    <title>Andrew, here’s how it comes together · LinkedIn story preview</title><meta name="robots" content="noindex,nofollow"/>
    <a href="#content" className="journey-skip">Skip to your samples</a>
    <div className="journey-topbar"><a href="#top" className="journey-wordmark">inbound<span>onsteroids<i>.</i></span></a><StorySound/></div>
    <section className="journey-hero"><div className="hero-copy"><span className="journey-eyebrow">Andrew Hayes / CueVu / made for you</span><h1>A stranger.<br/>A story.<br/><span>A conversation.</span></h1><p>See how your LinkedIn content<br/>can lead someone to your work.</p><a className="journey-start" href="#content">Follow one reader <span aria-hidden="true">↓</span></a></div><div className="hero-route" aria-hidden="true"><span>scrolling</span><svg viewBox="0 0 680 120"><path d="M0 70H140C220 70 190 20 280 20S350 100 435 100S530 50 680 50"/></svg><div className="hero-person"><Buyer/></div><span>interested</span></div><div className="buyer-intro"><span className="buyer-label">Meet Alex.</span><p>A brand manager looking for better customer stories.<small>An example reader. Follow their path below.</small></p></div></section>
    <BuyerPath rootRef={rootRef}/>
    <ReadingChapter id="content" number="01" title="A story makes them stop." why="A familiar problem catches their eye. Your profile helps them see who can help."><ContentChapter fixture={fixture}/></ReadingChapter>
    <ReadingChapter id="inbound" number="02" title="Give them something to use." why="The carousel shares your thinking. The checklist helps them try it on their own work."><ResourceChapter {...props}/></ReadingChapter>
    <ReadingChapter id="newsletter" number="03" title="Give them a reason to return." why="They might leave today. A useful newsletter keeps the conversation open for when they’re ready."><NewsletterChapter {...props}/></ReadingChapter>
    <ReadingChapter id="outreach" number="04" title="Start with what they need." why="Follow up on the resource they asked for. Give them something useful to reply to."><ConversationChapter {...props}/></ReadingChapter>
    <ReadingChapter id="together" number="05" title="Now it all comes together." why="Each piece gives the next one a purpose. Here’s the work we would create and run."><div className="journey-recap-wrap"><motion.span className="recap-connecting-line" aria-hidden="true" initial={reduced?false:{scaleY:0}} whileInView={{scaleY:1}} viewport={{once:true,amount:.3}} transition={{duration:reduced?0:.45,ease:[.22,.84,.36,1]}}/><ol className="journey-recap">{[
      ['content','The post','A reason to notice you.','in'],['inbound','The carousel & resource','A chance to use your thinking.','▤'],['newsletter','The newsletter','A reason to come back.','↗'],['outreach','The conversation','A useful next step together.','↳'],
    ].map(([id,title,why,icon])=><li key={id}><a href={`#${id}`}><span className="recap-icon" aria-hidden="true">{icon}</span><span><b>{title}</b><small>{why}</small></span><i aria-hidden="true">↑</i></a></li>)}</ol></div><p className="recap-note">Outreach can start the conversation too. A useful reply could lead to a call.</p><div className="service-note"><span className="journey-eyebrow">Your part</span><p>Share your expertise.<br/>Review what goes out.<br/>Take the right conversations.</p></div></ReadingChapter>
    <ClientToolsShowcase/>
    <section className="journey-close"><span className="journey-eyebrow">Your LinkedIn, working together</span><h2>Let’s make this<br/>work for you.</h2><p>We’ll walk through the samples,<br/>the workflow and what it costs.</p><a className="journey-button red" href="https://calendly.com/im-ivanmanfredi/30min" target="_blank" rel="noreferrer">Walk me through it <span aria-hidden="true">↗</span></a></section>
    <footer className="journey-footer"><a href={fixture.source.url} target="_blank" rel="noreferrer">View the original scan ↗</a><span>Local design preview · proposed samples</span><a href="#top">Back to the start ↑</a></footer>
  </main>;
}
