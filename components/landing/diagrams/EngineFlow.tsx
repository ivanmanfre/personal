import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { DIAGRAM, prefersReducedMotion } from './tokens';

// ─── EngineFlow — the system showcase ────────────────────────────────────────
// A looping demonstration of how the content engine ACTUALLY functions, mapped
// 1:1 to the system's documented behaviour (ContentSystemPage): it "decides
// what to post, writes it in your voice, refuses to ship AI slop, turns one
// idea into every format, and publishes itself" — then everything lands on the
// dashboard.
//
// Flow: IDEA ENGINE → fans one idea into POSTS / CAROUSELS / VIDEO / LEAD
// MAGNETS → all converge through the ANTI-SLOP QA gate (the moat) → PUBLISH
// DAILY → DASHBOARD (leads + pipeline). One sage signal travels it; each node
// ticks to done-state as the signal passes.
//
// Built in the brand diagram language (§5d/§5e): sharp nodes, 1px ink stroke,
// paper fill, ONE lit sage path, sage corner-square tick. SVG + framer-motion
// only (no new dependency) so motion DEMONSTRATES the system. prefers-reduced-
// motion / non-interactive capture renders the fully-ticked done-state, no loop.

const NODE_H = 34;
const CHAR_W = 11 * 0.68; // IBM Plex Mono advance @ 11px + tracking
const PAD_X = 14;
const wd = (label: string) => Math.ceil(label.length * CHAR_W) + PAD_X * 2;

type N = {
  id: string;
  label: string;
  x: number;
  cy: number;
  w: number;
  phase: number;       // node ticks when signal phase >= this
  caption?: string;    // small mono sub-label under the node
  signature?: boolean; // the anti-slop QA gate — the moat, drawn heavier
};
type Edge = { d: string; phase: number; delay?: number };

// Phase timeline: 0 idea→formats · 1 formats→QA · 2 QA→publish · 3 publish→dash
const PHASES = 4;

// Smooth S-curve between two points (editorial, never a right angle).
const hcurve = (x1: number, y1: number, x2: number, y2: number) => {
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
};
const vcurve = (x1: number, y1: number, x2: number, y2: number) => {
  const my = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`;
};
const right = (n: N) => n.x + n.w;
const left = (n: N) => n.x;

// ─── Desktop horizontal layout (viewBox 1080×300) ────────────────────────────
const SPINE = 140;
const FCX = 405; // formats column centre
const fmt = (id: string, label: string, cy: number): N => ({ id, label, w: wd(label), x: FCX - wd(label) / 2, cy, phase: 1 });

const D_IDEA: N = { id: 'idea', label: 'Idea engine', w: wd('Idea engine'), x: 0, cy: SPINE, phase: 0, caption: 'decides what to post' };
const D_FORMATS: N[] = [fmt('posts', 'Posts', 44), fmt('car', 'Carousels', 110), fmt('vid', 'Video', 176), fmt('lm', 'Lead magnets', 242)];
const D_QA: N = { id: 'qa', label: 'Anti-slop QA', w: wd('Anti-slop QA'), x: 600, cy: SPINE, phase: 2, caption: 'refuses AI slop', signature: true };
const D_PUB: N = { id: 'pub', label: 'Publish daily', w: wd('Publish daily'), x: 800, cy: SPINE, phase: 3, caption: 'schedules itself' };
const D_DASH: N = { id: 'dash', label: 'Dashboard', w: wd('Dashboard'), x: 980, cy: SPINE, phase: 4, caption: 'leads + pipeline' };
const D_NODES = [D_IDEA, ...D_FORMATS, D_QA, D_PUB, D_DASH];
const D_EDGES: Edge[] = [
  ...D_FORMATS.map((f, i): Edge => ({ d: hcurve(right(D_IDEA), SPINE, left(f), f.cy), phase: 0, delay: i * 0.07 })),
  ...D_FORMATS.map((f, i): Edge => ({ d: hcurve(right(f), f.cy, left(D_QA), SPINE), phase: 1, delay: i * 0.07 })),
  { d: hcurve(right(D_QA), SPINE, left(D_PUB), SPINE), phase: 2 },
  { d: hcurve(right(D_PUB), SPINE, left(D_DASH), SPINE), phase: 3 },
];

// ─── Mobile vertical layout (viewBox 360×760) ────────────────────────────────
const MX = 64;
const mn = (id: string, label: string, cy: number, phase: number, caption?: string, signature = false): N => ({ id, label, w: wd(label), x: MX, cy, phase, caption, signature });
const M_IDEA = mn('idea', 'Idea engine', 34, 0, 'decides what to post');
const M_FORMATS: N[] = [
  { id: 'posts', label: 'Posts', w: wd('Posts'), x: 230, cy: 190, phase: 1 },
  { id: 'car', label: 'Carousels', w: wd('Carousels'), x: 230, cy: 250, phase: 1 },
  { id: 'vid', label: 'Video', w: wd('Video'), x: 230, cy: 310, phase: 1 },
  { id: 'lm', label: 'Lead magnets', w: wd('Lead magnets'), x: 210, cy: 370, phase: 1 },
];
const M_QA = mn('qa', 'Anti-slop QA', 520, 2, 'refuses AI slop', true);
const M_PUB = mn('pub', 'Publish daily', 620, 3, 'schedules itself');
const M_DASH = mn('dash', 'Dashboard', 710, 4, 'leads + pipeline');
const M_NODES = [M_IDEA, ...M_FORMATS, M_QA, M_PUB, M_DASH];
const mc = (n: N) => n.cy; // centre y helper
const M_EDGES: Edge[] = [
  ...M_FORMATS.map((f, i): Edge => ({ d: vcurve(M_IDEA.x + 34, M_IDEA.cy + NODE_H / 2, f.x, mc(f)), phase: 0, delay: i * 0.07 })),
  ...M_FORMATS.map((f, i): Edge => ({ d: vcurve(f.x, mc(f), M_QA.x + 34, M_QA.cy - NODE_H / 2), phase: 1, delay: i * 0.07 })),
  { d: vcurve(M_QA.x + 30, M_QA.cy + NODE_H / 2, M_PUB.x + 30, M_PUB.cy - NODE_H / 2), phase: 2 },
  { d: vcurve(M_PUB.x + 30, M_PUB.cy + NODE_H / 2, M_DASH.x + 30, M_DASH.cy - NODE_H / 2), phase: 3 },
];

// ─── Renderers ───────────────────────────────────────────────────────────────
const FlowNode: React.FC<{ n: N; ticked: boolean }> = ({ n, ticked }) => {
  const innerW = n.w - PAD_X * 2;
  const natural = n.label.length * CHAR_W;
  const fit = natural > innerW ? { textLength: innerW, lengthAdjust: 'spacingAndGlyphs' as const } : {};
  return (
    <g transform={`translate(${n.x}, ${n.cy - NODE_H / 2})`}>
      <rect
        width={n.w}
        height={NODE_H}
        fill={DIAGRAM.paper}
        stroke={ticked ? DIAGRAM.inkDone : DIAGRAM.ink}
        strokeWidth={n.signature ? 1.75 : DIAGRAM.nodeStroke}
        style={{ transition: 'stroke 0.4s ease' }}
      />
      <text
        x={n.w / 2}
        y={NODE_H / 2}
        dominantBaseline="central"
        textAnchor="middle"
        fontFamily={DIAGRAM.font}
        fontSize={DIAGRAM.fontSize}
        letterSpacing="0.07em"
        fill={ticked ? '#1A1A1A' : DIAGRAM.label}
        style={{ transition: 'fill 0.4s ease' }}
        {...fit}
      >
        {n.label.toUpperCase()}
      </text>
      {/* sage corner-square tick — the done-state mark */}
      <motion.rect
        x={n.w - DIAGRAM.tick / 2}
        y={-DIAGRAM.tick / 2}
        width={DIAGRAM.tick}
        height={DIAGRAM.tick}
        fill={DIAGRAM.sage}
        initial={false}
        animate={{ opacity: ticked ? 1 : 0, scale: ticked ? 1 : 0.4 }}
        transition={{ duration: 0.3, ease: [0.22, 0.84, 0.36, 1] }}
        style={{ transformOrigin: 'center' }}
      />
      {n.caption && (
        <text
          x={n.w / 2}
          y={NODE_H + 15}
          textAnchor="middle"
          fontFamily={DIAGRAM.font}
          fontSize={9}
          letterSpacing="0.05em"
          fill={n.signature ? '#1F6B4B' : DIAGRAM.label}
          style={{ opacity: 0.9 }}
        >
          {n.caption}
        </text>
      )}
    </g>
  );
};

const FlowEdge: React.FC<{ edge: Edge; lit: boolean }> = ({ edge, lit }) => (
  <>
    <path d={edge.d} stroke={DIAGRAM.connector} strokeWidth={DIAGRAM.nodeStroke} fill="none" />
    <motion.path
      d={edge.d}
      stroke={DIAGRAM.sage}
      strokeWidth={DIAGRAM.signalStroke}
      fill="none"
      strokeLinecap="round"
      initial={false}
      animate={{ pathLength: lit ? 1 : 0, opacity: lit ? 1 : 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: lit ? edge.delay ?? 0 : 0 }}
    />
  </>
);

// ─── Looping phase machine ───────────────────────────────────────────────────
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
      timer.current = setTimeout(tick, p >= PHASES ? 2100 : 820);
    };
    timer.current = setTimeout(tick, 450);
    return () => clearTimeout(timer.current);
  }, [reduced, active]);
  return phase;
};

const Diagram: React.FC<{ nodes: N[]; edges: Edge[]; viewBox: string; aspect: string }> = ({ nodes, edges, viewBox, aspect }) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false, margin: '-15%' });
  const phase = useEngineLoop(inView);
  return (
    <div ref={ref} style={{ width: '100%' }}>
      <svg viewBox={viewBox} width="100%" style={{ display: 'block', aspectRatio: aspect, overflow: 'visible' }} role="img" aria-label="How the engine works: the idea engine decides what to post, turns one idea into posts, carousels, video and lead magnets, runs every piece through an anti-slop QA gate, publishes daily, and tracks leads on your dashboard.">
        {edges.map((e, i) => (
          <FlowEdge key={i} edge={e} lit={phase >= e.phase} />
        ))}
        {nodes.map((n) => (
          <FlowNode key={n.id} n={n} ticked={phase >= n.phase} />
        ))}
      </svg>
    </div>
  );
};

const EngineFlow: React.FC = () => (
  <>
    <div className="hidden sm:block">
      <Diagram nodes={D_NODES} edges={D_EDGES} viewBox="0 0 1080 300" aspect="1080 / 300" />
    </div>
    <div className="sm:hidden">
      <Diagram nodes={M_NODES} edges={M_EDGES} viewBox="0 0 360 760" aspect="360 / 760" />
    </div>
  </>
);

export default EngineFlow;
