import React, { useEffect } from 'react';
import { TrendingUp, Eye, Heart, MessageSquare, Activity, Bell, Clock, Zap, CheckCircle2 } from 'lucide-react';
import { useOwnPosts } from '../../hooks/useOwnPosts';
import { useWorkflowStats } from '../../hooks/useWorkflowStats';
import { useAgentData } from '../../hooks/useAgentData';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useDashboard } from '../../contexts/DashboardContext';
import StatCard from './shared/StatCard';
import StatusDot from './shared/StatusDot';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import { timeAgo, formatNum } from './shared/utils';

const OverviewPanel: React.FC = () => {
  const { posts, stats: postStats, loading: postsLoading, refresh: refreshPosts } = useOwnPosts(30);
  const { stats: wfStats, loading: wfLoading, refresh: refreshWf } = useWorkflowStats();
  const { alerts, reminders, messageStats, loading: agentLoading, refresh: refreshAgent, acknowledgeAlert, completeReminder } = useAgentData();
  const { setSystemHealth, setLastRefreshed } = useDashboard();

  const refreshAll = async () => {
    await Promise.all([refreshPosts(), refreshWf(), refreshAgent()]);
    setLastRefreshed(new Date());
  };

  const { lastRefreshed } = useAutoRefresh(refreshAll, {
    realtimeTables: ['own_posts', 'n8nclaw_proactive_alerts', 'dashboard_workflow_stats'],
  });

  useEffect(() => { setSystemHealth(wfStats.health); }, [wfStats.health, setSystemHealth]);

  const loading = postsLoading || wfLoading || agentLoading;
  if (loading) return <LoadingSkeleton cards={8} rows={5} />;

  const recentAlerts = alerts.slice(0, 4);
  const pendingReminders = reminders.slice(0, 4);

  const activityItems = [
    ...posts.slice(0, 5).map((p) => ({ type: 'post' as const, text: p.text.slice(0, 80), time: p.postedAt, meta: `${formatNum(p.impressions)} views` })),
    ...alerts.slice(0, 5).map((a) => ({ type: 'alert' as const, text: a.title, time: a.createdAt, meta: a.alertType.replace(/_/g, ' ') })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refreshAll} />
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Posts (30d)" value={postStats.count} icon={<TrendingUp className="w-5 h-5" />} color="text-emerald-400" />
        <StatCard label="Impressions" value={formatNum(postStats.totalImpressions)} icon={<Eye className="w-5 h-5" />} color="text-blue-400" />
        <StatCard label="Likes" value={formatNum(postStats.totalLikes)} icon={<Heart className="w-5 h-5" />} color="text-pink-400" />
        <StatCard label="Comments" value={formatNum(postStats.totalComments)} icon={<MessageSquare className="w-5 h-5" />} color="text-amber-400" />
      </div>

      {/* Second row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Engagement" value={`${postStats.engagementRate}%`} icon={<Zap className="w-5 h-5" />} color="text-violet-400" subValue={`${formatNum(postStats.avgImpressions)} avg imp`} />
        <StatCard label="Workflows" value={`${wfStats.active}/${wfStats.total}`} icon={<Activity className="w-5 h-5" />} color={wfStats.totalErrors24h > 3 ? 'text-red-400' : 'text-emerald-400'} subValue={`${wfStats.totalErrors24h} errors 24h`} />
        <StatCard label="Alerts" value={alerts.length} icon={<Bell className="w-5 h-5" />} color="text-orange-400" subValue={alerts.filter((a) => !a.sent).length + ' unsent'} />
        <StatCard label="Agent Msgs" value={messageStats.total} icon={<MessageSquare className="w-5 h-5" />} color="text-cyan-400" subValue={`${messageStats.today} today`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Activity Feed */}
        <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800/60 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-zinc-500" />
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Recent Activity</h2>
          </div>
          <div className="divide-y divide-zinc-800/50">
            {activityItems.length === 0 ? (
              <p className="px-4 py-8 text-zinc-600 text-sm text-center">No recent activity</p>
            ) : (
              activityItems.map((item, i) => (
                <div key={i} className="px-4 py-3 flex items-start gap-3 hover:bg-zinc-800/20 transition-colors">
                  <div className="mt-0.5">
                    {item.type === 'post' ? (
                      <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                        <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                        <Bell className="w-3.5 h-3.5 text-orange-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-300 truncate" title={item.text}>{item.text}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-zinc-500">{timeAgo(item.time)}</span>
                      <span className="text-[11px] text-zinc-600 bg-zinc-800/60 px-1.5 py-0.5 rounded">{item.meta}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Alert breakdown */}
          <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800/60 flex items-center gap-2">
              <Bell className="w-3.5 h-3.5 text-zinc-500" />
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Recent Alerts</h2>
            </div>
            <div className="divide-y divide-zinc-800/50">
              {recentAlerts.length === 0 ? (
                <p className="px-4 py-6 text-zinc-600 text-sm text-center">No alerts</p>
              ) : (
                recentAlerts.map((a) => (
                  <div key={a.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-zinc-800/20 transition-colors">
                    <StatusDot status={a.sent ? 'healthy' : 'warning'} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-300 truncate" title={a.title}>{a.title}</p>
                      <p className="text-[11px] text-zinc-500">{a.alertType.replace(/_/g, ' ')} · {timeAgo(a.createdAt)}</p>
                    </div>
                    {!a.sent && (
                      <button onClick={() => acknowledgeAlert(a.id)} className="shrink-0 p-1 rounded text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors" title="Acknowledge">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Upcoming reminders */}
          <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800/60 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-zinc-500" />
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Upcoming Reminders</h2>
            </div>
            <div className="divide-y divide-zinc-800/50">
              {pendingReminders.length === 0 ? (
                <p className="px-4 py-6 text-zinc-600 text-sm text-center">No pending reminders</p>
              ) : (
                pendingReminders.map((r) => (
                  <div key={r.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-zinc-800/20 transition-colors">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                      <Clock className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-300 truncate" title={r.reminderText}>{r.reminderText}</p>
                      <p className="text-[11px] text-zinc-500" title={new Date(r.remindAt).toLocaleString()}>{timeAgo(r.remindAt)}</p>
                    </div>
                    <button onClick={() => completeReminder(r.id)} className="shrink-0 p-1 rounded text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors" title="Complete">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </button>
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

export default OverviewPanel;
