import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { DIAGRAM, prefersReducedMotion } from './tokens';

// ─── EngineFlow v5 — a readable MAP of how the system functions ──────────────
// Grounded in Ivan's own walkthrough (public/content-system-walkthrough.md):
// the system is a SELF-IMPROVING LOOP, not a linear pipeline. One idea →
// written in your voice → anti-slop QA → you approve → it schedules itself →
// publishes daily → lead magnets capture leads → and performance feeds back so
// it learns what lands and gets sharper. The feedback loop is the whole point.
//
// Design priority: CLARITY. A labelled process map with arrowheads (direction
// is obvious), numbered stages, the format fan, the leads output, and a clearly
// labelled return loop. A single sage dot circulates to show the flow; the map
// is fully readable static (reduced-motion / capture).

const SAGE = DIAGRAM.sage;
const INK = '#1A1A1A';
const INK_SOFT = 'rgba(26,26,26,0.30)';
const LABEL = '#5A5752';
const FONT = '"IBM Plex Mono", monospace';
const PAPER = '#F7F4EF';

const SPINE = 100;
const BOX_H = 42;

type Stage = { n: string; x: number; w: number; label: string; caption: string; signature?: boolean };
const STAGES: Stage[] = [
  { n: '1', x: 16, w: 112, label: 'Idea engine', caption: 'decides what to post' },
  { n: '2', x: 196, w: 104, label: 'Create', caption: 'written in your voice' },
  { n: '3', x: 360, w: 120, label: 'Anti-slop QA', caption: 'voice-matched, no slop', signature: true },
  { n: '4', x: 540, w: 116, label: 'You approve', caption: 'about 1 hr a week' },
  { n: '5', x: 716, w: 96, label: 'Schedule', caption: 'fills the calendar' },
  { n: '6', x: 872, w: 92, label: 'Publish', caption: 'daily, on LinkedIn' },
];
const cx = (s: Stage) => s.x + s.w / 2;
const rightX = (s: Stage) => s.x + s.w;

const FORMATS = ['Post', 'Carousel', 'Video', 'Lead magnet'];
const CREATE = STAGES[1];
const PUBLISH = STAGES[5];
const IDEA = STAGES[0];

// leads output (from the lead magnets the engine publishes)
const LEADS = { x: PUBLISH.x - 6, w: 104, cy: 250, label: 'Leads', caption: 'captured + qualified' };

// the circulating dot rides this loop: along the spine, then the return arc
const LOOP_PATH = `M ${cx(IDEA)} ${SPINE} L ${cx(PUBLISH)} ${SPINE} C ${cx(PUBLISH) + 96} ${SPINE} ${cx(PUBLISH) + 96} 320 ${cx(PUBLISH)} 320 L ${cx(IDEA)} 320 C ${cx(IDEA) - 96} 320 ${cx(IDEA) - 96} ${SPINE} ${cx(IDEA)} ${SPINE}`;

// arrow connector between two x positions on the spine
const SpineArrow: React.FC<{ x1: number; x2: number }> = ({ x1, x2 }) => (
  <g>
    <line x1={x1} y1={SPINE} x2={x2 - 7} y2={SPINE} stroke={INK_SOFT} strokeWidth={1.25} />
    <path d={`M ${x2 - 7} ${SPINE - 4} L ${x2} ${SPINE} L ${x2 - 7} ${SPINE + 4}`} fill="none" stroke={INK_SOFT} strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" />
  </g>
);

const StageBox: React.FC<{ s: Stage }> = ({ s }) => (
  <g>
    <rect x={s.x} y={SPINE - BOX_H / 2} width={s.w} height={BOX_H} fill={PAPER} stroke={s.signature ? INK : INK} strokeWidth={s.signature ? 1.75 : 1.25} />
    {/* stage number — small sage mono tag, top-left */}
    <text x={s.x + 8} y={SPINE - BOX_H / 2 - 7} fontFamily={FONT} fontSize={10} fontWeight={700} letterSpacing="0.1em" fill={SAGE}>{s.n}</text>
    <text x={cx(s)} y={SPINE - 4} textAnchor="middle" fontFamily={FONT} fontSize={11.5} letterSpacing="0.05em" fill={INK}>{s.label.toUpperCase()}</text>
    <text x={cx(s)} y={SPINE + 11} textAnchor="middle" fontFamily={FONT} fontSize={8.5} letterSpacing="0.03em" fill={s.signature ? '#1F6B4B' : LABEL}>{s.caption}</text>
  </g>
);

const Scene: React.FC<{ loop: boolean }> = ({ loop }) => (
  <svg viewBox="0 0 1080 380" width="100%" style={{ display: 'block', overflow: 'visible' }} role="img" aria-label="A map of how the content system works as a self-improving loop: an idea engine decides what to post, the system writes it in your voice as a post, carousel, video or lead magnet, runs it through an anti-slop QA pass, you approve it in about 15 minutes a week, it schedules itself and publishes daily, the lead magnets capture and qualify leads, and real performance feeds back so the system learns what lands.">
    {/* return loop (the self-improving feedback) — drawn distinctly, labelled */}
    <path
      d={`M ${cx(PUBLISH)} ${SPINE + BOX_H / 2} C ${cx(PUBLISH) + 96} ${SPINE + 60} ${cx(PUBLISH) + 96} 320 ${cx(PUBLISH)} 320 L ${cx(IDEA)} 320 C ${cx(IDEA) - 96} 320 ${cx(IDEA) - 96} ${SPINE + 30} ${cx(IDEA)} ${SPINE + BOX_H / 2 + 7}`}
      fill="none"
      stroke={SAGE}
      strokeWidth={1.5}
      strokeDasharray="2 5"
      opacity={0.7}
    />
    {/* arrowhead into idea engine (bottom) */}
    <path d={`M ${cx(IDEA) - 4} ${SPINE + BOX_H / 2 + 12} L ${cx(IDEA)} ${SPINE + BOX_H / 2 + 4} L ${cx(IDEA) + 4} ${SPINE + BOX_H / 2 + 12}`} fill="none" stroke={SAGE} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    <text x={(cx(IDEA) + cx(PUBLISH)) / 2} y={314} textAnchor="middle" fontFamily={FONT} fontSize={10} letterSpacing="0.14em" fill="#1F6B4B">
      PERFORMANCE FEEDS BACK · IT LEARNS WHAT LANDS
    </text>

    {/* spine connectors */}
    {STAGES.slice(0, -1).map((s, i) => (<SpineArrow key={i} x1={rightX(s)} x2={STAGES[i + 1].x} />))}

    {/* format fan under CREATE */}
    <line x1={cx(CREATE)} y1={SPINE + BOX_H / 2} x2={cx(CREATE)} y2={150} stroke={INK_SOFT} strokeWidth={1.25} />
    {FORMATS.map((f, i) => {
      const y = 150 + i * 30;
      const w = Math.ceil(f.length * 6.6) + 18;
      const x = cx(CREATE) - w / 2;
      return (
        <g key={f}>
          {i === 0 && <line x1={cx(CREATE)} y1={150} x2={cx(CREATE)} y2={150 + 3 * 30} stroke={INK_SOFT} strokeWidth={1.25} />}
          <rect x={x} y={y} width={w} height={22} fill={PAPER} stroke={INK_SOFT} strokeWidth={1} />
          <text x={cx(CREATE)} y={y + 11} dominantBaseline="central" textAnchor="middle" fontFamily={FONT} fontSize={9.5} letterSpacing="0.04em" fill={INK}>{f.toUpperCase()}</text>
        </g>
      );
    })}

    {/* leads output from publish */}
    <g>
      <line x1={cx(PUBLISH)} y1={SPINE + BOX_H / 2} x2={LEADS.x + LEADS.w / 2} y2={LEADS.cy - 11 - 7} stroke={INK_SOFT} strokeWidth={1.25} />
      <path d={`M ${LEADS.x + LEADS.w / 2 - 4} ${LEADS.cy - 11 - 14} L ${LEADS.x + LEADS.w / 2} ${LEADS.cy - 11 - 6} L ${LEADS.x + LEADS.w / 2 + 4} ${LEADS.cy - 11 - 14}`} fill="none" stroke={INK_SOFT} strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" />
      <rect x={LEADS.x} y={LEADS.cy - 16} width={LEADS.w} height={32} fill={PAPER} stroke={INK} strokeWidth={1.25} />
      <text x={LEADS.x + LEADS.w / 2} y={LEADS.cy - 1} textAnchor="middle" fontFamily={FONT} fontSize={11} letterSpacing="0.05em" fill={INK}>{LEADS.label.toUpperCase()}</text>
      <text x={LEADS.x + LEADS.w / 2} y={LEADS.cy + 13} textAnchor="middle" fontFamily={FONT} fontSize={8} letterSpacing="0.03em" fill={LABEL}>{LEADS.caption}</text>
    </g>

    {/* stage boxes (drawn last so they sit above connectors) */}
    {STAGES.map((s) => (<StageBox key={s.n} s={s} />))}

    {/* circulating signal dot */}
    {loop && (
      <motion.rect
        width={9}
        height={9}
        fill={SAGE}
        style={{ offsetPath: `path("${LOOP_PATH}")`, offsetRotate: '0deg' }}
        initial={{ offsetDistance: '0%' }}
        animate={{ offsetDistance: '100%' }}
        transition={{ duration: 7, repeat: Infinity, ease: 'linear' }}
      />
    )}
  </svg>
);

const EngineFlow: React.FC = () => {
  const reduced = prefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: '-12%' });
  const loop = !reduced && inView;
  return (
    <div ref={ref} className="w-full overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
      {/* min-width keeps the map legible on phones; the container scrolls x */}
      <div style={{ minWidth: 760 }}>
        <Scene loop={loop} />
      </div>
    </div>
  );
};

export default EngineFlow;
