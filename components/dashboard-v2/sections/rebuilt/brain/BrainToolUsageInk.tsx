/*
 * BrainToolUsageInk — BB v4 restyle of v1 BrainToolUsage. n8nClaw tool-usage
 * telemetry (14d) from v_n8nclaw_tool_usage_14d (read-only). The v1 version
 * rendered once inside EVERY ClientRow (an N-duplication quirk); this renders
 * it once as a labelled health table at the foot of the Clients ledger — same
 * data, same columns, reachable, no duplication. Health states map to ink /
 * muted register (healthy=ink solid tick, low_usage/stale=muted hollow tick,
 * high_errors=ink solid tick + ink-bold error figure). Red is NOT spent here
 * (the surface's single red is the pending-compaction alarm).
 */
import React, { useEffect, useState } from 'react';
import { supabase } from '../../../../../lib/supabase';

interface ToolUsageRow {
  tool_name: string;
  calls_14d: number;
  errors_14d: number;
  error_rate_pct: number | null;
  avg_ms: number | null;
  last_called: string;
  health: 'low_usage' | 'high_errors' | 'stale' | 'healthy';
}

const HEALTH_LABEL: Record<string, { label: string; tone: 'ink' | 'muted' }> = {
  healthy: { label: 'healthy', tone: 'ink' },
  low_usage: { label: 'low usage', tone: 'muted' },
  high_errors: { label: 'high errors', tone: 'ink' },
  stale: { label: 'stale', tone: 'muted' },
};

function timeAgoCompact(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'now';
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

const BrainToolUsageInk: React.FC = () => {
  const [rows, setRows] = useState<ToolUsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data, error: e } = await supabase.from('v_n8nclaw_tool_usage_14d').select('*');
      if (cancel) return;
      if (e) setError(e.message);
      else setRows((data || []) as ToolUsageRow[]);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, []);

  const totalCalls = rows.reduce((s, r) => s + r.calls_14d, 0);
  const totalErrors = rows.reduce((s, r) => s + r.errors_14d, 0);
  const anomalies = rows.filter((r) => r.health !== 'healthy').length;

  return (
    <div style={{ marginTop: '1.6rem' }}>
      <div className="ec-kicker">n8nClaw tool usage · 14d</div>
      <p className="br-lead">
        Telemetry from <span className="br-code">n8nclaw_tool_invocations</span>. Anomalies flagged in ink weight, never a second red.
      </p>
      {loading && <div className="br-none">Loading telemetry</div>}
      {!loading && error && <div className="br-err">{error}</div>}
      {!loading && !error && rows.length === 0 && (
        <div className="br-none">No telemetry yet. Wait 5min for the next sync, or trigger n8nClaw via WhatsApp.</div>
      )}
      {!loading && !error && rows.length > 0 && (
        <>
          <div className="br-tools-stats">
            <span className="br-metric"><span className="br-metric-num">{totalCalls}</span><span className="br-metric-lbl">Total calls</span></span>
            <span className="br-metric"><span className={`br-metric-num${totalErrors === 0 ? ' br-metric-num--muted' : ''}`}>{totalErrors}</span><span className="br-metric-lbl">Errors</span></span>
            <span className="br-metric"><span className={`br-metric-num${anomalies === 0 ? ' br-metric-num--muted' : ''}`}>{anomalies}</span><span className="br-metric-lbl">Anomalies</span></span>
          </div>
          <div className="br-tools-table">
            <div className="br-tools-head">
              <div className="br-tools-hcell">Tool</div>
              <div className="br-tools-hcell br-tools-hcell--r br-tools-cell--calls">Calls</div>
              <div className="br-tools-hcell br-tools-hcell--r">Errors</div>
              <div className="br-tools-hcell br-tools-hcell--r br-tools-cell--errpct">Err %</div>
              <div className="br-tools-hcell br-tools-hcell--r br-tools-cell--ms">Avg ms</div>
              <div className="br-tools-hcell">Health</div>
            </div>
            {rows.map((r) => {
              const h = HEALTH_LABEL[r.health] || HEALTH_LABEL.healthy;
              return (
                <div key={r.tool_name} className="br-tools-row">
                  <div className="br-tools-name">{r.tool_name}</div>
                  <div className="br-tools-cell br-tools-cell--r br-tools-cell--calls">{r.calls_14d}</div>
                  <div className={`br-tools-cell br-tools-cell--r ${r.errors_14d > 0 ? 'br-tools-cell--err' : 'br-tools-cell--dim'}`}>{r.errors_14d}</div>
                  <div className="br-tools-cell br-tools-cell--r br-tools-cell--dim br-tools-cell--errpct">{r.error_rate_pct ?? '-'}</div>
                  <div className="br-tools-cell br-tools-cell--r br-tools-cell--dim br-tools-cell--ms">{r.avg_ms ?? '-'}</div>
                  <div className={`br-tools-health br-tools-health--${h.tone}`}>
                    <span>{h.label}</span>
                    <span className="br-tools-age">{timeAgoCompact(r.last_called)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default BrainToolUsageInk;
