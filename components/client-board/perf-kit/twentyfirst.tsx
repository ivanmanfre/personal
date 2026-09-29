// The 21st.dev pieces of the perf-kit, ported from arch-report-app/src/components/twentyfirst
// (2026-09-29).
//
// "Animated Blur Number" by serafimcloud
//   https://21st.dev/@serafimcloud/components/animated-blur-number
//   Only the digits that change slide and blur; unchanged digits never move. Keyframes live
//   in ./styles.ts (.an-*); reduced motion turns the slide off and shows the new value.
//
// "Funnel Chart" by bklitai (bklit charts)
//   https://21st.dev/@bklitai/components/funnel-chart
//   One continuous curved shape (cubic S-curves between stages), three stacked rings faint
//   to solid, ink slice lines between stages. As in the ARCH report: one SVG, square-root
//   widths from the caller (the numbers carry the truth), a top-down pour on reveal, and the
//   finished shape under reduced motion. The stops read the board accent (RISE yellow).
import React, { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { m, useReducedMotion } from 'framer-motion';
import { useQuiet } from './night';

const ZWSP = '​';

function CharSlot({ char, direction, durationMs, blur }: { char: string; direction: number; durationMs: number; blur: number }) {
  const prev = useRef(char);
  const gen = useRef(0);
  const [state, setState] = useState(() => ({ cur: char, out: null as string | null, gen: 0 }));
  useEffect(() => {
    if (char === prev.current) return;
    gen.current += 1;
    setState({ cur: char, out: prev.current, gen: gen.current });
    prev.current = char;
  }, [char]);
  const animating = state.out !== null;
  const style = { '--an-dur': `${durationMs}ms`, '--an-blur': `${blur}px`, '--an-dir': direction } as CSSProperties;
  return (
    <span className="an-slot" style={style} aria-hidden="true">
      <span key={`in-${state.gen}`} className={animating ? 'an-layer an-in' : 'an-layer'} onAnimationEnd={animating ? () => setState((s) => ({ ...s, out: null })) : undefined}>
        {state.cur === '' ? ZWSP : state.cur}
      </span>
      {animating ? <span key={`out-${state.gen}`} className="an-layer an-out">{state.out === '' ? ZWSP : state.out}</span> : null}
    </span>
  );
}

export function AnimateNumber({ value, duration = 420, blur = 14 }: { value: number; duration?: number; blur?: number }) {
  const formatted = Math.round(value).toLocaleString('en-US');
  const [prev, setPrev] = useState(value);
  const [direction, setDirection] = useState(1);
  if (prev !== value) {
    setDirection(value < prev ? -1 : 1);
    setPrev(value);
  }
  const chars = formatted.split('');
  return (
    <span className="an-root">
      <span className="pk-sr">{formatted}</span>
      {chars.map((ch, i) => <CharSlot key={chars.length - 1 - i} char={ch} direction={direction} durationMs={duration} blur={blur} />)}
    </span>
  );
}

const RINGS = [
  { scale: 1, opacity: 0.13 },
  { scale: 0.87, opacity: 0.32 },
  { scale: 0.74, opacity: 1 },
];

function path(widths: number[], centers: number[], height: number, scale: number) {
  const pts: [number, number][] = [[0, widths[0]]];
  centers.forEach((y, i) => pts.push([y, widths[i]]));
  pts.push([height, widths[widths.length - 1]]);
  const half = pts.map(([y, w]) => [y, (w * scale) / 2] as const);
  let d = `M ${50 - half[0][1]} 0`;
  for (let i = 1; i < half.length; i++) {
    const [y0, h0] = half[i - 1];
    const [y1, h1] = half[i];
    const my = (y0 + y1) / 2;
    d += ` C ${50 - h0} ${my}, ${50 - h1} ${my}, ${50 - h1} ${y1}`;
  }
  const last = half[half.length - 1];
  d += ` L ${50 + last[1]} ${last[0]}`;
  for (let i = half.length - 2; i >= 0; i--) {
    const [y0, h0] = half[i + 1];
    const [y1, h1] = half[i];
    const my = (y0 + y1) / 2;
    d += ` C ${50 + h0} ${my}, ${50 + h1} ${my}, ${50 + h1} ${y1}`;
  }
  return `${d} Z`;
}

export function FunnelShape({ widths, centers, slices, height, shown, duration = 1.05, delay = 0.1 }: {
  widths: number[]; centers: number[]; slices: number[]; height: number; shown: boolean; duration?: number; delay?: number;
}) {
  const reduce = useReducedMotion();
  const quiet = useQuiet();
  const uid = useId().replace(/:/g, '');
  const f = (y: number) => `${((y / height) * 100).toFixed(2)}%`;
  if (quiet) {
    // QUIET (2026-09-29): the same shape, matte. One outline (no halo rings), each stage a
    // flat grey step getting a shade deeper on the way down, the last stage (booked a call)
    // solid yellow, and a thin paper-white cut between steps. No sheen, no fade, no shadow.
    const n = widths.length;
    const GREYS = ['#ECECE9', '#E1E1DD', '#D5D5D0', '#C9C9C4', '#BDBDB8'];
    const band = (i: number) => (i === n - 1 ? 'var(--cb-accent)' : GREYS[Math.min(i, GREYS.length - 1)]);
    const edges = [0, ...slices, height];
    return (
      <m.div
        aria-hidden="true"
        className="pk-fn-reveal"
        initial={reduce ? false : { clipPath: 'inset(0% 0% 100% 0%)' }}
        animate={shown ? { clipPath: 'inset(0% 0% 0% 0%)' } : undefined}
        transition={{ duration, ease: 'easeInOut', delay }}
      >
        <svg className="pk-fn-svg pk-fn-matte" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id={`${uid}-q`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={height}>
              {Array.from({ length: n }, (_, i) => (
                <React.Fragment key={i}>
                  <stop offset={f(edges[i] ?? 0)} style={{ stopColor: band(i) }} />
                  <stop offset={f(edges[i + 1] ?? height)} style={{ stopColor: band(i) }} />
                </React.Fragment>
              ))}
            </linearGradient>
            <clipPath id={`${uid}-qc`}>
              <path d={path(widths, centers, height, 0.87)} />
            </clipPath>
          </defs>
          <path d={path(widths, centers, height, 0.87)} fill={`url(#${uid}-q)`} />
          <g clipPath={`url(#${uid}-qc)`}>
            {slices.map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="#FFFFFF" strokeWidth={2} vectorEffect="non-scaling-stroke" />)}
          </g>
        </svg>
      </m.div>
    );
  }
  return (
    <m.div
      aria-hidden="true"
      className="pk-fn-reveal"
      initial={reduce ? false : { clipPath: 'inset(0% 0% 100% 0%)' }}
      animate={shown ? { clipPath: 'inset(0% 0% 0% 0%)' } : undefined}
      transition={{ duration, ease: 'easeInOut', delay }}
    >
      <svg className="pk-fn-svg" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`${uid}-g`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={height}>
            <stop offset="0%" style={{ stopColor: '#fff', stopOpacity: 0.26 }} />
            <stop offset={f(centers[0])} style={{ stopColor: '#fff', stopOpacity: 0.26 }} />
            {centers.slice(1).map((y, i, a) => (
              <stop key={y} offset={f(y)} style={{ stopColor: 'var(--cb-accent)', stopOpacity: a.length > 1 ? 0.45 + (0.55 * i) / (a.length - 1) : 1 }} />
            ))}
            <stop offset="100%" style={{ stopColor: 'var(--cb-accent)', stopOpacity: 1 }} />
          </linearGradient>
          <clipPath id={`${uid}-c`}>
            <path d={path(widths, centers, height, RINGS[0].scale)} />
          </clipPath>
        </defs>
        {RINGS.map((r) => <path key={r.scale} d={path(widths, centers, height, r.scale)} fill={`url(#${uid}-g)`} opacity={r.opacity} />)}
        <g clipPath={`url(#${uid}-c)`}>
          {slices.map((y) => <line key={y} className="pk-fn-slice" x1="0" x2="100" y1={y} y2={y} vectorEffect="non-scaling-stroke" />)}
        </g>
      </svg>
    </m.div>
  );
}
