import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
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
  };
}

export function useTasksPipeline(sourceFilter?: string) {
  const [allTasks, setAllTasks] = useState<PipelineTask[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('dashboard_tasks')
      .select('*')
      .order('due_date', { ascending: true, nullsFirst: false });
    setAllTasks((data || []).map(mapTask));
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const tasks = sourceFilter && sourceFilter !== 'all'
    ? allTasks.filter((t) => t.source === sourceFilter)
    : allTasks;

  const tasksByStatus = allTasks.reduce((acc: Record<string, number>, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {});

  const tasksBySource = allTasks.reduce((acc: Record<string, number>, t) => {
    acc[t.source] = (acc[t.source] || 0) + 1;
    return acc;
  }, {});

  const now = new Date();
  const overdueTasks = allTasks.filter(
    (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'completed' && t.status !== 'ready'
  );

  const inProgress = allTasks.filter(
    (t) => t.status === 'generating' || t.status === 'review'
  ).length;

  return {
    tasks,
    allTasks,
    tasksByStatus,
    tasksBySource,
    overdueTasks,
    inProgress,
    loading,
    refresh: fetch,
  };
}
