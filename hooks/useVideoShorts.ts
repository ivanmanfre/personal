import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { toastError, toastSuccess } from '../lib/dashboardActions';
import type { VideoShort } from '../types/dashboard';

const N8N_BASE = 'https://n8n.intelligents.agency';

function mapShort(row: any): VideoShort {
  return {
    id: row.id,
    videoIdeaId: row.video_idea_id,
    title: row.title,
    startTime: Number(row.start_time),
    endTime: Number(row.end_time),
    durationSeconds: Number(row.duration_seconds),
    format: row.format || 'short',
    transcriptText: row.transcript_text,
    status: row.status || 'pending',
    renderError: row.render_error,
    videoUrl: row.video_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function useVideoShorts(ideaId: string | null) {
  const [shorts, setShorts] = useState<VideoShort[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!ideaId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('video_shorts')
        .select('*')
        .eq('video_idea_id', ideaId)
        .order('start_time', { ascending: true });
      setShorts((data || []).map(mapShort));
    } catch (err) {
      toastError('load shorts', err);
    } finally {
      setLoading(false);
    }
  }, [ideaId]);

  useEffect(() => { fetch(); }, [fetch]);

  const updateShort = useCallback(async (id: string, field: string, value: any) => {
    try {
      const { error } = await supabase
        .from('video_shorts')
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      await fetch();
    } catch (err) {
      toastError(`update short ${field}`, err);
    }
  }, [fetch]);

  const approveShort = useCallback(async (id: string) => {
    await updateShort(id, 'status', 'approved');
    toastSuccess('Short approved');
  }, [updateShort]);

  const rejectShort = useCallback(async (id: string) => {
    await updateShort(id, 'status', 'rejected');
  }, [updateShort]);

  const deleteShort = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('video_shorts').delete().eq('id', id);
      if (error) throw error;
      await fetch();
    } catch (err) {
      toastError('delete short', err);
    }
  }, [fetch]);

  const renderShort = useCallback(async (id: string) => {
    try {
      await updateShort(id, 'status', 'rendering');
      const resp = await window.fetch(`${N8N_BASE}/webhook/video-render-short`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shortId: id }),
      });
      if (!resp.ok) throw new Error(`Webhook failed: ${resp.status}`);
      toastSuccess('Rendering started');
      setTimeout(() => fetch(), 5000);
      setTimeout(() => fetch(), 15000);
      setTimeout(() => fetch(), 30000);
      setTimeout(() => fetch(), 60000);
    } catch (err) {
      toastError('render short', err);
      await fetch();
    }
  }, [fetch, updateShort]);

  const renderAllApproved = useCallback(async () => {
    const approved = shorts.filter(s => s.status === 'approved');
    for (const s of approved) {
      await renderShort(s.id);
    }
  }, [shorts, renderShort]);

  return {
    shorts, loading, refresh: fetch,
    updateShort, approveShort, rejectShort, deleteShort,
    renderShort, renderAllApproved,
  };
}
