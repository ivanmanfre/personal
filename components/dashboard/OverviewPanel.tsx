import React, { useEffect, useMemo } from 'react';
import { TrendingUp, Eye, Heart, MessageSquare, Activity, Bell, Clock, Zap, CheckCircle2, Network, ArrowRight } from 'lucide-react';
import { useOwnPosts } from '../../hooks/useOwnPosts';
import { useWorkflowStats } from '../../hooks/useWorkflowStats';
import { useAgentData } from '../../hooks/useAgentData';
import { useContentPipeline } from '../../hooks/useContentPipeline';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useDashboard } from '../../contexts/DashboardContext';
import StatCard from './shared/StatCard';
import StatusDot from './shared/StatusDot';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import PanelCard from './shared/PanelCard';
import AnimateIn from './shared/AnimateIn';
import TodaysFocus from './shared/TodaysFocus';
import StackCard from './StackCard';
import { pipelineConfig } from './system-map/config';
import { timeAgo, formatNum } from './shared/utils';
import type { WorkflowStat } from '../../types/dashboard';

const OverviewPanel: React.FC = () => {
  const { posts, loading: postsLoading, refresh: refreshPosts } = useOwnPosts(60);
  const { workflows, stats: wfStats, loading: wfLoading, refresh: refreshWf } = useWorkflowStats();
  const { setSystemHealth, setLastRefreshed, navigateToTab, userTimezone } = useDashboard();
  const { alerts, reminders, messageStats, loading: agentLoading, refresh: refreshAgent, acknowledgeAlert, completeReminder } = useAgentData(userTimezone);
  const { statusCounts, refresh: refreshContent } = useContentPipeline(userTimezone);
  const pendingPostsCount = statusCounts.pending || 0;

  const refreshAll = async () => {
    await Promise.all([refreshPosts(), refreshWf(), refreshAgent(), refreshContent()]);
    setLastRefreshed(new Date());
  };

  const { lastRefreshed } = useAutoRefresh(refreshAll, {
    realtimeTables: ['own_posts', 'n8nclaw_proactive_alerts', 'dashboard_workflow_stats'],
  });

  useEffect(() => { setSystemHealth(wfStats.health); }, [wfStats.health, setSystemHealth]);

  const pipelineHealth = useMemo(() => {
    return pipelineConfig.map((p) => {
      const matched = workflows.filter((wf: WorkflowStat) => {
        const name = wf.workflowName.toLowerCase();
        return p.workflows.some((pat) => name.includes(pat.toLowerCase()));
      });
      const errors = matched.reduce((s: number, w: WorkflowStat) => s + w.errorCount24h, 0);
      const health = matched.some((w: WorkflowStat) => !w.isActive ? false : !w.errorAcknowledged && (w.lastExecutionStatus === 'error' || w.errorCount24h > 3))
        ? 'error' as const
        : matched.some((w: WorkflowStat) => w.isActive && w.errorCount24h > 0 && !w.errorAcknowledged)
          ? 'warning' as const
          : 'healthy' as const;
      return { id: p.id, name: p.name, color: p.color, count: matched.length, errors, health };
    });
  }, [workflows]);

  // 30d window stats + 30d vs prior 30d trends - keeps card values and deltas on the same window
  const { stats30d, trends } = useMemo(() => {
    const now = Date.now();
    const day = 86400000;
    const currStart = now - 30 * day;
    const prevStart = now - 60 * day;

    const curr = posts.filter((p) => new Date(p.postedAt).getTime() >= currStart);
    const prev = posts.filter((p) => {
      const t = new Date(p.postedAt).getTime();
      return t >= prevStart && t < currStart;
    });

    const sum = (rows: typeof posts, key: 'impressions' | 'likes' | 'comments') =>
      rows.reduce((s, r) => s + (r[key] || 0), 0);

    const totalImpressions = sum(curr, 'impressions');
    const totalLikes = sum(curr, 'likes');
    const totalComments = sum(curr, 'comments');
    const totalShares = curr.reduce((s, r) => s + (r.shares || 0), 0);
    const stats30d = {
      count: curr.length,
      totalImpressions,
      totalLikes,
      totalComments,
      avgImpressions: curr.length ? Math.round(totalImpressions / curr.length) : 0,
      engagementRate: totalImpressions > 0
        ? ((totalLikes + totalComments + totalShares) / totalImpressions * 100).toFixed(2)
        : '0',
    };

    // Returns undefined when no prior data - suppresses the trend chip rather than showing a misleading 100%
    const pct = (c: number, p: number): { value: number; label: string } | undefined =>
      p === 0 ? undefined : { value: Math.round(((c - p) / p) * 100), label: 'vs prior 30d' };

    return {
      stats30d,
      trends: {
        posts: pct(curr.length, prev.length),
        impressions: pct(totalImpressions, sum(prev, 'impressions')),
        likes: pct(totalLikes, sum(prev, 'likes')),
        comments: pct(totalComments, sum(prev, 'comments')),
      },
    };
  }, [posts]);

  // Dedupe on (alertType + title). Keep the newest per group, track count so the
  // panel shows one row per distinct problem with "×N" instead of N identical rows.
  const recentAlerts = useMemo(() => {
    const seen = new Map<string, { alert: typeof alerts[number]; count: number }>();
    for (const a of alerts) {
      const key = `${a.alertType}|${a.title}`;
      const existing = seen.get(key);
      if (existing) existing.count += 1;
      else seen.set(key, { alert: a, count: 1 });
    }
    return Array.from(seen.values()).slice(0, 4);
  }, [alerts]);

  const loading = postsLoading || wfLoading || agentLoading;
  if (loading) return <LoadingSkeleton cards={8} rows={5} />;

  const pendingReminders = reminders.slice(0, 4);

  const activityItems = [
    ...posts.slice(0, 5).map((p) => ({ type: 'post' as const, text: p.text.slice(0, 80), time: p.postedAt, meta: `${formatNum(p.impressions)} views` })),
    ...alerts.slice(0, 5).map((a) => ({ type: 'alert' as const, text: a.title, time: a.createdAt, meta: a.alertType.replace(/_/g, ' ') })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight animate-count-up">Overview</h1>
        <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refreshAll} />
      </div>

      {/* Today's focus - actionable items above everything else */}
      <AnimateIn delay={0}>
        <TodaysFocus
          workflows={workflows}
          alerts={alerts}
          pendingPostsCount={pendingPostsCount}
          onNavigate={navigateToTab}
        />
      </AnimateIn>

      {/* Top stat cards */}
      <AnimateIn delay={0}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Posts (30d)" value={stats30d.count} icon={<TrendingUp className="w-5 h-5" />} color="text-zinc-300" trend={trends.posts} />
          <StatCard label="Impressions (30d)" value={formatNum(stats30d.totalImpressions)} icon={<Eye className="w-5 h-5" />} color="text-zinc-300" trend={trends.impressions} />
          <StatCard label="Likes (30d)" value={formatNum(stats30d.totalLikes)} icon={<Heart className="w-5 h-5" />} color="text-zinc-300" trend={trends.likes} />
          <StatCard label="Comments (30d)" value={formatNum(stats30d.totalComments)} icon={<MessageSquare className="w-5 h-5" />} color="text-zinc-300" trend={trends.comments} />
        </div>
      </AnimateIn>

      {/* Second row */}
      <AnimateIn delay={80}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Engagement (30d)" value={`${stats30d.engagementRate}%`} icon={<Zap className="w-5 h-5" />} color="text-emerald-400" subValue={`${formatNum(stats30d.avgImpressions)} avg imp`} />
          <StatCard
            label="Workflows"
            value={`${wfStats.active}/${wfStats.total}`}
            icon={<Activity className="w-5 h-5" />}
            color={wfStats.totalErrors24h > 3 ? 'text-red-400' : wfStats.totalErrors24h > 0 ? 'text-amber-400' : 'text-emerald-400'}
            subValue={`${wfStats.totalErrors24h} errors 24h`}
          />
          <StatCard
            label="Alerts"
            value={alerts.length}
            icon={<Bell className="w-5 h-5" />}
            color={alerts.filter((a) => !a.sent).length > 0 ? 'text-amber-400' : 'text-zinc-300'}
            subValue={alerts.filter((a) => !a.sent).length + ' unsent'}
          />
          <StatCard label="Agent Msgs" value={messageStats.total} icon={<MessageSquare className="w-5 h-5" />} color="text-zinc-300" subValue={`${messageStats.today} today`} />
        </div>
      </AnimateIn>

      {/* Pipeline Health Strip */}
      <AnimateIn delay={120}>
        <button
          onClick={() => navigateToTab('system-map')}
          className="w-full bg-zinc-900/90 border border-zinc-800/60 rounded-2xl shadow-sm shadow-black/10 p-3 hover:bg-zinc-900 hover:border-zinc-700/60 transition-all duration-200 group cursor-pointer text-left"
        >
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <Network className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">Pipeline Health</span>
            </div>
            <span className="flex items-center gap-1 text-[11px] text-zinc-500 group-hover:text-zinc-400 transition-colors">
              Open System Map <ArrowRight aria-hidden="true" className="w-3 h-3" />
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
            {pipelineHealth.map((p) => {
              const dotColor = p.health === 'error' ? 'bg-red-500' : p.health === 'warning' ? 'bg-amber-500' : 'bg-emerald-500';
              const pipeColors: Record<string, string> = {
                blue: 'text-blue-400', purple: 'text-purple-400', emerald: 'text-emerald-400',
                cyan: 'text-cyan-400', orange: 'text-orange-400', green: 'text-green-400',
                amber: 'text-amber-400', zinc: 'text-zinc-400',
              };
              return (
                <div key={p.id} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-zinc-800/40 border border-zinc-700/20">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                  <span className={`text-[10px] font-medium truncate ${pipeColors[p.color] || 'text-zinc-400'}`}>{p.name.replace(' Pipeline', '').replace(' & Backups', '')}</span>
                  <span className="text-[9px] text-zinc-500 shrink-0 ml-auto">{p.count}</span>
                  {p.errors > 0 && <span className="text-[9px] text-red-400 shrink-0">{p.errors}e</span>}
                </div>
              );
            })}
          </div>
        </button>
      </AnimateIn>

      {/* Stack Status */}
      <AnimateIn delay={160}>
        <StackCard />
      </AnimateIn>

      <AnimateIn delay={200}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Activity Feed */}
        <PanelCard title="Recent Activity" icon={<Activity className="w-3.5 h-3.5" />} badge={activityItems.length} accent="blue">
          <div className="divide-y divide-zinc-800/40">
            {activityItems.length === 0 ? (
              <p className="px-4 py-8 text-zinc-600 text-sm text-center">No recent activity</p>
            ) : (
              activityItems.map((item, i) => (
                <div key={i} className="px-4 py-3 flex items-start gap-3 hover:bg-zinc-800/30 transition-colors">
                  <div className="mt-0.5">
                    {item.type === 'post' ? (
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                        <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                        <Bell className="w-3.5 h-3.5 text-orange-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-300 truncate" title={item.text}>{item.text}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-zinc-500">{timeAgo(item.time)}</span>
                      <span className="text-[11px] text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded">{item.meta}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </PanelCard>

        {/* Right column */}
        <div className="space-y-4">
          {/* Alert breakdown */}
          <PanelCard title="Recent Alerts" icon={<Bell className="w-3.5 h-3.5" />} badge={recentAlerts.length} accent="amber">
            <div className="divide-y divide-zinc-800/40">
              {recentAlerts.length === 0 ? (
                <p className="px-4 py-6 text-zinc-600 text-sm text-center">No alerts</p>
              ) : (
                recentAlerts.map(({ alert: a, count }) => (
                  <div key={a.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-zinc-800/30 transition-colors">
                    <StatusDot status={a.sent ? 'healthy' : 'warning'} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-zinc-300 truncate" title={a.title}>{a.title}</p>
                        {count > 1 && (
                          <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400 border border-zinc-700/50" title={`${count} alerts of this type`}>×{count}</span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-500">{a.alertType.replace(/_/g, ' ')} · {timeAgo(a.createdAt)}</p>
                    </div>
                    {!a.sent && (
                      <button onClick={() => acknowledgeAlert(a.id)} className="shrink-0 p-1.5 rounded-lg text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors" title="Acknowledge">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </PanelCard>

          {/* Upcoming reminders */}
          <PanelCard title="Upcoming Reminders" icon={<Clock className="w-3.5 h-3.5" />} badge={pendingReminders.length} accent="emerald">
            <div className="divide-y divide-zinc-800/40">
              {pendingReminders.length === 0 ? (
                <p className="px-4 py-6 text-zinc-600 text-sm text-center">No pending reminders</p>
              ) : (
                pendingReminders.map((r) => (
                  <div key={r.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-zinc-800/30 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                      <Clock className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-300 truncate" title={r.reminderText}>{r.reminderText}</p>
                      <p className="text-[11px] text-zinc-500" title={new Date(r.remindAt).toLocaleString()}>{timeAgo(r.remindAt)}</p>
                    </div>
                    <button onClick={() => completeReminder(r.id)} className="shrink-0 p-1.5 rounded-lg text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors" title="Complete">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </PanelCard>
        </div>
      </div>
      </AnimateIn>
    </div>
  );
};

export default OverviewPanel;
