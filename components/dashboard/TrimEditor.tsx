import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Scissors, Play, Pause, Loader2, Check, RotateCcw } from 'lucide-react';

interface Props {
  recordingId: string;
  videoUrl: string;
  duration: number;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onTrimComplete: () => void;
  onCancel: () => void;
}

const PROCESSOR_URL = import.meta.env.VITE_PROCESSOR_URL || 'https://ivan-recorder-production.up.railway.app';
const PROCESS_SECRET = '31c815068711a096dc9e426a14be18d94cb381adf11ec742fe7d2410df676763';
const THUMB_COUNT = 30;

function formatTimecode(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  const ms = Math.floor((secs % 1) * 10);
  return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
}

const TrimEditor: React.FC<Props> = ({ recordingId, videoUrl, duration, videoRef, onTrimComplete, onCancel }) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const thumbCanvasRef = useRef<HTMLCanvasElement>(null);
  const thumbVideoRef = useRef<HTMLVideoElement>(null);

  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(duration);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [dragging, setDragging] = useState<'start' | 'end' | null>(null);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Sync playhead with video
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setCurrentTime(v.currentTime);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
    };
  }, [videoRef]);

  // Enforce trim bounds during preview playback
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !isPlaying) return;
    const check = () => {
      if (v.currentTime >= trimEnd) {
        v.pause();
        v.currentTime = trimEnd;
      }
    };
    v.addEventListener('timeupdate', check);
    return () => v.removeEventListener('timeupdate', check);
  }, [isPlaying, trimEnd, videoRef]);

  // Generate thumbnails from video
  useEffect(() => {
    const tv = thumbVideoRef.current;
    const canvas = thumbCanvasRef.current;
    if (!tv || !canvas || !videoUrl || duration <= 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 120;
    canvas.height = 68;
    const thumbs: string[] = [];
    let idx = 0;

    const captureNext = () => {
      if (idx >= THUMB_COUNT) {
        setThumbnails(thumbs);
        return;
      }
      const time = (idx / THUMB_COUNT) * duration;
      tv.currentTime = time;
    };

    tv.onseeked = () => {
      ctx.drawImage(tv, 0, 0, 120, 68);
      thumbs.push(canvas.toDataURL('image/jpeg', 0.5));
      idx++;
      captureNext();
    };

    tv.onloadeddata = () => captureNext();
    if (tv.readyState >= 2) captureNext();
  }, [videoUrl, duration]);

  // Convert mouse position to time
  const getTimeFromMouse = useCallback((e: React.MouseEvent | MouseEvent) => {
    const el = timelineRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    return pct * duration;
  }, [duration]);

  // Handle drag
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const time = getTimeFromMouse(e);
      if (dragging === 'start') {
        setTrimStart(Math.max(0, Math.min(time, trimEnd - 0.5)));
      } else {
        setTrimEnd(Math.min(duration, Math.max(time, trimStart + 0.5)));
      }
    };
    const onUp = () => setDragging(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, trimStart, trimEnd, duration, getTimeFromMouse]);

  const togglePreview = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.currentTime = trimStart;
      v.play();
    } else {
      v.pause();
    }
  }, [trimStart, videoRef]);

  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (dragging) return;
    const time = getTimeFromMouse(e);
    if (videoRef.current) videoRef.current.currentTime = time;
  }, [dragging, getTimeFromMouse, videoRef]);

  const resetTrim = useCallback(() => {
    setTrimStart(0);
    setTrimEnd(duration);
  }, [duration]);

  const handleSave = useCallback(async () => {
    if (!PROCESSOR_URL) {
      setErrorMsg('Processor URL not configured. Set VITE_PROCESSOR_URL env var.');
      setSaveStatus('error');
      return;
    }

    setSaving(true);
    setSaveStatus('saving');
    try {
      const res = await fetch(`${PROCESSOR_URL}/trim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recording_id: recordingId,
          start: Math.round(trimStart * 100) / 100,
          end: Math.round(trimEnd * 100) / 100,
          secret: PROCESS_SECRET,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      setSaveStatus('done');
      setTimeout(() => onTrimComplete(), 1500);
    } catch (err: any) {
      setErrorMsg(err.message);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  }, [recordingId, trimStart, trimEnd, onTrimComplete]);

  const startPct = (trimStart / duration) * 100;
  const endPct = (trimEnd / duration) * 100;
  const playheadPct = (currentTime / duration) * 100;
  const hasTrimChanges = trimStart > 0.3 || trimEnd < duration - 0.3;
  const trimmedDuration = trimEnd - trimStart;

  return (
    <div className="mt-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scissors className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-medium text-zinc-200">Trim Editor</span>
        </div>
        <button onClick={onCancel} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
          Close Editor
        </button>
      </div>

      {/* Hidden video for thumbnail generation */}
      <video ref={thumbVideoRef} src={videoUrl} preload="auto" muted className="hidden" crossOrigin="anonymous" />
      <canvas ref={thumbCanvasRef} className="hidden" />

      {/* Timeline */}
      <div
        ref={timelineRef}
        className="relative h-16 rounded-lg overflow-hidden cursor-pointer select-none bg-zinc-800"
        onClick={handleTimelineClick}
      >
        {/* Thumbnail strip */}
        <div className="absolute inset-0 flex">
          {thumbnails.length > 0
            ? thumbnails.map((thumb, i) => (
                <img
                  key={i}
                  src={thumb}
                  alt=""
                  className="h-full object-cover flex-1"
                  draggable={false}
                />
              ))
            : Array.from({ length: THUMB_COUNT }, (_, i) => (
                <div key={i} className="h-full flex-1 bg-zinc-700/50 border-r border-zinc-800/30" />
              ))}
        </div>

        {/* Dimmed regions outside trim */}
        <div
          className="absolute top-0 bottom-0 left-0 bg-black/60 pointer-events-none"
          style={{ width: `${startPct}%` }}
        />
        <div
          className="absolute top-0 bottom-0 right-0 bg-black/60 pointer-events-none"
          style={{ width: `${100 - endPct}%` }}
        />

        {/* Trim region border */}
        <div
          className="absolute top-0 bottom-0 border-y-2 border-amber-400/80 pointer-events-none"
          style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
        />

        {/* Start handle */}
        <div
          className="absolute top-0 bottom-0 w-3 bg-amber-400 cursor-ew-resize z-10 flex items-center justify-center hover:bg-amber-300 transition-colors"
          style={{ left: `${startPct}%`, transform: 'translateX(-100%)' }}
          onMouseDown={(e) => { e.stopPropagation(); setDragging('start'); }}
        >
          <div className="w-0.5 h-6 bg-amber-800 rounded-full" />
        </div>

        {/* End handle */}
        <div
          className="absolute top-0 bottom-0 w-3 bg-amber-400 cursor-ew-resize z-10 flex items-center justify-center hover:bg-amber-300 transition-colors"
          style={{ left: `${endPct}%` }}
          onMouseDown={(e) => { e.stopPropagation(); setDragging('end'); }}
        >
          <div className="w-0.5 h-6 bg-amber-800 rounded-full" />
        </div>

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white z-20 pointer-events-none"
          style={{ left: `${playheadPct}%` }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white rounded-full shadow" />
        </div>
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Preview */}
          <button
            onClick={togglePreview}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-medium text-zinc-300 transition-colors"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {isPlaying ? 'Pause' : 'Preview'}
          </button>

          {/* Reset */}
          {hasTrimChanges && (
            <button
              onClick={resetTrim}
              className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-zinc-800 rounded-lg text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          )}
        </div>

        {/* Time display */}
        <div className="text-xs font-mono text-zinc-400 tabular-nums">
          <span className="text-amber-400">{formatTimecode(trimStart)}</span>
          <span className="text-zinc-600 mx-1.5">&rarr;</span>
          <span className="text-amber-400">{formatTimecode(trimEnd)}</span>
          <span className="text-zinc-600 ml-2">({formatTimecode(trimmedDuration)})</span>
        </div>
      </div>

      {/* Save button */}
      {hasTrimChanges && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving || saveStatus === 'done'}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              saveStatus === 'done'
                ? 'bg-emerald-600 text-white'
                : saveStatus === 'error'
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50'
            }`}
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Trimming...</>
            ) : saveStatus === 'done' ? (
              <><Check className="w-4 h-4" /> Trimmed!</>
            ) : (
              <><Scissors className="w-4 h-4" /> Save Trim</>
            )}
          </button>
          {saveStatus === 'error' && (
            <span className="text-xs text-red-400">{errorMsg}</span>
          )}
          <span className="text-[11px] text-zinc-600">
            Removes {formatTimecode(trimStart)} from start, {formatTimecode(duration - trimEnd)} from end
          </span>
        </div>
      )}
    </div>
  );
};

export default TrimEditor;
