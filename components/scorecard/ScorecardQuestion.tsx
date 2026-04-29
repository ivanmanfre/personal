import React from 'react';
import { motion } from 'framer-motion';
import type { Precondition } from '../../lib/preconditions';

interface Props {
  precondition: Precondition;
  index: number;
  total: number;
  value: number | null;
  onChange: (score: number) => void;
}

const ScorecardQuestion: React.FC<Props> = ({ precondition, index, total, value, onChange }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-paper border border-[color:var(--color-hairline)] shadow-card-subtle p-8 md:p-10"
    >
      <div className="flex items-center gap-3 mb-6 border-b border-[color:var(--color-hairline)] pb-4">
        <span className="font-mono text-xs uppercase tracking-[0.18em] text-ink-mute">
          {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </span>
        <span className="font-mono text-xs uppercase tracking-[0.16em] text-ink-soft">
          {precondition.title}
        </span>
      </div>

      <h2 className="text-2xl md:text-3xl font-semibold tracking-tight leading-tight mb-8">
        {precondition.question}
      </h2>

      <div className="flex flex-col gap-2">
        {precondition.scoreLabels.map((label, i) => {
          const score = i + 1;
          const selected = value === score;
          return (
            <button
              key={score}
              type="button"
              onClick={() => onChange(score)}
              className={`
                w-full text-left px-5 py-4 min-h-[56px] border transition-all
                flex items-center gap-4
                ${selected
                  ? 'bg-accent text-white border-accent shadow-card-subtle'
                  : 'bg-paper border-[color:var(--color-hairline-bold)] hover:border-accent hover:bg-paper-sunk text-ink-soft'
                }
              `}
            >
              <span className={`font-mono text-xs uppercase tracking-[0.18em] shrink-0 ${selected ? 'text-white/70' : 'text-ink-mute'}`}>
                {score}
              </span>
              <span className={`text-base font-medium ${selected ? 'text-white' : 'text-ink-soft'}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
};

export default ScorecardQuestion;
