import React, { useEffect } from 'react';
import { TrendingUp, Eye, Heart, MessageSquare, Activity, Bell, Clock, Zap } from 'lucide-react';
import { useOwnPosts } from '../../hooks/useOwnPosts';
import { useWorkflowStats } from '../../hooks/useWorkflowStats';
import { useAgentData } from '../../hooks/useAgentData';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useDashboard } from '../../contexts/DashboardContext';
import StatCard from './shared/StatCard';
import StatusDot from './shared/StatusDot';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';

function formatNum(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

const OverviewPanel: React.FC = () => {
  const { posts, stats: postStats, loading: postsLoading, refresh: refreshPosts } = useOwnPosts(30);
  const { stats: wfStats, loading: wfLoading, refresh: refreshWf, workflows } = useWorkflowStats();
  const { alerts, reminders, messageStats, loading: agentLoading, refresh: refreshAgent } = useAgentData();
  const { setSystemHealth, setLastRefreshed } = useDashboard();

  const refreshAll = async () => {
    await Promise.all([refreshPosts(), refreshWf(), refreshAgent()]);
    setLastRefreshed(new Date());
  };

  const { lastRefreshed } = useAutoRefresh(refreshAll, {
    realtimeTables: ['own_posts', 'n8nclaw_proactive_alerts', 'dashboard_workflow_stats'],
  });

  useEffect(() => { setSystemHealth(wfStats.health); }, [wfStats.health, setSystemHealth]);

  const loading = postsLoading && wfLoading && agentLoading;
  if (loading) return <LoadingSkeleton cards={8} rows={5} />;

  const recentAlerts = alerts.slice(0, 3);
  const pendingReminders = reminders.slice(0, 3);

  // Activity feed: recent posts + alerts, sorted by time
  const activityItems = [
    ...posts.slice(0, 5).map((p) => ({ type: 'post' as const, text: p.text.slice(0, 80), time: p.postedAt, meta: `${formatNum(p.impressions)} views` })),
    ...alerts.slice(0, 5).map((a) => ({ type: 'alert' as const, text: a.title, time: a.createdAt, meta: a.alertType })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Overview</h1>
        <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refreshAll} />
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Posts (30d)" value={postStats.count} icon={<TrendingUp className="w-5 h-5" />} color="text-emerald-400" />
        <StatCard label="Impressions" value={formatNum(postStats.totalImpressions)} icon={<Eye className="w-5 h-5" />} color="text-blue-400" />
        <StatCard label="Likes" value={formatNum(postStats.totalLikes)} icon={<Heart className="w-5 h-5" />} color="text-pink-400" />
        <StatCard label="Comments" value={formatNum(postStats.totalComments)} icon={<MessageSquare className="w-5 h-5" />} color="text-amber-400" />
      </div>

      {/* Second row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Engagement Rate"
          value={`${postStats.engagementRate}%`}
          icon={<Zap className="w-5 h-5" />}
          color="text-violet-400"
          subValue={`${formatNum(postStats.avgImpressions)} avg impressions`}
        />
        <StatCard
          label="Workflows"
          value={`${wfStats.active}/${wfStats.total}`}
          icon={<Activity className="w-5 h-5" />}
          color={wfStats.totalErrors24h > 3 ? 'text-red-400' : 'text-emerald-400'}
          subValue={`${wfStats.totalErrors24h} errors in 24h`}
        />
        <StatCard
          label="Alerts"
          value={alerts.length}
          icon={<Bell className="w-5 h-5" />}
          color="text-orange-400"
          subValue={alerts.filter((a) => !a.sent).length + ' unsent'}
        />
        <StatCard
          label="Agent Messages"
          value={messageStats.total}
          icon={<MessageSquare className="w-5 h-5" />}
          color="text-cyan-400"
          subValue={`${messageStats.today} today`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Feed */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
          <div className="px-4 py-3 border-b border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-300">Recent Activity</h2>
          </div>
          <div className="divide-y divide-zinc-800">
            {activityItems.length === 0 ? (
              <p className="px-4 py-6 text-zinc-500 text-sm text-center">No recent activity</p>
            ) : (
              activityItems.map((item, i) => (
                <div key={i} className="px-4 py-3 flex items-start gap-3">
                  <div className="mt-1">
                    {item.type === 'post' ? (
                      <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <TrendingUp className="w-3 h-3 text-blue-400" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center">
                        <Bell className="w-3 h-3 text-orange-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-300 truncate">{item.text}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-zinc-500">{timeAgo(item.time)}</span>
                      <span className="text-xs text-zinc-600">{item.meta}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right column: Alerts + Reminders */}
        <div className="space-y-6">
          {/* Alert breakdown */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
            <div className="px-4 py-3 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-300">Recent Alerts</h2>
            </div>
            <div className="divide-y divide-zinc-800">
              {recentAlerts.length === 0 ? (
                <p className="px-4 py-4 text-zinc-500 text-sm text-center">No alerts</p>
              ) : (
                recentAlerts.map((a) => (
                  <div key={a.id} className="px-4 py-3 flex items-center gap-3">
                    <StatusDot status={a.sent ? 'healthy' : 'warning'} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-300 truncate">{a.title}</p>
                      <p className="text-xs text-zinc-500">{a.alertType} · {timeAgo(a.createdAt)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Upcoming reminders */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
            <div className="px-4 py-3 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-300">Upcoming Reminders</h2>
            </div>
            <div className="divide-y divide-zinc-800">
              {pendingReminders.length === 0 ? (
                <p className="px-4 py-4 text-zinc-500 text-sm text-center">No pending reminders</p>
              ) : (
                pendingReminders.map((r) => (
                  <div key={r.id} className="px-4 py-3 flex items-center gap-3">
                    <Clock className="w-4 h-4 text-zinc-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-300 truncate">{r.reminderText}</p>
                      <p className="text-xs text-zinc-500">{new Date(r.remindAt).toLocaleString()}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function timeAgo(ts: string): string {
  const secs = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export default OverviewPanel;
