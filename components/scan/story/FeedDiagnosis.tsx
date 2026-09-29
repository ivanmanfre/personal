import React from 'react';
import {motion, useReducedMotion} from 'framer-motion';
import {CircleAlert, CircleCheck, TrendingUp} from 'lucide-react';
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

/** Where it lands after 90 days, when a scan predates the written results. */
const RESULT: Record<string, string> = {
 content: 'Buyers already know you before the first call.',
 inbound: 'A list of named leads that grows every month.',
 outbound: 'A steady flow of booked calls with buyers who fit.',
};

type Cell = {today?: string; monthly?: string; result?: string};

/** Their feed today, what we run every month from month one, and where it lands after 90 days. */
export function FeedDiagnosis({fixture}: {fixture: JourneyFixture}) {
 const reduced = useReducedMotion();
 const d = fixture.diagnosis as Record<string, Cell> | undefined, p = fixture.pillars as Record<string, {found?: string; projected?: string}> | undefined;
 const cell = (k: string): Cell => d?.[k]?.today && d[k].monthly ? d[k] : {today: p?.[k]?.found, monthly: p?.[k]?.projected, result: RESULT[k]};
 const rows = ROWS.map(r => ({...r, ...cell(r.key)})).filter(r => r.today && r.monthly);
 if (rows.length < 2) return null;
 const posts = fixture.audience?.posts;
 const item = {variants: {hide: {opacity: 0, y: 10}, show: {opacity: 1, y: 0, transition: {duration: .45}}}};
 return <section className="sp-diag" aria-label="Your feed today, every month with us, and after 90 days">
  <header className="sp-diag-head">
   <span className="sp-eyebrow-plain">{typeof posts === 'number' && posts > 0 ? `We read your last ${posts} posts` : 'We read your LinkedIn'}</span>
   <BlurWords text="What runs today, and what we’d run."/>
  </header>
  <motion.div className="sp-diag-grid" initial={reduced ? false : 'hide'} whileInView="show" viewport={{once: true, amount: .1}} variants={{show: {transition: {staggerChildren: .06}}}}>
   <span className="sp-diag-corner" aria-hidden="true"/>
   <h3 className="is-today"><CircleAlert size={15} aria-hidden="true"/>Your feed today</h3>
   <h3 className="is-month"><CircleCheck size={15} aria-hidden="true"/>Every month with us</h3>
   <h3 className="is-result"><TrendingUp size={15} aria-hidden="true"/>After 90 days</h3>
   {rows.map(r => <React.Fragment key={r.key}>
    <motion.h4 className="sp-diag-label" {...item}>{r.label}</motion.h4>
    <motion.p className="is-today" data-col="Today" {...item}>{r.today}</motion.p>
    <motion.p className="is-month" data-col="Every month" {...item}>{r.monthly}</motion.p>
    <motion.p className="is-result" data-col="After 90 days" {...item}>{r.result}</motion.p>
   </React.Fragment>)}
  </motion.div>
 </section>;
}
