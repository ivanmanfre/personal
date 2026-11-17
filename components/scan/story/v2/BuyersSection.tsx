import React, {useState} from 'react';
import {ArrowUpRight} from 'lucide-react';
import type {CompetitorEngager, HeroRow, JourneyFixture} from '../../../dev/scan-walkthrough/journey/model';
import {ClientEngagers, DmHead, Thread, Bubble} from '../StudioPlan';
import {firstNameOf} from '../adapter';
import {bookUrl, shortDate} from './hero';
import {AFTER_BUYERS, CHECKED} from './copy';
import {BuyerRow, PersonName} from './HeroBuyer';

const SHOWN = 5;
const shortName = (name: string) => name.split(/\s+[|(]|:\s|\s[-–]\s/)[0].trim();
const initials = (name: string) => name.split(/\s+/).map(w => w.replace(/[^\p{L}]/gu, '')[0]).filter(Boolean).slice(0, 2).join('');
const LINKEDIN_IN = /^https:\/\/(www\.)?linkedin\.com\/in\//;

function OutsideRow({p}: {p: CompetitorEngager}) {
 const d = shortDate(p.commentedAt || p.postedAt);
 return <li>
  <span className="sp-audit-face" aria-hidden="true">{initials(p.name)}</span>
  <div>
   <a className="sv2-name" href={p.profileUrl} target="_blank" rel="noreferrer">{p.name}<ArrowUpRight size={13} aria-hidden="true"/></a>
   {p.headline && <small className="sv2-role">{p.headline}</small>}
   {p.reason && <p className="sv2-reason">{p.reason}</p>}
   <a className="sv2-signal" href={p.postUrl} target="_blank" rel="noreferrer">{p.engaged === 'commented' ? 'Commented on' : 'Liked'} a post by {shortName(p.competitor)}{d ? ` · ${d}` : ''}</a>
  </div>
 </li>;
}

function Outside({fixture}: {fixture: JourneyFixture}) {
 const data = fixture.competitorEngagers!, checked = fixture.hero?.checked;
 const [open, setOpen] = useState(false);
 const hidden = !open && data.people.length > SHOWN + 1 ? data.people.length - SHOWN : 0;
 const people = hidden ? data.people.slice(0, SHOWN) : data.people;
 return <div className="sv2-part" data-part="outside">
  <h2>Buyers reading posts in your market</h2>
  {checked && <p className="sv2-checked">{CHECKED(checked.people, checked.passed)}</p>}
  <ol className="sv2-list">{people.map(p => <OutsideRow key={p.profileUrl} p={p}/>)}</ol>
  {hidden > 0 && <button type="button" className="sv2-show" onClick={() => setOpen(true)}>Show {hidden} more people</button>}
 </div>;
}

/** Own buyers as rows. The count is never printed here, so one buyer reads as one person. */
function Own({fixture}: {fixture: JourneyFixture}) {
 const named = (fixture.audience?.named ?? []).filter(n => (n?.name || '').trim()) as (NonNullable<JourneyFixture['audience']>['named'][number] & {role?: string; profile_url?: string; how?: string; date?: string})[];
 const rows: HeroRow[] = named.map(n => ({name: n.name.trim(), role: (n.role || '').trim(), headline: (n.headline || '').trim(), source: 'own', how: n.how === 'commented' || n.how === 'liked' ? n.how : 'engaged', postExcerpt: '', reason: '', ...(typeof n.profile_url === 'string' && LINKEDIN_IN.test(n.profile_url) ? {profileUrl: n.profile_url} : {}), ...(n.date && !Number.isNaN(new Date(n.date).getTime()) ? {date: n.date} : {})}));
 return <div className="sv2-part" data-part="own">
  <h2>Buyers already engaging with you</h2>
  <ol className="sv2-list">{rows.map(r => <BuyerRow key={r.name} row={r}/>)}</ol>
  <ClientEngagers people={fixture.audience?.existing_clients ?? []}/>
 </div>;
}

/** The lead as a bought list would show them, beside what we saw them do. */
export function Pair({lead}: {lead: HeroRow}) {
 const d = lead.date ? shortDate(lead.date) : '';
 const verb = lead.how === 'liked' ? 'Liked' : lead.how === 'engaged' ? 'Engaged with' : 'Commented on';
 const what = lead.source === 'own' ? `${verb} your post` : `${verb} a post${lead.author ? ` by ${lead.author}` : ''}`;
 const when = !d ? '' : lead.dateKind === 'comment' && lead.how !== 'liked' ? ` on ${d}` : `, posted ${d}`;
 return <div className="sv2-pair">
  <div className="sv2-pair-card"><span className="sv2-pair-label">On a bought list</span><p><PersonName row={lead}/>{lead.role ? ` · ${lead.role}` : ''}</p></div>
  <div className="sv2-pair-card is-seen"><span className="sv2-pair-label">What we saw</span><p>{what}{when}: “{lead.postExcerpt}”</p></div>
 </div>;
}

export function BuyersSection({fixture}: {fixture: JourneyFixture}) {
 const hero = fixture.hero, lead = hero?.lead;
 const outside = !!fixture.competitorEngagers?.people.length;
 const ownCount = fixture.audience?.engager_icp_count ?? 0;
 const own = ownCount >= 1 && (fixture.audience?.named ?? []).some(n => (n?.name || '').trim());
 if (!outside && !own) return null;
 const note = fixture.competitorEngagers?.notes[0];
 const parts = [outside && <Outside key="outside" fixture={fixture}/>, own && <Own key="own" fixture={fixture}/>];
 if (lead?.source === 'own') parts.reverse();
 return <section id="buyers" className="sv2-buyers story-scene" data-scan-section="buyers" aria-label="Buyers we found">
  {parts[0]}
  {lead && lead.postExcerpt && <Pair lead={lead}/>}
  {parts[1]}
  {note && <div className="sv2-note-dm">
   <h3>A first message to {firstNameOf(note.to)}</h3>
   <article className="sp-dm" data-mockup="linkedin" aria-label={`Example note to ${note.to}`}>
    <DmHead name={note.to} role={note.headline}/>
    <Thread><Bubble mine>{note.note}</Bubble></Thread>
   </article>
  </div>}
  <div className="sv2-after">
   <p>{AFTER_BUYERS.title}</p>
   <a className="studio-primary" href={bookUrl(fixture.slug, 'after-buyers')} target="_blank" rel="noreferrer" data-scan-click="book-after-buyers">{AFTER_BUYERS.cta}<ArrowUpRight size={18} aria-hidden="true"/></a>
  </div>
 </section>;
}
