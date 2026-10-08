import React from 'react';
import {motion, useReducedMotion} from 'framer-motion';
import {ArrowUpRight} from 'lucide-react';
import {asset} from '../../dev/scan-walkthrough/journey/model';

/** Existing case evidence, with one lead result and quieter supporting results. */
export function StudioResults() {
 const reduced = useReducedMotion();
 return <section className="studio-results" aria-labelledby="studio-results-title">
  <header><span className="sp-eyebrow">Founders we run this for</span><h2 id="studio-results-title">What the first<br/>months looked like.</h2></header>
  <article className="studio-result-lead">
   <div className="studio-result-person"><img src={asset('/content-system/kyle-portrait.webp')} alt="" loading="lazy"/><div><b>Kyle Hunt</b><span>Agency ops coach</span></div></div>
   <div className="studio-result-outcome">
    <p className="studio-result-metric"><span>$30k</span><span className="studio-result-arrow" aria-label="to">→</span><strong>$80k<motion.i aria-hidden="true" initial={reduced ? false : {scaleX:0}} whileInView={{scaleX:1}} viewport={{once:true,amount:.6}} transition={{duration:.9,ease:[.16,1,.3,1]}}/></strong></p>
    <p className="studio-result-context">a month, across the 90 days we ran his LinkedIn.</p>
    <a href="https://inboundonsteroids.com/case/kyle-hunt/" target="_blank" rel="noreferrer">See Kyle’s case study <ArrowUpRight size={17} aria-hidden="true"/></a>
   </div>
  </article>
  <div className="studio-results-support">
   <article>
    <div className="studio-result-person"><img src="https://resources.risedtc.com/tools/assets/mattan.jpg" alt="" loading="lazy"/><div><b>Mattan Danino</b><span>Founder, RISE DTC</span></div></div>
    <strong className="studio-support-metric">+$20k<span>/mo</span></strong>
    <p>In new revenue closed by month 3. We run his content, lead magnets and outreach.</p>
    <a href="https://resources.risedtc.com/tools/" target="_blank" rel="noreferrer">See his lead magnets <ArrowUpRight size={17} aria-hidden="true"/></a>
   </article>
   <article>
    <div className="studio-result-person"><img src={asset('/content-system/davorin-portrait.webp')} alt="" loading="lazy"/><div><b>Davorin Smit</b><span>Founder, ARCH. Influencer Agency</span></div></div>
    <strong className="studio-support-metric">2 clients</strong>
    <p>Closed in month 1. We run his LinkedIn content and outreach.</p>
   </article>
  </div>
 </section>;
}
