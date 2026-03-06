import React, { useState } from 'react';
import { Swords, ExternalLink, Lightbulb } from 'lucide-react';
import { useCompetitors } from '../../hooks/useCompetitors';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import EmptyState from './shared/EmptyState';

const CompetitorIntelPanel: React.FC = () => {
  const { posts, competitorStats, opportunities, loading, refresh } = useCompetitors();
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
        <h1 className="text-2xl font-bold">Competitor Intelligence</h1>
        <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
      </div>

      {/* Competitor profiles grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {competitorStats.map((c) => (
          <button key={c.id} onClick={() => { setSelectedCompetitor(c.competitorName); setShowOpportunities(false); }}
            className={`bg-zinc-900 border rounded-xl p-4 text-left transition-colors ${selectedCompetitor === c.competitorName ? 'border-emerald-500/50' : 'border-zinc-800 hover:border-zinc-700'}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-zinc-200 truncate">{c.competitorName}</p>
              <span className="text-xs text-zinc-500">{c.postCount} posts</span>
            </div>
            <div className="flex gap-4 text-xs text-zinc-400">
              <span>~{c.avgLikes} avg likes</span>
              <span>~{c.avgComments} avg comments</span>
            </div>
          </button>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => { setSelectedCompetitor('all'); setShowOpportunities(false); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!showOpportunities && selectedCompetitor === 'all' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}>
          All Posts ({posts.length})
        </button>
        <button onClick={() => setShowOpportunities(true)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${showOpportunities ? 'bg-amber-500/20 text-amber-400' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}>
          <Lightbulb className="w-3 h-3" /> Opportunities ({opportunities.length})
        </button>
      </div>

      {/* Posts table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left">
                <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">Competitor</th>
                <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">Post</th>
                <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">Engagement</th>
                <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide hidden md:table-cell">Topic</th>
                {showOpportunities && <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">Opportunity</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {displayPosts.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-zinc-500 text-center">No posts found</td></tr>
              ) : (
                displayPosts.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-800/50 transition-colors">
                    <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">{p.competitorName.split(' ')[0]}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-zinc-300 truncate max-w-xs">{p.postText.slice(0, 80)}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{p.postDate ? new Date(p.postDate).toLocaleDateString() : '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-400">
                      <span>{p.likesCount}❤ {p.commentsCount}💬 {p.repostsCount}🔄</span>
                      {p.isTopPerformer && <span className="ml-1 text-amber-400">★</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500 hidden md:table-cell">{p.topicCategory || '—'}</td>
                    {showOpportunities && (
                      <td className="px-4 py-3">
                        <p className="text-xs text-amber-300 max-w-xs">{p.theOpportunity}</p>
                        {p.suggestedAngle && <p className="text-xs text-zinc-500 mt-0.5">Angle: {p.suggestedAngle}</p>}
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
