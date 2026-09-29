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

/** Mattan: a working month, with his 18 booked calls landing on it. */
function MattanCalendar() {
 const reduced = useReducedMotion();
 const days = 20, booked = new Set([0, 1, 2, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19].slice(0, 18));
 return <div className="sr-cal" aria-label="18 calls booked in month 2">
  <div className="sr-cal-head">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(d => <span key={d}>{d}</span>)}</div>
  <motion.div className="sr-cal-grid" initial={reduced ? false : 'off'} whileInView="on" viewport={{once: true, amount: .5}} variants={{on: {transition: {staggerChildren: .06}}}}>
   {Array.from({length: days}, (_, i) => <motion.i key={i} className={booked.has(i) ? 'is-booked' : ''} variants={booked.has(i) ? {off: {scale: .4, opacity: .2}, on: {scale: 1, opacity: 1, transition: {type: 'spring', stiffness: 420, damping: 22}}} : {}}/>)}
  </motion.div>
 </div>;
}

export function StoryResults() {
 return <section className="sr" aria-label="Client results">
  <header className="sr-head"><span>Founders we run this for</span><BlurWords text="What this did for two founders."/></header>
  <div className="sr-grid">
   <article className="sr-card">
    <div className="sr-photo"><img src={asset('/content-system/kyle-portrait.webp')} alt="Kyle Hunt" loading="lazy"/><span><b>Kyle Hunt</b><small>Agency ops coach</small></span></div>
    <div className="sr-body">
     <div className="sr-figure"><strong>$30k → $80k</strong><p>a month, across the 90 days we ran his LinkedIn.</p></div>
     <KyleChart/>
     <blockquote className="sr-quote"><p>Leads come in with a name and the guide they pulled. By the time we talk, they already know the offer.</p><cite>Kyle Hunt, founder of Agency Operators</cite></blockquote>
     <a href="https://inboundonsteroids.com/case/kyle-hunt/" target="_blank" rel="noreferrer">See Kyle’s case study <ArrowUpRight size={15}/></a>
    </div>
   </article>
   <article className="sr-card">
    <div className="sr-photo"><img src="https://resources.risedtc.com/tools/assets/mattan.jpg" alt="Mattan Danino" loading="lazy"/><span><b>Mattan Danino</b><small>Founder, RISE DTC</small></span></div>
    <div className="sr-body">
     <div className="sr-figure"><strong><NumberTicker value={18}/> calls</strong><p>booked in month 2. We run his content, lead magnets and outreach.</p></div>
     <MattanCalendar/>
     <a href="https://resources.risedtc.com/tools/" target="_blank" rel="noreferrer">See his lead magnets <ArrowUpRight size={15}/></a>
    </div>
   </article>
  </div>
 </section>;
}
