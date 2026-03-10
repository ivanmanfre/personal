import React, { useState } from 'react';
import { CheckSquare, AlertTriangle, Clock, Repeat, CheckCircle2, ListTodo, Bell, ExternalLink } from 'lucide-react';
import { useTasksPipeline } from '../../hooks/useTasksPipeline';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { supabase } from '../../lib/supabase';
import StatCard from './shared/StatCard';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import EmptyState from './shared/EmptyState';

const statusColors: Record<string, string> = {
  pending: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  completed: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  published: 'bg-green-500/20 text-green-400 border-green-500/30',
  scheduled: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'to do': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'in progress': 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  review: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  ready: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  generating: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
};

function timeUntil(dateStr: string): { text: string; overdue: boolean } {
  const diff = new Date(dateStr).getTime() - Date.now();
  const absDiff = Math.abs(diff);
  const overdue = diff < 0;

  if (absDiff < 3600000) return { text: `${Math.floor(absDiff / 60000)}m`, overdue };
  if (absDiff < 86400000) return { text: `${Math.floor(absDiff / 3600000)}h`, overdue };
  return { text: `${Math.floor(absDiff / 86400000)}d`, overdue };
}

type SourceTab = 'all' | 'clickup' | 'reminder';

const TasksPanel: React.FC = () => {
  const [sourceTab, setSourceTab] = useState<SourceTab>('all');
  const { tasks: allTasks, allTasks: rawAll, tasksBySource, overdueTasks, inProgress, loading, refresh } = useTasksPipeline(sourceTab === 'all' ? undefined : sourceTab);
  const { lastRefreshed } = useAutoRefresh(refresh, { realtimeTables: ['dashboard_tasks'] });

  const completeTask = async (id: string) => {
    await supabase.rpc('dashboard_action', { p_table: 'dashboard_tasks', p_id: id, p_field: 'status', p_value: 'completed' });
    refresh();
  };

  if (loading) return <LoadingSkeleton cards={3} rows={6} />;

  const activeTasks = allTasks.filter((t) => t.status !== 'completed' && t.status !== 'ready');
  const clickupCount = tasksBySource['clickup'] || 0;
  const reminderCount = tasksBySource['reminder'] || 0;

  if (rawAll.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
          <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
        </div>
        <EmptyState title="No tasks" description="ClickUp tasks and n8nClaw reminders will appear here once synced." icon={<CheckSquare className="w-10 h-10" />} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
        <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Active" value={activeTasks.length} icon={<CheckSquare className="w-5 h-5" />} color="text-blue-400" />
        <StatCard label="Overdue" value={overdueTasks.length} icon={<AlertTriangle className="w-5 h-5" />} color={overdueTasks.length > 0 ? 'text-red-400' : 'text-zinc-500'} />
        <StatCard label="In Progress" value={inProgress} icon={<Clock className="w-5 h-5" />} color="text-violet-400" />
        <StatCard label="ClickUp Tasks" value={clickupCount} icon={<ListTodo className="w-5 h-5" />} color="text-emerald-400" subValue={`${reminderCount} reminders`} />
      </div>

      {/* Source tabs */}
      <div className="flex border-b border-zinc-800/60">
        {([
          { key: 'all' as SourceTab, label: 'All', count: rawAll.length },
          { key: 'clickup' as SourceTab, label: 'ClickUp Tasks', count: clickupCount },
          { key: 'reminder' as SourceTab, label: 'Reminders', count: reminderCount },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSourceTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${sourceTab === tab.key ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left">
                <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">Task</th>
                <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">Due</th>
                <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide hidden md:table-cell">Source</th>
                <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {activeTasks.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-zinc-500 text-center">No active tasks</td></tr>
              ) : (
                activeTasks.map((task) => {
                  const due = task.dueDate ? timeUntil(task.dueDate) : null;
                  const isClickup = task.source === 'clickup';
                  return (
                    <tr key={task.id} className="hover:bg-zinc-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isClickup ? (
                            <ListTodo className="w-3.5 h-3.5 text-emerald-400/60 shrink-0" />
                          ) : (
                            <Bell className="w-3.5 h-3.5 text-orange-400/60 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-zinc-200 truncate max-w-sm">{task.title}</p>
                            {task.description && <p className="text-xs text-zinc-500 truncate max-w-sm mt-0.5">{task.description}</p>}
                            {task.listName && <p className="text-[10px] text-zinc-600 mt-0.5">{task.listName}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${statusColors[task.status] || statusColors.pending}`}>
                          {task.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {due ? (
                          <span className={`text-xs font-medium ${due.overdue ? 'text-red-400' : 'text-zinc-400'}`}>
                            {due.overdue ? `${due.text} ago` : `in ${due.text}`}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-600">&mdash;</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {isClickup ? (
                          task.metadata?.url ? (
                            <a href={task.metadata.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-emerald-400/70 hover:text-emerald-400 transition-colors">
                              <ExternalLink className="w-3 h-3" /> ClickUp
                            </a>
                          ) : (
                            <span className="text-xs text-emerald-400/50">ClickUp</span>
                          )
                        ) : task.metadata?.recurrence ? (
                          <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                            <Repeat className="w-3 h-3" />{task.metadata.recurrence}
                          </span>
                        ) : (
                          <span className="text-xs text-orange-400/50">Reminder</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {task.status !== 'completed' && task.source === 'reminder' && (
                          <button onClick={() => completeTask(task.id)} className="p-1 rounded text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors" title="Complete">
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
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
