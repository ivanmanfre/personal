import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion';
import { buyers, founder } from './data';
import ScanDetailExplorer, { type DetailSection } from './ScanDetailExplorer';
import './scan-walkthrough.css';
import './guided-story.css';

const ease = [0.22, 1, 0.36, 1] as const;
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
  return <Tag className={`sg-display ${className}`} aria-label={lines.join(' ')} initial="hidden" whileInView="visible" viewport={{ once: true, amount: .25 }}>
    {lines.map((line, i) => <span className="sg-line" key={line} aria-hidden="true"><motion.span variants={{ hidden: { y: reduced ? 0 : '105%' }, visible: { y: 0 } }} transition={{ duration: reduced ? 0 : .85, ease, delay: i * .075 }}>{line}</motion.span></span>)}
  </Tag>;
}
function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const reduced = useReducedMotion();
  return <motion.div className={className} initial={reduced ? false : { opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .15 }} transition={{ duration: .7, ease, delay }}>{children}</motion.div>;
}
function Author() {
  return <div className="sg-author"><img src={founder.avatar} alt="" width="42" height="42" /><div><strong>Andrew Hayes</strong><span>Customer research at CueVu</span></div><span className="sg-draft">Proposed post</span></div>;
}
function ContentScene({ onOpen }: { onOpen: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30 });
  const scale = useTransform(progress, [0, .8], [.86, 1]);
  const backX = useTransform(progress, [0, .85], [0, 38]);
  const backY = useTransform(progress, [0, .85], [0, -27]);
  return <section id="content" className="sg-scroll-scene" ref={ref} data-story-scene>
    <div className="sg-stage">
      <Headline lines={['Let your research', 'do the talking.']} />
      <div className="sg-post-stack">
        <motion.div aria-hidden="true" className="sg-post-back" style={reduced ? undefined : { x: backX, y: backY }}><span>CueVu / The results file</span></motion.div>
        <motion.article data-mockup="linkedin" className="sg-story-post" style={reduced ? undefined : { scale }}>
          <Author /><p>Start with the moment someone changed brands.</p>
          <button className="sg-post-sheet" onClick={onOpen} aria-label="Open the posts and carousel"><span>CueVu</span><strong>What were<br />you feeling<br />when it happened?</strong><span>Inside the research <span aria-hidden="true">↗</span></span></button>
        </motion.article>
      </div>
      <button className="sg-text-link" onClick={onOpen}>Explore the content week <span aria-hidden="true">↗</span></button>
    </div>
  </section>;
}
function ResourceScene({ onOpen }: { onOpen: (view: number) => void }) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30 });
  const lineScale = useTransform(progress, [0, .6], [0, 1]);
  const pageY = useTransform(progress, [0, .8], [26, 0]);
  const pageOpacity = useTransform(progress, [0, .55], [.85, 1]);
  return <section id="inbound" className="sg-scroll-scene sg-resource-chapter" ref={ref} data-story-scene>
    <div className="sg-stage">
      <Headline lines={['Turn curiosity', 'into a project.']} />
      <p className="sg-one-line">Give them a useful next step.</p>
      <div className="sg-resource-assembly">
        <div className="sg-post-excerpt">From your post: <strong>Plan your next switching study.</strong></div>
        <motion.div className="sg-transfer" style={reduced ? undefined : { scaleY: lineScale }} aria-hidden="true" />
        <motion.button className="sg-resource-cover" onClick={() => onOpen(1)} style={reduced ? undefined : { y: pageY, opacity: pageOpacity }} aria-label="Try the page and research planner">
          <span className="sg-resource-brand">CueVu <span>Resource concept</span></span><strong>Your next<br />research brief.</strong><span className="sg-resource-fields"><span>Choose a category</span><span>Set the research question</span></span><span className="sg-resource-action">Build a sample brief <span aria-hidden="true">↗</span></span>
        </motion.button>
      </div>
      <button className="sg-text-link" onClick={() => onOpen(2)}>Try the interactive planner <span aria-hidden="true">↗</span></button>
    </div>
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
  const [route, setRoute] = useState<'warm' | 'cold'>('warm');
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
    <header className="sg-header"><a className="sg-wordmark" href="#top" aria-label="InboundOnSteroids">INBOUND<b>ON</b>STEROIDS</a><a className="sg-header-link" href="#strategy">See the whole strategy <span aria-hidden="true">↗</span></a></header>
    <nav className="sg-chapter-rail" aria-label="Story chapters">{chapters.map(chapter => <a href={`#${chapter.id}`} key={chapter.id} aria-label={chapter.name} aria-current={active === chapter.id ? 'step' : undefined}><span /><span>{chapter.name}</span></a>)}</nav>
    <main id="top">
      <section className="sg-hero" data-story-scene id="opening">
        <Reveal className="sg-for"><img src={founder.avatar} alt="" width="36" height="36" /><span>Andrew Hayes <span>/ CueVu</span></span></Reveal>
        <Headline hero lines={['Your research.', 'Their next', 'big decision.']} />
        <Reveal className="sg-hero-bottom" delay={.2}><p>A LinkedIn strategy<br />built around CueVu.</p><a href="#buyer" className="sg-start">Follow the story <span aria-hidden="true">↗</span></a></Reveal>
        <span className="sg-preview-note">Proposed strategy / Interactive preview</span>
      </section>
      <section id="buyer" className="sg-buyer-chapter" data-story-scene>
        <Headline lines={['Start with', 'who needs you.']} />
        <Reveal className="sg-buyer-picker"><div className="sg-buyer-tabs" aria-label="Choose a proposed buyer">{[{ id: 'brand', label: 'Brand teams' }, { id: 'agency', label: 'Agencies' }, { id: 'research', label: 'Insight teams' }].map(item => <button key={item.id} aria-pressed={buyerId === item.id} onClick={() => setBuyerId(item.id)}>{item.label}</button>)}</div>
          <div className="sg-buyer-person"><span className="sg-person-mark" aria-hidden="true"><svg viewBox="0 0 64 64"><circle cx="32" cy="20" r="9" /><path d="M14 55v-8a18 18 0 0 1 36 0v8" /></svg></span><h3>{situation.name}</h3><p>{situation.task}</p></div>
          <p className="sg-buyer-question">{situation.question}</p>
          <button className="sg-text-link" onClick={() => showDetail('buyers')}>Explore the buyer profiles <span aria-hidden="true">↗</span></button><span className="sg-example-note">Proposed audience</span>
        </Reveal>
      </section>
      <ContentScene onOpen={() => showDetail('content')} />
      <ResourceScene onOpen={view => showDetail('inbound', view)} />
      <section id="lead" className="sg-lead-chapter" data-story-scene>
        <Headline lines={['Know who’s', 'planning what.']} />
        <Reveal className="sg-lead-artifact"><div className="sg-lead-top"><span className="sg-cuevu">CueVu</span><span>Illustrative enquiry</span></div><div className="sg-lead-title"><span>Someone used your planner.</span><strong>{situation.name}</strong></div><dl><div><dt>Category</dt><dd>Pet food</dd></div><div><dt>Project</dt><dd>{situation.task}</dd></div><div><dt>Source</dt><dd>Your LinkedIn resource</dd></div></dl><button className="sg-text-link" onClick={() => showDetail('inbound', 3)}>Explore the lead and follow-up <span aria-hidden="true">↗</span></button></Reveal>
        <p className="sg-one-line">Their details stay with the resource that brought them in.</p>
      </section>
      <section id="outreach" className="sg-outreach-chapter" data-story-scene>
        <Headline lines={['Pick up the', 'conversation.']} />
        <Reveal className="sg-outreach-demo"><div className="sg-route-tabs"><button aria-pressed={route === 'warm'} onClick={() => setRoute('warm')}>From your content</button><button aria-pressed={route === 'cold'} onClick={() => setRoute('cold')}>Researched outreach</button></div>
          <p className="sg-route-context">{route === 'warm' ? 'They asked for the resource. We follow up.' : 'We find a relevant project and open the conversation.'}</p>
          <div className="sg-chat" data-mockup="message"><Author /><p>{route === 'warm' ? 'For the pet food brief, which brands are you comparing? That will help us narrow down who to hear from.' : buyer.message}</p><span>Proposed message</span></div>
          <button className="sg-text-link" onClick={() => showDetail('outreach')}>Explore the outreach examples <span aria-hidden="true">↗</span></button>
        </Reveal>
      </section>
      <Strategy onOpen={showDetail} />
      <section className="sg-proof-chapter" id="work" data-story-scene><Headline lines={['See the work', 'behind it.']} /><div className="sg-proof-exhibits"><button onClick={() => showDetail('proof')}><div><img src="/content-system/kyle-guides.webp" alt="Kyle Hunt’s published guide" loading="lazy" width="700" height="490" /></div><span>Kyle Hunt’s guide <span aria-hidden="true">↗</span></span></button><button onClick={() => showDetail('proof', 1)}><div><img src="/content-system/lemonade-thankyou.webp" alt="Lemonade’s resource page" loading="lazy" width="700" height="490" /></div><span>Lemonade’s resource page <span aria-hidden="true">↗</span></span></button></div></section>
      <section className="sg-close" id="next"><Reveal className="sg-operator"><img src="/ivan-portrait-400.webp" alt="Iván Manfredi" width="72" height="88" /><span>Iván Manfredi<br />InboundOnSteroids</span></Reveal><Headline lines={['We’d run this', 'for CueVu.']} /><p>Content, resources and follow-up.<br />Your audience. Your email list.</p><a href="https://inboundonsteroids.com/start" target="_blank" rel="noreferrer" className="sg-primary">Talk through your plan <span aria-hidden="true">↗</span></a></section>
    </main>
    <footer className="sg-footer"><span>Prepared for Andrew Hayes / Concept preview</span><a href={founder.source} target="_blank" rel="noreferrer">Based on your public LinkedIn ↗</a></footer>
    <dialog ref={dialog} className="sg-dialog" aria-labelledby="sg-dialog-title" onClose={() => setDialogOpen(false)} onClick={e => { if (e.target === e.currentTarget) closeDetail(); }}><div className="sg-dialog-top"><div><span>Example for CueVu</span><h2 id="sg-dialog-title">{detailTitles[section]}</h2></div><button aria-label="Close example" onClick={closeDetail}>Close <span aria-hidden="true">×</span></button></div>{openedOnce && <ScanDetailExplorer section={section} buyerId={buyerId} onBuyerChange={setBuyerId} onNavigate={setSection} initialView={initialView} requestKey={requestKey} />}</dialog>
  </div>;
}
