// components/scan/ScoreBar.tsx
import React, { useState, useEffect, useRef } from 'react';
import { animate, useInView, useReducedMotion, motion } from 'framer-motion';
import { gradeColor } from '../../lib/scanApi';

interface Props {
  score: number;
  grade: string;
  size?: 'sm' | 'lg';
}

const SERIF = '"DM Serif Display", "Bodoni Moda", Georgia, serif';
const MONO = '"IBM Plex Mono", monospace';
const EASE: [number, number, number, number] = [0.22, 0.84, 0.36, 1];

export const ScoreBar: React.FC<Props> = ({ score, grade, size = 'sm' }) => {
  const color = gradeColor(grade);
  const big = size === 'lg';
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const [displayed, setDisplayed] = useState(reduceMotion ? score : 0);
  const [filled, setFilled] = useState(reduceMotion ? score : 0);

  useEffect(() => {
    if (!inView || reduceMotion) return;
    const c1 = animate(0, score, {
      duration: 1.4,
      ease: EASE,
      onUpdate: (v) => setDisplayed(Math.round(v)),
    });
    const c2 = animate(0, score, {
      duration: 1.6,
      delay: 0.1,
      ease: EASE,
      onUpdate: (v) => setFilled(v),
    });
    return () => { c1.stop(); c2.stop(); };
  }, [inView, score, reduceMotion]);

  return (
    <div className="w-full" ref={ref}>
      <div className="flex items-baseline gap-3 mb-3">
        <span
          style={{
            fontFamily: SERIF,
            fontWeight: 400,
            fontSize: big ? 'clamp(4rem, 9vw, 7rem)' : '3rem',
            lineHeight: 0.9,
            letterSpacing: '-0.03em',
            color,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {displayed}
        </span>
        <motion.span
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={inView ? { opacity: 1 } : undefined}
          transition={{ duration: 0.6, delay: 0.5, ease: EASE }}
          style={{
            fontFamily: MONO,
            fontSize: big ? '12px' : '10px',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'rgba(26,26,26,0.7)',
          }}
        >
          / 100 · Grade <span style={{ color, fontWeight: 600 }}>{grade}</span>
        </motion.span>
      </div>
      <div className="w-full" style={{ height: 1, background: 'rgba(26,26,26,0.08)' }}>
        <div
          style={{ width: `${filled}%`, height: '100%', background: color, transition: reduceMotion ? 'none' : undefined }}
        />
      </div>
    </div>
  );
};
