import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import '../../editorial-cockpit.css';
import './health/health.css';
import { useWorkflowStats } from '../../../../hooks/useWorkflowStats';
import { useScheduledOps } from '../../../../hooks/useScheduledOps';
import { useAutoRefresh } from '../../../../hooks/useAutoRefresh';
import { useDashboard } from '../../../../contexts/DashboardContext';
import { workflowHealth } from './health/shared';
import { useIvanErrors } from './health/useIvanErrors';
import OverviewTab from './health/OverviewTab';
import WorkflowsTab from './health/WorkflowsTab';
import ScheduledOpsTab from './health/ScheduledOpsTab';

/*
 * Health — Black Box v4 ELEVATE rebuild (dashfinish/interiors).
 *
 * The flip: the one truly actionable number (scheduled ops OVERDUE) sat three
 * clicks deep in tab 3. It now leads the section as the hero figure inside THE
 * BOX, above the tab strip, so Health opens on what needs attention. The three
 * tabs (Overview / Workflows / Scheduled Ops) survive below with every
 * capability and every write path (dashboard_action RPC, n8n-toggle edge fn,
 * WhatsApp webhook) reused from the shared hooks, never re-implemented.
 */

type TabKey = 'overview' | 'workflows' | 'ops';
const TAB_KEY = 'r2-system-health-tab';

function goSection(id: string) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.set('section', id);
  url.searchParams.delete('sub');
  window.history.pushState(null, '', url.toString());
  window.dispatchEvent(new PopStateEvent('popstate'));
}

const nowLabel = () =>
  new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();

export default function HealthRebuilt() {
  const { setSystemHealth } = useDashboard();
  const { workflows, stats: wfStats, loading: wfLoading, refresh: refreshWf, acknowledgeError, togglePause } = useWorkflowStats();
  const { jobs, stats: jobStats, loading: jobLoading, refresh: refreshJobs } = useScheduledOps();

  const { lastRefreshed, refresh } = useAutoRefresh(
    async () => { await Promise.all([refreshWf(), refreshJobs()]); },
    { realtimeTables: ['dashboard_workflow_stats', 'scheduled_job_registry'] },
  );

  const ivan = useIvanErrors(lastRefreshed);

  const [tab, setTab] = useState<TabKey>(() => {
    if (typeof window !== 'undefined') {
      const v = localStorage.getItem(TAB_KEY);
      if (v === 'overview' || v === 'workflows' || v === 'ops') return v;
    }
    return 'overview';
  });
  useEffect(() => { try { localStorage.setItem(TAB_KEY, tab); } catch {} }, [tab]);

  useEffect(() => { setSystemHealth(wfStats.health); }, [wfStats.health, setSystemHealth]);

  const wfError = useMemo(() => workflows.filter((w) => workflowHealth(w) === 'error').length, [workflows]);

  // Attention dimensions, most-severe first. The first non-zero becomes the
  // hero's single red lead figure; the rest ride as ink secondaries.
  const dims = [
    { key: 'overdue', n: jobStats.overdue, label: 'Scheduled ops overdue', tab: 'ops' as TabKey },
    { key: 'wferror', n: wfError, label: 'Workflows erroring', tab: 'workflows' as TabKey },
    { key: 'erroring', n: jobStats.erroring, label: 'Scheduled ops erroring', tab: 'ops' as TabKey },
    { key: 'unresolved', n: ivan.ivanErrors.length, label: 'Unresolved system errors', tab: 'workflows' as TabKey },
  ];
  const lead = dims.find((d) => d.n > 0) || null;
  const rest = lead ? dims.filter((d) => d.key !== lead.key) : dims.slice(1);
  const loading = wfLoading || jobLoading;

  return (
    <div className="ec">
      <div className="ec-topline">
        <span className="ec-topline-brand">Health</span>
        <span className="ec-topline-meta">{nowLabel()}</span>
      </div>

      <div className="hx-head">
        <h1 className="ec-hed ec-hed--today" style={{ fontSize: 'clamp(40px,4.4vw,60px)', margin: 0 }}>Health</h1>
        <div className="ws-tools" style={{ marginLeft: 'auto' }}>
          <button className="ws-tool-icon" onClick={refresh} title="Refresh" aria-label="Refresh health data">
            <RefreshCw className={`w-4 h-4 ${loading ? 'hx-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── HERO: attention strip above the tabs ── */}
      {lead ? (
        <div className="hx-hero">
          <div className="hx-hero-head">Warning: operations need attention</div>
          <div className="hx-hero-body">
            <button className="hx-lead" onClick={() => setTab(lead.tab)}>
              <span className="hx-lead-num">{lead.n}</span>
              <span className="hx-lead-lbl">{lead.label}</span>
              <span className="hx-lead-view">View →</span>
            </button>
            <div className="hx-hero-rest">
              {rest.map((d) => (
                <button key={d.key} className="hx-rest-cell" onClick={() => setTab(d.tab)}>
                  <span className={`hx-rest-num ${d.n === 0 ? 'hx-rest-num--zero' : ''}`}>{d.n}</span>
                  <span className="hx-rest-lbl">{d.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="hx-clear">
          <div className="hx-clear-head">All operations nominal</div>
          <div className="hx-clear-data">
            {wfStats.active}/{wfStats.total} workflows active · {jobStats.ok}/{jobStats.total} scheduled ops OK · 0 overdue · 0 unresolved errors
          </div>
        </div>
      )}

      {/* ── TAB STRIP ── */}
      <div className="ec-tabs" role="tablist" aria-label="Health views">
        <button className="ec-tab hx-tab" role="tab" aria-selected={tab === 'overview'} onClick={() => setTab('overview')}>Overview</button>
        <button className="ec-tab hx-tab" role="tab" aria-selected={tab === 'workflows'} onClick={() => setTab('workflows')}>
          Workflows<span className={`hx-tabcount ${wfError > 0 ? 'hx-tabcount--alarm' : ''}`}>{wfError > 0 ? wfError : wfStats.total}</span>
        </button>
        <button className="ec-tab hx-tab" role="tab" aria-selected={tab === 'ops'} onClick={() => setTab('ops')}>
          Scheduled Ops<span className={`hx-tabcount ${jobStats.overdue > 0 ? 'hx-tabcount--alarm' : ''}`}>{jobStats.overdue > 0 ? jobStats.overdue : jobStats.total}</span>
        </button>
      </div>

      {tab === 'overview' && (
        <OverviewTab
          workflows={workflows}
          wfStats={wfStats}
          onTab={setTab}
          onSection={goSection}
        />
      )}
      {tab === 'workflows' && (
        <WorkflowsTab
          workflows={workflows}
          loading={loading}
          acknowledgeError={acknowledgeError}
          togglePause={togglePause}
          ivanErrors={ivan.ivanErrors}
          requestFix={ivan.requestFix}
          applyFix={ivan.applyFix}
          resolveIvanError={ivan.resolveIvanError}
          resolveAllIvanErrors={ivan.resolveAllIvanErrors}
        />
      )}
      {tab === 'ops' && (
        <ScheduledOpsTab jobs={jobs} loading={jobLoading} />
      )}
    </div>
  );
}
