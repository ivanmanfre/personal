import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';

// Public viewer uses anon key only
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'https://bjbvqvzbzczjbatgmccb.supabase.co',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

interface ViewerRecording {
  id: string;
  title: string;
  description: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  viewCount: number;
  createdAt: string;
  shareExpiresAt: string | null;
}

interface Comment {
  id: string;
  authorName: string;
  commentText: string;
  timestampSeconds: number | null;
  parentId: string | null;
  createdAt: string;
  replies: Comment[];
}

function formatDuration(secs: number | null): string {
  if (!secs) return '--:--';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatTimecode(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function VideoViewer() {
  const { token } = useParams<{ token: string }>();
  const [recording, setRecording] = useState<ViewerRecording | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [authorName, setAuthorName] = useState(() => localStorage.getItem('viewer_name') || '');
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [addTimestamp, setAddTimestamp] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Fetch recording by share token
  useEffect(() => {
    if (!token) return;
    (async () => {
      setLoading(true);
      try {
        const { data, error: rpcError } = await supabase.rpc('recording_view_by_token', {
          p_token: token,
        });
        if (rpcError) throw rpcError;
        if (!data) throw new Error('Recording not found or link expired');

        const rec = data as any;

        // Get signed URLs
        const videoPath = rec.processed_path || rec.original_path;
        const [videoRes, thumbRes] = await Promise.all([
          supabase.storage.from('recordings').createSignedUrl(videoPath, 7200),
          rec.thumbnail_path
            ? supabase.storage.from('recordings').createSignedUrl(rec.thumbnail_path, 7200)
            : Promise.resolve({ data: null }),
        ]);

        setRecording({
          id: rec.id,
          title: rec.title,
          description: rec.description,
          durationSeconds: rec.duration_seconds ? Number(rec.duration_seconds) : null,
          thumbnailUrl: thumbRes.data?.signedUrl || null,
          videoUrl: videoRes.data?.signedUrl || null,
          viewCount: rec.view_count,
          createdAt: rec.created_at,
          shareExpiresAt: rec.share_expires_at,
        });

        // Fetch comments
        await fetchComments(rec.id);
      } catch (err: any) {
        setError(err.message || 'Failed to load recording');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const fetchComments = useCallback(async (recordingId: string) => {
    const { data } = await supabase
      .from('recording_comments')
      .select('*')
      .eq('recording_id', recordingId)
      .order('created_at', { ascending: true });

    if (!data) return;

    // Build threaded comments
    const flat: Comment[] = data.map((c: any) => ({
      id: c.id,
      authorName: c.author_name,
      commentText: c.comment_text,
      timestampSeconds: c.timestamp_seconds ? Number(c.timestamp_seconds) : null,
      parentId: c.parent_id,
      createdAt: c.created_at,
      replies: [],
    }));

    const byId = new Map(flat.map((c) => [c.id, c]));
    const roots: Comment[] = [];
    for (const c of flat) {
      if (c.parentId && byId.has(c.parentId)) {
        byId.get(c.parentId)!.replies.push(c);
      } else {
        roots.push(c);
      }
    }
    setComments(roots);
  }, []);

  const handleSubmitComment = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !authorName.trim() || !recording) return;
    setSubmitting(true);
    localStorage.setItem('viewer_name', authorName);

    try {
      const { error } = await supabase.from('recording_comments').insert({
        recording_id: recording.id,
        author_name: authorName.trim(),
        comment_text: newComment.trim(),
        timestamp_seconds: addTimestamp ? Math.round(currentTime) : null,
        parent_id: replyTo,
      });
      if (error) throw error;
      setNewComment('');
      setReplyTo(null);
      setAddTimestamp(false);
      await fetchComments(recording.id);
    } catch (err) {
      // silent
    } finally {
      setSubmitting(false);
    }
  }, [newComment, authorName, recording, addTimestamp, currentTime, replyTo, fetchComments]);

  const seekTo = useCallback((time: number) => {
    if (videoRef.current) videoRef.current.currentTime = time;
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-sm text-zinc-500">Loading recording...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !recording) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-zinc-800/50 flex items-center justify-center">
            <svg className="w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-zinc-200">Recording Not Available</h1>
          <p className="text-sm text-zinc-500 max-w-xs">{error || 'This link may have expired or the recording was deleted.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200">
      {/* Video Player */}
      <div className="bg-black">
        <div className="max-w-5xl mx-auto">
          {recording.videoUrl ? (
            <CustomPlayer
              src={recording.videoUrl}
              poster={recording.thumbnailUrl || undefined}
              knownDuration={recording.durationSeconds || undefined}
              videoRef={videoRef}
              onTimeUpdate={setCurrentTime}
            />
          ) : (
            <div className="aspect-video flex items-center justify-center bg-zinc-900">
              <p className="text-sm text-zinc-600">Video unavailable</p>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Info */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h1 className="text-xl font-bold text-zinc-100">{recording.title}</h1>
              <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                <span>{recording.viewCount} views</span>
                <span>&middot;</span>
                <span>{formatDuration(recording.durationSeconds)}</span>
                <span>&middot;</span>
                <span>{timeAgo(recording.createdAt)}</span>
              </div>
              {recording.description && (
                <p className="mt-3 text-sm text-zinc-400 leading-relaxed">{recording.description}</p>
              )}
            </div>

            {/* Branding */}
            <div className="flex items-center gap-3 py-3 border-t border-b border-zinc-800/50">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold text-xs shadow-lg shadow-emerald-500/20">
                IS
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-200">Ivan System</p>
                <p className="text-[11px] text-zinc-500">Screen Recording</p>
              </div>
            </div>
          </div>

          {/* Right: Comments */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-zinc-300">
              Comments ({comments.reduce((n, c) => n + 1 + c.replies.length, 0)})
            </h3>

            {/* Comment Form */}
            <form onSubmit={handleSubmitComment} className="space-y-2">
              <input
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Your name"
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
              />
              <div className="relative">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={replyTo ? 'Write a reply...' : 'Add a comment...'}
                  rows={2}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 resize-none"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-[11px] text-zinc-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addTimestamp}
                    onChange={(e) => setAddTimestamp(e.target.checked)}
                    className="rounded border-zinc-600 bg-zinc-800"
                  />
                  Add timestamp ({formatTimecode(currentTime)})
                </label>
                <div className="flex items-center gap-2">
                  {replyTo && (
                    <button
                      type="button"
                      onClick={() => setReplyTo(null)}
                      className="text-[11px] text-zinc-500 hover:text-zinc-300"
                    >
                      Cancel reply
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={submitting || !newComment.trim() || !authorName.trim()}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded-lg text-xs font-medium text-white transition-colors"
                  >
                    {submitting ? 'Posting...' : 'Post'}
                  </button>
                </div>
              </div>
            </form>

            {/* Comments List */}
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {comments.length === 0 ? (
                <p className="text-xs text-zinc-600 text-center py-4">No comments yet. Be the first!</p>
              ) : (
                comments.map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    onSeek={seekTo}
                    onReply={() => setReplyTo(comment.id)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 border-t border-zinc-800/30">
        <p className="text-[10px] text-zinc-700 text-center">
          Powered by Ivan System &middot; Screen recordings for content creators
        </p>
      </div>
    </div>
  );
}

// ─── Custom Video Player (Loom-style) ───

const CustomPlayer: React.FC<{
  src: string;
  poster?: string;
  knownDuration?: number;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onTimeUpdate: (time: number) => void;
}> = ({ src, poster, knownDuration, videoRef, onTimeUpdate }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCt] = useState(0);
  const [duration, setDuration] = useState(knownDuration || 0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);
  const [previewReady, setPreviewReady] = useState(false);
  const [seeking, setSeeking] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  // Use known duration from DB, fall back to video metadata
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onMeta = () => {
      // WebM duration can be Infinity — use known duration if available
      const vDur = isFinite(v.duration) ? v.duration : 0;
      setDuration(knownDuration || vDur || 0);
    };
    const onTime = () => {
      setCt(v.currentTime);
      onTimeUpdate(v.currentTime);
      // Update duration if it becomes available mid-playback
      if (isFinite(v.duration) && v.duration > 0 && !knownDuration) {
        setDuration(v.duration);
      }
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('ended', onEnded);
    return () => {
      v.removeEventListener('loadedmetadata', onMeta);
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('ended', onEnded);
    };
  }, [knownDuration, onTimeUpdate]);

  // Preview video for hover thumbnails
  useEffect(() => {
    const pv = previewRef.current;
    if (!pv) return;
    const onCanPlay = () => setPreviewReady(true);
    pv.addEventListener('canplay', onCanPlay);
    return () => pv.removeEventListener('canplay', onCanPlay);
  }, []);

  // Capture preview frame when hover time changes
  useEffect(() => {
    if (hoverTime === null || !previewReady) return;
    const pv = previewRef.current;
    const canvas = previewCanvasRef.current;
    if (!pv || !canvas) return;
    pv.currentTime = hoverTime;
    const draw = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = 160;
      canvas.height = 90;
      ctx.drawImage(pv, 0, 0, 160, 90);
    };
    pv.onseeked = draw;
  }, [hoverTime, previewReady]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play(); else v.pause();
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    if (!document.fullscreenElement) {
      c.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  }, []);

  const handleProgressClick = useCallback((e: React.MouseEvent) => {
    const bar = progressRef.current;
    const v = videoRef.current;
    if (!bar || !v || !duration) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.currentTime = pct * duration;
  }, [duration]);

  const handleProgressHover = useCallback((e: React.MouseEvent) => {
    const bar = progressRef.current;
    if (!bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverTime(pct * duration);
    setHoverX(e.clientX - rect.left);
  }, [duration]);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (playing) {
      hideTimer.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [playing]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const v = videoRef.current;
      if (!v) return;
      switch (e.key) {
        case ' ': case 'k': e.preventDefault(); togglePlay(); break;
        case 'ArrowLeft': e.preventDefault(); v.currentTime = Math.max(0, v.currentTime - 5); break;
        case 'ArrowRight': e.preventDefault(); v.currentTime = Math.min(duration, v.currentTime + 5); break;
        case 'm': toggleMute(); break;
        case 'f': toggleFullscreen(); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePlay, toggleMute, toggleFullscreen, duration]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="relative aspect-video bg-black group cursor-pointer select-none"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => { if (playing) setShowControls(false); }}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        playsInline
        autoPlay
        className="w-full h-full"
        onClick={togglePlay}
      />

      {/* Hidden preview video for hover thumbnails */}
      <video ref={previewRef} src={src} preload="auto" muted className="hidden" />
      <canvas ref={previewCanvasRef} className="hidden" />

      {/* Play/pause overlay (center) */}
      {!playing && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
            <svg className="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <polygon points="6,4 20,12 6,20" />
            </svg>
          </div>
        </div>
      )}

      {/* Controls bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.8))' }}
      >
        {/* Progress bar */}
        <div
          ref={progressRef}
          className="relative h-1.5 mx-3 group/bar cursor-pointer hover:h-2.5 transition-all"
          onClick={handleProgressClick}
          onMouseMove={handleProgressHover}
          onMouseLeave={() => setHoverTime(null)}
        >
          {/* Track */}
          <div className="absolute inset-0 rounded-full bg-white/20" />
          {/* Hover fill */}
          {hoverTime !== null && (
            <div
              className="absolute top-0 bottom-0 left-0 rounded-full bg-white/10"
              style={{ width: `${(hoverTime / duration) * 100}%` }}
            />
          )}
          {/* Played fill */}
          <div
            className="absolute top-0 bottom-0 left-0 rounded-full bg-emerald-500"
            style={{ width: `${progress}%` }}
          />
          {/* Scrub handle */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-emerald-400 shadow-lg opacity-0 group-hover/bar:opacity-100 transition-opacity"
            style={{ left: `${progress}%`, transform: `translate(-50%, -50%)` }}
          />

          {/* Hover preview tooltip */}
          {hoverTime !== null && (
            <div
              className="absolute bottom-5 -translate-x-1/2 pointer-events-none"
              style={{ left: Math.max(80, Math.min(hoverX, (progressRef.current?.clientWidth || 300) - 80)) }}
            >
              <div className="rounded-lg overflow-hidden shadow-2xl border border-zinc-700/50 bg-zinc-900">
                <canvas
                  ref={previewCanvasRef}
                  width={160}
                  height={90}
                  className="block"
                  style={{ width: 160, height: 90 }}
                />
                <div className="text-center text-[11px] font-mono text-zinc-300 py-1 bg-zinc-900">
                  {formatTimecode(hoverTime)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Buttons row */}
        <div className="flex items-center gap-3 px-3 py-2">
          {/* Play/Pause */}
          <button onClick={togglePlay} className="text-white hover:text-emerald-400 transition-colors">
            {playing ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <polygon points="6,4 20,12 6,20" />
              </svg>
            )}
          </button>

          {/* Volume */}
          <button onClick={toggleMute} className="text-white/70 hover:text-white transition-colors">
            {muted || volume === 0 ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" d="M11 5L6 9H2v6h4l5 4V5z" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" d="M11 5L6 9H2v6h4l5 4V5z" />
                <path strokeLinecap="round" d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
              </svg>
            )}
          </button>

          {/* Time */}
          <span className="text-[12px] font-mono text-zinc-400 tabular-nums">
            {formatTimecode(currentTime)} / {formatTimecode(duration)}
          </span>

          <div className="flex-1" />

          {/* Fullscreen */}
          <button onClick={toggleFullscreen} className="text-white/70 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {fullscreen ? (
                <path strokeLinecap="round" d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" />
              ) : (
                <path strokeLinecap="round" d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
              )}
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Comment Component ───

const CommentItem: React.FC<{
  comment: Comment;
  onSeek: (time: number) => void;
  onReply: () => void;
  depth?: number;
}> = ({ comment, onSeek, onReply, depth = 0 }) => {
  return (
    <div className={depth > 0 ? 'ml-6 pl-3 border-l border-zinc-800/40' : ''}>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-300">{comment.authorName}</span>
          <span className="text-[10px] text-zinc-600">{timeAgo(comment.createdAt)}</span>
          {comment.timestampSeconds !== null && (
            <button
              onClick={() => onSeek(comment.timestampSeconds!)}
              className="text-[10px] font-mono text-emerald-400 hover:text-emerald-300 cursor-pointer"
            >
              @{formatTimecode(comment.timestampSeconds)}
            </button>
          )}
        </div>
        <p className="text-xs text-zinc-400 leading-relaxed">{comment.commentText}</p>
        <button
          onClick={onReply}
          className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          Reply
        </button>
      </div>
      {comment.replies.map((reply) => (
        <CommentItem
          key={reply.id}
          comment={reply}
          onSeek={onSeek}
          onReply={onReply}
          depth={depth + 1}
        />
      ))}
    </div>
  );
};
