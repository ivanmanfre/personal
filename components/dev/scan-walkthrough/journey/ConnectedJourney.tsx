import React, { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ScanResults, EarlyProof } from './ScanResults';
import { ResearchReceipt } from './ResearchReceipt';
import { EmailCapture } from './EmailCapture';
import { Avatar, Paragraphs } from './ReadingChapter';
import { asset, type JourneyFixture } from './model';
import type {StoryKind} from './connectedModel';
import {useStory} from '../../../scan/story/context';
import {assessAudience} from '../../../scan/story/assessment';
import { JourneyVisitor, Visitor } from './JourneyVisitor';
import { ProspectPost, TextPost } from './ProspectSamples';
import { LeadMagnetTool } from './LeadMagnetTool';

import { RevenueMap } from './RevenueMap';
import './connected.css';
import './bold.css';
import './studio.css';

const BOOK = 'https://calendly.com/im-ivanmanfredi/30min';

function AuditOpening({ fixture, kind }: { fixture: JourneyFixture; kind: StoryKind }) {
  const result=assessAudience(fixture);
  return <section className="sample-hero audit-opening" data-assessment={result.state}>
    <div className="sample-hero-copy"><span className="made-for"><Avatar src={fixture.founder.avatarUrl} name={fixture.founder.name}/>{fixture.founder.name} · {fixture.founder.company}</span><h1>{result.heading}</h1><p className="hero-call-promise">{result.why}</p><a href="#content" className="story-primary">See how to reach them <span aria-hidden="true">↓</span></a></div>
    <aside className="audit-receipt" aria-label="Findings from the saved scan"><header><span>Your audience scan</span>{result.date&&<time>{result.date}</time>}</header>
      <div className="audit-number">{result.state==='buyers'?<strong>{result.buyers}<span> / {result.people}</span></strong>:result.state==='network'?<strong>{result.networkCount}<span> / {result.networkSample}</span></strong>:result.people!==null?<strong>{result.people}<span> engagers</span></strong>:null}<p>{result.receipt}</p></div>
      {result.state==='buyers'&&<div className="audience-dots" aria-hidden="true">{Array.from({length:Math.min(result.people!,100)},(_,i)=><i key={i} className={i<result.buyers!?'is-buyer':''}/>)}</div>}
      {result.rubric&&<p className="audit-scope">Buyer criteria: {result.rubric}.</p>}
      <a href={fixture.source.url} target="_blank" rel="noreferrer">Saved scan ↗</a>
    </aside>
  </section>;
}

export function ConnectedJourney({ fixture, kind }: { fixture: JourneyFixture; kind: StoryKind }) {
  const plan = useStory();
  const reduced = useReducedMotion();
  const [messageOpen, setMessageOpen] = useState(false);
  const founder = fixture.founder;
  return <div className="connected-journey sample-story revenue-story">
    <AuditOpening fixture={fixture} kind={kind}/>
    <EarlyProof/>
    <JourneyVisitor/>
    <div className="story-body">
      <section className="story-scene" id="content"><header className="scene-heading"><h2>{plan.contentHeading}</h2><p>{plan.contentWhy}</p></header>
        <ResearchReceipt fixture={fixture} kind={kind}/>
        <div className="sample-post post-pair"><ProspectPost fixture={fixture} kind={kind}/><TextPost fixture={fixture} kind={kind}/></div>
        <div id="inbound" className="lead-magnet-scene"><header className="scene-heading"><h2>Give them something worth asking for.</h2><p>{plan.magnetWhy}</p></header><div className="magnet-pair"><TextPost fixture={fixture} kind={kind} promotion/><LeadMagnetTool kind={kind}/></div><EmailCapture kind={kind}/></div>
      </section>
      <div className="followup-pair">
        <section className="story-scene" id="outreach"><header className="scene-heading"><h2>Warm outreach</h2><p>We use their interest to start a conversation and check the project fits.</p></header>
          <article className="sample-chat" data-mockup="linkedin" aria-label="Example LinkedIn conversation"><header><span className="chat-reader"><Visitor/></span><span><b>Alex</b><small>{plan.buyerRole} · example</small></span><span className="chat-linkedin">in</span></header><div className="chat-context">Requested “{plan.magnet}”</div><div className="sample-messages"><div className="sample-message"><Avatar src={founder.avatarUrl} name={founder.name}/><div><b>{founder.name}</b><p>{plan.message}</p></div></div><div className="sample-message is-reader"><span className="reader-initial">A</span><div><b>Alex</b><p>{plan.reply}</p></div></div><AnimatePresence>{messageOpen && <motion.div className="sample-message" initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : .2 }}><Avatar src={founder.avatarUrl} name={founder.name}/><div><b>{founder.name}</b><p>{plan.next}</p></div></motion.div>}</AnimatePresence></div><div className="sample-chat-footer"><button onClick={() => setMessageOpen(v => !v)} aria-expanded={messageOpen}>{messageOpen ? 'Show less' : 'See the next message'} <span aria-hidden="true">{messageOpen ? '↑' : '↓'}</span></button></div></article>
        </section>
        <section className="story-scene" id="newsletter"><header className="scene-heading"><h2>Newsletter</h2><p>Readers who opt in get useful emails until they have a project to discuss.</p></header>
          <article className="sample-email" data-mockup="email" aria-label="Newsletter sample"><div className="sample-email-chrome"><span>←</span><span>Inbox</span><span>✉</span></div><header><h3>{plan.subject}</h3><div><Avatar src={founder.avatarUrl} name={founder.name}/><span><b>{founder.name}</b><small>to Alex</small></span></div></header><div className="sample-email-body"><Paragraphs text={plan.email}/></div><footer>You subscribed to {plan.brand}. <span>Unsubscribe</span></footer></article>
        </section>
        <section className="story-scene cold-sample" id="cold-outreach"><header className="scene-heading"><h2>Signal-based cold outreach</h2><p>Reach buyers with a relevant project, even if they haven’t seen your posts.</p></header>
          <article className="sample-chat" data-mockup="linkedin" aria-label="Example cold outreach"><header><span className="reader-initial">A</span><span><b>Alex</b><small>{plan.buyerRole} · example</small></span><span className="chat-linkedin">in</span></header><div className="cold-trigger"><span>Example trigger</span><b>{plan.coldTrigger}</b></div><div className="sample-messages"><div className="sample-message"><Avatar src={founder.avatarUrl} name={founder.name}/><div><b>{founder.name}</b><p>{plan.coldMessage}</p></div></div></div><footer className="cold-followup">We check who commissioned the work, their role and whether the project fits.</footer></article>
        </section>
      </div>
      <section className="story-scene" id="together"><header className="scene-heading"><h2>How your leads<br/>become qualified calls.</h2></header><RevenueMap kind={kind} founder={founder.firstName}/><div className="service-ownership"><p><b>We run it.</b> We create and publish the content, build your lead magnets and handle outreach through to booking.</p><p><b>You take the calls.</b> Share your expertise with us and meet prospects with a relevant project.</p></div></section>
    </div>
    <ScanResults/>
    <section className="sample-close portrait-close"><img className="closing-portrait" src={asset('/ivan-portrait-800.webp')} alt="Iván Manfredi"/><div><span className="close-byline">Iván Manfredi</span><h2>Make LinkedIn<br/>a revenue line for {plan.brand}.</h2><p>A service we run for you, built to bring in qualified calls.</p><a className="story-primary" href={BOOK} target="_blank" rel="noreferrer">Book a call with me <span aria-hidden="true">↗</span></a><small className="close-duration">30 minutes to see how we’d bring you qualified leads.</small></div></section>
    <footer className="journey-footer"><a href={fixture.source.url} target="_blank" rel="noreferrer">Original scan ↗</a><span>Proposed samples. Alex’s conversation is an example.</span><a href="#top">Back to the start ↑</a></footer>
  </div>;
}
