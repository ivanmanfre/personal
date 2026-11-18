import React from 'react';
import {ArrowUpRight} from 'lucide-react';
import type {JourneyFixture} from '../../../dev/scan-walkthrough/journey/model';
import {BuyerRow, readDate} from './HeroBuyer';
import {OfferBlock} from './OfferBlock';
import {PeopleStory} from './PeopleStory';
import {bookUrl, countLine} from './hero';
import {CHECKED, PUBLIC_NOTE, SAFETY_LINES, START_NOTE, START_STEPS, TEAM} from './copy';
import './scan-v2.css';

/** The story StudioResults leads with; shown when the data names no closer one. */
const FIRST_STORY = 'kyle';

/** The short version for a co-director who never saw the DM: who made it, for whom, what is offered, at what price. */
export function PartnerView({fixture}: {fixture: JourneyFixture}) {
 const hero = fixture.hero, {founder} = fixture, lead = hero?.lead;
 const line = hero && lead ? countLine(hero.count, lead.source) : null;
 return <div className="story-plan sv2-team" data-scan-section="team">
  <header className="sv2-team-intro">
   <span className="sv2-brand-line">{TEAM.eyebrow(founder.company || founder.name)}</span>
   <h1>{TEAM.intro(founder.name)}</h1>
  </header>
  {hero && lead && hero.rows.length > 0 && <section className="sv2-team-part" aria-labelledby="team-numbers">
   <h2 id="team-numbers">{TEAM.numbers}</h2>
   <div>
    <ol className="sv2-list sv2-team-rows">{hero.rows.map(r => <BuyerRow key={r.name + (r.profileUrl || '')} row={r}/>)}</ol>
    {line && <p className="sv2-team-line">{line}</p>}
    {hero.checked && <p className="sv2-checked">{CHECKED(hero.checked.people, hero.checked.passed)}</p>}
    <p className="sv2-checked">{PUBLIC_NOTE(readDate(fixture))}</p>
   </div>
  </section>}
  <OfferBlock slug={fixture.slug} shape="fast"/>
  <section className="sv2-team-part sv2-team-start" aria-labelledby="team-start">
   <h2 id="team-start">{TEAM.start}</h2>
   <div>
    <ol className="sv2-steps">{START_STEPS.map((s, i) => <li key={s.title}><span className="sv2-step-n">{String(i + 1).padStart(2, '0')}</span><b>{s.title}</b><ul>{s.items.map(x => <li key={x}>{x}</li>)}</ul></li>)}</ol>
    <p className="sv2-checked">{START_NOTE}</p>
   </div>
  </section>
  <section className="sv2-team-part" aria-label="What stays yours">
   <ul className="sv2-safety">{SAFETY_LINES.map(l => <li key={l}>{l}</li>)}</ul>
  </section>
  <div className="sv2-team-story">
   <PeopleStory story={fixture.partnerStory ?? FIRST_STORY}/>
   <a className="sv2-share" href={`/scan/${encodeURIComponent(fixture.slug)}/#stories`}>{TEAM.moreStories}<ArrowUpRight size={14} aria-hidden="true"/></a>
  </div>
  <section className="sv2-team-close">
   <a className="studio-primary" href={bookUrl(fixture.slug, 'team')} target="_blank" rel="noreferrer" data-scan-click="book-team">{TEAM.cta}<ArrowUpRight size={18} aria-hidden="true"/></a>
   <a className="sv2-share" href={`/scan/${encodeURIComponent(fixture.slug)}/`}>{TEAM.back}</a>
  </section>
 </div>;
}
