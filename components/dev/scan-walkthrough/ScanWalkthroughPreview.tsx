import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useSpring } from 'framer-motion';
import { buyers, founder, decisionPlans, type Decision } from './data';
import ScanDetailExplorer, { type DetailSection } from './ScanDetailExplorer';
import './scan-walkthrough.css';
import './guided-story.css';
import { ResearchArtifact, LinkedInActions, LinkedInBackdrop, ClientToolsShowcase, StorySound } from './StoryExhibits';
import './story-exhibits.css';

const ease = [0.22, 0.84, 0.36, 1] as const;
const detailTitles: Record<DetailSection, string> = { buyers: 'Who we’d reach', content: 'Your content week', inbound: 'Your lead magnet journey', outreach: 'Your outreach examples', proof: 'Existing client work' };
const situations: Record<string, { name: string; task: string; question: string }> = {
  brand: { name: 'A brand marketing lead.', task: 'Planning their next campaign.', question: 'Why did customers choose another brand?' },
  agency: { name: 'A strategy agency founder.', task: 'Preparing a client’s creative brief.', question: 'Which customer stories belong in this brief?' },
  research: { name: 'A customer insight lead.', task: 'Scoping a brand-switching study.', question: 'What prompted the change between brands?' },
};
const chapters = [{ id: 'buyer', name: 'The buyer' }, { id: 'content', name: 'The post' }, { id: 'inbound', name: 'The resource' }, { id: 'lead', name: 'The enquiry' }, { id: 'outreach', name: 'The conversation' }, { id: 'strategy', name: 'Together' }];

function Headline({ lines, className = '', hero = false }: { lines: string[]; className?: string; hero?: boolean }) {
  const reduced = useReducedMotion();
  const Tag = hero ? motion.h1 : motion.h2;
  return <Tag className={`sg-display ${className}`} aria-label={lines.join(' ')} initial={hero ? "hidden" : false} whileInView="visible" viewport={{ once: true, amount: .25 }}>
    {lines.map((line, i) => <span className={`sg-line ${hero && i === lines.length - 1 ? 'sg-hero-emphasis' : ''}`} key={line} aria-hidden="true"><motion.span variants={{ hidden: { y: reduced || !hero ? 0 : '105%' }, visible: { y: 0 } }} transition={{ duration: reduced ? 0 : .85, ease, delay: i * .075 }}>{line}</motion.span>{hero && i === lines.length - 1 && <motion.svg className="sg-emphasis-line" viewBox="0 0 1000 18" preserveAspectRatio="none" aria-hidden="true"><motion.path d="M4 10 C250 4 750 4 996 10" fill="none" stroke="currentColor" strokeWidth="5" initial={{ pathLength: reduced ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduced ? 0 : 1.1, delay: .65, ease }} /></motion.svg>}</span>)}
  </Tag>;
}
function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const reduced = useReducedMotion();
  return <motion.div className={className} initial={reduced ? false : { opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .15 }} transition={{ duration: .7, ease, delay }}>{children}</motion.div>;
}
function Author() {
  return <div className="sg-author"><img src={founder.avatar} alt="" width="42" height="42" /><div><strong>Andrew Hayes</strong><span>Customer research at CueVu</span></div><span className="sg-draft">Proposed post</span></div>;
}
const postMoments = [
  { label: 'The method', lines: ['What were', 'you feeling', 'when it happened?'], intro: 'Start with the moment someone changed brands.', footer: 'Inside the research' },
  { label: 'The deliverable', lines: ['Keep their words', 'in the results', 'file.'], intro: 'The results file keeps the customer’s own words.', footer: 'From the response to the brief' },
  { label: 'The invitation', lines: ['Use it in your', 'next research', 'brief.'], intro: 'A starting brief for your next switching study.', footer: 'Open the research planner' },
];
function ContentScene({ onOpen, onPlannerOpen }: { onOpen: () => void; onPlannerOpen: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const [moment, setMoment] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  useMotionValueEvent(scrollYProgress, 'change', value => {
    if (!reduced) setMoment(value < .32 ? 0 : value < .67 ? 1 : 2);
  });
  const chooseMoment = (index: number) => {
    setMoment(index);
    if (!reduced && ref.current) {
      const top = window.scrollY + ref.current.getBoundingClientRect().top;
      window.scrollTo({ top: top + (ref.current.offsetHeight - window.innerHeight) * [.1, .5, .85][index], behavior: 'smooth' });
    }
  };
  const item = postMoments[moment];
  return <section id="content" className="sg-scroll-scene" ref={ref} data-story-scene>
    <div className="sg-stage">
      <Headline lines={['Let your research', 'do the talking.']} />
      <div className="sg-post-stack">
        <div className="sg-linkedin-context" aria-hidden="true"><b>in</b><span>In your buyer’s feed</span></div>
        <article data-mockup="linkedin" className="sg-story-post">
          <Author /><div className="sg-post-intro"><AnimatePresence mode="wait" initial={false}><motion.p key={moment} initial={{ opacity: reduced ? 1 : 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .16 }}>{item.intro}</motion.p></AnimatePresence></div>
          <button className="sg-post-sheet" onClick={moment === 2 ? onPlannerOpen : onOpen} aria-label={moment === 2 ? "Open the research planner" : "Open the posts and carousel"}><ResearchArtifact moment={moment} /></button>
          <LinkedInActions />
        </article>
        <div className="sg-post-progress" aria-label="Content story">{postMoments.map((m, i) => <button key={m.label} aria-pressed={i === moment} aria-label={`Show ${m.label.toLowerCase()}`} onClick={() => chooseMoment(i)}><span><motion.i animate={{ scaleX: i <= moment ? 1 : 0 }} transition={{ duration: reduced ? 0 : .5, ease }} /></span><small>{m.label}</small></button>)}</div>
      </div>
      <button className="sg-text-link" onClick={onOpen}>Explore the content week <span aria-hidden="true">↗</span></button>
    </div>
  </section>;
}
function ResourceScene({ onOpen, category, onCategoryChange, decision }: { onOpen: (view: number) => void; category: string; onCategoryChange: (value: string) => void; decision: Decision }) {
  const reduced = useReducedMotion();
  const [built, setBuilt] = useState(false);
  const plan = decisionPlans[decision];
  useEffect(() => { setBuilt(false); }, [category, decision]);
  return <section id="inbound" className="sg-resource-chapter" data-story-scene>
    <div className="sg-stage">
      <Headline lines={['Turn curiosity', 'into a project.']} />
      <p className="sg-one-line">Give them a useful next step.</p>
      <Reveal className="sg-resource-assembly">
        <motion.div className="sg-resource-cover" layout transition={{ duration: reduced ? 0 : .55, ease }}>
          <div className="sg-resource-brand">CueVu <span>Resource concept</span></div>
          <AnimatePresence mode="wait" initial={false}>
            {!built ? <motion.div key="setup" className="sg-brief-step" initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : -12 }} transition={{ duration: reduced ? 0 : .25, ease }}>
              <h3>Your next<br />research brief.</h3><p>Choose a category to try it.</p>
              <div className="sg-category-tabs" aria-label="Example product category">{['Pet food', 'Coffee', 'Skincare'].map(value => <button key={value} aria-pressed={category === value} onClick={() => onCategoryChange(value)}>{value}{category === value && <motion.span layoutId="category-choice" transition={{ duration: reduced ? 0 : .35, ease }} />}</button>)}</div>
              <button className="sg-build-brief" onClick={() => setBuilt(true)}>Build a sample brief <span aria-hidden="true">↗</span></button>
            </motion.div> : <motion.div key="result" className="sg-brief-step sg-brief-result" initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : -12 }} transition={{ duration: reduced ? 0 : .35, ease }}>
              <span className="sg-result-status"><span aria-hidden="true">✓</span> Your sample brief</span><h3>{category.trim() || 'Your category'}<br />research.</h3><p>{plan.label}</p><div className="sg-brief-question"><span>A starting interview question</span><strong>{plan.questions[0]}</strong></div><button className="sg-build-brief" onClick={() => onOpen(2)}>Open the complete planner <span aria-hidden="true">↗</span></button><button className="sg-reset-brief" onClick={() => setBuilt(false)}>Change the category</button>
            </motion.div>}
          </AnimatePresence>
        </motion.div>
      </Reveal>
      <button className="sg-text-link" onClick={() => onOpen(1)}>Try the page and research planner <span aria-hidden="true">↗</span></button>
    </div>
  </section>;
}
function BuyerPicker({ buyerId, onChoose, onOpen }: { buyerId: string; onChoose: (value: string) => void; onOpen: () => void }) {
  const reduced = useReducedMotion();
  const situation = situations[buyerId];
  return <Reveal className="sg-buyer-picker"><div className="sg-buyer-tabs" aria-label="Choose a proposed buyer">{[{ id: 'brand', label: 'Brand teams' }, { id: 'agency', label: 'Agencies' }, { id: 'research', label: 'Insight teams' }].map(item => <button key={item.id} aria-pressed={buyerId === item.id} onClick={() => onChoose(item.id)}>{item.label}{buyerId === item.id && <motion.span layoutId="buyer-selection" transition={{ duration: reduced ? 0 : .4, ease }} />}</button>)}</div>
    <div className="sg-buyer-transition"><AnimatePresence mode="wait" initial={false}><motion.div key={buyerId} initial={{ y: reduced ? 0 : 12, opacity: reduced ? 1 : 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: reduced ? 0 : -8, opacity: 0 }} transition={{ duration: reduced ? 0 : .25, ease }}><div className="sg-buyer-person"><span className="sg-person-mark" aria-hidden="true"><svg viewBox="0 0 64 64"><circle cx="32" cy="20" r="9" /><path d="M14 55v-8a18 18 0 0 1 36 0v8" /></svg></span><h3>{situation.name}</h3><p>{situation.task}</p></div><p className="sg-buyer-question">{situation.question}</p></motion.div></AnimatePresence></div>
    <button className="sg-text-link" onClick={onOpen}>Explore the buyer profiles <span aria-hidden="true">↗</span></button><span className="sg-example-note">Proposed audience</span>
  </Reveal>;
}
function Conversation({ category, buyerMessage, onOpen }: { category: string; buyerMessage: string; onOpen: () => void }) {
  const [route, setRoute] = useState<'warm' | 'cold'>('warm');
  const reduced = useReducedMotion();
  return <section id="outreach" className="sg-outreach-chapter" data-story-scene><Headline lines={['Pick up the', 'conversation.']} />
    <Reveal className="sg-outreach-demo"><div className="sg-route-tabs"><button aria-pressed={route === 'warm'} onClick={() => setRoute('warm')}>From your content{route === 'warm' && <motion.span layoutId="outreach-choice" transition={{ duration: reduced ? 0 : .4, ease }} />}</button><button aria-pressed={route === 'cold'} onClick={() => setRoute('cold')}>Researched outreach{route === 'cold' && <motion.span layoutId="outreach-choice" transition={{ duration: reduced ? 0 : .4, ease }} />}</button></div>
      <div className="sg-conversation-stage"><AnimatePresence mode="wait" initial={false}><motion.div key={`${route}-${category}`} initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : -10 }} transition={{ duration: reduced ? 0 : .35, ease }}><p className="sg-route-context">{route === 'warm' ? 'They used the planner. We follow up.' : 'We find a relevant project and open the conversation.'}</p>
        {route === 'warm' && <div className="sg-context-slip"><span>From their enquiry</span><strong>{category.trim() || 'Your category'} research</strong><span aria-hidden="true">↓</span></div>}
        <div className="sg-chat" data-mockup="message"><Author /><p>{route === 'warm' ? `For the ${category.trim().toLowerCase() || 'selected category'} brief, which brands are you comparing? That will help us narrow down who to hear from.` : buyerMessage}</p><span>Proposed message</span></div>
      </motion.div></AnimatePresence></div><button className="sg-text-link" onClick={onOpen}>Explore the outreach examples <span aria-hidden="true">↗</span></button>
    </Reveal>
  </section>;
}
function Strategy({ onOpen }: { onOpen: (section: DetailSection, view?: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 70%', 'end 70%'] });
  const scaleY = useSpring(scrollYProgress, { stiffness: 150, damping: 32 });
  const steps: { title: string; note: string; section: DetailSection; view: number }[] = [
    { title: 'The right buyer.', note: 'We research who needs CueVu.', section: 'buyers', view: 0 },
    { title: 'Your expertise.', note: 'We turn it into content.', section: 'content', view: 0 },
    { title: 'A useful resource.', note: 'We build the next step.', section: 'inbound', view: 1 },
    { title: 'A real enquiry.', note: 'We capture the project details.', section: 'inbound', view: 3 },
    { title: 'A conversation.', note: 'We follow up with context.', section: 'outreach', view: 0 },
  ];
  return <section id="strategy" className="sg-strategy" data-story-scene>
    <Headline lines={['See how it', 'comes together.']} />
    <div className="sg-strategy-spine" ref={ref}>
      <div className="sg-spine-track" aria-hidden="true"><motion.div style={reduced ? { scaleY: 1 } : { scaleY }} /></div>
      {steps.map(step => <Reveal key={step.title} className="sg-strategy-step"><button onClick={() => onOpen(step.section, step.view)}><span className="sg-spine-point" aria-hidden="true" /><strong>{step.title}</strong><span>{step.note}</span></button></Reveal>)}
    </div>
    <p className="sg-strategy-note">Researched outreach opens another route<br />to the same conversation.</p>
  </section>;
}

export default function ScanWalkthroughPreview() {
  const [buyerId, setBuyerId] = useState('brand');
  const [category, setCategory] = useState('Pet food');
  const buyer = buyers.find(b => b.id === buyerId)!;
  const situation = situations[buyerId];
  const [active, setActive] = useState('');
  const [section, setSection] = useState<DetailSection>('content');
  const [initialView, setInitialView] = useState(0);
  const [requestKey, setRequestKey] = useState(0);
  const [openedOnce, setOpenedOnce] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const showDetail = (next: DetailSection, view = 0) => {
    setSection(next); setInitialView(view); setRequestKey(k => k + 1); setOpenedOnce(true); setDialogOpen(true);
  };
  useLayoutEffect(() => {
    if (!dialogOpen) return;
    if (!dialog.current?.open) dialog.current?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [dialogOpen]);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id);
    }, { rootMargin: '-30% 0px -50% 0px' });
    document.querySelectorAll('[data-story-scene]').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  const closeDetail = () => dialog.current?.close();
  return <div className="sg-root">
    <header className="sg-header"><a className="sg-wordmark" href="#top" aria-label="InboundOnSteroids">INBOUND<b>ON</b>STEROIDS</a><a className="sg-header-link" href="#strategy">See the whole strategy <span aria-hidden="true">↗</span></a><StorySound /></header>
    <nav className="sg-chapter-rail" aria-label="Story chapters">{chapters.map(chapter => <a href={`#${chapter.id}`} key={chapter.id} aria-label={chapter.name} aria-current={active === chapter.id ? 'step' : undefined}><span /><span>{chapter.name}</span></a>)}</nav>
    <main id="top">
      <section className="sg-hero" data-story-scene id="opening">
        <LinkedInBackdrop /><Reveal className="sg-for"><img src={founder.avatar} alt="" width="36" height="36" /><span>Andrew Hayes <span>/ CueVu</span></span></Reveal>
        <Headline hero lines={['Your research.', 'Their next', 'big decision.']} />
        <Reveal className="sg-hero-bottom" delay={.2}><p>A LinkedIn strategy<br />built around CueVu.</p><a href="#buyer" className="sg-start">Follow the story <span aria-hidden="true">↗</span></a></Reveal>
        <span className="sg-preview-note">Proposed strategy / Interactive preview</span>
      </section>
      <section id="buyer" className="sg-buyer-chapter" data-story-scene>
        <Headline lines={['Start with', 'who needs you.']} />
        <BuyerPicker buyerId={buyerId} onChoose={setBuyerId} onOpen={() => showDetail('buyers')} />
      </section>
      <ContentScene onOpen={() => showDetail('content')} onPlannerOpen={() => showDetail('inbound', 2)} />
      <ClientToolsShowcase />
      <ResourceScene category={category} onCategoryChange={setCategory} decision={buyer.decision as Decision} onOpen={view => showDetail('inbound', view)} />
      <section id="lead" className="sg-lead-chapter" data-story-scene>
        <Headline lines={['Know who’s', 'planning what.']} />
        <Reveal className="sg-lead-artifact"><div className="sg-lead-top"><span className="sg-cuevu">CueVu</span><span>Illustrative enquiry</span></div><div className="sg-lead-title"><span>Someone used your planner.</span><strong>{situation.name}</strong></div><dl><div><dt>Category</dt><dd>{category.trim() || 'Your category'}</dd></div><div><dt>Project</dt><dd>{situation.task}</dd></div><div><dt>Source</dt><dd>Your LinkedIn resource</dd></div></dl><button className="sg-text-link" onClick={() => showDetail('inbound', 3)}>Explore the lead and follow-up <span aria-hidden="true">↗</span></button></Reveal>
        <p className="sg-one-line">Their details stay with the resource that brought them in.</p>
      </section>
      <Conversation category={category} buyerMessage={buyer.message} onOpen={() => showDetail('outreach')} />
      <Strategy onOpen={showDetail} />
      <section className="sg-proof-chapter" id="work" data-story-scene><Headline lines={['See the work', 'behind it.']} /><div className="sg-proof-exhibits"><button onClick={() => showDetail('proof')}><div><img src="/content-system/kyle-guides.webp" alt="Kyle Hunt’s published guide" loading="lazy" width="700" height="490" /></div><span>Kyle Hunt’s guide <span aria-hidden="true">↗</span></span></button><button onClick={() => showDetail('proof', 1)}><div><img src="/content-system/lemonade-thankyou.webp" alt="Lemonade’s resource page" loading="lazy" width="700" height="490" /></div><span>Lemonade’s resource page <span aria-hidden="true">↗</span></span></button></div></section>
      <section className="sg-close" id="next"><Reveal className="sg-operator"><img src="/ivan-portrait-400.webp" alt="Iván Manfredi" width="72" height="88" /><span>Iván Manfredi<br />InboundOnSteroids</span></Reveal><Headline lines={['We’d run this', 'for CueVu.']} /><p>Content, resources and follow-up.<br />Your audience. Your email list.</p><a href="https://inboundonsteroids.com/start" target="_blank" rel="noreferrer" className="sg-primary">Talk through your plan <span aria-hidden="true">↗</span></a></section>
    </main>
    <footer className="sg-footer"><span>Prepared for Andrew Hayes / Concept preview</span><a href={founder.source} target="_blank" rel="noreferrer">Based on your public LinkedIn ↗</a></footer>
    <dialog ref={dialog} className="sg-dialog" aria-labelledby="sg-dialog-title" onClose={() => setDialogOpen(false)} onClick={e => { if (e.target === e.currentTarget) closeDetail(); }}><div className="sg-dialog-top"><div><span>Example for CueVu</span><h2 id="sg-dialog-title">{detailTitles[section]}</h2></div><button aria-label="Close example" onClick={closeDetail}>Close <span aria-hidden="true">×</span></button></div>{openedOnce && <ScanDetailExplorer category={category} onCategoryChange={setCategory} section={section} buyerId={buyerId} onBuyerChange={setBuyerId} onNavigate={setSection} initialView={initialView} requestKey={requestKey} />}</dialog>
  </div>;
}
