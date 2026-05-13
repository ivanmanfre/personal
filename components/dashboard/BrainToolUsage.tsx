import React, { useEffect, useState } from 'react';
import { Activity, AlertTriangle, MoonStar, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import PanelCard from './shared/PanelCard';

interface ToolUsageRow {
  tool_name: string;
  calls_14d: number;
  errors_14d: number;
  error_rate_pct: number | null;
  avg_ms: number | null;
  last_called: string;
  health: 'low_usage' | 'high_errors' | 'stale' | 'healthy';
}

const HEALTH_STYLE: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  healthy:     { color: 'text-emerald-300', bg: 'bg-emerald-500/10', icon: <CheckCircle2 className="w-3 h-3" />, label: 'healthy' },
  low_usage:   { color: 'text-zinc-400',    bg: 'bg-zinc-700/30',    icon: <MoonStar className="w-3 h-3" />,     label: 'low usage' },
  high_errors: { color: 'text-red-300',     bg: 'bg-red-500/15',     icon: <AlertTriangle className="w-3 h-3" />, label: 'high errors' },
  stale:       { color: 'text-amber-300',   bg: 'bg-amber-500/15',   icon: <MoonStar className="w-3 h-3" />,     label: 'stale' },
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

const BrainToolUsage: React.FC = () => {
  const [rows, setRows] = useState<ToolUsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data, error: e } = await supabase
        .from('v_n8nclaw_tool_usage_14d')
        .select('*');
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
    <PanelCard
      title="n8nClaw tool usage (14d)"
      icon={<Activity className="w-4 h-4 text-cyan-400" />}
      accent="cyan"
    >
      <p className="text-xs text-zinc-500 mb-3">
        Telemetry from <code className="font-mono text-zinc-400">n8nclaw_tool_invocations</code>. Anomalies flagged in red/amber/zinc.
      </p>
      {loading && <div className="text-xs text-zinc-500 py-2">Loading…</div>}
      {!loading && error && <div className="text-xs text-red-400">{error}</div>}
      {!loading && !error && rows.length === 0 && (
        <div className="text-xs text-zinc-500 py-2">No telemetry yet — wait 5min for next sync, or trigger n8nClaw via WhatsApp.</div>
      )}
      {!loading && !error && rows.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-lg px-3 py-2">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Total calls</div>
              <div className="text-lg font-semibold text-zinc-100">{totalCalls}</div>
            </div>
            <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-lg px-3 py-2">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Errors</div>
              <div className={`text-lg font-semibold ${totalErrors > 0 ? 'text-red-300' : 'text-zinc-100'}`}>{totalErrors}</div>
            </div>
            <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-lg px-3 py-2">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Anomalies</div>
              <div className={`text-lg font-semibold ${anomalies > 0 ? 'text-amber-300' : 'text-zinc-100'}`}>{anomalies}</div>
            </div>
          </div>
          <div className="border border-zinc-800/60 rounded-lg overflow-hidden bg-zinc-900/30">
            <div className="grid grid-cols-[1fr_60px_60px_60px_60px_90px] gap-2 px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-500 bg-zinc-800/30 border-b border-zinc-800/40">
              <div>Tool</div>
              <div className="text-right">Calls</div>
              <div className="text-right">Errors</div>
              <div className="text-right">Err %</div>
              <div className="text-right">Avg ms</div>
              <div>Health</div>
            </div>
            {rows.map((r) => {
              const style = HEALTH_STYLE[r.health] || HEALTH_STYLE.healthy;
              return (
                <div
                  key={r.tool_name}
                  className="grid grid-cols-[1fr_60px_60px_60px_60px_90px] gap-2 px-3 py-2 text-xs items-center border-b border-zinc-800/30 last:border-b-0 hover:bg-zinc-800/20"
                >
                  <div className="text-zinc-200 font-mono truncate">{r.tool_name}</div>
                  <div className="text-right text-zinc-300 font-mono">{r.calls_14d}</div>
                  <div className={`text-right font-mono ${r.errors_14d > 0 ? 'text-red-300' : 'text-zinc-500'}`}>{r.errors_14d}</div>
                  <div className={`text-right font-mono ${(r.error_rate_pct || 0) > 25 ? 'text-red-300' : 'text-zinc-500'}`}>{r.error_rate_pct ?? '-'}</div>
                  <div className="text-right text-zinc-500 font-mono">{r.avg_ms ?? '-'}</div>
                  <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${style.bg} ${style.color} font-medium border border-current/20`}>
                    {style.icon}
                    <span>{style.label}</span>
                    <span className="ml-auto text-zinc-500">{timeAgoCompact(r.last_called)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </PanelCard>
  );
};

export default BrainToolUsage;
