import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { deriveHook, pillarRows, type JourneyFixture } from './model';
import { Reveal } from './ReadingChapter';

/** Counts up once when it scrolls into view. Settled under reduced motion. */
export function Tally({ value, prefix = '', suffix = '', decimals = 0, duration = 1100 }: { value: number; prefix?: string; suffix?: string; decimals?: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' });
  const reduced = useReducedMotion();
  const [n, setN] = useState(reduced ? value : 0);
  useEffect(() => {
    if (reduced) { setN(value); return; }
    if (!inView) { const snap = setTimeout(() => setN(value), 1600); return () => clearTimeout(snap); }
    let raf = 0; const t0 = performance.now();
    const step = (t: number) => { const p = Math.min(1, (t - t0) / duration); setN(value * (1 - Math.pow(1 - p, 3))); if (p < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, reduced, duration]);
  return <span ref={ref} className="tally">{prefix}{n.toFixed(decimals)}{suffix}</span>;
}

/** The fold: the scan's own read of the prospect, before the story starts. */
export function Fold({ fixture }: { fixture: JourneyFixture }) {
  const hook = deriveHook(fixture.audience, fixture.thesis, fixture.founder.firstName);
  const rows = pillarRows(fixture.pillars);
  return <section className="journey-hero">
    <div className="hero-copy">
      <span className="journey-eyebrow">{fixture.founder.name} / {fixture.founder.company}</span>
      <h1>{hook.count ? <><span className="hero-count">{hook.count.prefix}{hook.count.value}</span> {hook.count.rest}</> : hook.headline}</h1>
      <p>{hook.lede}</p>
    </div>
    {hook.figureLabel && <Reveal className="hero-room" aria-label="Who is in your room">
      <div className="room-figure"><span className="room-figk">{hook.figureLabel}</span><span className="room-fig"><Tally value={hook.count?.value ?? 0} prefix={hook.count?.prefix} /></span><p>{hook.figureSub}</p></div>
      <div className="room-receipts">{hook.receipts.map(r => <div key={r.key} className={`room-receipt${r.mark ? ' is-mark' : ''}`}><span className="room-rk">{r.label}</span><span className="room-rv"><Tally value={r.value} prefix={r.prefix} suffix={r.suffix} decimals={r.decimals} /></span><span className="room-rc">{r.cap}</span></div>)}</div>
      {hook.named.length > 0 && <ul className="room-names">{hook.named.map(n => <li key={n.name}><b>{n.name}</b><span>{n.headline}</span><small>Engaged your posts</small></li>)}</ul>}
      {hook.gapLine && <p className="room-gap"><span>As it runs today</span>{hook.gapLine}</p>}
      {hook.caveat && <p className="room-caveat">{hook.caveat}</p>}
    </Reveal>}
    <Reveal className="hero-verdict" as="div">
      <div className="verdict-head"><span className="verdict-sq" aria-hidden="true" />{hook.warning}</div>
      {hook.warningBody && <p className="verdict-body">{hook.warningBody}</p>}
      {rows.length > 0 && <div className="ptab" role="table" aria-label="What runs today and what we would run">
        <div className="ptab-h" role="row"><span role="columnheader">Pillar</span><span role="columnheader">On your feed today</span><span role="columnheader">After 90 days</span></div>
        {rows.map(r => <div className="ptab-r" key={r.key} role="row"><div role="cell"><a className="ptab-a" href={`#${r.anchor}`}>{r.name}</a></div><div className="ptab-f" data-l="On your feed today" role="cell">{r.found}</div><div className="ptab-v" data-l="After 90 days" role="cell">{r.projected}</div></div>)}
      </div>}
      <p className="verdict-note">Read from your public presence. Tap a pillar to jump to it.</p>
    </Reveal>
    <div className="buyer-intro"><span className="buyer-label">This is Alex.</span><p>{fixture.buyer.role}. Never heard of {fixture.founder.company} until today.</p></div>
  </section>;
}

type Station = { id: string; title: string; why: string; icon: string; href?: string; tags?: string[] };
/** The whole system as two lanes that meet at the call. The scroll draws both lanes, then the merge. */
export function SystemMap({ fixture }: { fixture: JourneyFixture }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const cold = (fixture.samples as { cold_outbound?: { note?: string; sources?: { label: string }[] } }).cold_outbound;
  const inbound: Station[] = [
    { id: 'content', title: 'The post', why: 'Stops them in the feed.', icon: 'in', href: '#content' },
    { id: 'inbound', title: 'The lead magnet', why: 'Turns a reader into a name.', icon: '▤', href: '#inbound' },
    { id: 'newsletter', title: 'The newsletter', why: 'Brings them back every week.', icon: '↗', href: '#newsletter' },
  ];
  const outbound: Station[] = [
    { id: 'warm', title: 'Warm outreach', why: 'Everyone who engages a post gets a note that names it.', icon: '↳', href: '#outreach' },
    { id: 'signal', title: 'Signal outreach', why: 'A buyer shows intent, a message goes out that week.', icon: '◎', tags: ['Viewed your profile', 'Changed roles', 'Engaged a competitor’s post'] },
    { id: 'cold', title: 'Cold outreach', why: cold?.note || 'Buyers who don’t know you yet, warmed up before the first message.', icon: '→', tags: cold?.sources?.slice(0, 3).map(x => x.label) },
  ];
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 75%', 'end 70%'] });
  const lane = useTransform(scrollYProgress, [0, .72], [0, 1]);
  const merge = useTransform(scrollYProgress, [.72, .92], [0, 1]);
  const [v, setV] = useState(reduced ? 1 : 0);
  useMotionValueEvent(scrollYProgress, 'change', x => { if (!reduced) setV(x); });
  const reached = (i: number) => v >= (i / 3) * .72 + .02;
  const renderLane = (key: string, label: string, items: Station[]) => <div className={`sys-lane sys-${key}`}>
    <span className="sys-lane-k">{label}</span>
    <div className="sys-lane-body"><span className="sys-track" aria-hidden="true" /><motion.span className="sys-fill" aria-hidden="true" style={{ scaleY: reduced ? 1 : lane }} />
      <ol>{items.map((st, i) => { const inner = <><span className="recap-icon" aria-hidden="true">{st.icon}</span><span className="sys-text"><b>{st.title}</b><small>{st.why}</small>{st.tags?.length ? <span className="sys-tags">{st.tags.map(t => <i key={t}>{t}</i>)}</span> : null}</span></>;
        return <li key={st.id} className={reached(i) ? 'is-reached' : undefined}>{st.href ? <a className="sys-item" href={st.href}>{inner}</a> : <span className="sys-item">{inner}</span>}</li>; })}</ol>
    </div>
  </div>;
  return <div className="sysmap" ref={ref} aria-label="How the pieces meet">
    <div className="sys-lanes">{renderLane('in', 'They come to you', inbound)}{renderLane('out', 'You go to them', outbound)}</div>
    <svg className="sys-merge" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><path className="sys-merge-bg" d="M25 0 C25 24 50 16 50 40 M75 0 C75 24 50 16 50 40" /><motion.path className="sys-merge-fg" d="M25 0 C25 24 50 16 50 40 M75 0 C75 24 50 16 50 40" style={{ pathLength: reduced ? 1 : merge }} /></svg>
    <div className={`sys-call${v >= .9 ? ' is-reached' : ''}`}><span className="recap-icon" aria-hidden="true">◉</span><span><b>The call</b><small>On your calendar, already warm.</small></span></div>
  </div>;
}
