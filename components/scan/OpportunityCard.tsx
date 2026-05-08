// components/scan/OpportunityCard.tsx
import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Opportunity } from '../../lib/scanTypes';

interface Props {
  opportunity: Opportunity;
  index: number;
}

export const OpportunityCard: React.FC<Props> = ({ opportunity, index }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-[color:var(--color-hairline)] rounded-lg overflow-hidden bg-paper-raise">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-start justify-between p-5 text-left hover:bg-paper-sunk/40 transition-colors"
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className="text-xs font-mono text-ink-mute mt-0.5 shrink-0">
            #{index + 1}
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-ink text-sm leading-snug">{opportunity.title}</p>
            <p className="text-xs text-ink-mute mt-1">
              Source: {opportunity.signal_source}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 ml-4 shrink-0">
          <span className="text-xs font-mono text-accent font-medium hidden sm:block">
            ~{opportunity.estimated_weekly_hours}h/wk
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-ink-mute" />
          ) : (
            <ChevronDown className="w-4 h-4 text-ink-mute" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-[color:var(--color-hairline)] space-y-4">
          <div className="pt-4">
            <p className="text-xs uppercase tracking-wider text-ink-mute font-medium mb-1.5">Evidence</p>
            <p className="text-sm text-ink-soft leading-relaxed italic">"{opportunity.evidence}"</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-ink-mute font-medium mb-1.5">What automation replaces</p>
            <p className="text-sm text-ink-soft leading-relaxed">{opportunity.automation_solution}</p>
          </div>
          <div className="flex gap-4 flex-wrap">
            <div className="bg-accent-soft rounded-md px-3 py-2">
              <p className="text-xs text-ink-mute">Weekly hours saved</p>
              <p className="font-bold text-accent text-sm">{opportunity.estimated_weekly_hours}h</p>
            </div>
            <div className="bg-accent-soft rounded-md px-3 py-2">
              <p className="text-xs text-ink-mute">Monthly cost estimate</p>
              <p className="font-bold text-accent text-sm">
                ${opportunity.estimated_monthly_cost.toLocaleString()}
              </p>
            </div>
            <div className="bg-accent-soft rounded-md px-3 py-2 flex-1 min-w-[180px]">
              <p className="text-xs text-ink-mute">ROI estimate</p>
              <p className="font-bold text-accent text-sm">{opportunity.roi_estimate}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
