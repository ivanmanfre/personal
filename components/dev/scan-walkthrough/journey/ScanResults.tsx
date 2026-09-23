import React from 'react';
import { asset } from './model';

export function ScanResults() {
  return <section className="scan-results portrait-results" id="proof" aria-label="Client results">
    <article className="founder-result kyle-result"><div className="founder-photo"><img src={asset('/content-system/kyle-portrait.webp')} alt="Kyle Hunt" loading="lazy"/><span>Kyle Hunt<small>Agency ops coach</small></span></div><div className="founder-result-copy"><h2>$30k → $80k<small>a month, across 90 days</small></h2><a href="https://inboundonsteroids.com/case/kyle-hunt/" target="_blank" rel="noreferrer">See Kyle’s case study ↗</a></div></article>
    <article className="founder-result mattan-result"><div className="founder-photo"><img src="https://resources.risedtc.com/tools/assets/mattan.jpg" alt="Mattan Danino" loading="lazy"/><span>Mattan Danino<small>Founder, RISE DTC</small></span></div><div className="founder-result-copy"><h2>A whole library<small>built for his buyers.</small></h2><p>We build Mattan’s DTC tools and run the posts and follow-up that bring people to them.</p><a className="rise-library-link" href="https://resources.risedtc.com/tools/" target="_blank" rel="noreferrer"><img src={asset('/scan-preview/rise-tools.jpg')} alt="RISE DTC’s published tools" loading="lazy"/><span>Try the RISE tools ↗</span></a></div></article>
  </section>;
}

export function EarlyProof() {
 return <aside className="early-proof" aria-label="Kyle Hunt client result"><img src={asset('/content-system/kyle-portrait.webp')} alt="Kyle Hunt"/><p>Kyle Hunt is an agency ops coach. We took over his whole LinkedIn and across the 90 days we ran it his business went from $30k to $80k a month. His feed is public if you want to see what actually went out.</p><a href="https://inboundonsteroids.com/case/kyle-hunt/" target="_blank" rel="noreferrer">See the case study ↗</a></aside>;
}
