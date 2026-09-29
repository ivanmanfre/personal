import React, {useState} from 'react';
import {motion, useReducedMotion} from 'framer-motion';
import {ArrowRight, ChevronLeft, ChevronRight, Lock, RotateCw} from 'lucide-react';
import type {StoryKind} from '../../dev/scan-walkthrough/journey/connectedModel';
import {LeadMagnetTool} from '../../dev/scan-walkthrough/journey/LeadMagnetTool';
import {useStory} from './context';
import {BrandMark, brandFont, brandPalette} from './BrandSlide';
import {NumberTicker} from './motion';

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32);
/** One clean line from a section body: list markers out, first sentence, cut at a word. */
const summary = (body: string) => { const flat = body.replace(/(^|\s)[-•]\s+/g, ' ').replace(/\s+/g, ' ').trim(); const first = flat.split(/(?<=[.?!])\s/)[0]; return first.length <= 110 ? first : first.slice(0, 106).replace(/\s+\S*$/, '') + '…'; };
const UNIT = {document: 'worked examples', planner: 'project types', question: 'research events'} as const;

/** The lead magnet as the reader meets it: its own landing page on the lead's site, in their brand. */
export function LeadMagnetPage({kind, domain}: {kind: StoryKind; domain?: string}) {
 const plan = useStory(), r = plan.resource, p = brandPalette(r.brand), reduced = useReducedMotion();
 const [coverFailed, setCoverFailed] = useState(false);
 const host = (domain || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '') || `${slugify(plan.brand)}.com`;
 const sections = r.options[0]?.sections ?? [];
 const stats = [{n: r.options.length, label: UNIT[r.mode]}, sections.length ? {n: sections.length, label: 'sections in each'} : null, r.options[0]?.deliverables?.length ? {n: r.options[0].deliverables.length, label: 'deliverables mapped'} : null].filter(Boolean) as {n: number; label: string}[];
 return <div className="lmp-browser" style={{fontFamily: brandFont(r.brand.font)}}>
  <div className="lmp-chrome" aria-hidden="true">
   <span className="lmp-dots"><i/><i/><i/></span>
   <span className="lmp-nav-icons"><ChevronLeft size={16}/><ChevronRight size={16}/><RotateCw size={13}/></span>
   <span className="lmp-url"><Lock size={11}/><span>{host}/<b>{slugify(plan.keyword || plan.magnet)}</b></span></span>
  </div>
  <div className="lmp-page">
   <section className="lmp-hero" style={{background: p.dark, color: p.light}}>
    <nav className="lmp-sitenav"><BrandMark ground={p.dark} height={22}/><span>What’s inside</span><span>Who it’s for</span><em style={{background: p.accentOnDark, color: p.accentOnDark === p.accent ? p.accentInk : p.dark}}>Get it free</em></nav>
    <div className="lmp-hero-grid">
     <div>
      <span className="lmp-eyebrow" style={{color: p.accentOnDark}}><i style={{background: p.accentOnDark}}/>Free · by {plan.brand.split(/\s+[-|–:]\s+/)[0]}</span>
      <h3>{r.title}</h3>
      <p>{plan.magnetWhy}</p>
      <div className="lmp-cta"><span style={{background: p.accentOnDark, color: p.accentOnDark === p.accent ? p.accentInk : p.dark}}>Send it to me <ArrowRight size={15}/></span><small>Free. Lands in your inbox.</small></div>
      {stats.length > 0 && <dl className="lmp-stats">{stats.map(s => <div key={s.label}><dt style={{color: p.accentOnDark}}><NumberTicker value={s.n}/></dt><dd>{s.label}</dd></div>)}</dl>}
     </div>
     {plan.coverImage && !coverFailed && <motion.img className="lmp-cover" src={plan.coverImage} alt="" loading="lazy" onError={() => setCoverFailed(true)}
      initial={reduced ? false : {rotate: 0, y: 30, opacity: 0}} whileInView={{rotate: 4, y: 0, opacity: 1}} viewport={{once: true, amount: .3}} transition={{type: 'spring', stiffness: 90, damping: 16}}/>}
    </div>
   </section>
   {sections.length > 0 && <section className="lmp-index" style={{background: p.light, color: p.dark}}>
    <span className="lmp-eyebrow" style={{color: p.accentOnLight}}><i style={{background: p.accentOnLight}}/>What’s inside</span>
    <ol>{sections.map((s, i) => <li key={s.heading}><span style={{color: p.accentOnLight}}>{String(i + 1).padStart(2, '0')}</span><b>{s.heading}</b><small>{summary(s.body)}</small></li>)}</ol>
   </section>}
   <section className="lmp-doc"><LeadMagnetTool kind={kind}/></section>
  </div>
 </div>;
}
