import React from 'react';
import { motion } from 'framer-motion';
import type { UpworkPipelineStats } from '../../../types/dashboard';

interface Props {
  stats: UpworkPipelineStats;
}

const stages = [
  { key: 'totalJobs', label: 'Scanned', color: 'from-zinc-500 to-zinc-600', text: 'text-zinc-300' },
  { key: 'assessed', label: 'Assessed', color: 'from-blue-500 to-blue-600', text: 'text-blue-300' },
  { key: 'drafted', label: 'Drafted', color: 'from-purple-500 to-purple-600', text: 'text-purple-300' },
  { key: 'pendingApproval', label: 'Review', color: 'from-amber-500 to-amber-600', text: 'text-amber-300' },
  { key: 'submitted', label: 'Submitted', color: 'from-green-500 to-green-600', text: 'text-green-300' },
  { key: 'won', label: 'Won', color: 'from-emerald-400 to-emerald-500', text: 'text-emerald-300' },
] as const;

export const UpworkFunnel: React.FC<Props> = ({ stats }) => {
  const values = stages.map((s) => (stats as any)[s.key] as number || 0);
  const max = Math.max(...values, 1);

  return (
    <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl shadow-sm shadow-black/10 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">Pipeline Funnel</span>
        <span className="text-[10px] text-zinc-600">
          {values[0]} scanned → {values[values.length - 1]} won
        </span>
      </div>
      <div className="flex items-end gap-1 h-16">
        {stages.map((stage, i) => {
          const value = values[i];
          const pct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 8 : 2) : 2;
          const convRate = i > 0 && values[i - 1] > 0
            ? Math.round((value / values[i - 1]) * 100)
            : null;

          return (
            <div key={stage.key} className="flex-1 flex flex-col items-center gap-1">
              {/* Value */}
              <span className={`text-xs font-bold ${stage.text}`}>{value}</span>
              {/* Bar */}
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${pct}%` }}
                transition={{ type: 'spring', stiffness: 300, damping: 25, delay: i * 0.05 }}
                className={`w-full rounded-t bg-gradient-to-t ${stage.color} opacity-80`}
                style={{ minHeight: 2 }}
              />
              {/* Label + conversion */}
              <div className="text-center">
                <span className="text-[9px] text-zinc-500 block">{stage.label}</span>
                {convRate != null && (
                  <span className="text-[8px] text-zinc-600">{convRate}%</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
