import React, { useState, useMemo } from 'react';
import { Swords, Lightbulb, Heart, MessageCircle, Repeat2, Star, CheckCircle2, Zap, FileText, TrendingUp, ClipboardCopy, ExternalLink } from 'lucide-react';
import { useCompetitors } from '../../hooks/useCompetitors';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { toastSuccess, toastError } from '../../lib/dashboardActions';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import EmptyState from './shared/EmptyState';
import PanelCard from './shared/PanelCard';
import type { CompetitorPost } from '../../types/dashboard';

const CompetitorIntelPanel: React.FC = () => {
  const { posts, patterns, competitorStats, opportunities, loading, refresh, markOpportunityActioned } = useCompetitors();
  const { lastRefreshed } = useAutoRefresh(refresh, { realtimeTables: ['competitor_posts'] });
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

  const draftFromOpportunity = async (p: CompetitorPost) => {
    const date = p.postDate ? new Date(p.postDate).toLocaleDateString() : 'unknown date';
    const lines = [
      `OPPORTUNITY: ${p.theOpportunity || ''}`,
      ``,
      `Source: ${p.competitorName} post from ${date}`,
      p.suggestedAngle ? `Suggested angle: ${p.suggestedAngle}` : '',
      p.suggestedFormat ? `Suggested format: ${p.suggestedFormat}` : '',
      ``,
      `Original post (${p.likesCount} likes, ${p.commentsCount} comments):`,
      p.postText.slice(0, 600),
    ].filter(Boolean).join('\n');
    try {
      await navigator.clipboard.writeText(lines);
      toastSuccess('Draft brief copied — paste into n8n Post Gen or ClickUp');
    } catch (err) {
      toastError('copy draft', err);
    }
  };

  // Initials avatar (e.g. "Pascal Bornet" → "PB"). Single source of truth for the
  // pseudo-avatar look so both competitor cards and opportunity rows match.
  const initials = (name: string) =>
    name.split(/\s+/).filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase() || '').join('') || '?';

  // Stable hue per name so each competitor keeps the same color tint across re-renders.
  const avatarHue = (name: string) => {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return h % 360;
  };

  // Find a profile URL for a competitor by name (any of their posts will do)
  const profileUrlFor = (name: string) => posts.find((p) => p.competitorName === name && p.linkedinProfileUrl)?.linkedinProfileUrl || null;

  if (loading) return <LoadingSkeleton cards={4} rows={6} />;

  if (competitorStats.length === 0) {
    return (
      <EmptyState
        title="No competitor data"
        description="Apify-driven scraping populates this panel. Check that the Competitors Scraping workflow is active and that competitor profile URLs are configured."
        icon={<Swords className="w-10 h-10" />}
      />
    );
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
        {competitorStats.map((c) => {
          const hue = avatarHue(c.competitorName);
          const profileUrl = profileUrlFor(c.competitorName);
          return (
            <button key={c.id} onClick={() => { setSelectedCompetitor(c.competitorName); setTab('posts'); }}
              className={`bg-zinc-900/80 border rounded-xl p-4 text-left transition-all duration-150 hover:bg-zinc-800/40 ${selectedCompetitor === c.competitorName && tab === 'posts' ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-zinc-800/80'}`}>
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-semibold border"
                  style={{ background: `hsl(${hue} 35% 22%)`, borderColor: `hsl(${hue} 30% 35%)`, color: `hsl(${hue} 70% 75%)` }}
                  aria-hidden
                >
                  {initials(c.competitorName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-zinc-200 truncate">{c.competitorName}</p>
                    {profileUrl && (
                      <a href={profileUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="shrink-0 text-zinc-600 hover:text-blue-400 transition-colors" title="Open LinkedIn profile">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <span className="text-[11px] text-zinc-500">{c.postCount} posts</span>
                </div>
              </div>
              <div className="flex gap-4 text-xs text-zinc-500">
                <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-pink-400/60" /> ~{c.avgLikes}</span>
                <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3 text-blue-400/60" /> ~{c.avgComments}</span>
              </div>
            </button>
          );
        })}
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
                      {p.linkedinPostUrl && (
                        <a
                          href={p.linkedinPostUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-1.5 inline-flex items-center gap-0.5 text-blue-400 hover:text-blue-300 transition-colors"
                          title="Open original post on LinkedIn"
                        >
                          <ExternalLink className="w-3 h-3" /> source
                        </a>
                      )}
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
                  <div className="shrink-0 flex items-center gap-1">
                    <button
                      onClick={() => draftFromOpportunity(p)}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20 hover:bg-amber-500/20 transition-colors flex items-center gap-1"
                      title="Copy a structured draft brief to clipboard"
                    >
                      <ClipboardCopy className="w-3 h-3" /> Draft
                    </button>
                    <button
                      onClick={() => markOpportunityActioned(p.id)}
                      className="p-2 rounded-lg text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                      title="Mark as actioned"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Patterns tab */}
      {tab === 'patterns' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

      {/* Posts — cards on mobile, table on md+ */}
      {tab === 'posts' && (
        displayPosts.length === 0 ? (
          <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl p-10 text-zinc-600 text-center text-sm">No posts found</div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="space-y-2 md:hidden">
              {displayPosts.map((p) => (
                <div key={p.id} className="bg-zinc-900/90 border border-zinc-800/60 rounded-xl p-3.5">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-medium text-zinc-400">{p.competitorName.split(' ')[0]}</span>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="flex items-center gap-0.5 text-pink-400/70"><Heart className="w-3 h-3" />{p.likesCount}</span>
                      <span className="flex items-center gap-0.5 text-blue-400/70"><MessageCircle className="w-3 h-3" />{p.commentsCount}</span>
                      {p.isTopPerformer && <Star className="w-3 h-3 text-amber-400" />}
                    </div>
                  </div>
                  <p className="text-sm text-zinc-300 line-clamp-2">{p.postText.slice(0, 120)}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[11px] text-zinc-600">{p.postDate ? new Date(p.postDate).toLocaleDateString() : '—'}</span>
                    {p.topicCategory && <span className="text-[11px] text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded">{p.topicCategory}</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block bg-zinc-900/90 border border-zinc-800/60 rounded-2xl shadow-sm shadow-black/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800/40 bg-zinc-800/20 text-left">
                      <th className="px-4 py-3 text-[11px] text-zinc-500 font-medium uppercase tracking-wider">Competitor</th>
                      <th className="px-4 py-3 text-[11px] text-zinc-500 font-medium uppercase tracking-wider">Post</th>
                      <th className="px-4 py-3 text-[11px] text-zinc-500 font-medium uppercase tracking-wider">Engagement</th>
                      <th className="px-4 py-3 text-[11px] text-zinc-500 font-medium uppercase tracking-wider">Topic</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40">
                    {displayPosts.map((p) => (
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
                        <td className="px-4 py-3 text-[11px] text-zinc-500">{p.topicCategory || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )
      )}
    </div>
  );
};

export default CompetitorIntelPanel;
