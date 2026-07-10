// components/scan/ScoreBar.tsx
// Black Box score plate: flat ink numerals inside a 1px ink box, plus a segmented
// scale in flat ink (no color grade scale — red is reserved for the wordmark).
// Renders the score immediately. Animation is decoration only.
import React, { useState, useEffect, useRef } from 'react';
import { animate, useInView, useReducedMotion } from 'framer-motion';

interface Props {
  score: number;
  grade: string;
  size?: 'sm' | 'lg';
}

const GROTESK = '"Schibsted Grotesk", system-ui, -apple-system, sans-serif';
const INK = '#131210';
const MUTED = '#6B675E';
const EASE: [number, number, number, number] = [0.22, 0.84, 0.36, 1];
const SEGMENTS = 5;

export const ScoreBar: React.FC<Props> = ({ score, grade, size = 'sm' }) => {
  const big = size === 'lg';
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-20px' });

  // Always render the real score. Animation is OPTIONAL polish.
  const [displayed, setDisplayed] = useState(score);
  const animationStarted = useRef(false);
  const filledSegments = Math.max(0, Math.min(SEGMENTS, Math.round((score / 100) * SEGMENTS)));

  useEffect(() => {
    if (animationStarted.current || reduceMotion || !inView) return;
    animationStarted.current = true;
    setDisplayed(0);
    const c1 = animate(0, score, {
      duration: 0.4,
      ease: EASE,
      onUpdate: (v) => setDisplayed(Math.round(v)),
      onComplete: () => setDisplayed(score),
    });
    return () => { c1.stop(); };
  }, [inView, score, reduceMotion]);

  return (
    <div className="w-full" ref={ref}>
      {/* Score plate */}
      <div
        style={{
          border: `1px solid ${INK}`,
          padding: big ? 'clamp(14px,1.8vw,18px) clamp(16px,2vw,20px)' : '12px 14px',
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 14,
        }}
      >
        <span
          style={{
            fontFamily: GROTESK,
            fontWeight: 800,
            fontSize: big ? 'clamp(44px, 6vw, 64px)' : '2.75rem',
            lineHeight: 0.9,
            letterSpacing: '-0.035em',
            color: INK,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {displayed}
          <span style={{ fontSize: '0.42em', fontWeight: 700, color: MUTED, letterSpacing: 0 }}>/100</span>
        </span>
        <span
          style={{
            fontFamily: GROTESK,
            fontWeight: 800,
            fontSize: big ? 'clamp(30px, 4vw, 44px)' : '2rem',
            lineHeight: 1,
            letterSpacing: '-0.02em',
            color: INK,
          }}
        >
          {grade}
        </span>
      </div>
      {/* Segmented scale — flat ink */}
      <div style={{ marginTop: 10, display: 'flex', height: 8, border: `1px solid ${INK}` }}>
        {Array.from({ length: SEGMENTS }).map((_, i) => (
          <span
            key={i}
            style={{
              flex: 1,
              borderRight: i < SEGMENTS - 1 ? `1px solid ${INK}` : 'none',
              background: i < filledSegments ? INK : 'transparent',
            }}
          />
        ))}
      </div>
    </div>
  );
};
