import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { deriveHook, monthMath, pillarRows, readerFor, type JourneyFixture } from './model';
import { Reveal, labels } from './ReadingChapter';

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
  return <span ref={ref} className="tally">{prefix}{n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</span>;
}

/** The fold: one screen. The counted hook, the named faces, the gap; the pillar table sits behind a tap. */
export function Fold({ fixture, ask }: { fixture: JourneyFixture; ask?: React.ReactNode }) {
  const hook = deriveHook(fixture.audience, fixture.thesis, fixture.founder.firstName);
  const rows = pillarRows(fixture.pillars);
  const reader = readerFor(fixture);
  return <section className="journey-hero">
    <div className="hero-copy">
      <span className="journey-eyebrow">{fixture.founder.name} / {fixture.founder.company}</span>
      <h1>{hook.count ? <><span className="hero-count">{hook.count.prefix}{hook.count.value}</span> {hook.count.rest}</> : hook.headline}</h1>
      <p>{hook.lede}</p>
    </div>
    {hook.count && <Reveal className="hero-room" aria-label="Who is in your room">
      <div className="room-figure"><span className="room-fig"><Tally value={hook.count.value} prefix={hook.count.prefix} /></span><span className="room-figk">{hook.figureLabel}</span></div>
      <div className="room-right">
        {hook.named.length > 0 && <ul className="room-names">{hook.named.map(n => <li key={n.name}><span className="room-face" aria-hidden="true">{n.name.split(' ').map(w => w[0]).slice(0, 2).join('')}</span><span className="room-who"><b>{n.name}</b><span>{n.headline}</span></span></li>)}</ul>}
        {hook.gapLine && <p className="room-gap">{hook.gapLine} <span>Nobody followed up.</span></p>}
      </div>
      {hook.caveat && <p className="room-caveat">{hook.caveat}</p>}
    </Reveal>}
    <details className="hero-verdict" open={!hook.count}>
      <summary><span className="verdict-sq" aria-hidden="true" /><span className="verdict-head">What runs today, and what we’d run</span><span className="verdict-toggle" aria-hidden="true">+</span></summary>
      {hook.warningBody && <p className="verdict-body">{hook.warningBody}</p>}
      {rows.length > 0 && <div className="ptab" role="table" aria-label="What runs today and what we would run">
        <div className="ptab-h" role="row"><span role="columnheader">Pillar</span><span role="columnheader">On your feed today</span><span role="columnheader">After 90 days</span></div>
        {rows.map(r => <div className="ptab-r" key={r.key} role="row"><div role="cell"><a className="ptab-a" href={`#${r.anchor}`}>{r.name}</a></div><div className="ptab-f" data-l="On your feed today" role="cell">{r.found}</div><div className="ptab-v" data-l="After 90 days" role="cell">{r.projected}</div></div>)}
      </div>}
    </details>
    {ask}
    <div className="buyer-intro">
      <span className={`reader-face${reader.real ? ' is-real' : ''}`} aria-hidden="true">{reader.initials}</span>
      <div><span className="buyer-label">Follow {reader.first}.</span><p>{reader.real ? <>{reader.headline}. Engaged your posts. Here is what happens next.</> : <>{reader.headline}. Never heard of {fixture.founder.company} until today.</>}</p></div>
    </div>
  </section>;
}

/** One month from the scan's own numbers, arithmetic on the page. Renders nothing unless every input is stated. */
export function MonthStrip({ fixture }: { fixture: JourneyFixture }) {
  const m = monthMath(fixture.samples.metrics as { label: string; value: string }[] | undefined);
  if (!m) return null;
  const fmt = (n: number) => n.toLocaleString('en-US');
  const steps: { v: number; pre?: string; op?: string; k: string; c: string }[] = [
    { v: m.reactions, k: 'reactions per post', c: `your average, last 20 posts` },
    { v: m.readersPerPost, pre: '~', op: `× ${m.perReaction}`, k: 'readers per post', c: `about ${m.perReaction} readers per reaction` },
    { v: m.readersPerMonth, pre: '~', op: `× ${m.postsPerMonth}`, k: 'readers a month', c: `${m.postsPerWeek} posts a week` },
    { v: m.leads, pre: '≈', op: `× ${m.capturePct}%`, k: 'named leads a month', c: 'take the lead magnet' },
  ];
  return <Reveal className="month-strip" aria-label="One month in numbers">
    <span className="journey-eyebrow">One month, from your own numbers</span>
    <ol>{steps.map((s, i) => <li key={s.k} className={i === steps.length - 1 ? 'is-result' : undefined}>{s.op && <span className="month-op">{s.op}</span>}<span className="month-v"><Tally value={s.v} prefix={s.pre} duration={900 + i * 250} /></span><b>{s.k}</b><small>{s.c}</small></li>)}</ol>
    <p className="month-note">{fmt(m.leads)} people a month with a name and an email, each one getting the messages above. The rates are conservative: {m.perReaction} readers per reaction and {m.capturePct}% capture.</p>
  </Reveal>;
}

const RAIL = ['content', 'inbound', 'newsletter', 'outreach', 'together'];
/** A fixed side rail: pure scroll position, no springs. The current chapter is lit; each dot jumps. */
export function ProgressRail() {
  const [state, setState] = useState({ active: -1, visible: false, progress: 0 });
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const els = RAIL.map(id => document.getElementById(id));
      const close = document.querySelector('.sg-proof') as HTMLElement | null;
      const line = window.innerHeight * .4;
      let active = -1;
      els.forEach((el, i) => { if (el && el.getBoundingClientRect().top <= line) active = i; });
      const first = els[0]?.getBoundingClientRect().top ?? 0;
      const end = close?.getBoundingClientRect().top ?? 0;
      const visible = first <= line && end > line;
      const total = end - first, progress = total > 0 ? Math.min(1, Math.max(0, (line - first) / total)) : 0;
      setState(s => (s.active === active && s.visible === visible && Math.abs(s.progress - progress) < .002) ? s : { active, visible, progress });
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true }); window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(frame); };
  }, []);
  return <nav className={`progress-rail${state.visible ? ' is-visible' : ''}`} aria-label="Chapters">
    <span className="rail-bar" aria-hidden="true"><span style={{ transform: `scaleY(${state.progress})` }} /></span>
    <span className="rail-top" aria-hidden="true"><span style={{ transform: `scaleX(${state.progress})` }} /></span>
    <ol>{RAIL.map((id, i) => <li key={id} className={i === state.active ? 'is-active' : i < state.active ? 'is-done' : undefined}><a href={`#${id}`} aria-current={i === state.active ? 'step' : undefined}><span className="rail-dot" aria-hidden="true" /><span className="rail-label"><i>{String(i + 1).padStart(2, '0')}</i>{labels[id]}</span></a></li>)}</ol>
  </nav>;
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
