import React, { useState, useMemo } from 'react';
import {
  Timer, CheckCircle2, AlertTriangle, XCircle, HelpCircle, PauseCircle,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import { useScheduledOps } from '../../hooks/useScheduledOps';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import AnimateIn from './shared/AnimateIn';
import FilterBar from './shared/FilterBar';
import { timeAgo } from './shared/utils';
import type { ScheduledJob, ScheduledStatus } from '../../types/dashboard';

/* ── Status presentation ── */
const STATUS_META: Record<ScheduledStatus, { label: string; pill: string; dot: string; priority: number }> = {
  OVERDUE:  { label: 'Overdue',  pill: 'bg-red-500/15 text-red-300 border-red-500/30',       dot: 'bg-red-400',     priority: 0 },
  ERRORING: { label: 'Erroring', pill: 'bg-orange-500/15 text-orange-300 border-orange-500/30', dot: 'bg-orange-400', priority: 1 },
  UNKNOWN:  { label: 'Unknown',  pill: 'bg-amber-500/15 text-amber-300 border-amber-500/30',  dot: 'bg-amber-400',   priority: 2 },
  OK:       { label: 'OK',       pill: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', dot: 'bg-emerald-400', priority: 3 },
  DISABLED: { label: 'Disabled', pill: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',     dot: 'bg-zinc-500',    priority: 4 },
};

const SOURCE_CHIP: Record<string, string> = {
  'n8n':         'bg-blue-500/15 text-blue-300 border-blue-500/30',
  'launchd':     'bg-purple-500/15 text-purple-300 border-purple-500/30',
  'claude-code': 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
};

/* ── One job row ── */
const JobRow: React.FC<{ job: ScheduledJob }> = ({ job }) => {
  const [open, setOpen] = useState(false);
  const meta = STATUS_META[job.status];
  const hasError = !!job.lastErrorMessage;

  return (
    <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/40">
      <button
        onClick={() => hasError && setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${meta.dot} ${job.status === 'OVERDUE' || job.status === 'ERRORING' ? 'animate-pulse' : ''}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-zinc-100 truncate">{job.label}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${SOURCE_CHIP[job.source] || SOURCE_CHIP['n8n']}`}>{job.source}</span>
          </div>
          {job.description && <p className="text-xs text-zinc-500 truncate">{job.description}</p>}
        </div>
        <div className="hidden sm:block text-xs text-zinc-500 shrink-0 w-32 truncate">{job.scheduleHuman || '—'}</div>
        <div className="text-xs text-zinc-400 shrink-0 w-20 text-right tabular-nums">
          {job.lastRunAt ? timeAgo(job.lastRunAt) : 'never'}
        </div>
        <span className={`text-[11px] px-2 py-0.5 rounded-full border shrink-0 ${meta.pill}`}>{meta.label}</span>
        {hasError ? (open ? <ChevronDown className="w-4 h-4 text-zinc-600 shrink-0" /> : <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" />) : <span className="w-4 shrink-0" />}
      </button>
      {open && hasError && (
        <div className="px-3 pb-3 pt-0">
          <pre className="text-[11px] text-red-300/90 bg-red-950/20 border border-red-900/30 rounded p-2 whitespace-pre-wrap break-words">{job.lastErrorMessage}</pre>
        </div>
      )}
    </div>
  );
};

/* ── Summary strip stat ── */
const Stat: React.FC<{ icon: React.ReactNode; n: number; label: string; alarm?: boolean }> = ({ icon, n, label, alarm }) => (
  <div className="flex items-center gap-1.5">
    {icon}
    <span className={`text-sm font-bold tabular-nums ${alarm && n > 0 ? 'text-red-400' : 'text-zinc-200'}`}>{n}</span>
    <span className="text-[10px] text-zinc-500 hidden sm:inline">{label}</span>
  </div>
);

const ScheduledOpsPanel: React.FC = () => {
  const { jobs, stats, loading, refresh } = useScheduledOps();
  const { lastRefreshed } = useAutoRefresh(refresh, { realtimeTables: ['scheduled_job_registry'] });

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ScheduledStatus | 'ALL'>('ALL');
  const [groupBy, setGroupBy] = useState<'category' | 'source'>('category');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((j) => {
      if (statusFilter !== 'ALL' && j.status !== statusFilter) return false;
      if (q && !(`${j.label} ${j.description ?? ''} ${j.scheduleHuman ?? ''}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [jobs, search, statusFilter]);

  const groups = useMemo(() => {
    const m = new Map<string, ScheduledJob[]>();
    for (const j of filtered) {
      const key = groupBy === 'category' ? (j.category || 'Meta') : j.source;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(j);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => STATUS_META[a.status].priority - STATUS_META[b.status].priority || a.label.localeCompare(b.label));
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, groupBy]);

  if (loading) return <LoadingSkeleton cards={4} rows={8} />;

  const filterChips: (ScheduledStatus | 'ALL')[] = ['ALL', 'OVERDUE', 'ERRORING', 'UNKNOWN', 'OK', 'DISABLED'];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Scheduled Ops</h1>
        <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
      </div>

      <AnimateIn>
        <div className="flex items-center gap-3 sm:gap-5 px-4 py-3 rounded-xl border border-zinc-800/50 bg-zinc-900/40 flex-wrap">
          <Stat icon={<Timer className="w-3.5 h-3.5 text-blue-400" />} n={stats.total} label="jobs" />
          <Stat icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />} n={stats.ok} label="ok" />
          <Stat icon={<XCircle className="w-3.5 h-3.5 text-red-400" />} n={stats.overdue} label="overdue" alarm />
          <Stat icon={<AlertTriangle className="w-3.5 h-3.5 text-orange-400" />} n={stats.erroring} label="erroring" alarm />
          <Stat icon={<HelpCircle className="w-3.5 h-3.5 text-amber-400" />} n={stats.unknown} label="unknown" />
          <Stat icon={<PauseCircle className="w-3.5 h-3.5 text-zinc-500" />} n={stats.disabled} label="disabled" />
        </div>
      </AnimateIn>

      <div className="flex items-center gap-2 flex-wrap">
        <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search scheduled jobs..." />
        <button
          onClick={() => setGroupBy((g) => (g === 'category' ? 'source' : 'category'))}
          className="text-xs px-2.5 py-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-200"
        >
          Group: {groupBy}
        </button>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {filterChips.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`text-[11px] px-2 py-1 rounded-full border ${statusFilter === s ? 'bg-zinc-100 text-zinc-900 border-zinc-100' : 'border-zinc-800 text-zinc-400 hover:text-zinc-200'}`}
          >
            {s === 'ALL' ? 'All' : STATUS_META[s].label}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-zinc-500 px-1">No scheduled jobs match.</p>
      ) : (
        groups.map(([groupName, arr]) => (
          <AnimateIn key={groupName}>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 px-1">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{groupName}</h2>
                <span className="text-[10px] text-zinc-600">{arr.length}</span>
              </div>
              <div className="space-y-1.5">
                {arr.map((j) => <JobRow key={j.jobKey} job={j} />)}
              </div>
            </div>
          </AnimateIn>
        ))
      )}
    </div>
  );
};

export default ScheduledOpsPanel;
