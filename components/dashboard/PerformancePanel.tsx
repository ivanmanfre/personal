import React, { useState, useMemo } from 'react';
import { Zap, Eye, FileText, Heart, MessageCircle, Repeat2 } from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell, LabelList,
} from 'recharts';
import { useOwnPosts } from '../../hooks/useOwnPosts';
import { useCompetitors } from '../../hooks/useCompetitors';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useDashboard } from '../../contexts/DashboardContext';
import StatCard from './shared/StatCard';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import { formatNum, formatDate } from './shared/utils';

type Metric = 'impressions' | 'likes' | 'comments';
type Range = '7d' | '30d' | '90d';

const METRIC_COLORS: Record<Metric, string> = { impressions: '#3b82f6', likes: '#ec4899', comments: '#f59e0b' };
const METRIC_LABELS: Record<Metric, string> = { impressions: 'Impressions', likes: 'Likes', comments: 'Comments' };
const TYPE_COLORS = ['#3b82f6', '#ec4899', '#f59e0b', '#8b5cf6', '#10b981'];

const tooltipStyle = {
  backgroundColor: '#18181b',
  border: '1px solid rgba(63, 63, 70, 0.6)',
  borderRadius: 10,
  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
  padding: '8px 12px',
};

const PerformancePanel: React.FC = () => {
  const [metric, setMetric] = useState<Metric>('impressions');
  const [range, setRange] = useState<Range>('30d');
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const { userTimezone } = useDashboard();

  const { posts, stats, loading: postsLoading, refresh: refreshPosts } = useOwnPosts(days);
  const { competitorStats, loading: compLoading, refresh: refreshComp } = useCompetitors();

  const refreshAll = async () => { await Promise.all([refreshPosts(), refreshComp()]); };
  const { lastRefreshed } = useAutoRefresh(refreshAll, { realtimeTables: ['own_posts'] });

  const loading = postsLoading || compLoading;

  const chartData = useMemo(() => [...posts].reverse().map((p) => ({
    date: formatDate(p.postedAt, { month: 'short', day: 'numeric' }, userTimezone),
    impressions: p.impressions,
    likes: p.likes,
    comments: p.comments,
    shares: p.shares,
  })), [posts, userTimezone]);

  const typeData = useMemo(() => {
    const typeMap: Record<string, { count: number; impressions: number; likes: number }> = {};
    posts.forEach((p) => {
      const t = p.postType || 'unknown';
      if (!typeMap[t]) typeMap[t] = { count: 0, impressions: 0, likes: 0 };
      typeMap[t].count++;
      typeMap[t].impressions += p.impressions;
      typeMap[t].likes += p.likes;
    });
    return Object.entries(typeMap).map(([name, d]) => ({
      name, count: d.count, avgImpressions: d.count ? Math.round(d.impressions / d.count) : 0,
    }));
  }, [posts]);

  const topPosts = useMemo(() =>
    [...posts].sort((a, b) => (b[metric] || 0) - (a[metric] || 0)).slice(0, 5),
  [posts, metric]);

  const topicData = useMemo(() => {
    const topicMap: Record<string, { count: number; impressions: number; likes: number; comments: number }> = {};
    posts.forEach((p) => {
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
  }, [posts]);

  const hookData = useMemo(() => {
    const hookMap: Record<string, { count: number; impressions: number; likes: number }> = {};
    posts.forEach((p) => {
      const h = p.hookPattern || 'Unknown';
      if (!hookMap[h]) hookMap[h] = { count: 0, impressions: 0, likes: 0 };
      hookMap[h].count++;
      hookMap[h].impressions += p.impressions;
      hookMap[h].likes += p.likes;
    });
    return Object.entries(hookMap)
      .map(([name, d]) => ({ name, ...d, avgImpressions: d.count ? Math.round(d.impressions / d.count) : 0 }))
      .sort((a, b) => b.avgImpressions - a.avgImpressions);
  }, [posts]);
  const benchmarkData = useMemo(() => {
    const yourAvgLikes = posts.length ? Math.round(stats.totalLikes / posts.length) : 0;
    return [
      { name: 'You', avgLikes: yourAvgLikes },
      ...competitorStats.slice(0, 6).map((c) => ({ name: c.competitorName.split(' ')[0], avgLikes: c.avgLikes })),
    ];
  }, [posts, stats.totalLikes, competitorStats]);

  if (loading) return <LoadingSkeleton cards={3} rows={5} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Performance</h1>
        <div className="flex items-center gap-2">
          {(['7d', '30d', '90d'] as Range[]).map((r) => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${range === r ? 'bg-zinc-700/80 text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}>
              {r}
            </button>
          ))}
          <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refreshAll} />
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Engagement Rate" value={`${stats.engagementRate}%`} icon={<Zap className="w-5 h-5" />} color="text-violet-400" />
        <StatCard label="Avg Impressions" value={formatNum(stats.avgImpressions)} icon={<Eye className="w-5 h-5" />} color="text-blue-400" />
        <StatCard label="Total Posts" value={stats.count} icon={<FileText className="w-5 h-5" />} color="text-emerald-400" />
      </div>

      {/* Metric selector */}
      <div className="flex gap-1.5">
        {(['impressions', 'likes', 'comments'] as Metric[]).map((m) => (
          <button key={m} onClick={() => setMetric(m)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${metric === m ? 'bg-zinc-800/80 text-white border border-zinc-700/60' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'}`}>
            {METRIC_LABELS[m]}
          </button>
        ))}
      </div>

      {posts.length === 0 ? (
        <div className="h-72 bg-zinc-900/90 border border-zinc-800/60 rounded-2xl shadow-sm shadow-black/10 flex items-center justify-center text-zinc-600">No data for this period</div>
      ) : (
        <>
          {/* Area chart */}
          <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl shadow-sm shadow-black/10 p-4 pt-5">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={METRIC_COLORS[metric]} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={METRIC_COLORS[metric]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(39, 39, 42, 0.6)" />
                <XAxis dataKey="date" tick={{ fill: '#52525b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#52525b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#a1a1aa', fontSize: 12 }} itemStyle={{ color: '#e4e4e7', fontSize: 12 }} />
                <Area type="monotone" dataKey={metric} stroke={METRIC_COLORS[metric]} fill="url(#perfGrad)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Content type breakdown */}
            <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl shadow-sm shadow-black/10 p-4">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-[0.12em] mb-4">By Content Type</h3>
              {typeData.length > 0 ? (
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width={120} height={120}>
                    <PieChart>
                      <Pie data={typeData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={50} innerRadius={25} strokeWidth={0}>
                        {typeData.map((_, i) => <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2.5">
                    {typeData.map((t, i) => (
                      <div key={t.name} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: TYPE_COLORS[i % TYPE_COLORS.length] }} />
                        <span className="text-xs text-zinc-400">{t.name}: {t.count} posts, ~{formatNum(t.avgImpressions)} imp</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <p className="text-zinc-600 text-sm">No data</p>}
            </div>

            {/* Competitor benchmark */}
            <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl shadow-sm shadow-black/10 p-4">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-[0.12em] mb-4">vs Competitors — avg likes per post</h3>
              {benchmarkData.length > 1 ? (
                <ResponsiveContainer width="100%" height={Math.max(160, benchmarkData.length * 26)}>
                  <BarChart data={benchmarkData} layout="vertical" margin={{ right: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(39, 39, 42, 0.6)" horizontal={false} />
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
                    <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#e4e4e7', fontSize: 12 }} formatter={(v: number) => [`${v} avg likes`, '']} />
                    <Bar dataKey="avgLikes" radius={[0, 4, 4, 0]}>
                      {benchmarkData.map((_, i) => <Cell key={i} fill={i === 0 ? '#10b981' : 'rgba(113, 113, 122, 0.55)'} />)}
                      <LabelList dataKey="avgLikes" position="right" fill="#a1a1aa" fontSize={11} formatter={(v: number) => formatNum(v)} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-zinc-600 text-sm">No competitor data</p>}
            </div>
          </div>

          {/* Topic & Hook breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl shadow-sm shadow-black/10 p-4">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-[0.12em] mb-3">By Topic — bar width shows avg impressions per post</h3>
              {topicData.length > 0 ? (
                <div className="space-y-2">
                  {topicData.slice(0, 6).map((t) => {
                    const maxImp = topicData[0].avgImpressions || 1;
                    return (
                      <div key={t.name}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-zinc-300 truncate max-w-[160px]">{t.name}</span>
                          <span className="text-[10px] text-zinc-500 shrink-0 ml-2">{t.count} posts · ~{formatNum(t.avgImpressions)} imp</span>
                        </div>
                        <div className="h-1.5 bg-zinc-800/60 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500/60 rounded-full" style={{ width: `${(t.avgImpressions / maxImp) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <p className="text-zinc-600 text-sm">No topic data</p>}
            </div>

            <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl shadow-sm shadow-black/10 p-4">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-[0.12em] mb-3">By Hook Pattern — bar width shows avg impressions per post</h3>
              {hookData.length > 0 ? (
                <div className="space-y-2">
                  {hookData.slice(0, 6).map((h) => {
                    const maxImp = hookData[0].avgImpressions || 1;
                    return (
                      <div key={h.name}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-zinc-300 truncate max-w-[160px]">{h.name}</span>
                          <span className="text-[10px] text-zinc-500 shrink-0 ml-2">{h.count} posts · ~{formatNum(h.avgImpressions)} imp</span>
                        </div>
                        <div className="h-1.5 bg-zinc-800/60 rounded-full overflow-hidden">
                          <div className="h-full bg-purple-500/60 rounded-full" style={{ width: `${(h.avgImpressions / maxImp) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <p className="text-zinc-600 text-sm">No hook data</p>}
            </div>
          </div>

          {/* Top posts */}
          <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl shadow-sm shadow-black/10 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800/40 bg-zinc-800/20 flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-zinc-500" />
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-[0.12em]">Top Posts by {METRIC_LABELS[metric]}</h3>
            </div>
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
                      <span className="flex items-center gap-1 text-[11px] text-zinc-600"><Repeat2 className="w-3 h-3" />{post.shares}</span>
                    </div>
                  </div>
                  {post.linkedinUrl && (
                    <a href={post.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-emerald-400/70 hover:text-emerald-400 transition-colors shrink-0">View</a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PerformancePanel;
