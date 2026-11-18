import React from 'react';
import {ArrowUpRight} from 'lucide-react';
import {OFFER, OFFER_SHORT, TEAM} from './copy';
import {teamUrl} from './hero';

/** What we run, what you do, how it starts, and the price line, in one band near the top.
 *  `compact` is the short form small firms get directly under the hero. */
export function OfferBlock({slug, shape, id = 'offer', section = 'offer', compact = false}: {slug: string; shape: 'fast' | 'considered'; id?: string; section?: string; compact?: boolean}) {
 const o = compact ? OFFER_SHORT : OFFER, lines = [o.run, o.you, o.start];
 return <section id={id} className={compact ? 'sv2-offer is-compact' : 'sv2-offer'} data-scan-section={section} aria-label="What we run and what it costs">
  <dl className="sv2-offer-lines">{lines.map(l => <div key={l.label}><dt>{l.label}</dt><dd>{l.text}</dd></div>)}</dl>
  <p className="sv2-price">{OFFER.price}</p>
  {shape === 'considered' && <a className="sv2-share" href={teamUrl(slug)}>{TEAM.share}<ArrowUpRight size={14} aria-hidden="true"/></a>}
 </section>;
}
