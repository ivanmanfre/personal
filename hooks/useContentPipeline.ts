import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { dashboardAction, toastError, toastSuccess } from '../lib/dashboardActions';
import type { ScheduledPost } from '../types/dashboard';

function mapPost(row: any): ScheduledPost {
  return {
    id: row.id,
    clickupTaskId: row.clickup_task_id,
    postText: row.post_text || '',
    postFormat: row.post_format,
    mediaUrls: row.media_urls || [],
    scheduledAt: row.scheduled_at,
    status: row.status || 'pending',
    errorMessage: row.error_message,
    createdAt: row.created_at,
    postedAt: row.posted_at,
  };
}

export function useContentPipeline(timezone?: string) {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);

  const fetch = useCallback(async () => {
    if (!hasLoadedRef.current) setLoading(true);
    try {
      const { data } = await supabase
        .from('scheduled_posts')
        .select('*')
        .order('scheduled_at', { ascending: true });
      setPosts((data || []).map(mapPost));
      hasLoadedRef.current = true;
    } catch (err) {
      toastError('load scheduled posts', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const statusCounts = useMemo(() =>
    posts.reduce((acc: Record<string, number>, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, {}),
    [posts]
  );

  // Group posts by date for calendar view
  const postsByDate = useMemo(() =>
    posts.reduce((acc: Record<string, ScheduledPost[]>, p) => {
      let dateKey: string;
      if (timezone) {
        const date = new Date(p.scheduledAt);
        const formatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
        const parts = formatter.formatToParts(date);
        const year = parts.find(pt => pt.type === 'year')?.value;
        const month = parts.find(pt => pt.type === 'month')?.value;
        const day = parts.find(pt => pt.type === 'day')?.value;
        dateKey = `${year}-${month}-${day}`;
      } else {
        dateKey = new Date(p.scheduledAt).toISOString().split('T')[0];
      }
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(p);
      return acc;
    }, {}),
    [posts, timezone]
  );

  const updatePost = useCallback(async (id: string, field: string, value: string) => {
    try {
      await dashboardAction('scheduled_posts', id, field, value);
      toastSuccess(`Updated ${field.replace(/_/g, ' ')}`);
      await fetch();
    } catch (err) {
      toastError(`update ${field.replace(/_/g, ' ')}`, err);
    }
  }, [fetch]);

  const deletePost = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.rpc('delete_scheduled_post', { p_id: id });
      if (error) throw error;
      toastSuccess('Post deleted');
      await fetch();
    } catch (err) {
      toastError('delete post', err);
    }
  }, [fetch]);

  return {
    posts,
    statusCounts,
    postsByDate,
    loading,
    refresh: fetch,
    updatePost,
    deletePost,
  };
}
