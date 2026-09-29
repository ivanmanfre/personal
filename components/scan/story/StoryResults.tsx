import React from 'react';
import {motion, useReducedMotion} from 'framer-motion';
import {ArrowUpRight} from 'lucide-react';
import {asset} from '../../dev/scan-walkthrough/journey/model';
import {BlurWords, NumberTicker} from './motion';

const ease = [.22, .84, .36, 1] as const;

/** Kyle: his two real monthly figures, drawn to scale. */
function KyleChart() {
 const reduced = useReducedMotion();
 const bars = [{label: 'Before', value: 30, note: 'a month'}, {label: 'After 90 days', value: 80, note: 'a month'}];
 return <div className="sr-bars" aria-label="Monthly revenue went from $30k to $80k in 90 days">
  {bars.map((b, i) => <div key={b.label} className={i ? 'is-after' : ''}>
   <span className="sr-bar-value">$<NumberTicker value={b.value}/>k</span>
   <motion.i style={{originY: 1, height: `${(b.value / 80) * 72}%`}} initial={reduced ? false : {scaleY: 0}} whileInView={{scaleY: 1}} viewport={{once: true, amount: .6}} transition={{duration: reduced ? 0 : 1.1, delay: i * .35, ease}}
    className="sr-bar"/>
   <small>{b.label}</small>
  </div>)}
  <motion.span className="sr-delta" initial={reduced ? false : {opacity: 0, scale: .8}} whileInView={{opacity: 1, scale: 1}} viewport={{once: true}} transition={{delay: reduced ? 0 : 1.2, type: 'spring', stiffness: 300, damping: 20}}>+167%</motion.span>
 </div>;
}

/** Mattan: running total of calls booked from our outreach, week by week since he started (17 Jul). */
function MattanClimb() {
 const reduced = useReducedMotion();
 const total = [0, 0, 1, 2, 4, 7, 11, 15, 18, 19];
 return <div className="sr-climb" aria-label="Calls booked climbed from 0 to 19 over his first 10 weeks">
  <div className="sr-climb-bars">
   {total.map((n, i) => <div key={i} className={i === total.length - 1 ? 'is-last' : ''}>
    {i === total.length - 1 && <span>{n}</span>}
    <motion.i style={{originY: 1, height: `${Math.max(n / 19, .03) * 100}%`}} initial={reduced ? false : {scaleY: 0}} whileInView={{scaleY: 1}} viewport={{once: true, amount: .6}} transition={{duration: reduced ? 0 : .7, delay: reduced ? 0 : i * .08, ease}}/>
   </div>)}
  </div>
  <div className="sr-climb-axis"><small>Calls booked, week 1</small><small>Week 10</small></div>
 </div>;
}

/** Davorin: his first month, with the two clients he closed landing on it. */
function DavorinMonth() {
 const reduced = useReducedMotion();
 const closed = [{week: 1, label: 'Client 1'}, {week: 3, label: 'Client 2'}];
 return <div className="sr-month" aria-label="2 clients closed in month 1">
  {[1, 2, 3, 4].map(w => {
   const c = closed.find(x => x.week === w);
   return <div key={w} className={c ? 'is-closed' : ''}>
    <small>Week {w}</small>
    {c && <motion.span initial={reduced ? false : {opacity: 0, y: -14, scale: .9}} whileInView={{opacity: 1, y: 0, scale: 1}} viewport={{once: true, amount: .6}} transition={{delay: reduced ? 0 : .3 + w * .15, type: 'spring', stiffness: 380, damping: 22}}>Closed</motion.span>}
   </div>;
  })}
 </div>;
}

export function StoryResults() {
 return <section className="sr" aria-label="Client results">
  <header className="sr-head"><span>Founders we run this for</span><BlurWords text="What the first months looked like."/></header>
  <div className="sr-grid">
   <article className="sr-card">
    <div className="sr-photo"><img src={asset('/content-system/kyle-portrait.webp')} alt="Kyle Hunt" loading="lazy"/><span><b>Kyle Hunt</b><small>Agency ops coach</small></span></div>
    <div className="sr-body">
     <div className="sr-figure"><strong>$30k → $80k</strong><p>a month, across the 90 days we ran his LinkedIn.</p></div>
     <KyleChart/>
     <a href="https://inboundonsteroids.com/case/kyle-hunt/" target="_blank" rel="noreferrer">See Kyle’s case study <ArrowUpRight size={15}/></a>
    </div>
   </article>
   <article className="sr-card">
    <div className="sr-photo"><img src="https://resources.risedtc.com/tools/assets/mattan.jpg" alt="Mattan Danino" loading="lazy"/><span><b>Mattan Danino</b><small>Founder, RISE DTC</small></span></div>
    <div className="sr-body">
     <div className="sr-figure"><strong>+$<NumberTicker value={20}/>k/mo</strong><p>in new revenue closed by month 3. We run his content, lead magnets and outreach.</p></div>
     <MattanClimb/>
     <a href="https://resources.risedtc.com/tools/" target="_blank" rel="noreferrer">See his lead magnets <ArrowUpRight size={15}/></a>
    </div>
   </article>
   <article className="sr-card">
    <div className="sr-photo"><img src={asset('/content-system/davorin-portrait.webp')} alt="Davorin Smit" loading="lazy"/><span><b>Davorin Smit</b><small>Founder, ARCH. Influencer Agency</small></span></div>
    <div className="sr-body">
     <div className="sr-figure"><strong><NumberTicker value={2}/> clients</strong><p>closed in month 1. We run his LinkedIn content and outreach.</p></div>
     <DavorinMonth/>
    </div>
   </article>
  </div>
  <blockquote className="sr-quote sr-quote-wide"><p>Leads come in with a name and the guide they pulled. By the time we talk, they already know the offer.</p><cite>Kyle Hunt, founder of Agency Operators</cite></blockquote>
 </section>;
}
