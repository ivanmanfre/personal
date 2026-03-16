import React, { useState } from 'react';
import { Swords, Lightbulb, Heart, MessageCircle, Repeat2, Star, CheckCircle2 } from 'lucide-react';
import { useCompetitors } from '../../hooks/useCompetitors';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import EmptyState from './shared/EmptyState';

const CompetitorIntelPanel: React.FC = () => {
  const { posts, competitorStats, opportunities, loading, refresh, markOpportunityActioned } = useCompetitors();
  const { lastRefreshed } = useAutoRefresh(refresh);
  const [selectedCompetitor, setSelectedCompetitor] = useState<string>('all');
  const [showOpportunities, setShowOpportunities] = useState(false);

  if (loading) return <LoadingSkeleton cards={4} rows={6} />;

  if (competitorStats.length === 0) {
    return <EmptyState title="No competitor data" description="Competitor scraping workflow will populate this panel." icon={<Swords className="w-10 h-10" />} />;
  }

  const displayPosts = showOpportunities
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
          <button key={c.id} onClick={() => { setSelectedCompetitor(c.competitorName); setShowOpportunities(false); }}
            className={`bg-zinc-900/80 border rounded-xl p-4 text-left transition-all duration-150 hover:bg-zinc-800/40 ${selectedCompetitor === c.competitorName ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-zinc-800/80'}`}>
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
        <button onClick={() => { setSelectedCompetitor('all'); setShowOpportunities(false); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${!showOpportunities && selectedCompetitor === 'all' ? 'bg-zinc-700/80 text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}>
          All Posts ({posts.length})
        </button>
        <button onClick={() => setShowOpportunities(true)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 flex items-center gap-1.5 ${showOpportunities ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}>
          <Lightbulb className="w-3 h-3" /> Opportunities ({opportunities.length})
        </button>
      </div>

      {/* Posts table */}
      <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl shadow-sm shadow-black/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800/40 bg-zinc-800/20 text-left">
                <th className="px-4 py-3 text-[11px] text-zinc-500 font-medium uppercase tracking-wider">Competitor</th>
                <th className="px-4 py-3 text-[11px] text-zinc-500 font-medium uppercase tracking-wider">Post</th>
                <th className="px-4 py-3 text-[11px] text-zinc-500 font-medium uppercase tracking-wider">Engagement</th>
                <th className="px-4 py-3 text-[11px] text-zinc-500 font-medium uppercase tracking-wider hidden md:table-cell">Topic</th>
                {showOpportunities && <th className="px-4 py-3 text-[11px] text-zinc-500 font-medium uppercase tracking-wider">Opportunity</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40">
              {displayPosts.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-zinc-600 text-center">No posts found</td></tr>
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
                    {showOpportunities && (
                      <td className="px-4 py-3">
                        <p className="text-xs text-amber-300/90 max-w-xs">{p.theOpportunity}</p>
                        {p.suggestedAngle && <p className="text-[11px] text-zinc-500 mt-0.5">Angle: {p.suggestedAngle}</p>}
                        <button
                          onClick={() => markOpportunityActioned(p.id)}
                          className="mt-1.5 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                        >
                          <CheckCircle2 className="w-2.5 h-2.5" /> Done
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CompetitorIntelPanel;
