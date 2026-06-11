import React, { useState, useMemo, useEffect } from 'react';

const PROSPECTS_PER_PAGE = 30;
import { Target, Users, MessageSquare, TrendingUp, Activity, AlertTriangle, Send } from 'lucide-react';
import { useOutreachPipeline } from '../../hooks/useOutreachPipeline';
import { useOutreachFeeds } from '../../hooks/useOutreachFeeds';
import { supabase } from '../../lib/supabase';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useDashboard } from '../../contexts/DashboardContext';
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
import { SubTabs, SubTab } from '../dashboard-v2/primitives';
import PanelErrorBoundary from './shared/PanelErrorBoundary';
import { ActivityFeed } from './outreach/ActivityFeed';
import { PendingInviteGauge } from './outreach/PendingInviteGauge';
import { CampaignPerformance } from './outreach/CampaignPerformance';
import { AuditClicks } from './outreach/AuditClicks';
import { InboxTab } from './outreach/tabs/InboxTab';
import { OverviewTab } from './outreach/tabs/OverviewTab';
import { SourcesTab } from './outreach/tabs/SourcesTab';
import { feedOf, FEED_ORDER, FEED_LABELS, FEED_BADGE } from './outreach/feedHelpers';
import type { OutreachProspect, OutreachFeed } from '../../types/dashboard';

// Phase 1 constant; Phase 2 makes this integration_config-driven.

// Feeds-centric revamp: Overview (all feeds at a glance) is the new default;
// Sources is the per-source prune/add control center. Health stays folded into
// Pipeline. Review/Inbox unchanged.
type OutreachTab = 'overview' | 'sources' | 'pipeline' | 'review' | 'inbox';
const TAB_ORDER: OutreachTab[] = ['overview', 'sources', 'pipeline', 'review', 'inbox'];
const TAB_LABELS: Record<OutreachTab, string> = { overview: 'Overview', sources: 'Sources', pipeline: 'Pipeline', review: 'Review', inbox: 'Inbox' };
function readTab(): OutreachTab {
  if (typeof window === 'undefined') return 'overview';
  // NB: param is `otab`, not `tab` — the dashboard Shell has a legacy v1 `?tab=`
  // contract where values like `health`/`settings` redirect to the Personal section.
  // Reusing `tab` here made `?tab=health` jump to Personal. `otab` avoids the collision.
  const t = new URLSearchParams(window.location.search).get('otab') as OutreachTab | null;
  return t && TAB_ORDER.includes(t) ? t : 'overview';
}

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

type SortKey = 'icp_score' | 'activity_score' | 'updated_at' | 'created_at';

const OutreachPanel: React.FC = () => {
  const { userTimezone } = useDashboard();
  const pipeline = useOutreachPipeline(userTimezone);
  const feeds = useOutreachFeeds();
  const {
    prospects, campaigns, stats, loading, messages, engagementLog,
    recentActivity, rateLimits, cappedQueue, featureFlags, pendingCeiling, stageCounts, actionNeeded,
    refresh, fetchMessages, fetchEngagementLog,
    updateStage, updateNotes, updateIcpScore, archiveProspect, skipProspect,
    toggleBlacklist, toggleNeedsReply, toggleCampaign, updateCampaignField,
    createCampaign, deleteCampaign, toggleFeatureFlag, workflowStatuses, workflowHealth,
    toggleWorkflow, importProspects, sendManualDm, approveDraft, rejectDraft,
    pendingDrafts, fetchPendingDrafts,
    commentDrafts, fetchCommentDrafts, approveCommentDraft, rejectCommentDraft,
    proposedTargets, approveCommentingTarget, rejectCommentingTarget,
    activeCohort, pauseCommentingTarget, dropActiveCommentingTarget, addCommentingTargets,
  } = pipeline;
  const [bulkUrls, setBulkUrls] = useState('');
  const [showCohort, setShowCohort] = useState(false);
  const [tab, setTab] = useState<OutreachTab>(readTab);
  const changeTab = (t: OutreachTab) => {
    setTab(t);
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('otab', t);
    window.history.replaceState(null, '', url.toString());
  };

  const { lastRefreshed } = useAutoRefresh(refresh, { realtimeTables: ['outreach_prospects', 'outreach_messages', 'outreach_engagement_log'] });

  const [stageFilter, setStageFilter] = useState<string>('all');
  const [campaignFilter, setCampaignFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [feedFilter, setFeedFilter] = useState<'all' | OutreachFeed>('all');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('updated_at');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<OutreachProspect | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showCampaigns, setShowCampaigns] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [page, setPage] = useState(1);

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
    if (feedFilter !== 'all') {
      list = list.filter((p) => feedOf(p, feeds.hotDomains) === feedFilter);
    }
    if (channelFilter !== 'all') {
      if (channelFilter === 'email') {
        list = list.filter((p) => p.preferredChannel === 'email');
      } else if (channelFilter === 'linkedin') {
        list = list.filter((p) => p.preferredChannel === 'linkedin');
      } else if (channelFilter === 'unset') {
        list = list.filter((p) => !p.preferredChannel);
      } else if (channelFilter === 'researched') {
        list = list.filter((p) => p.triggerType && p.triggerType !== 'none');
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        (p.headline?.toLowerCase().includes(q)) ||
        (p.company?.toLowerCase().includes(q)) ||
        (p.email?.toLowerCase().includes(q))
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
  }, [prospects, stageFilter, campaignFilter, channelFilter, feedFilter, feeds.hotDomains, search, sortKey, sortAsc]);

  // Reset to page 1 when filters or sort change
  useEffect(() => { setPage(1); }, [stageFilter, campaignFilter, channelFilter, feedFilter, search, sortKey, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PROSPECTS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(
    () => filtered.slice((safePage - 1) * PROSPECTS_PER_PAGE, safePage * PROSPECTS_PER_PAGE),
    [filtered, safePage]
  );

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

  const reviewCount = pendingDrafts.length + proposedTargets.length + commentDrafts.length;

  if (loading) return <LoadingSkeleton cards={6} rows={8} />;

  const pipelineTab = (
    <div className="space-y-4">
      {/* Section 2: Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard label="Prospects" value={stats.totalProspects} icon={<Users className="w-5 h-5" />} color="text-zinc-300" />
        <StatCard label="Campaigns" value={stats.activeCampaigns} icon={<Target className="w-5 h-5" />} color="text-zinc-300" />
        <StatCard label="Pending" value={stats.connectionSent} icon={<MessageSquare className="w-5 h-5" />} color="text-zinc-300" />
        {(() => {
          // Reply rate at small N is meaningless (1/1 = 100%). Show the fraction as
          // context and dim the card until there's enough signal to trust the number.
          const denom = Math.max(stats.dmSent, stats.connected);
          const lowSignal = denom < 10;
          return (
            <StatCard
              label="Reply Rate"
              value={lowSignal ? '-' : `${stats.replyRate}%`}
              icon={<TrendingUp className="w-5 h-5" />}
              color={lowSignal ? 'text-zinc-400' : 'text-emerald-400'}
              subValue={denom > 0 ? `${stats.replied}/${denom}${lowSignal ? ' · low signal' : ''}` : 'no sends yet'}
            />
          );
        })()}
      </div>

      {/* Per-campaign performance */}
      <CampaignPerformance prospects={prospects} />

      {/* Audit-link clicks (previously buried in Agency-Ready only) */}
      <AuditClicks />

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
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={feedFilter}
            onChange={(e) => setFeedFilter(e.target.value as 'all' | OutreachFeed)}
            className="px-2 py-1 rounded-lg text-xs bg-zinc-800/60 border border-zinc-700/40 text-zinc-300 cursor-pointer"
          >
            <option value="all">All feeds</option>
            {FEED_ORDER.map((f) => <option key={f} value={f}>{FEED_LABELS[f]}</option>)}
          </select>
          <select
            value={campaignFilter}
            onChange={(e) => setCampaignFilter(e.target.value)}
            className="px-2 py-1 rounded-lg text-xs bg-zinc-800/60 border border-zinc-700/40 text-zinc-300 cursor-pointer"
          >
            <option value="all">All campaigns</option>
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="px-2 py-1 rounded-lg text-xs bg-zinc-800/60 border border-zinc-700/40 text-zinc-300 cursor-pointer"
          >
            <option value="all">All channels</option>
            <option value="linkedin">LinkedIn (tagged)</option>
            <option value="email">Email (tagged)</option>
            <option value="unset">No channel set</option>
            <option value="researched">Researched only</option>
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
            {paged.map((p) => (
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
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {(() => {
                    const f = feedOf(p, feeds.hotDomains);
                    return <span className={`px-1.5 py-0.5 rounded-full text-[9px] border ${FEED_BADGE[f]}`}>{FEED_LABELS[f]}</span>;
                  })()}
                  {p.campaignName && (
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-purple-500/10 text-purple-400">{p.campaignName}</span>
                  )}
                  {p.needsManualReply && (
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-emerald-500/15 text-emerald-400 animate-pulse">Needs reply</span>
                  )}
                  {/* Progress indicators */}
                  {['warming', 'engaged', 'connection_sent', 'connected', 'dm_sent', 'replied'].includes(p.stage) && (
                    <span className="text-[9px] text-zinc-500">
                      {p.profileViewedAt ? '✓ Viewed' : '○ No view'} · {p.postsLiked || 0} likes
                    </span>
                  )}
                </div>
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
                      checked={paged.length > 0 && paged.every((p) => selectedIds.has(p.id))}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedIds(new Set([...selectedIds, ...paged.map((p) => p.id)]));
                        else { const next = new Set(selectedIds); paged.forEach((p) => next.delete(p.id)); setSelectedIds(next); }
                      }}
                      className="rounded border-zinc-600"
                      title="Select all on this page"
                    />
                  </th>
                  <th className="px-3 py-3 text-[10px] text-zinc-500 font-bold uppercase tracking-[0.12em] text-left">Prospect</th>
                  <th className="px-3 py-3 text-[10px] text-zinc-500 font-bold uppercase tracking-[0.12em] cursor-pointer hover:text-zinc-300" onClick={() => handleSort('icp_score')}>
                    ICP {sortKey === 'icp_score' && (sortAsc ? '↑' : '↓')}
                  </th>
                  <th className="px-3 py-3 text-[10px] text-zinc-500 font-bold uppercase tracking-[0.12em]">Stage</th>
                  <th className="px-3 py-3 text-[10px] text-zinc-500 font-bold uppercase tracking-[0.12em]">Progress</th>
                  <th className="px-3 py-3 text-[10px] text-zinc-500 font-bold uppercase tracking-[0.12em]">Next Step</th>
                  <th className="px-3 py-3 text-[10px] text-zinc-500 font-bold uppercase tracking-[0.12em] cursor-pointer hover:text-zinc-300" onClick={() => handleSort('created_at')}>
                    Age {sortKey === 'created_at' && (sortAsc ? '↑' : '↓')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {paged.map((p) => (
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
                    {/* Prospect: name + company + campaign + linkedin */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {p.needsManualReply && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-zinc-200 truncate">{p.name}</p>
                            {p.linkedinUrl && (
                              <a href={p.linkedinUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-blue-400/60 hover:text-blue-400 shrink-0" title="LinkedIn">
                                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                              </a>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-500 truncate max-w-[200px]">
                            {[p.title || p.headline, p.company].filter(Boolean).join(' @ ') || ''}
                          </p>
                          {p.preferredChannel === 'email' && p.email && (
                            <p className="text-[10px] text-green-400/60 truncate max-w-[200px]">{p.email}</p>
                          )}
                          {p.preferredChannel === 'email' && !p.email && (
                            <p className="text-[10px] text-red-400/60">No email address</p>
                          )}
                          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                            {(() => {
                              const f = feedOf(p, feeds.hotDomains);
                              return <span className={`px-1.5 py-0 rounded-full text-[8px] border ${FEED_BADGE[f]}`}>{FEED_LABELS[f]}</span>;
                            })()}
                            {p.preferredChannel && (
                              <span className={`px-1.5 py-0 rounded-full text-[8px] ${p.preferredChannel === 'email' ? 'bg-green-500/10 text-green-400/70' : 'bg-blue-500/10 text-blue-400/70'}`}>
                                {p.preferredChannel === 'email' ? '✉ email' : '🔗 linkedin'}
                              </span>
                            )}
                            {p.campaignName && (
                              <span className="px-1.5 py-0 rounded-full text-[8px] bg-purple-500/10 text-purple-400/70">{p.campaignName}</span>
                            )}
                            {p.microPersona && (
                              <span className={`px-1.5 py-0 rounded-full text-[8px] ${
                                ({ scaling_pain: 'bg-blue-500/10 text-blue-400/70',
                                   process_pain: 'bg-amber-500/10 text-amber-400/70',
                                   cost_pain: 'bg-red-500/10 text-red-400/70',
                                   compliance_pain: 'bg-purple-500/10 text-purple-300/70',
                                   transition_pain: 'bg-cyan-500/10 text-cyan-400/70',
                                   competitive_pain: 'bg-pink-500/10 text-pink-400/70'
                                } as Record<string, string>)[p.microPersona] || 'bg-zinc-700/30 text-zinc-500'
                              }`}>{p.microPersona.replace('_', ' ')}</span>
                            )}
                            {p.triggerConfidence != null && p.triggerConfidence > 0 && (
                              <span className={`w-1.5 h-1.5 rounded-full ${p.triggerConfidence >= 4 ? 'bg-emerald-400' : p.triggerConfidence >= 3 ? 'bg-amber-400' : 'bg-zinc-600'}`} title={`Trigger confidence: ${p.triggerConfidence}/5`} />
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    {/* ICP */}
                    <td className="px-3 py-2.5 text-center">
                      <span className={`font-medium ${icpColor(p.icpScore)}`}>
                        {p.icpScore ?? '-'}
                      </span>
                    </td>
                    {/* Stage */}
                    <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={p.stage}
                        onChange={(e) => updateStage(p.id, e.target.value)}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium border bg-transparent cursor-pointer ${stageColors[p.stage] || stageColors.identified}`}
                      >
                        {allStages.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                      </select>
                    </td>
                    {/* Progress: visual indicators of completed milestones */}
                    <td className="px-3 py-2.5">
                      {(() => {
                        const viewed = !!p.profileViewedAt;
                        const likes = p.postsLiked || 0;
                        const connSent = !!p.connectionSentAt;
                        const conn = !!p.connectedAt;
                        const dmSent = p.dmCount || 0;
                        const replied = !!p.lastReplyAt;

                        // Build milestone dots based on stage progression
                        const milestones: { label: string; done: boolean; detail?: string }[] = [
                          { label: 'View', done: viewed, detail: viewed ? timeAgo(p.profileViewedAt!) : undefined },
                          { label: 'Likes', done: likes >= 2, detail: likes > 0 ? `${likes}` : undefined },
                        ];
                        if (['engaged', 'connection_sent', 'connected', 'dm_sent', 'replied', 'converted'].includes(p.stage)) {
                          milestones.push({ label: 'Req', done: connSent, detail: connSent ? timeAgo(p.connectionSentAt!) : undefined });
                        }
                        if (['connected', 'dm_sent', 'replied', 'converted'].includes(p.stage)) {
                          milestones.push({ label: 'Conn', done: conn, detail: conn ? timeAgo(p.connectedAt!) : undefined });
                        }
                        if (['dm_sent', 'replied', 'converted'].includes(p.stage)) {
                          milestones.push({ label: 'DM', done: dmSent > 0, detail: dmSent > 0 ? `${dmSent}` : undefined });
                        }
                        if (['replied', 'converted'].includes(p.stage)) {
                          milestones.push({ label: 'Reply', done: replied });
                        }

                        if (p.stage === 'identified' || p.stage === 'enriched') {
                          return <span className="text-zinc-600 text-[10px]">-</span>;
                        }

                        return (
                          <div className="flex items-center gap-1.5">
                            {milestones.map((m, i) => (
                              <div key={i} className="flex flex-col items-center" title={`${m.label}${m.detail ? `: ${m.detail}` : ''}`}>
                                <div className={`w-2 h-2 rounded-full ${m.done ? 'bg-emerald-400' : 'bg-zinc-700'}`} />
                                <span className={`text-[8px] mt-0.5 ${m.done ? 'text-zinc-400' : 'text-zinc-600'}`}>{m.label}</span>
                                {m.detail && <span className="text-[7px] text-zinc-500">{m.detail}</span>}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </td>
                    {/* Next Step: specific action needed */}
                    <td className="px-3 py-2.5 text-center">
                      {(() => {
                        const viewed = !!p.profileViewedAt;
                        const likes = p.postsLiked || 0;
                        const scheduled = p.nextTouchAfter && new Date(p.nextTouchAfter) > new Date();
                        const manual = p.stage === 'replied' || p.needsManualReply;

                        let label = '';
                        let color = 'text-zinc-400';

                        switch (p.stage) {
                          case 'identified': label = 'Enrich'; break;
                          case 'enriched': label = 'Start warm-up'; break;
                          case 'warming': {
                            const touches = (viewed ? 1 : 0) + likes + (p.postsCommented || 0);
                            const daysIn = Math.floor((Date.now() - new Date(p.createdAt).getTime()) / 86400000);
                            if (!viewed) { label = 'Profile view'; color = 'text-amber-400'; }
                            else if (likes < 2) { label = `Like posts (${likes}/2)`; color = 'text-amber-400'; }
                            else if (touches < 3) { label = `Engage more (${touches}/3)`; color = 'text-amber-400'; }
                            else if (daysIn < 10) { label = `Wait ${10 - daysIn}d to graduate`; color = 'text-zinc-500'; }
                            else { label = 'Ready to graduate'; color = 'text-emerald-400'; }
                            break;
                          }
                          case 'engaged': label = 'Send connection'; color = 'text-cyan-400'; break;
                          case 'connection_sent': label = 'Awaiting accept'; color = 'text-zinc-500'; break;
                          case 'connected': label = 'Send DM'; color = 'text-pink-400'; break;
                          case 'dm_sent': label = 'Awaiting reply'; color = 'text-zinc-500'; break;
                          case 'replied': label = 'Manual follow-up'; color = 'text-emerald-400'; break;
                          case 'converted': label = 'Done'; color = 'text-yellow-400'; break;
                          case 'archived': label = 'Archived'; color = 'text-zinc-600'; break;
                          default: label = '-';
                        }

                        return (
                          <div className="text-center">
                            <p className={`text-[10px] font-medium ${manual ? 'text-emerald-400' : color}`}>{label}</p>
                            {scheduled && <p className="text-[9px] text-zinc-600">{timeAgo(p.nextTouchAfter!)}</p>}
                          </div>
                        );
                      })()}
                    </td>
                    {/* Age: days since added */}
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-[10px] text-zinc-500">
                        {Math.floor((Date.now() - new Date(p.createdAt).getTime()) / 86400000)}d
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 px-1 pt-2 text-xs text-zinc-400">
              <span>
                Showing <span className="text-zinc-200 font-medium">{(safePage - 1) * PROSPECTS_PER_PAGE + 1}</span>–<span className="text-zinc-200 font-medium">{Math.min(safePage * PROSPECTS_PER_PAGE, filtered.length)}</span> of <span className="text-zinc-200 font-medium">{filtered.length}</span>
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(1)}
                  disabled={safePage === 1}
                  className="px-2 py-1 rounded border border-zinc-700/60 hover:bg-zinc-800/60 disabled:opacity-30 disabled:cursor-not-allowed"
                >« First</button>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="px-2 py-1 rounded border border-zinc-700/60 hover:bg-zinc-800/60 disabled:opacity-30 disabled:cursor-not-allowed"
                >‹ Prev</button>
                <span className="px-3 py-1 text-zinc-300">Page {safePage} / {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="px-2 py-1 rounded border border-zinc-700/60 hover:bg-zinc-800/60 disabled:opacity-30 disabled:cursor-not-allowed"
                >Next ›</button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={safePage === totalPages}
                  className="px-2 py-1 rounded border border-zinc-700/60 hover:bg-zinc-800/60 disabled:opacity-30 disabled:cursor-not-allowed"
                >Last »</button>
              </div>
            </div>
          )}
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
    </div>
  );

  const reviewTab = (
    <div className="space-y-4">
      {reviewCount === 0 && activeCohort.length === 0 ? (
        <EmptyState
          title="Nothing to review"
          description="Drafts, comment drafts, and proposed commenting targets will appear here when the workflows generate them."
          icon={<MessageSquare className="w-10 h-10" />}
        />
      ) : null}

      {/* Outreach Review Queue */}
      {pendingDrafts.length > 0 && (
        <div className="bg-zinc-900/90 border border-amber-500/20 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold text-amber-400">{pendingDrafts.length} Draft{pendingDrafts.length > 1 ? 's' : ''} Awaiting Review</span>
            <span className="text-[9px] text-zinc-500">
              ({pendingDrafts.filter(d => d.messageType === 'connection_note').length} connection notes, {pendingDrafts.filter(d => d.messageType === 'email').length} emails, {pendingDrafts.filter(d => d.messageType === 'dm').length} DMs)
            </span>
          </div>
          <div className="space-y-3">
            {pendingDrafts.map((draft) => (
              <div key={draft.id} className="bg-zinc-800/50 border border-zinc-700/30 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <button onClick={() => { const p = prospects.find(x => x.id === draft.prospectId); if (p) setSelectedProspect(p); }} className="text-xs font-medium text-zinc-200 hover:text-cyan-400 transition-colors underline decoration-zinc-700 hover:decoration-cyan-400 cursor-pointer">{draft.prospectName}</button>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">{
                      draft.messageType === 'connection_note' ? 'Connection Note'
                      : draft.messageType === 'email' ? `Email ${draft.emailStep ?? 1}/3`
                      : `DM Step ${draft.sequenceStep}`
                    }</span>
                    {draft.channel && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border ${draft.channel === 'email' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                        {draft.channel === 'email' ? 'Email' : 'LinkedIn'}
                      </span>
                    )}
                    {draft.matchedContentType && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">{draft.matchedContentType}</span>
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-500">{timeAgo(draft.createdAt)}</span>
                </div>
                {/* Research context for this prospect */}
                {(() => {
                  const p = prospects.find(x => x.id === draft.prospectId);
                  if (!p?.triggerType || p.triggerType === 'none') return null;
                  return (
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">{p.triggerType?.replace('_', ' ')} ({p.triggerConfidence}/5)</span>
                      {p.microPersona && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border ${
                          ({ scaling_pain: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                             process_pain: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                             cost_pain: 'bg-red-500/10 text-red-400 border-red-500/20',
                             compliance_pain: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
                             transition_pain: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
                             competitive_pain: 'bg-pink-500/10 text-pink-400 border-pink-500/20'
                          } as Record<string, string>)[p.microPersona] || 'bg-zinc-700/30 text-zinc-400 border-zinc-600/30'
                        }`}>{p.microPersona.replace('_', ' ')}</span>
                      )}
                      {p.messagingPattern && (
                        <span className="text-[9px] text-zinc-500">{p.messagingPattern.replace('_', ' ')}</span>
                      )}
                      {p.triggerDetail && (
                        <span className="text-[10px] text-zinc-500 italic truncate max-w-[300px]" title={p.triggerDetail}>{p.triggerDetail}</span>
                      )}
                    </div>
                  );
                })()}
                <textarea
                  defaultValue={draft.messageText}
                  id={`draft-${draft.id}`}
                  rows={Math.min(8, Math.max(3, draft.messageText.split('\n').length))}
                  className="w-full text-xs text-zinc-300 mb-3 whitespace-pre-wrap leading-relaxed bg-zinc-900/60 border border-zinc-700/30 rounded-lg p-2.5 resize-y focus:outline-none focus:border-zinc-600"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={async (e) => {
                      const btn = e.currentTarget;
                      btn.disabled = true;
                      const textarea = document.getElementById(`draft-${draft.id}`) as HTMLTextAreaElement;
                      const editedText = textarea?.value || draft.messageText;
                      try {
                        // Save edit if changed
                        if (editedText !== draft.messageText) {
                          await supabase.from('outreach_messages').update({ message_text: editedText }).eq('id', draft.id);
                        }
                        await approveDraft(draft.prospectId, draft.id, editedText, draft.channel || undefined);
                        await fetchPendingDrafts();
                      } catch {
                        btn.disabled = false;
                      }
                    }}
                    className="flex items-center gap-1 px-3 py-1 rounded-lg text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Send className="w-3 h-3" /> {draft.messageType === 'connection_note' ? 'Send Connection' : draft.channel === 'email' ? 'Send Email' : 'Send DM'}
                  </button>
                  <button
                    onClick={async (e) => {
                      const btn = e.currentTarget;
                      btn.disabled = true;
                      await rejectDraft(draft.prospectId, draft.id);
                      await fetchPendingDrafts();
                    }}
                    className="flex items-center gap-1 px-3 py-1 rounded-lg text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Commenting Cohort — bulk add + active list */}
      <div className="bg-zinc-900/90 border border-cyan-500/20 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-semibold text-cyan-400">Commenting Cohort</span>
            <span className="text-[11px] text-zinc-500">{activeCohort.length} active · target 30-50 for daily depth</span>
          </div>
          <button
            onClick={() => setShowCohort((v) => !v)}
            className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {showCohort ? '▼ Hide active list' : '▶ Show active list'}
          </button>
        </div>

        <div className="bg-zinc-800/40 border border-zinc-700/30 rounded-xl p-3">
          <p className="text-[11px] text-zinc-500 mb-2">Bulk-add LinkedIn URLs (one per line). Each will be enriched via UniPile and added as <span className="text-emerald-400 font-medium">active</span>.</p>
          <textarea
            value={bulkUrls}
            onChange={(e) => setBulkUrls(e.target.value)}
            rows={4}
            placeholder={'https://linkedin.com/in/jane-founder\nhttps://linkedin.com/in/john-partner\n...'}
            className="w-full text-xs text-zinc-300 bg-zinc-900/60 border border-zinc-700/30 rounded-lg p-2.5 font-mono resize-y focus:outline-none focus:border-cyan-500/40"
          />
          <div className="flex items-center justify-between gap-2 mt-2">
            <span className="text-[10px] text-zinc-500">{bulkUrls.split('\n').filter((u) => u.trim()).length} URL(s) ready</span>
            <button
              onClick={async () => {
                const urls = bulkUrls.split('\n').map((u) => u.trim()).filter(Boolean);
                await addCommentingTargets(urls);
                setBulkUrls('');
              }}
              disabled={!bulkUrls.trim()}
              className="px-3 py-1 rounded-lg text-[11px] font-medium bg-cyan-500/15 text-cyan-400 border border-cyan-500/25 hover:bg-cyan-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Add to cohort →
            </button>
          </div>
        </div>

        {showCohort && (
          activeCohort.length === 0 ? (
            <div className="text-xs text-zinc-500 text-center py-3">No active targets yet — paste URLs above to start.</div>
          ) : (
            <div className="overflow-x-auto -mx-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                    <th className="text-left px-3 py-2">Name</th>
                    <th className="text-left px-3 py-2">Vertical</th>
                    <th className="text-left px-3 py-2">Title @ Company</th>
                    <th className="text-left px-3 py-2">Source</th>
                    <th className="text-center px-3 py-2 w-28">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40">
                  {activeCohort.map((t) => (
                    <tr key={t.id}>
                      <td className="px-3 py-2 text-zinc-200">
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-[160px]" title={t.name}>{t.name}</span>
                          {t.linkedinUrl && (
                            <a href={t.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400/60 hover:text-blue-400" title="LinkedIn">
                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2"><span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">{t.vertical || '—'}</span></td>
                      <td className="px-3 py-2 text-zinc-400 truncate max-w-[260px]" title={[t.title, t.company].filter(Boolean).join(' @ ')}>
                        {[t.title, t.company].filter(Boolean).join(' @ ') || '—'}
                      </td>
                      <td className="px-3 py-2 text-[10px] text-zinc-500 font-mono">{t.source || '—'}</td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => pauseCommentingTarget(t.id)} className="text-[10px] text-amber-400/80 hover:text-amber-400 mr-2">pause</button>
                        <button onClick={() => dropActiveCommentingTarget(t.id)} className="text-[10px] text-red-400/80 hover:text-red-400">drop</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Proposed Commenting Targets — review queue */}
      {proposedTargets.length > 0 && (
        <div className="bg-zinc-900/90 border border-cyan-500/20 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-semibold text-cyan-400">{proposedTargets.length} Commenting Target{proposedTargets.length > 1 ? 's' : ''} Proposed</span>
            <span className="text-[9px] text-zinc-500">approve to start drafting comments on their posts</span>
          </div>
          <div className="space-y-2">
            {proposedTargets.map((t) => (
              <div key={t.id} className="bg-zinc-800/50 border border-zinc-700/30 rounded-xl p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-zinc-200 truncate">{t.name}</span>
                      {t.vertical && <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">{t.vertical}</span>}
                      {t.priority != null && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border ${t.priority <= 2 ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' : t.priority <= 3 ? 'bg-amber-500/15 text-amber-400 border-amber-500/25' : 'bg-zinc-500/15 text-zinc-400 border-zinc-500/25'}`}>p{t.priority}</span>
                      )}
                      {t.linkedinUrl && (
                        <a href={t.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400/60 hover:text-blue-400 shrink-0" title="LinkedIn">
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                        </a>
                      )}
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">{[t.title, t.company].filter(Boolean).join(' @ ') || ''}</div>
                    {t.notes && <div className="text-[11px] text-zinc-400 mt-1 italic">{t.notes}</div>}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      onClick={async () => { await approveCommentingTarget(t.id); }}
                      className="px-3 py-1 rounded-lg text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={async () => { await rejectCommentingTarget(t.id); }}
                      className="px-3 py-1 rounded-lg text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                    >
                      Drop
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comment Draft Review Queue */}
      {commentDrafts.length > 0 && (
        <div className="bg-zinc-900/90 border border-purple-500/20 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-semibold text-purple-400">{commentDrafts.length} Comment Draft{commentDrafts.length > 1 ? 's' : ''} Awaiting Review</span>
            <span className="text-[9px] text-zinc-500">seed commenting_targets to generate drafts automatically</span>
          </div>
          <div className="space-y-3">
            {commentDrafts.map((draft) => (
              <div key={draft.id} className="bg-zinc-800/50 border border-zinc-700/30 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-zinc-200">{draft.targetName || 'Unknown target'}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">LinkedIn Comment</span>
                  </div>
                  <span className="text-[10px] text-zinc-500">{draft.draftedAt ? timeAgo(draft.draftedAt) : ''}</span>
                </div>
                {draft.postExcerpt && (
                  <p className="text-[10px] text-zinc-500 italic mb-2 truncate" title={draft.postExcerpt}>
                    Post: {draft.postExcerpt.slice(0, 120)}{draft.postExcerpt.length > 120 ? '...' : ''}
                  </p>
                )}
                <textarea
                  defaultValue={draft.commentText}
                  id={`comment-draft-${draft.id}`}
                  rows={Math.min(5, Math.max(2, draft.commentText.split('\n').length + 1))}
                  className="w-full text-xs text-zinc-300 mb-3 whitespace-pre-wrap leading-relaxed bg-zinc-900/60 border border-zinc-700/30 rounded-lg p-2.5 resize-y focus:outline-none focus:border-zinc-600"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={async (e) => {
                      const btn = e.currentTarget;
                      btn.disabled = true;
                      const textarea = document.getElementById(`comment-draft-${draft.id}`) as HTMLTextAreaElement;
                      const editedText = textarea?.value || draft.commentText;
                      try {
                        await approveCommentDraft(draft.id, editedText);
                      } catch {
                        btn.disabled = false;
                      }
                    }}
                    className="flex items-center gap-1 px-3 py-1 rounded-lg text-[11px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Send className="w-3 h-3" /> Approve
                  </button>
                  <button
                    onClick={async (e) => {
                      const btn = e.currentTarget;
                      btn.disabled = true;
                      try {
                        await rejectCommentDraft(draft.id);
                      } catch {
                        btn.disabled = false;
                      }
                    }}
                    className="flex items-center gap-1 px-3 py-1 rounded-lg text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Skip
                  </button>
                  {draft.postUrl && (
                    <a href={draft.postUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-zinc-500 hover:text-zinc-300 ml-auto transition-colors">
                      View post ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const inboxTab = (
    <InboxTab
      prospects={prospects}
      messages={messages}
      fetchMessages={fetchMessages}
      onSelectProspect={setSelectedProspect}
    />
  );

  const healthTab = (
    <div className="space-y-4">
      {!featureFlags.outreach_enabled && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5 text-xs text-amber-400">
          Outreach automation paused. Manual actions still work.
        </div>
      )}

      {/* Workflow error banner — only shown when something errored AND not acknowledged */}
      {(() => {
        const errored = Object.entries(workflowHealth).filter(([, h]) =>
          h.lastStatus === 'error' && !h.errorAcknowledged
        );
        if (errored.length === 0) return null;
        const wfNames: Record<string, string> = {
          '35HJE7eOpvEdxRwq': 'Import + Enrich', 'kr2lSH1eRGZcDWmO': 'Warm-up', 'wBBL75oqWcTf78yp': 'Trigger Research',
          '5ZXtArhobWrDDpfJ': 'Connect', 'joU7VaM5OiRAwLwP': 'DM Sequence', 'KWxb6JFdpvb3y8w5': 'Monitor',
          'kFYlfnWd98YaiErH': 'Send Messages', 'VaP0RnmFlhkfKE4V': 'Auto Comments — Post Fetch',
          '9q4bhlIBQCiCxQpq': 'Auto Comments — Drafter', '2AVRUQLoxCIXCzT0': 'Auto Comments — Sender',
        };
        const friendlyError = (wfId: string, err: string): { label: string; detail?: string } | null => {
          if (wfId === 'VaP0RnmFlhkfKE4V' && /403|usage hard limit|platform-feature-disabled/i.test(err)) {
            return { label: 'Auto comments suspended — Apify credits depleted', detail: 'Resumes when monthly Apify quota resets (or top up Apify plan).' };
          }
          if (/403/i.test(err)) {
            return { label: 'API access denied (403)', detail: 'Likely UniPile/Apify credential rotation. Check the workflow node credentials.' };
          }
          return null;
        };
        const acknowledge = async (rowId: string | null) => {
          if (!rowId) return;
          try {
            const { dashboardAction } = await import('../../lib/dashboardActions');
            await dashboardAction('dashboard_workflow_stats', rowId, 'error_acknowledged', 'true');
            refresh();
          } catch (e) { /* swallow */ }
        };
        return (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-sm font-medium text-red-300">{errored.length} workflow{errored.length > 1 ? 's' : ''} erroring</span>
            </div>
            <div className="space-y-2">
              {errored.map(([wfId, h]) => {
                const friendly = h.lastError ? friendlyError(wfId, h.lastError) : null;
                return (
                  <div key={wfId} className="text-xs flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="text-red-300 font-medium">{friendly ? friendly.label : (wfNames[wfId] || wfId)}</span>
                      <span className="text-zinc-500"> · {h.lastExecutionAt ? timeAgo(h.lastExecutionAt) : 'no runs'}</span>
                      {friendly?.detail ? (
                        <p className="text-[10px] text-zinc-400 mt-0.5 ml-1">{friendly.detail}</p>
                      ) : (
                        h.lastError && (
                          <p className="text-[10px] text-red-400/80 font-mono mt-0.5 ml-1 break-all">{h.lastError.slice(0, 200)}</p>
                        )
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                      <a
                        href={`https://n8n.ivanmanfredi.com/workflow/${wfId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] uppercase tracking-wider text-red-300 hover:text-red-200 underline underline-offset-2"
                      >
                        Open in n8n
                      </a>
                      <button
                        onClick={() => acknowledge(h.statsRowId)}
                        className="text-[10px] uppercase tracking-wider text-zinc-400 hover:text-zinc-200 px-1.5 py-0.5 border border-zinc-700/60 rounded"
                        title="Hide this error until it next fires"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Auto-Send First Contact - top-level visibility */}
      <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex items-center gap-2 mr-2">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Auto-Send 1st Touch</span>
        </div>
        {([
          { key: 'outreach_auto_send_linkedin', label: 'LinkedIn DMs' },
          { key: 'outreach_auto_send_email', label: 'Cold Emails' },
        ]).map((row) => {
          const on = featureFlags[row.key] ?? false;
          return (
            <label key={row.key} className="flex items-center gap-2 cursor-pointer select-none">
              <button
                onClick={() => toggleFeatureFlag(row.key)}
                className={`relative w-10 h-5 rounded-full transition-colors ${on ? 'bg-amber-500' : 'bg-zinc-700'}`}
                title={on ? 'Auto-send ON - drafts skip approval' : 'Manual approval required'}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  on ? 'translate-x-[22px]' : 'translate-x-0.5'
                }`} />
              </button>
              <span className={`text-xs font-medium ${on ? 'text-amber-400' : 'text-zinc-400'}`}>{row.label}</span>
            </label>
          );
        })}
        <span className="text-[10px] text-zinc-500 ml-auto">When ON, first-contact drafts ship without approval. Follow-ups still need approval.</span>
      </div>

      {/* Pending-invite ceiling gauge */}
      <PendingInviteGauge pending={stats.connectionSent} ceiling={pendingCeiling} />

      {/* Section 2b: Daily Activity Limits */}
      <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-zinc-200">Today&apos;s Activity</span>
          </div>
          <span className="text-[10px] text-zinc-500">Daily limits enforced by LinkedIn safety layer</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {([
            { key: 'connection_request', label: 'Connections', defaultLimit: 20, icon: '🤝', queueKey: 'connection_request' as const },
            { key: 'dm', label: 'DMs', defaultLimit: 30, icon: '💬', queueKey: 'dm' as const },
          ]).map(({ key, label, defaultLimit, icon, queueKey }) => {
            const rl = rateLimits[key];
            const count = rl?.count || 0;
            const limit = rl?.daily_limit || defaultLimit;
            const pct = Math.min((count / limit) * 100, 100);
            const barColor = pct < 50 ? 'bg-emerald-500' : pct < 80 ? 'bg-amber-500' : 'bg-red-500';
            const textColor = pct >= 80 ? 'text-red-400' : pct >= 50 ? 'text-amber-400' : 'text-zinc-300';
            const queued = queueKey ? cappedQueue[queueKey] : 0;

            // Compute time until UTC midnight reset
            let resetIn = '';
            if (count >= limit) {
              const now = new Date();
              const utcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
              const ms = utcMidnight.getTime() - now.getTime();
              const h = Math.floor(ms / 3600000);
              const m = Math.floor((ms % 3600000) / 60000);
              resetIn = h > 0 ? `${h}h ${m}m` : `${m}m`;
            }

            return (
              <div key={key} className="bg-zinc-800/40 border border-zinc-700/30 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-zinc-400">{icon} {label}</span>
                  <span className={`text-sm font-mono font-semibold ${textColor}`}>{count}<span className="text-zinc-600">/{limit}</span></span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                </div>
                {count >= limit && (
                  <p className="text-[9px] text-red-400 mt-1 leading-tight">
                    Cap reached
                    {queued > 0 && <> · <span className="text-amber-300">{queued} queued</span></>}
                    <br />
                    Resets in {resetIn}
                  </p>
                )}
                {count < limit && queueKey && queued > 0 && (
                  <p className="text-[9px] text-zinc-500 mt-1">{queued} approved waiting</p>
                )}
              </div>
            );
          })}
          {/* Emails - uncapped, just informational */}
          <div className="bg-zinc-800/40 border border-zinc-700/30 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-zinc-400">✉️ Emails Sent</span>
              <span className="text-sm font-mono font-semibold text-zinc-300">{stats.emailsSentToday}</span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: stats.emailsSentToday > 0 ? '100%' : '2%' }} />
            </div>
            <p className="text-[9px] text-zinc-500 mt-1">First-touch + follow-ups, no daily cap</p>
          </div>
        </div>
      </div>

      {/* Recent Activity — system events filtered by default */}
      <ActivityFeed events={recentActivity} prospects={prospects} />

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
            {/* Master Switch - prominent */}
            <div className={`flex items-center justify-between rounded-xl px-4 py-3 border ${
              featureFlags['outreach_enabled']
                ? 'bg-emerald-500/10 border-emerald-500/20'
                : 'bg-zinc-800/60 border-zinc-700/40'
            }`}>
              <div>
                <p className="text-sm font-medium text-zinc-200">Master Switch</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {featureFlags['outreach_enabled'] ? 'System is active - workflows will execute' : 'System paused - all automation stopped'}
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
                      { id: '35HJE7eOpvEdxRwq', name: 'Import + Enrich', schedule: 'Webhook', flag: null, desc: 'Apollo search + enrich, ICP scoring (≥7)' },
                      { id: 'kr2lSH1eRGZcDWmO', name: 'Warm-up', schedule: '2h', flag: 'outreach_auto_warmup', desc: 'Likes, reacts, profile views' },
                      { id: 'wBBL75oqWcTf78yp', name: 'Trigger Research', schedule: '12h + on-graduate', flag: null, desc: 'Per-prospect research, generates draft' },
                      { id: '5ZXtArhobWrDDpfJ', name: 'Connect', schedule: '4h', flag: 'outreach_auto_connect', desc: 'Connection notes (peer voice, no questions)' },
                      { id: 'joU7VaM5OiRAwLwP', name: 'DM Sequence', schedule: '30m', flag: 'outreach_auto_dm', desc: '3-DM sequence (warm → owned opinion → soft offer)' },
                      { id: 'KWxb6JFdpvb3y8w5', name: 'Monitor', schedule: '15m', flag: null, desc: 'Reply detection (engaged + connected stages) + alerts' },
                      { id: 'kFYlfnWd98YaiErH', name: 'Send Messages', schedule: '2m', flag: null, desc: 'Email + LinkedIn sender (cap-aware)' },
                      { id: 'VaP0RnmFlhkfKE4V', name: 'Auto Comments — Post Fetch', schedule: 'Daily 06:00 UTC', flag: null, desc: 'Apify pulls fresh posts from your ICP cohort (feeds the Drafter). Suspends if Apify credits run out.' },
                      { id: '9q4bhlIBQCiCxQpq', name: 'Auto Comments — Drafter', schedule: '2h', flag: 'outreach_auto_comment', desc: 'Generates comment drafts on cohort posts in Ivan\'s voice (approve before send)' },
                      { id: '2AVRUQLoxCIXCzT0', name: 'Auto Comments — Sender', schedule: '30m', flag: 'outreach_auto_comment_send', desc: 'Posts approved comment drafts via UniPile — enable only after reviewing drafts' },
                    ].map((wf) => {
                      const isActive = workflowStatuses[wf.id] ?? false;
                      const flagOn = wf.flag ? (featureFlags[wf.flag] ?? false) : true;
                      const fullyOn = isActive && flagOn;
                      const health = workflowHealth[wf.id];
                      const hasError = health?.lastStatus === 'error';
                      const lastRunAgo = health?.lastExecutionAt ? timeAgo(health.lastExecutionAt) : null;

                      return (
                        <tr key={wf.id} className={`group hover:bg-zinc-800/30 ${hasError ? 'bg-red-500/5' : ''}`}>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1.5">
                              {hasError && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
                              <p className="text-xs text-zinc-200 font-medium">{wf.name}</p>
                              {(health?.errorCount24h ?? 0) > 0 && (
                                <span className="text-[9px] bg-red-500/20 text-red-300 px-1 py-0.5 rounded">{health!.errorCount24h} err/24h</span>
                              )}
                            </div>
                            <p className="text-[10px] text-zinc-500 mt-0.5">{wf.desc}</p>
                            {lastRunAgo && (
                              <p className="text-[10px] text-zinc-600 mt-0.5">
                                last run: <span className={hasError ? 'text-red-400' : 'text-zinc-500'}>{lastRunAgo}{hasError ? ' · errored' : ''}</span>
                              </p>
                            )}
                            {hasError && health?.lastError && (
                              <p className="text-[10px] text-red-400/80 mt-1 font-mono leading-tight" title={health.lastError}>
                                {health.lastError.slice(0, 120)}{health.lastError.length > 120 ? '…' : ''}
                              </p>
                            )}
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
                              <span className="text-[10px] text-zinc-500">-</span>
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
              <p className="text-[10px] text-zinc-500 mt-3 px-1">
                n8n = workflow trigger active in n8n. Flag = code logic enabled. Both must be on for automation to run.
              </p>
            </PanelCard>

            {/* Rate limits (detail view - summary shown above) */}
            <PanelCard title="Rate Limits" accent="blue">
              <div className="space-y-2">
                {['profile_view', 'like', 'connection_request', 'dm'].map((action) => {
                  const rl = rateLimits[action];
                  const count = rl?.count || 0;
                  const limit = rl?.daily_limit || (action === 'profile_view' ? 50 : action === 'like' ? 20 : action === 'connection_request' ? 20 : 30);
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


    </div>
  );

  const overviewTab = (
    <OverviewTab
      prospects={prospects}
      hotDomains={feeds.hotDomains}
      bandsTotal={feeds.bands.total}
      bandsHot={feeds.bands.hot}
      onPickFeed={(f) => { setFeedFilter(f); changeTab('pipeline'); }}
    />
  );

  const sourcesTab = (
    <SourcesTab
      harvestSources={feeds.harvestSources}
      hiringMap={feeds.hiringMap}
      bands={feeds.bands}
      recentHotDomains={feeds.recentHotDomains}
      prospects={prospects}
      hotDomains={feeds.hotDomains}
      onSetStatus={feeds.setHarvestStatus}
      onAddSource={feeds.addHarvestSource}
    />
  );

  const activeTab = tab === 'overview' ? overviewTab
    : tab === 'sources' ? sourcesTab
    : tab === 'review' ? reviewTab
    : tab === 'inbox' ? inboxTab
    : (
      <>
        {pipelineTab}
        <div className="pt-3 mt-3 border-t border-zinc-800/60">
          <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500 font-semibold mb-3">System Health</p>
          {healthTab}
        </div>
      </>
    );

  return (
    <div className="space-y-4">
      {/* Header */}
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

      <SubTabs>
        {TAB_ORDER.map((t) => (
          <SubTab
            key={t}
            id={t}
            active={tab}
            onChange={(id) => changeTab(id as OutreachTab)}
            badge={t === 'review' && reviewCount > 0 ? { count: reviewCount, severity: 'warn' } : undefined}
          >
            {TAB_LABELS[t]}
          </SubTab>
        ))}
      </SubTabs>

      <PanelErrorBoundary label={tab}>
        {activeTab}
      </PanelErrorBoundary>

      {/* Detail Modal — cross-tab */}
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
          onToggleNeedsReply={toggleNeedsReply}
          onSendDm={sendManualDm}
          onApproveDraft={approveDraft}
          onRejectDraft={rejectDraft}
          onFetchMessages={fetchMessages}
          onFetchEngagements={fetchEngagementLog}
        />
      )}
    </div>
  );
};

export default OutreachPanel;
