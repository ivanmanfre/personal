import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { serpentineLayout } from './landing/diagrams/layout';
import { DiagramNode } from './landing/diagrams/DiagramSvg';
import { DIAGRAM, prefersReducedMotion } from './landing/diagrams/tokens';

// Hero live artifact (design-elevation B1): show a system RUNNING in the first
// viewport instead of asserting it. The Lead Magnet System — one typed idea
// assembles into the full package (page, email, link, post), looping. Built in
// the brand's §5d diagram language: mono nodes, one sage signal path, tick-to-
// done squares. Reduced-motion users get the fully-assembled static state.
const OUTPUTS = ['PAGE', 'EMAIL', 'LINK', 'POST'];
const IDEAS = ['ai cost calculator', 'roi benchmark quiz', 'onboarding audit'];
const ease = [0.22, 0.84, 0.36, 1] as const;

const HeroArtifact: React.FC = () => {
  const reduced = prefersReducedMotion();
  const layout = useMemo(() => serpentineLayout(OUTPUTS, 280, 196), []);
  const [done, setDone] = useState(reduced ? OUTPUTS.length : 0);
  const [cycle, setCycle] = useState(0);
  const [typed, setTyped] = useState(reduced ? IDEAS[0] : '');

  useEffect(() => {
    if (reduced) return;
    const idea = IDEAS[cycle % IDEAS.length];
    const timers: ReturnType<typeof setTimeout>[] = [];
    setTyped('');
    setDone(0);
    for (let i = 1; i <= idea.length; i++) {
      timers.push(setTimeout(() => setTyped(idea.slice(0, i)), 34 * i));
    }
    const typeDone = 34 * idea.length + 320;
    for (let n = 1; n <= OUTPUTS.length; n++) {
      timers.push(setTimeout(() => setDone(n), typeDone + 500 * n));
    }
    timers.push(setTimeout(() => setCycle((c) => c + 1), typeDone + 500 * OUTPUTS.length + 1400));
    return () => timers.forEach(clearTimeout);
  }, [cycle, reduced]);

  const mono: React.CSSProperties = {
    fontFamily: DIAGRAM.font,
    fontSize: 11,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: DIAGRAM.label,
  };

  return (
    <div
      className="mx-auto w-full"
      style={{ maxWidth: 380, border: '1px solid rgba(26,26,26,0.12)', backgroundColor: 'var(--color-paper)', padding: '20px 22px 22px' }}
    >
      {/* status row */}
      <div className="flex items-center justify-between" style={{ ...mono, marginBottom: 16 }}>
        <span className="flex items-center gap-2">
          <motion.span
            animate={reduced ? undefined : { opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.6, repeat: Infinity }}
            style={{ width: 6, height: 6, backgroundColor: DIAGRAM.sage, display: 'inline-block', flexShrink: 0 }}
            aria-hidden="true"
          />
          From one idea
        </span>
        <span style={{ color: 'var(--color-accent-ink)' }}>Lead Magnet System</span>
      </div>

      {/* typed idea */}
      <div style={{ fontFamily: '"Source Serif 4", Georgia, serif', fontSize: 19, color: '#1A1A1A', minHeight: 30, marginBottom: 16, lineHeight: 1.3 }}>
        &ldquo;{typed}
        {!reduced && (
          <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity }} style={{ color: DIAGRAM.sage }}>
            ▏
          </motion.span>
        )}
        &rdquo;
      </div>

      {/* assembly diagram */}
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        width="100%"
        style={{ display: 'block', overflow: 'visible' }}
        role="img"
        aria-label="One typed idea assembles into a landing page, email, smart link, and scheduled post"
      >
        <path d={layout.pathD} stroke={DIAGRAM.connector} strokeWidth={DIAGRAM.nodeStroke} fill="none" />
        <motion.path
          key={cycle}
          d={layout.pathD}
          stroke={DIAGRAM.sage}
          strokeWidth={DIAGRAM.signalStroke}
          fill="none"
          initial={reduced ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: OUTPUTS.length * 0.5, ease: 'linear', delay: reduced ? 0 : 0.9 }}
        />
        {layout.nodes.map((n, i) => (
          <DiagramNode key={n.label} node={n} ticked={i < done} />
        ))}
      </svg>

      {/* receipt */}
      <div style={{ ...mono, color: 'var(--color-accent-ink)', marginTop: 18 }}>
        15 min · idea to launched
      </div>
    </div>
  );
};

export default HeroArtifact;
