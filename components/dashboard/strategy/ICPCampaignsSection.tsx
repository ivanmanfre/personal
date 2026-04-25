import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import PanelCard from '../shared/PanelCard';
import { useDashboard } from '../../../contexts/DashboardContext';
import type { StrategyCampaignSummary } from '../../../types/dashboard';

interface Props {
  campaigns: StrategyCampaignSummary[];
  campaignsWithoutLM: string[];
}

export const ICPCampaignsSection: React.FC<Props> = ({ campaigns, campaignsWithoutLM }) => {
  const { navigateToTab } = useDashboard();
  const active = campaigns.filter(c => c.isActive);
  const inactive = campaigns.filter(c => !c.isActive);

  return (
    <PanelCard title="ICP & Active Campaigns" accent="blue">
      <div className="space-y-3">
        {/* Health summary */}
        <div className="flex items-center gap-3 text-xs flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${active.length === 5 ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span className="text-zinc-400">{active.length} active</span>
          </div>
          <span className="text-zinc-600">·</span>
          <span className="text-zinc-500">{inactive.length} deactivated</span>
          {campaignsWithoutLM.length > 0 && (
            <>
              <span className="text-zinc-600">·</span>
              <span className="text-red-400">{campaignsWithoutLM.length} without lead magnet</span>
            </>
          )}
        </div>

        {/* Active campaign cards */}
        <div className="space-y-2">
          {active.map(c => (
            <CampaignRow key={c.id} campaign={c} missingLM={campaignsWithoutLM.includes(c.name)} onClick={() => navigateToTab('outreach')} />
          ))}
        </div>

        {/* Inactive collapsible */}
        {inactive.length > 0 && (
          <DeactivatedAccordion campaigns={inactive} />
        )}
      </div>
    </PanelCard>
  );
};

const CampaignRow: React.FC<{ campaign: StrategyCampaignSummary; missingLM: boolean; onClick: () => void }> = ({ campaign, missingLM, onClick }) => {
  const [expanded, setExpanded] = useState(false);
  const c = campaign;
  const stages = c.prospectCounts;

  return (
    <div className={`border rounded-xl ${missingLM ? 'border-red-500/30 bg-red-500/5' : 'border-zinc-700/40 bg-zinc-800/30'}`}>
      <div className="px-3 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 text-left flex-1 min-w-0">
          {expanded ? <ChevronDown className="w-3 h-3 text-zinc-500 shrink-0" /> : <ChevronRight className="w-3 h-3 text-zinc-500 shrink-0" />}
          <span className="text-sm font-medium text-zinc-200 truncate">{c.name}</span>
          {missingLM && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/25 shrink-0">no LM</span>}
        </button>
        <div className="flex items-center gap-3 text-xs shrink-0">
          <StageDot label="enriched" count={stages.enriched} color="text-blue-400" />
          <StageDot label="warming" count={stages.warming} color="text-amber-400" />
          <StageDot label="engaged" count={stages.engaged} color="text-purple-400" />
          <StageDot label="conn" count={stages.connected} color="text-emerald-400" />
          <StageDot label="replied" count={stages.replied} color="text-emerald-300" />
          <button onClick={onClick} className="text-[10px] text-zinc-500 hover:text-cyan-400 transition-colors ml-2">
            outreach →
          </button>
        </div>
      </div>
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-zinc-700/30 text-[11px] text-zinc-500 space-y-1">
          <div><span className="text-zinc-400 font-medium">Titles:</span> {c.apolloTitles.join(', ') || '—'}</div>
          <div><span className="text-zinc-400 font-medium">Locations:</span> {c.apolloLocations.join(', ') || '—'}</div>
          <div><span className="text-zinc-400 font-medium">Sizes:</span> {c.apolloEmployeeRanges.join(', ') || '—'}</div>
          <div><span className="text-zinc-400 font-medium">Keywords:</span> {c.apolloKeywords.join(', ') || '—'}</div>
        </div>
      )}
    </div>
  );
};

const StageDot: React.FC<{ label: string; count: number; color: string }> = ({ label, count, color }) => (
  <div className="flex flex-col items-center" title={`${label}: ${count}`}>
    <span className={`text-sm font-mono font-semibold ${count > 0 ? color : 'text-zinc-600'}`}>{count}</span>
    <span className="text-[8px] text-zinc-600 leading-none">{label}</span>
  </div>
);

const DeactivatedAccordion: React.FC<{ campaigns: StrategyCampaignSummary[] }> = ({ campaigns }) => {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="text-[11px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1">
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        Deactivated ({campaigns.length})
      </button>
      {open && (
        <div className="mt-2 space-y-1 ml-4">
          {campaigns.map(c => (
            <div key={c.id} className="text-xs text-zinc-500">{c.name} <span className="text-zinc-600">({c.prospectCounts.archived} archived)</span></div>
          ))}
        </div>
      )}
    </div>
  );
};
