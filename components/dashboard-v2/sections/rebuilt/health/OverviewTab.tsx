import React, { useMemo } from 'react';
import { ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import { useOwnPosts } from '../../../../../hooks/useOwnPosts';
import { useAgentData } from '../../../../../hooks/useAgentData';
import { useContentPipeline } from '../../../../../hooks/useContentPipeline';
import { useAutoRefresh } from '../../../../../hooks/useAutoRefresh';
import { useDashboard } from '../../../../../contexts/DashboardContext';
import { timeAgo, formatNum } from '../../../../dashboard/shared/utils';
import { pipelineConfig } from '../../../../dashboard/system-map/config';
import StackCard from '../../../../dashboard/StackCard';
import { workflowHealth, StatusMark } from './shared';
import type { WorkflowStat } from '../../../../../types/dashboard';

/*
 * Overview tab — the section's context surface. TodaysFocus (click-through),
 * a compact stat lockup strip, the pipeline strip (→ system map / Pulse), the
 * reused Stack card + modal, and the Recent Activity / Alerts (ack) / Reminders
 * (complete) rails. Alert-ack + reminder-complete reuse the useAgentData write
 * paths (dashboard_action RPC). Ledger elements 2-7.
 */

interface Props {
  workflows: WorkflowStat[];
  wfStats: { total: number; active: number; totalErrors24h: number };
  onTab: (t: 'workflows' | 'ops') => void;
  onSection: (id: string) => void;
}

const OverviewTab: React.FC<Props> = ({ workflows, wfStats, onTab, onSection }) => {
  const { userTimezone } = useDashboard();
  const { posts, refresh: refreshPosts } = useOwnPosts(60);
  const { alerts, reminders, messageStats, refresh: refreshAgent, acknowledgeAlert, completeReminder } = useAgentData(userTimezone);
  const { statusCounts, refresh: refreshContent } = useContentPipeline(userTimezone);
  const pendingPostsCount = statusCounts.pending || 0;

  useAutoRefresh(
    async () => { await Promise.all([refreshPosts(), refreshAgent(), refreshContent()]); },
    { realtimeTables: ['own_posts', 'n8nclaw_proactive_alerts'] },
  );

  // 30-day performance window
  const stats30d = useMemo(() => {
    const cut = Date.now() - 30 * 86400000;
    const curr = posts.filter((p) => new Date(p.postedAt).getTime() >= cut);
    const sum = (k: 'impressions' | 'likes' | 'comments') => curr.reduce((s, r) => s + (r[k] || 0), 0);
    return { count: curr.length, impressions: sum('impressions'), likes: sum('likes'), comments: sum('comments') };
  }, [posts]);

  // Pipeline health (system-map grouping)
  const pipelineHealth = useMemo(() => pipelineConfig.map((p) => {
    const matched = workflows.filter((wf) => p.workflows.some((pat) => wf.workflowName.toLowerCase().includes(pat.toLowerCase())));
    const errors = matched.reduce((s, w) => s + w.errorCount24h, 0);
    const hasError = matched.some((w) => workflowHealth(w) === 'error');
    const hasWarn = matched.some((w) => workflowHealth(w) === 'warning');
    return { id: p.id, name: p.name, count: matched.length, errors, kind: hasError ? 'error' as const : hasWarn ? 'warn' as const : 'healthy' as const };
  }).filter((p) => p.count > 0), [workflows]);

  // TodaysFocus — the actionable items, click-through. Verbatim rules from
  // shared/TodaysFocus: failing workflows, pipeline stalls, pending posts.
  const focus = useMemo(() => {
    const out: { id: string; sev: 'high' | 'med' | 'low'; title: string; sub: string; go: () => void }[] = [];
    workflows.filter((w) => w.errorCount24h > 0 && !w.errorAcknowledged)
      .sort((a, b) => b.errorCount24h - a.errorCount24h).slice(0, 3)
      .forEach((w) => out.push({
        id: `wf-${w.id}`, sev: w.errorCount24h > 3 ? 'high' : 'med', title: w.workflowName,
        sub: `${w.errorCount24h} error${w.errorCount24h > 1 ? 's' : ''} in 24h${w.lastErrorMessage ? ` · ${w.lastErrorMessage.slice(0, 60)}` : ''}`,
        go: () => onTab('workflows'),
      }));
    const stalls = alerts.filter((a) => a.alertType === 'pipeline_stall' && !a.sent)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    if (stalls.length) out.push({
      id: `stall-${stalls[0].id}`, sev: 'high',
      title: stalls.length > 1 ? `${stalls[0].title} (${stalls.length} stall alerts)` : stalls[0].title,
      sub: `Oldest stall opened ${timeAgo(stalls[0].createdAt)}`, go: () => onSection('posts'),
    });
    if (pendingPostsCount > 0) out.push({
      id: 'pending', sev: pendingPostsCount > 5 ? 'med' : 'low',
      title: `${pendingPostsCount} post${pendingPostsCount > 1 ? 's' : ''} pending`,
      sub: 'Review and approve in the publishing queue', go: () => onSection('posts'),
    });
    return out;
  }, [workflows, alerts, pendingPostsCount, onTab, onSection]);

  const recentAlerts = useMemo(() => {
    const seen = new Map<string, { alert: typeof alerts[number]; count: number }>();
    for (const a of alerts) {
      const key = `${a.alertType}|${a.title}`;
      const ex = seen.get(key);
      if (ex) ex.count += 1; else seen.set(key, { alert: a, count: 1 });
    }
    return Array.from(seen.values()).slice(0, 4);
  }, [alerts]);

  const activity = useMemo(() => [
    ...posts.slice(0, 5).map((p) => ({ type: 'post' as const, text: p.text.slice(0, 80), time: p.postedAt, meta: `${formatNum(p.impressions)} views` })),
    ...alerts.slice(0, 5).map((a) => ({ type: 'alert' as const, text: a.title, time: a.createdAt, meta: a.alertType.replace(/_/g, ' ') })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 8), [posts, alerts]);

  return (
    <div>
      {/* TodaysFocus */}
      {focus.length === 0 ? (
        <div className="hx-clear" style={{ marginBottom: '1.8rem' }}>
          <div className="hx-clear-head">Nothing needs you right now</div>
          <div className="hx-clear-data">No failing workflows, no pipeline stalls, no posts waiting on review.</div>
        </div>
      ) : (
        <div style={{ marginBottom: '1.8rem' }}>
          <div className="ec-kicker" style={{ justifyContent: 'space-between' }}>Needs your attention <span className="ec-kicker-count">{focus.length}</span></div>
          <div className="ec-list">
            {focus.map((it) => (
              <button key={it.id} className="ec-item ec-item--hover" onClick={it.go} style={{ width: '100%', cursor: 'pointer', border: 0, background: 'transparent', textAlign: 'left', borderBottom: '1px solid var(--ec-rule)' }}>
                <StatusMark kind={it.sev === 'high' ? 'error' : it.sev === 'med' ? 'warn' : 'unknown'} />
                <div className="ec-item-body">
                  <div className="ec-item-title">{it.title}</div>
                  <div className="ec-item-meta">{it.sub}</div>
                </div>
                <ArrowRight aria-hidden="true" className="w-4 h-4" style={{ color: 'var(--ec-mutedc)', alignSelf: 'center' }} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stat lockups */}
      <div className="hx-stats">
        <div className="hx-stat">
          <span className="hx-stat-num">{stats30d.count}</span>
          <span className="hx-stat-lbl">Posts 30d</span>
          <span className="hx-stat-sub">{formatNum(stats30d.likes)} likes · {formatNum(stats30d.comments)} comments</span>
        </div>
        <div className="hx-stat">
          <span className="hx-stat-num">{formatNum(stats30d.impressions)}</span>
          <span className="hx-stat-lbl">Impressions 30d</span>
          <span className="hx-stat-sub">own feed</span>
        </div>
        <div className="hx-stat">
          <span className="hx-stat-num">{wfStats.active}/{wfStats.total}</span>
          <span className="hx-stat-lbl">Workflows active</span>
          <span className="hx-stat-sub">{wfStats.totalErrors24h} error{wfStats.totalErrors24h === 1 ? '' : 's'} 24h</span>
        </div>
        <div className="hx-stat">
          <span className="hx-stat-num">{alerts.filter((a) => !a.sent).length}</span>
          <span className="hx-stat-lbl">Alerts unsent</span>
          <span className="hx-stat-sub">{messageStats.today} agent msgs today</span>
        </div>
      </div>

      {/* Pipeline strip → system map */}
      <button className="hx-pipe" onClick={() => onSection('pulse')}>
        <div className="hx-pipe-cap">
          <span className="hx-pipe-lbl">Pipeline health</span>
          <span className="hx-pipe-open">Open system map →</span>
        </div>
        <div className="hx-pipe-grid">
          {pipelineHealth.map((p) => (
            <div className="hx-pipe-cell" key={p.id}>
              <StatusMark kind={p.kind === 'error' ? 'error' : p.kind === 'warn' ? 'warn' : 'healthy'} />
              <span className="hx-pipe-name">{p.name.replace(' Pipeline', '').replace(' & Backups', '')}</span>
              <span className="hx-pipe-n">{p.count}</span>
              {p.errors > 0 && <span className="hx-pipe-e">{p.errors}e</span>}
            </div>
          ))}
        </div>
      </button>

      {/* Stack (reused component + its detail modal) */}
      <div style={{ marginBottom: '1.8rem' }}>
        <StackCard />
      </div>

      {/* Activity + alerts + reminders */}
      <div className="hx-cols">
        <div>
          <div className="ec-kicker" style={{ justifyContent: 'space-between' }}>Recent activity <span className="ec-kicker-count">{activity.length}</span></div>
          {activity.length === 0 ? (
            <p className="hx-empty">No recent activity.</p>
          ) : (
            <div className="ec-list">
              {activity.map((it, i) => (
                <div className="ec-item" key={i}>
                  <StatusMark kind={it.type === 'post' ? 'healthy' : 'warn'} />
                  <div className="ec-item-body">
                    <div className="ec-item-title" style={{ fontSize: 13 }}>{it.text}</div>
                    <div className="ec-item-meta">{timeAgo(it.time)} · {it.meta}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="hx-col-rail">
          <div className="ec-kicker" style={{ justifyContent: 'space-between' }}>Recent alerts <span className="ec-kicker-count">{recentAlerts.length}</span></div>
          {recentAlerts.length === 0 ? (
            <p className="hx-empty">No alerts.</p>
          ) : (
            <div className="ec-list" style={{ marginBottom: '1.6rem' }}>
              {recentAlerts.map(({ alert: a, count }) => (
                <div className="ec-item" key={a.id}>
                  <StatusMark kind={a.sent ? 'healthy' : 'warn'} />
                  <div className="ec-item-body">
                    <div className="ec-item-title" style={{ fontSize: 13 }}>{a.title}{count > 1 ? ` ×${count}` : ''}</div>
                    <div className="ec-item-meta">{a.alertType.replace(/_/g, ' ')} · {timeAgo(a.createdAt)}</div>
                  </div>
                  {!a.sent && (
                    <button className="hx-btn hx-btn--ghost" onClick={() => acknowledgeAlert(a.id)} title="Acknowledge" style={{ alignSelf: 'center' }}>
                      <CheckCircle2 className="w-3 h-3" /> Ack
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="ec-kicker" style={{ justifyContent: 'space-between' }}>Upcoming reminders <span className="ec-kicker-count">{reminders.slice(0, 4).length}</span></div>
          {reminders.length === 0 ? (
            <p className="hx-empty">No pending reminders.</p>
          ) : (
            <div className="ec-list">
              {reminders.slice(0, 4).map((r) => (
                <div className="ec-item" key={r.id}>
                  <Clock className="w-3.5 h-3.5" style={{ color: 'var(--ec-mutedc)', flex: '0 0 auto' }} aria-hidden="true" />
                  <div className="ec-item-body">
                    <div className="ec-item-title" style={{ fontSize: 13 }}>{r.reminderText}</div>
                    <div className="ec-item-meta">{timeAgo(r.remindAt)}</div>
                  </div>
                  <button className="hx-btn hx-btn--ghost" onClick={() => completeReminder(r.id)} title="Complete" style={{ alignSelf: 'center' }}>
                    <CheckCircle2 className="w-3 h-3" /> Done
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OverviewTab;
