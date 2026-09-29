import React from 'react';
import {motion, useReducedMotion} from 'framer-motion';
import {Check, CircleAlert, CircleCheck, Minus} from 'lucide-react';
import type {JourneyFixture} from '../../dev/scan-walkthrough/journey/model';
import {BlurWords} from './motion';

const ROWS = [
 {key: 'content', label: 'Content'},
 {key: 'inbound', label: 'Lead magnets'},
 {key: 'outbound', label: 'Warm outreach'},
] as const;

/** Reach arithmetic, the old scan's conservative formula on the audit's own counts. Shown only when it clears the bar. */
export function reachFrom(fixture: JourneyFixture) {
 const a = fixture.audience, posts = a?.posts, people = a?.engagers;
 if (typeof posts !== 'number' || typeof people !== 'number' || posts < 3 || people < 1) return null;
 const perPost = people / posts, readers = Math.round(perPost * 15), leads = Math.round(readers * 17 * .005);
 return perPost >= 5 && leads >= 10 ? {posts, people, readers, leads} : null;
}

/** What runs on their feed today, next to what runs once we take it over. From their own posts. */
export function FeedDiagnosis({fixture}: {fixture: JourneyFixture}) {
 const reduced = useReducedMotion(), p = fixture.pillars as Record<string, {found?: string; projected?: string}> | undefined;
 const rows = ROWS.filter(r => p?.[r.key]?.found && p?.[r.key]?.projected);
 if (rows.length < 2) return null;
 const posts = fixture.audience?.posts;
 const item = (i: number) => ({initial: reduced ? false : {opacity: 0, y: 10}, whileInView: {opacity: 1, y: 0}, viewport: {once: true, amount: .4}, transition: {duration: reduced ? 0 : .45, delay: reduced ? 0 : i * .12}});
 return <section className="sp-diag" aria-label="Your feed today and after 90 days">
  <header className="sp-diag-head">
   <span className="sp-eyebrow-plain">{typeof posts === 'number' && posts > 0 ? `We read your last ${posts} posts` : 'We read your LinkedIn'}</span>
   <BlurWords text="What runs today, and what we’d run."/>
  </header>
  <div className="sp-diag-grid">
   <h3 className="is-today"><CircleAlert size={15} aria-hidden="true"/>On your feed today</h3>
   <h3 className="is-after"><CircleCheck size={15} aria-hidden="true"/>After 90 days with us</h3>
   {rows.map((r, i) => <React.Fragment key={r.key}>
    <motion.div className="is-today" {...item(i * 2)}><Minus size={15} aria-hidden="true"/><span><b>{r.label}</b>{p![r.key].found}</span></motion.div>
    <motion.div className="is-after" {...item(i * 2 + 1)}><Check size={15} aria-hidden="true"/><span><b>{r.label}</b>{p![r.key].projected}</span></motion.div>
   </React.Fragment>)}
  </div>
 </section>;
}
