import React, { useMemo, useState, useEffect } from 'react';
import { Activity, AlertTriangle, CheckCircle2, XCircle, Zap, Github, ExternalLink, Lock, ChevronDown, ChevronRight } from 'lucide-react';
import { useWorkflowStats } from '../../hooks/useWorkflowStats';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { supabase } from '../../lib/supabase';
import StatCard from './shared/StatCard';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import AnimateIn from './shared/AnimateIn';
import { SystemMap } from './system-map';
import { pipelineConfig } from './system-map/config';
import { timeAgo } from './shared/utils';
import type { WorkflowStat } from '../../types/dashboard';
import type { GitHubRepo } from '../../hooks/useClientMonitoring';

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

const CLIENT_PATTERNS = ['proswppp', 'swppp', 'secondmile', 'second-mile', 'lemonade', 'agencyops', 'agency-ops', 'the-reeder', 'thereeder', 'reeder'];

const langColors: Record<string, string> = {
  TypeScript: 'bg-blue-500/15 text-blue-400',
  JavaScript: 'bg-yellow-500/15 text-yellow-400',
  Python: 'bg-green-500/15 text-green-400',
  HTML: 'bg-orange-500/15 text-orange-400',
  CSS: 'bg-purple-500/15 text-purple-400',
  Shell: 'bg-zinc-500/15 text-zinc-400',
};

const SystemMapPanel: React.FC = () => {
  const { workflows, stats, loading, refresh } = useWorkflowStats();
  const { lastRefreshed } = useAutoRefresh(refresh, { realtimeTables: ['dashboard_workflow_stats'] });
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [reposOpen, setReposOpen] = useState(false);

  useEffect(() => {
    supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'github_repos')
      .single()
      .then(({ data }) => {
        if (data?.value) {
          const all = data.value as GitHubRepo[];
          setRepos(all.filter((r) => !CLIENT_PATTERNS.some((p) => r.name.toLowerCase().includes(p))));
        }
      });
  }, []);

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

      {/* GitHub Repositories */}
      {repos.length > 0 && (
        <AnimateIn delay={180}>
          <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl shadow-sm shadow-black/10 overflow-hidden">
            <button
              onClick={() => setReposOpen(!reposOpen)}
              className="w-full px-4 py-3 flex items-center gap-2 hover:bg-zinc-800/20 transition-colors"
            >
              <Github className="w-4 h-4 text-zinc-400" />
              <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-[0.12em] flex-1 text-left">
                Repositories
              </h2>
              <span className="text-[11px] text-zinc-500">{repos.length}</span>
              {reposOpen ? <ChevronDown className="w-4 h-4 text-zinc-600" /> : <ChevronRight className="w-4 h-4 text-zinc-600" />}
            </button>
            {reposOpen && (
              <div className="border-t border-zinc-800/40 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-3">
                {repos.map((repo) => (
                  <a
                    key={repo.name}
                    href={repo.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-2.5 p-2.5 rounded-lg bg-zinc-800/40 border border-zinc-700/30 hover:border-zinc-600/50 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-zinc-200 font-medium truncate group-hover:text-blue-400 transition-colors">{repo.name}</span>
                        {repo.private && <Lock className="w-2.5 h-2.5 text-zinc-600 shrink-0" />}
                      </div>
                      {repo.description && (
                        <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-1">{repo.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        {repo.language && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${langColors[repo.language] || 'bg-zinc-700/50 text-zinc-400'}`}>
                            {repo.language}
                          </span>
                        )}
                        <span className="text-[10px] text-zinc-600">{timeAgo(repo.pushed_at)}</span>
                      </div>
                    </div>
                    <ExternalLink className="w-3 h-3 text-zinc-700 group-hover:text-blue-400 transition-colors shrink-0 mt-0.5" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </AnimateIn>
      )}
    </div>
  );
};

export default SystemMapPanel;
