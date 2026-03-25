import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { dashboardAction, toastError, toastSuccess } from '../lib/dashboardActions';
import type { Recording, RecordingStats } from '../types/dashboard';

function mapRecording(row: any): Recording {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    originalPath: row.original_path,
    processedPath: row.processed_path,
    thumbnailPath: row.thumbnail_path,
    audioPath: row.audio_path,
    durationSeconds: row.duration_seconds ? Number(row.duration_seconds) : null,
    fileSizeBytes: row.file_size_bytes ? Number(row.file_size_bytes) : null,
    resolution: row.resolution,
    hasWebcam: row.has_webcam,
    hasAudio: row.has_audio,
    status: row.status,
    processingError: row.processing_error,
    shareToken: row.share_token,
    shareExpiresAt: row.share_expires_at,
    isPublic: row.is_public,
    viewCount: row.view_count,
    expiresAt: row.expires_at,
    keepTranscript: row.keep_transcript,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const defaultStats: RecordingStats = {
  total: 0, uploading: 0, processing: 0, ready: 0, shared: 0,
  totalViews: 0, totalComments: 0, expiringSoon: 0, totalSizeBytes: 0,
};

export function useRecordings(statusFilter?: string) {
  const [allRecordings, setAllRecordings] = useState<Recording[]>([]);
  const [stats, setStats] = useState<RecordingStats>(defaultStats);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState<Set<string>>(new Set());
  const startMutating = (id: string) => setMutating((s) => new Set(s).add(id));
  const stopMutating = (id: string) => setMutating((s) => { const n = new Set(s); n.delete(id); return n; });

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data }, { data: statsData }] = await Promise.all([
        supabase.from('recordings').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.rpc('recording_stats'),
      ]);
      setAllRecordings((data || []).map(mapRecording));
      if (statsData) {
        setStats({
          total: statsData.total ?? 0,
          uploading: statsData.uploading ?? 0,
          processing: statsData.processing ?? 0,
          ready: statsData.ready ?? 0,
          shared: statsData.shared ?? 0,
          totalViews: statsData.total_views ?? 0,
          totalComments: statsData.total_comments ?? 0,
          expiringSoon: statsData.expiring_soon ?? 0,
          totalSizeBytes: statsData.total_size_bytes ?? 0,
        });
      }
    } catch (err) {
      toastError('load recordings', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const recordings = useMemo(() =>
    statusFilter && statusFilter !== 'all'
      ? allRecordings.filter((r) => r.status === statusFilter)
      : allRecordings,
    [allRecordings, statusFilter]
  );

  const updateTitle = useCallback(async (id: string, title: string) => {
    const prev = allRecordings.find((r) => r.id === id);
    startMutating(id);
    setAllRecordings((p) => p.map((r) => (r.id === id ? { ...r, title } : r)));
    try {
      await dashboardAction('recordings', id, 'title', title);
    } catch (err) {
      toastError('update title', err);
      if (prev) setAllRecordings((p) => p.map((r) => (r.id === id ? { ...r, title: prev.title } : r)));
    } finally {
      stopMutating(id);
    }
  }, [allRecordings]);

  const updateDescription = useCallback(async (id: string, description: string) => {
    startMutating(id);
    setAllRecordings((p) => p.map((r) => (r.id === id ? { ...r, description } : r)));
    try {
      await dashboardAction('recordings', id, 'description', description);
    } catch (err) {
      toastError('update description', err);
      await fetch();
    } finally {
      stopMutating(id);
    }
  }, []);

  const togglePublic = useCallback(async (id: string) => {
    const rec = allRecordings.find((r) => r.id === id);
    if (!rec) return;
    const newVal = !rec.isPublic;
    startMutating(id);
    setAllRecordings((p) => p.map((r) => (r.id === id ? { ...r, isPublic: newVal } : r)));
    try {
      await dashboardAction('recordings', id, 'is_public', String(newVal));
    } catch (err) {
      toastError('toggle public', err);
      setAllRecordings((p) => p.map((r) => (r.id === id ? { ...r, isPublic: rec.isPublic } : r)));
    } finally {
      stopMutating(id);
    }
  }, [allRecordings]);

  const createShare = useCallback(async (id: string, expiresInDays = 90): Promise<string | null> => {
    startMutating(id);
    try {
      const { data, error } = await supabase.rpc('recording_create_share', {
        p_recording_id: id,
        p_expires_in_days: expiresInDays,
      });
      if (error) throw error;
      await fetch();
      const token = data?.token;
      if (token) {
        const url = `${window.location.origin}/v/${token}`;
        await navigator.clipboard.writeText(url);
        toastSuccess('Share link copied!');
        return url;
      }
      return null;
    } catch (err) {
      toastError('create share link', err);
      return null;
    } finally {
      stopMutating(id);
    }
  }, []);

  const deleteRecording = useCallback(async (id: string) => {
    const rec = allRecordings.find((r) => r.id === id);
    if (!rec) return;
    startMutating(id);
    setAllRecordings((p) => p.filter((r) => r.id !== id));
    try {
      // Delete storage files
      const paths = [rec.originalPath, rec.processedPath, rec.thumbnailPath, rec.audioPath].filter(Boolean) as string[];
      if (paths.length) await supabase.storage.from('recordings').remove(paths);
      // Delete row (cascade handles segments, transcripts, comments)
      const { error } = await supabase.from('recordings').delete().eq('id', id);
      if (error) throw error;
      toastSuccess('Recording deleted');
      await fetch();
    } catch (err) {
      toastError('delete recording', err);
      if (rec) setAllRecordings((p) => [...p, rec].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    } finally {
      stopMutating(id);
    }
  }, [allRecordings]);

  const uploadRecording = useCallback(async (file: File, title: string): Promise<Recording | null> => {
    try {
      // Create recording row first
      const id = crypto.randomUUID();
      const ext = file.name.split('.').pop() || 'webm';
      const storagePath = `originals/${id}/recording.${ext}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('recordings')
        .upload(storagePath, file, { cacheControl: '3600', upsert: false, contentType: file.type.split(';')[0] });
      if (uploadError) throw uploadError;

      // Insert metadata
      const { data, error } = await supabase.from('recordings').insert({
        id,
        title,
        original_path: storagePath,
        status: 'uploaded',
        file_size_bytes: file.size,
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      }).select().single();
      if (error) throw error;

      toastSuccess('Recording uploaded');
      await fetch();
      return data ? mapRecording(data) : null;
    } catch (err) {
      toastError('upload recording', err);
      return null;
    }
  }, []);

  const extendExpiry = useCallback(async (id: string, extraDays = 90) => {
    startMutating(id);
    try {
      const { data, error } = await supabase.rpc('recording_extend_expiry', {
        p_recording_id: id,
        p_extra_days: extraDays,
      });
      if (error) throw error;
      toastSuccess(`Extended by ${extraDays} days`);
      await fetch();
    } catch (err) {
      toastError('extend expiry', err);
    } finally {
      stopMutating(id);
    }
  }, []);

  const archiveRecording = useCallback(async (id: string) => {
    startMutating(id);
    try {
      const { data, error } = await supabase.rpc('recording_archive', {
        p_recording_id: id,
      });
      if (error) throw error;
      // Delete storage files returned by the RPC
      const paths = (data as any)?.storage_paths_to_delete;
      if (paths?.length) {
        await supabase.storage.from('recordings').remove(paths);
      }
      toastSuccess('Recording archived (transcript kept)');
      await fetch();
    } catch (err) {
      toastError('archive recording', err);
    } finally {
      stopMutating(id);
    }
  }, []);

  return {
    recordings, stats, loading, mutating, refresh: fetch,
    updateTitle, updateDescription, togglePublic, createShare, deleteRecording, uploadRecording,
    extendExpiry, archiveRecording,
  };
}
