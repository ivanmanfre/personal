import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { TrendingUp, Eye, MessageSquare, Heart, RefreshCw } from 'lucide-react';

interface Stats {
  totalPosts: number;
  totalImpressions: number;
  totalReactions: number;
  totalComments: number;
  avgImpressions: number;
  recentLeads: number;
  pendingAlerts: number;
}

const OverviewPanel: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentPosts, setRecentPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

    const [postsRes, leadsRes, alertsRes] = await Promise.all([
      supabase.from('own_posts').select('*').gte('posted_at', thirtyDaysAgo).order('posted_at', { ascending: false }),
      supabase.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
      supabase.from('n8nclaw_proactive_alerts').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);

    const posts = postsRes.data || [];
    setRecentPosts(posts.slice(0, 5));

    const totalImpressions = posts.reduce((s, p) => s + (p.impressions || 0), 0);
    const totalReactions = posts.reduce((s, p) => s + (p.reactions || 0), 0);
    const totalComments = posts.reduce((s, p) => s + (p.comments || 0), 0);

    setStats({
      totalPosts: posts.length,
      totalImpressions,
      totalReactions,
      totalComments,
      avgImpressions: posts.length ? Math.round(totalImpressions / posts.length) : 0,
      recentLeads: leadsRes.count || 0,
      pendingAlerts: alertsRes.count || 0,
    });
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) return <LoadingSkeleton />;
  if (!stats) return <p className="text-zinc-400">Unable to load data</p>;

  const cards = [
    { label: 'Posts (30d)', value: stats.totalPosts, icon: <TrendingUp className="w-5 h-5" />, color: 'text-emerald-400' },
    { label: 'Impressions', value: formatNum(stats.totalImpressions), icon: <Eye className="w-5 h-5" />, color: 'text-blue-400' },
    { label: 'Reactions', value: formatNum(stats.totalReactions), icon: <Heart className="w-5 h-5" />, color: 'text-pink-400' },
    { label: 'Comments', value: formatNum(stats.totalComments), icon: <MessageSquare className="w-5 h-5" />, color: 'text-amber-400' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Overview</h1>
        <button onClick={fetchData} className="text-zinc-400 hover:text-white transition-colors">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-zinc-500 uppercase tracking-wide">{c.label}</span>
              <span className={c.color}>{c.icon}</span>
            </div>
            <p className="text-2xl font-bold">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Avg Impressions/Post</p>
          <p className="text-xl font-bold">{formatNum(stats.avgImpressions)}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">New Leads (30d)</p>
          <p className="text-xl font-bold">{stats.recentLeads}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Pending Alerts</p>
          <p className="text-xl font-bold">{stats.pendingAlerts}</p>
        </div>
      </div>

      {/* Recent posts */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
        <div className="px-4 py-3 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-300">Recent Posts</h2>
        </div>
        <div className="divide-y divide-zinc-800">
          {recentPosts.length === 0 ? (
            <p className="px-4 py-6 text-zinc-500 text-sm text-center">No posts found</p>
          ) : (
            recentPosts.map((post, i) => (
              <div key={i} className="px-4 py-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-300 truncate">{post.text?.slice(0, 120) || 'No text'}</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    {post.posted_at ? new Date(post.posted_at).toLocaleDateString() : '—'}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-400 shrink-0">
                  <span title="Impressions">{formatNum(post.impressions || 0)} views</span>
                  <span title="Reactions">{post.reactions || 0} likes</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

function formatNum(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

const LoadingSkeleton: React.FC = () => (
  <div className="space-y-6 animate-pulse">
    <div className="h-8 w-40 bg-zinc-800 rounded" />
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 h-24" />
      ))}
    </div>
  </div>
);

export default OverviewPanel;
