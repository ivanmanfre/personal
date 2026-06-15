import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { DIAGRAM, prefersReducedMotion } from './tokens';

// ─── EngineFlow — the system showcase ────────────────────────────────────────
// A looping demonstration of how the content engine FUNCTIONS (W3.6). One sage
// signal travels the pipeline; each node ticks to its done-state as the signal
// passes; the multi-format stage fans out (posts / carousels / video / lead
// magnets) then converges to publish → booked calls. Built in the brand diagram
// language (§5d/§5e): sharp nodes, 1px ink stroke, paper fill, ONE lit sage
// path, sage corner-square tick. No new dependency — SVG + framer-motion only,
// so motion DEMONSTRATES the system instead of decorating it.
//
// prefers-reduced-motion (or non-interactive capture): renders the fully-ticked
// done-state with every path drawn and no loop — the diagram still reads as a
// complete system, it just doesn't animate.

const NODE_H = 30;
const CHAR_W = 11 * 0.68; // IBM Plex Mono advance @ 11px + tracking
const PAD_X = 13;
const w = (label: string) => Math.ceil(label.length * CHAR_W) + PAD_X * 2;

type N = { id: string; label: string; x: number; cy: number; w: number; phase: number; signature?: boolean };

// Phase timeline — the signal advances one phase at a time, lighting paths and
// ticking nodes. Reset to -1 loops it.
//  0 idea→generate · 1 generate→qa · 2 qa fans to 4 formats · 3 formats→publish
//  4 publish→result
const PHASES = 5;

// ─── Desktop horizontal branch layout (viewBox 1040×230) ─────────────────────
const SPINE_CY = 56;
const dNode = (id: string, label: string, x: number, cy: number, phase: number, signature = false): N => ({ id, label, x, cy, w: w(label), phase, signature });

const D_SPINE: N[] = [
  dNode('idea', 'Idea engine', 0, SPINE_CY, 0),
  dNode('gen', 'Generate', 175, SPINE_CY, 0),
  dNode('qa', 'Anti-slop QA', 330, SPINE_CY, 1, true),
];
const FORMAT_CX = 600;
const D_FORMATS: N[] = [
  { id: 'posts', label: 'Posts', cy: 18, phase: 2, w: w('Posts'), x: FORMAT_CX - w('Posts') / 2 },
  { id: 'car', label: 'Carousels', cy: 78, phase: 2, w: w('Carousels'), x: FORMAT_CX - w('Carousels') / 2 },
  { id: 'vid', label: 'Video', cy: 138, phase: 2, w: w('Video'), x: FORMAT_CX - w('Video') / 2 },
  { id: 'lm', label: 'Lead magnets', cy: 198, phase: 2, w: w('Lead magnets'), x: FORMAT_CX - w('Lead magnets') / 2 },
];
const D_PUBLISH = dNode('pub', 'Publish daily', 820, 108, 3);
const D_RESULT = dNode('leads', 'Booked calls', 980, 108, 4);
D_RESULT.x = 1040 - D_RESULT.w; // right-anchor inside viewBox

const right = (n: N) => n.x + n.w;
const left = (n: N) => n.x;

// Smooth horizontal-ish bezier between two points (editorial S-curve, never a
// right-angle — matches serpentineLayout's connector character).
const curve = (x1: number, y1: number, x2: number, y2: number) => {
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
};

type Edge = { d: string; phase: number; delay?: number };

const D_EDGES: Edge[] = [
  { d: curve(right(D_SPINE[0]), SPINE_CY, left(D_SPINE[1]), SPINE_CY), phase: 0 },
  { d: curve(right(D_SPINE[1]), SPINE_CY, left(D_SPINE[2]), SPINE_CY), phase: 1 },
  // fan-out from QA right edge to each format (staggered)
  ...D_FORMATS.map((f, i): Edge => ({ d: curve(right(D_SPINE[2]), SPINE_CY, left(f), f.cy), phase: 2, delay: i * 0.08 })),
  // converge from each format right edge to publish
  ...D_FORMATS.map((f, i): Edge => ({ d: curve(right(f), f.cy, left(D_PUBLISH), D_PUBLISH.cy), phase: 3, delay: i * 0.08 })),
  { d: curve(right(D_PUBLISH), D_PUBLISH.cy, left(D_RESULT), D_RESULT.cy), phase: 4 },
];
const D_NODES = [...D_SPINE, ...D_FORMATS, D_PUBLISH, D_RESULT];

// ─── Mobile vertical layout (viewBox 360×620) ────────────────────────────────
const M_CX = 70;
const mNode = (id: string, label: string, cy: number, phase: number, signature = false): N => ({ id, label, x: M_CX, cy, w: w(label), phase, signature });
const M_NODES: N[] = [
  mNode('idea', 'Idea engine', 30, 0),
  mNode('gen', 'Generate', 120, 0),
  mNode('qa', 'Anti-slop QA', 210, 1, true),
  // formats fan to the right column
  { id: 'posts', label: 'Posts', x: 240, cy: 300, w: w('Posts'), phase: 2 },
  { id: 'car', label: 'Carousels', x: 240, cy: 350, w: w('Carousels'), phase: 2 },
  { id: 'vid', label: 'Video', x: 240, cy: 400, w: w('Video'), phase: 2 },
  { id: 'lm', label: 'Lead magnets', x: 220, cy: 450, w: w('Lead magnets'), phase: 2 },
  mNode('pub', 'Publish daily', 540, 3),
  mNode('leads', 'Booked calls', 590, 4),
];
const mById = (id: string) => M_NODES.find((n) => n.id === id)!;
const vcurve = (x1: number, y1: number, x2: number, y2: number) => {
  const my = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`;
};
const M_EDGES: Edge[] = [
  { d: vcurve(mById('idea').x + 20, mById('idea').cy + NODE_H / 2, mById('gen').x + 20, mById('gen').cy - NODE_H / 2), phase: 0 },
  { d: vcurve(mById('gen').x + 20, mById('gen').cy + NODE_H / 2, mById('qa').x + 20, mById('qa').cy - NODE_H / 2), phase: 1 },
  ...['posts', 'car', 'vid', 'lm'].map((id, i): Edge => ({ d: vcurve(mById('qa').x + 30, mById('qa').cy + NODE_H / 2, mById(id).x, mById(id).cy), phase: 2, delay: i * 0.08 })),
  ...['posts', 'car', 'vid', 'lm'].map((id, i): Edge => ({ d: vcurve(mById(id).x, mById(id).cy, mById('pub').x + 30, mById('pub').cy - NODE_H / 2), phase: 3, delay: i * 0.08 })),
  { d: vcurve(mById('pub').x + 20, mById('pub').cy + NODE_H / 2, mById('leads').x + 20, mById('leads').cy - NODE_H / 2), phase: 4 },
];

// ─── Node + edge renderers ───────────────────────────────────────────────────
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
        strokeWidth={n.signature ? 1.5 : DIAGRAM.nodeStroke}
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

// ─── The looping phase machine ───────────────────────────────────────────────
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
      // hold longer on the full-system frame before resetting
      timer.current = setTimeout(tick, p >= PHASES ? 2000 : 760);
    };
    timer.current = setTimeout(tick, 400);
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
      <svg viewBox={viewBox} width="100%" style={{ display: 'block', aspectRatio: aspect, overflow: 'visible' }} role="img" aria-label="How the engine works: idea engine, generate, anti-slop QA, then posts, carousels, video and lead magnets publish daily and bring booked calls.">
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
    {/* Desktop / tablet */}
    <div className="hidden sm:block">
      <Diagram nodes={D_NODES} edges={D_EDGES} viewBox="0 0 1040 230" aspect="1040 / 230" />
    </div>
    {/* Mobile */}
    <div className="sm:hidden">
      <Diagram nodes={M_NODES} edges={M_EDGES} viewBox="0 0 360 620" aspect="360 / 620" />
    </div>
  </>
);

export default EngineFlow;
