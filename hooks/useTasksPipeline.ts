import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { dashboardAction, toastError, toastSuccess } from '../lib/dashboardActions';
import type { PipelineTask } from '../types/dashboard';

function mapTask(row: any): PipelineTask {
  return {
    id: row.id,
    source: row.source,
    sourceId: row.source_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date,
    listName: row.list_name,
    metadata: row.metadata || {},
    updatedAt: row.updated_at,
    parentTaskId: row.parent_task_id,
    isRecurring: row.is_recurring ?? false,
  };
}

function groupWithSubtasks(tasks: PipelineTask[]): PipelineTask[] {
  const parentMap = new Map<string, PipelineTask>();
  const subtasks: PipelineTask[] = [];

  for (const t of tasks) {
    if (t.parentTaskId) {
      subtasks.push(t);
    } else {
      parentMap.set(t.id, { ...t, subtasks: [] });
    }
  }

  for (const sub of subtasks) {
    const parent = parentMap.get(sub.parentTaskId!);
    if (parent) {
      parent.subtasks!.push(sub);
    }
  }

  return Array.from(parentMap.values());
}

export function useTasksPipeline(sourceFilter?: string) {
  const [allTasks, setAllTasks] = useState<PipelineTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState<Set<string>>(new Set());
  const startMutating = (id: string) => setMutating((s) => new Set(s).add(id));
  const stopMutating = (id: string) => setMutating((s) => { const n = new Set(s); n.delete(id); return n; });

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('dashboard_tasks')
        .select('*')
        .order('due_date', { ascending: true, nullsFirst: false });
      setAllTasks((data || []).map(mapTask));
    } catch (err) {
      toastError('load tasks', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const tasks = useMemo(() =>
    sourceFilter && sourceFilter !== 'all'
      ? allTasks.filter((t) => t.source === sourceFilter)
      : allTasks,
    [allTasks, sourceFilter]
  );

  const parentTasks = useMemo(() => groupWithSubtasks(tasks), [tasks]);

  const tasksByStatus = useMemo(() =>
    allTasks.reduce((acc: Record<string, number>, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, {}),
    [allTasks]
  );

  const tasksBySource = useMemo(() =>
    allTasks.reduce((acc: Record<string, number>, t) => {
      acc[t.source] = (acc[t.source] || 0) + 1;
      return acc;
    }, {}),
    [allTasks]
  );

  const overdueTasks = useMemo(() => {
    const now = new Date();
    return allTasks.filter(
      (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'completed' && t.status !== 'ready'
    );
  }, [allTasks]);

  const inProgress = useMemo(() =>
    allTasks.filter(
      (t) => t.status === 'generating' || t.status === 'review'
    ).length,
    [allTasks]
  );

  const updateTask = useCallback(async (id: string, field: string, value: string) => {
    startMutating(id);
    try {
      await dashboardAction('dashboard_tasks', id, field, value);
      await fetchTasks();
    } catch (err) {
      toastError('update task', err);
    } finally {
      stopMutating(id);
    }
  }, [fetchTasks]);

  const createTask = useCallback(async (title: string, description?: string, parentTaskId?: string) => {
    startMutating('_create');
    try {
      const { error } = await supabase.rpc('dashboard_create_task', {
        p_title: title,
        p_description: description || null,
        p_parent_task_id: parentTaskId || null,
      });
      if (error) throw error;
      await fetchTasks();
      toastSuccess('Task created');
    } catch (error) {
      toastError('create task', error);
    } finally {
      stopMutating('_create');
    }
  }, [fetchTasks]);

  const deleteTask = useCallback(async (id: string) => {
    startMutating(id);
    try {
      await dashboardAction('dashboard_tasks', id, 'status', 'cancelled');
      await fetchTasks();
      toastSuccess('Task deleted');
    } catch (err) {
      toastError('delete task', err);
    } finally {
      stopMutating(id);
    }
  }, [fetchTasks]);

  return {
    tasks,
    allTasks,
    parentTasks,
    tasksByStatus,
    tasksBySource,
    overdueTasks,
    inProgress,
    loading,
    mutating,
    refresh: fetchTasks,
    updateTask,
    createTask,
    deleteTask,
  };
}
