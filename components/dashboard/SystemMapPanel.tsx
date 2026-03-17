import React, { useMemo } from 'react';
import { Activity, AlertTriangle, CheckCircle2, XCircle, Zap } from 'lucide-react';
import { useWorkflowStats } from '../../hooks/useWorkflowStats';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import StatCard from './shared/StatCard';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import AnimateIn from './shared/AnimateIn';
import { SystemMap } from './system-map';
import { pipelineConfig } from './system-map/config';
import type { WorkflowStat } from '../../types/dashboard';

function getHealth(wf: WorkflowStat): 'healthy' | 'warning' | 'error' | 'inactive' {
  if (!wf.isActive) return 'inactive';
  if (wf.errorAcknowledged) return 'healthy';
  if (wf.lastExecutionStatus === 'error' || wf.errorCount24h > 3) return 'error';
  if (wf.errorCount24h > 0) return 'warning';
  return 'healthy';
}

const colorDot: Record<string, string> = {
  blue: 'bg-blue-400', purple: 'bg-purple-400', emerald: 'bg-emerald-400',
  cyan: 'bg-cyan-400', orange: 'bg-orange-400', green: 'bg-green-400',
  amber: 'bg-amber-400', zinc: 'bg-zinc-400',
};

const colorBg: Record<string, string> = {
  blue: 'bg-blue-500/10 border-blue-500/20', purple: 'bg-purple-500/10 border-purple-500/20',
  emerald: 'bg-emerald-500/10 border-emerald-500/20', cyan: 'bg-cyan-500/10 border-cyan-500/20',
  orange: 'bg-orange-500/10 border-orange-500/20', green: 'bg-green-500/10 border-green-500/20',
  amber: 'bg-amber-500/10 border-amber-500/20', zinc: 'bg-zinc-500/10 border-zinc-600/20',
};

const colorText: Record<string, string> = {
  blue: 'text-blue-400', purple: 'text-purple-400', emerald: 'text-emerald-400',
  cyan: 'text-cyan-400', orange: 'text-orange-400', green: 'text-green-400',
  amber: 'text-amber-400', zinc: 'text-zinc-400',
};

const SystemMapPanel: React.FC = () => {
  const { workflows, stats, loading, refresh } = useWorkflowStats();
  const { lastRefreshed } = useAutoRefresh(refresh, { realtimeTables: ['dashboard_workflow_stats'] });

  const pipelineStats = useMemo(() => {
    return pipelineConfig.map((p) => {
      const matched = workflows.filter((wf) => {
        const name = wf.workflowName.toLowerCase();
        return p.workflows.some((pat) => name.includes(pat.toLowerCase()));
      });
      const errors = matched.reduce((s, w) => s + w.errorCount24h, 0);
      const health = matched.some((w) => getHealth(w) === 'error')
        ? 'error' as const
        : matched.some((w) => getHealth(w) === 'warning')
          ? 'warning' as const
          : 'healthy' as const;
      return { ...p, count: matched.length, errors, health };
    });
  }, [workflows]);

  if (loading) return <LoadingSkeleton cards={4} rows={8} />;

  const successRate = (stats.totalSuccess24h + stats.totalErrors24h) > 0
    ? ((stats.totalSuccess24h / (stats.totalSuccess24h + stats.totalErrors24h)) * 100).toFixed(1)
    : '100';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">System Map</h1>
        <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
      </div>

      {/* Pipeline health chips */}
      <AnimateIn delay={0}>
        <div className="flex flex-wrap gap-2">
          {pipelineStats.map((p) => (
            <div
              key={p.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors ${colorBg[p.color] || colorBg.zinc}`}
            >
              <span className={`w-2 h-2 rounded-full ${
                p.health === 'error' ? 'bg-red-500' :
                p.health === 'warning' ? 'bg-amber-500' :
                colorDot[p.color] || 'bg-zinc-400'
              }`} />
              <span className={`text-xs font-medium ${colorText[p.color] || 'text-zinc-400'}`}>
                {p.name}
              </span>
              <span className="text-[10px] text-zinc-500">{p.count}</span>
              {p.errors > 0 && (
                <span className="text-[10px] text-red-400 font-medium">{p.errors}e</span>
              )}
            </div>
          ))}
        </div>
      </AnimateIn>

      {/* Stats row */}
      <AnimateIn delay={60}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Pipelines" value={pipelineStats.length} icon={<Zap className="w-5 h-5" />} color="text-cyan-400" />
          <StatCard label="Active Workflows" value={stats.active} icon={<Activity className="w-5 h-5" />} color="text-emerald-400" />
          <StatCard label="Errors (24h)" value={stats.totalErrors24h} icon={<XCircle className="w-5 h-5" />} color={stats.totalErrors24h > 0 ? 'text-red-400' : 'text-zinc-500'} />
          <StatCard label="Success Rate" value={`${successRate}%`} icon={<CheckCircle2 className="w-5 h-5" />} color="text-violet-400" />
        </div>
      </AnimateIn>

      {/* Full-size interactive map */}
      <AnimateIn delay={120}>
        <SystemMap workflows={workflows} />
      </AnimateIn>
    </div>
  );
};

export default SystemMapPanel;
