import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { toastError } from '../lib/dashboardActions';
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

export function useContentPipeline() {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('scheduled_posts')
        .select('*')
        .order('scheduled_at', { ascending: true });
      setPosts((data || []).map(mapPost));
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
      const dateKey = new Date(p.scheduledAt).toISOString().split('T')[0];
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(p);
      return acc;
    }, {}),
    [posts]
  );

  return {
    posts,
    statusCounts,
    postsByDate,
    loading,
    refresh: fetch,
  };
}
