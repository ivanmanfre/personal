import React, { useState, useMemo } from 'react';
import { Target, Users, Zap, MessageSquare, TrendingUp, Activity, AlertTriangle, Clock, Search, Send, Eye, BookOpen, ChevronDown, ChevronRight, Info } from 'lucide-react';
import { useOutreachPipeline } from '../../hooks/useOutreachPipeline';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import StatCard from './shared/StatCard';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import EmptyState from './shared/EmptyState';
import PanelCard from './shared/PanelCard';
import FilterBar from './shared/FilterBar';
import { timeAgo } from './shared/utils';
import { OutreachFunnel } from './outreach/OutreachFunnel';
import { ProspectDetailModal } from './outreach/ProspectDetailModal';
import { CampaignManager } from './outreach/CampaignManager';
import type { OutreachProspect } from '../../types/dashboard';

const stageColors: Record<string, string> = {
  identified: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  enriched: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  warming: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  engaged: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  connection_sent: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  connected: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  dm_sent: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  replied: 'bg-emerald-500/25 text-emerald-300 border-emerald-500/40',
  converted: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  archived: 'bg-zinc-500/15 text-zinc-500 border-zinc-600/30',
};

const allStages = ['identified', 'enriched', 'warming', 'engaged', 'connection_sent', 'connected', 'dm_sent', 'replied', 'converted', 'archived'];

function icpColor(score: number | null): string {
  if (score == null) return 'text-zinc-500';
  if (score >= 8) return 'text-emerald-400';
  if (score >= 6) return 'text-amber-400';
  return 'text-red-400';
}

function icpDot(score: number | null): string {
  if (score == null) return 'bg-zinc-500';
  if (score >= 8) return 'bg-emerald-400';
  if (score >= 6) return 'bg-amber-400';
  return 'bg-red-400';
}

const actionTypeIcons: Record<string, string> = {
  profile_view: 'Viewed profile',
  like: 'Liked post',
  comment: 'Commented',
  connection_request: 'Connection sent',
  dm: 'DM sent',
};

type SortKey = 'icp_score' | 'activity_score' | 'updated_at' | 'created_at';

const OutreachPanel: React.FC = () => {
  const pipeline = useOutreachPipeline();
  const {
    prospects, campaigns, stats, loading, messages, engagementLog,
    recentActivity, rateLimits, featureFlags, stageCounts, actionNeeded,
    refresh, fetchMessages, fetchEngagementLog,
    updateStage, updateNotes, updateIcpScore, archiveProspect, skipProspect,
    toggleBlacklist, toggleNeedsReply, toggleCampaign, updateCampaignField,
    createCampaign, deleteCampaign, toggleFeatureFlag, workflowStatuses,
    toggleWorkflow, importProspects, sendManualDm,
  } = pipeline;

  const { lastRefreshed } = useAutoRefresh(refresh, { realtimeTables: ['outreach_prospects', 'outreach_messages', 'outreach_engagement_log'] });

  const [stageFilter, setStageFilter] = useState<string>('all');
  const [campaignFilter, setCampaignFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('updated_at');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<OutreachProspect | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showCampaigns, setShowCampaigns] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);

  // Filtered + sorted prospects
  const filtered = useMemo(() => {
    let list = prospects;
    if (stageFilter === 'action_needed') {
      list = list.filter((p) => p.needsManualReply || p.stage === 'replied');
    } else if (stageFilter !== 'all') {
      list = list.filter((p) => p.stage === stageFilter);
    }
    if (campaignFilter !== 'all') {
      list = list.filter((p) => p.campaignId === campaignFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        (p.headline?.toLowerCase().includes(q)) ||
        (p.company?.toLowerCase().includes(q))
      );
    }
    list = [...list].sort((a, b) => {
      let av: any, bv: any;
      if (sortKey === 'icp_score') { av = a.icpScore ?? -1; bv = b.icpScore ?? -1; }
      else if (sortKey === 'activity_score') { av = a.activityScore ?? -1; bv = b.activityScore ?? -1; }
      else if (sortKey === 'updated_at') { av = a.updatedAt; bv = b.updatedAt; }
      else { av = a.createdAt; bv = b.createdAt; }
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });
    return list;
  }, [prospects, stageFilter, campaignFilter, search, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const bulkArchive = () => {
    selectedIds.forEach((id) => archiveProspect(id, 'bulk_archive'));
    setSelectedIds(new Set());
  };

  const bulkStageChange = (stage: string) => {
    selectedIds.forEach((id) => updateStage(id, stage));
    setSelectedIds(new Set());
  };

  if (loading) return <LoadingSkeleton cards={6} rows={8} />;

  return (
    <div className="space-y-4">
      {/* Section 1: Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold tracking-tight">ICP Outreach</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => toggleFeatureFlag('outreach_enabled')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              featureFlags.outreach_enabled
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                : 'bg-zinc-600/15 text-zinc-500 border-zinc-600/20'
            }`}
          >
            System: {featureFlags.outreach_enabled ? 'ON' : 'OFF'}
          </button>
          <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
        </div>
      </div>

      {!featureFlags.outreach_enabled && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5 text-xs text-amber-400">
          Outreach automation paused. Manual actions still work.
        </div>
      )}

      {/* Section 2: Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Prospects" value={stats.totalProspects} icon={<Users className="w-5 h-5" />} color="text-blue-400" />
        <StatCard label="Campaigns" value={stats.activeCampaigns} icon={<Target className="w-5 h-5" />} color="text-purple-400" />
        <StatCard label="Warming" value={stats.warming + stats.engaged} icon={<Zap className="w-5 h-5" />} color="text-amber-400" />
        <StatCard label="Pending" value={stats.connectionSent} icon={<MessageSquare className="w-5 h-5" />} color="text-cyan-400" />
        <StatCard label="Reply Rate" value={`${stats.replyRate}%`} icon={<TrendingUp className="w-5 h-5" />} color="text-emerald-400" />
        <StatCard label="Today" value={stats.engagementsToday} icon={<Activity className="w-5 h-5" />} color="text-pink-400" />
      </div>

      {/* Section 3: Funnel */}
      <OutreachFunnel stats={stats} onStageClick={(s) => setStageFilter(s)} />

      {/* Section 4: Action Needed Banner */}
      {actionNeeded.length > 0 && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-medium text-emerald-400">{actionNeeded.length} prospect{actionNeeded.length > 1 ? 's' : ''} need your attention</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {actionNeeded.slice(0, 5).map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedProspect(p)}
                className="px-2 py-1 rounded-lg text-[11px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/15 hover:bg-emerald-500/20 transition-colors"
              >
                {p.name} {p.lastReplyAt ? `replied ${timeAgo(p.lastReplyAt)}` : ''}
              </button>
            ))}
            {actionNeeded.length > 5 && <span className="text-[11px] text-emerald-400/60 self-center">+{actionNeeded.length - 5} more</span>}
          </div>
        </div>
      )}

      {/* Section 5: Filters */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {[
            { key: 'action_needed', label: `Action Needed (${actionNeeded.length})` },
            { key: 'all', label: `All (${prospects.length})` },
            ...allStages.filter((s) => s !== 'identified').map((s) => ({
              key: s,
              label: `${s.replace('_', ' ')} (${stageCounts[s] || 0})`,
            })),
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setStageFilter(f.key)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors capitalize ${
                stageFilter === f.key ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <select
            value={campaignFilter}
            onChange={(e) => setCampaignFilter(e.target.value)}
            className="px-2 py-1 rounded-lg text-xs bg-zinc-800/60 border border-zinc-700/40 text-zinc-300 cursor-pointer"
          >
            <option value="all">All campaigns</option>
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search prospects..." />
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="px-2 py-1 rounded-lg text-xs bg-zinc-800/60 border border-zinc-700/40 text-zinc-300 cursor-pointer"
          >
            <option value="updated_at">Last Updated</option>
            <option value="icp_score">ICP Score</option>
            <option value="activity_score">Activity Score</option>
            <option value="created_at">Date Added</option>
          </select>
        </div>
      </div>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="bg-zinc-800/60 border border-zinc-700/40 rounded-xl px-4 py-2 flex items-center gap-3">
          <span className="text-xs text-zinc-400">{selectedIds.size} selected</span>
          <button onClick={bulkArchive} className="px-2 py-1 rounded text-[11px] text-red-400 hover:bg-red-500/10 transition-colors">Archive</button>
          <select
            onChange={(e) => { if (e.target.value) { bulkStageChange(e.target.value); e.target.value = ''; } }}
            className="px-2 py-1 rounded text-[11px] bg-transparent border border-zinc-700/40 text-zinc-400 cursor-pointer"
            defaultValue=""
          >
            <option value="" disabled>Change stage...</option>
            {allStages.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
          <button onClick={() => setSelectedIds(new Set())} className="text-[11px] text-zinc-500 hover:text-zinc-300 ml-auto">Clear</button>
        </div>
      )}

      {/* Section 6: Prospect Table */}
      {prospects.length === 0 && stageFilter === 'all' ? (
        <EmptyState
          title="No prospects yet"
          description="Create a campaign and import prospects from Apollo to get started."
          icon={<Target className="w-10 h-10" />}
        />
      ) : filtered.length === 0 ? (
        <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl p-8 text-zinc-500 text-center text-sm">
          No prospects match filter
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {filtered.map((p) => (
              <div
                key={p.id}
                onClick={() => setSelectedProspect(p)}
                className="bg-zinc-900/90 border border-zinc-800/60 rounded-xl p-3 cursor-pointer hover:border-zinc-700/60 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-zinc-200 text-sm">{p.name}</p>
                    <p className="text-[11px] text-zinc-500">{p.headline?.slice(0, 50) || p.company || ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${icpDot(p.icpScore)}`} title={`ICP: ${p.icpScore}`} />
                    <select
                      value={p.stage}
                      onChange={(e) => { e.stopPropagation(); updateStage(p.id, e.target.value); }}
                      onClick={(e) => e.stopPropagation()}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium border bg-transparent cursor-pointer ${stageColors[p.stage] || stageColors.identified}`}
                    >
                      {allStages.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                  </div>
                </div>
                {p.campaignName && (
                  <span className="inline-block mt-1.5 px-1.5 py-0.5 rounded-full text-[9px] bg-purple-500/10 text-purple-400">{p.campaignName}</span>
                )}
                {p.needsManualReply && (
                  <span className="inline-block mt-1.5 ml-1 px-1.5 py-0.5 rounded-full text-[9px] bg-emerald-500/15 text-emerald-400 animate-pulse">Needs reply</span>
                )}
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-zinc-900/90 border border-zinc-800/60 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800/40 bg-zinc-800/20">
                  <th className="px-3 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filtered.length && filtered.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedIds(new Set(filtered.map((p) => p.id)));
                        else setSelectedIds(new Set());
                      }}
                      className="rounded border-zinc-600"
                    />
                  </th>
                  <th className="px-3 py-3 text-[10px] text-zinc-500 font-bold uppercase tracking-[0.12em] text-left">Name & Company</th>
                  <th className="px-3 py-3 text-[10px] text-zinc-500 font-bold uppercase tracking-[0.12em]">Campaign</th>
                  <th className="px-3 py-3 text-[10px] text-zinc-500 font-bold uppercase tracking-[0.12em] cursor-pointer hover:text-zinc-300" onClick={() => handleSort('icp_score')}>
                    ICP {sortKey === 'icp_score' && (sortAsc ? '↑' : '↓')}
                  </th>
                  <th className="px-3 py-3 text-[10px] text-zinc-500 font-bold uppercase tracking-[0.12em] cursor-pointer hover:text-zinc-300" onClick={() => handleSort('activity_score')}>
                    Activity {sortKey === 'activity_score' && (sortAsc ? '↑' : '↓')}
                  </th>
                  <th className="px-3 py-3 text-[10px] text-zinc-500 font-bold uppercase tracking-[0.12em]">Stage</th>
                  <th className="px-3 py-3 text-[10px] text-zinc-500 font-bold uppercase tracking-[0.12em] cursor-pointer hover:text-zinc-300" onClick={() => handleSort('updated_at')}>
                    Last Action {sortKey === 'updated_at' && (sortAsc ? '↑' : '↓')}
                  </th>
                  <th className="px-3 py-3 text-[10px] text-zinc-500 font-bold uppercase tracking-[0.12em]">Next Touch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className={`hover:bg-zinc-800/30 transition-colors cursor-pointer ${p.needsManualReply ? 'bg-emerald-500/[0.03]' : ''}`}
                    onClick={() => setSelectedProspect(p)}
                  >
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(p.id)}
                        onChange={() => toggleSelect(p.id)}
                        className="rounded border-zinc-600"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {p.needsManualReply && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />}
                        <div>
                          <p className="font-medium text-zinc-200">{p.name}</p>
                          <p className="text-[11px] text-zinc-500 truncate max-w-[200px]">{p.headline || p.company || ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {p.campaignName ? (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-purple-500/10 text-purple-400 border border-purple-500/15">{p.campaignName}</span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`font-medium ${icpColor(p.icpScore)}`}>
                        {p.icpScore ?? '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className={`w-2 h-2 rounded-full ${icpDot(p.activityScore)}`} />
                        <span className="text-zinc-400">{p.activityScore ?? '—'}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={p.stage}
                        onChange={(e) => updateStage(p.id, e.target.value)}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium border bg-transparent cursor-pointer ${stageColors[p.stage] || stageColors.identified}`}
                      >
                        {allStages.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2.5 text-center text-xs text-zinc-500">{timeAgo(p.updatedAt)}</td>
                    <td className="px-3 py-2.5 text-center text-xs text-zinc-500">
                      {p.nextTouchAfter ? new Date(p.nextTouchAfter).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Section 8: Campaign Manager */}
      <div>
        <button
          onClick={() => setShowCampaigns(!showCampaigns)}
          className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors mb-2"
        >
          {showCampaigns ? '▼' : '▶'} Campaigns ({campaigns.length})
        </button>
        {showCampaigns && (
          <CampaignManager
            campaigns={campaigns}
            onToggle={toggleCampaign}
            onUpdate={updateCampaignField}
            onCreate={createCampaign}
            onDelete={deleteCampaign}
            onImport={importProspects}
          />
        )}
      </div>

      {/* Section 9: Automation Controls */}
      <div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors mb-2"
        >
          {showSettings ? '▼' : '▶'} Automation Settings
        </button>
        {showSettings && (
          <PanelCard title="Automation Settings" accent="emerald">
            <div className="space-y-4">
              {/* Workflow Controls */}
              <div className="space-y-2">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Workflows</span>
                {[
                  { id: '35HJE7eOpvEdxRwq', name: 'Apollo Import + Enrichment', schedule: 'Webhook', flag: null, desc: 'Fetches prospects from Apollo, enriches via UniPile, AI-scores ICP fit' },
                  { id: 'kr2lSH1eRGZcDWmO', name: 'Natural Warm-up', schedule: 'Every 4h', flag: 'outreach_auto_warmup', desc: 'Likes, comments, profile views with anti-detection randomization' },
                  { id: '5ZXtArhobWrDDpfJ', name: 'Connection Requests', schedule: 'Every 6h', flag: 'outreach_auto_connect', desc: 'Sends personalized connection requests to engaged prospects' },
                  { id: 'joU7VaM5OiRAwLwP', name: 'DM Sequence', schedule: 'Every 30m', flag: 'outreach_auto_dm', desc: '3-step DM sequence after connection accepted' },
                  { id: 'KWxb6JFdpvb3y8w5', name: 'Conversation Monitor', schedule: 'Every 15m', flag: null, desc: 'Detects replies, alerts via WhatsApp + Slack' },
                ].map((wf) => {
                  const isActive = workflowStatuses[wf.id] ?? false;
                  const flagOn = wf.flag ? (featureFlags[wf.flag] ?? false) : true;
                  const fullyOn = isActive && flagOn;
                  const dotColor = fullyOn ? 'bg-emerald-400' : isActive && !flagOn ? 'bg-amber-400' : 'bg-zinc-600';
                  const dotPulse = fullyOn ? 'animate-pulse' : '';

                  return (
                    <div key={wf.id} className="bg-zinc-800/40 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-2 h-2 rounded-full ${dotColor} ${dotPulse} shrink-0`} />
                          <span className="text-xs text-zinc-300 font-medium truncate">{wf.name}</span>
                          <span className="text-[10px] text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded shrink-0">{wf.schedule}</span>
                        </div>
                        <button
                          onClick={() => toggleWorkflow(wf.id)}
                          className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors shrink-0 ${
                            isActive
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                              : 'bg-zinc-600/15 text-zinc-500 border-zinc-600/20'
                          }`}
                        >
                          {isActive ? 'ACTIVE' : 'INACTIVE'}
                        </button>
                      </div>
                      <p className="text-[10px] text-zinc-500 leading-relaxed">{wf.desc}</p>
                      {wf.flag && (
                        <div className="flex items-center justify-between pt-1 border-t border-zinc-800">
                          <span className="text-[10px] text-zinc-500">Feature Flag: {wf.flag.replace('outreach_auto_', '')}</span>
                          <button
                            onClick={() => toggleFeatureFlag(wf.flag!)}
                            className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                              featureFlags[wf.flag]
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                                : 'bg-zinc-600/15 text-zinc-500 border-zinc-600/20'
                            }`}
                          >
                            {featureFlags[wf.flag] ? 'ON' : 'OFF'}
                          </button>
                        </div>
                      )}
                      {isActive && wf.flag && !featureFlags[wf.flag] && (
                        <p className="text-[10px] text-amber-500/80">Workflow active but flag off — cron fires but logic skips</p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Master Switch */}
              <div className="flex items-center justify-between bg-zinc-800/40 rounded-lg px-3 py-2">
                <span className="text-xs text-zinc-400">Master Switch</span>
                <button
                  onClick={() => toggleFeatureFlag('outreach_enabled')}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                    featureFlags['outreach_enabled']
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                      : 'bg-zinc-600/15 text-zinc-500 border-zinc-600/20'
                  }`}
                >
                  {featureFlags['outreach_enabled'] ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Rate limits */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Today&apos;s Rate Limits</span>
                {['profile_view', 'like', 'comment', 'connection_request', 'dm'].map((action) => {
                  const rl = rateLimits[action];
                  const count = rl?.count || 0;
                  const limit = rl?.daily_limit || (action === 'profile_view' ? 50 : action === 'like' ? 20 : action === 'comment' ? 8 : action === 'connection_request' ? 15 : 30);
                  const pct = Math.min((count / limit) * 100, 100);
                  const barColor = pct < 50 ? 'bg-emerald-500' : pct < 80 ? 'bg-amber-500' : 'bg-red-500';

                  return (
                    <div key={action} className="flex items-center gap-2">
                      <span className="text-[11px] text-zinc-500 w-28 capitalize">{action.replace('_', ' ')}</span>
                      <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[11px] text-zinc-500 w-14 text-right">{count}/{limit}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </PanelCard>
        )}
      </div>

      {/* Section 10: Activity Log */}
      <div>
        <button
          onClick={() => setShowActivity(!showActivity)}
          className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors mb-2"
        >
          {showActivity ? '▼' : '▶'} Recent Activity ({recentActivity.length})
        </button>
        {showActivity && (
          <PanelCard title="Recent Activity" accent="blue">
            {recentActivity.length === 0 ? (
              <p className="text-xs text-zinc-600 text-center py-4">No activity yet</p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {recentActivity.map((e) => {
                  const prospect = prospects.find((p) => p.id === e.prospectId);
                  return (
                    <div key={e.id} className="flex items-start gap-2 text-xs">
                      <span className="text-zinc-600 whitespace-nowrap w-12 shrink-0">
                        {new Date(e.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className={e.success ? 'text-zinc-400' : 'text-red-400'}>
                        {actionTypeIcons[e.actionType] || e.actionType}
                        {prospect && <span className="text-zinc-300"> {prospect.name}</span>}
                        {prospect?.campaignName && <span className="text-zinc-600"> ({prospect.campaignName})</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </PanelCard>
        )}
      </div>

      {/* Section 11: How It Works */}
      <div>
        <button
          onClick={() => setShowDocs(!showDocs)}
          className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors mb-2 flex items-center gap-1"
        >
          {showDocs ? '▼' : '▶'} How It Works
        </button>
        {showDocs && (
          <PanelCard title="How It Works" accent="blue">
            <div className="space-y-3">
              {/* Pipeline Stages */}
              <div>
                <button
                  onClick={() => setExpandedDoc(expandedDoc === 'pipeline' ? null : 'pipeline')}
                  className="text-xs text-zinc-300 hover:text-zinc-100 font-medium flex items-center gap-1 w-full"
                >
                  {expandedDoc === 'pipeline' ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  Pipeline Stages
                </button>
                {expandedDoc === 'pipeline' && (
                  <div className="mt-2 space-y-1.5 pl-4 border-l border-zinc-800">
                    {[
                      { from: 'identified', to: 'enriched', trigger: 'Apollo import + UniPile profile/posts fetch + Opus 4.6 ICP scoring' },
                      { from: 'enriched', to: 'warming', trigger: 'First engagement action (like, comment, or profile view)' },
                      { from: 'warming', to: 'engaged', trigger: '3+ touches over 10+ days with at least 1 comment or 2+ likes' },
                      { from: 'engaged', to: 'connection_sent', trigger: 'Connection request sent (with or without note)' },
                      { from: 'connection_sent', to: 'connected', trigger: 'Connection accepted (detected via UniPile chat polling)' },
                      { from: 'connected', to: 'dm_sent', trigger: 'DM Step 1 sent (2h after connection)' },
                      { from: 'dm_sent', to: 'replied', trigger: 'Reply detected by Conversation Monitor' },
                      { from: 'replied', to: 'converted', trigger: 'Manual — mark after successful conversation' },
                      { from: 'any', to: 'archived', trigger: 'Manual skip/archive, or auto-archive after 3 DMs with no reply' },
                    ].map((s, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="flex items-center gap-1 shrink-0">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${stageColors[s.from] || 'bg-zinc-600/20 text-zinc-400 border-zinc-600/30'}`}>
                            {s.from}
                          </span>
                          <span className="text-zinc-600 text-[10px]">&rarr;</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${stageColors[s.to] || 'bg-zinc-600/20 text-zinc-400 border-zinc-600/30'}`}>
                            {s.to}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-500 leading-relaxed">{s.trigger}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Workflow Details */}
              <div>
                <button
                  onClick={() => setExpandedDoc(expandedDoc === 'workflows' ? null : 'workflows')}
                  className="text-xs text-zinc-300 hover:text-zinc-100 font-medium flex items-center gap-1 w-full"
                >
                  {expandedDoc === 'workflows' ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  Workflow Details
                </button>
                {expandedDoc === 'workflows' && (
                  <div className="mt-2 space-y-3 pl-4 border-l border-zinc-800">
                    {[
                      {
                        name: 'Apollo Import + Enrichment',
                        schedule: 'Webhook (triggered from Import button)',
                        details: [
                          'Triggered when you click "Import Prospects" on a campaign',
                          'Searches Apollo API with campaign filters, deduplicates by LinkedIn URL',
                          'Enriches each prospect via UniPile: profile data + last 10 posts',
                          'Dead profile filter: no posts in 60 days = activity_score 1, skipped',
                          'Opus 4.6 scores ICP fit (1-10) using ClickUp prompt, extracts topics',
                          'Inserts prospects as "enriched", updates campaign counts',
                        ],
                      },
                      {
                        name: 'Natural Warm-up Engagement',
                        schedule: 'Every 4 hours (with 30% skip chance)',
                        details: [
                          'Anti-detection: 30% of runs skip entirely, random 0-20min start delay',
                          'Picks 2-4 prospects randomly (not all), WHERE next_touch_after <= now',
                          'Fetches prospect recent posts via UniPile, then decides action:',
                          '  - 10% chance: profile view only (natural browsing)',
                          '  - 15% chance: skip this round if already touched',
                          '  - 25% chance: Opus 4.6 AI comment on posts < 3 days old',
                          '  - 50% chance: like/react with varied reactions (like, praise, appreciation)',
                          'Sets next_touch_after to random 2-5 days, so no daily engagement per person',
                          'Graduation: 3+ touches, 10+ days, 1+ comment or 2+ likes = "engaged"',
                          '30-120s random delay between each prospect',
                        ],
                      },
                      {
                        name: 'Connection Request Sender',
                        schedule: 'Every 6 hours (with 40% skip chance)',
                        details: [
                          'Queries "engaged" prospects, ordered by ICP score, limit 1-3 random',
                          'Opus 4.6 generates personalized connection note referencing engagement history',
                          '20% of requests sent WITHOUT a note (more natural)',
                          'Notes are max 300 characters (LinkedIn limit)',
                          'Rate limited via linkedin_check_and_increment RPC (15/day)',
                          '60-180s random delay between each request',
                        ],
                      },
                      {
                        name: 'DM Sequence',
                        schedule: 'Every 30 minutes',
                        details: [
                          'Phase 1: Detects accepted connections by polling UniPile chats',
                          'Phase 2: Sends 3-step DM sequence via Opus 4.6:',
                          '  - Step 1 (2h after connect): value-first intro, no pitch',
                          '  - Step 2 (3 days later): share relevant resource/insight',
                          '  - Step 3 (4 days later): soft ask for chat',
                          'Fetches previous DMs for context on steps 2+3',
                          'Auto-archives after step 3 with no reply',
                          'Rate limited: 30 DMs/day max',
                        ],
                      },
                      {
                        name: 'Conversation Monitor',
                        schedule: 'Every 15 minutes',
                        details: [
                          'Queries prospects in "dm_sent" or "replied" stages',
                          'Polls UniPile chats for new inbound messages',
                          'On reply: advances to "replied", sets needs_manual_reply = true',
                          'Sends WhatsApp notification (Evolution API) + Slack alert',
                          'Prospect shows in "Action Needed" banner on dashboard',
                          'No feature flag — always runs when workflow is active',
                        ],
                      },
                    ].map((wf) => (
                      <div key={wf.name} className="space-y-1">
                        <p className="text-[11px] text-zinc-300 font-medium">{wf.name}</p>
                        <p className="text-[10px] text-zinc-500">{wf.schedule}</p>
                        <ul className="space-y-0.5">
                          {wf.details.map((d, i) => (
                            <li key={i} className="text-[10px] text-zinc-500 leading-relaxed">
                              {d.startsWith('  -') ? <span className="pl-3">{d.trim()}</span> : d}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Controls Guide */}
              <div>
                <button
                  onClick={() => setExpandedDoc(expandedDoc === 'controls' ? null : 'controls')}
                  className="text-xs text-zinc-300 hover:text-zinc-100 font-medium flex items-center gap-1 w-full"
                >
                  {expandedDoc === 'controls' ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  Controls Guide
                </button>
                {expandedDoc === 'controls' && (
                  <div className="mt-2 space-y-2 pl-4 border-l border-zinc-800">
                    <div className="space-y-1">
                      <p className="text-[11px] text-zinc-300 font-medium">Two-Layer Control System</p>
                      <p className="text-[10px] text-zinc-500">Each workflow has two independent controls:</p>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <div className="bg-zinc-800/60 rounded p-2">
                          <p className="text-[10px] text-emerald-400 font-medium">Workflow Active/Inactive</p>
                          <p className="text-[10px] text-zinc-500 mt-0.5">Controls whether the n8n cron/trigger fires at all. When INACTIVE, the workflow never runs.</p>
                        </div>
                        <div className="bg-zinc-800/60 rounded p-2">
                          <p className="text-[10px] text-amber-400 font-medium">Feature Flag ON/OFF</p>
                          <p className="text-[10px] text-zinc-500 mt-0.5">Controls whether the code logic executes. When OFF, the cron fires but the code exits immediately.</p>
                        </div>
                      </div>
                      <p className="text-[10px] text-zinc-500 mt-1">Both must be ON for automation to execute. Use flags for quick pause/resume without touching n8n workflow state.</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-zinc-300 font-medium">Status Indicators</p>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-[10px] text-zinc-500">Green pulse = workflow active + flag on (fully operational)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-amber-400" />
                          <span className="text-[10px] text-zinc-500">Amber = workflow active but flag off (cron fires, logic skips)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-zinc-600" />
                          <span className="text-[10px] text-zinc-500">Gray = workflow inactive (nothing runs)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Rate Limits Reference */}
              <div>
                <button
                  onClick={() => setExpandedDoc(expandedDoc === 'limits' ? null : 'limits')}
                  className="text-xs text-zinc-300 hover:text-zinc-100 font-medium flex items-center gap-1 w-full"
                >
                  {expandedDoc === 'limits' ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  Rate Limits Reference
                </button>
                {expandedDoc === 'limits' && (
                  <div className="mt-2 space-y-1.5 pl-4 border-l border-zinc-800">
                    {[
                      { action: 'Profile Views', limit: '50/day', desc: 'Viewing prospect LinkedIn profiles' },
                      { action: 'Likes/Reactions', limit: '20/day', desc: 'Liking or reacting to posts' },
                      { action: 'Comments', limit: '8/day', desc: 'AI-generated comments on prospect posts' },
                      { action: 'Connection Requests', limit: '15/day', desc: 'Sending connection requests (shared with organic)' },
                      { action: 'DMs', limit: '30/day', desc: 'Direct messages (shared with comment monitor auto-DMs)' },
                    ].map((r) => (
                      <div key={r.action} className="flex items-start gap-2">
                        <span className="text-[10px] text-zinc-400 font-medium w-32 shrink-0">{r.action} ({r.limit})</span>
                        <span className="text-[10px] text-zinc-500">{r.desc}</span>
                      </div>
                    ))}
                    <p className="text-[10px] text-zinc-600 mt-1">Limits are enforced atomically via linkedin_check_and_increment RPC. When a limit is hit, the action is skipped (not queued).</p>
                  </div>
                )}
              </div>
            </div>
          </PanelCard>
        )}
      </div>

      {/* Detail Modal */}
      {selectedProspect && (
        <ProspectDetailModal
          prospect={selectedProspect}
          messages={messages[selectedProspect.id] || []}
          engagements={engagementLog[selectedProspect.id] || []}
          onClose={() => setSelectedProspect(null)}
          onUpdateStage={updateStage}
          onUpdateNotes={updateNotes}
          onUpdateIcpScore={updateIcpScore}
          onArchive={archiveProspect}
          onToggleBlacklist={toggleBlacklist}
          onSendDm={sendManualDm}
          onFetchMessages={fetchMessages}
          onFetchEngagements={fetchEngagementLog}
        />
      )}
    </div>
  );
};

export default OutreachPanel;
