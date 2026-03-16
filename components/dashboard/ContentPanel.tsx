import React, { useState } from 'react';
import { Calendar, FileText, ChevronLeft, ChevronRight, Image, FileType } from 'lucide-react';
import { useContentPipeline } from '../../hooks/useContentPipeline';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import StatCard from './shared/StatCard';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import EmptyState from './shared/EmptyState';
import PanelCard from './shared/PanelCard';

const statusColors: Record<string, string> = {
  pending: 'bg-amber-500 border-amber-600',
  published: 'bg-emerald-500 border-emerald-600',
  failed: 'bg-red-500 border-red-600',
  scheduled: 'bg-cyan-500 border-cyan-600',
};

const statusBadgeColors: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  published: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  failed: 'bg-red-500/20 text-red-300 border-red-500/30',
  scheduled: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const days: { date: Date; inMonth: boolean }[] = [];

  for (let i = startOffset - 1; i >= 0; i--) {
    days.push({ date: new Date(year, month, -i), inMonth: false });
  }

  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push({ date: new Date(year, month, i), inMonth: true });
  }

  while (days.length < 42) {
    const d = new Date(year, month + 1, days.length - startOffset - lastDay.getDate() + 1);
    days.push({ date: d, inMonth: false });
  }

  return days;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
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
        <EmptyState title="No scheduled posts" description="Scheduled posts from LeadShark will appear here once Dashboard Data Sync runs." icon={<Calendar className="w-10 h-10" />} />
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

  const scheduled = tasks.filter((t) => t.dueDate);
  const pending = tasks.filter((t) => t.status === 'pending');

  const filteredList = filter === 'all'
    ? tasks
    : tasks.filter((t) => t.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Content</h1>
        <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Posts" value={tasks.length} icon={<FileText className="w-5 h-5" />} color="text-blue-400" />
        <StatCard label="Pending" value={pending.length} icon={<Calendar className="w-5 h-5" />} color="text-amber-400" />
        <StatCard label="Published" value={statusCounts['published'] || 0} icon={<FileText className="w-5 h-5" />} color="text-emerald-400" />
        <StatCard label="Scheduled" value={scheduled.length} icon={<Calendar className="w-5 h-5" />} color="text-cyan-400" />
      </div>

      {/* Calendar */}
      <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl overflow-hidden shadow-sm shadow-black/10">
        <div className="px-4 py-3.5 border-b border-zinc-800/40 bg-zinc-800/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-3.5 h-3.5 text-zinc-500" />
            <h2 className="text-sm font-semibold text-zinc-300">
              {currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={goToday} className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-zinc-700/60 transition-colors">Today</button>
            <button onClick={prevMonth} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-700/60 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={nextMonth} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-700/60 transition-colors"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="p-3">
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-[11px] text-zinc-600 font-medium py-1">{d}</div>
            ))}
          </div>

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
                        title={`${t.description || t.title} (${t.listName || t.status})${t.dueDate ? ' @ ' + formatTime(t.dueDate) : ''}`}
                      >
                        {t.listName ? `${t.listName}` : t.title}
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

      {/* Status filters */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setFilter('all')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filter === 'all' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
          }`}
        >
          All ({tasks.length})
        </button>
        {Object.entries(statusCounts).map(([status, count]) => (
          <button
            key={status}
            onClick={() => setFilter(filter === status ? 'all' : status)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === status ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <div className={`w-2 h-2 rounded-sm ${statusColors[status]?.split(' ')[0] || 'bg-zinc-600'}`} />
            {status} ({count})
          </button>
        ))}
      </div>

      {/* Posts list */}
      <PanelCard title={filter === 'all' ? 'All Posts' : filter} icon={<FileText className="w-3.5 h-3.5" />} badge={filteredList.length}>
        <div className="divide-y divide-zinc-800/40">
          {filteredList.length === 0 ? (
            <div className="px-4 py-8 text-zinc-600 text-sm text-center">No posts match filter</div>
          ) : (
            filteredList.map((task) => (
              <div key={task.id} className="px-4 py-3 flex items-start gap-3 hover:bg-zinc-800/30 transition-colors">
                <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${statusColors[task.status]?.split(' ')[0] || 'bg-zinc-600'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-300 line-clamp-2">{task.description || task.title}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${statusBadgeColors[task.status] || 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'}`}>
                      {task.status}
                    </span>
                    {task.dueDate && (
                      <span className="text-[11px] text-zinc-500">
                        {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at {formatTime(task.dueDate)}
                      </span>
                    )}
                    {task.listName && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
                        {task.metadata?.attachment_type === 'pdf' ? <FileType className="w-3 h-3" /> : task.metadata?.has_attachment ? <Image className="w-3 h-3" /> : null}
                        {task.listName}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </PanelCard>

      {/* Format breakdown */}
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
