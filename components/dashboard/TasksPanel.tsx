import React, { useState } from 'react';
import { CheckSquare, Repeat, CheckCircle2, Bot, Bell, Zap, ChevronRight, ChevronDown, Plus, Pencil, X, Trash2, Eye, EyeOff } from 'lucide-react';
import { useTasksPipeline } from '../../hooks/useTasksPipeline';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { timeAgo } from './shared/utils';
import StatCard from './shared/StatCard';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import EmptyState from './shared/EmptyState';
import type { PipelineTask } from '../../types/dashboard';

const statusColors: Record<string, string> = {
  pending: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  open: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  cancelled: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  'in progress': 'bg-violet-500/20 text-violet-400 border-violet-500/30',
};

type SourceTab = 'agent' | 'reminder' | 'all';

interface EditingState {
  id: string;
  field: string;
  value: string;
}

const TasksPanel: React.FC = () => {
  const [sourceTab, setSourceTab] = useState<SourceTab>('agent');
  const { allTasks: rawAll, parentTasks, tasksBySource, loading, refresh, updateTask, createTask, deleteTask } = useTasksPipeline(
    sourceTab === 'all' ? undefined : sourceTab
  );
  const { lastRefreshed } = useAutoRefresh(refresh, { realtimeTables: ['dashboard_tasks'] });
  const [showCompleted, setShowCompleted] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [expandedDescs, setExpandedDescs] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const toggleExpanded = (id: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleDesc = (id: string) => {
    setExpandedDescs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleEdit = (id: string, field: string, currentValue: string) => {
    setEditing({ id, field, value: currentValue });
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      await updateTask(editing.id, editing.field, editing.value);
    } catch {
      console.error('Failed to update task');
    }
    setEditing(null);
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    try {
      await createTask(newTitle.trim(), newDesc.trim() || undefined);
      setNewTitle('');
      setNewDesc('');
      setCreating(false);
    } catch {
      console.error('Failed to create task');
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await updateTask(id, 'status', 'completed');
    } catch {
      console.error('Failed to complete task');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this task?')) return;
    try {
      await deleteTask(id);
    } catch {
      console.error('Failed to delete task');
    }
  };

  if (loading) return <LoadingSkeleton cards={3} rows={6} />;

  const agentCount = tasksBySource['agent'] || 0;
  const reminderCount = tasksBySource['reminder'] || 0;

  // Filter parentTasks for display
  const filtered = sourceTab === 'all'
    ? parentTasks.filter((t) => t.source === 'agent' || t.source === 'reminder')
    : parentTasks.filter((t) => t.source === sourceTab);

  const pendingTasks = filtered.filter((t) => t.status !== 'completed' && t.status !== 'cancelled');
  const completedTasks = filtered.filter((t) => t.status === 'completed');
  const displayTasks = showCompleted ? filtered.filter((t) => t.status !== 'cancelled') : pendingTasks;

  const agentPending = rawAll.filter((t) => t.source === 'agent' && t.status !== 'completed' && !t.parentTaskId).length;
  const reminderPending = rawAll.filter((t) => t.source === 'reminder' && t.status !== 'completed').length;

  if (agentCount === 0 && reminderCount === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => setCreating(true)} className="px-3 py-1.5 text-xs font-medium rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors">
              <Plus className="w-3 h-3 inline mr-1" />New Task
            </button>
            <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
          </div>
        </div>
        {creating && <CreateForm newTitle={newTitle} setNewTitle={setNewTitle} newDesc={newDesc} setNewDesc={setNewDesc} onCreate={handleCreate} onCancel={() => { setCreating(false); setNewTitle(''); setNewDesc(''); }} />}
        <EmptyState title="No tasks" description="n8nClaw agent tasks and reminders will appear here once synced." icon={<CheckSquare className="w-10 h-10" />} />
      </div>
    );
  }

  const renderTask = (task: PipelineTask, isSubtask = false) => {
    const isAgent = task.source === 'agent';
    const isCompleted = task.status === 'completed';
    const hasSubtasks = !isSubtask && (task.subtasks?.length || 0) > 0;
    const isExpanded = expandedTasks.has(task.id);

    return (
      <React.Fragment key={task.id}>
        <tr className={`hover:bg-zinc-800/50 transition-colors ${isCompleted ? 'opacity-50' : ''} ${isSubtask ? 'bg-zinc-900/40' : ''}`}>
          <td className="px-4 py-3">
            <div className="flex items-center gap-2">
              {isSubtask && <div className="w-4 border-l-2 border-b-2 border-zinc-700 h-4 ml-2 rounded-bl" />}
              {hasSubtasks && (
                <button onClick={() => toggleExpanded(task.id)} className="p-0.5 text-zinc-500 hover:text-zinc-300 transition-colors">
                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              )}
              {!hasSubtasks && !isSubtask && <div className="w-4" />}
              {isAgent ? (
                <Bot className="w-3.5 h-3.5 text-cyan-400/60 shrink-0" />
              ) : (
                <Bell className="w-3.5 h-3.5 text-orange-400/60 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                {editing?.id === task.id && editing.field === 'title' ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      value={editing.value}
                      onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(null); }}
                      className="bg-zinc-800 border border-zinc-600 rounded px-2 py-0.5 text-sm text-zinc-200 w-full"
                    />
                    <button onClick={saveEdit} className="text-emerald-400 hover:text-emerald-300 text-xs">Save</button>
                    <button onClick={() => setEditing(null)} className="text-zinc-500 hover:text-zinc-300"><X className="w-3 h-3" /></button>
                  </div>
                ) : (
                  <p
                    onClick={() => isAgent && handleEdit(task.id, 'title', task.title)}
                    title={task.title}
                    className={`font-medium truncate max-w-md ${isCompleted ? 'text-zinc-500 line-through' : 'text-zinc-200'} ${isAgent ? 'cursor-pointer hover:text-cyan-300' : ''}`}
                  >
                    {task.title}
                    {task.isRecurring && <Repeat className="w-3 h-3 inline ml-1.5 text-zinc-500" />}
                  </p>
                )}
                {task.description && editing?.id !== task.id && (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleDesc(task.id); }}
                    className="text-left mt-0.5 group/desc"
                  >
                    <p className={`text-xs text-zinc-500 max-w-md ${expandedDescs.has(task.id) ? 'whitespace-pre-wrap' : 'truncate'}`}>
                      {task.description}
                    </p>
                    {task.description.length > 60 && (
                      <span className="text-[10px] text-zinc-600 group-hover/desc:text-zinc-400 transition-colors">
                        {expandedDescs.has(task.id) ? 'Show less' : 'Show more'}
                      </span>
                    )}
                  </button>
                )}
                {hasSubtasks && (
                  <span className="text-xs text-zinc-600 ml-0.5">
                    {task.subtasks!.filter((s) => s.status === 'completed').length}/{task.subtasks!.length} subtasks done
                  </span>
                )}
                <span className="md:hidden text-[10px] text-zinc-600 mt-0.5 block">{timeAgo(task.updatedAt)}</span>
              </div>
            </div>
          </td>
          <td className="px-4 py-3">
            <span className={`px-2 py-0.5 rounded text-xs font-medium border ${statusColors[task.status] || statusColors.open}`}>
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
            <div className="flex items-center gap-1">
              {!isCompleted && (
                <button onClick={() => handleComplete(task.id)} className="p-1 rounded text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors" title="Complete">
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              )}
              {isAgent && !isCompleted && (
                <button onClick={() => handleEdit(task.id, 'title', task.title)} className="p-1 rounded text-zinc-500 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors" title="Edit">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
              {isAgent && (
                <button onClick={() => handleDelete(task.id)} className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </td>
        </tr>
        {hasSubtasks && isExpanded && task.subtasks!.map((sub) => renderTask(sub, true))}
      </React.Fragment>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setCreating(true)} className="px-3 py-1.5 text-xs font-medium rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors">
            <Plus className="w-3 h-3 inline mr-1" />New Task
          </button>
          <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard label="Agent Tasks" value={agentPending} icon={<Bot className="w-5 h-5" />} color="text-cyan-400" subValue={`${agentCount} total`} />
        <StatCard label="Reminders" value={reminderPending} icon={<Bell className="w-5 h-5" />} color="text-orange-400" subValue={`${reminderCount} total`} />
        <StatCard label="Completed" value={completedTasks.length} icon={<CheckCircle2 className="w-5 h-5" />} color="text-emerald-400" />
      </div>

      {creating && <CreateForm newTitle={newTitle} setNewTitle={setNewTitle} newDesc={newDesc} setNewDesc={setNewDesc} onCreate={handleCreate} onCancel={() => { setCreating(false); setNewTitle(''); setNewDesc(''); }} />}

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
                <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide hidden md:table-cell">Updated</th>
                <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide hidden md:table-cell">Source</th>
                <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {displayTasks.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-zinc-500 text-center">No {showCompleted ? '' : 'active '}tasks</td></tr>
              ) : (
                displayTasks.map((task) => renderTask(task))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

function CreateForm({ newTitle, setNewTitle, newDesc, setNewDesc, onCreate, onCancel }: {
  newTitle: string; setNewTitle: (v: string) => void;
  newDesc: string; setNewDesc: (v: string) => void;
  onCreate: () => void; onCancel: () => void;
}) {
  return (
    <div className="bg-zinc-900/80 border border-cyan-500/30 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-300">New Task</h3>
        <button onClick={onCancel} className="text-zinc-500 hover:text-zinc-300"><X className="w-4 h-4" /></button>
      </div>
      <input
        autoFocus
        placeholder="Task title"
        value={newTitle}
        onChange={(e) => setNewTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onCreate(); if (e.key === 'Escape') onCancel(); }}
        className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-cyan-500/50 focus:outline-none"
      />
      <input
        placeholder="Description (optional)"
        value={newDesc}
        onChange={(e) => setNewDesc(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onCreate(); if (e.key === 'Escape') onCancel(); }}
        className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-cyan-500/50 focus:outline-none"
      />
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors">Cancel</button>
        <button onClick={onCreate} disabled={!newTitle.trim()} className="px-3 py-1.5 text-xs font-medium rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Create</button>
      </div>
    </div>
  );
}

export default TasksPanel;
