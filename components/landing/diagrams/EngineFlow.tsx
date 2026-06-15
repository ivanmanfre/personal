import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { DIAGRAM, prefersReducedMotion } from './tokens';

// ─── EngineFlow v4 — the system as a live production line ─────────────────────
// Bigger and more alive than a static node diagram: real content artifacts (a
// post, a carousel, a video, a lead magnet) are produced by the engine and
// travel the pipeline, each gets stamped by the ANTI-SLOP QA gate as it passes,
// publishes, and the lead magnets feed a leads tray that fills. Drawn in SVG so
// it scales crisply and stays in the brand diagram language (sharp shapes, 1px
// ink, paper fill, sage as the one signal/accent).
//
// prefers-reduced-motion / capture → a composed static frame (artifacts placed
// along the line, QA-stamped, leads shown), no loop.

const ease = [0.22, 0.84, 0.36, 1] as const;
const SAGE = DIAGRAM.sage;
const INK = '#1A1A1A';
const INK_SOFT = 'rgba(26,26,26,0.32)';
const LABEL = '#5A5752';
const FONT = '"IBM Plex Mono", monospace';

// pipeline geometry (viewBox 1200 × 470)
const LANE = 232;          // baseline y
const X_START = 312;       // artifacts spawn just after the engine
const X_QA = 612;          // QA gate centre
const X_END = 858;         // publish
const TRAVEL = 4.2;        // seconds per artifact
const STAGGER = 1.05;      // seconds between artifacts
const QA_FRAC = (X_QA - X_START) / (X_END - X_START);

// ─── artifact glyphs (mini content, drawn in SVG) ────────────────────────────
const ArtPost: React.FC = () => (
  <g>
    <rect x={-46} y={-34} width={92} height={68} fill={DIAGRAM.paper} stroke={INK} strokeWidth={1.25} />
    <circle cx={-30} cy={-18} r={7} fill="none" stroke={INK} strokeWidth={1.25} />
    <rect x={-18} y={-22} width={50} height={3} fill={INK_SOFT} />
    <rect x={-18} y={-14} width={34} height={3} fill={INK_SOFT} />
    <rect x={-34} y={2} width={68} height={3} fill={INK_SOFT} />
    <rect x={-34} y={10} width={60} height={3} fill={INK_SOFT} />
    <rect x={-34} y={18} width={40} height={3} fill={SAGE} />
  </g>
);
const ArtCarousel: React.FC = () => (
  <g>
    <rect x={-38} y={-30} width={64} height={64} fill={DIAGRAM.paper} stroke={INK_SOFT} strokeWidth={1} />
    <rect x={-46} y={-36} width={64} height={64} fill={DIAGRAM.paper} stroke={INK_SOFT} strokeWidth={1} />
    <rect x={-54} y={-42} width={64} height={64} fill={DIAGRAM.paper} stroke={INK} strokeWidth={1.25} />
    <rect x={-46} y={-30} width={48} height={4} fill={SAGE} />
    <rect x={-46} y={-18} width={40} height={3} fill={INK_SOFT} />
    <rect x={-46} y={6} width={30} height={3} fill={INK_SOFT} />
  </g>
);
const ArtVideo: React.FC = () => (
  <g>
    <rect x={-48} y={-30} width={96} height={60} fill={DIAGRAM.paper} stroke={INK} strokeWidth={1.25} />
    <path d="M -8 -10 L 12 0 L -8 10 Z" fill={SAGE} />
    <rect x={-40} y={20} width={50} height={3} fill={INK_SOFT} />
  </g>
);
const ArtLeadMagnet: React.FC = () => (
  <g>
    <rect x={-32} y={-38} width={64} height={76} fill={DIAGRAM.paper} stroke={INK} strokeWidth={1.25} />
    <rect x={-22} y={-28} width={44} height={4} fill={INK} />
    <rect x={-22} y={-16} width={44} height={3} fill={INK_SOFT} />
    <rect x={-22} y={-8} width={36} height={3} fill={INK_SOFT} />
    <rect x={-22} y={14} width={44} height={10} fill="none" stroke={SAGE} strokeWidth={1.5} />
  </g>
);
const GLYPHS = [ArtPost, ArtCarousel, ArtVideo, ArtLeadMagnet];
const GLYPH_LABEL = ['POST', 'CAROUSEL', 'VIDEO', 'LEAD MAGNET'];
const LANES = [-2, -40, 40, -2]; // small vertical offset per artifact so overlaps read

// sage QA check badge that rides on each artifact
const Check: React.FC<{ on: boolean; loop: boolean; delay: number }> = ({ on, loop, delay }) => (
  <motion.g
    initial={false}
    animate={loop ? { opacity: [0, 0, 1, 1, 0], scale: [0.5, 0.5, 1, 1, 1] } : { opacity: on ? 1 : 0, scale: on ? 1 : 0.5 }}
    transition={loop ? { duration: TRAVEL, repeat: Infinity, delay, times: [0, QA_FRAC - 0.02, QA_FRAC + 0.04, 0.92, 1], ease: 'linear' } : { duration: 0 }}
    style={{ transformOrigin: 'center' }}
  >
    <circle cx={40} cy={-40} r={11} fill={SAGE} />
    <path d="M 35 -40 L 39 -36 L 46 -45" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </motion.g>
);

// one traveling artifact
const Traveler: React.FC<{ i: number; loop: boolean }> = ({ i, loop }) => {
  const Glyph = GLYPHS[i];
  const y = LANE + LANES[i];
  const delay = i * STAGGER;
  if (!loop) {
    // static composed frame: place the 4 artifacts across the line
    const xs = [380, X_QA, 720, X_END - 20];
    return (
      <g transform={`translate(${xs[i]}, ${y})`}>
        <Glyph />
        {xs[i] >= X_QA && <Check on loop={false} delay={0} />}
      </g>
    );
  }
  return (
    <motion.g
      initial={false}
      animate={{ x: [X_START, X_END], opacity: [0, 1, 1, 1, 0] }}
      transition={{
        x: { duration: TRAVEL, repeat: Infinity, delay, ease: 'linear' },
        opacity: { duration: TRAVEL, repeat: Infinity, delay, times: [0, 0.08, 0.85, 0.93, 1], ease: 'linear' },
      }}
    >
      {/* glyph drawn around (0,0); base lane y via inner translate, x driven by motion */}
      <g transform={`translate(0, ${y})`}>
        <Glyph />
        <Check on loop={loop} delay={delay} />
        <text x={0} y={56} textAnchor="middle" fontFamily={FONT} fontSize={9} letterSpacing="0.12em" fill={LABEL}>{GLYPH_LABEL[i]}</text>
      </g>
    </motion.g>
  );
};

// labelled anchor box on the line
const Anchor: React.FC<{ x: number; label: string; sub?: string; signature?: boolean }> = ({ x, label, sub, signature }) => {
  const w = Math.ceil(label.length * 7.4) + 26;
  return (
    <g transform={`translate(${x - w / 2}, ${LANE - 17})`}>
      <rect width={w} height={34} fill={DIAGRAM.paper} stroke={signature ? INK : INK} strokeWidth={signature ? 1.75 : 1.25} />
      <text x={w / 2} y={17} dominantBaseline="central" textAnchor="middle" fontFamily={FONT} fontSize={11} letterSpacing="0.07em" fill={INK}>{label.toUpperCase()}</text>
      {sub && <text x={w / 2} y={48} textAnchor="middle" fontFamily={FONT} fontSize={9} letterSpacing="0.05em" fill={signature ? '#1F6B4B' : LABEL}>{sub}</text>}
    </g>
  );
};

// voice waveform at the origin
const Waveform: React.FC<{ loop: boolean }> = ({ loop }) => {
  const bars = [10, 20, 32, 16, 26, 12, 22, 30, 14];
  return (
    <g transform={`translate(70, ${LANE})`}>
      {bars.map((h, i) => (
        <motion.rect
          key={i}
          x={i * 7 - 30}
          width={3.5}
          fill={SAGE}
          initial={false}
          animate={loop ? { height: [h * 0.4, h, h * 0.5, h * 0.9, h * 0.4], y: [-h * 0.2, -h / 2, -h * 0.25, -h * 0.45, -h * 0.2] } : { height: h, y: -h / 2 }}
          transition={loop ? { duration: 1.4, repeat: Infinity, delay: i * 0.08, ease: 'easeInOut' } : { duration: 0 }}
        />
      ))}
      <text x={5} y={42} textAnchor="middle" fontFamily={FONT} fontSize={9} letterSpacing="0.08em" fill={LABEL}>YOUR VOICE</text>
    </g>
  );
};

// leads tray that fills near the dashboard
const LeadsTray: React.FC<{ loop: boolean }> = ({ loop }) => {
  const dots = Array.from({ length: 8 }, (_, i) => ({ x: 1010 + (i % 4) * 22, y: LANE - 14 + Math.floor(i / 4) * 22 }));
  return (
    <g>
      <text x={1043} y={LANE - 34} textAnchor="middle" fontFamily={FONT} fontSize={11} letterSpacing="0.07em" fill={INK}>LEADS</text>
      {dots.map((d, i) => (
        <motion.rect
          key={i}
          x={d.x}
          y={d.y}
          width={11}
          height={11}
          fill={SAGE}
          initial={false}
          animate={loop ? { opacity: [0, 0, 1, 1, 0] } : { opacity: 1 }}
          transition={loop ? { duration: TRAVEL * 2, repeat: Infinity, delay: 1 + i * 0.34, times: [0, 0.2, 0.34, 0.9, 1], ease: 'linear' } : { duration: 0 }}
        />
      ))}
      <text x={1043} y={LANE + 44} textAnchor="middle" fontFamily={FONT} fontSize={9} letterSpacing="0.05em" fill={LABEL}>captured</text>
    </g>
  );
};

const Scene: React.FC<{ loop: boolean }> = ({ loop }) => (
  <svg viewBox="0 0 1200 470" width="100%" style={{ display: 'block', overflow: 'visible' }} role="img" aria-label="The content engine as a production line: your voice feeds an idea engine that produces a post, a carousel, a video and a lead magnet; each travels the pipeline and is stamped by an anti-slop QA gate, publishes, and the lead magnets fill a leads tray on your dashboard.">
    {/* baseline pipeline */}
    <line x1={150} y1={LANE} x2={980} y2={LANE} stroke={DIAGRAM.connector} strokeWidth={1.25} />
    <line x1={X_START} y1={LANE} x2={X_END} y2={LANE} stroke={SAGE} strokeWidth={1.5} opacity={0.4} />

    {/* origin */}
    <Waveform loop={loop} />
    <Anchor x={232} label="Idea engine" sub="what to post" />

    {/* QA gate straddling the line — the moat */}
    <Anchor x={X_QA} label="Anti-slop QA" sub="no AI slop" signature />

    {/* publish + calendar hint */}
    <Anchor x={X_END + 36} label="Publish" sub="daily" />
    {/* mini calendar dots above publish */}
    {Array.from({ length: 6 }).map((_, i) => (
      <motion.rect key={i} x={X_END + 10 + (i % 3) * 14} y={LANE - 70 + Math.floor(i / 3) * 14} width={9} height={9} fill={i === 4 ? SAGE : 'none'} stroke={SAGE} strokeWidth={1} opacity={0.55} />
    ))}

    {/* leads */}
    <LeadsTray loop={loop} />

    {/* traveling artifacts (drawn last so they ride above the line) */}
    {GLYPHS.map((_, i) => (<Traveler key={i} i={i} loop={loop} />))}
  </svg>
);

const EngineFlow: React.FC = () => {
  const reduced = prefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: '-12%' });
  const loop = !reduced && inView;
  return (
    <div ref={ref} className="w-full overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
      {/* min-width keeps the line legible on phones; the container scrolls x */}
      <div style={{ minWidth: 720 }}>
        <Scene loop={loop} />
      </div>
    </div>
  );
};

export default EngineFlow;
