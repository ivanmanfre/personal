import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { dashboardAction, toastError, toastSuccess } from '../lib/dashboardActions';
import type { VideoIdea } from '../types/dashboard';

const N8N_BASE = 'https://n8n.ivanmanfredi.com';

function mapIdea(row: any): VideoIdea {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    script: row.script,
    videoType: row.video_type || 'carousel_animation',
    sourcePostId: row.source_post_id,
    sourceClickupTaskId: row.source_clickup_task_id,
    status: row.status || 'idea',
    priority: row.priority,
    platform: row.platform || 'linkedin',
    durationSeconds: row.duration_seconds,
    tags: row.tags,
    videoUrl: row.video_url,
    audioUrl: row.audio_url,
    thumbnailUrl: row.thumbnail_url,
    renderStatus: row.render_status,
    renderError: row.render_error,
    carouselFolderId: row.carousel_folder_id,
    recordingPath: row.recording_path,
    recordingDurationSeconds: row.recording_duration_seconds,
    transcriptText: row.transcript_text,
    transcriptWords: row.transcript_words,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function useVideoIdeas() {
  const [ideas, setIdeas] = useState<VideoIdea[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('video_ideas')
        .select('*')
        .order('created_at', { ascending: false });
      setIdeas((data || []).map(mapIdea));
    } catch (err) {
      toastError('load video ideas', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const statusCounts = useMemo(() =>
    ideas.reduce((acc: Record<string, number>, idea) => {
      acc[idea.status] = (acc[idea.status] || 0) + 1;
      return acc;
    }, {}),
    [ideas]
  );

  const updateIdea = useCallback(async (id: string, field: string, value: string) => {
    try {
      await dashboardAction('video_ideas', id, field, value);
      toastSuccess(`Updated ${field.replace(/_/g, ' ')}`);
      await fetch();
    } catch (err) {
      toastError(`update ${field.replace(/_/g, ' ')}`, err);
    }
  }, [fetch]);

  const createIdea = useCallback(async (title: string, videoType: string, platform: string) => {
    try {
      const { error } = await supabase.from('video_ideas').insert({
        title,
        video_type: videoType,
        platform,
        status: 'idea',
      });
      if (error) throw error;
      toastSuccess('Video idea created');
      await fetch();
    } catch (err) {
      toastError('create video idea', err);
    }
  }, [fetch]);

  const deleteIdea = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('video_ideas').delete().eq('id', id);
      if (error) throw error;
      toastSuccess('Video idea deleted');
      await fetch();
    } catch (err) {
      toastError('delete video idea', err);
    }
  }, [fetch]);

  const generateScript = useCallback(async (id: string) => {
    try {
      // Optimistic update
      setIdeas(prev => prev.map(i => i.id === id ? { ...i, renderStatus: 'generating_script' } : i));
      const resp = await window.fetch(`${N8N_BASE}/webhook/video-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoIdeaId: id }),
      });
      if (!resp.ok) throw new Error(`Webhook failed: ${resp.status}`);
      toastSuccess('Script generation started');
      // Poll for completion
      setTimeout(() => fetch(), 3000);
      setTimeout(() => fetch(), 8000);
      setTimeout(() => fetch(), 15000);
    } catch (err) {
      toastError('generate script', err);
      await fetch();
    }
  }, [fetch]);

  const generateVideo = useCallback(async (id: string) => {
    try {
      setIdeas(prev => prev.map(i => i.id === id ? { ...i, renderStatus: 'generating_audio' } : i));
      const resp = await window.fetch(`${N8N_BASE}/webhook/video-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoIdeaId: id }),
      });
      if (!resp.ok) throw new Error(`Webhook failed: ${resp.status}`);
      toastSuccess('Video generation started');
      // Poll for completion (video takes longer)
      setTimeout(() => fetch(), 5000);
      setTimeout(() => fetch(), 15000);
      setTimeout(() => fetch(), 30000);
      setTimeout(() => fetch(), 60000);
      setTimeout(() => fetch(), 90000);
    } catch (err) {
      toastError('generate video', err);
      await fetch();
    }
  }, [fetch]);

  const uploadRecording = useCallback(async (ideaId: string, file: File) => {
    try {
      const ext = file.name.split('.').pop() || 'webm';
      const path = `video-recordings/${ideaId}/raw.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('originals')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { error } = await supabase
        .from('video_ideas')
        .update({ recording_path: path, status: 'recording', render_status: 'processing' })
        .eq('id', ideaId);
      if (error) throw error;

      await window.fetch(`${N8N_BASE}/webhook/video-process-recording`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoIdeaId: ideaId }),
      });

      toastSuccess('Recording uploaded, processing started');
      await fetch();
    } catch (err) {
      toastError('upload recording', err);
    }
  }, [fetch]);

  return {
    ideas,
    statusCounts,
    loading,
    refresh: fetch,
    updateIdea,
    createIdea,
    deleteIdea,
    generateScript,
    generateVideo,
    uploadRecording,
  };
}
