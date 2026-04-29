import React, { useState } from 'react';
import { Brain, Search, Database, FileText, Sparkles, AlertTriangle, ChevronDown, ChevronRight, Layers } from 'lucide-react';
import { useBrainStats, type SessionLog, type CompactionReview } from '../../hooks/useBrainStats';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import StatCard from './shared/StatCard';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import PanelCard from './shared/PanelCard';
import EmptyState from './shared/EmptyState';
import { timeAgo } from './shared/utils';

const tierColors: Record<string, string> = {
  global: 'text-emerald-400',
  'shared-tech': 'text-cyan-400',
  ivan: 'text-violet-400',
  secondmile: 'text-blue-400',
  agencyops: 'text-amber-400',
  lemonade: 'text-pink-400',
  proswppp: 'text-orange-400',
  reeder: 'text-purple-400',
};

const SessionLogCard: React.FC<{ log: SessionLog }> = ({ log }) => {
  const [expanded, setExpanded] = useState(false);
  const color = tierColors[log.client_id] || 'text-zinc-400';
  return (
    <div className="border border-zinc-800/60 rounded-lg overflow-hidden hover:border-zinc-700/60 transition-colors">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-zinc-800/30 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
        )}
        <span className={`text-xs font-mono px-1.5 py-0.5 rounded bg-zinc-800/60 ${color} shrink-0`}>{log.client_id}</span>
        <span className="text-sm text-zinc-200 truncate flex-1">{log.topic}</span>
        <span className="text-xs text-zinc-500 shrink-0 hidden sm:inline">{log.date}</span>
      </button>
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-zinc-800/40 bg-zinc-950/40">
          <pre className="text-xs text-zinc-400 whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">{log.content}</pre>
        </div>
      )}
    </div>
  );
};

const ReviewCard: React.FC<{ review: CompactionReview }> = ({ review }) => {
  const [expanded, setExpanded] = useState(false);
  const color = tierColors[review.client_id] || 'text-zinc-400';
  return (
    <div className="border border-amber-500/20 rounded-lg overflow-hidden bg-amber-500/[0.03]">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-amber-500/[0.06] transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-amber-500 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-amber-500 shrink-0" />
        )}
        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
        <span className={`text-xs font-mono px-1.5 py-0.5 rounded bg-zinc-800/60 ${color} shrink-0`}>{review.client_id}</span>
        <span className="text-sm text-zinc-200 flex-1">
          {review.proposalCount} proposal{review.proposalCount === 1 ? '' : 's'} pending
        </span>
        <span className="text-xs text-zinc-500 shrink-0 hidden sm:inline">
          {review.generatedAt ? timeAgo(review.generatedAt) : ''}
        </span>
      </button>
      {expanded && (
        <div className="px-4 pb-3 pt-1 border-t border-amber-500/15 bg-amber-500/[0.02] space-y-2">
          {review.proposals.map((p, i) => (
            <div key={i} className="text-xs space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20 text-[10px] uppercase tracking-wider">{p.type}</span>
                <span className="text-zinc-300 font-medium">{p.files}</span>
              </div>
              <p className="text-zinc-400 pl-2 leading-relaxed">{p.reason}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const BrainPanel: React.FC = () => {
  const { tierCounts, sessionLogs, reviews, loading, searching, searchResults, searchError, search, clearSearch, refresh } = useBrainStats();
  const { lastRefreshed } = useAutoRefresh(refresh, { realtimeTables: ['claude_memory'] });
  const [query, setQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('');

  const totalRows = tierCounts.reduce((s, t) => s + t.count, 0);

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    search(query, tierFilter || undefined);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center">
            <Brain className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Brain</h1>
            <p className="text-xs text-zinc-500">Cross-project memory · Claude Code + n8nClaw shared layer</p>
          </div>
        </div>
        <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : (
        <>
          {/* Tier overview */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <StatCard
              label="Total memory rows"
              value={totalRows}
              icon={<Database className="w-5 h-5" />}
              color="text-violet-400"
              subValue={`${tierCounts.length} tier${tierCounts.length === 1 ? '' : 's'}`}
            />
            <StatCard
              label="Session logs"
              value={sessionLogs.length}
              icon={<FileText className="w-5 h-5" />}
              color="text-cyan-400"
              subValue={sessionLogs.length > 0 ? `latest ${timeAgo(sessionLogs[0].updated_at)}` : 'none yet'}
            />
            <StatCard
              label="Pending reviews"
              value={reviews.reduce((s, r) => s + r.proposalCount, 0)}
              icon={<AlertTriangle className="w-5 h-5" />}
              color={reviews.length > 0 ? 'text-amber-400' : 'text-zinc-400'}
              subValue={`across ${reviews.length} tier${reviews.length === 1 ? '' : 's'}`}
            />
            <StatCard
              label="Last sync"
              value={tierCounts.length > 0 ? timeAgo(tierCounts.map((t) => t.lastSync).filter(Boolean).sort().reverse()[0] as string) : '—'}
              icon={<Sparkles className="w-5 h-5" />}
              color="text-emerald-400"
              subValue="Stop hook"
            />
          </div>

          {/* Per-tier breakdown */}
          <PanelCard title="Memory tiers" icon={<Layers className="w-4 h-4" />} accent="purple">
            <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {tierCounts.map((t) => {
                const color = tierColors[t.client_id] || 'text-zinc-400';
                return (
                  <button
                    key={t.client_id}
                    onClick={() => setTierFilter(tierFilter === t.client_id ? '' : t.client_id)}
                    className={`text-left px-3 py-2 rounded-lg border transition-colors ${
                      tierFilter === t.client_id
                        ? 'bg-violet-500/10 border-violet-500/30'
                        : 'bg-zinc-800/30 border-zinc-800/60 hover:border-zinc-700/60'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-mono ${color}`}>{t.client_id}</span>
                    </div>
                    <div className="text-lg font-semibold text-zinc-200">{t.count}</div>
                    <div className="text-[10px] text-zinc-500">
                      {t.lastSync ? `synced ${timeAgo(t.lastSync)}` : 'never'}
                    </div>
                  </button>
                );
              })}
            </div>
          </PanelCard>

          {/* Search */}
          <PanelCard title="Ask the brain" icon={<Search className="w-4 h-4" />} accent="emerald">
            <div className="px-4 py-3 space-y-3">
              <form onSubmit={onSearchSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={tierFilter ? `Search in ${tierFilter}…` : 'workflow ID, vendor preference, ClickUp list, n8n quirk…'}
                  className="flex-1 px-3 py-2 bg-zinc-950/60 border border-zinc-800/60 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500/50"
                />
                <button
                  type="submit"
                  disabled={searching || !query.trim()}
                  className="px-4 py-2 bg-violet-500/15 hover:bg-violet-500/25 disabled:opacity-40 disabled:cursor-not-allowed border border-violet-500/30 rounded-lg text-sm text-violet-300 transition-colors"
                >
                  {searching ? 'Searching…' : 'Search'}
                </button>
                {(searchResults !== null || searchError) && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      clearSearch();
                    }}
                    className="px-3 py-2 text-sm text-zinc-500 hover:text-zinc-300"
                  >
                    Clear
                  </button>
                )}
              </form>

              {tierFilter && (
                <div className="text-xs text-zinc-500">
                  Filtered by tier: <span className="text-violet-400 font-mono">{tierFilter}</span>{' '}
                  <button onClick={() => setTierFilter('')} className="text-zinc-600 hover:text-zinc-400 underline ml-1">
                    clear filter
                  </button>
                </div>
              )}

              {searchError && <p className="text-sm text-red-400">{searchError}</p>}

              {searchResults !== null && (
                <div className="space-y-2">
                  {searchResults.length === 0 ? (
                    <p className="text-sm text-zinc-500">No matches.</p>
                  ) : (
                    searchResults.map((r, i) => {
                      const color = tierColors[r.client_id] || 'text-zinc-400';
                      return (
                        <div key={i} className="border border-zinc-800/60 rounded-lg px-3 py-2 bg-zinc-950/40">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-mono px-1.5 py-0.5 rounded bg-zinc-800/60 ${color}`}>{r.client_id}</span>
                            <span className="text-xs text-zinc-300 font-mono truncate">{r.file_path}</span>
                          </div>
                          <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3">{r.snippet}</p>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              <p className="text-[11px] text-zinc-600">
                Searches across all tiers + n8nClaw can query the same data via WhatsApp.
              </p>
            </div>
          </PanelCard>

          {/* Pending reviews */}
          {reviews.length > 0 && (
            <PanelCard title="Pending compaction proposals" icon={<AlertTriangle className="w-4 h-4" />} accent="amber" badge={reviews.reduce((s, r) => s + r.proposalCount, 0)}>
              <div className="px-4 py-3 space-y-2">
                {reviews.map((r, i) => <ReviewCard key={i} review={r} />)}
                <p className="text-[11px] text-zinc-600 pt-1">
                  Generated daily by memory-compactor LaunchAgent. Nothing auto-applies — review and act manually.
                </p>
              </div>
            </PanelCard>
          )}

          {/* Session logs */}
          <PanelCard title="Recent session logs" icon={<FileText className="w-4 h-4" />} accent="cyan" badge={sessionLogs.length}>
            <div className="px-4 py-3">
              {sessionLogs.length === 0 ? (
                <EmptyState icon={<FileText className="w-6 h-6" />} title="No session logs yet" description="Will populate after Claude Code sessions trigger the Stop hook." />
              ) : (
                <div className="space-y-2">
                  {sessionLogs.map((log) => <SessionLogCard key={log.id} log={log} />)}
                </div>
              )}
            </div>
          </PanelCard>
        </>
      )}
    </div>
  );
};

export default BrainPanel;
