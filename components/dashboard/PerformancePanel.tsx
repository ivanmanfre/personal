import React, { useState } from 'react';
import { Zap } from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';
import { useOwnPosts } from '../../hooks/useOwnPosts';
import { useCompetitors } from '../../hooks/useCompetitors';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import StatCard from './shared/StatCard';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';

type Metric = 'impressions' | 'likes' | 'comments';
type Range = '7d' | '30d' | '90d';

const METRIC_COLORS: Record<Metric, string> = { impressions: '#3b82f6', likes: '#ec4899', comments: '#f59e0b' };
const METRIC_LABELS: Record<Metric, string> = { impressions: 'Impressions', likes: 'Likes', comments: 'Comments' };
const TYPE_COLORS = ['#3b82f6', '#ec4899', '#f59e0b', '#8b5cf6', '#10b981'];

const PerformancePanel: React.FC = () => {
  const [metric, setMetric] = useState<Metric>('impressions');
  const [range, setRange] = useState<Range>('30d');
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;

  const { posts, stats, loading: postsLoading, refresh: refreshPosts } = useOwnPosts(days);
  const { competitorStats, loading: compLoading, refresh: refreshComp } = useCompetitors();

  const refreshAll = async () => { await Promise.all([refreshPosts(), refreshComp()]); };
  const { lastRefreshed } = useAutoRefresh(refreshAll, { realtimeTables: ['own_posts'] });

  const loading = postsLoading && compLoading;
  if (loading) return <LoadingSkeleton cards={3} rows={5} />;

  // Chart data
  const chartData = [...posts].reverse().map((p) => ({
    date: new Date(p.postedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    impressions: p.impressions,
    likes: p.likes,
    comments: p.comments,
    shares: p.shares,
  }));

  // Content type breakdown
  const typeMap: Record<string, { count: number; impressions: number; likes: number }> = {};
  posts.forEach((p) => {
    const t = p.postType || 'unknown';
    if (!typeMap[t]) typeMap[t] = { count: 0, impressions: 0, likes: 0 };
    typeMap[t].count++;
    typeMap[t].impressions += p.impressions;
    typeMap[t].likes += p.likes;
  });
  const typeData = Object.entries(typeMap).map(([name, d]) => ({
    name, count: d.count, avgImpressions: d.count ? Math.round(d.impressions / d.count) : 0,
  }));

  // Top posts by selected metric
  const topPosts = [...posts].sort((a, b) => (b[metric] || 0) - (a[metric] || 0)).slice(0, 5);

  // Competitor benchmark
  const yourAvgLikes = posts.length ? Math.round(stats.totalLikes / posts.length) : 0;
  const benchmarkData = [
    { name: 'You', avgLikes: yourAvgLikes },
    ...competitorStats.slice(0, 6).map((c) => ({ name: c.competitorName.split(' ')[0], avgLikes: c.avgLikes })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Performance</h1>
        <div className="flex items-center gap-2">
          {(['7d', '30d', '90d'] as Range[]).map((r) => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${range === r ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}>
              {r}
            </button>
          ))}
          <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refreshAll} />
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Engagement Rate" value={`${stats.engagementRate}%`} icon={<Zap className="w-5 h-5" />} color="text-violet-400" />
        <StatCard label="Avg Impressions" value={formatNum(stats.avgImpressions)} icon={<span className="text-sm">👁</span>} color="text-blue-400" />
        <StatCard label="Total Posts" value={stats.count} icon={<span className="text-sm">📝</span>} color="text-emerald-400" />
      </div>

      {/* Metric selector */}
      <div className="flex gap-2">
        {(['impressions', 'likes', 'comments'] as Metric[]).map((m) => (
          <button key={m} onClick={() => setMetric(m)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${metric === m ? 'bg-zinc-800 text-white border border-zinc-700' : 'text-zinc-400 hover:text-white'}`}>
            {METRIC_LABELS[m]}
          </button>
        ))}
      </div>

      {posts.length === 0 ? (
        <div className="h-72 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-500">No data for this period</div>
      ) : (
        <>
          {/* Area chart */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={METRIC_COLORS[metric]} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={METRIC_COLORS[metric]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 12 }} />
                <YAxis tick={{ fill: '#71717a', fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }} labelStyle={{ color: '#a1a1aa' }} />
                <Area type="monotone" dataKey={metric} stroke={METRIC_COLORS[metric]} fill="url(#perfGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Content type breakdown */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-zinc-300 mb-3">By Content Type</h3>
              {typeData.length > 0 ? (
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width={120} height={120}>
                    <PieChart>
                      <Pie data={typeData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={50} strokeWidth={0}>
                        {typeData.map((_, i) => <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {typeData.map((t, i) => (
                      <div key={t.name} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: TYPE_COLORS[i % TYPE_COLORS.length] }} />
                        <span className="text-xs text-zinc-400">{t.name}: {t.count} posts, ~{formatNum(t.avgImpressions)} imp</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <p className="text-zinc-500 text-sm">No data</p>}
            </div>

            {/* Competitor benchmark */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-zinc-300 mb-3">vs Competitors (Avg Likes)</h3>
              {benchmarkData.length > 1 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={benchmarkData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis type="number" tick={{ fill: '#71717a', fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" tick={{ fill: '#71717a', fontSize: 11 }} width={60} />
                    <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }} />
                    <Bar dataKey="avgLikes" radius={[0, 4, 4, 0]}>
                      {benchmarkData.map((_, i) => <Cell key={i} fill={i === 0 ? '#10b981' : '#3f3f46'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-zinc-500 text-sm">No competitor data</p>}
            </div>
          </div>

          {/* Top posts */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
            <div className="px-4 py-3 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-300">Top Posts by {METRIC_LABELS[metric]}</h3>
            </div>
            <div className="divide-y divide-zinc-800">
              {topPosts.map((post, i) => (
                <div key={i} className="px-4 py-3 flex items-start gap-3">
                  <span className="text-xs font-bold text-zinc-500 w-5 pt-0.5">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-300 truncate">{post.text.slice(0, 100)}</p>
                    <div className="flex gap-4 mt-1 text-xs text-zinc-500">
                      <span>{formatNum(post.impressions)} views</span>
                      <span>{post.likes} likes</span>
                      <span>{post.comments} comments</span>
                    </div>
                  </div>
                  {post.linkedinUrl && (
                    <a href={post.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-400 hover:underline shrink-0">View</a>
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

function formatNum(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

export default PerformancePanel;
