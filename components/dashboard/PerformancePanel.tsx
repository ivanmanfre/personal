import React, { useState, useMemo } from 'react';
import { Zap, Eye, FileText, Heart, MessageCircle, Repeat2, AlertTriangle, Users } from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Cell, LabelList,
} from 'recharts';
import { useOwnPosts } from '../../hooks/useOwnPosts';
import { useCompetitors } from '../../hooks/useCompetitors';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useFollowerHistory } from '../../hooks/useFollowerHistory';
import { useDashboard } from '../../contexts/DashboardContext';
import StatCard from './shared/StatCard';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import EmptyState from './shared/EmptyState';
import { formatNum, formatDate, timeAgo } from './shared/utils';
import { PanelIntro } from '../dashboard-v2/primitives';
import { normalizePillar } from '../../lib/pillarTaxonomy';
import { minSampleRanking, dedupeTicks } from '../../lib/perfRankings';
import { seedIdeaFromPost } from '../../lib/runItBack';
import { isPostScraped } from '../../lib/scrapeStatus';
import type { OwnPost } from '../../types/dashboard';

type Metric = 'impressions' | 'likes' | 'comments';
type Range = '7d' | '30d' | '90d';
type Segment = 'reach' | 'capture';

const CHART = {
  primary: '#047857',   // --ds-ok    (own posts / main series)
  info:    '#2563eb',   // --ds-info  (secondary series)
  violet:  '#7c3aed',   // --ds-violet (tertiary)
  warn:    '#b45309',   // --ds-warn  (highlights)
  grid:    '#e9e9ee',   // --ds-line
  axis:    '#64748b',   // --ds-faint
};

const METRIC_COLORS: Record<Metric, string> = { impressions: CHART.info, likes: CHART.violet, comments: CHART.warn };
const METRIC_LABELS: Record<Metric, string> = { impressions: 'Impressions', likes: 'Likes', comments: 'Comments' };
const TYPE_COLORS = [CHART.primary, CHART.info, CHART.violet, CHART.warn];

const tooltipStyle = {
  background: '#ffffff',
  border: '1px solid #e9e9ee',
  borderRadius: 10,
  color: '#0f172a',
  boxShadow: '0 10px 26px -18px rgba(15,23,42,.18)',
  fontSize: 12,
  padding: '8px 12px',
};

const PerformancePanel: React.FC = () => {
  const [metric, setMetric] = useState<Metric>('impressions');
  const [range, setRange] = useState<Range>('30d');
  const [segment, setSegment] = useState<Segment>('reach');
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const { userTimezone } = useDashboard();

  const { posts, stats, loading: postsLoading, error: postsError, refresh: refreshPosts } = useOwnPosts(days);
  const { competitorStats, patterns: competitorPatterns, loading: compLoading, error: compError, refresh: refreshComp } = useCompetitors(days);

  const refreshAll = async () => { await Promise.all([refreshPosts(), refreshComp()]); };
  const { lastRefreshed } = useAutoRefresh(refreshAll, { realtimeTables: ['own_posts'] });

  const loading = postsLoading || compLoading;
  const error = postsError || compError;

  // Two jobs, scored differently: reach posts by impressions, capture posts by named leads.
  // They are never cross-ranked — each segment computes off its own slice.
  const reachPosts = useMemo(() => posts.filter((p) => p.post_kind === 'reach'), [posts]);
  const capturePosts = useMemo(() => posts.filter((p) => p.post_kind === 'capture'), [posts]);

  // Reach KPIs — scoped to reach only (mirrors useOwnPosts stats logic on the filtered slice).
  const reachStats = useMemo(() => {
    const scraped = reachPosts.filter(isPostScraped);
    const scrapedImpr = scraped.reduce((s, p) => s + p.impressions, 0);
    const scrapedEng = scraped.reduce((s, p) => s + p.likes + p.comments + p.shares, 0);
    return {
      count: reachPosts.length,
      totalLikes: reachPosts.reduce((s, p) => s + p.likes, 0),
      avgImpressions: scraped.length ? Math.round(scrapedImpr / scraped.length) : 0,
      engagementRate: scrapedImpr > 0 ? (scrapedEng / scrapedImpr * 100).toFixed(2) : '0',
    };
  }, [reachPosts]);

  // Capture leaderboard — sorted DESC by named_leads, nulls last (never by impressions).
  const captureLeaderboard = useMemo(() =>
    [...capturePosts].sort((a, b) => (b.named_leads ?? -1) - (a.named_leads ?? -1)),
  [capturePosts]);

  const captureStats = useMemo(() => {
    const totalNamedLeads = capturePosts.reduce((s, p) => s + (p.named_leads ?? 0), 0);
    let bestMagnet: { slug: string; leads: number } | null = null;
    for (const p of capturePosts) {
      if (p.named_leads != null && (!bestMagnet || p.named_leads > bestMagnet.leads)) {
        bestMagnet = { slug: p.lead_magnet_slug ?? '—', leads: p.named_leads };
      }
    }
    return { totalNamedLeads, count: capturePosts.length, bestMagnet };
  }, [capturePosts]);

  const chartData = useMemo(() => [...reachPosts].reverse().map((p) => ({
    date: formatDate(p.postedAt, { month: 'short', day: 'numeric' }, userTimezone),
    impressions: p.impressions,
    likes: p.likes,
    comments: p.comments,
    shares: p.shares,
  })), [reachPosts, userTimezone]);

  const typeData = useMemo(() => {
    const typeMap: Record<string, { count: number; impressions: number; likes: number }> = {};
    reachPosts.forEach((p) => {
      const t = p.postType || 'unknown';
      if (!typeMap[t]) typeMap[t] = { count: 0, impressions: 0, likes: 0 };
      typeMap[t].count++;
      typeMap[t].impressions += p.impressions;
      typeMap[t].likes += p.likes;
    });
    return Object.entries(typeMap).map(([name, d]) => ({
      name, count: d.count, avgImpressions: d.count ? Math.round(d.impressions / d.count) : 0,
    }));
  }, [reachPosts]);

  const topPosts = useMemo(() =>
    [...reachPosts].sort((a, b) => (b[metric] || 0) - (a[metric] || 0)).slice(0, 5),
  [reachPosts, metric]);

  const topicData = useMemo(() => {
    const topicMap: Record<string, { count: number; impressions: number; likes: number; comments: number }> = {};
    reachPosts.forEach((p) => {
      const t = p.topicCategory || 'Uncategorized';
      if (!topicMap[t]) topicMap[t] = { count: 0, impressions: 0, likes: 0, comments: 0 };
      topicMap[t].count++;
      topicMap[t].impressions += p.impressions;
      topicMap[t].likes += p.likes;
      topicMap[t].comments += p.comments;
    });
    return Object.entries(topicMap)
      .map(([name, d]) => ({ name, ...d, avgImpressions: d.count ? Math.round(d.impressions / d.count) : 0 }))
      .sort((a, b) => b.avgImpressions - a.avgImpressions);
  }, [reachPosts]);

  const hookData = useMemo(() => {
    const hookMap: Record<string, { count: number; impressions: number; likes: number }> = {};
    reachPosts.forEach((p) => {
      const h = p.hookPattern || 'Unknown';
      if (!hookMap[h]) hookMap[h] = { count: 0, impressions: 0, likes: 0 };
      hookMap[h].count++;
      hookMap[h].impressions += p.impressions;
      hookMap[h].likes += p.likes;
    });
    return Object.entries(hookMap)
      .map(([name, d]) => ({ name, ...d, avgImpressions: d.count ? Math.round(d.impressions / d.count) : 0 }))
      .sort((a, b) => b.avgImpressions - a.avgImpressions);
  }, [reachPosts]);
  // Which content PILLAR lands — only pipeline-generated posts carry a pillar (matched from
  // carousel_drafts via own_posts.pillar, refreshed nightly). Manual/lifestyle posts are null.
  const pillarData = useMemo(() => {
    const m: Record<string, { count: number; impressions: number; eng: number; imprForRate: number }> = {};
    reachPosts.forEach((p) => {
      if (!p.pillar) return;
      if (!m[p.pillar]) m[p.pillar] = { count: 0, impressions: 0, eng: 0, imprForRate: 0 };
      m[p.pillar].count++;
      m[p.pillar].impressions += p.impressions;
      m[p.pillar].eng += p.likes + p.comments + p.shares;
      if (p.impressions > 0) m[p.pillar].imprForRate += p.impressions;
    });
    return Object.entries(m)
      .map(([name, d]) => {
        const { label, unmapped } = normalizePillar(name);
        return {
          name, label, unmapped, count: d.count,
          avgImpressions: d.count ? Math.round(d.impressions / d.count) : 0,
          engRate: d.imprForRate > 0 ? +((d.eng / d.imprForRate) * 100).toFixed(2) : 0,
        };
      })
      .sort((a, b) => b.avgImpressions - a.avgImpressions);
  }, [reachPosts]);

  const benchmarkData = useMemo(() => {
    const yourAvgLikes = reachPosts.length ? Math.round(reachStats.totalLikes / reachPosts.length) : 0;
    // Only competitors with at least one post inside the selected window count —
    // a competitor with 0 in-window posts would otherwise show a misleading 0 bar.
    const inWindow = competitorStats.filter((c) => c.recentPostCount > 0);
    return [
      { name: 'You', avgLikes: yourAvgLikes },
      ...inWindow.slice(0, 6).map((c) => ({ name: c.competitorName.split(' ')[0], avgLikes: c.avgLikes })),
    ];
  }, [reachPosts, reachStats.totalLikes, competitorStats]);

  // Deduped date ticks so a post-indexed chart doesn't print "Jun 8, Jun 8".
  const chartTicks = useMemo(() => dedupeTicks(chartData.map((d) => d.date)), [chartData]);
  // Min-sample guard: topics/hooks with <3 posts are held out of the ranking.
  const topicRank = useMemo(() => minSampleRanking(topicData, 3), [topicData]);
  const hookRank = useMemo(() => minSampleRanking(hookData, 3), [hookData]);

  const { stats: followerStats } = useFollowerHistory();

  // "Run it back" — seed a fresh Posts idea from a top performer.
  const [seedMsg, setSeedMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [seedingIdx, setSeedingIdx] = useState<number | null>(null);
  const handleRunItBack = async (post: OwnPost, i: number) => {
    setSeedingIdx(i);
    setSeedMsg(null);
    try {
      await seedIdeaFromPost({
        title: post.text.slice(0, 90),
        topic: post.topicCategory ?? '',
        pillar: normalizePillar(post.pillar).label,
        hook: post.hookPattern ?? '',
      });
      setSeedMsg({ ok: true, text: 'Seeded a new idea — find it on the Posts board Idea stage.' });
    } catch {
      setSeedMsg({ ok: false, text: 'Could not seed the idea. Try again.' });
    } finally {
      setSeedingIdx(null);
    }
  };

  if (loading) return <LoadingSkeleton cards={3} rows={5} />;

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Performance</h1>
          <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refreshAll} />
        </div>
        <EmptyState
          icon={<AlertTriangle className="w-10 h-10" />}
          title="Couldn't load performance data"
          description={error}
          action={{ label: 'Retry', onClick: refreshAll }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PanelIntro
        tourId="performance"
        purpose="What actually landed, and what the system learns from it."
        how="Daily LinkedIn metrics flow back in to inform which topics, hooks, and formats get posted next."
      />
      {/* Toolbar: real scrape time (headline) + range toggle + manual refresh */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <span className="text-[12px] text-zinc-500 inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          {stats.lastScrapedAt ? `Scraped from LinkedIn · ${timeAgo(stats.lastScrapedAt)}` : 'Metrics not scraped yet'}
        </span>
        <div className="flex items-center gap-2">
          {(['7d', '30d', '90d'] as Range[]).map((r) => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${range === r ? 'bg-[var(--d-accent-bg)] text-[var(--ds-accent)] ring-1 ring-inset ring-[var(--d-rule-strong)]' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}>
              {r}
            </button>
          ))}
          <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refreshAll} />
        </div>
      </div>

      {/* Reach / Capture — two content jobs, scored on different currencies (impressions vs named leads) */}
      <div className="flex gap-1.5">
        {(['reach', 'capture'] as Segment[]).map((s) => (
          <button key={s} onClick={() => setSegment(s)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${segment === s ? 'bg-[var(--d-accent-bg)] text-[var(--ds-accent)] ring-1 ring-inset ring-[var(--d-rule-strong)]' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'}`}>
            {s === 'reach' ? <><Eye className="w-4 h-4" />Reach</> : <><Users className="w-4 h-4" />Capture</>}
          </button>
        ))}
      </div>

      {segment === 'reach' && (
      <>
      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Engagement Rate" value={`${reachStats.engagementRate}%`} icon={<Zap className="w-5 h-5" />} color="text-violet-400" />
        <StatCard label="Avg Impressions" value={formatNum(reachStats.avgImpressions)} icon={<Eye className="w-5 h-5" />} color="text-blue-400" />
        <StatCard label="Total Posts" value={reachStats.count} icon={<FileText className="w-5 h-5" />} color="text-emerald-400" />
      </div>

      {/* Audience strip — LinkedIn follower block (moved in from the retired Site Audience tab) + scrape coverage */}
      <div className="panel-surface shadow-sm shadow-black/10 p-4 flex items-center gap-x-8 gap-y-3 flex-wrap">
        <div className="flex flex-col">
          <span className="text-lg font-bold text-zinc-100 tabular-nums">{followerStats.followers != null ? formatNum(followerStats.followers) : '—'}</span>
          <span className="text-[11px] text-zinc-500">LinkedIn followers</span>
        </div>
        {followerStats.weekDelta != null && (
          <div className="flex flex-col">
            <span className={`text-lg font-bold tabular-nums ${followerStats.weekDelta >= 0 ? 'text-emerald-400' : 'text-zinc-400'}`}>{followerStats.weekDelta >= 0 ? '+' : ''}{formatNum(followerStats.weekDelta)}</span>
            <span className="text-[11px] text-zinc-500">last 7 days</span>
          </div>
        )}
        <div className="flex flex-col ml-auto text-right">
          <span className="text-[12px] text-zinc-400 tabular-nums">{stats.scrapedCount} of {stats.count} posts scraped</span>
          {stats.unscrapedCount > 0 && (
            <span className="text-[11px] text-zinc-500 mt-0.5">{stats.unscrapedCount} <span className="ml-0.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide bg-amber-900/40 text-amber-300 ring-1 ring-amber-700/30">not scraped yet</span></span>
          )}
        </div>
      </div>

      {reachPosts.length === 0 ? (
        <div className="h-72 panel-surface shadow-sm shadow-black/10 flex items-center justify-center text-zinc-600">No data for this period</div>
      ) : (
        <>
          {/* Which pillars land — moved up: the most actionable "what to write next" signal */}
          {pillarData.length > 0 && (
            <div className="panel-surface shadow-sm shadow-black/10 p-4">
              <h3 className="text-[13px] font-semibold text-zinc-200 mb-1">Which pillars land <span className="font-normal text-zinc-500">· bar = avg impressions · pipeline-generated posts only</span></h3>
              <div className="space-y-2 mt-3">
                {pillarData.map((t) => {
                  const maxImp = pillarData[0].avgImpressions || 1;
                  return (
                    <div key={t.name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-zinc-300">
                          {t.label}
                          {t.unmapped && <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide bg-amber-900/40 text-amber-300 ring-1 ring-amber-700/30">unmapped ({t.name})</span>}
                        </span>
                        <span className="text-[11px] text-zinc-500 shrink-0 ml-2">{t.count} posts · ~{formatNum(t.avgImpressions)} imp · {t.engRate}% eng</span>
                      </div>
                      <div className="h-1.5 bg-zinc-800/60 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(t.avgImpressions / maxImp) * 100}%`, backgroundColor: CHART.primary }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Topics & Hooks — min-sample guard (n≥3): thin rankings held out, not faked */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="panel-surface shadow-sm shadow-black/10 p-4">
              <h3 className="text-[13px] font-semibold text-zinc-200 mb-3">Which topics land <span className="font-normal text-zinc-500">· bar = avg impressions</span></h3>
              {topicRank.ranked.length > 0 ? (
                <div className="space-y-2">
                  {topicRank.ranked.slice(0, 6).map((t) => {
                    const maxImp = topicRank.ranked[0].avgImpressions || 1;
                    return (
                      <div key={t.name}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-zinc-300 truncate max-w-[160px]">{t.name}</span>
                          <span className="text-[11px] text-zinc-500 shrink-0 ml-2">{t.count} posts · ~{formatNum(t.avgImpressions)} imp</span>
                        </div>
                        <div className="h-1.5 bg-zinc-800/60 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(t.avgImpressions / maxImp) * 100}%`, backgroundColor: CHART.info }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <p className="text-zinc-600 text-sm">No topic has ≥3 posts yet</p>}
              {topicRank.pending.length > 0 && (
                <p className="mt-3 text-[11px] text-zinc-500 border border-dashed border-zinc-700/60 rounded-lg px-3 py-2">{topicRank.pending.length} topic{topicRank.pending.length > 1 ? 's' : ''} pending — &lt;3 posts each, held out until the sample is honest.</p>
              )}
            </div>

            <div className="panel-surface shadow-sm shadow-black/10 p-4">
              <h3 className="text-[13px] font-semibold text-zinc-200 mb-3">Which hooks land <span className="font-normal text-zinc-500">· bar = avg impressions</span></h3>
              {hookRank.ranked.length > 0 ? (
                <div className="space-y-2">
                  {hookRank.ranked.slice(0, 6).map((h) => {
                    const maxImp = hookRank.ranked[0].avgImpressions || 1;
                    return (
                      <div key={h.name}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-zinc-300 truncate max-w-[160px]">{h.name}</span>
                          <span className="text-[11px] text-zinc-500 shrink-0 ml-2">{h.count} posts · ~{formatNum(h.avgImpressions)} imp</span>
                        </div>
                        <div className="h-1.5 bg-zinc-800/60 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(h.avgImpressions / maxImp) * 100}%`, backgroundColor: CHART.violet }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <p className="text-zinc-600 text-sm">No hook has ≥3 posts yet</p>}
              {hookRank.pending.length > 0 && (
                <p className="mt-3 text-[11px] text-zinc-500 border border-dashed border-zinc-700/60 rounded-lg px-3 py-2">{hookRank.pending.length} hook{hookRank.pending.length > 1 ? 's' : ''} pending — &lt;3 posts each, held out until the sample is honest.</p>
              )}
            </div>
          </div>

          {/* Metric selector + Trend (moved below strategy views; deduped date ticks) */}
          <div className="space-y-3">
            <div className="flex gap-1.5">
              {(['impressions', 'likes', 'comments'] as Metric[]).map((m) => (
                <button key={m} onClick={() => setMetric(m)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${metric === m ? 'bg-[var(--d-accent-bg)] text-[var(--ds-accent)] ring-1 ring-inset ring-[var(--d-rule-strong)]' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'}`}>
                  {METRIC_LABELS[m]}
                </button>
              ))}
            </div>
            <div className="panel-surface shadow-sm shadow-black/10 p-4 pt-5">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={METRIC_COLORS[metric]} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={METRIC_COLORS[metric]} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                  <XAxis dataKey="date" ticks={chartTicks} tick={{ fill: '#52525b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#52525b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: CHART.axis, fontSize: 12 }} itemStyle={{ color: '#0f172a', fontSize: 12 }} />
                  <Area type="monotone" dataKey={metric} stroke={METRIC_COLORS[metric]} fill="url(#perfGrad)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top posts + Run it back */}
          <div className="panel-surface shadow-sm shadow-black/10 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800/40 bg-zinc-800/20 flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-zinc-500" />
              <h3 className="text-[13px] font-semibold text-zinc-200">Top posts <span className="font-normal text-zinc-500">· by {METRIC_LABELS[metric].toLowerCase()}</span></h3>
            </div>
            {seedMsg && (
              <div className={`px-4 py-2 text-[12px] ${seedMsg.ok ? 'text-emerald-300 bg-emerald-900/20' : 'text-amber-300 bg-amber-900/20'}`}>{seedMsg.text}</div>
            )}
            <div className="divide-y divide-zinc-800/40">
              {topPosts.map((post, i) => (
                <div key={i} className="px-4 py-3 flex items-start gap-3 hover:bg-zinc-800/30 transition-colors">
                  <span className="text-[11px] font-bold text-zinc-600 w-5 pt-0.5 text-center">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-300 truncate">{post.text.slice(0, 100)}</p>
                    <div className="flex gap-3 mt-1.5">
                      <span className="flex items-center gap-1 text-[11px] text-zinc-500"><Eye className="w-3 h-3" />{formatNum(post.impressions)}</span>
                      <span className="flex items-center gap-1 text-[11px] text-pink-400/70"><Heart className="w-3 h-3" />{post.likes}</span>
                      <span className="flex items-center gap-1 text-[11px] text-blue-400/70"><MessageCircle className="w-3 h-3" />{post.comments}</span>
                      <span className="flex items-center gap-1 text-[11px] text-zinc-500"><Repeat2 className="w-3 h-3" />{post.shares}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleRunItBack(post, i)}
                      disabled={seedingIdx === i}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[12px] font-medium text-[var(--ds-accent)] bg-[var(--d-accent-bg)] ring-1 ring-inset ring-[var(--d-rule-strong)] hover:brightness-95 disabled:opacity-50 min-h-[32px]"
                    >
                      <Repeat2 className="w-3.5 h-3.5" />{seedingIdx === i ? 'Seeding…' : 'Run it back'}
                    </button>
                    {post.linkedinUrl && (
                      <a href={post.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-emerald-400/70 hover:text-emerald-400 transition-colors">View</a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Content-type share-bar + Benchmark — least actionable, kept last */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="panel-surface shadow-sm shadow-black/10 p-4">
              <h3 className="text-[13px] font-semibold text-zinc-200 mb-3">By content type <span className="font-normal text-zinc-500">· share of posts</span></h3>
              {typeData.length > 0 ? (
                <div className="space-y-2">
                  {[...typeData].sort((a, b) => b.count - a.count).map((t, i) => {
                    const maxCount = Math.max(...typeData.map((d) => d.count)) || 1;
                    return (
                      <div key={t.name}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-zinc-300">{t.name}</span>
                          <span className="text-[11px] text-zinc-500 shrink-0 ml-2">{t.count} posts · ~{formatNum(t.avgImpressions)} imp</span>
                        </div>
                        <div className="h-1.5 bg-zinc-800/60 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(t.count / maxCount) * 100}%`, backgroundColor: TYPE_COLORS[i % TYPE_COLORS.length] }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <p className="text-zinc-600 text-sm">No data</p>}
            </div>

            <div className="panel-surface shadow-sm shadow-black/10 p-4">
              <h3 className="text-[13px] font-semibold text-zinc-200 mb-4">How you compare <span className="font-normal text-zinc-500">· avg likes per post</span></h3>
              {benchmarkData.length > 1 ? (
                <ResponsiveContainer width="100%" height={Math.max(160, benchmarkData.length * 26)}>
                  <BarChart data={benchmarkData} layout="vertical" margin={{ right: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} horizontal={false} />
                    <XAxis type="number" tick={{ fill: '#a1a1aa', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      tick={({ y, payload }) => (
                        <text x={0} y={y} dy={4} fill={payload.value === 'You' ? '#10b981' : '#d4d4d8'} fontSize={11} fontWeight={payload.value === 'You' ? 700 : 400}>
                          {payload.value}
                        </text>
                      )}
                      width={70}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#0f172a', fontSize: 12 }} formatter={(v: number) => [`${v} avg likes`, '']} />
                    <Bar dataKey="avgLikes" radius={[0, 4, 4, 0]}>
                      {benchmarkData.map((_, i) => <Cell key={i} fill={i === 0 ? '#10b981' : 'rgba(113, 113, 122, 0.55)'} />)}
                      <LabelList dataKey="avgLikes" position="right" fill="#a1a1aa" fontSize={11} formatter={(v: number) => formatNum(v)} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-zinc-600 text-sm">{competitorPatterns.length > 0 ? `No competitor posts in this ${range} window` : 'No competitor data'}</p>}
            </div>
          </div>
        </>
      )}
      </>
      )}

      {segment === 'capture' && (
        capturePosts.length === 0 ? (
          <div className="panel-surface shadow-sm shadow-black/10 p-8 text-center">
            <div className="mx-auto mb-3 w-10 h-10 rounded-full bg-zinc-800/60 flex items-center justify-center text-zinc-500">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-200">No capture posts tagged yet</h3>
            <p className="mt-1.5 text-[13px] text-zinc-500 max-w-md mx-auto">Capture posts carry a lead-magnet CTA and are scored by named leads — not impressions — once tagging is live.</p>
          </div>
        ) : (
          <>
            {/* Capture KPIs — scored by named leads, never impressions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <StatCard label="Named Leads" value={formatNum(captureStats.totalNamedLeads)} icon={<Users className="w-5 h-5" />} color="text-emerald-400" />
              <StatCard label="Capture Posts" value={captureStats.count} icon={<FileText className="w-5 h-5" />} color="text-blue-400" />
              <StatCard label="Best magnet" value={captureStats.bestMagnet ? formatNum(captureStats.bestMagnet.leads) : '—'} subValue={captureStats.bestMagnet?.slug} icon={<Zap className="w-5 h-5" />} color="text-violet-400" />
            </div>

            {/* Capture leaderboard — DESC by named leads (nulls last); impressions shown muted, never the sort key */}
            <div className="panel-surface shadow-sm shadow-black/10 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800/40 bg-zinc-800/20 flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-zinc-500" />
                <h3 className="text-[13px] font-semibold text-zinc-200">Top capture posts <span className="font-normal text-zinc-500">· by named leads</span></h3>
              </div>
              <div className="divide-y divide-zinc-800/40">
                {captureLeaderboard.map((post, i) => (
                  <div key={post.id} className="px-4 py-3 flex items-start gap-3 hover:bg-zinc-800/30 transition-colors">
                    <span className="text-[11px] font-bold text-zinc-600 w-5 pt-0.5 text-center">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-300 truncate">{post.text.slice(0, 100)}</p>
                      <div className="flex flex-wrap items-center gap-3 mt-1.5">
                        <span className="flex items-center gap-1 text-[11px] text-zinc-500"><Eye className="w-3 h-3" />{formatNum(post.impressions)}</span>
                        {post.lead_magnet_slug && (
                          <span className="text-[11px] text-zinc-500 truncate max-w-[180px]">→ {post.lead_magnet_slug}</span>
                        )}
                        {post.also_promoted_by > 0 && (
                          <span className="text-[11px] text-zinc-500 italic">also promoted by {post.also_promoted_by} other post{post.also_promoted_by > 1 ? 's' : ''}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-base font-bold text-emerald-300 tabular-nums">{post.named_leads != null ? formatNum(post.named_leads) : '—'}</span>
                        <span className="text-[10px] uppercase tracking-wide text-zinc-500">named leads</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-semibold text-zinc-300 tabular-nums">{post.named_leads_30d != null ? formatNum(post.named_leads_30d) : '—'}</span>
                        <span className="text-[10px] uppercase tracking-wide text-zinc-500">30d</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-semibold text-zinc-400 tabular-nums">{post.capture_rate_pct != null ? `${post.capture_rate_pct}%` : '—'}</span>
                        <span className="text-[10px] uppercase tracking-wide text-zinc-500">rate</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )
      )}
    </div>
  );
};

export default PerformancePanel;
