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
    parentTaskId: row.parent_task_id,
    isRecurring: row.is_recurring ?? false,
  };
}

export function useContentPipeline() {
  const [tasks, setTasks] = useState<PipelineTask[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('dashboard_tasks')
        .select('*')
        .eq('source', 'leadshark')
        .order('due_date', { ascending: true, nullsFirst: false });
      setTasks((data || []).map(mapTask));
    } catch (err) {
      console.error('Failed to fetch content pipeline:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const statusCounts = tasks.reduce((acc: Record<string, number>, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {});

  const listCounts = tasks.reduce((acc: Record<string, number>, t) => {
    const list = t.listName || 'Other';
    acc[list] = (acc[list] || 0) + 1;
    return acc;
  }, {});

  // Group tasks by date for calendar view
  const tasksByDate = tasks.reduce((acc: Record<string, PipelineTask[]>, t) => {
    if (t.dueDate) {
      const dateKey = new Date(t.dueDate).toISOString().split('T')[0];
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(t);
    }
    return acc;
  }, {});

  const unscheduled = tasks.filter((t) => !t.dueDate);

  return {
    tasks,
    statusCounts,
    listCounts,
    tasksByDate,
    unscheduled,
    loading,
    refresh: fetch,
  };
}
