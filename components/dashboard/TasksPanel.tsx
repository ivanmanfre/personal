import React, { useState } from 'react';
import { CheckSquare, Repeat, CheckCircle2, Bot, Bell, Zap } from 'lucide-react';
import { useTasksPipeline } from '../../hooks/useTasksPipeline';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { supabase } from '../../lib/supabase';
import { timeAgo } from './shared/utils';
import StatCard from './shared/StatCard';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import EmptyState from './shared/EmptyState';

const statusColors: Record<string, string> = {
  pending: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'in progress': 'bg-violet-500/20 text-violet-400 border-violet-500/30',
};

type SourceTab = 'agent' | 'reminder' | 'all';

const TasksPanel: React.FC = () => {
  const [sourceTab, setSourceTab] = useState<SourceTab>('agent');
  const { allTasks: rawAll, tasksBySource, loading, refresh } = useTasksPipeline();
  const { lastRefreshed } = useAutoRefresh(refresh, { realtimeTables: ['dashboard_tasks'] });
  const [showCompleted, setShowCompleted] = useState(false);

  const completeTask = async (id: string) => {
    await supabase.rpc('dashboard_action', { p_table: 'dashboard_tasks', p_id: id, p_field: 'status', p_value: 'completed' });
    refresh();
  };

  if (loading) return <LoadingSkeleton cards={3} rows={6} />;

  const agentCount = tasksBySource['agent'] || 0;
  const reminderCount = tasksBySource['reminder'] || 0;

  // Filter by source tab (only agent + reminder, exclude clickup/leadshark)
  const filtered = sourceTab === 'all'
    ? rawAll.filter((t) => t.source === 'agent' || t.source === 'reminder')
    : rawAll.filter((t) => t.source === sourceTab);

  const pendingTasks = filtered.filter((t) => t.status !== 'completed');
  const completedTasks = filtered.filter((t) => t.status === 'completed');
  const displayTasks = showCompleted ? filtered : pendingTasks;

  const agentPending = rawAll.filter((t) => t.source === 'agent' && t.status !== 'completed').length;
  const reminderPending = rawAll.filter((t) => t.source === 'reminder' && t.status !== 'completed').length;

  if (agentCount === 0 && reminderCount === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
          <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
        </div>
        <EmptyState title="No tasks" description="n8nClaw agent tasks and reminders will appear here once synced." icon={<CheckSquare className="w-10 h-10" />} />
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
        <StatCard label="Agent Tasks" value={agentPending} icon={<Bot className="w-5 h-5" />} color="text-cyan-400" subValue={`${agentCount} total`} />
        <StatCard label="Reminders" value={reminderPending} icon={<Bell className="w-5 h-5" />} color="text-orange-400" subValue={`${reminderCount} total`} />
        <StatCard label="Completed" value={completedTasks.length} icon={<CheckCircle2 className="w-5 h-5" />} color="text-emerald-400" />
      </div>

      {/* Source tabs */}
      <div className="flex items-center justify-between border-b border-zinc-800/60">
        <div className="flex">
          {([
            { key: 'agent' as SourceTab, label: 'Agent Tasks', count: agentCount },
            { key: 'reminder' as SourceTab, label: 'Reminders', count: reminderCount },
            { key: 'all' as SourceTab, label: 'All', count: agentCount + reminderCount },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSourceTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${sourceTab === tab.key ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowCompleted(!showCompleted)}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${showCompleted ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          {showCompleted ? 'Hide completed' : 'Show completed'}
        </button>
      </div>

      <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left">
                <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">Task</th>
                <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide hidden md:table-cell">Created</th>
                <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide hidden md:table-cell">Source</th>
                <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {displayTasks.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-zinc-500 text-center">No {showCompleted ? '' : 'active '}tasks</td></tr>
              ) : (
                displayTasks.map((task) => {
                  const isAgent = task.source === 'agent';
                  const isCompleted = task.status === 'completed';
                  return (
                    <tr key={task.id} className={`hover:bg-zinc-800/50 transition-colors ${isCompleted ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isAgent ? (
                            <Bot className="w-3.5 h-3.5 text-cyan-400/60 shrink-0" />
                          ) : (
                            <Bell className="w-3.5 h-3.5 text-orange-400/60 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className={`font-medium truncate max-w-md ${isCompleted ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>{task.title}</p>
                            {task.description && <p className="text-xs text-zinc-500 truncate max-w-md mt-0.5">{task.description}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${statusColors[task.status] || statusColors.pending}`}>
                          {task.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs text-zinc-500">{timeAgo(task.updatedAt)}</span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {isAgent ? (
                          <span className="inline-flex items-center gap-1 text-xs text-cyan-400/60">
                            <Zap className="w-3 h-3" />n8nClaw
                          </span>
                        ) : task.metadata?.recurrence ? (
                          <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                            <Repeat className="w-3 h-3" />{task.metadata.recurrence}
                          </span>
                        ) : (
                          <span className="text-xs text-orange-400/50">Reminder</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {!isCompleted && (
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
