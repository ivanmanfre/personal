import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { RefreshCw } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
} from 'recharts';

type Metric = 'impressions' | 'reactions' | 'comments';
type Range = '7d' | '30d' | '90d';

const PerformancePanel: React.FC = () => {
  const [posts, setPosts] = useState<any[]>([]);
  const [metric, setMetric] = useState<Metric>('impressions');
  const [range, setRange] = useState<Range>('30d');
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    const since = new Date(Date.now() - days * 86400000).toISOString();

    const { data } = await supabase
      .from('own_posts')
      .select('*')
      .gte('posted_at', since)
      .order('posted_at', { ascending: true });

    setPosts(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [range]);

  const chartData = posts.map((p) => ({
    date: new Date(p.posted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    impressions: p.impressions || 0,
    reactions: p.reactions || 0,
    comments: p.comments || 0,
    reposts: p.reposts || 0,
  }));

  const metricColor = { impressions: '#3b82f6', reactions: '#ec4899', comments: '#f59e0b' };
  const metricLabel = { impressions: 'Impressions', reactions: 'Reactions', comments: 'Comments' };

  // Top posts
  const topPosts = [...posts]
    .sort((a, b) => (b[metric] || 0) - (a[metric] || 0))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Performance</h1>
        <div className="flex items-center gap-2">
          {(['7d', '30d', '90d'] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                range === r ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              {r}
            </button>
          ))}
          <button onClick={fetchData} className="text-zinc-400 hover:text-white ml-2">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Metric selector */}
      <div className="flex gap-2">
        {(['impressions', 'reactions', 'comments'] as Metric[]).map((m) => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              metric === m ? 'bg-zinc-800 text-white border border-zinc-700' : 'text-zinc-400 hover:text-white'
            }`}
          >
            {metricLabel[m]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-72 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" />
      ) : posts.length === 0 ? (
        <div className="h-72 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-500">
          No data for this period
        </div>
      ) : (
        <>
          {/* Area chart */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={metricColor[metric]} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={metricColor[metric]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 12 }} />
                <YAxis tick={{ fill: '#71717a', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
                  labelStyle={{ color: '#a1a1aa' }}
                  itemStyle={{ color: metricColor[metric] }}
                />
                <Area
                  type="monotone"
                  dataKey={metric}
                  stroke={metricColor[metric]}
                  fill="url(#gradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Engagement bar chart */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-zinc-300 mb-3">Engagement Breakdown</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 11 }} />
                <YAxis tick={{ fill: '#71717a', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
                  labelStyle={{ color: '#a1a1aa' }}
                />
                <Bar dataKey="reactions" fill="#ec4899" radius={[2, 2, 0, 0]} />
                <Bar dataKey="comments" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                <Bar dataKey="reposts" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top posts table */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
            <div className="px-4 py-3 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-300">Top Posts by {metricLabel[metric]}</h3>
            </div>
            <div className="divide-y divide-zinc-800">
              {topPosts.map((post, i) => (
                <div key={i} className="px-4 py-3 flex items-start gap-3">
                  <span className="text-xs font-bold text-zinc-500 w-5 pt-0.5">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-300 truncate">{post.text?.slice(0, 100)}</p>
                    <div className="flex gap-4 mt-1 text-xs text-zinc-500">
                      <span>{formatNum(post.impressions || 0)} views</span>
                      <span>{post.reactions || 0} reactions</span>
                      <span>{post.comments || 0} comments</span>
                    </div>
                  </div>
                  {post.linkedin_url && (
                    <a
                      href={post.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-emerald-400 hover:underline shrink-0"
                    >
                      View
                    </a>
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
