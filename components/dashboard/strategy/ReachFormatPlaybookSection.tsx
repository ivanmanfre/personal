import React, { useState } from 'react';
import { Radio, ChevronDown, ChevronRight } from 'lucide-react';
import PanelCard from '../shared/PanelCard';
import {
  reachFormatMeta,
  reachFormatVerdicts,
  reachFormatTable,
  reachLevers,
  reachFormatWeeklyMix,
  reachFormatHygiene,
  type ReachGrade,
} from '../../../lib/strategyConfig';

const GRADE_TEXT: Record<ReachGrade, string> = {
  CONFIRMED: 'text-emerald-400',
  PLAUSIBLE: 'text-amber-400',
  'VENDOR-ONLY': 'text-zinc-500',
};

export const ReachFormatPlaybookSection: React.FC = () => {
  const [showHygiene, setShowHygiene] = useState(false);

  return (
    <PanelCard title="2026 Reach & Format Playbook" accent="cyan">
      <div className="p-4 space-y-4">
        <p className="text-[11px] text-zinc-500">
          What actually moves reach in 2026, verified against primary sources. Updated {reachFormatMeta.updated}.
          Anchor: {reachFormatMeta.source}.
        </p>

        {/* The two verdicts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {reachFormatVerdicts.map(v => (
            <div key={v.q} className="bg-zinc-900/40 border border-zinc-800/40 rounded-lg p-2.5">
              <p className="text-[11px] font-bold text-zinc-300 mb-1">{v.q}</p>
              <p className="text-[11px] text-zinc-400 leading-snug">{v.a}</p>
            </div>
          ))}
        </div>

        {/* Format table (Metricool 2026, personal profiles) */}
        <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-lg p-2.5">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-1.5">
            Personal-profile formats · impressions / engagement (Metricool 2026)
          </p>
          <div className="space-y-1">
            {reachFormatTable.map(r => (
              <div key={r.format} className="flex items-center gap-2 text-[11px]">
                <span className="flex-1 text-zinc-300 truncate">{r.format}</span>
                <span className="font-mono text-zinc-400 w-16 text-right">{r.impressions}</span>
                <span className="font-mono text-zinc-500 w-14 text-right">{r.engagement}</span>
                <span className="w-16 text-right text-[9px] uppercase tracking-wider">
                  {r.best === 'reach' && <span className="text-emerald-400">reach</span>}
                  {r.best === 'engagement' && <span className="text-amber-400">eng</span>}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Ranked levers */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-1.5">Levers, by evidence</p>
          <div className="space-y-1.5">
            {reachLevers.map(l => (
              <div key={l.lever} className="text-[11px]">
                <div className="flex items-baseline gap-2">
                  <span className="text-zinc-300">{l.lever}</span>
                  <span className={`text-[9px] font-mono uppercase tracking-wider shrink-0 ml-auto ${GRADE_TEXT[l.grade]}`}>
                    {l.grade}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 leading-snug">{l.detail}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Weekly mix */}
        <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-lg p-2.5">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-1.5">
            Prescribed weekly mix (4 posts)
          </p>
          <ul className="space-y-1">
            {reachFormatWeeklyMix.map(m => (
              <li key={m} className="text-[11px] text-zinc-300 flex gap-2">
                <span className="text-cyan-500 shrink-0">→</span>
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Hygiene (collapsed) */}
        <div>
          <button
            onClick={() => setShowHygiene(!showHygiene)}
            className="w-full flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-500 font-medium hover:text-zinc-400 transition-colors"
          >
            {showHygiene ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            Hygiene flags (stale/fake data to distrust)
          </button>
          {showHygiene && (
            <ul className="space-y-1 mt-1.5 pl-5">
              {reachFormatHygiene.map(h => (
                <li key={h} className="text-[10px] text-zinc-500 leading-snug list-disc">{h}</li>
              ))}
            </ul>
          )}
        </div>

        <code className="text-[9px] text-zinc-600 font-mono block truncate" title={reachFormatMeta.docPath}>
          {reachFormatMeta.docPath}
        </code>
      </div>
    </PanelCard>
  );
};
