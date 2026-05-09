import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckSquare, Repeat, CheckCircle2, Bot, Bell, Zap, ChevronRight, ChevronDown, Plus, Pencil, X, Trash2, Eye, EyeOff } from 'lucide-react';
import { useTasksPipeline } from '../../hooks/useTasksPipeline';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { timeAgo } from './shared/utils';
import StatCard from './shared/StatCard';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import EmptyState from './shared/EmptyState';
import FilterBar from './shared/FilterBar';
import type { PipelineTask } from '../../types/dashboard';

const statusConfig: Record<string, { color: string; bg: string; border: string; dot: string }> = {
  pending: { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', dot: 'bg-orange-400' },
  open: { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', dot: 'bg-orange-400' },
  completed: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', dot: 'bg-emerald-400' },
  cancelled: { color: 'text-zinc-500', bg: 'bg-zinc-500/10', border: 'border-zinc-600/20', dot: 'bg-zinc-500' },
  'in progress': { color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20', dot: 'bg-violet-400' },
};

const defaultStatus = { color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-600/20', dot: 'bg-zinc-400' };

type SourceTab = 'agent' | 'reminder' | 'all';

interface EditingState {
  id: string;
  field: string;
  value: string;
}

const cardVariants = {
  initial: { opacity: 0, y: 12, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, scale: 0.96, transition: { duration: 0.15 } },
};

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
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('due_date');

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

  // NOTE: do NOT early-return before useMemo calls below — that triggers
  // React error #310 ("rendered more hooks than during the previous render")
  // on the loading→loaded transition. Hook calls must be unconditional.
  const agentCount = tasksBySource['agent'] || 0;
  const reminderCount = tasksBySource['reminder'] || 0;

  const filtered = sourceTab === 'all'
    ? parentTasks.filter((t) => t.source === 'agent' || t.source === 'reminder')
    : parentTasks.filter((t) => t.source === sourceTab);

  const searchFiltered = useMemo(() => {
    if (!search.trim()) return filtered;
    const q = search.toLowerCase();
    return filtered.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q))
    );
  }, [filtered, search]);

  const sortedFiltered = useMemo(() => {
    const priorityOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
    return [...searchFiltered].sort((a, b) => {
      if (sortBy === 'due_date') {
        const aDate = a.dueDate ?? '';
        const bDate = b.dueDate ?? '';
        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;
        return aDate.localeCompare(bDate);
      }
      if (sortBy === 'updated_at') {
        return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '');
      }
      if (sortBy === 'priority') {
        const aP = priorityOrder[(a.priority ?? 'normal').toLowerCase()] ?? 2;
        const bP = priorityOrder[(b.priority ?? 'normal').toLowerCase()] ?? 2;
        return aP - bP;
      }
      return 0;
    });
  }, [searchFiltered, sortBy]);

  const pendingTasks = sortedFiltered.filter((t) => t.status !== 'completed' && t.status !== 'cancelled');
  const completedTasks = sortedFiltered.filter((t) => t.status === 'completed');
  const displayTasks = showCompleted ? sortedFiltered.filter((t) => t.status !== 'cancelled') : pendingTasks;

  const agentPending = rawAll.filter((t) => t.source === 'agent' && t.status !== 'completed' && !t.parentTaskId).length;
  const reminderPending = rawAll.filter((t) => t.source === 'reminder' && t.status !== 'completed').length;

  // Safe to early-return now — all hooks above are unconditional.
  if (loading) return <LoadingSkeleton cards={3} rows={6} />;

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

  const renderCard = (task: PipelineTask, isSubtask = false) => {
    const isAgent = task.source === 'agent';
    const isCompleted = task.status === 'completed';
    const hasSubtasks = !isSubtask && (task.subtasks?.length || 0) > 0;
    const isExpanded = expandedTasks.has(task.id);
    const sc = statusConfig[task.status] || defaultStatus;

    return (
      <motion.div
        key={task.id}
        layout
        variants={cardVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        role="listitem"
        className={`group ${isSubtask ? 'ml-6' : ''}`}
      >
        <div className={`bg-zinc-900/80 border rounded-xl overflow-hidden transition-colors ${isCompleted ? 'border-zinc-800/30 opacity-60' : 'border-zinc-800/50 hover:border-zinc-700/60'}`}>
          {/* Card body */}
          <div className="p-3">
            <div className="flex items-start gap-3">
              {/* Status dot + complete button */}
              <div className="flex flex-col items-center gap-1 pt-0.5">
                {!isCompleted ? (
                  <button
                    onClick={() => handleComplete(task.id)}
                    className={`w-5 h-5 rounded-full border-2 ${sc.border} ${sc.bg} hover:${sc.dot} transition-all flex items-center justify-center group/check focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:outline-none`}
                    title="Complete"
                    aria-label={`Complete task: ${task.title}`}
                  >
                    <CheckCircle2 className={`w-3 h-3 ${sc.color} opacity-0 group-hover/check:opacity-100 transition-opacity`} />
                  </button>
                ) : (
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 border-2 border-emerald-500/30 flex items-center justify-center">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {/* Source icon */}
                  {isAgent ? (
                    <Bot className="w-3.5 h-3.5 text-cyan-400/60 shrink-0" />
                  ) : (
                    <Bell className="w-3.5 h-3.5 text-orange-400/60 shrink-0" />
                  )}

                  {/* Title */}
                  {editing?.id === task.id && editing.field === 'title' ? (
                    <div className="flex items-center gap-1.5 flex-1">
                      <input
                        autoFocus
                        value={editing.value}
                        onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(null); }}
                        className="bg-zinc-800 border border-zinc-600 rounded-lg px-2.5 py-1 text-sm text-zinc-200 w-full focus:outline-none focus:border-cyan-500/50"
                      />
                      <button onClick={saveEdit} className="text-emerald-400 hover:text-emerald-300 text-xs font-medium">Save</button>
                      <button onClick={() => setEditing(null)} className="text-zinc-500 hover:text-zinc-300"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <p
                      onClick={() => isAgent && handleEdit(task.id, 'title', task.title)}
                      className={`text-sm font-medium truncate ${isCompleted ? 'text-zinc-500 line-through' : 'text-zinc-200'} ${isAgent ? 'cursor-pointer hover:text-cyan-300 transition-colors' : ''}`}
                    >
                      {task.title}
                    </p>
                  )}

                  {task.isRecurring && <Repeat className="w-3 h-3 text-zinc-600 shrink-0" />}
                </div>

                {/* Description */}
                {task.description && editing?.id !== task.id && (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleDesc(task.id); }}
                    className="text-left mt-1 group/desc block"
                  >
                    <p className={`text-xs text-zinc-500 leading-relaxed ${expandedDescs.has(task.id) ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}>
                      {task.description}
                    </p>
                    {task.description.length > 80 && (
                      <span className="text-[10px] text-zinc-500 group-hover/desc:text-zinc-400 transition-colors">
                        {expandedDescs.has(task.id) ? 'Show less' : 'Show more'}
                      </span>
                    )}
                  </button>
                )}

                {/* Meta row */}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${sc.bg} ${sc.color} ${sc.border}`}>
                    {task.status}
                  </span>

                  {isAgent ? (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-cyan-400/50">
                      <Zap className="w-2.5 h-2.5" />n8nClaw
                    </span>
                  ) : task.metadata?.recurrence ? (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-zinc-500">
                      <Repeat className="w-2.5 h-2.5" />{task.metadata.recurrence}
                    </span>
                  ) : (
                    <span className="text-[10px] text-orange-400/40">Reminder</span>
                  )}

                  <span className="text-[10px] text-zinc-500">{timeAgo(task.updatedAt)}</span>

                  {hasSubtasks && (
                    <span className="text-[10px] text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded">
                      {task.subtasks!.filter((s) => s.status === 'completed').length}/{task.subtasks!.length} subtasks
                    </span>
                  )}
                </div>
              </div>

              {/* Actions - always visible on mobile, hover-reveal on desktop */}
              <div className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                {isAgent && !isCompleted && (
                  <button onClick={() => handleEdit(task.id, 'title', task.title)} className="p-2 sm:p-1.5 rounded-lg text-zinc-500 sm:text-zinc-600 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500/50 focus-visible:outline-none" title="Edit" aria-label={`Edit task: ${task.title}`}>
                    <Pencil className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                  </button>
                )}
                {isAgent && (
                  <button onClick={() => handleDelete(task.id)} className="p-2 sm:p-1.5 rounded-lg text-zinc-500 sm:text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors focus-visible:ring-2 focus-visible:ring-red-500/50 focus-visible:outline-none" title="Delete" aria-label={`Delete task: ${task.title}`}>
                    <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                  </button>
                )}
                {hasSubtasks && (
                  <button onClick={() => toggleExpanded(task.id)} className="p-2 sm:p-1.5 rounded-lg text-zinc-500 sm:text-zinc-600 hover:text-zinc-300 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-500/50 focus-visible:outline-none" title="Toggle subtasks" aria-label={`${isExpanded ? 'Collapse' : 'Expand'} subtasks for: ${task.title}`}>
                    {isExpanded ? <ChevronDown className="w-4 h-4 sm:w-3.5 sm:h-3.5" /> : <ChevronRight className="w-4 h-4 sm:w-3.5 sm:h-3.5" />}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Subtasks (expanded) */}
          <AnimatePresence>
            {hasSubtasks && isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="overflow-hidden border-t border-zinc-800/30"
              >
                <div className="p-2 space-y-1.5">
                  {task.subtasks!.map((sub) => {
                    const subSc = statusConfig[sub.status] || defaultStatus;
                    const subCompleted = sub.status === 'completed';
                    return (
                      <div key={sub.id} className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg ${subCompleted ? 'opacity-50' : 'hover:bg-zinc-800/30'} transition-colors`}>
                        {!subCompleted ? (
                          <button
                            onClick={() => handleComplete(sub.id)}
                            className={`w-4 h-4 rounded-full border ${subSc.border} ${subSc.bg} hover:bg-emerald-500/20 transition-all shrink-0`}
                          />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400/50 shrink-0" />
                        )}
                        <p className={`text-xs flex-1 ${subCompleted ? 'text-zinc-600 line-through' : 'text-zinc-300'}`}>{sub.title}</p>
                        <span className={`px-1 py-0.5 rounded text-[9px] font-medium ${subSc.bg} ${subSc.color} border ${subSc.border}`}>{sub.status}</span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard label="Agent Tasks" value={agentPending} icon={<Bot className="w-5 h-5" />} color={agentPending > 0 ? 'text-amber-400' : 'text-zinc-300'} subValue={`${agentCount} total`} />
        <StatCard label="Reminders" value={reminderPending} icon={<Bell className="w-5 h-5" />} color={reminderPending > 0 ? 'text-amber-400' : 'text-zinc-300'} subValue={`${reminderCount} total`} />
        <StatCard label="Completed" value={completedTasks.length} icon={<CheckCircle2 className="w-5 h-5" />} color="text-emerald-400" />
      </div>

      {creating && <CreateForm newTitle={newTitle} setNewTitle={setNewTitle} newDesc={newDesc} setNewDesc={setNewDesc} onCreate={handleCreate} onCancel={() => { setCreating(false); setNewTitle(''); setNewDesc(''); }} />}

      {/* Source tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center bg-zinc-800/50 rounded-lg p-0.5 border border-zinc-700/30">
          {([
            { key: 'agent' as SourceTab, label: 'Agent', icon: <Bot className="w-3.5 h-3.5" />, count: agentCount },
            { key: 'reminder' as SourceTab, label: 'Reminders', icon: <Bell className="w-3.5 h-3.5" />, count: reminderCount },
            { key: 'all' as SourceTab, label: 'All', icon: null, count: agentCount + reminderCount },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSourceTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-md text-xs font-medium transition-colors ${sourceTab === tab.key ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              {tab.icon}
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowCompleted(!showCompleted)}
          className={`flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg text-xs font-medium transition-colors ${showCompleted ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}
        >
          {showCompleted ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {showCompleted ? 'Hide completed' : 'Show completed'}
        </button>
      </div>

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search tasks..."
        sortOptions={[
          { label: 'Due date', value: 'due_date' },
          { label: 'Updated', value: 'updated_at' },
          { label: 'Priority', value: 'priority' },
        ]}
        sortValue={sortBy}
        onSortChange={setSortBy}
      />

      {/* Task cards */}
      <div className="space-y-2" role="list" aria-label="Task list">
        <AnimatePresence mode="popLayout">
          {displayTasks.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-12 text-center"
            >
              <p className="text-sm text-zinc-500">No {showCompleted ? '' : 'active '}tasks</p>
            </motion.div>
          ) : (
            displayTasks.map((task) => renderCard(task))
          )}
        </AnimatePresence>
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
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className="bg-zinc-900/80 border border-cyan-500/30 rounded-xl p-4 space-y-3"
    >
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
        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-cyan-500/50 focus:outline-none"
      />
      <input
        placeholder="Description (optional)"
        value={newDesc}
        onChange={(e) => setNewDesc(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onCreate(); if (e.key === 'Escape') onCancel(); }}
        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-cyan-500/50 focus:outline-none"
      />
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors">Cancel</button>
        <button onClick={onCreate} disabled={!newTitle.trim()} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Create</button>
      </div>
    </motion.div>
  );
}

export default TasksPanel;
