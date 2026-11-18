import React from 'react';
import {ArrowDown, ArrowUpRight} from 'lucide-react';
import type {HeroRow, JourneyFixture} from '../../../dev/scan-walkthrough/journey/model';
import {Avatar} from '../../../dev/scan-walkthrough/journey/ReadingChapter';
import {countLine, heroSentence, shortDate} from './hero';
import {BRAND_LINE, BRAND_SUB, PROFILE_HERO, PUBLIC_NOTE} from './copy';
import './scan-v2.css';

const initials = (name: string) => name.split(/\s+/).map(w => w.replace(/[^\p{L}]/gu, '')[0]).filter(Boolean).slice(0, 2).join('');

/** What we saw the person do, in the words of the existing buyer list. */
export function signalText(row: HeroRow): string {
 const d = row.date ? shortDate(row.date) : '';
 const what = row.source === 'own'
  ? (row.how === 'engaged' ? 'Engages with your posts' : `${row.how === 'commented' ? 'Commented on' : 'Liked'} your post`)
  : `${row.how === 'liked' ? 'Liked' : 'Commented on'} a post${row.author ? ` by ${row.author}` : ''}`;
 return d && row.how !== 'engaged' ? `${what} · ${d}` : what;
}

export function PersonName({row}: {row: HeroRow}) {
 return row.profileUrl
  ? <a className="sv2-name" href={row.profileUrl} target="_blank" rel="noreferrer">{row.name}<ArrowUpRight size={13} aria-hidden="true"/></a>
  : <b className="sv2-name">{row.name}</b>;
}

export function BuyerRow({row}: {row: HeroRow}) {
 const signal = signalText(row);
 return <li>
  <span className="sp-audit-face" aria-hidden="true">{initials(row.name)}</span>
  <div>
   <PersonName row={row}/>
   {(row.role || row.headline) && <small className="sv2-role">{row.role || row.headline}</small>}
   {row.postUrl ? <a className="sv2-signal" href={row.postUrl} target="_blank" rel="noreferrer">{signal}</a> : <span className="sv2-signal">{signal}</span>}
  </div>
 </li>;
}

/** A LinkedIn headline is a run of " | " parts; the hero quotes the first one when the whole line is long. */
export const headlineQuote = (quote: string) => quote.length > 60 && quote.includes(' | ') ? quote.split(' | ')[0].trim() : quote;

/** The read date: the outside read when there is one, else the audit date. */
export const readDate = (fixture: JourneyFixture) => shortDate(fixture.competitorEngagers?.readOn || fixture.source.capturedOn || '');

/** The buyer sentence leads; Ivan's line sits above it word for word. */
function Headline({lead}: {lead: HeroRow}) {
 const sentence = heroSentence(lead);
 if (!sentence.startsWith(lead.name)) return <h1>{sentence}</h1>;
 return <h1><mark>{lead.name}</mark>{sentence.slice(lead.name.length)}</h1>;
}

/** The checked hero, or for a rejected one the plainest first screen: the profile tier when the profile audit quotes
 *  the headline, else the page's own headline with the offer under it. No count, no named buyer, no date. */
export function HeroBuyer({fixture}: {fixture: JourneyFixture}) {
 const hero = fixture.hero, lead = hero?.lead;
 const profile = hero ? (hero.tier === 'profile' ? hero.profile : undefined) : fixture.heroRejected?.profile;
 const plain = !hero && !profile;
 const line = hero && lead ? countLine(hero.count, lead.source) : null;
 const rows = hero && lead && hero.rows.length > 1 ? hero.rows : [];
 const {founder} = fixture;
 return <section className="sv2-hero" data-scan-section="hero" data-tier={hero?.tier ?? (profile ? 'profile' : 'plain')}>
  <div className="sv2-hero-copy">
   <span className="made-for"><Avatar src={founder.avatarUrl} name={founder.name} alt={founder.name}/>Made for {founder.name}{founder.company ? ` · ${founder.company}` : ''}</span>
   {plain ? <h1>{BRAND_LINE}</h1> : <p className="sv2-brand-line">{BRAND_LINE}</p>}
   {profile ? <><h1>{PROFILE_HERO(headlineQuote(profile.quote))}</h1><p className="sv2-fix">{profile.fix}</p></> : lead && <Headline lead={lead}/>}
   {line && <p className="sv2-count">{line}</p>}
   <p className="sv2-sub">{BRAND_SUB}</p>
   <div className="sv2-hero-actions">
    {profile
     ? fixture.profileAudit ? <a href="#profile" className="studio-primary">See the profile changes <ArrowDown size={17} aria-hidden="true"/></a> : <a href="#offer" className="studio-primary">See what we run <ArrowDown size={17} aria-hidden="true"/></a>
     : plain ? <a href="#offer" className="studio-primary">See what we run <ArrowDown size={17} aria-hidden="true"/></a>
     : <a href="#buyers" className="studio-primary">See who else <ArrowDown size={17} aria-hidden="true"/></a>}
   </div>
  </div>
  {hero && (rows.length > 0 || !profile) && <aside className="sv2-sheet" aria-label="Buyers from the read">
   {rows.length > 0 && <ol className="sv2-rows">{rows.map(r => <BuyerRow key={r.name + (r.profileUrl || '')} row={r}/>)}</ol>}
   {rows.length > 1 && <a className="sv2-more" href="#buyers">See {rows.length - 1} more</a>}
   <p className="sv2-note">{PUBLIC_NOTE(readDate(fixture))}</p>
  </aside>}
 </section>;
}
