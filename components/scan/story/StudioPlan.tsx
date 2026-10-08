import React, {useEffect, useState} from 'react';
import {motion, useReducedMotion} from 'framer-motion';
import {ArrowDown, ArrowRight, ArrowUpRight} from 'lucide-react';
import {asset, type JourneyFixture} from '../../dev/scan-walkthrough/journey/model';
import type {StoryKind} from '../../dev/scan-walkthrough/journey/connectedModel';
import {Avatar} from '../../dev/scan-walkthrough/journey/ReadingChapter';
import {ProspectPost, TextPost} from './StudioSamples';
import {EmailCapture} from '../../dev/scan-walkthrough/journey/EmailCapture';
import {StudioResults} from './StudioResults';
import {ProfileAuditSection} from '../../dev/scan-walkthrough/journey/ProfileAudit';
import {useStory} from './context';
import {assessAudience} from './assessment';
import {NumberTicker} from './motion';
import {StoryFlow, readerName, fillName} from './StudioFlow';
import {LeadMagnetPage} from './LeadMagnetPage';
import {StudioBrain} from './StudioBrain';
import {ImagePost} from './StudioImagePost';
import {reachFrom} from './FeedDiagnosis';
import {DiagnosisArtifacts} from './DiagnosisArtifacts';
import {GmailNewsletter} from './GmailNewsletter';
import '../../dev/scan-walkthrough/journey/connected.css';
import '../../dev/scan-walkthrough/journey/bold.css';
import '../../dev/scan-walkthrough/journey/studio.css';
import './story-brand.css';
import './story-plan.css';
import './story-motion.css';

function ChapterTitle({text}:{text:string}) {return <h2>{text}</h2>}

const BOOK = 'https://calendly.com/im-ivanmanfredi/30min';
const STEPS = [
 {id: 'content', label: 'Content'},
 {id: 'resource', label: 'Lead magnets'},
 {id: 'conversations', label: 'Conversations'},
 {id: 'calls', label: 'Booked calls'},
] as const;

/** Headline-safe company name: drop taglines after a separator, skip names too long to set large. */
const headlineName = (name: string) => { const short = name.split(/\s+[-–|:]\s+/)[0].trim(); return short.length <= 24 ? short : ''; };

function PlanHero({fixture}: {fixture: JourneyFixture}) {
 const result = assessAudience(fixture), reduced = useReducedMotion(), reach = reachFrom(fixture);
 return <section className="sp-hero audit-opening" data-assessment={result.state}>
  <div className="sp-hero-copy">
   <span className="made-for"><Avatar src={fixture.founder.avatarUrl} name={fixture.founder.name}/>Made for {fixture.founder.name}{fixture.founder.company ? ` · ${fixture.founder.company}` : ''}</span>
   <h1><span>Make your LinkedIn</span><span>into a true</span><span><mark>revenue line.</mark></span></h1>
   <p className="sp-hero-sub">Create inbound and outbound opportunities by content, lead magnets and signal based outreach.</p>
   <p className="studio-mobile-finding">{result.heading}</p>
   <ol className="sp-path" aria-label="Your plan in four steps">
    <li className="sp-path-bracket" aria-hidden="true"><span>Inbound</span></li>
    <li className="sp-path-bracket is-out" aria-hidden="true"><span>Outbound</span></li>
    {STEPS.map((s, i) => <li key={s.id}><a href={`#${s.id}`}><span className="sp-path-num">{String(i + 1).padStart(2, '0')}</span>{s.label}</a></li>)}
    <motion.i className="sp-path-line" aria-hidden="true" initial={reduced ? false : {scaleX: 0}} animate={{scaleX: 1}} transition={{duration: reduced ? 0 : 1.4, delay: .3, ease: [.45, 0, .2, 1]}}/>
   </ol>
   <div className="sp-hero-actions">
    <a href="#diagnosis" className="studio-primary">See your scale plan <ArrowDown size={17} aria-hidden="true"/></a>
    <a className="sp-proof-line" href="https://inboundonsteroids.com/case/kyle-hunt/" target="_blank" rel="noreferrer"><img src={asset('/content-system/kyle-portrait.webp')} alt=""/><span><b>$30k → $80k a month</b> for Kyle Hunt in 90 days. <span className="sp-nowrap">See the case <ArrowUpRight size={13} aria-hidden="true"/></span></span></a>
   </div>
  </div>
  <motion.aside className="sp-audit" aria-label="Findings from the saved scan" initial={reduced ? false : {opacity:0,y:16}} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:.15}} transition={{duration:.8,ease:[.16,1,.3,1]}}>
   <header><span>Where you start</span>{result.date && <time>{result.date}</time>}</header>
   <div className="audit-number">{result.state === 'buyers' ? <strong><NumberTicker value={result.buyers!}/><span> / <NumberTicker value={result.people!}/></span></strong> : result.state === 'network' ? <strong><NumberTicker value={result.networkCount!}/><span> / {result.networkSample}</span></strong> : result.people !== null ? <strong><NumberTicker value={result.people!}/><span> engagers</span></strong> : null}</div>
   <b className="sp-audit-heading">{result.heading}</b>
   <p>{result.receipt}</p>
   {reach && <><div className="sp-reach"><div><strong><NumberTicker value={reach.people}/></strong><small>engaged with your last {reach.posts} posts</small></div><ArrowRight size={18} aria-hidden="true"/><div><strong>≈<NumberTicker value={reach.leads}/></strong><small>named leads a month, with the system</small></div></div><span className="sp-reach-note">~{reach.readers} readers per post at ~15 per engager, 4 posts a week, 0.5% leave their email.</span></>}
   {result.state === 'buyers' && (() => { const per = Math.max(1, Math.ceil(result.people! / 60)), dots = Math.ceil(result.people! / per), lit = Math.max(1, Math.round(result.buyers! / per)); return <><div className="audience-dots" aria-hidden="true">{Array.from({length: dots}, (_, i) => <i key={i} className={i < lit ? 'is-buyer' : ''}/>)}</div>{per > 1 && <small className="sp-dots-key">Each dot is about {per} people.</small>}</>; })()}
   <footer>{result.rubric && <details><summary>Buyer criteria</summary><p>{result.rubric}.</p></details>}</footer>
  </motion.aside>
 </section>;
}

/** Sticky chapter index: which part of the plan the reader is in, one tap to any other. */
function StepNav() {
 const [active, setActive] = useState<string>('');
 const [visible, setVisible] = useState(false);
 useEffect(() => {
  const hero = document.querySelector('.sp-hero');
  if (!hero) return;
  const observer = new IntersectionObserver(([entry]) => setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0));
  observer.observe(hero);
  return () => observer.disconnect();
 }, []);
 useEffect(() => {
  const els = STEPS.map(s => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
  const io = new IntersectionObserver(() => {
   const readingLine = window.innerHeight * .45;
   const current = els.find(el => { const bounds = el.getBoundingClientRect(); return bounds.top <= readingLine && bounds.bottom > readingLine; });
   setActive(current?.id ?? '');
  }, {rootMargin: '-40% 0px -55% 0px'});
  els.forEach(el => io.observe(el)); return () => io.disconnect();
 }, []);
 const index = STEPS.findIndex(s => s.id === active);
 return <nav className={`sp-nav ${index >= 0 ? 'is-live' : ''} ${visible ? 'is-visible' : ''}`} inert={!visible} aria-hidden={!visible} aria-label="Plan sections">
  <div className="sp-nav-inner">
   <ol>{STEPS.map((s, i) => <li key={s.id} className={i === 2 ? 'sp-nav-split' : ''}>{(i === 0 || i === 2) && <span className="sp-nav-group" aria-hidden="true">{i === 0 ? 'Inbound' : 'Outbound'}</span>}<a href={`#${s.id}`} aria-current={active === s.id ? 'step' : undefined} className={i < index ? 'is-done' : ''}>
    {active === s.id && <motion.span layoutId="sp-nav-active" className="sp-nav-active" transition={{type: 'spring', stiffness: 420, damping: 36}}/>}
    <span className="sp-nav-num">{String(i + 1).padStart(2, '0')}</span><span className="sp-nav-label">{s.label}</span></a></li>)}</ol>
   <a className="sp-nav-cta" href={BOOK} target="_blank" rel="noreferrer">Book a call</a>
  </div>
 </nav>;
}

type Sample = {key: string; title?: string; hint?: string; render: () => React.ReactNode; full?: boolean};

function ResourcePreview({kind, domain}: {kind: StoryKind; domain: string}) {
 const [open, setOpen] = useState(false);
 return <div className={`studio-resource ${open ? 'is-open' : ''}`}>
  <div id="resource-preview-body" className={`studio-resource-window ${open ? 'is-open' : ''}`} inert={!open} aria-hidden={!open}><LeadMagnetPage kind={kind} domain={domain}/></div>
  <button className="studio-resource-toggle" aria-expanded={open} aria-controls="resource-preview-body" onClick={() => setOpen(v => !v)}><span>{open ? 'Close preview ↑' : 'Open the resource ↗'}</span></button>
 </div>;
}

/** Every sample on show at once, side by side, each with the one line on what it does for them. */
function Chapter({id, n, label, title, why, samples, cols = 2, tone = 'paper', aside, headerVisual, after}: {id: string; n: number; label: string; title: string; why: string; samples: Sample[]; cols?: 2 | 3; tone?: 'paper' | 'warm'; aside?: React.ReactNode; headerVisual?: React.ReactNode; after?: React.ReactNode}) {
 const reduced = useReducedMotion();
 return <section className="sp-chapter story-scene" id={id} data-tone={tone}>
  <header className={`sp-chapter-head ${headerVisual ? 'has-brain' : ''}`}>
   <div><span className="sp-eyebrow"><b>{String(n).padStart(2, '0')}</b>{label}<em className="sp-eyebrow-group">{n <= 2 ? 'Inbound' : 'Outbound'}</em></span><ChapterTitle text={title}/>{headerVisual && <div className="sp-content-intro"><p>{why}</p>{aside}</div>}</div>
   {headerVisual || <div><p>{why}</p>{aside}</div>}
  </header>
  <div className={`sp-stage sp-grid sp-grid-${cols}`}>
   {samples.map((x, i) => <motion.figure key={x.key} className={`sp-exhibit sp-exhibit-${x.key} ${x.full ? 'is-full' : ''}`} initial={reduced ? false : {opacity: 0, y: 14}} whileInView={{opacity: 1, y: 0}} viewport={{once: true, amount: .1}} transition={{duration: reduced ? 0 : .5, delay: reduced ? 0 : i * .055, ease: [.22, .84, .36, 1]}}>
    {x.title && <figcaption><b>{x.title}</b><span>{x.hint}</span></figcaption>}
    {x.render()}
   </motion.figure>)}
  </div>
  {after}
 </section>;
}

/** Short bubbles the way people actually message: a long paragraph becomes two or three sends. */
const bubbles = (text: string) => {
 const parts = text.split(/(?<=[.?!])\s+(?=[A-Z¿¡])/).filter(Boolean);
 if (parts.length <= 2) return parts;
 return [parts[0], parts.slice(1, -1).join(' '), parts[parts.length - 1]];
};

function Thread({children}: {children: React.ReactNode}) {
 const reduced = useReducedMotion();
 return <motion.div className="sp-dm-thread" initial={reduced ? false : 'hide'} whileInView="show" viewport={{once: true, amount: .35}} variants={{show: {transition: {staggerChildren: .08}}}}>{children}</motion.div>;
}
const Bubble = ({mine, children}: {mine?: boolean; children: React.ReactNode}) => <motion.p className={mine ? 'is-mine' : ''} variants={{hide: {opacity: 0, y: 14, scale: .97}, show: {opacity: 1, y: 0, scale: 1, transition: {type: 'spring', stiffness: 260, damping: 24}}}}>{children}</motion.p>;

function DmHead({name, role}: {name: string; role: string}) {
 return <header className="sp-dm-head"><span className="sp-dm-avatar">{name[0]}</span><span><b>{name}</b><small>{role}</small></span><span className="chat-linkedin">in</span></header>;
}

function WarmChat() {
 const plan = useStory(), name = readerName(plan);
 return <article className="sp-dm" data-mockup="linkedin" aria-label="Example LinkedIn conversation">
  <DmHead name={name} role={plan.buyerRole}/>
  <div className="sp-dm-context">Commented <b>{plan.keyword}</b> and got “{plan.magnet.split(/[:.]/)[0]}”</div>
  <Thread>
   {bubbles(fillName(plan.message, name)).map((t, i) => <Bubble key={'a' + i} mine>{t}</Bubble>)}
   <Bubble>{fillName(plan.reply, name)}</Bubble>
   {bubbles(fillName(plan.next, name)).map((t, i) => <Bubble key={'b' + i} mine>{t}</Bubble>)}
  </Thread>
 </article>;
}

function ColdChat() {
 const plan = useStory(), name = readerName(plan);
 return <article className="sp-dm" data-mockup="linkedin" aria-label="Example signal-based outreach">
  <div className="sp-signal"><span className="sp-signal-badge"><i/>The signal we watch for</span><b>{plan.coldTrigger}</b><small>We reach out while the project is live.</small></div>
  <DmHead name={name} role={plan.buyerRole}/>
  <Thread>{bubbles(fillName(plan.coldMessage, name)).map((t, i) => <Bubble key={i} mine>{t}</Bubble>)}</Thread>
 </article>;
}

export function StudioPlan({fixture, kind}: {fixture: JourneyFixture; kind: StoryKind}) {
 const plan = useStory(), rationale = plan.rationale;
 const brand = headlineName(plan.brand) || 'your brand';
 return <div className="connected-journey sample-story revenue-story story-plan">
  <PlanHero fixture={fixture}/>
  <StepNav/>
  <div id="diagnosis" style={{scrollMarginTop:110}}><DiagnosisArtifacts fixture={fixture}/></div>
  {fixture.profileAudit && <div className="sp-profile"><ProfileAuditSection audit={fixture.profileAudit}/></div>}
  <Chapter headerVisual={plan.topicMap && <StudioBrain map={plan.topicMap} name={fixture.founder.name}/>} id="content" n={1} label="Content" title={plan.contentHeading} why={rationale?.content ?? plan.contentWhy}
   cols={3} samples={[
    {key: 'carousel', render: () => <ProspectPost fixture={fixture} kind={kind}/>},
    {key: 'text', render: () => <TextPost fixture={fixture} kind={kind}/>},
    {key: 'image', render: () => <ImagePost fixture={fixture}/>},
   ]}/>
  <Chapter id="resource" n={2} tone="warm" label="Lead magnets" title="Turn readers into a list you own." why={rationale?.resource ?? plan.magnetWhy}
   cols={2} samples={[
    {key: 'magnet-post', title: 'The post', hint: plan.keyword ? `One comment, “${plan.keyword}”, and they raise their hand.` : 'One comment and they raise their hand.', render: () => <TextPost fixture={fixture} kind={kind} promotion/>},
    {key: 'signup', title: 'The signup', hint: 'Every download becomes a name you own.', render: () => <EmailCapture kind={kind}/>},
    {key: 'resource', title: 'The lead magnet', hint: `Worth an email address. Built for ${brand}.`, full: true, render: () => <ResourcePreview kind={kind} domain={fixture.domain}/>},
   ]}/>
  <Chapter id="conversations" n={3} label="Conversations" title="Every raised hand gets a conversation." why={rationale?.conversations ?? "We message the people who engage, keep readers warm by email and reach buyers with a live project, even if they never saw your posts."}
   cols={2} samples={[
    {key: 'warm', title: 'Warm reply', hint: 'They asked for it. We open the conversation.', render: () => <WarmChat/>},
    {key: 'cold', title: 'Signal-based outreach', hint: 'Another way this conversation can start: a buyer with a live project.', render: () => <ColdChat/>},
    {key: 'newsletter', title: 'Newsletter', hint: 'Stays in their inbox until the project is ready.', full: true, render: () => <GmailNewsletter fixture={fixture}/>},
   ]}/>
  <section className="sp-chapter sp-calls story-scene" id="calls" data-tone="warm">
   <div className="sp-calls-head"><span className="sp-eyebrow"><b>04</b>Booked calls<em className="sp-eyebrow-group">Outbound</em></span><ChapterTitle text="You only take calls that already fit."/><p>{rationale?.calls ?? "We check fit, timing and who decides before anything gets booked. You walk in knowing the project."}</p></div>
   <StoryFlow founder={fixture.founder.firstName}/>
   <div className="sp-ownership"><div><b>We run all of it.</b><p>Posts, lead magnets, outreach and follow-up, every week, through to the booked call.</p></div><div><b>You take the calls.</b><p>Your calendar fills with people who have a real project and a reason to talk to you.</p></div></div>
  </section>
  <StudioResults/>
  <section className="sp-close">
   <img src={asset('/ivan-portrait-800.webp')} alt="Iván Manfredi"/>
   <div><span className="close-byline">Iván Manfredi</span><h2>Your next clients are already on LinkedIn.</h2><p>{rationale?.close ?? "We find them, start the conversation and put them on your calendar. Let’s map the process around your business."}</p><a className="studio-primary sp-close-cta" href={BOOK} target="_blank" rel="noreferrer">Book a call with me <ArrowUpRight size={18} aria-hidden="true"/></a><small>30 minutes with me. You leave with the plan either way.</small></div>
  </section>
  <footer className="journey-footer"><a href="#top">Back to the start ↑</a></footer>
 </div>;
}
