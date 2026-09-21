import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { buyers, founder, week, decisionPlans, type Decision } from './data';
import ScanDetailExplorer, { type DetailSection } from './ScanDetailExplorer';
import './scan-walkthrough.css';
import './guided-story.css';

const chapters = ['Your buyer', 'Your content', 'Your resource', 'Your lead', 'Your outreach', 'Your strategy'];
const detailTitles: Record<DetailSection, string> = { buyers: 'Who we’d reach', content: 'Your content week', inbound: 'Your lead magnet journey', outreach: 'Your outreach examples', proof: 'Existing client work' };
const situations: Record<string, { role: string; need: string; question: string; output: string; message: string }> = {
  brand: { role: 'A brand marketing lead', need: 'Planning the next campaign', question: 'Why did customers choose another brand?', output: 'A starting brief for campaign research', message: 'Which product category is the campaign for? I can point you to the questions that fit the decision your team is making.' },
  agency: { role: 'A strategy agency founder', need: 'Preparing a client’s creative brief', question: 'Which customer stories belong in this brief?', output: 'A research brief for the creative team', message: 'Which client category is the brief for? The creative version helps you collect the situation and the customer’s words.' },
  research: { role: 'A customer insight lead', need: 'Scoping a category study', question: 'What prompted the change between brands?', output: 'A brief for investigating brand switching', message: 'Which category and switching period are you studying? Those choices shape who should take part.' },
};

export default function ScanWalkthroughPreview() {
  const [buyerId, setBuyerId] = useState('brand');
  const buyer = buyers.find(b => b.id === buyerId)!;
  const situation = situations[buyerId];
  const plan = decisionPlans[buyer.decision as Decision];
  const [active, setActive] = useState(0);
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
      for (const entry of entries) if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.chapter));
    }, { rootMargin: '-20% 0px -45% 0px', threshold: 0 });
    document.querySelectorAll('[data-chapter]').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  const closeDetail = () => dialog.current?.close();
  return <div className="sg-root">
    <header className="sg-header"><a className="sg-wordmark" href="#top" aria-label="InboundOnSteroids">INBOUND<b>ON</b>STEROIDS</a><span className="sg-progress" aria-live="off">{String(active + 1).padStart(2, '0')} / 06 <span>{chapters[active]}</span></span><a href="#strategy" className="sg-header-link">The full plan ↗</a></header>
    <main id="top">
      <section className="sg-hero sg-wrap">
        <div><p className="sg-kicker">A LinkedIn plan for Andrew Hayes / CueVu</p><h1>Andrew, your next<br />research brief could<br />start <span>on LinkedIn.</span></h1><p className="sg-intro">Follow a potential buyer from seeing your post to a conversation with you.</p><a className="sg-primary" href="#buyer">See how it comes together <span aria-hidden="true">↓</span></a><p className="sg-caption">A proposed strategy built around your public offer.</p></div>
        <div className="sg-hero-art" aria-label="An example of the path from post to research brief">
          <div className="sg-mini-author"><img src={founder.avatar} alt="Andrew Hayes" width="40" height="40" /><div><strong>Andrew Hayes</strong><span>CueVu / proposed post</span></div></div>
          <div className="sg-hero-quote"><span className="sg-kicker">From your research method</span><p>“What were you feeling when [X-Event] happened?”</p></div>
          <div className="sg-hero-line"><span aria-hidden="true">↓</span><span>A reader wants to use this in their next brief.</span></div>
          <button className="sg-hero-resource" onClick={() => showDetail('inbound', 2)}><span className="sg-kicker">CueVu / Research planner</span><strong>Plan the study<br />before you recruit.</strong><span>Try the example <span aria-hidden="true">↗</span></span></button>
        </div>
      </section>

      <section id="buyer" data-chapter="0" className="sg-chapter sg-wrap">
        <div className="sg-story-copy"><p className="sg-kicker">01 / Choose who this is for</p><h2>Start with someone<br />who needs<br />your research.</h2><p>They have a decision ahead. Your content gives them a useful way to approach it.</p><button className="sg-detail-link" onClick={() => showDetail('buyers')}>Explore the buyer profiles ↗</button></div>
        <div className="sg-scene sg-buyer-scene"><div className="sg-role"><span className="sg-kicker">Proposed buyer</span><h3>{situation.role}</h3><p>{buyer.company}</p></div><div className="sg-buyer-task"><span className="sg-small-label">Their next project</span><strong>{situation.need}</strong><div className="sg-question">“{situation.question}”</div><span className="sg-caption">Illustrative project question</span></div><div className="sg-scene-foot">We’d verify their role, project and fit before outreach.</div></div>
        <a className="sg-next" href="#content">Now give them something worth reading <span>↓</span></a>
      </section>

      <section id="content" data-chapter="1" className="sg-chapter sg-wrap">
        <div className="sg-story-copy"><p className="sg-kicker">02 / Become useful in their feed</p><h2>Your work becomes<br />a week of content.</h2><p>One post explains your method. Another shows the deliverable. The resource gives them a way to try it.</p><button className="sg-detail-link" onClick={() => showDetail('content')}>Open the posts and carousel ↗</button></div>
        <div className="sg-scene sg-content-scene"><div className="sg-preview-post" data-mockup="linkedin"><div className="sg-mini-author"><img src={founder.avatar} alt="" width="36" height="36" /><div><strong>Andrew Hayes</strong><span>Draft carousel</span></div></div><p>{buyer.post}</p><button className="sg-post-cover" onClick={() => showDetail('content', 0)}><span className="sg-kicker">CueVu / Customer research</span><strong>What happened<br />when they<br />changed brands?</strong><span>Open the carousel <span>↗</span></span></button></div><div className="sg-week-strip" aria-label="Explore the content week">{week.map((post, i) => <button key={post.id} onClick={() => showDetail('content', i)}><span>{post.day.slice(0, 3)}</span><strong>{['Your method', 'Their decision', 'The results file', 'The planner'][i]}</strong><span aria-hidden="true">↗</span></button>)}</div></div>
        <a className="sg-next" href="#inbound">A reader opens the resource <span>↓</span></a>
      </section>

      <section id="inbound" data-chapter="2" className="sg-chapter sg-wrap">
        <div className="sg-story-copy"><p className="sg-kicker">03 / Give them a useful next step</p><h2>They leave with<br />a brief they<br />can use.</h2><p>Your lead magnet helps them plan the research. They enter their details to get it.</p><button className="sg-detail-link" onClick={() => showDetail('inbound', 1)}>Try the page and research planner ↗</button></div>
        <div className="sg-scene sg-resource-scene"><div className="sg-resource-masthead"><strong>CueVu</strong><span>Proposed lead magnet</span></div><div className="sg-resource-body"><span className="sg-kicker">Research planner</span><h3>{situation.output}</h3><div className="sg-choice"><span>Product category</span><strong>Pet food</strong></div><div className="sg-choice"><span>The decision</span><strong>{plan.label}</strong></div><div className="sg-resource-result"><span className="sg-small-label">One question from their brief</span><p>{plan.questions[0]}</p></div><button className="sg-dark-button" onClick={() => showDetail('inbound', 2)}>Build a sample brief <span>↗</span></button></div></div>
        <a className="sg-next" href="#lead">Their request gives you context <span>↓</span></a>
      </section>

      <section id="lead" data-chapter="3" className="sg-chapter sg-wrap">
        <div className="sg-story-copy"><p className="sg-kicker">04 / Keep the conversation connected</p><h2>You know what<br />brought them in.</h2><p>Their details, research purpose and requested resource stay together. The follow-up starts from that project.</p><button className="sg-detail-link" onClick={() => showDetail('inbound', 3)}>See the lead record and emails ↗</button></div>
        <div className="sg-scene sg-lead-scene"><div className="sg-lead-slip"><span className="sg-kicker">Example lead / Andrew’s view</span><h3>Sample visitor</h3><p>{situation.role.replace(/^A /, '')} / Consumer research</p><dl><div><dt>Requested</dt><dd>CueVu research planner</dd></div><div><dt>Working on</dt><dd>{plan.label}</dd></div><div><dt>Category</dt><dd>Pet food</dd></div></dl></div><div className="sg-link-line"><span aria-hidden="true">↓</span><span>A follow-up about their project</span></div><button className="sg-email-peek" onClick={() => showDetail('inbound', 4)}><span className="sg-small-label">Andrew → Sample visitor</span><p>Have you agreed who to recruit for the pet food study?</p><span>Read the email sequence ↗</span></button><span className="sg-caption">Example record and draft emails. Nothing is sent.</span></div>
        <a className="sg-next" href="#outreach">You can also start the conversation <span>↓</span></a>
      </section>

      <section id="outreach" data-chapter="4" className="sg-chapter sg-wrap">
        <div className="sg-story-copy"><p className="sg-kicker">05 / Reach the people who fit</p><h2>A relevant message<br />opens another way in.</h2><p>We’d follow up with suitable engagers and research new buyers. Each message starts from a checked reason to contact them.</p><button className="sg-detail-link" onClick={() => showDetail('outreach')}>Explore the outreach examples ↗</button></div>
        <div className="sg-scene sg-outreach-scene"><div className="sg-route-row"><span>From your audience</span><strong>A relevant comment</strong></div><div className="sg-route-row"><span>From buyer research</span><strong>A project that fits CueVu</strong></div><div className="sg-routes-join" aria-hidden="true"><span>↘</span><span>↙</span></div><div className="sg-message-peek" data-mockup="message"><div className="sg-mini-author"><img src={founder.avatar} alt="" width="36" height="36" /><div><strong>Andrew Hayes</strong><span>Draft reply if they’re interested</span></div></div><p>{situation.message}</p></div><p className="sg-caption">The conversation shown is hypothetical.</p></div>
        <a className="sg-next" href="#strategy">See how the pieces work together <span>↓</span></a>
      </section>

      <section id="strategy" data-chapter="5" className="sg-strategy sg-wrap"><div className="sg-strategy-title"><p className="sg-kicker">06 / The full LinkedIn strategy</p><h2>Your full LinkedIn<br />strategy, together.</h2><p>We’d run the publishing, resources and follow-up. You keep the audience, the list and the content.</p></div><div className="sg-map" aria-label="Content reaches buyers, a resource captures interest, follow-up starts conversations, and researched outreach adds another route"><div className="sg-map-track">{[{ n: 'Your content', d: 'Built from CueVu’s research', detail: 'content' }, { n: 'Your resource', d: situation.output, detail: 'inbound' }, { n: 'Your lead', d: 'Their details and project', detail: 'inbound' }, { n: 'The conversation', d: 'A relevant next step', detail: 'outreach' }].map((node, i) => <React.Fragment key={node.n}>{i > 0 && <span className="sg-map-arrow" aria-hidden="true">→</span>}<button onClick={() => showDetail(node.detail as DetailSection, i === 2 ? 3 : 0)}><span>0{i + 1}</span><strong>{node.n}</strong><small>{node.d}</small></button></React.Fragment>)}</div><div className="sg-map-outreach"><span>Buyer research + relevant outreach</span><span aria-hidden="true">↗</span><span>Another route to a conversation</span></div></div><div className="sg-proof-line"><span>See the work behind it</span><button onClick={() => showDetail('proof')}>Kyle Hunt’s guide ↗</button><button onClick={() => showDetail('proof', 1)}>Lemonade’s resource page ↗</button></div><div className="sg-close"><div className="sg-operator"><img src="/ivan-portrait-400.webp" alt="Iván Manfredi" width="60" height="74" loading="lazy" /><div><strong>I’m Iván. We’d run this for CueVu.</strong><p>We’ll look at your current setup and choose where to begin.</p></div></div><a href="https://inboundonsteroids.com/start" target="_blank" rel="noreferrer" className="sg-primary">Talk through your plan <span>↗</span></a></div></section>
    </main><footer className="sg-footer sg-wrap"><span>Prepared for Andrew Hayes / Concept preview</span><a href={founder.source} target="_blank" rel="noreferrer">Based on your public LinkedIn ↗</a></footer>
    <dialog ref={dialog} className="sg-dialog" aria-labelledby="sg-dialog-title" onClose={() => setDialogOpen(false)} onClick={e => { if (e.target === e.currentTarget) closeDetail(); }}><div className="sg-dialog-top"><div><span>Example for CueVu</span><h2 id="sg-dialog-title">{detailTitles[section]}</h2></div><button aria-label="Close example" onClick={closeDetail}>Close <span aria-hidden="true">×</span></button></div>{openedOnce && <ScanDetailExplorer section={section} buyerId={buyerId} onBuyerChange={setBuyerId} onNavigate={setSection} initialView={initialView} requestKey={requestKey} />}</dialog>
  </div>;
}
