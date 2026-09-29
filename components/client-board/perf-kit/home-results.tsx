/**
 * HomeResultsNight: the week page's results plate in the ARCH report look (NIGHT MOCKUP,
 * local only, 2026-09-29). WeekResultsPlate renders this instead of its own plate when the
 * board URL carries `?night`; the light desk never reaches this file.
 *
 * Same facts: WeekResultsPlate computes every figure (callsLead, reportFigures, sliceSeries)
 * and every sentence, and hands them in, so this file cannot print a number the report does
 * not carry. The chart readout is the selected 7-day slice's own figures (the "Week by week"
 * table's row), pre-selected on the running slice and swapped on tap.
 *
 * Night v4 (2026-09-29): v2's look (the caps eyebrow with its yellow rule, the thin gradient
 * hero number that counts up once, initials circles, the glow and dot grid, the lit selected
 * bar) with v3's words and speed: "Replied" / "Booked a call" / "Connected", no helper line,
 * no legend entry that isn't data, the sentence's two lines reserved while the report loads,
 * bars drawn at once. The hero number is the page's one count-up.
 */
import React, { useEffect, useLayoutEffect, useState, type PointerEvent, type ReactNode } from 'react';
import { animate, useReducedMotion } from 'framer-motion';
import { MotionRoot } from './motion';
import { AvatarCircles, DotPattern } from './magicui';
import { AnimateNumber } from './twentyfirst';
import { PK_CSS } from './styles';
import { initialsOf, namesLine, axisLabel, type SliceBar } from '../weekResults';

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** The page's ONE count-up: the hero number climbs from 0 once, on mount. Server markup and
 *  reduced motion print the final number; nothing else counts. */
const useIsoLayout = typeof window === 'undefined' ? useEffect : useLayoutEffect;
function HeroCount({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  useIsoLayout(() => {
    if (reduce || value < 1) { setShown(value); return; }
    setShown(0);
    const c = animate(0, value, { duration: Math.min(1, 0.5 + value * 0.08), delay: 0.1, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setShown(Math.round(v)) });
    return () => c.stop();
  }, [value, reduce]);
  return <>{shown.toLocaleString('en-GB')}</>;
}

const HM_CSS = `
.pk.hm-hero { margin: 0 0 0; padding: 6px clamp(20px, 3.4vw, 40px) 26px; border: 1px solid rgb(var(--nt-fg, 255 255 255) / .08); }
/* The desk skin zeroes every box-shadow with !important; the glows carry its prefix. */
[data-skin="desk"] .pk.hm-hero { box-shadow: 0 30px 80px rgba(0,0,0,.35) !important; }
[data-skin="desk"] .hm-chart .pk-col.on .pk-fill { box-shadow: 0 0 22px rgba(255,199,29,.45) !important; }
[data-skin="desk"] .hm-dots i { box-shadow: 0 0 8px rgba(255,199,29,.7) !important; }
[data-skin="desk"] .hm-hero .pk-sw-call { box-shadow: 0 0 0 3px rgba(255,199,29,.22) !important; }
@media (max-width: 639px) { .pk.hm-hero { margin: 0 -16px; border-radius: 0; border-left: 0; border-right: 0; padding: 4px 20px 26px; } }
.hm-grid { display: grid; gap: 30px; padding-top: 22px; }
@media (min-width: 900px) { .hm-grid { grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); gap: 44px; align-items: center; padding-top: 30px; } }
.hm-hero .pk-hero-n { font-size: clamp(112px, 33vw, 168px); }
.hm-wk { padding: 20px 16px 16px; }
@media (min-width: 768px) { .hm-wk { padding: 26px 26px 20px; } }
/* two lines reserved: the report payload lands a beat after first paint, and the sentence
   must not push the chart down when it does */
.hm-say { margin: 0; min-height: 2.6em; font-size: clamp(18px, 4.8vw, 21px); line-height: 1.3; letter-spacing: -0.02em; text-wrap: pretty; }
.hm-say b { font-weight: 400; color: var(--cb-accent); }
.hm-chart { --plot: 128px; --slot: 26px; --lab: 30px; margin-top: 14px; }
@media (min-width: 768px) { .hm-chart { --plot: 150px; --slot: 30px; } }
.hm-chart .pk-bar { width: clamp(16px, 5.4vw, 34px); }
.hm-chart .pk-col.on .pk-fill { background: var(--cb-accent); }
.hm-chart .pk-col.on .pk-val { color: var(--cb-accent); }
.hm-chart .pk-bar-rep .pk-fill { background: rgb(var(--nt-fg, 255 255 255) / .2); }
.hm-chart .pk-bar-rep .pk-val { font-size: 12px; color: rgb(var(--nt-fg, 255 255 255) / .66); }
.hm-chart .pk-col.partial .pk-fill { background-image: repeating-linear-gradient(135deg, rgba(17,17,17,.5) 0 2px, transparent 2px 6px); }
.hm-dots { display: flex; flex-wrap: wrap-reverse; justify-content: center; gap: 3px; max-width: 30px; margin: 0 auto; }
.hm-dots i { display: block; width: 6px; height: 6px; border-radius: 999px; background: var(--cb-accent); }
.hm-dots b { font-size: 12px; color: var(--cb-accent); }
.hm-rd { margin-top: 6px; min-height: 96px; border-top: 1px solid rgb(var(--nt-fg, 255 255 255) / .08); padding-top: 12px; }
.hm-rd .pk-cap { color: rgb(var(--nt-fg, 255 255 255) / .66); }
.hm-rd .pk-rd-stats dt { color: rgb(var(--nt-fg, 255 255 255) / .66); }
.hm-rd .pk-rd-stats dd { font-size: 34px; }
.hm-legend { margin-top: 14px; }
.hm-legend .pk-sw-rep { background: rgb(var(--nt-fg, 255 255 255) / .28); }
.hm-hero .pk-grad { animation: none !important; }
.hm-link { margin-top: 18px; background: none; border-top: 0; border-left: 0; border-right: 0; cursor: pointer; font-family: inherit; }

/* QUIET (2026-09-29, "private-bank quiet, receipts first"): same plate on a light ground.
   Ink numbers, grey bars, the selected week in ink; yellow only marks a booked call. No
   halo, no lit bar, no drop shadow. [data-quiet] sits on the same root as [data-skin], so
   the compound prefix outranks the desk skin's shadow rules above. */
[data-quiet][data-skin] .pk.hm-hero { box-shadow: none !important; }
[data-quiet][data-skin] .hm-chart .pk-col.on .pk-fill,
[data-quiet][data-skin] .hm-dots i,
[data-quiet][data-skin] .hm-hero .pk-sw-call { box-shadow: none !important; }
[data-quiet] .hm-hero .pk-note { border-left-color: rgba(17,17,17,.16); color: rgba(17,17,17,.78); }
[data-quiet] .hm-hero .pk-av { border-color: #FFFFFF; }
@media (max-width: 639px) { [data-quiet] .hm-hero .pk-av { border-color: #F5F5F3; } }
[data-quiet] .hm-hero .pk-av-plain { background: #E9E9E6; color: #111; }
[data-quiet] .hm-wk { background: #FFFFFF; border-color: rgba(17,17,17,.09); }
[data-quiet] .hm-say b { color: #111; font-weight: 600; }
[data-quiet] .hm-chart .pk-col::before { display: none; }
[data-quiet] .hm-chart .pk-fill { box-shadow: none !important; }
[data-quiet] .hm-chart .pk-bar-rep .pk-fill { background: rgba(17,17,17,.14); }
[data-quiet] .hm-chart .pk-col.on .pk-fill { background: #111; }
[data-quiet] .hm-chart .pk-col.on .pk-val { color: #111; }
[data-quiet] .hm-chart .pk-col.partial .pk-fill { background-image: repeating-linear-gradient(135deg, rgba(17,17,17,.2) 0 2px, transparent 2px 6px); }
[data-quiet] .hm-chart .pk-col.partial.on .pk-fill { background-image: repeating-linear-gradient(135deg, rgba(255,255,255,.34) 0 2px, transparent 2px 6px); }
[data-quiet] .hm-chart .pk-col.on .pk-wl-t { background: #111; color: #FFFFFF; }
[data-quiet] .hm-dots b { color: #111; }
[data-quiet] .hm-rd .pk-rd-stats > div { border-left-color: rgba(17,17,17,.14); }
[data-quiet] .hm-rd .pk-rd-stats > div:nth-child(2).hi { border-left-color: var(--cb-accent); }
[data-quiet] .hm-rd .pk-rd-stats .hi dd { color: #111; }
[data-quiet] .hm-rd .pk-rd-stats .none dd { color: rgba(17,17,17,.45); }
[data-quiet] .hm-legend .pk-sw-rep { background: rgba(17,17,17,.14); }
[data-quiet] .hm-link { border-bottom-color: #111; border-bottom-width: 1.5px; }
`;

function Weeks({ bars, connLabel }: { bars: SliceBar[]; connLabel: string }) {
  const start = (() => { const i = bars.findIndex((b) => b.current); return i >= 0 ? i : bars.length - 1; })();
  const [sel, setSel] = useState(start);
  const [hover, setHover] = useState<number | null>(null);
  const active = hover ?? sel;
  const cur = bars[active];
  const top = Math.max(1, ...bars.map((b) => b.wrote)) * 1.12;
  const onEnter = (i: number) => (e: PointerEvent) => { if (e.pointerType === 'mouse') setHover(i); };
  return (
    <>
      <div className="pk-chart hm-chart" data-viz="">
        <div className="pk-grid" aria-hidden="true"><span className="pk-gl base" /></div>
        <div className="pk-cols" onPointerLeave={() => setHover(null)} aria-label="People who replied for the first time, week by week, with a mark for every call booked" role="group">
          {bars.map((b, i) => (
            <button
              key={b.key}
              type="button"
              data-slice={b.label}
              className={`pk-col${active === i ? ' on' : ''}${b.current ? ' partial' : ''}`}
              aria-pressed={sel === i}
              aria-label={`${b.label}: ${b.wrote} replied for the first time, ${b.calls} ${plural(b.calls, 'call', 'calls')} booked.`}
              onClick={() => setSel(i)}
              onPointerEnter={onEnter(i)}
            >
              <span className="pk-slot" aria-hidden="true">
                {b.calls > 0 && (
                  <span className="hm-dots">
                    {b.calls > 5 ? <b>{b.calls}</b> : Array.from({ length: b.calls }, (_, k) => <i key={k} />)}
                  </span>
                )}
              </span>
              <span className="pk-bars" aria-hidden="true">
                <span className="pk-bar pk-bar-rep" style={{ height: `${Math.max(1.5, (b.wrote / top) * 100)}%` }}>
                  <span className="pk-fill" />
                  <span className="pk-val">{b.wrote}</span>
                </span>
              </span>
              <span className="pk-wl" aria-hidden="true"><span className="pk-wl-t">{axisLabel(bars, i)}</span></span>
            </button>
          ))}
        </div>
      </div>
      <div className="hm-rd" aria-live="polite">
        <div className="pk-rd-week"><span className="pk-cap">{cur.label}</span></div>
        <dl className="pk-rd-stats">
          <div className="hi"><dt>Replied</dt><dd><AnimateNumber value={cur.wrote} /></dd></div>
          <div className={cur.calls > 0 ? 'hi' : 'none'}><dt>Booked a call</dt><dd><AnimateNumber value={cur.calls} /></dd></div>
          <div><dt>{connLabel}</dt><dd><AnimateNumber value={cur.reach} /></dd></div>
        </dl>
      </div>
      <ul className="pk-legend hm-legend" aria-hidden="true">
        <li><span className="pk-sw pk-sw-rep" />Replied</li>
        <li><span className="pk-sw pk-sw-call" />Booked a call</li>
      </ul>
    </>
  );
}

export function HomeResultsNight({ eyebrow, n, phrase, callsSub, none, names, cameLine, wrote, yes, bars, connLabel, onSeeAll, pending = false }: {
  eyebrow: string;
  n: number;
  phrase: string;
  callsSub?: ReactNode;
  none?: string | null;
  names: string[];
  cameLine?: ReactNode;
  wrote?: { value: number; text: ReactNode } | null;
  yes?: { value: number; text: ReactNode } | null;
  bars: SliceBar[];
  connLabel: string;
  onSeeAll?: () => void;
  /** The report payload is still loading: keep the sentence's two lines reserved. */
  pending?: boolean;
}) {
  const shown = names.slice(0, 4);
  return (
    <MotionRoot>
      <style>{PK_CSS + HM_CSS}</style>
      <section className="pk hm-hero" data-week-results="" aria-labelledby="hm-hero">
        <div aria-hidden className="pk-glow" />
        <DotPattern />
        <div className="hm-grid">
          <div>
            <div className="pk-cap pk-capline">{eyebrow}</div>
            <h1 id="hm-hero" className="pk-hero-h" style={{ margin: '12px 0 0' }}>
              <span className="pk-hero-n pk-grad" data-metric=""><HeroCount value={n} /></span>
              <span style={{ display: 'block' }}>
                <span className="pk-hero-l pk-disp">{plural(n, 'call', 'calls')} booked<br />{phrase}</span>
                {(callsSub || pending) && <span className="pk-hero-sub">{callsSub || '\u00a0'}</span>}
              </span>
            </h1>
            {none && <div className="pk-quiet">{none}</div>}
            {shown.length > 0 && (
              <div className="pk-who">
                <AvatarCircles size={46} more={names.length - shown.length} avatars={shown.map((x) => ({ initials: initialsOf(x), label: x }))} />
                <div style={{ minWidth: 0, fontSize: 16, lineHeight: 1.35, fontWeight: 700 }}>{namesLine(names)}</div>
              </div>
            )}
            {cameLine && <div className="pk-note">{cameLine}</div>}
          </div>

          <div className="pk-panel hm-wk">
            {(wrote || yes || pending) && (
              <p className="hm-say pk-disp">
                {wrote && <><b>{wrote.value.toLocaleString('en-GB')}</b> {wrote.text}</>}
                {yes && <> <b>{yes.value.toLocaleString('en-GB')}</b> {yes.text}</>}
              </p>
            )}
            {bars.length >= 3 && <Weeks bars={bars} connLabel={connLabel} />}
            {onSeeAll && <button type="button" className="pk-link hm-link" onClick={onSeeAll}>See every call and reply</button>}
          </div>
        </div>
      </section>
    </MotionRoot>
  );
}

export default HomeResultsNight;
