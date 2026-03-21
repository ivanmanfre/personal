import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { toastError } from '../lib/dashboardActions';
import type { ExecutionLog } from '../types/dashboard';

function mapRow(row: any): ExecutionLog {
  return {
    id: row.id,
    executionId: row.execution_id,
    workflowId: row.workflow_id,
    workflowName: row.workflow_name,
    status: row.status,
    mode: row.mode,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    durationMs: row.duration_ms,
    isFinished: row.is_finished,
    errorMessage: row.error_message,
    errorNode: row.error_node,
    lastNodeExecuted: row.last_node_executed,
    nodesExecuted: row.nodes_executed,
    retryOf: row.retry_of,
    retrySuccessId: row.retry_success_id,
  };
}

export type StatusFilter = 'all' | 'success' | 'error' | 'waiting' | 'canceled';
export type ExecSortKey = 'date' | 'duration';

interface Filters {
  status: StatusFilter;
  workflowId: string;
  search: string;
  dateFrom: string;
  dateTo: string;
  sort: ExecSortKey;
}

const PAGE_SIZE = 50;

export function useExecutionLogs() {
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    status: 'all',
    workflowId: '',
    search: '',
    dateFrom: '',
    dateTo: '',
    sort: 'date',
  });
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('workflow_execution_logs')
        .select('*', { count: 'exact' });

      if (filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters.workflowId) {
        query = query.eq('workflow_id', filters.workflowId);
      }
      if (filters.dateFrom) {
        query = query.gte('started_at', new Date(filters.dateFrom).toISOString());
      }
      if (filters.dateTo) {
        const endDate = new Date(filters.dateTo);
        endDate.setDate(endDate.getDate() + 1);
        query = query.lt('started_at', endDate.toISOString());
      }
      if (filters.search) {
        // Use ilike for flexible search across error_message, workflow_name, error_node
        const term = `%${filters.search}%`;
        query = query.or(`error_message.ilike.${term},workflow_name.ilike.${term},error_node.ilike.${term}`);
      }

      if (filters.sort === 'duration') {
        query = query.order('duration_ms', { ascending: false, nullsFirst: false });
      } else {
        query = query.order('started_at', { ascending: false });
      }

      query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      const { data, count } = await query;
      setLogs((data || []).map(mapRow));
      setTotalCount(count || 0);
    } catch (err) {
      toastError('load execution logs', err);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => { fetch(); }, [fetch]);

  // Reset page when filters change
  const updateFilter = useCallback(<K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(0);
  }, []);

  // Get unique workflow names for filter dropdown
  const workflowNames = useMemo(() => {
    const map = new Map<string, string>();
    logs.forEach((l) => {
      if (l.workflowName && !map.has(l.workflowId)) {
        map.set(l.workflowId, l.workflowName);
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [logs]);

  // Stats
  const stats = useMemo(() => {
    return {
      total: totalCount,
      pages: Math.ceil(totalCount / PAGE_SIZE),
      pageSize: PAGE_SIZE,
    };
  }, [totalCount]);

  return {
    logs,
    loading,
    refresh: fetch,
    filters,
    updateFilter,
    page,
    setPage,
    stats,
    workflowNames,
  };
}
