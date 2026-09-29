/**
 * PipelineNight: the Outreach tab (hash `outreach`) on the night board. NIGHT MOCKUP, local
 * only (2026-09-29); ReportPipeline renders it when the board URL carries `?night`.
 *
 * Same model as the desk version, read through report/PipelineBlocks (pipelineData,
 * linesData, funnelStages, storeKindItems...) and weekResults.sliceSeries, so every number,
 * name and quote is the one the light tab prints. Nothing here counts on its own.
 *
 * NIGHT v4 (Ivan 2026-09-29 on v3: "looks way less cool and u even changed the font type"):
 * v2's LOOK is back, v3's WORDS stay.
 *   hero     the thin gradient calls-booked number, the booked names beside their avatar
 *            circles (the sentence that matches them), then who is interested right now with
 *            the ONE definition of "interested"
 *   funnel   the liquid funnel in its panel, poured once and then still, in the one glossary
 *            (funnelStages: reached, connected, replied, said yes, booked a call); each stage
 *            jumps to its list. No hint line.
 *   ledger   everyone we contacted, split by group (glass panels, the strip, the table)
 *   weeks    the week chart panel: grey bars = replied, a yellow badge = booked a call; the
 *            busiest reply week pre-selected, the best-week line as the heading
 *   lists    interested right now, calls booked (glowing gold cards), everyone else who
 *            wrote back (folded); "Read the thread", plain counts in caps eyebrows
 * Nothing loops, nothing reveals on scroll, count-ups live only on the Home hero.
 *
 * NightFunnel, NightWeeks and NIGHT_CSS are exported for PerfReport, so both tabs draw the
 * same funnel and the same chart.
 */
import React, { useMemo, useState, type CSSProperties, type PointerEvent } from 'react';
import { m, useReducedMotion } from 'framer-motion';
import { MotionRoot, useReveal, EASE } from './motion';
import { AvatarCircles, DotPattern } from './magicui';
import { AnimateNumber, FunnelShape } from './twentyfirst';
import { PK_CSS } from './styles';
import { dm, dayKey, addDays } from '../report/reportModel';
import type { ReportCtx } from '../report/ReportBlocks';
import { initialsOf, sliceSeries, axisLabel, type SliceBar } from '../weekResults';
import {
  pipelineData, linesData, funnelStages, storeKindItems, archCameFromItems, isArch, intentChip, lastInboundText,
  shownText, REACTION, norm,
  type LogEntry, type BookedExtra, type Card_, type Row, type ChipItem, type FunnelStage,
} from '../report/PipelineBlocks';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const SHOW = 6;

/* ───────────────────────────── shared night look ───────────────────────────── */

/** The funnel panel and the week chart panel, shared by Outreach and Performance. v2's look
 *  (caps labels, thin Sora numbers, the lit column) with the readability floor: caps labels
 *  11px+ at >= 62% white. */
export const NIGHT_CSS = `
.pk .pk-mute { color: rgb(var(--nt-fg, 255 255 255) / .64); }
.nf-panel { overflow: hidden; }
.nf-panel .pk-fn { margin-top: 20px; }
.nf-panel .pk-fn-stages { grid-column: 1 / -1; position: relative; z-index: 1; }
.nf-stage { appearance: none; border: 0; background: none; color: inherit; font: inherit; text-align: left; box-sizing: border-box; width: calc(100% + 12px); margin-left: -12px; padding: 0 0 0 12px; height: var(--fn-stage); display: flex; flex-direction: column; justify-content: center; border-radius: 14px 6px 6px 14px; -webkit-tap-highlight-color: transparent; }
button.nf-stage { cursor: pointer; }
button.nf-stage:hover, button.nf-stage:focus-visible { background: linear-gradient(90deg, rgb(var(--nt-fg, 255 255 255) / .07), rgb(var(--nt-fg, 255 255 255) / 0) 58%); }
.nf-stage .nf-go { display: inline-flex; align-items: center; gap: 6px; margin-top: 6px; letter-spacing: .1em; }
.nf-stage .nf-go svg { opacity: .5; flex: none; }
button.nf-stage:hover .nf-go svg, button.nf-stage:focus-visible .nf-go svg { opacity: 1; color: var(--cb-accent-fg, var(--cb-accent)); }
@media (prefers-reduced-motion: no-preference) { .nf-stage { transition: background-color 200ms ease; } }

.nw-panel { margin-top: 20px; }
.nw-legend .pk-sw-msg { background: rgb(var(--nt-fg, 255 255 255) / .3); }
.nw .pk-chart { --plot: 150px; --slot: 30px; }
@media (min-width: 768px) { .nw .pk-chart { --plot: 190px; --slot: 34px; } }
.nw .pk-bar { width: clamp(14px, 4.6vw, 40px); }
.nw .pk-col.on .pk-bar-msg .pk-fill { background: rgb(var(--nt-fg, 255 255 255) / .55); }
.nw .pk-col.on .pk-bar-msg .pk-val { color: rgb(var(--nt-fg, 255 255 255)); }
.nw .pk-bar-msg .pk-val { color: rgb(var(--nt-fg, 255 255 255) / .66); font-size: 11px; }
@media (min-width: 768px) { .nw .pk-bar-msg .pk-val { font-size: 13px; } }
.nw .pk-badge { font-size: 11px; }
.nw .pk-wl small { font-size: 11px; letter-spacing: .04em; color: rgb(var(--nt-fg, 255 255 255) / .62); }
.nw .nw-thin { visibility: hidden; }
@media (min-width: 640px) { .nw .nw-thin { visibility: visible; } }
.nw .pk-readout { min-height: 0; margin-top: 10px; padding-bottom: 6px; }
.nw .pk-rd-stats dt { font-size: 12.5px; color: rgb(var(--nt-fg, 255 255 255) / .66); }

/* QUIET (2026-09-29, "private-bank quiet, receipts first"): white panels on the light ground,
   a matte funnel, grey bars with the chosen week in ink, yellow only as the booked-a-call
   marks and the marker under a booked-call number. Night never matches [data-quiet]. */
[data-quiet] .nf-panel, [data-quiet] .nw-panel { background: #FFFFFF; border: 1px solid rgba(17,17,17,.09); }
[data-quiet] .pk-fn-matte { filter: none !important; mask-image: none; -webkit-mask-image: none; }
[data-quiet] .pk-money { display: inline-block; color: #111 !important; padding: 0 .08em; margin: 0 -.08em; background: linear-gradient(transparent 58%, color-mix(in srgb, var(--cb-accent) 80%, transparent) 58%, color-mix(in srgb, var(--cb-accent) 80%, transparent) 92%, transparent 92%); }
[data-quiet] button.nf-stage:hover, [data-quiet] button.nf-stage:focus-visible { background: rgba(17,17,17,.035); }
[data-quiet] button.nf-stage:hover .nf-go svg, [data-quiet] button.nf-stage:focus-visible .nf-go svg { color: #111; }
[data-quiet] .nf-stage .nf-go { color: rgba(17,17,17,.62); }
[data-quiet] .nw .pk-bar-msg .pk-fill { background: rgba(17,17,17,.14); }
[data-quiet] .nw .pk-col.on .pk-bar-msg .pk-fill { background: #111; }
[data-quiet] .nw .pk-col.partial .pk-fill { background-color: rgba(17,17,17,.10); background-image: repeating-linear-gradient(135deg, rgba(17,17,17,.30) 0 1.5px, transparent 1.5px 6px); }
[data-quiet] .nw .pk-col::before { display: none; }
[data-quiet] .nw .pk-col.on .pk-wl-t { background: #111; color: #fff; }
[data-quiet] .nw .pk-bar-msg .pk-val { color: rgba(17,17,17,.62); }
[data-quiet] .nw .pk-col.on .pk-bar-msg .pk-val { color: #111; }
[data-quiet] .nw .pk-badge { box-shadow: none; }
[data-quiet] .nw .pk-sw-msg { background: rgba(17,17,17,.14); }
[data-quiet] .nw .pk-sw-call { box-shadow: none; }
[data-quiet] .nw .pk-gl { border-top-color: rgba(17,17,17,.08); }
[data-quiet] .nw .pk-gl.base { border-top-color: rgba(17,17,17,.22); }
[data-quiet] .nw .pk-rd-stats .hi dd { color: #111; }
[data-quiet] .nw .pk-rd-stats .hi dd .an-root { background: linear-gradient(transparent 58%, color-mix(in srgb, var(--cb-accent) 80%, transparent) 58%, color-mix(in srgb, var(--cb-accent) 80%, transparent) 92%, transparent 92%); padding: 0 .08em; margin: 0 -.08em; }
[data-quiet] .nw .pk-rd-stats > div { border-left-color: rgba(17,17,17,.14); }
[data-quiet] .nw .pk-rd-stats > div.hi { border-left-color: var(--cb-accent); }
[data-quiet] .nw .pk-wl { color: #111; }
`;

/** A slice as one plain range: "17 to 23 Aug", "28 Sept to 4 Oct", "28 Sept to today". */
export function weekSpan(w: Pick<SliceBar, 'start' | 'end' | 'current'>): string {
  if (w.current) return `${dm(w.start)} to today`;
  const last = addDays(w.end, -1);
  if (last === w.start) return dm(w.start);
  const [d1, m1] = dm(w.start).split(' ');
  return w.start.slice(5, 7) === last.slice(5, 7) ? `${d1} to ${dm(last)}` : `${d1} ${m1} to ${dm(last)}`;
}

/* ───────────────────────────── funnel ───────────────────────────── */

const FN_STAGE = 54;
const FN_GAP = 28;

/** The liquid funnel: square-root widths (a 1,494-to-19 drop drawn linearly leaves the last
 *  stage invisible), the exact number beside every stage, one short pour when it comes into
 *  view and then still. With reduced motion it is simply full. */
export function NightFunnel({ stages, eyebrow, onGo }: { stages: FunnelStage[]; eyebrow?: string | null; onGo?: (key: FunnelStage['key']) => void }) {
  const [ref, shown] = useReveal<HTMLDivElement>(0.35);
  if (stages.length < 2) return null;
  const max = Math.max(1, ...stages.map((s) => s.v));
  const w = stages.map((s) => (s.v > 0 ? Math.max(8, Math.sqrt(s.v / max) * 100) : 1.5));
  const H = stages.length * FN_STAGE + (stages.length - 1) * FN_GAP;
  const centers = stages.map((_, i) => FN_STAGE / 2 + i * (FN_STAGE + FN_GAP));
  const cuts = stages.slice(1).map((_, i) => FN_STAGE + i * (FN_STAGE + FN_GAP) + FN_GAP / 2);
  return (
    <section className="pk-panel pk-fnp nf-panel" aria-label="The funnel" data-night-funnel="">
      {eyebrow && <div className="pk-cap pk-capline">{eyebrow}</div>}
      <div ref={ref} className="pk-fn" style={{ '--fn-stage': `${FN_STAGE}px`, '--fn-gap': `${FN_GAP}px`, marginTop: eyebrow ? 20 : 0 } as CSSProperties}>
        <div className="pk-fn-col" aria-hidden="true">
          <FunnelShape widths={w} centers={centers} slices={cuts} height={H} shown={shown} duration={0.35} />
        </div>
        <ol className="pk-fn-stages">
          {stages.map((s) => {
            const inner = (
              <>
                <span className="pk-fn-num" style={s.key === 'booked' ? { color: 'var(--cb-accent-fg, var(--cb-accent))' } : undefined}><span className={s.key === 'booked' ? 'pk-money' : undefined}>{fmt(s.v)}</span></span>
                <span className="nf-go pk-cap pk-mute">
                  {s.label}
                  {onGo && <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10"><path d="M5 1v7M1.8 5L5 8.2 8.2 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </span>
              </>
            );
            return (
              <li key={s.key}>
                {onGo
                  ? <button type="button" className="nf-stage" onClick={() => onGo(s.key)} aria-label={`${fmt(s.v)} ${s.label.toLowerCase()}. Show the list.`}>{inner}</button>
                  : <div className="nf-stage">{inner}</div>}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/* ───────────────────────────── week by week ───────────────────────────── */

function ticks(top: number): number[] {
  if (top <= 0) return [];
  const raw = top / 2.5;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((x) => x * p).find((x) => x >= raw) ?? raw;
  const out: number[] = [];
  for (let v = step; v < top * 0.97; v += step) out.push(v);
  return out;
}

/** The week chart both tabs share, in v2's panel: grey bars = replied, a yellow badge =
 *  booked a call. The busiest reply week is pre-selected (its column lit); a tap swaps the
 *  readout. `third` adds one figure to the readout (Performance: connected; Outreach: came
 *  to you). `children` sit at the foot of the panel (Performance: All numbers). */
export function NightWeeks({ weeks, third, children }: {
  weeks: SliceBar[];
  third?: { label: string; of: (w: SliceBar) => number } | null;
  children?: React.ReactNode;
}) {
  const peakI = useMemo(() => {
    let best = -1;
    weeks.forEach((w, i) => { if (w.wrote > 0 && (best < 0 || w.wrote > weeks[best].wrote)) best = i; });
    return best < 0 ? null : best;
  }, [weeks]);
  const [sel, setSel] = useState<number>(peakI ?? Math.max(0, weeks.length - 1));
  const [hover, setHover] = useState<number | null>(null);
  if (weeks.length < 2) return null;
  const active = hover ?? sel;
  const cur = weeks[active];
  const peak = Math.max(1, ...weeks.map((w) => w.wrote));
  const top = peak * 1.18;
  const grid = ticks(peak);
  const onEnter = (i: number) => (e: PointerEvent) => { if (e.pointerType === 'mouse') setHover(i); };
  const line = peakI !== null
    ? `Your best week for replies was ${weekSpan(weeks[peakI])}: ${fmt(weeks[peakI].wrote)} ${plural(weeks[peakI].wrote, 'person', 'people')}.`
    : 'Replies and calls, week by week.';
  // Phone: every axis label does not fit, so month changes, every other week counted back
  // from the latest, and the chosen week.
  const month = (i: number) => i === 0 || weeks[i].start.slice(5, 7) !== weeks[i - 1].start.slice(5, 7);
  const keep = new Set<number>();
  weeks.forEach((_, i) => {
    if (month(i)) keep.add(i);
    else if ((weeks.length - 1 - i) % 2 === 0 && !(i > 0 && month(i - 1)) && !(i + 1 < weeks.length && month(i + 1))) keep.add(i);
  });
  keep.add(weeks.length - 1);
  return (
    <section className="pk-sec nw" aria-labelledby="nw-h" data-night-weeks="">
      <div className="pk-cap pk-capline">Week by week</div>
      <h2 id="nw-h" className="pk-h2">{line}</h2>
      <div className="pk-panel pk-wkp nw-panel">
        <ul className="pk-legend nw-legend" aria-hidden="true">
          <li><span className="pk-sw pk-sw-msg" />Replied</li>
          <li><span className="pk-sw pk-sw-call" />Booked a call</li>
        </ul>
        <div className="pk-chart">
          <div className="pk-grid" aria-hidden="true">
            {grid.map((v) => <span key={v} className="pk-gl" style={{ bottom: `${(v / top) * 100}%` }} />)}
            <span className="pk-gl base" />
          </div>
          <div className="pk-cols" onPointerLeave={() => setHover(null)}>
            {weeks.map((w, i) => (
              <button
                key={w.key}
                type="button"
                className={`pk-col${active === i ? ' on' : ''}${w.current ? ' partial' : ''}`}
                aria-pressed={sel === i}
                aria-label={`${weekSpan(w)}: ${fmt(w.wrote)} replied${w.calls ? `, ${w.calls} booked a call` : ''}.`}
                onClick={() => setSel(i)}
                onPointerEnter={onEnter(i)}
              >
                <span className="pk-slot">{w.calls > 0 && <span className="pk-badge">{w.calls}</span>}</span>
                <span className="pk-bars" aria-hidden="true">
                  <span className="pk-bar pk-bar-msg" style={{ height: `${Math.max(w.wrote / top, 0) * 100}%` }}>
                    <span className="pk-fill" />
                    <span className="pk-val">{fmt(w.wrote)}</span>
                  </span>
                </span>
                <span className="pk-wl" aria-hidden="true">
                  <span className={`pk-wl-t${keep.has(i) || active === i ? '' : ' nw-thin'}`}>{axisLabel(weeks, i)}</span>
                  {w.current && <small>to today</small>}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="pk-readout" aria-live="polite">
          <div className="pk-rd-week"><span className="pk-cap pk-mute">{weekSpan(cur)}</span></div>
          <dl className="pk-rd-stats">
            <div><dt>Replied</dt><dd><AnimateNumber value={cur.wrote} /></dd></div>
            <div className={cur.calls > 0 ? 'hi' : 'none'}><dt>Booked a call</dt><dd><AnimateNumber value={cur.calls} /></dd></div>
            {third && <div><dt>{third.label}</dt><dd><AnimateNumber value={third.of(cur)} /></dd></div>}
          </dl>
        </div>
        {children}
      </div>
    </section>
  );
}

/* ───────────────────────────── page css ───────────────────────────── */

const PN_CSS = `
.pn-anchor { scroll-margin-top: 88px; }
/* Outreach keeps its proof number, a step below the Home hero */
.pn-hero .pk-hero-n { font-size: clamp(88px, 26vw, 132px); }
.pn-hero .pk-hero-l { font-size: clamp(22px, 5.8vw, 32px); }
.pk-head.pn-head { justify-content: flex-end; border-bottom: 0; }
/* desktop: straight on the board ground, no second rounded frame inside the page */
@media (min-width: 640px) {
  .pk.pk-flat { background: transparent; border-radius: 0; padding: 0 0 36px; overflow: visible; }
  .pk.pk-flat > .pk-glow, .pk.pk-flat > .pk-dots { display: none; }
  .pk-flat .pk-top { padding-top: 8px; }
}
.pn-seg { display: inline-flex; gap: 4px; padding: 4px; border-radius: 999px; border: 1px solid rgb(var(--nt-fg, 255 255 255) / .1); background: rgb(var(--nt-fg, 255 255 255) / .03); }
.pn-seg button { appearance: none; border: 0; border-radius: 999px; padding: 7px 12px; background: none; color: rgb(var(--nt-fg, 255 255 255) / .72); font: 700 12.5px/1.2 var(--cb-body, Manrope), sans-serif; cursor: pointer; white-space: nowrap; }
.pn-seg button[aria-pressed="true"] { background: var(--cb-accent); color: var(--cb-accent-ink, #111); box-shadow: 0 4px 16px color-mix(in srgb, var(--pk-acc, #FFC71D) 30%, transparent); }

/* hero: the booked names ride with their avatars, then the interested line */
.pn-herowho { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; margin-top: 24px; }
@media (min-width: 560px) { .pn-herowho { flex-direction: row; align-items: center; gap: 16px; } }
.pn-names { max-width: 44ch; text-wrap: balance; font-size: 15px; font-weight: 700; line-height: 1.35; color: rgb(var(--nt-fg, 255 255 255)); }
.pn-lede { margin: 26px 0 0; max-width: 30ch; font-family: var(--cb-serif, Sora), sans-serif; font-weight: 400; font-size: clamp(20px, 5.2vw, 25px); line-height: 1.28; letter-spacing: -0.02em; color: rgb(var(--nt-fg, 255 255 255) / .9); text-wrap: balance; }
.pn-lede b { font-weight: 400 !important; color: var(--cb-accent-fg, var(--cb-accent)); }
.pn-def { margin-top: 6px; font-size: 14px; line-height: 1.45; color: rgb(var(--nt-fg, 255 255 255) / .64); max-width: 44ch; }

/* section heads with a count */
.pn-count { display: flex; align-items: baseline; gap: 14px; margin: 12px 0 0; font-weight: 400; }
.pn-count .pn-num { flex: none; font-family: var(--cb-serif, Sora), sans-serif; font-weight: 300; font-size: clamp(44px, 12vw, 60px); line-height: .9; letter-spacing: -0.05em; }
.pn-count .pn-note { font-size: 14.5px; line-height: 1.4; color: rgb(var(--nt-fg, 255 255 255) / .66); max-width: 40ch; }

/* who we reach */
.pn-line { margin-top: 18px; padding: 20px 18px 10px; }
@media (min-width: 768px) { .pn-line { padding: 26px 28px 14px; } }
.pn-line h3 { margin: 0; font-family: var(--cb-serif, Sora), sans-serif; font-weight: 400; font-size: 23px; line-height: 1.15; letter-spacing: -0.025em; color: rgb(var(--nt-fg, 255 255 255)); }
.pn-sub { margin-top: 3px; font-size: 14px; color: rgb(var(--nt-fg, 255 255 255) / .64); }
.pn-strip { display: grid; grid-template-columns: repeat(5, minmax(0,1fr)); gap: 10px; margin: 8px 0 0; }
@media (max-width: 560px) { .pn-strip { grid-template-columns: repeat(3, minmax(0,1fr)); row-gap: 16px; } }
.pn-strip > div { border-left: 2px solid rgb(var(--nt-fg, 255 255 255) / .16); padding-left: 10px; min-width: 0; }
.pn-strip dd { margin: 0; font-family: var(--cb-serif, Sora), sans-serif; font-weight: 300; font-size: 28px; line-height: 1; letter-spacing: -0.04em; font-variant-numeric: tabular-nums; }
.pn-strip dt { margin-top: 5px; font-size: 12.5px; font-weight: 700; line-height: 1.25; color: rgb(var(--nt-fg, 255 255 255) / .66); }
.pn-strip .hi { border-left-color: var(--cb-accent); }
.pn-strip .hi dd { color: var(--cb-accent-fg, var(--cb-accent)); }
.pn-strip .zero dd { color: rgb(var(--nt-fg, 255 255 255) / .4); }
.pn-vtbl { margin-top: 18px; }
.pn-vtbl th:first-child { width: 40% !important; }
.pn-vtbl thead th { font-size: 11px !important; color: rgb(var(--nt-fg, 255 255 255) / .62) !important; }
.pn-vtbl tbody th { font-weight: 600 !important; color: rgb(var(--nt-fg, 255 255 255) / .82); }
.pn-vtbl td.txt { font-size: 12.5px; font-weight: 600; color: rgb(var(--nt-fg, 255 255 255) / .62); }
.pn-vtbl tbody tr:last-child th, .pn-vtbl tbody tr:last-child td { border-bottom: 0; }
.pn-vstack { display: none; margin: 16px 0 0; padding: 0; list-style: none; }
.pn-vstack li { padding: 12px 0; border-top: 1px solid rgb(var(--nt-fg, 255 255 255) / .07); }
.pn-vstack .l { font-size: 14px; font-weight: 700; line-height: 1.35; color: rgb(var(--nt-fg, 255 255 255) / .88); }
.pn-vstack .v { margin-top: 5px; display: flex; flex-wrap: wrap; gap: 3px 12px; font-size: 13px; color: rgb(var(--nt-fg, 255 255 255) / .64); }
.pn-vstack .v b { color: rgb(var(--nt-fg, 255 255 255)); font-weight: 800; font-variant-numeric: tabular-nums; }
.pn-vstack .v .z b { color: rgb(var(--nt-fg, 255 255 255) / .45); font-weight: 600; }
.pn-vstack .v .hit b { color: var(--cb-accent-fg, var(--cb-accent)); }
@media (max-width: 700px) { .pn-vtbl { display: none; } .pn-vstack { display: block; } }
.pn-kinds { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.pn-kind { display: inline-flex; align-items: baseline; gap: 5px; padding: 4px 10px; border-radius: 999px; border: 1px solid rgb(var(--nt-fg, 255 255 255) / .12); background: rgb(var(--nt-fg, 255 255 255) / .035); font-size: 13px; font-weight: 600; color: rgb(var(--nt-fg, 255 255 255) / .8); }
.pn-kind b { color: rgb(var(--nt-fg, 255 255 255)); font-weight: 800; font-variant-numeric: tabular-nums; }
.pn-kind i { margin-left: 3px; font-style: normal; font-weight: 800; color: var(--cb-accent-fg, var(--cb-accent)); }
.pn-kind.gold { border-color: color-mix(in srgb, var(--pk-acc, #FFC71D) 30%, transparent); background: color-mix(in srgb, var(--pk-acc, #FFC71D) 6%, transparent); }

/* people */
.pn-cards { list-style: none; margin: 20px 0 0; padding: 0; display: grid; gap: 10px; }
@media (min-width: 900px) { .pn-cards { grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; } }
.pn-cards > li { min-width: 0; }
.pn-card { position: relative; height: 100%; box-sizing: border-box; border-radius: 22px 8px 8px 8px; border: 1px solid rgb(var(--nt-fg, 255 255 255) / .08); background: linear-gradient(180deg, rgb(var(--nt-fg, 255 255 255) / .05), rgb(var(--nt-fg, 255 255 255) / .015)); padding: 16px 16px 10px; overflow: hidden; }
.pn-card.gold { border-color: color-mix(in srgb, var(--pk-acc, #FFC71D) 30%, transparent); background: radial-gradient(120% 90% at 0% 0%, color-mix(in srgb, var(--pk-acc, #FFC71D) 14%, transparent), color-mix(in srgb, var(--pk-acc, #FFC71D) 0%, transparent) 62%), linear-gradient(180deg, rgb(var(--nt-fg, 255 255 255) / .04), rgb(var(--nt-fg, 255 255 255) / .012)); box-shadow: 0 18px 44px -24px color-mix(in srgb, var(--pk-acc, #FFC71D) 45%, transparent); }
.pn-top { display: flex; gap: 12px; align-items: center; }
.pn-top .pk-av { margin-left: 0; border-color: rgb(var(--nt-fg, 255 255 255) / .08); }
.pn-av-q { background: #232323 !important; color: rgb(var(--nt-fg, 255 255 255) / .88) !important; box-shadow: inset 0 0 0 1px rgb(var(--nt-fg, 255 255 255) / .12); }
.pn-card.edge { border-color: color-mix(in srgb, var(--pk-acc, #FFC71D) 70%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--pk-acc, #FFC71D) 18%, transparent), 0 18px 44px -22px color-mix(in srgb, var(--pk-acc, #FFC71D) 60%, transparent); }
.pn-card.gold .pk-av { box-shadow: 0 0 0 3px color-mix(in srgb, var(--pk-acc, #FFC71D) 18%, transparent), 0 0 22px color-mix(in srgb, var(--pk-acc, #FFC71D) 35%, transparent); border-color: #111; }
.pn-who { flex: 1 1 auto; min-width: 0; }
.pn-name { font-size: 15.5px; font-weight: 800; line-height: 1.25; letter-spacing: -0.01em; color: rgb(var(--nt-fg, 255 255 255)); overflow-wrap: anywhere; }
.pn-co { margin-top: 1px; font-size: 13.5px; line-height: 1.3; color: rgb(var(--nt-fg, 255 255 255) / .64); overflow-wrap: anywhere; }
.pn-date { flex: none; align-self: flex-start; margin-top: 3px; font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: rgb(var(--nt-fg, 255 255 255) / .62); white-space: nowrap; }
.pn-card.gold .pn-date { color: var(--cb-accent-fg, var(--cb-accent)); }
.pn-chips { margin-top: 10px; }
.pn-chips .pk-chip { margin-left: 0; font-size: 12px; }
.pn-quote { margin: 12px 0 0; padding-left: 12px; border-left: 2px solid rgb(var(--nt-fg, 255 255 255) / .14); font-size: 14px; line-height: 1.5; color: rgb(var(--nt-fg, 255 255 255) / .72); overflow-wrap: anywhere; }
.pn-card.gold .pn-quote { border-left-color: color-mix(in srgb, var(--pk-acc, #FFC71D) 45%, transparent); }
.pn-acts { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 10px; }
.pn-lnk { display: inline-flex; align-items: center; font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; text-decoration: none; border-radius: 999px; padding: 6px 12px; color: rgb(var(--nt-fg, 255 255 255)); border: 1px solid rgb(var(--nt-fg, 255 255 255) / .22); }
.pn-lnk.gold { color: var(--cb-accent-ink, #111); background: var(--cb-accent); border-color: var(--cb-accent); }
.pn-msgs { appearance: none; border: 0; background: none; padding: 6px 0; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font: 800 11px/1.2 var(--cb-body, Manrope), sans-serif; letter-spacing: .12em; text-transform: uppercase; color: rgb(var(--nt-fg, 255 255 255) / .66); }
.pn-msgs:hover { color: rgb(var(--nt-fg, 255 255 255)); }
.pn-msgs i { font-style: normal; color: var(--cb-accent-fg, var(--cb-accent)); font-size: 13px; }
.pn-thread { display: flex; flex-direction: column; gap: 8px; padding: 6px 0 8px; }
.pn-msg { align-self: flex-start; max-width: 92%; border-radius: 14px 14px 14px 4px; padding: 9px 12px; background: rgb(var(--nt-fg, 255 255 255) / .05); border: 1px solid rgb(var(--nt-fg, 255 255 255) / .08); }
.pn-msg.mine { align-self: flex-end; border-radius: 14px 14px 4px 14px; background: color-mix(in srgb, var(--pk-acc, #FFC71D) 7%, transparent); border-color: color-mix(in srgb, var(--pk-acc, #FFC71D) 18%, transparent); }
.pn-msg .h { font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: rgb(var(--nt-fg, 255 255 255) / .62); }
.pn-msg .t { margin-top: 4px; font-size: 14px; line-height: 1.5; color: rgb(var(--nt-fg, 255 255 255) / .88); white-space: pre-wrap; overflow-wrap: anywhere; }
.pn-more { appearance: none; margin-top: 14px; display: inline-flex; align-items: center; gap: 8px; border-radius: 999px; border: 1px solid rgb(var(--nt-fg, 255 255 255) / .18); background: rgb(var(--nt-fg, 255 255 255) / .03); color: rgb(var(--nt-fg, 255 255 255)); padding: 10px 18px; font: 800 13.5px/1.2 var(--cb-body, Manrope), sans-serif; cursor: pointer; }
.pn-more:hover { border-color: color-mix(in srgb, var(--pk-acc, #FFC71D) 50%, transparent); }
.pn-more svg { color: var(--cb-accent-fg, var(--cb-accent)); }
.pn-empty { margin-top: 16px; padding: 18px; border-radius: 18px 8px 8px 8px; border: 1px dashed rgb(var(--nt-fg, 255 255 255) / .14); font-size: 14px; color: rgb(var(--nt-fg, 255 255 255) / .64); }
.pn-fold { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 12px; margin-top: 16px; padding: 14px 16px; border-radius: 18px 8px 8px 8px; border: 1px solid rgb(var(--nt-fg, 255 255 255) / .1); background: rgb(var(--nt-fg, 255 255 255) / .03); color: rgb(var(--nt-fg, 255 255 255)); font: 800 14px/1.3 var(--cb-body, Manrope), sans-serif; cursor: pointer; text-align: left; }
.pn-fold:hover { border-color: rgb(var(--nt-fg, 255 255 255) / .22); }
.pk-flat .pk-foot { color: rgb(var(--nt-fg, 255 255 255) / .6); }

/* QUIET: light ground, white panels and cards, ink numbers, no glow. Booked-call cards keep
   their yellow initials disc; the latest one carries a flat 2px ink edge. */
[data-quiet] .pk.pk-flat { border: 0; background: transparent; }
[data-quiet] .pn-seg { background: #FFFFFF; border-color: rgba(17,17,17,.12); }
[data-quiet] .pn-seg button[aria-pressed="true"] { box-shadow: none; }
[data-quiet] .pn-herowho .pk-av { border-color: #F5F5F3; }
[data-quiet] .pn-herowho .pk-av-more { background: #E9E9E6; color: #111; }
[data-quiet] .pn-lede { color: #111; }
[data-quiet] .pn-lede b { color: #111; }
[data-quiet] .pn-line { background: #FFFFFF; border: 1px solid rgba(17,17,17,.09); }
[data-quiet] .pn-strip > div { border-left-color: rgba(17,17,17,.14); }
[data-quiet] .pn-strip .hi { border-left-color: var(--cb-accent); }
[data-quiet] .pn-strip .hi dd { color: #111; }
[data-quiet] .pn-strip .zero dd { color: rgba(17,17,17,.4); }
[data-quiet] .pn-vtbl td.hit, [data-quiet] .pn-vstack .v .hit b { color: #111; font-weight: 800; }
[data-quiet] .pn-kind { background: #F5F5F3; border-color: rgba(17,17,17,.10); color: rgba(17,17,17,.78); }
[data-quiet] .pn-kind.gold { background: #FFFFFF; border-color: rgba(17,17,17,.22); }
[data-quiet] .pn-kind i { color: #111; }
[data-quiet] .pn-kind i::before { content: ''; display: inline-block; width: 6px; height: 6px; margin: 0 5px 1px 1px; border-radius: 999px; background: var(--cb-accent); vertical-align: middle; }
[data-quiet] .pn-card, [data-quiet] .pn-card.gold { background: #FFFFFF; border-color: rgba(17,17,17,.09); box-shadow: none; }
[data-quiet] .pn-card.edge { border-color: #111; box-shadow: inset 0 0 0 1px #111; }
[data-quiet] .pn-top .pk-av { border-color: #FFFFFF; }
[data-quiet] .pn-card.gold .pk-av { box-shadow: none; border-color: #FFFFFF; }
[data-quiet] .pn-av-q { background: #E9E9E6 !important; color: #111 !important; box-shadow: none; }
[data-quiet] .pn-card.gold .pn-date { color: #111; }
[data-quiet] .pn-quote, [data-quiet] .pn-card.gold .pn-quote { border-left-color: rgba(17,17,17,.14); color: rgba(17,17,17,.78); }
[data-quiet] .pn-lnk, [data-quiet] .pn-lnk.gold { background: #FFFFFF; color: #111; border-color: rgba(17,17,17,.22); }
[data-quiet] .pn-lnk:hover { border-color: #111; }
[data-quiet] .pn-msgs { color: rgba(17,17,17,.66); }
[data-quiet] .pn-msgs i { color: #111; }
[data-quiet] .pn-msg { background: #F5F5F3; border-color: rgba(17,17,17,.08); }
[data-quiet] .pn-msg.mine { background: #FFFFFF; border-color: rgba(17,17,17,.14); }
[data-quiet] .pn-more, [data-quiet] .pn-fold { background: #FFFFFF; border-color: rgba(17,17,17,.14); }
[data-quiet] .pn-more:hover, [data-quiet] .pn-fold:hover { border-color: rgba(17,17,17,.4); }
[data-quiet] .pn-more svg { color: #111; }
[data-quiet] .pn-empty { background: #FFFFFF; }
`;

const Chevron = ({ open = false }: { open?: boolean }) => (
  <svg aria-hidden="true" width="12" height="12" viewBox="0 0 14 14" style={{ transform: open ? 'rotate(180deg)' : undefined }}>
    <path d="M3 5l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ───────────────────────────── who we reach ───────────────────────────── */

const cellsOf = (r: Row) => [r.reached, r.connected, r.wrote, r.interested, r.booked];

function Lines({ ctx }: { ctx: ReportCtx }) {
  const arch = isArch(ctx);
  const data = useMemo(() => linesData(ctx), [ctx]);
  const people = ctx.payload?.people || [];
  if (!data.length) return null;
  // The funnel's own words, so the tab carries one glossary.
  const heads = funnelStages(ctx).map((s) => s.label);
  const low = heads.map((h) => h.toLowerCase());
  const archCame = arch ? archCameFromItems(people) : [];
  const groups = data.map((d) => d.ln.title.toLowerCase());
  const headline = arch
    ? 'Grouped by the kind of company, then by how we found each person.'
    : `Everyone we've contacted since ${dm(ctx.cfg.start)}, split into ${groups.length > 1 ? `${groups.slice(0, -1).join(', ')} and ${groups[groups.length - 1]}` : groups[0]}.`;
  const cellText = (v: number | null) => (v === null ? 'already connected' : fmt(v));
  return (
    <section id="pn-reach" className="pk-sec pn-anchor" aria-labelledby="pn-reach-h">
      <div className="pk-cap pk-capline">Who we reach</div>
      <h2 id="pn-reach-h" className="pk-h2">{headline}</h2>
      {data.map(({ ln, inLine, all, rows }) => {
        const kinds = !arch && ln.key === 'owner' ? storeKindItems(inLine) : [];
        return (
          <div key={ln.key} className="pk-panel pn-line">
            <h3>{ln.title}</h3>
            <div className="pn-sub">{ln.sub.charAt(0).toUpperCase() + ln.sub.slice(1)}</div>
            <div className="pk-cap pk-mute" style={{ marginTop: 18 }}>{all.label}</div>
            <dl className="pn-strip">
              {cellsOf(all).map((v, i) => (
                <div key={i} className={i === 4 && v ? 'hi' : v ? undefined : 'zero'}>
                  <dd>{v === null ? '' : i === 4 && v ? <span className="pk-money">{fmt(v)}</span> : fmt(v)}</dd>
                  <dt>{low[i]}</dt>
                </div>
              ))}
            </dl>
            <table className="pk-nums pn-vtbl">
              <thead><tr><th scope="col">How we found them</th>{heads.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label}>
                    <th scope="row">{r.label}</th>
                    {cellsOf(r).map((v, i) => <td key={i} className={v === null ? 'txt' : i === 4 && v ? 'hit' : v ? undefined : 'zero'}>{cellText(v)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="pn-vstack">
              {rows.map((r) => (
                <li key={r.label}>
                  <div className="l">{r.label}</div>
                  <div className="v">
                    {cellsOf(r).map((v, i) => (
                      v === null
                        ? <span key={i}>already connected</span>
                        : <span key={i} className={i === 4 && v ? 'hit' : v ? undefined : 'z'}><b>{fmt(v)}</b> {low[i]}</span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            {kinds.length > 0 && <Kinds label="Kinds of stores that wrote back" items={kinds} />}
          </div>
        );
      })}
      {archCame.length > 0 && <div style={{ marginTop: 20 }}><Kinds label="Conversations came from" items={archCame} /></div>}
    </section>
  );
}

function Kinds({ label, items }: { label: string; items: ChipItem[] }) {
  return (
    <div style={{ margin: '18px 0 10px' }}>
      <div className="pk-cap pk-mute">{label}</div>
      <div className="pn-kinds">
        {items.map((c) => (
          <span key={c.key} className={`pn-kind${c.booked ? ' gold' : ''}`}>
            <b>{c.n}</b>{c.label}{c.booked ? <i>{c.booked} booked a call</i> : null}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────────── people ───────────────────────────── */

function Thread({ ctx, entry }: { ctx: ReportCtx; entry: LogEntry }) {
  const msgs = (entry.messages || []).filter((x) => shownText(x)).slice().sort((a, b) => ((a.sent_at || '') < (b.sent_at || '') ? -1 : 1));
  if (!msgs.length) return <div className="pn-def" style={{ margin: '4px 0 8px' }}>No messages to show yet.</div>;
  return (
    <div className="pn-thread">
      {msgs.map((x, i) => {
        const mine = x.direction === 'outbound';
        const email = /email/i.test(`${x.channel || ''} ${x.type || ''}`);
        const k = dayKey(x.sent_at, ctx.cfg.tz);
        const t = shownText(x);
        return (
          <div key={i} className={`pn-msg${mine ? ' mine' : ''}`}>
            <div className="h">{mine ? 'You' : (entry.name || 'Them').split(' ')[0]}{email ? ', by email' : ''}{k ? `, ${dm(k)}` : ''}</div>
            <div className="t">{REACTION.test(t) ? `Reacted ${t.replace(REACTION, '').trim()}` : t}</div>
          </div>
        );
      })}
    </div>
  );
}

function PersonCard({ ctx, c, booked, hideYes, edge }: { ctx: ReportCtx; c: Card_; booked?: boolean; hideYes?: boolean; edge?: boolean }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const { p, entry, last, extra } = c;
  const k = dayKey(booked ? p.bk : last, ctx.cfg.tz);
  const quote = lastInboundText(entry);
  const chip = booked || (hideYes && ['positive', 'soft_yes'].includes(norm(p.li))) ? null : intentChip(ctx, p.li);
  const hasMsgs = !!entry && (entry.messages || []).length > 0;
  return (
    <div className={`pn-card${booked ? ' gold' : ''}${edge ? ' edge' : ''}`}>
      <div className="pn-top">
        <span className={`pk-av${booked ? '' : ' pn-av-q'}`} aria-hidden="true" style={{ width: 40, height: 40, fontSize: 13 }}>{p.n ? initialsOf(p.n) : '?'}</span>
        <div className="pn-who">
          <div className="pn-name">{p.n || 'Name not shown'}</div>
          {p.c && <div className="pn-co">{p.c}</div>}
        </div>
        {k && <span className="pn-date">{booked ? `Booked ${dm(k)}` : dm(k)}</span>}
      </div>
      {chip && <div className="pn-chips"><span className="pk-chip">{chip}</span></div>}
      {quote && <p className="pn-quote">“{quote}”</p>}
      {(extra?.scan_url || extra?.brief_url || hasMsgs) && (
        <div className="pn-acts">
          {hasMsgs && (
            <button type="button" className="pn-msgs" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              {open ? 'Hide the thread' : 'Read the thread'} <i aria-hidden="true">{open ? '−' : '+'}</i>
            </button>
          )}
          <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
            {extra?.scan_url && <a className="pn-lnk" href={extra.scan_url} target="_blank" rel="noreferrer">Their scan</a>}
            {extra?.brief_url && <a className="pn-lnk gold" href={extra.brief_url} target="_blank" rel="noreferrer">Pre-call brief</a>}
          </span>
        </div>
      )}
      {open && entry && (
        <m.div initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, ease: EASE }}>
          <Thread ctx={ctx} entry={entry} />
        </m.div>
      )}
    </div>
  );
}

function Cards({ ctx, rows, booked, hideYes }: { ctx: ReportCtx; rows: Card_[]; booked?: boolean; hideYes?: boolean }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, SHOW);
  return (
    <>
      <ul className="pn-cards">
        {shown.map((c, i) => (
          <li key={`${c.p.n}-${i}`}><PersonCard ctx={ctx} c={c} booked={booked} hideYes={hideYes} edge={booked && i === 0} /></li>
        ))}
      </ul>
      {rows.length > SHOW && (
        <button type="button" className="pn-more" aria-expanded={all} onClick={() => setAll((x) => !x)}>
          {all ? 'Show fewer' : `Show ${rows.length - SHOW} more`}<Chevron open={all} />
        </button>
      )}
    </>
  );
}

function ListHead({ id, label, n, note, gold }: { id: string; label: string; n: number; note?: string; gold?: boolean }) {
  return (
    <>
      <div className="pk-cap pk-capline">{label}</div>
      <h2 id={id} className="pn-count" aria-label={`${label}: ${fmt(n)}`}>
        <span className="pn-num" style={gold ? { color: 'var(--cb-accent-fg, var(--cb-accent))', textShadow: '0 0 28px color-mix(in srgb, var(--pk-acc, #FFC71D) 35%, transparent)' } : { color: 'rgb(var(--nt-fg, 255 255 255))' }}><span className={gold ? 'pk-money' : undefined}>{fmt(n)}</span></span>
        {note && <span className="pn-note">{note}</span>}
      </h2>
    </>
  );
}

/** "Karin Nelson, Trent Hill, Constance de Monravel and 16 others". */
function namesPlain(names: string[], max = 3): string {
  const xs = names.filter(Boolean);
  if (xs.length <= 1) return xs[0] || '';
  if (xs.length <= max) return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
  const rest = xs.length - max;
  return `${xs.slice(0, max).join(', ')} and ${rest} ${plural(rest, 'other', 'others')}`;
}

/* ───────────────────────────── page ───────────────────────────── */

export default function PipelineNight({ ctx, log, booked = [], queue, queueCount }: {
  ctx: ReportCtx;
  accent: string;
  log?: LogEntry[] | null;
  booked?: BookedExtra[];
  queue?: React.ReactNode;
  queueCount?: number | null;
}) {
  const reduce = useReducedMotion();
  const [view, setView] = useState<'conv' | 'queue'>('conv');
  const [wroteOpen, setWroteOpen] = useState(false);
  const arch = isArch(ctx);
  const d = useMemo(() => pipelineData(ctx, log, booked), [ctx, log, booked]);
  const { bookedRows, interested, recent, nBooked, nInterested } = d;
  const who = arch ? (nInterested === 1 ? 'person is' : 'people are') : (nInterested === 1 ? 'founder is' : 'founders are');
  const since = dm(ctx.cfg.start);
  const stages = useMemo(() => funnelStages(ctx), [ctx]);
  const weeks = useMemo(() => sliceSeries(ctx), [ctx]);

  const go = (key: FunnelStage['key']) => {
    const to = key === 'booked' ? 'pn-booked' : key === 'replied' ? 'pn-wrote' : key === 'yes' ? 'cb-pipe-interested' : 'pn-reach';
    if (to === 'pn-wrote') setWroteOpen(true);
    window.setTimeout(() => {
      document.getElementById(to)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }, 40);
  };

  // The avatars and the sentence beside them name the same people: three circles, then the
  // rest as "+16", matching "... and 16 others".
  const heroNames = bookedRows.map((c) => c.p.n).filter(Boolean) as string[];
  const avs = heroNames.slice(0, 3);
  const def = arch ? 'Their latest reply, in the last two weeks, says yes or asks for details.' : "Said yes in the last 14 days and hasn't booked yet.";

  return (
    <MotionRoot>
      <style>{PK_CSS + NIGHT_CSS + PN_CSS}</style>
      <div className="pk pk-flat" data-report="pipeline" data-pipe-night="">
        <div aria-hidden className="pk-glow" />
        <DotPattern />
        {queue && (
          <header className="pk-head pn-head">
            <div className="pn-seg" role="tablist">
              <button type="button" role="tab" aria-pressed={view === 'conv'} aria-selected={view === 'conv'} onClick={() => setView('conv')}>Conversations</button>
              <button type="button" role="tab" aria-pressed={view === 'queue'} aria-selected={view === 'queue'} onClick={() => setView('queue')}>Queue{queueCount ? ` ${queueCount}` : ''}</button>
            </div>
          </header>
        )}

        {view === 'queue' && queue ? <div style={{ marginTop: 18 }}>{queue}</div> : (
          <>
            <div className="pk-top">
              <section className="pn-hero" aria-labelledby="pn-hero">
                <div className="pk-cap pk-capline">Since {since}</div>
                {nBooked > 0 ? (
                  <h1 id="pn-hero" className="pk-hero-h" style={{ margin: '12px 0 0' }}>
                    <span className="pk-hero-n pk-grad">{fmt(nBooked)}</span>
                    <span className="pk-hero-l pk-disp">{plural(nBooked, 'call', 'calls')} booked</span>
                  </h1>
                ) : (
                  <h1 id="pn-hero" className="pk-h2" style={{ fontSize: 'clamp(34px, 9vw, 52px)' }}>No calls booked yet.</h1>
                )}
                {heroNames.length > 0 && (
                  <div className="pn-herowho">
                    <AvatarCircles size={44} more={heroNames.length - avs.length} avatars={avs.map((n) => ({ initials: initialsOf(n), label: n }))} />
                    <p className="pn-names" style={{ margin: 0 }}>{namesPlain(heroNames)}</p>
                  </div>
                )}
                {nInterested > 0 && (
                  <>
                    <p className="pn-lede"><b>{fmt(nInterested)}</b> more {who} interested right now.</p>
                    <div className="pn-def">{def}</div>
                  </>
                )}
              </section>
              <NightFunnel stages={stages} onGo={go} />
            </div>

            <Lines ctx={ctx} />
            <NightWeeks weeks={weeks} third={ctx.payload ? { label: 'Came to you', of: (w) => w.came } : null} />

            <section id="cb-pipe-interested" className="pk-sec pn-anchor" aria-labelledby="pn-int-h">
              <ListHead id="pn-int-h" label="Interested right now" n={interested.length} />
              {interested.length ? <Cards ctx={ctx} rows={interested} hideYes /> : <div className="pn-empty">Nobody right now.</div>}
            </section>

            <section id="pn-booked" className="pk-sec pn-anchor" aria-labelledby="pn-bk-h">
              <ListHead id="pn-bk-h" label="Calls booked" n={bookedRows.length} gold />
              {bookedRows.length ? <Cards ctx={ctx} rows={bookedRows} booked /> : <div className="pn-empty">No calls booked yet.</div>}
            </section>

            <section id="pn-wrote" className="pk-sec pn-anchor" aria-labelledby="pn-wr-h">
              <ListHead id="pn-wr-h" label="Wrote back" n={recent.length} note="Everyone else who wrote back in the last 30 days." />
              {recent.length === 0 ? <div className="pn-empty">Nobody else in the last 30 days.</div> : (
                <>
                  <button type="button" className="pn-fold" aria-expanded={wroteOpen} aria-controls="pn-wrote-list" onClick={() => setWroteOpen((o) => !o)}>
                    <span>{wroteOpen ? 'Close the list' : `Show all ${recent.length}`}</span>
                    <Chevron open={wroteOpen} />
                  </button>
                  {wroteOpen && <div id="pn-wrote-list"><Cards ctx={ctx} rows={recent} /></div>}
                </>
              )}
            </section>

            <div className="pk-foot">Each person is counted once.</div>
          </>
        )}
      </div>
    </MotionRoot>
  );
}
