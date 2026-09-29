import React, {useEffect, useState} from 'react';
import {AnimatePresence, motion, useReducedMotion} from 'framer-motion';
import {ArrowDown, ArrowUpRight} from 'lucide-react';
import {asset, type JourneyFixture} from '../../dev/scan-walkthrough/journey/model';
import type {StoryKind} from '../../dev/scan-walkthrough/journey/connectedModel';
import {Avatar, Paragraphs} from '../../dev/scan-walkthrough/journey/ReadingChapter';
import {ProspectPost, TextPost} from '../../dev/scan-walkthrough/journey/ProspectSamples';
import {LeadMagnetTool} from '../../dev/scan-walkthrough/journey/LeadMagnetTool';
import {EmailCapture} from '../../dev/scan-walkthrough/journey/EmailCapture';
import {RevenueMap} from '../../dev/scan-walkthrough/journey/RevenueMap';
import {ScanResults} from '../../dev/scan-walkthrough/journey/ScanResults';
import {ProfileAuditSection} from '../../dev/scan-walkthrough/journey/ProfileAudit';
import {useStory} from './context';
import {assessAudience} from './assessment';
import {SeeMore} from './SeeMore';
import '../../dev/scan-walkthrough/journey/connected.css';
import '../../dev/scan-walkthrough/journey/bold.css';
import '../../dev/scan-walkthrough/journey/studio.css';
import './story-brand.css';
import './story-plan.css';

const BOOK = 'https://calendly.com/im-ivanmanfredi/30min';
const STEPS = [
 {id: 'content', label: 'Posts'},
 {id: 'resource', label: 'Lead magnets'},
 {id: 'conversations', label: 'Conversations'},
 {id: 'calls', label: 'Booked calls'},
] as const;

/** Headline-safe company name: drop taglines after a separator, skip names too long to set large. */
const headlineName = (name: string) => { const short = name.split(/\s+[-–|:]\s+/)[0].trim(); return short.length <= 24 ? short : ''; };

function PlanHero({fixture}: {fixture: JourneyFixture}) {
 const result = assessAudience(fixture), reduced = useReducedMotion();
 return <section className="sp-hero audit-opening" data-assessment={result.state}>
  <div className="sp-hero-copy">
   <span className="made-for"><Avatar src={fixture.founder.avatarUrl} name={fixture.founder.name}/>Made for {fixture.founder.name}{fixture.founder.company ? ` · ${fixture.founder.company}` : ''}</span>
   <h1>Make your LinkedIn into a true revenue line.</h1>
   <p className="sp-hero-sub">We create inbound and outbound opportunities by content, lead magnets and signal based outreach.</p>
   <ol className="sp-path" aria-label="Your plan in four steps">
    {STEPS.map((s, i) => <li key={s.id}><a href={`#${s.id}`}><span className="sp-path-num">{String(i + 1).padStart(2, '0')}</span>{s.label}</a></li>)}
    <motion.i className="sp-path-line" aria-hidden="true" initial={reduced ? false : {scaleX: 0}} animate={{scaleX: 1}} transition={{duration: reduced ? 0 : 1.4, delay: .3, ease: [.45, 0, .2, 1]}}/>
   </ol>
   <div className="sp-hero-actions">
    <a href="#content" className="story-primary">See what we built for you <ArrowDown size={17} aria-hidden="true"/></a>
    <a className="sp-proof-line" href="https://inboundonsteroids.com/case/kyle-hunt/" target="_blank" rel="noreferrer"><img src={asset('/content-system/kyle-portrait.webp')} alt=""/><span><b>$30k → $80k a month</b> for Kyle Hunt in 90 days. <span className="sp-nowrap">See the case <ArrowUpRight size={13} aria-hidden="true"/></span></span></a>
   </div>
  </div>
  <aside className="sp-audit" aria-label="Findings from the saved scan">
   <header><span>Where you start</span>{result.date && <time>{result.date}</time>}</header>
   <div className="audit-number">{result.state === 'buyers' ? <strong>{result.buyers}<span> / {result.people}</span></strong> : result.state === 'network' ? <strong>{result.networkCount}<span> / {result.networkSample}</span></strong> : result.people !== null ? <strong>{result.people}<span> engagers</span></strong> : null}</div>
   <b className="sp-audit-heading">{result.heading}</b>
   <p>{result.receipt}</p>
   {result.state === 'buyers' && <div className="audience-dots" aria-hidden="true">{Array.from({length: Math.min(result.people!, 100)}, (_, i) => <i key={i} className={i < result.buyers! ? 'is-buyer' : ''}/>)}</div>}
   <footer>{result.rubric && <details><summary>Buyer criteria</summary><p>{result.rubric}.</p></details>}<a href={fixture.source.url} target="_blank" rel="noreferrer">Saved scan <ArrowUpRight size={13} aria-hidden="true"/></a></footer>
  </aside>
 </section>;
}

/** Sticky chapter index: which part of the plan the reader is in, one tap to any other. */
function StepNav() {
 const [active, setActive] = useState<string>('');
 useEffect(() => {
  const els = STEPS.map(s => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
  const io = new IntersectionObserver(entries => { entries.forEach(e => { if (e.isIntersecting) setActive(e.target.id); }); }, {rootMargin: '-40% 0px -55% 0px'});
  els.forEach(el => io.observe(el)); return () => io.disconnect();
 }, []);
 const index = STEPS.findIndex(s => s.id === active);
 return <nav className={`sp-nav ${index >= 0 ? 'is-live' : ''}`} aria-label="Plan sections">
  <div className="sp-nav-inner">
   <ol>{STEPS.map((s, i) => <li key={s.id}><a href={`#${s.id}`} aria-current={active === s.id ? 'step' : undefined} className={i < index ? 'is-done' : ''}>
    {active === s.id && <motion.span layoutId="sp-nav-active" className="sp-nav-active" transition={{type: 'spring', stiffness: 420, damping: 36}}/>}
    <span className="sp-nav-num">{String(i + 1).padStart(2, '0')}</span><span className="sp-nav-label">{s.label}</span></a></li>)}</ol>
   <a className="sp-nav-cta" href={BOOK} target="_blank" rel="noreferrer">Book a call</a>
  </div>
 </nav>;
}

type Option = {key: string; title: string; hint: string; render: () => React.ReactNode; wide?: boolean};

function Chapter({id, n, label, title, why, options, tone = 'paper', aside}: {id: string; n: number; label: string; title: string; why: string; options: Option[]; tone?: 'paper' | 'warm'; aside?: React.ReactNode}) {
 const [active, setActive] = useState(0), reduced = useReducedMotion();
 const o = options[active];
 return <section className="sp-chapter story-scene" id={id} data-tone={tone}>
  <div className={`sp-chapter-inner ${o.wide ? 'is-wide' : ''}`}>
   <div className="sp-copy">
    <span className="sp-eyebrow"><b>{String(n).padStart(2, '0')}</b>{label}</span>
    <h2>{title}</h2>
    <p>{why}</p>
    {options.length > 1 && <div className="sp-options" role="tablist" aria-label={`${label} samples`}>{options.map((x, i) => <button key={x.key} role="tab" id={`${id}-tab-${x.key}`} aria-selected={i === active} aria-controls={`${id}-panel`} onClick={() => setActive(i)}>
     {i === active && <motion.span layoutId={`${id}-opt`} className="sp-option-active" transition={{type: 'spring', stiffness: 420, damping: 38}}/>}
     <b>{x.title}</b><small>{x.hint}</small></button>)}</div>}
    {aside}
   </div>
   <div className="sp-stage" role={options.length > 1 ? 'tabpanel' : undefined} id={`${id}-panel`} aria-labelledby={options.length > 1 ? `${id}-tab-${o.key}` : undefined}>
    <AnimatePresence mode="wait" initial={false}>
     <motion.div key={o.key} className={`sp-exhibit sp-exhibit-${o.key}`} initial={reduced ? false : {opacity: 0, y: 14}} animate={{opacity: 1, y: 0}} exit={reduced ? undefined : {opacity: 0, y: -8}} transition={{duration: reduced ? 0 : .28, ease: [.22, .84, .36, 1]}}>{o.render()}</motion.div>
    </AnimatePresence>
   </div>
  </div>
 </section>;
}

function WarmChat({fixture}: {fixture: JourneyFixture}) {
 const plan = useStory(), founder = fixture.founder, reduced = useReducedMotion();
 const [open, setOpen] = useState(false);
 return <article className="sample-chat" data-mockup="linkedin" aria-label="Example LinkedIn conversation"><header><span className="reader-initial">A</span><span><b>Alex</b><small>{plan.buyerRole} · example</small></span><span className="chat-linkedin">in</span></header><div className="chat-context">Requested “{plan.magnet}”</div>
  <div className="sample-messages"><div className="sample-message"><Avatar src={founder.avatarUrl} name={founder.name}/><div><b>{founder.name}</b><p>{plan.message}</p></div></div><div className="sample-message is-reader"><span className="reader-initial">A</span><div><b>Alex</b><p>{plan.reply}</p></div></div>
   <AnimatePresence>{open && <motion.div className="sample-message" initial={reduced ? false : {opacity: 0, y: 8}} animate={{opacity: 1, y: 0}} exit={{opacity: 0}} transition={{duration: reduced ? 0 : .2}}><Avatar src={founder.avatarUrl} name={founder.name}/><div><b>{founder.name}</b><p>{plan.next}</p></div></motion.div>}</AnimatePresence></div>
  <div className="sample-chat-footer"><button onClick={() => setOpen(v => !v)} aria-expanded={open}>{open ? 'Show less' : 'See the next message'} <span aria-hidden="true">{open ? '↑' : '↓'}</span></button></div>
 </article>;
}

function NewsletterEmail({fixture}: {fixture: JourneyFixture}) {
 const plan = useStory(), founder = fixture.founder;
 return <article className="sample-email" data-mockup="email" aria-label="Newsletter sample"><div className="sample-email-chrome"><span>←</span><span>Inbox</span><span>✉</span></div><header><h3>{plan.subject}</h3><div><Avatar src={founder.avatarUrl} name={founder.name}/><span><b>{founder.name}</b><small>to Alex</small></span></div></header><div className="sample-email-body"><SeeMore lines={7}><Paragraphs text={plan.email}/></SeeMore></div><footer>You subscribed to {plan.brand}. <span>Unsubscribe</span></footer></article>;
}

function ColdChat({fixture}: {fixture: JourneyFixture}) {
 const plan = useStory(), founder = fixture.founder;
 return <article className="sample-chat" data-mockup="linkedin" aria-label="Example cold outreach"><header><span className="reader-initial">A</span><span><b>Alex</b><small>{plan.buyerRole} · example</small></span><span className="chat-linkedin">in</span></header><div className="cold-trigger"><span>Example trigger</span><b>{plan.coldTrigger}</b></div><div className="sample-messages"><div className="sample-message"><Avatar src={founder.avatarUrl} name={founder.name}/><div><b>{founder.name}</b><p>{plan.coldMessage}</p></div></div></div><footer className="cold-followup">We check who commissioned the work, their role and whether the project fits.</footer></article>;
}

export function StoryPlan({fixture, kind}: {fixture: JourneyFixture; kind: StoryKind}) {
 const plan = useStory();
 const brand = headlineName(plan.brand) || 'your brand';
 const segments = plan.segments.filter(s => s.label).slice(0, 4);
 return <div className="connected-journey sample-story revenue-story story-plan">
  <PlanHero fixture={fixture}/>
  <StepNav/>
  {fixture.profileAudit && <div className="sp-profile"><ProfileAuditSection audit={fixture.profileAudit}/></div>}
  <Chapter id="content" n={1} label="Posts" title={plan.contentHeading} why={plan.contentWhy}
   aside={segments.length > 0 && <div className="sp-written-for"><span>Written for</span><ul>{segments.map(s => <li key={s.label}>{s.label}</li>)}</ul></div>}
   options={[
    {key: 'carousel', title: 'Carousel post', hint: `Built in ${brand}’s colours, ready to post.`, render: () => <ProspectPost fixture={fixture} kind={kind}/>},
    {key: 'text', title: 'Text post', hint: 'Written in your voice, for your buyers.', render: () => <TextPost fixture={fixture} kind={kind}/>},
   ]}/>
  <Chapter id="resource" n={2} tone="warm" label="Lead magnets" title="Turn readers into a list you own." why={plan.magnetWhy}
   options={[
    {key: 'magnet-post', title: 'The post', hint: plan.keyword ? `One comment, “${plan.keyword}”, and they raise their hand.` : 'One comment and they raise their hand.', render: () => <TextPost fixture={fixture} kind={kind} promotion/>},
    {key: 'resource', title: 'The lead magnet', hint: `Worth an email address. Built for ${brand}.`, wide: true, render: () => <LeadMagnetTool kind={kind}/>},
    {key: 'signup', title: 'The signup', hint: 'Every download becomes a name you own.', render: () => <EmailCapture kind={kind}/>},
   ]}/>
  <Chapter id="conversations" n={3} label="Conversations" title="Every raised hand gets a conversation." why="We message the people who engage, keep readers warm by email and reach buyers with a live project, even if they never saw your posts."
   options={[
    {key: 'warm', title: 'Warm reply', hint: 'They asked for it. We open the conversation.', render: () => <WarmChat fixture={fixture}/>},
    {key: 'newsletter', title: 'Newsletter', hint: 'Stays in their inbox until the project is ready.', render: () => <NewsletterEmail fixture={fixture}/>},
    {key: 'cold', title: 'Signal-based outreach', hint: 'Buyers with a live project, reached while it is live.', render: () => <ColdChat fixture={fixture}/>},
   ]}/>
  <section className="sp-chapter sp-calls story-scene" id="calls" data-tone="warm">
   <div className="sp-calls-head"><span className="sp-eyebrow"><b>04</b>Booked calls</span><h2>You only take calls that already fit.</h2><p>We check fit, timing and who decides before anything gets booked. You walk in knowing the project.</p></div>
   <RevenueMap kind={kind} founder={fixture.founder.firstName}/>
   <div className="sp-ownership"><div><b>We run all of it.</b><p>Posts, lead magnets, outreach and follow-up, every week, through to the booked call.</p></div><div><b>You take the calls.</b><p>Your calendar fills with people who have a real project and a reason to talk to you.</p></div></div>
  </section>
  <div className="sp-results"><span className="sp-eyebrow sp-eyebrow-center">Founders we run this for</span><ScanResults/></div>
  <section className="sp-close">
   <img src={asset('/ivan-portrait-800.webp')} alt="Iván Manfredi"/>
   <div><span className="close-byline">Iván Manfredi</span><h2>Your first posts are already written.</h2><p>Everything above was made for {headlineName(plan.brand) || 'you'}. One call and it starts going out.</p><a className="story-primary sp-close-cta" href={BOOK} target="_blank" rel="noreferrer">Book a call with me <ArrowUpRight size={18} aria-hidden="true"/></a><small>30 minutes. We walk you through the whole plan.</small></div>
  </section>
  <footer className="journey-footer"><a href="#top">Back to the start ↑</a></footer>
 </div>;
}
