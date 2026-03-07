import React from 'react';
import { CheckSquare, AlertTriangle, Clock, Repeat, CheckCircle2 } from 'lucide-react';
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
};

function timeUntil(dateStr: string): { text: string; overdue: boolean } {
  const diff = new Date(dateStr).getTime() - Date.now();
  const absDiff = Math.abs(diff);
  const overdue = diff < 0;

  if (absDiff < 3600000) return { text: `${Math.floor(absDiff / 60000)}m`, overdue };
  if (absDiff < 86400000) return { text: `${Math.floor(absDiff / 3600000)}h`, overdue };
  return { text: `${Math.floor(absDiff / 86400000)}d`, overdue };
}

const TasksPanel: React.FC = () => {
  const { tasks, overdueTasks, loading, refresh } = useTasksPipeline('reminder');
  const { lastRefreshed } = useAutoRefresh(refresh, { realtimeTables: ['dashboard_tasks'] });

  const completeTask = async (id: string) => {
    await supabase.rpc('dashboard_action', { p_table: 'dashboard_tasks', p_id: id, p_field: 'status', p_value: 'completed' });
    refresh();
  };

  if (loading) return <LoadingSkeleton cards={3} rows={6} />;

  const activeTasks = tasks.filter((t) => t.status !== 'completed');
  const upcoming = activeTasks.filter((t) => t.dueDate && new Date(t.dueDate).getTime() > Date.now());

  if (tasks.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
          <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
        </div>
        <EmptyState title="No personal tasks" description="Personal reminders from n8nClaw will appear here once synced." icon={<CheckSquare className="w-10 h-10" />} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
        <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard label="Active" value={activeTasks.length} icon={<CheckSquare className="w-5 h-5" />} color="text-blue-400" />
        <StatCard label="Overdue" value={overdueTasks.length} icon={<AlertTriangle className="w-5 h-5" />} color={overdueTasks.length > 0 ? 'text-red-400' : 'text-zinc-500'} />
        <StatCard label="Upcoming" value={upcoming.length} icon={<Clock className="w-5 h-5" />} color="text-emerald-400" />
      </div>

      <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left">
                <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">Task</th>
                <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">Due</th>
                <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide hidden md:table-cell">Recurrence</th>
                <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {activeTasks.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-zinc-500 text-center">All tasks completed</td></tr>
              ) : (
                activeTasks.map((task) => {
                  const due = task.dueDate ? timeUntil(task.dueDate) : null;
                  return (
                    <tr key={task.id} className="hover:bg-zinc-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-zinc-200 truncate max-w-sm">{task.title}</p>
                        {task.description && <p className="text-xs text-zinc-500 truncate max-w-sm mt-0.5">{task.description}</p>}
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
                        {task.metadata?.recurrence ? (
                          <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                            <Repeat className="w-3 h-3" />{task.metadata.recurrence}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-600">&mdash;</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => completeTask(task.id)} className="p-1 rounded text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors" title="Complete">
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
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
