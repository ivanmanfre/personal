import React, { useState } from 'react';
import { CheckSquare, ListTodo, AlertTriangle, Clock, ExternalLink, Repeat } from 'lucide-react';
import { useTasksPipeline } from '../../hooks/useTasksPipeline';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import StatCard from './shared/StatCard';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import EmptyState from './shared/EmptyState';

const statusColors: Record<string, string> = {
  open: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  generating: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  review: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  ready: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  approved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  scheduled: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  pending: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  completed: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

const priorityColors: Record<string, string> = {
  urgent: 'text-red-400',
  high: 'text-orange-400',
  normal: 'text-zinc-400',
  low: 'text-zinc-600',
};

function timeUntil(dateStr: string): { text: string; overdue: boolean } {
  const diff = new Date(dateStr).getTime() - Date.now();
  const absDiff = Math.abs(diff);
  const overdue = diff < 0;

  if (absDiff < 3600000) return { text: `${Math.floor(absDiff / 60000)}m`, overdue };
  if (absDiff < 86400000) return { text: `${Math.floor(absDiff / 3600000)}h`, overdue };
  return { text: `${Math.floor(absDiff / 86400000)}d`, overdue };
}

type Filter = 'all' | 'clickup' | 'reminder';

const TasksPanel: React.FC = () => {
  const [filter, setFilter] = useState<Filter>('all');
  const { tasks, allTasks, tasksByStatus, tasksBySource, overdueTasks, inProgress, loading, refresh } = useTasksPipeline(filter);
  const { lastRefreshed } = useAutoRefresh(refresh, { realtimeTables: ['dashboard_tasks'] });

  if (loading) return <LoadingSkeleton cards={4} rows={6} />;

  if (allTasks.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
          <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
        </div>
        <EmptyState title="No tasks yet" description="Tasks will appear here once Dashboard Data Sync runs. Content pipeline tasks from ClickUp and personal reminders will be synced automatically." icon={<CheckSquare className="w-10 h-10" />} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
        <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Tasks" value={allTasks.length} icon={<CheckSquare className="w-5 h-5" />} color="text-blue-400" />
        <StatCard label="In Progress" value={inProgress} icon={<ListTodo className="w-5 h-5" />} color="text-violet-400" subValue={`${tasksByStatus['open'] || 0} open`} />
        <StatCard label="Overdue" value={overdueTasks.length} icon={<AlertTriangle className="w-5 h-5" />} color={overdueTasks.length > 0 ? 'text-red-400' : 'text-zinc-500'} />
        <StatCard label="Personal" value={tasksBySource['reminder'] || 0} icon={<Clock className="w-5 h-5" />} color="text-orange-400" subValue={`${tasksBySource['clickup'] || 0} content`} />
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === 'all' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}>
          All ({allTasks.length})
        </button>
        <button onClick={() => setFilter('clickup')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === 'clickup' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}>
          Content Pipeline ({tasksBySource['clickup'] || 0})
        </button>
        <button onClick={() => setFilter('reminder')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === 'reminder' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}>
          Personal ({tasksBySource['reminder'] || 0})
        </button>
      </div>

      {/* Tasks table */}
      <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left">
                <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">Task</th>
                <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">Source</th>
                <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide hidden md:table-cell">Priority</th>
                <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">Due</th>
                <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {tasks.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-zinc-500 text-center">No tasks match filter</td></tr>
              ) : (
                tasks.map((task) => {
                  const due = task.dueDate ? timeUntil(task.dueDate) : null;
                  return (
                    <tr key={task.id} className="hover:bg-zinc-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-zinc-200 truncate max-w-xs">{task.title}</p>
                        {task.description && <p className="text-xs text-zinc-500 truncate max-w-xs mt-0.5">{task.description}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded border ${task.source === 'clickup' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'}`}>
                          {task.listName || task.source}
                        </span>
                        {task.source === 'reminder' && task.metadata?.recurrence && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] text-zinc-500">
                            <Repeat className="w-2.5 h-2.5" />{task.metadata.recurrence}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${statusColors[task.status] || statusColors.open}`}>
                          {task.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {task.priority ? (
                          <span className={`text-xs font-medium capitalize ${priorityColors[task.priority] || 'text-zinc-400'}`}>
                            {task.priority}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {due ? (
                          <span className={`text-xs font-medium ${due.overdue ? 'text-red-400' : 'text-zinc-400'}`}>
                            {due.overdue ? `${due.text} ago` : `in ${due.text}`}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {task.source === 'clickup' && task.metadata?.url && (
                          <a href={task.metadata.url} target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-emerald-400">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TasksPanel;
