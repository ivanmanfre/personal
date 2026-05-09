// components/scan/ScoreBar.tsx
import React from 'react';
import { gradeColor } from '../../lib/scanApi';

interface Props {
  score: number;
  grade: string;
  size?: 'sm' | 'lg';
}

const SERIF = '"DM Serif Display", "Bodoni Moda", Georgia, serif';
const MONO = '"IBM Plex Mono", monospace';

export const ScoreBar: React.FC<Props> = ({ score, grade, size = 'sm' }) => {
  const color = gradeColor(grade);
  const big = size === 'lg';

  return (
    <div className="w-full">
      <div className="flex items-baseline gap-3 mb-3">
        <span
          style={{
            fontFamily: SERIF,
            fontWeight: 400,
            fontSize: big ? 'clamp(4rem, 9vw, 7rem)' : '3rem',
            lineHeight: 0.9,
            letterSpacing: '-0.03em',
            color,
          }}
        >
          {score}
        </span>
        <span
          style={{
            fontFamily: MONO,
            fontSize: big ? '12px' : '10px',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'rgba(26,26,26,0.7)', // bumped from 0.5 — 0.5 fails AA at 12px
          }}
        >
          / 100 · Grade <span style={{ color, fontWeight: 600 }}>{grade}</span>
        </span>
      </div>
      <div className="w-full" style={{ height: 1, background: 'rgba(26,26,26,0.08)' }}>
        <div
          className="transition-all duration-1000 ease-out"
          style={{ width: `${score}%`, height: '100%', background: color }}
        />
      </div>
    </div>
  );
};
