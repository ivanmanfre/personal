import React, { useState, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Loader2, Pause, Play } from 'lucide-react';
import { sendToEngineer } from '../../../../../lib/sendToEngineer';
import { timeAgo } from '../../../../dashboard/shared/utils';
import { pipelineConfig } from '../../../../dashboard/system-map/config';
import type { WorkflowStat } from '../../../../../types/dashboard';
import { workflowHealth, WF_LABEL, WF_PRIORITY, StatusMark, StatusTag, type WfHealth } from './shared';
import type { IvanError } from './useIvanErrors';

/*
 * Workflows tab — 292 workflows grouped into pipelines (errors-first), plus the
 * Ivan-System Latest Errors feed. Every mutation reuses the shared hook write
 * paths verbatim: acknowledgeError / togglePause (n8n-toggle edge fn) from
 * useWorkflowStats; requestFix / applyFix / resolve / resolveAll (dashboard_action
 * RPC) + sendToEngineer (WhatsApp webhook) from useIvanErrors / sendToEngineer.
 * Ledger elements 8-19.
 */

const formatDuration = (ms: number | null) => {
  if (ms == null) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
};

const FIX_LABEL: Record<string, { label: string; cls?: string; spin?: boolean }> = {
  requested: { label: 'Queued' },
  analyzing: { label: 'Analyzing', spin: true },
  safe_to_fix: { label: 'Fix ready' },
  fixing: { label: 'Fixing', spin: true },
  fixed: { label: 'Fixed', cls: 'hx-fix--done' },
  not_fixable: { label: 'Manual needed' },
  failed: { label: 'Fix failed', cls: 'hx-fix--fail' },
};

const FixBadge: React.FC<{ status: string; appliedAt?: string | null }> = ({ status, appliedAt }) => {
  const cfg = FIX_LABEL[status];
  if (!cfg) return null;
  return (
    <span className={`hx-fix ${cfg.cls || ''}`}>
      {cfg.spin && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
      {cfg.label}
      {status === 'fixed' && appliedAt && <span>· {timeAgo(appliedAt)}</span>}
    </span>
  );
};

interface PipelineStat {
  id: string; name: string; workflows: WorkflowStat[];
  errors: number; hasError: boolean; hasWarn: boolean; totalRuns: number;
}

interface Props {
  workflows: WorkflowStat[];
  loading: boolean;
  acknowledgeError: (id: string) => void;
  togglePause: (workflowId: string, action: 'pause' | 'resume') => Promise<void>;
  ivanErrors: IvanError[];
  requestFix: (id: string) => void;
  applyFix: (id: string) => void;
  resolveIvanError: (id: string) => void;
  resolveAllIvanErrors: () => void;
}

const WorkflowsTab: React.FC<Props> = ({
  workflows, loading, acknowledgeError, togglePause,
  ivanErrors, requestFix, applyFix, resolveIvanError, resolveAllIvanErrors,
}) => {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [toggling, setToggling] = useState<Record<string, boolean>>({});
  const [sent, setSent] = useState<Record<string, 'sending' | 'sent'>>({});
  const [expandedErr, setExpandedErr] = useState<string | null>(null);

  const toggleRow = useCallback((id: string) => {
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const handleEngineer = useCallback(async (wf: WorkflowStat) => {
    setSent((p) => ({ ...p, [wf.workflowId]: 'sending' }));
    const ok = await sendToEngineer(wf.workflowName, wf.workflowId, wf.lastErrorMessage, wf.errorCount24h, wf.id);
    setSent((p) => ({ ...p, [wf.workflowId]: ok ? 'sent' : 'sending' }));
    if (!ok) setTimeout(() => setSent((p) => { const n = { ...p }; delete n[wf.workflowId]; return n; }), 2000);
  }, []);

  const pipelineStats = useMemo((): PipelineStat[] => {
    const claimed = new Set<string>();
    const map = new Map<string, WorkflowStat[]>();
    pipelineConfig.forEach((p) => map.set(p.id, []));
    for (const p of pipelineConfig) {
      for (const wf of workflows) {
        if (claimed.has(wf.workflowId)) continue;
        if (p.workflows.some((pat) => wf.workflowName.toLowerCase().includes(pat.toLowerCase()))) {
          map.get(p.id)!.push(wf); claimed.add(wf.workflowId);
        }
      }
    }
    const stats = pipelineConfig.map((p) => {
      const matched = map.get(p.id) || [];
      return {
        id: p.id, name: p.name, workflows: matched,
        errors: matched.reduce((s, w) => s + w.errorCount24h, 0),
        hasError: matched.some((w) => workflowHealth(w) === 'error'),
        hasWarn: matched.some((w) => workflowHealth(w) === 'warning'),
        totalRuns: matched.reduce((s, w) => s + w.totalExecutions24h, 0),
      };
    });
    // Catch-all: workflows no pipelineConfig pattern claims. Without this bucket
    // an erroring workflow outside the config is INVISIBLE in every tile and the
    // sidebar/hero counts stop matching the rendered rows (count==array law).
    const unmatched = workflows.filter((wf) => !claimed.has(wf.workflowId));
    if (unmatched.length > 0) {
      stats.push({
        id: 'unmatched', name: 'Unassigned', workflows: unmatched,
        errors: unmatched.reduce((s, w) => s + w.errorCount24h, 0),
        hasError: unmatched.some((w) => workflowHealth(w) === 'error'),
        hasWarn: unmatched.some((w) => workflowHealth(w) === 'warning'),
        totalRuns: unmatched.reduce((s, w) => s + w.totalExecutions24h, 0),
      });
    }
    return stats;
  }, [workflows]);

  const visiblePipelines = useMemo(() => {
    const sorted = pipelineStats
      .filter((p) => p.workflows.length > 0)
      .sort((a, b) => (a.hasError ? 0 : a.hasWarn ? 1 : 2) - (b.hasError ? 0 : b.hasWarn ? 1 : 2));
    if (!search.trim()) return sorted;
    const q = search.toLowerCase();
    return sorted
      .map((p) => ({ ...p, workflows: p.workflows.filter((w) => w.workflowName.toLowerCase().includes(q)) }))
      .filter((p) => p.workflows.length > 0);
  }, [pipelineStats, search]);

  if (loading && workflows.length === 0) return <div className="hx-loading">Reading dashboard_workflow_stats…</div>;

  return (
    <div>
      <div className="hx-toolbar">
        <input
          className="hx-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search workflows…"
          aria-label="Search workflows"
        />
      </div>

      <div className="hx-pgrid">
        {visiblePipelines.map((p) => {
          const errN = p.workflows.filter((w) => workflowHealth(w) === 'error').length;
          const warnN = p.workflows.filter((w) => workflowHealth(w) === 'warning').length;
          const rows = [...p.workflows].sort((a, b) => WF_PRIORITY[workflowHealth(a)] - WF_PRIORITY[workflowHealth(b)]);
          return (
            <div key={p.id} className={`hx-ptile ${p.hasError ? 'hx-ptile--alarm' : ''}`}>
              <div className="hx-ptile-head">
                {p.hasError ? <StatusMark kind="error" /> : p.hasWarn ? <StatusMark kind="warn" /> : <StatusMark kind="healthy" />}
                <span className="hx-ptile-name">{p.name.replace(' Pipeline', '').replace(' & Backups', '')}</span>
                <span className="hx-ptile-n">{p.workflows.length}</span>
                {errN > 0 && <span className="hx-ptile-e">{errN} err</span>}
                {warnN > 0 && !errN && <span className="hx-ptile-n">{warnN} warn</span>}
                <span className="hx-ptile-runs">{p.totalRuns}r</span>
              </div>
              <div className="hx-ptile-rows">
                {rows.map((wf) => {
                  const h: WfHealth = workflowHealth(wf);
                  const hMark = (h === 'warning' ? 'warn' : h) as import('./shared').MarkKind;
                  const isOpen = expanded.has(wf.workflowId);
                  return (
                    <div key={wf.workflowId}>
                      <button className="hx-wf" onClick={() => toggleRow(wf.workflowId)} aria-expanded={isOpen}>
                        <span className="hx-wf-top">
                          <StatusMark kind={hMark} />
                          <span className={`hx-wf-name ${wf.manuallyPaused ? 'hx-wf-name--paused' : ''}`}>{wf.workflowName}</span>
                          {wf.manuallyPaused && <span className="hx-wf-paused">paused</span>}
                          <span className="hx-wf-when">
                            {wf.lastExecutionAt ? timeAgo(wf.lastExecutionAt) : wf.triggerType === 'webhook' ? 'on demand' : '-'}
                          </span>
                          {wf.errorCount24h > 0 && <span className="hx-wf-e">{wf.errorCount24h}e</span>}
                        </span>
                      </button>
                      {isOpen && (
                        <div className="hx-wf-detail">
                          <div className="hx-wf-meta">
                            <span><StatusTag kind={hMark} label={WF_LABEL[h]} /></span>
                            <span>last: <b className={wf.lastExecutionStatus === 'error' ? 'hx-err-word' : ''}>{wf.lastExecutionStatus || '-'}</b></span>
                            <span>{formatDuration(wf.lastExecutionDurationMs)}</span>
                            <span>{wf.totalExecutions24h} runs</span>
                          </div>
                          {wf.scheduleExpression && <div className="hx-wf-meta">schedule: <b>{wf.scheduleExpression}</b></div>}
                          {wf.lastErrorMessage && (
                            <div className="hx-errbox">
                              <span className="hx-errbox-when">{timeAgo(wf.lastExecutionAt)}</span>
                              {wf.lastErrorMessage}
                            </div>
                          )}
                          <div className="hx-acts">
                            <a
                              className="hx-btn hx-btn--ghost"
                              href={`https://n8n.ivanmanfredi.com/workflow/${wf.workflowId}`}
                              target="_blank" rel="noopener noreferrer"
                            >
                              <ExternalLink className="w-2.5 h-2.5" /> n8n
                            </a>
                            <button
                              className="hx-btn hx-btn--ghost"
                              disabled={!!toggling[wf.workflowId]}
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (toggling[wf.workflowId]) return;
                                setToggling((p) => ({ ...p, [wf.workflowId]: true }));
                                await togglePause(wf.workflowId, wf.manuallyPaused ? 'resume' : 'pause');
                                setToggling((p) => { const n = { ...p }; delete n[wf.workflowId]; return n; });
                              }}
                            >
                              {toggling[wf.workflowId]
                                ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                : wf.manuallyPaused ? <Play className="w-2.5 h-2.5" /> : <Pause className="w-2.5 h-2.5" />}
                              {wf.manuallyPaused ? 'Resume' : 'Pause'}
                            </button>
                            {wf.errorCount24h > 0 && !wf.errorAcknowledged && (
                              <button className="hx-btn hx-btn--ghost" onClick={(e) => { e.stopPropagation(); acknowledgeError(wf.id); }}>Resolve</button>
                            )}
                            {wf.errorCount24h > 0 && (
                              <button
                                className="hx-btn hx-btn--ghost"
                                disabled={!!sent[wf.workflowId]}
                                onClick={(e) => { e.stopPropagation(); handleEngineer(wf); }}
                              >
                                {sent[wf.workflowId] === 'sent' ? 'Sent' : sent[wf.workflowId] === 'sending' ? '…' : 'Engineer'}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Latest Errors (Ivan System) ── */}
      {ivanErrors.length > 0 && (
        <div className="hx-errs">
          <div className="hx-errs-cap">
            <span className="hx-errs-h">Latest Errors</span>
            <span className="hx-errs-n">{ivanErrors.length} open</span>
            <button
              className="hx-btn"
              onClick={() => { if (confirm(`Clear all ${ivanErrors.length} errors?`)) resolveAllIvanErrors(); }}
            >
              Clear all
            </button>
          </div>
          {ivanErrors.map((err) => {
            const isOpen = expandedErr === err.id;
            const markKind = err.severity === 'high' ? 'error' : err.severity === 'medium' ? 'warn' : 'inactive';
            return (
              <div className="hx-err" key={err.id}>
                <button className="hx-err-btn" onClick={() => setExpandedErr(isOpen ? null : err.id)} aria-expanded={isOpen}>
                  <div className="hx-err-top">
                    <StatusMark kind={markKind} />
                    <span className="hx-err-wf">{err.workflowName || err.workflowId}</span>
                    <span className={`hx-err-sev ${err.severity === 'high' ? 'hx-err-sev--high' : ''}`}>{err.severity}</span>
                    {err.occurrenceCount > 1 && <span className="hx-err-count">{err.occurrenceCount}x</span>}
                    {err.fixStatus && <FixBadge status={err.fixStatus} appliedAt={err.fixAppliedAt} />}
                    <span className="hx-err-when">{timeAgo(err.lastSeen)}</span>
                    <span className="hx-job-chev">{isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}</span>
                  </div>
                  {err.errorMessage && <div className="hx-err-msg">{err.errorMessage}</div>}
                </button>
                {isOpen && (
                  <div className="hx-err-detail">
                    {err.errorMessage && <div className="hx-err-block hx-err-block--mono">{err.errorMessage}</div>}
                    {err.aiAnalysis && <div className="hx-err-block"><b>Analysis</b>{err.aiAnalysis}</div>}
                    {err.fixAnalysis && (
                      <div className="hx-err-block">
                        <b>Engineer analysis</b>{err.fixAnalysis}
                        {err.fixDescription && <div style={{ marginTop: '0.3rem', color: 'var(--ec-mutedc)' }}>Proposed fix: {err.fixDescription}</div>}
                      </div>
                    )}
                    <div className="hx-err-foot">
                      <span className="hx-err-ids">
                        <span>Workflow: {err.workflowId}</span>
                        {err.executionId && (
                          <a
                            className="hx-link"
                            href={`https://n8n.ivanmanfredi.com/workflow/${err.workflowId}/executions/${err.executionId}`}
                            target="_blank" rel="noopener noreferrer"
                          >
                            <ExternalLink className="w-3 h-3" style={{ display: 'inline', verticalAlign: '-2px' }} /> Execution
                          </a>
                        )}
                      </span>
                      <div className="hx-acts">
                        {err.fixStatus === 'safe_to_fix' ? (
                          <>
                            <FixBadge status={err.fixStatus} appliedAt={err.fixAppliedAt} />
                            <button className="hx-btn" onClick={(e) => { e.stopPropagation(); applyFix(err.id); }}>Apply fix</button>
                          </>
                        ) : err.fixStatus ? (
                          <FixBadge status={err.fixStatus} appliedAt={err.fixAppliedAt} />
                        ) : (
                          <button className="hx-btn hx-btn--ghost" onClick={(e) => { e.stopPropagation(); requestFix(err.id); }}>Tell engineer</button>
                        )}
                        <button className="hx-btn hx-btn--ghost" onClick={(e) => { e.stopPropagation(); resolveIvanError(err.id); }}>Resolve</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WorkflowsTab;
