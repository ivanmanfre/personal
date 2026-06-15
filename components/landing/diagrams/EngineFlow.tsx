import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { DIAGRAM, prefersReducedMotion } from './tokens';

// ─── EngineFlow — the system showcase (detailed) ─────────────────────────────
// A looping demonstration of the FULL content system, stage by stage:
//   VOICE INTAKE → IDEA ENGINE (what to post) → fans one idea into POST /
//   CAROUSEL / VIDEO / LEAD MAGNET (each with its own production) → all converge
//   through the ANTI-SLOP QA gate (the moat) → CALENDAR schedules → PUBLISH
//   daily → the lead magnets feed a LEADS list that lands on the DASHBOARD.
// A single sage signal travels the pipeline; nodes tick to done-state as it
// passes; at the end, captured leads arrive as little sage squares.
//
// Brand diagram language (§5d/§5e): sharp nodes, 1px ink stroke, paper fill,
// ONE lit sage path, sage corner tick. SVG + framer-motion only (no new dep).
// prefers-reduced-motion / capture → fully-ticked done-state, leads shown, no loop.

const NODE_H = 32;
const CHAR_W = 11 * 0.68;
const PAD_X = 13;
const wd = (label: string) => Math.ceil(label.length * CHAR_W) + PAD_X * 2;

type N = { id: string; label: string; x: number; cy: number; w: number; phase: number; caption?: string; signature?: boolean };
type Edge = { d: string; phase: number; delay?: number };

const PHASES = 6; // 0 voice→idea · 1 idea→formats · 2 formats→QA · 3 QA→cal · 4 cal→publish · 5 publish→dash/leads · 6 leads land

const hcurve = (x1: number, y1: number, x2: number, y2: number) => { const mx = (x1 + x2) / 2; return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`; };
const vcurve = (x1: number, y1: number, x2: number, y2: number) => { const my = (y1 + y2) / 2; return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`; };
const right = (n: N) => n.x + n.w;

// ─── Desktop layout (viewBox 1200×440) ───────────────────────────────────────
const S = 205; // spine y
const D = {
  voice: { id: 'voice', label: 'Voice intake', x: 0, cy: S, phase: 0, caption: 'you, once', w: wd('Voice intake') } as N,
  idea: { id: 'idea', label: 'Idea engine', x: 178, cy: S, phase: 1, caption: 'what to post', w: wd('Idea engine') } as N,
};
const D_FORMATS: N[] = [
  { id: 'post', label: 'Post', cy: 92, phase: 2, caption: '+ variations', w: wd('Post'), x: 0 },
  { id: 'car', label: 'Carousel', cy: 164, phase: 2, caption: 'slides + art', w: wd('Carousel'), x: 0 },
  { id: 'vid', label: 'Video', cy: 246, phase: 2, caption: 'scripted + cut', w: wd('Video'), x: 0 },
  { id: 'lm', label: 'Lead magnet', cy: 318, phase: 2, caption: 'page + email', w: wd('Lead magnet'), x: 0 },
];
const FCX = 452;
D_FORMATS.forEach((f) => { f.x = FCX - f.w / 2; });
const D_QA: N = { id: 'qa', label: 'Anti-slop QA', x: 628, cy: S, phase: 3, caption: 'no AI slop', signature: true, w: wd('Anti-slop QA') };
const D_CAL: N = { id: 'cal', label: 'Calendar', x: 800, cy: S, phase: 4, caption: 'schedules daily', w: wd('Calendar') };
const D_PUB: N = { id: 'pub', label: 'Publish', x: 944, cy: S, phase: 4, w: wd('Publish') };
const D_DASH: N = { id: 'dash', label: 'Dashboard', x: 1085, cy: 150, phase: 5, caption: 'pipeline', w: wd('Dashboard') };
const D_LEADS: N = { id: 'leads', label: 'Leads', x: 1085, cy: 300, phase: 5, caption: 'captured', w: wd('Leads') };
const D_NODES = [D.voice, D.idea, ...D_FORMATS, D_QA, D_CAL, D_PUB, D_DASH, D_LEADS];
const D_EDGES: Edge[] = [
  { d: hcurve(right(D.voice), S, D.idea.x, S), phase: 0 },
  ...D_FORMATS.map((f, i): Edge => ({ d: hcurve(right(D.idea), S, f.x, f.cy), phase: 1, delay: i * 0.06 })),
  ...D_FORMATS.map((f, i): Edge => ({ d: hcurve(right(f), f.cy, D_QA.x, S), phase: 2, delay: i * 0.06 })),
  { d: hcurve(right(D_QA), S, D_CAL.x, S), phase: 3 },
  { d: hcurve(right(D_CAL), S, D_PUB.x, S), phase: 4 },
  { d: hcurve(right(D_PUB), S, D_DASH.x, D_DASH.cy), phase: 5 },
  { d: hcurve(right(D_PUB), S, D_LEADS.x, D_LEADS.cy), phase: 5 },
];
// leads particles land beside the LEADS node
const D_LEAD_DOTS = Array.from({ length: 6 }, (_, i) => ({ x: D_LEADS.x + D_LEADS.w + 14 + (i % 3) * 16, y: D_LEADS.cy - 8 + Math.floor(i / 3) * 16 }));

// ─── Mobile layout (viewBox 360×900) — vertical spine ────────────────────────
const MX = 60;
const mn = (id: string, label: string, cy: number, phase: number, caption?: string, signature = false): N => ({ id, label, x: MX, cy, phase, caption, signature, w: wd(label) });
const M = {
  voice: mn('voice', 'Voice intake', 34, 0, 'you, once'),
  idea: mn('idea', 'Idea engine', 124, 1, 'what to post'),
};
const M_FORMATS: N[] = [
  { id: 'post', label: 'Post', x: 236, cy: 250, phase: 2, w: wd('Post') },
  { id: 'car', label: 'Carousel', x: 236, cy: 312, phase: 2, w: wd('Carousel') },
  { id: 'vid', label: 'Video', x: 236, cy: 374, phase: 2, w: wd('Video') },
  { id: 'lm', label: 'Lead magnet', x: 214, cy: 436, phase: 2, w: wd('Lead magnet') },
];
const M_QA = mn('qa', 'Anti-slop QA', 560, 3, 'no AI slop', true);
const M_CAL = mn('cal', 'Calendar', 650, 4, 'schedules daily');
const M_PUB = mn('pub', 'Publish', 740, 4);
const M_DASH = mn('dash', 'Dashboard', 830, 5, 'pipeline');
const M_LEADS: N = { id: 'leads', label: 'Leads', x: 232, cy: 830, phase: 5, caption: 'captured', w: wd('Leads') };
const M_NODES = [M.voice, M.idea, ...M_FORMATS, M_QA, M_CAL, M_PUB, M_DASH, M_LEADS];
const M_EDGES: Edge[] = [
  { d: vcurve(M.voice.x + 30, M.voice.cy + NODE_H / 2, M.idea.x + 30, M.idea.cy - NODE_H / 2), phase: 0 },
  ...M_FORMATS.map((f, i): Edge => ({ d: vcurve(M.idea.x + 34, M.idea.cy + NODE_H / 2, f.x, f.cy), phase: 1, delay: i * 0.06 })),
  ...M_FORMATS.map((f, i): Edge => ({ d: vcurve(f.x, f.cy, M_QA.x + 34, M_QA.cy - NODE_H / 2), phase: 2, delay: i * 0.06 })),
  { d: vcurve(M_QA.x + 30, M_QA.cy + NODE_H / 2, M_CAL.x + 30, M_CAL.cy - NODE_H / 2), phase: 3 },
  { d: vcurve(M_CAL.x + 30, M_CAL.cy + NODE_H / 2, M_PUB.x + 30, M_PUB.cy - NODE_H / 2), phase: 4 },
  { d: vcurve(M_PUB.x + 30, M_PUB.cy + NODE_H / 2, M_DASH.x + 30, M_DASH.cy - NODE_H / 2), phase: 5 },
  { d: hcurve(M_PUB.x, M_PUB.cy + 8, M_LEADS.x + M_LEADS.w, M_LEADS.cy, ), phase: 5 },
];
const M_LEAD_DOTS = Array.from({ length: 6 }, (_, i) => ({ x: M_LEADS.x - 16 - (i % 3) * 16, y: M_LEADS.cy - 8 + Math.floor(i / 3) * 16 }));

// ─── Renderers ───────────────────────────────────────────────────────────────
const FlowNode: React.FC<{ n: N; ticked: boolean }> = ({ n, ticked }) => {
  const innerW = n.w - PAD_X * 2;
  const natural = n.label.length * CHAR_W;
  const fit = natural > innerW ? { textLength: innerW, lengthAdjust: 'spacingAndGlyphs' as const } : {};
  return (
    <g transform={`translate(${n.x}, ${n.cy - NODE_H / 2})`}>
      <rect width={n.w} height={NODE_H} fill={DIAGRAM.paper} stroke={ticked ? DIAGRAM.inkDone : DIAGRAM.ink} strokeWidth={n.signature ? 1.75 : DIAGRAM.nodeStroke} style={{ transition: 'stroke 0.4s ease' }} />
      <text x={n.w / 2} y={NODE_H / 2} dominantBaseline="central" textAnchor="middle" fontFamily={DIAGRAM.font} fontSize={DIAGRAM.fontSize} letterSpacing="0.06em" fill={ticked ? '#1A1A1A' : DIAGRAM.label} style={{ transition: 'fill 0.4s ease' }} {...fit}>
        {n.label.toUpperCase()}
      </text>
      <motion.rect x={n.w - DIAGRAM.tick / 2} y={-DIAGRAM.tick / 2} width={DIAGRAM.tick} height={DIAGRAM.tick} fill={DIAGRAM.sage} initial={false} animate={{ opacity: ticked ? 1 : 0, scale: ticked ? 1 : 0.4 }} transition={{ duration: 0.3, ease: [0.22, 0.84, 0.36, 1] }} style={{ transformOrigin: 'center' }} />
      {n.caption && (
        <text x={n.w / 2} y={NODE_H + 14} textAnchor="middle" fontFamily={DIAGRAM.font} fontSize={8.5} letterSpacing="0.04em" fill={n.signature ? '#1F6B4B' : DIAGRAM.label} style={{ opacity: 0.85 }}>
          {n.caption}
        </text>
      )}
    </g>
  );
};

const FlowEdge: React.FC<{ edge: Edge; lit: boolean }> = ({ edge, lit }) => (
  <>
    <path d={edge.d} stroke={DIAGRAM.connector} strokeWidth={DIAGRAM.nodeStroke} fill="none" />
    <motion.path d={edge.d} stroke={DIAGRAM.sage} strokeWidth={DIAGRAM.signalStroke} fill="none" strokeLinecap="round" initial={false} animate={{ pathLength: lit ? 1 : 0, opacity: lit ? 1 : 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: lit ? edge.delay ?? 0 : 0 }} />
  </>
);

const LeadDot: React.FC<{ x: number; y: number; show: boolean; i: number }> = ({ x, y, show, i }) => (
  <motion.rect x={x} y={y} width={9} height={9} fill={DIAGRAM.sage} initial={false} animate={{ opacity: show ? 1 : 0, scale: show ? 1 : 0.2 }} transition={{ duration: 0.32, ease: [0.22, 0.84, 0.36, 1], delay: show ? i * 0.12 : 0 }} style={{ transformOrigin: 'center' }} />
);

const useEngineLoop = (active: boolean): number => {
  const reduced = prefersReducedMotion();
  const [phase, setPhase] = useState(reduced ? PHASES : -1);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (reduced || !active) return;
    let p = -1;
    const tick = () => {
      p = p >= PHASES ? -1 : p + 1;
      setPhase(p);
      timer.current = setTimeout(tick, p >= PHASES ? 2400 : 760);
    };
    timer.current = setTimeout(tick, 450);
    return () => clearTimeout(timer.current);
  }, [reduced, active]);
  return phase;
};

const Diagram: React.FC<{ nodes: N[]; edges: Edge[]; dots: { x: number; y: number }[]; viewBox: string; aspect: string }> = ({ nodes, edges, dots, viewBox, aspect }) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false, margin: '-12%' });
  const phase = useEngineLoop(inView);
  return (
    <div ref={ref} style={{ width: '100%' }}>
      <svg viewBox={viewBox} width="100%" style={{ display: 'block', aspectRatio: aspect, overflow: 'visible' }} role="img" aria-label="How the content system works: voice intake feeds an idea engine that decides what to post and turns one idea into a post, carousel, video and lead magnet; every piece passes an anti-slop QA gate, the calendar schedules it, it publishes daily, and the lead magnets feed a leads list on your dashboard.">
        {edges.map((e, i) => (<FlowEdge key={i} edge={e} lit={phase >= e.phase} />))}
        {nodes.map((n) => (<FlowNode key={n.id} n={n} ticked={phase >= n.phase} />))}
        {dots.map((d, i) => (<LeadDot key={i} x={d.x} y={d.y} i={i} show={phase >= PHASES} />))}
      </svg>
    </div>
  );
};

const EngineFlow: React.FC = () => (
  <>
    <div className="hidden md:block">
      <Diagram nodes={D_NODES} edges={D_EDGES} dots={D_LEAD_DOTS} viewBox="0 0 1200 440" aspect="1200 / 440" />
    </div>
    <div className="md:hidden">
      <Diagram nodes={M_NODES} edges={M_EDGES} dots={M_LEAD_DOTS} viewBox="0 0 360 900" aspect="360 / 900" />
    </div>
  </>
);

export default EngineFlow;
