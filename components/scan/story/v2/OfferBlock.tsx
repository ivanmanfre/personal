import React from 'react';
import {ArrowUpRight} from 'lucide-react';
import {OFFER, TEAM} from './copy';
import {teamUrl} from './hero';

/** What we run, what you do, how it starts, and the price line, in one band near the top. */
export function OfferBlock({slug, shape, id = 'offer', section = 'offer'}: {slug: string; shape: 'fast' | 'considered'; id?: string; section?: string}) {
 const lines = [OFFER.run, OFFER.you, OFFER.start];
 return <section id={id} className="sv2-offer" data-scan-section={section} aria-label="What we run and what it costs">
  <dl className="sv2-offer-lines">{lines.map(l => <div key={l.label}><dt>{l.label}</dt><dd>{l.text}</dd></div>)}</dl>
  <p className="sv2-price">{OFFER.price}</p>
  {shape === 'considered' && <a className="sv2-share" href={teamUrl(slug)}>{TEAM.share}<ArrowUpRight size={14} aria-hidden="true"/></a>}
 </section>;
}
