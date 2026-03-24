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
  react: 'Reacted to post',
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Prospects" value={stats.totalProspects} icon={<Users className="w-5 h-5" />} color="text-blue-400" />
        <StatCard label="Campaigns" value={stats.activeCampaigns} icon={<Target className="w-5 h-5" />} color="text-purple-400" />
        <StatCard label="Warming" value={stats.warming + stats.engaged} icon={<Zap className="w-5 h-5" />} color="text-amber-400" />
        <StatCard label="Pending" value={stats.connectionSent} icon={<MessageSquare className="w-5 h-5" />} color="text-cyan-400" />
        <StatCard label="Reply Rate" value={`${stats.replyRate}%`} icon={<TrendingUp className="w-5 h-5" />} color="text-emerald-400" />
      </div>

      {/* Section 2b: Daily Activity Limits */}
      <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-zinc-200">Today&apos;s Activity</span>
          </div>
          <span className="text-[10px] text-zinc-600">Daily limits enforced by LinkedIn safety layer</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {([
            { key: 'profile_view', label: 'Profile Views', defaultLimit: 50, icon: '👁' },
            { key: 'like', label: 'Likes & Reacts', defaultLimit: 20, icon: '❤️' },
            { key: 'connection_request', label: 'Connections', defaultLimit: 15, icon: '🤝' },
            { key: 'dm', label: 'DMs', defaultLimit: 30, icon: '💬' },
          ] as const).map(({ key, label, defaultLimit, icon }) => {
            const rl = rateLimits[key];
            const count = rl?.count || 0;
            const limit = rl?.daily_limit || defaultLimit;
            const pct = Math.min((count / limit) * 100, 100);
            const barColor = pct < 50 ? 'bg-emerald-500' : pct < 80 ? 'bg-amber-500' : 'bg-red-500';
            const textColor = pct >= 80 ? 'text-red-400' : pct >= 50 ? 'text-amber-400' : 'text-zinc-300';

            return (
              <div key={key} className="bg-zinc-800/40 border border-zinc-700/30 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-zinc-400">{icon} {label}</span>
                  <span className={`text-sm font-mono font-semibold ${textColor}`}>{count}<span className="text-zinc-600">/{limit}</span></span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                </div>
                {count >= limit && <p className="text-[9px] text-red-400 mt-1">Limit reached — skipping until tomorrow</p>}
              </div>
            );
          })}
        </div>
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
                  <th className="px-3 py-3 text-[10px] text-zinc-500 font-bold uppercase tracking-[0.12em] text-left">Name & Title</th>
                  <th className="px-3 py-3 text-[10px] text-zinc-500 font-bold uppercase tracking-[0.12em] text-left">Company</th>
                  <th className="px-3 py-3 text-[10px] text-zinc-500 font-bold uppercase tracking-[0.12em] cursor-pointer hover:text-zinc-300" onClick={() => handleSort('icp_score')}>
                    ICP {sortKey === 'icp_score' && (sortAsc ? '↑' : '↓')}
                  </th>
                  <th className="px-3 py-3 text-[10px] text-zinc-500 font-bold uppercase tracking-[0.12em]">Stage</th>
                  <th className="px-3 py-3 text-[10px] text-zinc-500 font-bold uppercase tracking-[0.12em]">Last Action</th>
                  <th className="px-3 py-3 text-[10px] text-zinc-500 font-bold uppercase tracking-[0.12em]">Next Action</th>
                  <th className="px-3 py-3 text-[10px] text-zinc-500 font-bold uppercase tracking-[0.12em]">Campaign</th>
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
                          <p className="text-[11px] text-zinc-500 truncate max-w-[180px]">{p.title || p.headline || ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div>
                        <p className="text-zinc-300 text-xs truncate max-w-[160px]">{p.company || '—'}</p>
                        <p className="text-[10px] text-zinc-600">
                          {[p.employeeCount, p.foundedYear ? `est. ${p.foundedYear}` : null].filter(Boolean).join(' · ') || ''}
                        </p>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`font-medium ${icpColor(p.icpScore)}`}>
                        {p.icpScore ?? '—'}
                      </span>
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
                    <td className="px-3 py-2.5 text-center">
                      {(() => {
                        const actions: { label: string; date: string }[] = [];
                        if (p.profileViewedAt) actions.push({ label: 'Profile view', date: p.profileViewedAt });
                        if (p.lastEngagedAt) actions.push({ label: `${p.postsLiked} like${p.postsLiked !== 1 ? 's' : ''}`, date: p.lastEngagedAt });
                        if (p.connectionSentAt) actions.push({ label: 'Connection sent', date: p.connectionSentAt });
                        if (p.connectedAt) actions.push({ label: 'Connected', date: p.connectedAt });
                        if (p.lastDmSentAt) actions.push({ label: `DM${p.dmCount > 1 ? ` (${p.dmCount})` : ''}`, date: p.lastDmSentAt });
                        if (p.lastReplyAt) actions.push({ label: 'Replied', date: p.lastReplyAt });
                        const last = actions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                        if (!last) return <span className="text-zinc-600 text-[10px]">—</span>;
                        return (
                          <div className="text-center">
                            <p className="text-[10px] text-zinc-300">{last.label}</p>
                            <p className="text-[9px] text-zinc-600">{timeAgo(last.date)}</p>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {(() => {
                        const stageNext: Record<string, string> = {
                          identified: 'Enrich',
                          enriched: 'Warm up',
                          warming: 'Continue warming',
                          engaged: 'Send connection',
                          connection_sent: 'Waiting acceptance',
                          connected: 'Send DM',
                          dm_sent: 'Waiting reply',
                          replied: 'Manual follow-up',
                          converted: 'Done',
                          archived: 'Archived',
                        };
                        const label = stageNext[p.stage] || '—';
                        const waiting = ['connection_sent', 'dm_sent'].includes(p.stage);
                        const manual = p.stage === 'replied' || p.needsManualReply;
                        const scheduled = p.nextTouchAfter && new Date(p.nextTouchAfter) > new Date();
                        return (
                          <div className="text-center">
                            <p className={`text-[10px] ${manual ? 'text-emerald-400 font-medium' : waiting ? 'text-zinc-500 italic' : 'text-zinc-400'}`}>{label}</p>
                            {scheduled && <p className="text-[9px] text-zinc-600">{timeAgo(p.nextTouchAfter!)}</p>}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {p.campaignName ? (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-purple-500/10 text-purple-400 border border-purple-500/15">{p.campaignName}</span>
                      ) : '—'}
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
          <div className="space-y-3">
            {/* Master Switch — prominent */}
            <div className={`flex items-center justify-between rounded-xl px-4 py-3 border ${
              featureFlags['outreach_enabled']
                ? 'bg-emerald-500/10 border-emerald-500/20'
                : 'bg-zinc-800/60 border-zinc-700/40'
            }`}>
              <div>
                <p className="text-sm font-medium text-zinc-200">Master Switch</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {featureFlags['outreach_enabled'] ? 'System is active — workflows will execute' : 'System paused — all automation stopped'}
                </p>
              </div>
              <button
                onClick={() => toggleFeatureFlag('outreach_enabled')}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  featureFlags['outreach_enabled'] ? 'bg-emerald-500' : 'bg-zinc-700'
                }`}
              >
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  featureFlags['outreach_enabled'] ? 'translate-x-[22px]' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            {/* Workflow Table */}
            <PanelCard title="Workflows" accent="emerald">
              <div className="overflow-x-auto -mx-3">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider px-3 py-2">Workflow</th>
                      <th className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider px-3 py-2 text-center">Schedule</th>
                      <th className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider px-3 py-2 text-center">n8n</th>
                      <th className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider px-3 py-2 text-center">Flag</th>
                      <th className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider px-3 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {[
                      { id: '35HJE7eOpvEdxRwq', name: 'Import + Enrich', schedule: 'Webhook', flag: null, desc: 'Apollo search, UniPile enrich, AI scoring' },
                      { id: 'kr2lSH1eRGZcDWmO', name: 'Warm-up', schedule: '4h', flag: 'outreach_auto_warmup', desc: 'Likes, reacts, profile views' },
                      { id: '5ZXtArhobWrDDpfJ', name: 'Connect', schedule: '6h', flag: 'outreach_auto_connect', desc: 'AI connection requests' },
                      { id: 'joU7VaM5OiRAwLwP', name: 'DM Sequence', schedule: '30m', flag: 'outreach_auto_dm', desc: '1 DM + 7-day archive' },
                      { id: 'KWxb6JFdpvb3y8w5', name: 'Monitor', schedule: '15m', flag: null, desc: 'Reply detection + alerts' },
                    ].map((wf) => {
                      const isActive = workflowStatuses[wf.id] ?? false;
                      const flagOn = wf.flag ? (featureFlags[wf.flag] ?? false) : true;
                      const fullyOn = isActive && flagOn;

                      return (
                        <tr key={wf.id} className="group hover:bg-zinc-800/30">
                          <td className="px-3 py-2.5">
                            <p className="text-xs text-zinc-200 font-medium">{wf.name}</p>
                            <p className="text-[10px] text-zinc-500 mt-0.5">{wf.desc}</p>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className="text-[10px] text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">{wf.schedule}</span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <button
                              onClick={() => toggleWorkflow(wf.id)}
                              className={`relative w-9 h-5 rounded-full transition-colors ${
                                isActive ? 'bg-emerald-500' : 'bg-zinc-700'
                              }`}
                            >
                              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                                isActive ? 'translate-x-[18px]' : 'translate-x-0.5'
                              }`} />
                            </button>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {wf.flag ? (
                              <button
                                onClick={() => toggleFeatureFlag(wf.flag!)}
                                className={`relative w-9 h-5 rounded-full transition-colors ${
                                  featureFlags[wf.flag] ? 'bg-emerald-500' : 'bg-zinc-700'
                                }`}
                              >
                                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                                  featureFlags[wf.flag] ? 'translate-x-[18px]' : 'translate-x-0.5'
                                }`} />
                              </button>
                            ) : (
                              <span className="text-[10px] text-zinc-600">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <div className={`w-2 h-2 rounded-full ${
                                fullyOn ? 'bg-emerald-400 animate-pulse' : isActive && !flagOn ? 'bg-amber-400' : 'bg-zinc-600'
                              }`} />
                              <span className={`text-[10px] font-medium ${
                                fullyOn ? 'text-emerald-400' : isActive && !flagOn ? 'text-amber-400' : 'text-zinc-500'
                              }`}>
                                {fullyOn ? 'Running' : isActive && !flagOn ? 'Paused' : 'Off'}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-zinc-600 mt-3 px-1">
                n8n = workflow trigger active in n8n. Flag = code logic enabled. Both must be on for automation to run.
              </p>
            </PanelCard>

            {/* Rate limits (detail view — summary shown above) */}
            <PanelCard title="Rate Limits" accent="blue">
              <div className="space-y-2">
                {['profile_view', 'like', 'connection_request', 'dm'].map((action) => {
                  const rl = rateLimits[action];
                  const count = rl?.count || 0;
                  const limit = rl?.daily_limit || (action === 'profile_view' ? 50 : action === 'like' ? 20 : action === 'connection_request' ? 15 : 30);
                  const pct = Math.min((count / limit) * 100, 100);
                  const barColor = pct < 50 ? 'bg-emerald-500' : pct < 80 ? 'bg-amber-500' : 'bg-red-500';

                  return (
                    <div key={action} className="flex items-center gap-3">
                      <span className="text-xs text-zinc-400 w-32 capitalize">{action.replace(/_/g, ' ')}</span>
                      <div className="flex-1 h-2.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-zinc-400 w-16 text-right font-mono">{count}/{limit}</span>
                    </div>
                  );
                })}
              </div>
            </PanelCard>
          </div>
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
          <div className="space-y-3">
            {/* What to Expect */}
            <PanelCard title="What to Expect" accent="emerald">
              <div className="space-y-3">
                <p className="text-xs text-zinc-300 font-medium">Timeline after enabling all workflows:</p>
                <div className="space-y-2">
                  {[
                    { time: 'Hours 0-4', desc: 'Warm-up starts: profile views, post likes on your enriched prospects. You\'ll see prospects move to "warming" stage.' },
                    { time: 'Days 3-10', desc: 'Prospects accumulate engagement (3+ touches). First ones graduate to "engaged" — highest ICP scores first.' },
                    { time: 'Days 5-14', desc: 'Connection requests go out to "engaged" prospects (1-2/day). You\'ll see "connection_sent" stages appear.' },
                    { time: 'Days 7-21', desc: 'Accepted connections get 1 personalized DM. If no reply after 7 days, prospect is archived. Replies trigger WhatsApp + Slack alerts.' },
                    { time: 'Ongoing', desc: 'Pipeline runs continuously. Import more prospects when enriched/warming pool drops below ~20.' },
                  ].map((t, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="text-[11px] text-emerald-400 font-medium shrink-0 w-[72px]">{t.time}</span>
                      <span className="text-xs text-zinc-400">{t.desc}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-zinc-800/40 rounded-lg p-2.5 mt-2">
                  <p className="text-[11px] text-zinc-500"><strong className="text-zinc-400">Typical throughput:</strong> ~1-2 connection requests/day, ~10-15 connections/month. At 30-40% accept rate, expect 3-6 new connections/month leading to DM conversations.</p>
                </div>
              </div>
            </PanelCard>

            {/* Pipeline Flow */}
            <PanelCard title="Pipeline Stages" accent="purple">
              <div className="space-y-3">
                <p className="text-xs text-zinc-500 mb-2">Each stage transition is automatic. Only "converted" requires your manual action.</p>
                {[
                  { from: 'enriched', to: 'warming', trigger: 'WF2 first touch — profile view or post like', auto: true },
                  { from: 'warming', to: 'engaged', trigger: '3+ touches over 10+ days (2+ likes/reacts)', auto: true },
                  { from: 'engaged', to: 'connection_sent', trigger: 'WF3 sends connection request (highest ICP first)', auto: true },
                  { from: 'connection_sent', to: 'connected', trigger: 'WF4 detects accepted connection via UniPile', auto: true },
                  { from: 'connected', to: 'dm_sent', trigger: 'WF4 sends DM Step 1 (2h after connection)', auto: true },
                  { from: 'dm_sent', to: 'replied', trigger: 'WF5 detects inbound reply', auto: true },
                  { from: 'replied', to: 'converted', trigger: 'You mark it after the conversation converts', auto: false },
                  { from: 'dm_sent', to: 'archived', trigger: 'Auto-archive after 7 days with no reply', auto: true },
                ].map((s, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                      <span className={`text-[11px] px-2 py-0.5 rounded border font-medium ${stageColors[s.from] || 'bg-zinc-600/20 text-zinc-400 border-zinc-600/30'}`}>
                        {s.from}
                      </span>
                      <span className="text-zinc-600">&rarr;</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded border font-medium ${stageColors[s.to] || 'bg-zinc-600/20 text-zinc-400 border-zinc-600/30'}`}>
                        {s.to}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-zinc-400 leading-relaxed">{s.trigger}</span>
                      {!s.auto && <span className="ml-1.5 text-[9px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">manual</span>}
                    </div>
                  </div>
                ))}
              </div>
            </PanelCard>

            {/* The 5 Workflows */}
            <PanelCard title="The 5 Workflows" accent="emerald">
              <div className="space-y-4">
                {[
                  {
                    name: '1. Import + Enrichment (WF1)',
                    schedule: 'Manual — click Import on a campaign',
                    bullets: [
                      'Searches Apollo API using campaign filters (industry, titles, seniority)',
                      'Deduplicates by LinkedIn URL — won\'t re-import existing prospects',
                      'UniPile enrichment: gets LinkedIn provider_id (needed for DMs/connections), recent posts, activity data',
                      'Claude Sonnet scores ICP fit (1-10) using prompt from ClickUp. Industries scored: construction, manufacturing, trades, professional services, real estate, healthcare ops',
                      'Stores: name, title, company, seniority, employee count, revenue, industry, location, email',
                    ],
                  },
                  {
                    name: '2. Natural Warm-up (WF2)',
                    schedule: 'Every 4h — 30% random skip',
                    bullets: [
                      'Picks 2-4 enriched/warming prospects with ICP ≥ 6',
                      'Random action: 70% like/react, 15% profile view, 15% natural skip',
                      'Reaction types: LIKE, PRAISE, APPRECIATION, EMPATHY (weighted toward LIKE)',
                      'Sets next touch 2-5 days out — max 1 touch every few days per person',
                      'Graduates to "engaged" after: 3+ total touches, 10+ days elapsed, 2+ likes',
                      'Anti-detection: random delays (1-16 min), varied action types, random skip rate',
                    ],
                  },
                  {
                    name: '3. Connection Requests (WF3)',
                    schedule: 'Every 6h — 40% random skip',
                    bullets: [
                      'Picks 1-3 "engaged" prospects, sorted by highest ICP score',
                      'No minimum ICP threshold — it simply takes the best available',
                      'Claude writes a 300-char personalized connection note. 20% sent with no note (more natural)',
                      'Rate limit: 15 connections/day (enforced server-side)',
                      'Random delay 60-960 seconds before first request',
                    ],
                  },
                  {
                    name: '4. DM Sequence (WF4)',
                    schedule: 'Every 30 min',
                    bullets: [
                      'Checks for accepted connections by polling UniPile',
                      'Sends 1 personalized DM (2h after connection accepted): value-first intro referencing their work — no pitch',
                      'DM written by Claude with full context (their industry, topics, headline)',
                      'If no reply after 7 days → auto-archived with reason "no_reply_after_7_days"',
                      'No follow-up DMs — one shot only to avoid being pushy',
                    ],
                  },
                  {
                    name: '5. Conversation Monitor (WF5)',
                    schedule: 'Every 15 min — always on (no feature flag)',
                    bullets: [
                      'Polls UniPile for new inbound messages from known prospects',
                      'When reply detected: marks "needs_manual_reply", moves to "replied" stage',
                      'Sends WhatsApp + Slack notification so you can respond personally',
                      'From this point, YOU take over the conversation — no more automation',
                    ],
                  },
                ].map((wf) => (
                  <div key={wf.name}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <p className="text-xs text-zinc-200 font-medium">{wf.name}</p>
                      <span className="text-[10px] text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">{wf.schedule}</span>
                    </div>
                    <ul className="space-y-1 ml-3">
                      {wf.bullets.map((b, i) => (
                        <li key={i} className="text-xs text-zinc-400 leading-relaxed flex items-start gap-2">
                          <span className="text-zinc-600 mt-1.5 shrink-0">&#8226;</span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </PanelCard>

            {/* Data Sources */}
            <PanelCard title="Where Data Comes From" accent="blue">
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-zinc-800/40 rounded-lg p-3">
                    <p className="text-xs text-blue-400 font-medium mb-1.5">Apollo (Lead Source)</p>
                    <ul className="space-y-0.5 text-[11px] text-zinc-400">
                      <li>Name, title, headline</li>
                      <li>Company, industry, employee count, revenue</li>
                      <li>Location (city, state, country)</li>
                      <li>LinkedIn URL, seniority level</li>
                      <li>Email (when verified), company domain</li>
                    </ul>
                  </div>
                  <div className="bg-zinc-800/40 rounded-lg p-3">
                    <p className="text-xs text-purple-400 font-medium mb-1.5">UniPile (LinkedIn Bridge)</p>
                    <ul className="space-y-0.5 text-[11px] text-zinc-400">
                      <li>LinkedIn provider_id (required for actions)</li>
                      <li>Recent post content (for AI personalization)</li>
                      <li>Activity scoring (post frequency)</li>
                      <li>Sends connections, DMs, likes/reacts</li>
                      <li>Detects replies and accepted connections</li>
                    </ul>
                  </div>
                </div>
                <div className="bg-zinc-800/40 rounded-lg p-2.5">
                  <p className="text-[11px] text-zinc-500"><strong className="text-zinc-400">Note:</strong> UniPile can only see posts from people you&apos;re connected to or who post publicly. Most enriched prospects will show activity_score 3 and no post data until you connect with them.</p>
                </div>
              </div>
            </PanelCard>

            {/* Controls Guide */}
            <PanelCard title="Controls & Safety" accent="amber">
              <div className="space-y-3">
                <p className="text-xs text-zinc-400">Each workflow has two independent controls. Both must be ON for automation to run.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-zinc-800/60 rounded-lg p-3">
                    <p className="text-xs text-emerald-400 font-medium mb-1">n8n Toggle</p>
                    <p className="text-xs text-zinc-400">Controls whether the cron fires at all. OFF = completely stopped.</p>
                  </div>
                  <div className="bg-zinc-800/60 rounded-lg p-3">
                    <p className="text-xs text-amber-400 font-medium mb-1">Feature Flag</p>
                    <p className="text-xs text-zinc-400">Controls whether code logic executes. OFF = cron fires but exits immediately. Quick pause/resume.</p>
                  </div>
                </div>
                <div className="space-y-2 mt-2">
                  <p className="text-xs text-zinc-300 font-medium">Anti-Detection Features</p>
                  <ul className="space-y-1 ml-3">
                    {[
                      'Random delays before each action (1-16 minutes)',
                      '30-40% chance of skipping entire execution (looks human)',
                      'Varied action types (likes, reacts, profile views, skips)',
                      '2-5 day gap between touches on same person',
                      'Random connection note omission (20%)',
                      'Server-side daily rate limits enforced per action type',
                    ].map((b, i) => (
                      <li key={i} className="text-xs text-zinc-400 flex items-start gap-2">
                        <span className="text-zinc-600 mt-1.5 shrink-0">&#8226;</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-2 mt-2">
                  <p className="text-xs text-zinc-300 font-medium">Daily Rate Limits</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { action: 'Profile Views', limit: '50/day' },
                      { action: 'Likes & Reacts', limit: '20/day' },
                      { action: 'Connections', limit: '15/day' },
                      { action: 'DMs', limit: '30/day' },
                    ].map((r) => (
                      <div key={r.action} className="bg-zinc-800/40 rounded px-2.5 py-1.5 text-center">
                        <p className="text-xs text-zinc-300 font-medium">{r.limit}</p>
                        <p className="text-[10px] text-zinc-500">{r.action}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-zinc-500">When a limit is hit, actions are skipped (not queued). Counts are shared with your organic LinkedIn activity.</p>
                </div>
              </div>
            </PanelCard>
          </div>
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
