import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Scissors, Loader2 } from 'lucide-react';
import { useVideoShorts } from '../../hooks/useVideoShorts';
import { supabase } from '../../lib/supabase';
import ShortCard from './ShortCard';
import type { VideoIdea } from '../../types/dashboard';

interface Props {
  idea: VideoIdea;
}

const VideoEditingView: React.FC<Props> = ({ idea }) => {
  const { shorts, loading, approveShort, rejectShort, renderShort, renderAllApproved, updateShort, refresh } = useVideoShorts(idea.id);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!idea.recordingPath) return;
    supabase.storage.from('originals').createSignedUrl(idea.recordingPath, 3600)
      .then(({ data }) => { if (data?.signedUrl) setVideoUrl(data.signedUrl); });
  }, [idea.recordingPath]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (playing) { videoRef.current.pause(); } else { videoRef.current.play(); }
    setPlaying(!playing);
  };

  const seekTo = (time: number) => {
    if (videoRef.current) { videoRef.current.currentTime = time; setCurrentTime(time); }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    video.addEventListener('timeupdate', onTimeUpdate);
    return () => video.removeEventListener('timeupdate', onTimeUpdate);
  }, [videoUrl]);

  const approvedCount = shorts.filter(s => s.status === 'approved').length;
  const doneCount = shorts.filter(s => s.status === 'done').length;

  if (!idea.recordingPath) {
    return <p className="text-xs text-zinc-500">No recording yet.</p>;
  }

  return (
    <div className="space-y-4">
      {videoUrl && (
        <div className="space-y-2">
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full rounded-lg border border-zinc-700/50 max-h-[300px]"
            onEnded={() => setPlaying(false)}
          />
          <div className="flex items-center gap-2">
            <button onClick={togglePlay} className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors">
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <span className="text-xs text-zinc-500 font-mono">
              {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}
              {idea.recordingDurationSeconds ? ` / ${Math.floor(idea.recordingDurationSeconds / 60)}:${Math.floor(idea.recordingDurationSeconds % 60).toString().padStart(2, '0')}` : ''}
            </span>
          </div>
        </div>
      )}

      {idea.transcriptWords && idea.transcriptWords.length > 0 && (
        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-3 max-h-[150px] overflow-y-auto">
          <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-2">Transcript</p>
          <p className="text-xs text-zinc-400 leading-relaxed">
            {idea.transcriptWords.map((w, i) => {
              const isActive = currentTime >= w.start && currentTime < w.end;
              return (
                <span
                  key={i}
                  onClick={() => seekTo(w.start)}
                  className={`cursor-pointer hover:text-white transition-colors ${isActive ? 'text-emerald-400 font-medium' : ''}`}
                >
                  {w.word}{' '}
                </span>
              );
            })}
          </p>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
            <Scissors className="w-3 h-3" /> AI-Suggested Shorts ({shorts.length})
          </p>
          {approvedCount > 0 && (
            <button
              onClick={renderAllApproved}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 transition-colors"
            >
              Render All ({approvedCount})
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Loader2 className="w-3 h-3 animate-spin" /> Loading shorts...
          </div>
        ) : shorts.length === 0 ? (
          <p className="text-xs text-zinc-500">Processing... shorts will appear here when ready.</p>
        ) : (
          <div className="grid gap-2">
            {shorts.filter(s => s.status !== 'rejected').map(s => (
              <ShortCard
                key={s.id}
                short={s}
                onApprove={() => approveShort(s.id)}
                onReject={() => rejectShort(s.id)}
                onRender={() => renderShort(s.id)}
                onFormatToggle={() => updateShort(s.id, 'format', s.format === 'short' ? 'long' : 'short')}
              />
            ))}
          </div>
        )}

        {doneCount > 0 && (
          <p className="text-[10px] text-emerald-400">{doneCount}/{shorts.length} shorts rendered</p>
        )}
      </div>
    </div>
  );
};

export default VideoEditingView;
