import React, { useMemo } from 'react';
import { AlarmClock, CalendarClock, Clock, CheckCircle2, ArrowUpRight, Check, Timer } from 'lucide-react';
import { useScheduledChecks, type ScheduledCheck, type CheckState } from '../../hooks/useScheduledChecks';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import AnimateIn from './shared/AnimateIn';

const STATE_META: Record<CheckState, { label: string; chip: string; dot: string; pulse: boolean }> = {
  due:       { label: 'Due now',   chip: 'bg-red-500/15 text-red-300 border-red-500/30',       dot: 'bg-red-400',     pulse: true },
  upcoming:  { label: 'Upcoming',  chip: 'bg-amber-500/15 text-amber-300 border-amber-500/30',  dot: 'bg-amber-400',   pulse: false },
  scheduled: { label: 'Scheduled', chip: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',     dot: 'bg-zinc-500',    pulse: false },
  done:      { label: 'Done',      chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', dot: 'bg-emerald-400', pulse: false },
};

const STATE_ORDER: CheckState[] = ['due', 'upcoming', 'scheduled', 'done'];

const CATEGORY_CHIP: Record<string, string> = {
  review:   'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  audit:    'bg-purple-500/15 text-purple-300 border-purple-500/30',
  decision: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  followup: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
};

function dueLabel(c: ScheduledCheck): string {
  if (c.state === 'done') return 'completed';
  const d = c.daysUntil;
  if (d < 0) return `${Math.abs(d)}d overdue`;
  if (d === 0) return 'due today';
  if (d === 1) return 'due tomorrow';
  return `in ${d} days`;
}

function navigateTo(link: string) {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(link.startsWith('?') ? link.slice(1) : link);
  const url = new URL(window.location.href);
  params.forEach((v, k) => url.searchParams.set(k, v));
  window.history.pushState(null, '', url.toString());
  window.dispatchEvent(new PopStateEvent('popstate'));
}

const CheckCard: React.FC<{
  check: ScheduledCheck;
  onReview: (id: string) => void;
  onSnooze: (id: string) => void;
}> = ({ check, onReview, onSnooze }) => {
  const meta = STATE_META[check.state];
  const isOpen = check.state !== 'done';
  return (
    <div className={`rounded-lg border bg-zinc-900/40 ${check.state === 'due' ? 'border-red-500/30' : 'border-zinc-800/60'}`}>
      <div className="flex items-start gap-3 px-3.5 py-3">
        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${meta.dot} ${meta.pulse ? 'animate-pulse' : ''}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-semibold ${check.state === 'done' ? 'text-zinc-400 line-through' : 'text-zinc-100'}`}>{check.title}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${CATEGORY_CHIP[check.category] || CATEGORY_CHIP.review}`}>{check.category}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${meta.chip}`}>{dueLabel(check)}</span>
          </div>
          {check.detail && isOpen && (
            <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">{check.detail}</p>
          )}
          {isOpen && (
            <div className="flex items-center gap-2 mt-2.5 flex-wrap">
              <button
                onClick={() => onReview(check.id)}
                className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg border border-emerald-600/40 text-emerald-300 hover:bg-emerald-500/10"
              >
                <Check className="w-3 h-3" /> Mark reviewed
              </button>
              <button
                onClick={() => onSnooze(check.id)}
                className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200"
              >
                <Timer className="w-3 h-3" /> Snooze 1wk
              </button>
              {check.link && (
                <button
                  onClick={() => navigateTo(check.link!)}
                  className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200"
                >
                  Open <ArrowUpRight className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>
        <span className="hidden sm:block text-[11px] text-zinc-600 shrink-0 tabular-nums">{check.dueDate}</span>
      </div>
    </div>
  );
};

const Stat: React.FC<{ icon: React.ReactNode; n: number; label: string; alarm?: boolean }> = ({ icon, n, label, alarm }) => (
  <div className="flex items-center gap-1.5">
    {icon}
    <span className={`text-sm font-bold tabular-nums ${alarm && n > 0 ? 'text-red-400' : 'text-zinc-200'}`}>{n}</span>
    <span className="text-[10px] text-zinc-500 hidden sm:inline">{label}</span>
  </div>
);

const ScheduledChecksPanel: React.FC = () => {
  const { checks, stats, loading, refresh, markReviewed, snooze } = useScheduledChecks();
  const { lastRefreshed } = useAutoRefresh(refresh, { realtimeTables: ['scheduled_checks'] });

  const groups = useMemo(() => {
    const m = new Map<CheckState, ScheduledCheck[]>();
    for (const c of checks) {
      if (!m.has(c.state)) m.set(c.state, []);
      m.get(c.state)!.push(c);
    }
    return STATE_ORDER.filter((s) => m.has(s)).map((s) => [s, m.get(s)!] as const);
  }, [checks]);

  if (loading) return <LoadingSkeleton cards={2} rows={4} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Scheduled Checks</h1>
          <p className="text-xs text-zinc-500 mt-1">Time-based review reminders — surfaced here and pinged over WhatsApp when due.</p>
        </div>
        <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
      </div>

      <AnimateIn>
        <div className="flex items-center gap-3 sm:gap-5 px-4 py-3 rounded-xl border border-zinc-800/50 bg-zinc-900/40 flex-wrap">
          <Stat icon={<AlarmClock className="w-3.5 h-3.5 text-red-400" />} n={stats.due} label="due" alarm />
          <Stat icon={<CalendarClock className="w-3.5 h-3.5 text-amber-400" />} n={stats.upcoming} label="upcoming" />
          <Stat icon={<Clock className="w-3.5 h-3.5 text-zinc-400" />} n={stats.scheduled} label="scheduled" />
          <Stat icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />} n={stats.done} label="done" />
        </div>
      </AnimateIn>

      {groups.length === 0 ? (
        <p className="text-sm text-zinc-500 px-1">No scheduled checks yet. Add one via the <code className="text-zinc-400">scheduled_checks</code> table or n8n.</p>
      ) : (
        groups.map(([state, arr]) => (
          <AnimateIn key={state}>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 px-1">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{STATE_META[state].label}</h2>
                <span className="text-[10px] text-zinc-600">{arr.length}</span>
              </div>
              <div className="space-y-1.5">
                {arr.map((c) => (
                  <CheckCard key={c.id} check={c} onReview={markReviewed} onSnooze={snooze} />
                ))}
              </div>
            </div>
          </AnimateIn>
        ))
      )}
    </div>
  );
};

export default ScheduledChecksPanel;
