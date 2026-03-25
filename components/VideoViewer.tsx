import React, { useState, useEffect, useCallback, useRef } from 'react';
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
          <div className="relative aspect-video">
            {recording.videoUrl ? (
              <video
                ref={videoRef}
                src={recording.videoUrl}
                controls
                playsInline
                autoPlay
                poster={recording.thumbnailUrl || undefined}
                className="w-full h-full"
                onTimeUpdate={() => {
                  if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                <p className="text-sm text-zinc-600">Video unavailable</p>
              </div>
            )}
          </div>
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
