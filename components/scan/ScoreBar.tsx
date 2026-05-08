// components/scan/ScoreBar.tsx
import React from 'react';
import { gradeColor } from '../../lib/scanApi';

interface Props {
  score: number;
  grade: string;
  size?: 'sm' | 'lg';
}

export const ScoreBar: React.FC<Props> = ({ score, grade, size = 'sm' }) => {
  const color = gradeColor(grade);
  const barHeight = size === 'lg' ? 'h-3' : 'h-2';
  const textSize = size === 'lg' ? 'text-4xl' : 'text-2xl';

  return (
    <div className="w-full">
      <div className="flex items-end justify-between mb-2">
        <span
          className={`font-bold font-display leading-none ${textSize}`}
          style={{ color }}
        >
          {score}
          <span className="text-sm font-normal text-ink-soft ml-1">/100</span>
        </span>
        <span
          className="text-sm font-mono font-bold px-2 py-0.5 rounded"
          style={{ color, background: `${color}18` }}
        >
          Grade: {grade}
        </span>
      </div>
      <div className="w-full bg-[color:var(--color-paper-sunk)] rounded-full overflow-hidden" style={{ height: size === 'lg' ? 12 : 8 }}>
        <div
          className={`${barHeight} rounded-full transition-all duration-1000 ease-out`}
          style={{ width: `${score}%`, background: color }}
        />
      </div>
    </div>
  );
};
