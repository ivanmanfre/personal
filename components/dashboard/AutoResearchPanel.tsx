import React, { useState, useMemo } from 'react';
import {
  FlaskConical, TrendingDown, TrendingUp, Play, Pause, RotateCcw, ChevronLeft,
  Zap, Target, Settings2, Check, AlertTriangle, BarChart3,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine,
} from 'recharts';
import { useAutoResearch } from '../../hooks/useAutoResearch';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import StatCard from './shared/StatCard';
import PanelCard from './shared/PanelCard';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import AnimateIn from './shared/AnimateIn';
import EmptyState from './shared/EmptyState';
import { timeAgo } from './shared/utils';
import type { AutoResearchSession } from '../../types/dashboard';

type CategoryFilter = 'all' | 'content' | 'outreach' | 'operations';

const STATUS_STYLES: Record<string, { dot: string; bg: string; text: string }> = {
  running: { dot: 'bg-emerald-400', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  paused: { dot: 'bg-amber-400', bg: 'bg-amber-500/10', text: 'text-amber-400' },
  completed: { dot: 'bg-blue-400', bg: 'bg-blue-500/10', text: 'text-blue-400' },
  failed: { dot: 'bg-red-400', bg: 'bg-red-500/10', text: 'text-red-400' },
  idle: { dot: 'bg-zinc-500', bg: 'bg-zinc-500/10', text: 'text-zinc-400' },
};

const CATEGORY_COLORS: Record<string, string> = {
  content: 'text-violet-400',
  outreach: 'text-cyan-400',
  operations: 'text-amber-400',
};

const tooltipStyle = {
  backgroundColor: '#18181b',
  border: '1px solid rgba(63, 63, 70, 0.6)',
  borderRadius: 10,
  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
  padding: '8px 12px',
};

function formatMetric(value: number | null, unit: string): string {
  if (value == null) return '—';
  if (unit === 'ms') return `${value.toFixed(1)}ms`;
  if (unit === '%') return `${value.toFixed(1)}%`;
  if (unit === 'score') return value.toFixed(1);
  return value.toFixed(1) + (unit ? ` ${unit}` : '');
}

function formatImprovement(pct: number | null, direction: string): { text: string; positive: boolean } {
  if (pct == null) return { text: '—', positive: false };
  const isGood = direction === 'lower_is_better' ? pct < 0 : pct > 0;
  const sign = pct > 0 ? '+' : '';
  return { text: `${sign}${pct.toFixed(1)}%`, positive: isGood };
}

const AutoResearchPanel: React.FC = () => {
  const {
    sessions, loading, loadingIterations, refresh, stats,
    selectedSession, selectedSessionId, setSelectedSessionId,
    selectedIterations, updateSessionStatus,
  } = useAutoResearch();
  const { lastRefreshed } = useAutoRefresh(refresh, { realtimeTables: ['auto_research_sessions', 'auto_research_iterations'] });

  const [category, setCategory] = useState<CategoryFilter>('all');

  const filtered = useMemo(
    () => category === 'all' ? sessions : sessions.filter((s) => s.category === category),
    [sessions, category]
  );

  if (loading) return <LoadingSkeleton cards={4} rows={6} />;

  // ─── Session Detail View ───
  if (selectedSession) {
    return <SessionDetail
      session={selectedSession}
      iterations={selectedIterations}
      loadingIterations={loadingIterations}
      onBack={() => setSelectedSessionId(null)}
      onStatusChange={updateSessionStatus}
      lastRefreshed={lastRefreshed}
      onRefresh={refresh}
    />;
  }

  // ─── Sessions List View ───
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Auto Research</h1>
          {stats.running > 0 && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span className="text-[11px] font-medium text-emerald-400">{stats.running} live</span>
            </span>
          )}
        </div>
        <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
      </div>

      {/* Data Warning */}
      <AnimateIn>
        <div className="relative bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
          <div className="flex gap-3">
            <div className="shrink-0 w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <AlertTriangle className="w-4.5 h-4.5 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-300">Insufficient data for meaningful research</p>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Auto-research requires real engagement data to score prompt variations against. Currently there are ~30 posts with minimal engagement — without this signal, all scoring is LLM self-evaluation (Claude rating its own output), which produces circular results that don't reflect actual audience response.
              </p>
              <div className="flex items-center gap-4 mt-2.5">
                <div className="flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="text-[11px] text-zinc-500">Need ~100+ posts with engagement variance</span>
                </div>
                <span className="text-[11px] text-zinc-600">|</span>
                <span className="text-[11px] text-zinc-500">Sessions are paused until data is available</span>
              </div>
            </div>
          </div>
        </div>
      </AnimateIn>

      {/* KPI Row */}
      <AnimateIn delay={50}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Active Sessions" value={stats.running} icon={<FlaskConical className="w-5 h-5" />} color="text-emerald-400" subValue={`${stats.total} total`} />
          <StatCard label="Total Runs" value={stats.totalRuns} icon={<RotateCcw className="w-5 h-5" />} color="text-blue-400" subValue={`${stats.totalKept} kept`} />
          <StatCard
            label="Avg Improvement"
            value={stats.avgImprovementPct !== 0 ? `${stats.avgImprovementPct > 0 ? '+' : ''}${stats.avgImprovementPct.toFixed(1)}%` : '—'}
            icon={<TrendingUp className="w-5 h-5" />}
            color="text-violet-400"
          />
          <StatCard
            label="Best Result"
            value={stats.bestSession ? `${(stats.bestSession.improvementPct || 0) > 0 ? '+' : ''}${(stats.bestSession.improvementPct || 0).toFixed(1)}%` : '—'}
            icon={<Zap className="w-5 h-5" />}
            color="text-amber-400"
            subValue={stats.bestSession?.name}
          />
        </div>
      </AnimateIn>

      {/* Category filter */}
      <div className="flex gap-1.5">
        {(['all', 'content', 'outreach', 'operations'] as CategoryFilter[]).map((c) => (
          <button key={c} onClick={() => setCategory(c)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 capitalize ${
              category === c
                ? 'bg-zinc-800/80 text-white border border-zinc-700/60'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'
            }`}>
            {c}
          </button>
        ))}
      </div>

      {/* Sessions */}
      {filtered.length === 0 ? (
        <EmptyState title="No research sessions" description="Research sessions will appear here once configured" icon={<FlaskConical className="w-10 h-10" />} />
      ) : (
        <AnimateIn delay={150}>
          <PanelCard title="Research Sessions" icon={<FlaskConical className="w-4 h-4" />} badge={filtered.length} accent="emerald">
            <div className="divide-y divide-zinc-800/40">
              {filtered.map((session) => (
                <SessionRow key={session.id} session={session} onClick={() => setSelectedSessionId(session.id)} />
              ))}
            </div>
          </PanelCard>
        </AnimateIn>
      )}
    </div>
  );
};

// ─── Session Row ───

const SessionRow: React.FC<{ session: AutoResearchSession; onClick: () => void }> = ({ session, onClick }) => {
  const statusStyle = STATUS_STYLES[session.status] || STATUS_STYLES.idle;
  const imp = formatImprovement(session.improvementPct, session.metricDirection);
  const catColor = CATEGORY_COLORS[session.category] || 'text-zinc-400';

  return (
    <button onClick={onClick} className="w-full text-left px-4 py-3.5 hover:bg-zinc-800/30 transition-colors duration-150 group">
      <div className="flex items-center gap-4">
        {/* Status + Name */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-1">
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium ${statusStyle.bg} ${statusStyle.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot} ${session.status === 'running' ? 'animate-pulse' : ''}`} />
              {session.status}
            </span>
            <span className={`text-[10px] font-medium uppercase tracking-wider ${catColor}`}>{session.category}</span>
          </div>
          <p className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors truncate">{session.name}</p>
          {session.description && (
            <p className="text-xs text-zinc-500 mt-0.5 truncate">{session.description}</p>
          )}
        </div>

        {/* Metric cards */}
        <div className="hidden sm:flex items-center gap-6">
          <div className="text-right">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Current Best</p>
            <p className="text-sm font-semibold text-zinc-200">{formatMetric(session.currentBestValue, session.metricUnit)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Baseline</p>
            <p className="text-sm font-medium text-zinc-400">{formatMetric(session.baselineValue, session.metricUnit)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Improvement</p>
            <p className={`text-sm font-semibold ${imp.positive ? 'text-emerald-400' : session.improvementPct != null ? 'text-red-400' : 'text-zinc-500'}`}>
              {imp.text}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Runs / Kept</p>
            <p className="text-sm font-medium text-zinc-300">{session.totalRuns} / {session.keptRuns}</p>
          </div>
        </div>

        {/* Last run */}
        <div className="hidden lg:block text-right">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Last Run</p>
          <p className="text-xs text-zinc-400">{timeAgo(session.lastRunAt)}</p>
        </div>
      </div>
    </button>
  );
};

// ─── Session Detail View ───

interface SessionDetailProps {
  session: AutoResearchSession;
  iterations: import('../../types/dashboard').AutoResearchIteration[];
  loadingIterations: boolean;
  onBack: () => void;
  onStatusChange: (id: string, status: string) => void;
  lastRefreshed: Date;
  onRefresh: () => void;
}

const SessionDetail: React.FC<SessionDetailProps> = ({
  session, iterations, loadingIterations, onBack, onStatusChange, lastRefreshed, onRefresh,
}) => {
  const statusStyle = STATUS_STYLES[session.status] || STATUS_STYLES.idle;
  const imp = formatImprovement(session.improvementPct, session.metricDirection);

  const chartData = useMemo(() =>
    iterations.map((it) => ({
      run: it.runNumber,
      value: it.metricAfter,
      kept: it.kept,
      description: it.changeDescription,
    })),
  [iterations]);

  // Custom dot renderer: orange filled for kept, no dot for reverted
  const renderDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null || !payload?.kept) return null;
    return <circle cx={cx} cy={cy} r={5} fill="#f97316" stroke="#18181b" strokeWidth={2} />;
  };

  const hasChartData = chartData.length > 0 && chartData.some((d) => d.value != null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-zinc-800/50 text-zinc-400 hover:text-white transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight">{session.name}</h1>
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot} ${session.status === 'running' ? 'animate-pulse' : ''}`} />
                {session.status}
              </span>
            </div>
            {session.description && (
              <p className="text-sm text-zinc-500 mt-0.5">{session.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {session.status === 'running' && (
            <button onClick={() => onStatusChange(session.id, 'paused')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 transition-colors">
              <Pause className="w-3.5 h-3.5" /> Pause
            </button>
          )}
          {(session.status === 'paused' || session.status === 'idle') && (
            <button onClick={() => onStatusChange(session.id, 'running')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors">
              <Play className="w-3.5 h-3.5" /> {session.status === 'idle' ? 'Start' : 'Resume'}
            </button>
          )}
          <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={onRefresh} />
        </div>
      </div>

      {/* KPI Cards */}
      <AnimateIn>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Current Best"
            value={formatMetric(session.currentBestValue, session.metricUnit)}
            icon={<Zap className="w-5 h-5" />}
            color="text-emerald-400"
          />
          <StatCard
            label="Baseline"
            value={formatMetric(session.baselineValue, session.metricUnit)}
            icon={<Target className="w-5 h-5" />}
            color="text-blue-400"
          />
          <StatCard
            label="Improvement"
            value={imp.text}
            icon={imp.positive ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            color={imp.positive ? 'text-emerald-400' : 'text-red-400'}
          />
          <StatCard
            label="Runs / Kept"
            value={`${session.totalRuns} / ${session.keptRuns}`}
            icon={<RotateCcw className="w-5 h-5" />}
            color="text-violet-400"
          />
        </div>
      </AnimateIn>

      {/* Chart */}
      <AnimateIn delay={100}>
        <PanelCard title={`${session.metricName} over runs`} icon={<FlaskConical className="w-4 h-4" />} accent="emerald">
          {iterations.length === 0 || !hasChartData ? (
            <div className="h-72 flex items-center justify-center text-zinc-600 text-sm">
              {loadingIterations ? 'Loading iterations...' : 'No iterations yet'}
            </div>
          ) : (
            <div className="p-4">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="arGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(39, 39, 42, 0.6)" />
                  <XAxis
                    dataKey="run"
                    tick={{ fill: '#52525b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    label={{ value: 'Run #', position: 'insideBottomRight', offset: -5, fill: '#52525b', fontSize: 11 }}
                  />
                  <YAxis
                    tick={{ fill: '#52525b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    label={{ value: session.metricUnit || session.metricName, angle: -90, position: 'insideLeft', fill: '#52525b', fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: '#a1a1aa', fontSize: 12 }}
                    itemStyle={{ color: '#e4e4e7', fontSize: 12 }}
                    formatter={(value: any, _name: string, props: any) => {
                      const entry = props?.payload;
                      const formatted = value != null && !isNaN(value)
                        ? `${value}${session.metricUnit ? ' ' + session.metricUnit : ''}`
                        : '—';
                      return [formatted, entry?.kept ? 'Kept' : 'Reverted'];
                    }}
                    labelFormatter={(label) => `Run #${label}`}
                  />
                  {session.baselineValue != null && (
                    <ReferenceLine
                      y={session.baselineValue}
                      stroke="#f59e0b"
                      strokeDasharray="6 3"
                      strokeOpacity={0.5}
                      label={{ value: 'Baseline', fill: '#f59e0b', fontSize: 10, position: 'insideTopRight' }}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#a78bfa"
                    fill="url(#arGrad)"
                    strokeWidth={2}
                    dot={renderDot}
                    activeDot={{ r: 5, strokeWidth: 0, fill: '#c4b5fd' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </PanelCard>
      </AnimateIn>

      {/* Iteration Log */}
      <AnimateIn delay={200}>
        <PanelCard title="Iteration Log" icon={<Settings2 className="w-4 h-4" />} badge={iterations.length} accent="blue" scrollable>
          {iterations.length === 0 ? (
            <div className="px-4 py-8 text-center text-zinc-600 text-sm">
              {loadingIterations ? 'Loading...' : 'No iterations yet'}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-2.5">#</th>
                  <th className="text-left px-4 py-2.5">Change</th>
                  <th className="text-right px-4 py-2.5">{session.metricName}</th>
                  <th className="text-right px-4 py-2.5">Delta</th>
                  <th className="text-center px-4 py-2.5">Kept</th>
                  <th className="text-right px-4 py-2.5">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/30">
                {[...iterations].reverse().map((it) => {
                  const delta = it.metricBefore != null && it.metricAfter != null
                    ? it.metricAfter - it.metricBefore
                    : null;
                  const isGood = delta != null && (session.metricDirection === 'lower_is_better' ? delta < 0 : delta > 0);
                  return (
                    <tr key={it.id} className="hover:bg-zinc-800/20 transition-colors text-sm">
                      <td className="px-4 py-2.5 text-zinc-500 font-mono text-xs">{it.runNumber}</td>
                      <td className="px-4 py-2.5 text-zinc-300 max-w-xs truncate">{it.changeDescription}</td>
                      <td className="px-4 py-2.5 text-right text-zinc-300 font-mono text-xs">
                        {formatMetric(it.metricAfter, session.metricUnit)}
                      </td>
                      <td className={`px-4 py-2.5 text-right font-mono text-xs ${delta == null ? 'text-zinc-500' : isGood ? 'text-emerald-400' : 'text-red-400'}`}>
                        {delta != null ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)}` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {it.kept ? (
                          <Check className="w-4 h-4 text-emerald-400 mx-auto" />
                        ) : (
                          <span className="w-4 h-4 block mx-auto text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right text-zinc-500 text-xs">{timeAgo(it.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </PanelCard>
      </AnimateIn>

      {/* Config info */}
      <AnimateIn delay={300}>
        <PanelCard title="Session Config" icon={<Settings2 className="w-4 h-4" />} accent="purple">
          <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
            <ConfigItem label="Target Type" value={session.targetType} />
            <ConfigItem label="Target Ref" value={session.targetRef} />
            <ConfigItem label="Metric" value={`${session.metricName} (${session.metricDirection.replace(/_/g, ' ')})`} />
            <ConfigItem label="Prompt Page" value={session.promptPageId || '—'} />
            <ConfigItem label="Workflow" value={session.workflowId || '—'} />
            <ConfigItem label="Created" value={new Date(session.createdAt).toLocaleDateString()} />
          </div>
        </PanelCard>
      </AnimateIn>
    </div>
  );
};

const ConfigItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">{label}</p>
    <p className="text-sm text-zinc-300 font-medium truncate">{value}</p>
  </div>
);

export default AutoResearchPanel;
