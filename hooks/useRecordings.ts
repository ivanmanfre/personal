import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { dashboardAction, toastError, toastSuccess } from '../lib/dashboardActions';
import type { Recording, RecordingStats } from '../types/dashboard';

/**
 * Capture a poster frame from a video file using a hidden video + canvas.
 * Seeks to ~25% of duration to skip dark intros. Returns null on any failure
 * - caller should fall back to the gradient placeholder. Times out after 8s
 * so a malformed video can't hang the upload flow.
 */
function capturePosterFrame(file: File, maxSize = 720): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined' || !file.type.startsWith('video/')) {
      resolve(null);
      return;
    }

    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';

    let settled = false;
    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      video.load();
    };
    const finish = (blob: Blob | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(blob);
    };
    const timeout = setTimeout(() => finish(null), 8000);

    video.onloadedmetadata = () => {
      const seekTo = Math.min(Math.max(video.duration * 0.25, 1), 30);
      video.currentTime = isFinite(seekTo) ? seekTo : 1;
    };

    video.onseeked = () => {
      try {
        const ratio = video.videoHeight / video.videoWidth;
        const w = Math.min(maxSize, video.videoWidth);
        const h = Math.round(w * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { clearTimeout(timeout); finish(null); return; }
        ctx.drawImage(video, 0, 0, w, h);
        canvas.toBlob((b) => { clearTimeout(timeout); finish(b); }, 'image/jpeg', 0.78);
      } catch {
        clearTimeout(timeout);
        finish(null);
      }
    };

    video.onerror = () => { clearTimeout(timeout); finish(null); };
    video.src = url;
  });
}

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
    transcriptText: row.transcript_text ?? null,
    autoTitle: row.auto_title ?? null,
    autoTitleStatus: row.auto_title_status ?? null,
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

      // Best-effort client-side poster frame capture before inserting metadata
      // so the recording grid never shows blank cards. Failures are silent -
      // the gradient placeholder still renders.
      let thumbnailPath: string | null = null;
      try {
        const blob = await capturePosterFrame(file);
        if (blob) {
          const tPath = `thumbnails/${id}/poster.jpg`;
          const { error: thumbErr } = await supabase.storage
            .from('recordings')
            .upload(tPath, blob, { cacheControl: '3600', upsert: false, contentType: 'image/jpeg' });
          if (!thumbErr) thumbnailPath = tPath;
        }
      } catch {
        /* poster capture is best-effort */
      }

      // Insert metadata - set auto_title_status='pending' if no title was provided
      // so the backfill picker picks it up, or the fire-and-forget trigger below
      // kicks off immediately.
      const autoTitleStatus = title?.trim() ? null : 'pending';
      const { data, error } = await supabase.from('recordings').insert({
        id,
        title,
        original_path: storagePath,
        thumbnail_path: thumbnailPath,
        status: 'uploaded',
        file_size_bytes: file.size,
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        auto_title_status: autoTitleStatus,
      }).select().single();
      if (error) throw error;

      // Fire-and-forget: invoke the auto-title edge function when the upload
      // has no explicit title. Errors are silent; the backfill button can retry.
      if (autoTitleStatus === 'pending') {
        supabase.functions.invoke('recording-auto-title', { body: { recording_id: id } }).catch(() => {});
      }

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

  /**
   * One-click backfill: for each recording missing a thumbnail, download the
   * original from storage, capture a poster frame, upload as the thumbnail.
   * Concurrency limited to 2 to avoid hammering Supabase egress for big videos.
   */
  const backfillThumbnails = useCallback(async (
    onProgress?: (done: number, total: number) => void,
  ): Promise<{ processed: number; failed: number }> => {
    const targets = allRecordings.filter((r) => !r.thumbnailPath && r.originalPath);
    if (targets.length === 0) return { processed: 0, failed: 0 };

    let done = 0;
    let processed = 0;
    let failed = 0;
    const concurrency = 2;
    const queue = [...targets];

    const work = async () => {
      while (queue.length) {
        const rec = queue.shift();
        if (!rec) break;
        try {
          const { data: signed } = await supabase.storage
            .from('recordings')
            .createSignedUrl(rec.originalPath!, 600);
          if (!signed?.signedUrl) throw new Error('signed URL failed');
          const res = await window.fetch(signed.signedUrl);
          const blob = await res.blob();
          // Wrap as File so capturePosterFrame's mime check passes
          const fileBlob = new File([blob], 'src.mp4', { type: blob.type || 'video/mp4' });
          const poster = await capturePosterFrame(fileBlob);
          if (!poster) throw new Error('frame capture returned null');
          const tPath = `thumbnails/${rec.id}/poster.jpg`;
          const { error: upErr } = await supabase.storage
            .from('recordings')
            .upload(tPath, poster, { cacheControl: '3600', upsert: true, contentType: 'image/jpeg' });
          if (upErr) throw upErr;
          const { error: dbErr } = await supabase.from('recordings').update({ thumbnail_path: tPath }).eq('id', rec.id);
          if (dbErr) throw dbErr;
          processed += 1;
        } catch {
          failed += 1;
        } finally {
          done += 1;
          onProgress?.(done, targets.length);
        }
      }
    };

    await Promise.all(Array.from({ length: concurrency }, work));
    await fetch();
    return { processed, failed };
  }, [allRecordings, fetch]);

  const missingThumbnails = useMemo(
    () => allRecordings.filter((r) => !r.thumbnailPath && r.originalPath).length,
    [allRecordings],
  );

  // Candidates for auto-title generation: the original path exists, no
  // auto_title has been written yet, and the row isn't currently in progress.
  // 'failed' status is eligible for retry. A title like "Recording 25/03/2026
  // 19:30" still counts as needing a real title - it's a placeholder from the
  // upload step, not a user-chosen title.
  const PLACEHOLDER_TITLE = /^Recording\s+\d/i;
  const autoTitleCandidates = useMemo(
    () => allRecordings.filter((r) => {
      if (!r.originalPath) return false;
      // Already has a real auto_title (or user-typed title) → skip
      if (r.autoTitle) return false;
      const titleIsPlaceholder = !r.title || PLACEHOLDER_TITLE.test(r.title.trim());
      if (!titleIsPlaceholder) return false;
      // Allow fresh, pending, or previously-failed rows; skip ones in flight
      // and skip 'no_audio' (legitimate case - screen recordings without speech)
      return (
        r.autoTitleStatus === null ||
        r.autoTitleStatus === 'pending' ||
        r.autoTitleStatus === 'failed'
      );
      // Note: 'transcribing', 'titling', 'done', 'no_audio' all fall through to false above
    }),
    [allRecordings],
  );

  /**
   * Invoke the recording-auto-title edge function for each candidate in
   * sequence (Whisper is the bottleneck - no concurrent benefit here).
   * The edge function marks status=done/failed; we refresh afterwards.
   */
  const backfillAutoTitles = useCallback(async (
    onProgress?: (done: number, total: number) => void,
  ): Promise<{ processed: number; failed: number }> => {
    const targets = autoTitleCandidates;
    if (targets.length === 0) return { processed: 0, failed: 0 };
    let processed = 0;
    let failed = 0;
    for (let i = 0; i < targets.length; i++) {
      const rec = targets[i];
      try {
        const { data, error } = await supabase.functions.invoke('recording-auto-title', {
          body: { recording_id: rec.id },
        });
        if (error || (data && (data as any).error)) {
          failed += 1;
        } else {
          processed += 1;
        }
      } catch {
        failed += 1;
      }
      onProgress?.(i + 1, targets.length);
    }
    await fetch();
    return { processed, failed };
  }, [autoTitleCandidates, fetch]);

  return {
    recordings, stats, loading, mutating, refresh: fetch,
    updateTitle, updateDescription, togglePublic, createShare, deleteRecording, uploadRecording,
    extendExpiry, archiveRecording,
    backfillThumbnails, missingThumbnails,
    backfillAutoTitles, autoTitleCandidates,
  };
}
