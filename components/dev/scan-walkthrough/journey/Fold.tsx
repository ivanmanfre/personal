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

const STATIONS: [string, string, string, string][] = [
  ['content', 'The post', 'Stops them in the feed.', 'in'], ['inbound', 'The lead magnet', 'Turns a reader into a name.', '▤'], ['newsletter', 'The newsletter', 'Brings them back next week.', '↗'], ['outreach', 'The message', 'Opens a real conversation.', '↳'], ['call', 'The call', 'On your calendar, already warm.', '◉'],
];
/** The loop, drawn by the scroll itself: the track fills as the reader moves down it, and each station lights when the track reaches it. */
export function LoopStations() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 78%', 'end 55%'] });
  const scaleY = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const [reached, setReached] = useState(reduced ? STATIONS.length : 0);
  useMotionValueEvent(scrollYProgress, 'change', v => { if (!reduced) setReached(Math.min(STATIONS.length, Math.floor(v * (STATIONS.length - 1) + 1.02))); });
  return <div className="journey-loop" ref={ref} aria-label="The reader’s loop">
    <span className="loop-track" aria-hidden="true" /><motion.span className="loop-fill" aria-hidden="true" style={{ scaleY: reduced ? 1 : scaleY }} />
    <ol className="loop-stations">{STATIONS.map(([id, title, why, icon], i) => <li key={id} className={i < reached ? 'is-reached' : undefined}>{id === 'call' ? <span className="loop-item"><span className="recap-icon" aria-hidden="true">{icon}</span><span><b>{title}</b><small>{why}</small></span></span> : <a className="loop-item" href={`#${id}`}><span className="recap-icon" aria-hidden="true">{icon}</span><span><b>{title}</b><small>{why}</small></span><i aria-hidden="true">↑</i></a>}</li>)}</ol>
  </div>;
}
