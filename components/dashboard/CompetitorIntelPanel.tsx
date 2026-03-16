import React, { useState, useMemo } from 'react';
import { Swords, Lightbulb, Heart, MessageCircle, Repeat2, Star, CheckCircle2, Zap, FileText, TrendingUp } from 'lucide-react';
import { useCompetitors } from '../../hooks/useCompetitors';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import EmptyState from './shared/EmptyState';
import PanelCard from './shared/PanelCard';

const CompetitorIntelPanel: React.FC = () => {
  const { posts, patterns, competitorStats, opportunities, loading, refresh, markOpportunityActioned } = useCompetitors();
  const { lastRefreshed } = useAutoRefresh(refresh);
  const [selectedCompetitor, setSelectedCompetitor] = useState<string>('all');
  const [tab, setTab] = useState<'posts' | 'opportunities' | 'patterns'>('opportunities');

  // Top hook patterns across all competitors
  const topHooks = useMemo(() => {
    const counts: Record<string, number> = {};
    posts.forEach((p) => { if (p.hookPattern) counts[p.hookPattern] = (counts[p.hookPattern] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [posts]);

  // Top topic categories
  const topTopics = useMemo(() => {
    const counts: Record<string, number> = {};
    posts.forEach((p) => { if (p.topicCategory) counts[p.topicCategory] = (counts[p.topicCategory] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [posts]);

  if (loading) return <LoadingSkeleton cards={4} rows={6} />;

  if (competitorStats.length === 0) {
    return <EmptyState title="No competitor data" description="Competitor scraping workflow will populate this panel." icon={<Swords className="w-10 h-10" />} />;
  }

  const displayPosts = tab === 'opportunities'
    ? opportunities
    : selectedCompetitor === 'all'
      ? posts.slice(0, 50)
      : posts.filter((p) => p.competitorName === selectedCompetitor).slice(0, 50);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Competitor Intelligence</h1>
        <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
      </div>

      {/* Competitor profiles grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {competitorStats.map((c) => (
          <button key={c.id} onClick={() => { setSelectedCompetitor(c.competitorName); setTab('posts'); }}
            className={`bg-zinc-900/80 border rounded-xl p-4 text-left transition-all duration-150 hover:bg-zinc-800/40 ${selectedCompetitor === c.competitorName && tab === 'posts' ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-zinc-800/80'}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-zinc-200 truncate">{c.competitorName}</p>
              <span className="text-[11px] text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded">{c.postCount} posts</span>
            </div>
            <div className="flex gap-4 text-xs text-zinc-500">
              <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-pink-400/60" /> ~{c.avgLikes}</span>
              <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3 text-blue-400/60" /> ~{c.avgComments}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => { setTab('opportunities'); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 flex items-center gap-1.5 ${tab === 'opportunities' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}>
          <Lightbulb className="w-3 h-3" /> Opportunities ({opportunities.length})
        </button>
        <button onClick={() => { setTab('patterns'); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 flex items-center gap-1.5 ${tab === 'patterns' ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}>
          <TrendingUp className="w-3 h-3" /> Patterns
        </button>
        <button onClick={() => { setSelectedCompetitor('all'); setTab('posts'); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${tab === 'posts' && selectedCompetitor === 'all' ? 'bg-zinc-700/80 text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}>
          All Posts ({posts.length})
        </button>
      </div>

      {/* Opportunities as CTA cards */}
      {tab === 'opportunities' && (
        <div className="space-y-3">
          {opportunities.length === 0 ? (
            <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl p-8 text-center text-zinc-500 text-sm">No active opportunities</div>
          ) : (
            opportunities.map((p) => (
              <div key={p.id} className="bg-zinc-900/90 border border-zinc-800/60 rounded-xl p-4 hover:border-amber-500/20 transition-all group">
                <div className="flex items-start gap-4">
                  <div className="shrink-0 w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    <Lightbulb className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-amber-300/90 font-medium leading-snug">{p.theOpportunity}</p>
                    <p className="text-xs text-zinc-500 mt-1 truncate" title={p.postText.slice(0, 200)}>
                      {p.competitorName} · {p.postDate ? new Date(p.postDate).toLocaleDateString() : '—'}
                    </p>
                    <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                      {p.suggestedAngle && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                          <Zap className="w-3 h-3" /> {p.suggestedAngle}
                        </span>
                      )}
                      {p.suggestedFormat && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20">
                          <FileText className="w-3 h-3" /> {p.suggestedFormat}
                        </span>
                      )}
                      <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                        <span className="flex items-center gap-0.5"><Heart className="w-3 h-3 text-pink-400/60" />{p.likesCount}</span>
                        <span className="flex items-center gap-0.5"><MessageCircle className="w-3 h-3 text-blue-400/60" />{p.commentsCount}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => markOpportunityActioned(p.id)}
                    className="shrink-0 p-2 rounded-lg text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                    title="Mark as actioned"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Patterns tab */}
      {tab === 'patterns' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Hook patterns */}
          <PanelCard title="Top Hook Patterns" icon={<Zap className="w-3.5 h-3.5" />} badge={topHooks.length} accent="cyan">
            <div className="p-4 space-y-2">
              {topHooks.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-4">No hook patterns detected</p>
              ) : (
                topHooks.map(([hook, count]) => {
                  const pct = (count / (topHooks[0]?.[1] || 1)) * 100;
                  return (
                    <div key={hook}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-zinc-300 truncate mr-2">{hook}</span>
                        <span className="text-zinc-500 shrink-0">{count}</span>
                      </div>
                      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-cyan-500/70 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </PanelCard>

          {/* Topic distribution */}
          <PanelCard title="Topic Distribution" icon={<TrendingUp className="w-3.5 h-3.5" />} badge={topTopics.length} accent="purple">
            <div className="p-4 space-y-2">
              {topTopics.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-4">No topic data</p>
              ) : (
                topTopics.map(([topic, count]) => {
                  const pct = (count / (topTopics[0]?.[1] || 1)) * 100;
                  return (
                    <div key={topic}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-zinc-300 truncate mr-2">{topic}</span>
                        <span className="text-zinc-500 shrink-0">{count}</span>
                      </div>
                      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-purple-500/70 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </PanelCard>

          {/* Per-competitor pattern summaries */}
          {patterns.filter((p) => p.patternText).map((p) => (
            <div key={p.id} className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl p-4 lg:col-span-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold text-zinc-200">{p.competitorName}</span>
                <span className="text-[11px] text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded">{p.postCount} posts analyzed</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-line">{p.patternText}</p>
            </div>
          ))}
        </div>
      )}

      {/* Posts table (all posts / filtered by competitor) */}
      {tab === 'posts' && (
        <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl shadow-sm shadow-black/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800/40 bg-zinc-800/20 text-left">
                  <th className="px-4 py-3 text-[11px] text-zinc-500 font-medium uppercase tracking-wider">Competitor</th>
                  <th className="px-4 py-3 text-[11px] text-zinc-500 font-medium uppercase tracking-wider">Post</th>
                  <th className="px-4 py-3 text-[11px] text-zinc-500 font-medium uppercase tracking-wider">Engagement</th>
                  <th className="px-4 py-3 text-[11px] text-zinc-500 font-medium uppercase tracking-wider hidden md:table-cell">Topic</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {displayPosts.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-10 text-zinc-600 text-center">No posts found</td></tr>
                ) : (
                  displayPosts.map((p) => (
                    <tr key={p.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">{p.competitorName.split(' ')[0]}</td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-zinc-300 truncate max-w-xs" title={p.postText.slice(0, 200)}>{p.postText.slice(0, 80)}</p>
                        <p className="text-[11px] text-zinc-600 mt-0.5">{p.postDate ? new Date(p.postDate).toLocaleDateString() : '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5 text-[11px]">
                          <span className="flex items-center gap-0.5 text-pink-400/70"><Heart className="w-3 h-3" />{p.likesCount}</span>
                          <span className="flex items-center gap-0.5 text-blue-400/70"><MessageCircle className="w-3 h-3" />{p.commentsCount}</span>
                          <span className="flex items-center gap-0.5 text-zinc-500"><Repeat2 className="w-3 h-3" />{p.repostsCount}</span>
                          {p.isTopPerformer && <Star className="w-3 h-3 text-amber-400" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-zinc-500 hidden md:table-cell">{p.topicCategory || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompetitorIntelPanel;
