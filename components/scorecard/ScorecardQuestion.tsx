import React from 'react';
import { motion } from 'framer-motion';

interface Props {
  preconditionNumber: string;
  preconditionTitle: string;
  subIndex: number;
  totalSubs: number;
  angle: string;
  question: string;
  scoreLabels: [string, string, string, string, string];
  value: number | null;
  onChange: (score: number) => void;
}

const ScorecardQuestion: React.FC<Props> = ({
  preconditionNumber,
  preconditionTitle,
  subIndex,
  totalSubs,
  angle,
  question,
  scoreLabels,
  value,
  onChange,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-paper border border-[color:var(--color-hairline)] shadow-card-subtle p-8 md:p-10"
    >
      {/* Precondition context bar */}
      <div className="flex items-center justify-between gap-3 mb-6 border-b border-[color:var(--color-hairline)] pb-4">
        <span className="font-mono text-xs uppercase tracking-[0.18em] text-ink-soft">
          {preconditionNumber} · {preconditionTitle}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute shrink-0">
          q{subIndex + 1} of {totalSubs}
        </span>
      </div>

      {/* Angle eyebrow */}
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute mb-3">
        {angle}
      </p>

      {/* Question */}
      <h2 className="text-2xl md:text-3xl font-semibold tracking-tight leading-tight mb-8">
        {question}
      </h2>

      <div className="flex flex-col gap-2">
        {scoreLabels.map((label, i) => {
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
