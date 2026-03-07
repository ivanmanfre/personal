import React, { useState } from 'react';
import { Calendar, FileText, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { useContentPipeline } from '../../hooks/useContentPipeline';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import StatCard from './shared/StatCard';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import EmptyState from './shared/EmptyState';

const statusColors: Record<string, string> = {
  open: 'bg-blue-500 border-blue-600',
  generating: 'bg-violet-500 border-violet-600',
  review: 'bg-amber-500 border-amber-600',
  ready: 'bg-emerald-500 border-emerald-600',
  approved: 'bg-emerald-500 border-emerald-600',
  scheduled: 'bg-cyan-500 border-cyan-600',
};

const statusBadgeColors: Record<string, string> = {
  open: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  generating: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  review: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  ready: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  approved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  scheduled: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  // Adjust to start on Monday (0=Mon, 6=Sun)
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const days: { date: Date; inMonth: boolean }[] = [];

  // Previous month padding
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: d, inMonth: false });
  }

  // Current month
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push({ date: new Date(year, month, i), inMonth: true });
  }

  // Next month padding (fill to 42 = 6 rows)
  while (days.length < 42) {
    const d = new Date(year, month + 1, days.length - startOffset - lastDay.getDate() + 1);
    days.push({ date: d, inMonth: false });
  }

  return days;
}

const ContentPanel: React.FC = () => {
  const { tasks, statusCounts, listCounts, tasksByDate, unscheduled, loading, refresh } = useContentPipeline();
  const { lastRefreshed } = useAutoRefresh(refresh, { realtimeTables: ['dashboard_tasks'] });
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filter, setFilter] = useState<string>('all');

  if (loading) return <LoadingSkeleton cards={4} rows={8} />;

  if (tasks.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Content</h1>
          <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
        </div>
        <EmptyState title="No content tasks" description="Content pipeline tasks from ClickUp will appear here once Dashboard Data Sync runs." icon={<Calendar className="w-10 h-10" />} />
      </div>
    );
  }

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthDays = getMonthDays(year, month);
  const today = new Date().toISOString().split('T')[0];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  const filteredUnscheduled = filter === 'all'
    ? unscheduled
    : unscheduled.filter((t) => t.status === filter);

  const inProgress = (statusCounts['generating'] || 0) + (statusCounts['review'] || 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Content</h1>
        <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total" value={tasks.length} icon={<FileText className="w-5 h-5" />} color="text-blue-400" />
        <StatCard label="In Progress" value={inProgress} icon={<FileText className="w-5 h-5" />} color="text-violet-400" subValue={`${statusCounts['open'] || 0} open`} />
        <StatCard label="Ready" value={(statusCounts['ready'] || 0) + (statusCounts['approved'] || 0)} icon={<FileText className="w-5 h-5" />} color="text-emerald-400" />
        <StatCard label="Unscheduled" value={unscheduled.length} icon={<Calendar className="w-5 h-5" />} color={unscheduled.length > 0 ? 'text-orange-400' : 'text-zinc-500'} />
      </div>

      {/* Calendar */}
      <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-zinc-500" />
            <h2 className="text-sm font-semibold text-zinc-300">
              {currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={goToday} className="px-2 py-1 rounded text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">Today</button>
            <button onClick={prevMonth} className="p-1 rounded text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={nextMonth} className="p-1 rounded text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="p-3">
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-[11px] text-zinc-600 font-medium py-1">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-px bg-zinc-800/30 rounded-lg overflow-hidden">
            {monthDays.map(({ date, inMonth }, i) => {
              const dateKey = date.toISOString().split('T')[0];
              const dayTasks = tasksByDate[dateKey] || [];
              const isToday = dateKey === today;

              return (
                <div
                  key={i}
                  className={`min-h-[80px] p-1.5 transition-colors ${
                    inMonth ? 'bg-zinc-900/60' : 'bg-zinc-950/40'
                  } ${isToday ? 'ring-1 ring-emerald-500/40 ring-inset' : ''}`}
                >
                  <div className={`text-[11px] font-medium mb-1 ${
                    isToday ? 'text-emerald-400' : inMonth ? 'text-zinc-400' : 'text-zinc-700'
                  }`}>
                    {date.getDate()}
                  </div>
                  <div className="space-y-0.5">
                    {dayTasks.slice(0, 3).map((t) => (
                      <div
                        key={t.id}
                        className={`px-1 py-0.5 rounded text-[10px] truncate border-l-2 bg-zinc-800/60 text-zinc-300 ${
                          statusColors[t.status] || 'border-zinc-600'
                        }`}
                        title={`${t.title} (${t.status})`}
                      >
                        {t.title.length > 20 ? t.title.slice(0, 20) + '...' : t.title}
                      </div>
                    ))}
                    {dayTasks.length > 3 && (
                      <div className="text-[10px] text-zinc-600 px-1">+{dayTasks.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Status legend */}
      <div className="flex flex-wrap items-center gap-3">
        {Object.entries(statusCounts).map(([status, count]) => (
          <button
            key={status}
            onClick={() => setFilter(filter === status ? 'all' : status)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              filter === status ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
            }`}
          >
            <div className={`w-2 h-2 rounded-sm ${statusColors[status]?.split(' ')[0] || 'bg-zinc-600'}`} />
            {status} ({count})
          </button>
        ))}
      </div>

      {/* Unscheduled / Backlog */}
      {filteredUnscheduled.length > 0 && (
        <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800/60 flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-zinc-500" />
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              {filter === 'all' ? 'Unscheduled' : `${filter} (unscheduled)`} ({filteredUnscheduled.length})
            </h2>
          </div>
          <div className="divide-y divide-zinc-800/50">
            {filteredUnscheduled.map((task) => (
              <div key={task.id} className="px-4 py-3 flex items-center gap-3 hover:bg-zinc-800/20 transition-colors">
                <div className={`w-2 h-2 rounded-full shrink-0 ${statusColors[task.status]?.split(' ')[0] || 'bg-zinc-600'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-300 truncate">{task.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${statusBadgeColors[task.status] || 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'}`}>
                      {task.status}
                    </span>
                    {task.listName && (
                      <span className="text-[11px] text-zinc-600">{task.listName}</span>
                    )}
                  </div>
                </div>
                {task.metadata?.url && (
                  <a href={task.metadata.url} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-emerald-400 transition-colors shrink-0">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* List by pipeline */}
      {Object.keys(listCounts).length > 1 && (
        <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
          {Object.entries(listCounts).map(([list, count]) => (
            <span key={list} className="px-2 py-1 bg-zinc-900/60 border border-zinc-800/60 rounded-lg">
              {list}: {count}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default ContentPanel;
