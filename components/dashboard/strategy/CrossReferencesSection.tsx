import React from 'react';
import { Compass } from 'lucide-react';
import PanelCard from '../shared/PanelCard';
import { useDashboard } from '../../../contexts/DashboardContext';
import type { Tab } from '../../../types/dashboard';

const refs: { tab: Tab; label: string; description: string }[] = [
  { tab: 'workflows', label: 'Workflows', description: 'n8n workflow status, schedules, errors, feature flags' },
  { tab: 'content', label: 'Content', description: 'Post generation pipeline, drafts, scheduled posts' },
  { tab: 'audience', label: 'Audience', description: 'Engagement analytics, top posts, audience growth' },
  { tab: 'outreach', label: 'Outreach', description: 'Per-prospect tactical actions, draft review queue, sending' },
  { tab: 'clients', label: 'Clients', description: 'Active client engagements, billing, project status' },
];

export const CrossReferencesSection: React.FC = () => {
  const { navigateToTab } = useDashboard();
  return (
    <PanelCard title="Cross-References" accent="cyan">
      <div className="space-y-2">
        <p className="text-[11px] text-zinc-500 flex items-center gap-1.5">
          <Compass className="w-3 h-3" />
          For things this Strategy Map intentionally does NOT cover:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {refs.map(r => (
            <button
              key={r.tab}
              onClick={() => navigateToTab(r.tab)}
              className="text-left bg-zinc-800/30 hover:bg-zinc-800/60 border border-zinc-700/30 hover:border-zinc-600/50 rounded-xl px-3 py-2 transition-colors"
            >
              <div className="text-sm text-zinc-200 font-medium">{r.label} →</div>
              <div className="text-[11px] text-zinc-500 mt-0.5">{r.description}</div>
            </button>
          ))}
        </div>
      </div>
    </PanelCard>
  );
};
