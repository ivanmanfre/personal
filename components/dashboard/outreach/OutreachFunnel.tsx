import React from 'react';
import { motion } from 'framer-motion';
import type { OutreachPipelineStats } from '../../../types/dashboard';

interface Props {
  stats: OutreachPipelineStats;
  onStageClick?: (stage: string) => void;
}

const stages = [
  { key: 'enriched', label: 'Enriched', color: 'from-blue-500 to-blue-600', text: 'text-blue-300' },
  { key: 'warming', label: 'Warming', color: 'from-amber-500 to-amber-600', text: 'text-amber-300' },
  { key: 'engaged', label: 'Engaged', color: 'from-purple-500 to-purple-600', text: 'text-purple-300' },
  { key: 'connectionSent', label: 'Conn. Sent', color: 'from-cyan-500 to-cyan-600', text: 'text-cyan-300' },
  { key: 'connected', label: 'Connected', color: 'from-emerald-500 to-emerald-600', text: 'text-emerald-300' },
  { key: 'dmSent', label: 'DM Sent', color: 'from-pink-500 to-pink-600', text: 'text-pink-300' },
  { key: 'replied', label: 'Replied', color: 'from-emerald-400 to-emerald-500', text: 'text-emerald-300' },
  { key: 'converted', label: 'Converted', color: 'from-yellow-400 to-yellow-500', text: 'text-yellow-300' },
] as const;

const stageFilterMap: Record<string, string> = {
  enriched: 'enriched',
  warming: 'warming',
  engaged: 'engaged',
  connectionSent: 'connection_sent',
  connected: 'connected',
  dmSent: 'dm_sent',
  replied: 'replied',
  converted: 'converted',
};

export const OutreachFunnel: React.FC<Props> = ({ stats, onStageClick }) => {
  const snapshot = stages.map((s) => (stats as any)[s.key] as number || 0);
  const values = snapshot.map((_, i) => snapshot.slice(i).reduce((a, b) => a + b, 0));
  const max = Math.max(...values, 1);

  return (
    <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl shadow-sm shadow-black/10 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">Pipeline Funnel</span>
        <span className="text-[10px] text-zinc-600">
          Cumulative — {values[0]} entered → {stats.replied + stats.converted} replied
        </span>
      </div>
      <div className="flex items-end gap-1 h-20">
        {stages.map((stage, i) => {
          const value = values[i];
          const pct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 8 : 2) : 2;
          const convRate = i > 0 && values[i - 1] > 0
            ? Math.round((value / values[i - 1]) * 100)
            : null;

          return (
            <div
              key={stage.key}
              className={`flex-1 flex flex-col items-center gap-1 ${onStageClick ? 'cursor-pointer hover:opacity-80' : ''}`}
              onClick={() => onStageClick?.(stageFilterMap[stage.key])}
            >
              <span className={`text-xs font-bold ${stage.text}`}>{value}</span>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${pct}%` }}
                transition={{ type: 'spring', stiffness: 300, damping: 25, delay: i * 0.05 }}
                className={`w-full rounded-t bg-gradient-to-t ${stage.color} opacity-80`}
                style={{ minHeight: 2 }}
              />
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
