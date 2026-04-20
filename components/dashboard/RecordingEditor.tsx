import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  Scissors, Wand2, Play, Pause, SkipBack, SkipForward,
  ZoomIn, ZoomOut, ToggleLeft, ToggleRight, Loader2, Check,
} from 'lucide-react';
import { useRecordingEditor } from '../../hooks/useRecordingEditor';
import type { RecordingSegment, TranscriptWord } from '../../types/dashboard';

interface Props {
  recordingId: string;
  duration: number;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

const SEGMENT_COLORS: Record<string, string> = {
  speech: 'bg-emerald-500/30 border-emerald-500/50',
  silence: 'bg-zinc-600/20 border-zinc-600/40',
  filler: 'bg-amber-500/25 border-amber-500/40',
  intro: 'bg-blue-500/25 border-blue-500/40',
  outro: 'bg-violet-500/25 border-violet-500/40',
  highlight: 'bg-rose-500/25 border-rose-500/40',
};

function formatTimecode(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  const ms = Math.floor((secs % 1) * 10);
  return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
}

const RecordingEditor: React.FC<Props> = ({ recordingId, duration, videoRef }) => {
  const editor = useRecordingEditor(recordingId, duration);
  const waveformRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<'start' | 'end' | 'playhead' | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showTranscript, setShowTranscript] = useState(true);

  // Bind video element
  React.useEffect(() => {
    editor.bindVideo(videoRef.current);
  }, [videoRef.current]);

  // Calculate position from time
  const timeToPercent = useCallback((time: number) => {
    return duration > 0 ? (time / duration) * 100 : 0;
  }, [duration]);

  // Calculate time from mouse position on waveform
  const getTimeFromMouse = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!waveformRef.current) return 0;
    const rect = waveformRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    return x * duration;
  }, [duration]);

  // Drag handlers for trim handles
  const handleMouseDown = useCallback((handle: 'start' | 'end' | 'playhead') => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(handle);

    const onMove = (me: MouseEvent) => {
      const time = getTimeFromMouse(me);
      if (handle === 'start') editor.setTrimStart(Math.min(time, editor.trimEnd - 0.5));
      else if (handle === 'end') editor.setTrimEnd(Math.max(time, editor.trimStart + 0.5));
      else editor.seekTo(time);
    };

    const onUp = () => {
      setIsDragging(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [editor, getTimeFromMouse]);

  // Click on waveform to seek
  const handleWaveformClick = useCallback((e: React.MouseEvent) => {
    if (isDragging) return;
    const time = getTimeFromMouse(e);
    editor.seekTo(time);
  }, [isDragging, getTimeFromMouse, editor]);

  // Current word in transcript
  const activeWordIndex = useMemo(() => {
    if (!editor.words.length) return -1;
    return editor.words.findIndex(
      (w) => editor.currentTime >= w.startTime && editor.currentTime <= w.endTime
    );
  }, [editor.words, editor.currentTime]);

  // Trimmed duration
  const trimmedDuration = editor.trimEnd - editor.trimStart;
  const hasTrimChanges = editor.trimStart > 0.5 || editor.trimEnd < duration - 0.5;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Playback controls */}
          <button
            onClick={() => editor.seekTo(Math.max(0, editor.currentTime - 5))}
            className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
            title="-5s"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={editor.togglePlay}
            className="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
          >
            {editor.isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            onClick={() => editor.seekTo(Math.min(duration, editor.currentTime + 5))}
            className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
            title="+5s"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>

          {/* Timecode */}
          <span className="ml-2 text-xs font-mono text-zinc-400">
            {formatTimecode(editor.currentTime)} / {formatTimecode(duration)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* AI Trim */}
          <button
            onClick={editor.requestAiTrim}
            disabled={editor.isAiProcessing || editor.isTrimming}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-600/20 border border-violet-500/30 hover:bg-violet-600/30 text-violet-300 text-[11px] font-medium transition-colors disabled:opacity-40"
          >
            {editor.isAiProcessing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Wand2 className="w-3.5 h-3.5" />
            )}
            AI Trim
          </button>

          {/* Apply Manual Trim */}
          {hasTrimChanges && (
            <button
              onClick={editor.applyManualTrim}
              disabled={editor.isTrimming}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/30 hover:bg-emerald-600/30 text-emerald-300 text-[11px] font-medium transition-colors disabled:opacity-40"
            >
              {editor.isTrimming ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Scissors className="w-3.5 h-3.5" />
              )}
              Trim ({formatTimecode(trimmedDuration)})
            </button>
          )}

          {/* Zoom */}
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={() => setZoom((z) => Math.max(1, z - 0.5))}
              className="p-1 rounded bg-zinc-800/60 hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="text-[10px] text-zinc-500 w-8 text-center">{zoom}x</span>
            <button
              onClick={() => setZoom((z) => Math.min(4, z + 0.5))}
              className="p-1 rounded bg-zinc-800/60 hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Waveform + Timeline */}
      <div className="relative select-none" style={{ minHeight: 100 }}>
        {/* Waveform container */}
        <div
          ref={waveformRef}
          onClick={handleWaveformClick}
          className="relative h-20 bg-zinc-800/40 border border-zinc-700/40 rounded-xl overflow-hidden cursor-crosshair"
          style={{ width: `${100 * zoom}%` }}
        >
          {/* Waveform bars */}
          <div className="absolute inset-0 flex items-center px-1">
            {editor.waveformData.map((amp, i) => {
              const barLeft = (i / editor.waveformData.length) * 100;
              const barWidth = 100 / editor.waveformData.length;
              const isInTrim = (i / editor.waveformData.length) * duration >= editor.trimStart
                && (i / editor.waveformData.length) * duration <= editor.trimEnd;
              const isAtPlayhead = Math.abs((i / editor.waveformData.length) * duration - editor.currentTime) < (duration / editor.waveformData.length);

              return (
                <div
                  key={i}
                  className={`transition-colors duration-75 ${
                    isAtPlayhead ? 'bg-white' : isInTrim ? 'bg-emerald-500/60' : 'bg-zinc-600/40'
                  }`}
                  style={{
                    position: 'absolute',
                    left: `${barLeft}%`,
                    width: `max(1px, ${barWidth}%)`,
                    height: `${amp * 70}%`,
                    top: `${50 - (amp * 70) / 2}%`,
                    borderRadius: 1,
                  }}
                />
              );
            })}
          </div>

          {/* Segment overlays */}
          {editor.segments.map((seg) => (
            <SegmentOverlay
              key={seg.id}
              segment={seg}
              duration={duration}
              onClick={() => editor.toggleSegment(seg.id)}
            />
          ))}

          {/* Trim region dimming - left of trim start */}
          <div
            className="absolute top-0 bottom-0 bg-black/40 pointer-events-none"
            style={{ left: 0, width: `${timeToPercent(editor.trimStart)}%` }}
          />
          {/* Trim region dimming - right of trim end */}
          <div
            className="absolute top-0 bottom-0 bg-black/40 pointer-events-none"
            style={{ left: `${timeToPercent(editor.trimEnd)}%`, right: 0 }}
          />

          {/* Trim start handle */}
          <div
            onMouseDown={handleMouseDown('start')}
            className="absolute top-0 bottom-0 w-1.5 bg-amber-400 cursor-col-resize hover:bg-amber-300 z-10 group"
            style={{ left: `calc(${timeToPercent(editor.trimStart)}% - 3px)` }}
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-amber-400 rounded-sm border border-amber-300 shadow" />
            <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-mono text-amber-400 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
              {formatTimecode(editor.trimStart)}
            </span>
          </div>

          {/* Trim end handle */}
          <div
            onMouseDown={handleMouseDown('end')}
            className="absolute top-0 bottom-0 w-1.5 bg-amber-400 cursor-col-resize hover:bg-amber-300 z-10 group"
            style={{ left: `calc(${timeToPercent(editor.trimEnd)}% - 3px)` }}
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-amber-400 rounded-sm border border-amber-300 shadow" />
            <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-mono text-amber-400 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
              {formatTimecode(editor.trimEnd)}
            </span>
          </div>

          {/* Playhead */}
          <div
            onMouseDown={handleMouseDown('playhead')}
            className="absolute top-0 bottom-0 w-0.5 bg-white z-20 cursor-col-resize"
            style={{ left: `${timeToPercent(editor.currentTime)}%` }}
          >
            <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white rounded-full shadow-lg" />
          </div>
        </div>

        {/* Time markers */}
        <div className="flex justify-between mt-1 px-1">
          <span className="text-[9px] font-mono text-zinc-600">0:00</span>
          <span className="text-[9px] font-mono text-zinc-600">{formatTimecode(duration / 4)}</span>
          <span className="text-[9px] font-mono text-zinc-600">{formatTimecode(duration / 2)}</span>
          <span className="text-[9px] font-mono text-zinc-600">{formatTimecode(duration * 3 / 4)}</span>
          <span className="text-[9px] font-mono text-zinc-600">{formatTimecode(duration)}</span>
        </div>
      </div>

      {/* Segments List */}
      {editor.segments.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">AI Segments</h4>
            <span className="text-[10px] text-zinc-600">{editor.segments.filter((s) => s.isIncluded).length}/{editor.segments.length} included</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {editor.segments.map((seg) => (
              <button
                key={seg.id}
                onClick={() => {
                  editor.seekTo(seg.startTime);
                  editor.toggleSegment(seg.id);
                }}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] transition-all ${
                  seg.isIncluded
                    ? SEGMENT_COLORS[seg.segmentType] || 'bg-zinc-700/30 border-zinc-600/40'
                    : 'bg-zinc-800/30 border-zinc-700/20 opacity-40 line-through'
                }`}
              >
                {seg.isIncluded ? (
                  <ToggleRight className="w-3 h-3 text-emerald-400" />
                ) : (
                  <ToggleLeft className="w-3 h-3 text-zinc-500" />
                )}
                <span className="text-zinc-300">{seg.label || seg.segmentType}</span>
                <span className="text-zinc-500 font-mono">
                  {formatTimecode(seg.startTime)}-{formatTimecode(seg.endTime)}
                </span>
                {seg.confidence && (
                  <span className="text-zinc-600">{Math.round(seg.confidence * 100)}%</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Transcript */}
      {editor.words.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Transcript</h4>
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {showTranscript ? 'Hide' : 'Show'}
            </button>
          </div>
          {showTranscript && (
            <div className="p-3 bg-zinc-800/30 border border-zinc-700/30 rounded-xl max-h-32 overflow-y-auto text-xs leading-relaxed">
              {editor.words.map((word, i) => (
                <span
                  key={word.id}
                  onClick={() => editor.seekTo(word.startTime)}
                  className={`cursor-pointer transition-colors hover:text-white ${
                    i === activeWordIndex
                      ? 'text-emerald-400 font-medium'
                      : word.confidence && word.confidence < 0.7
                        ? 'text-amber-400/70'
                        : 'text-zinc-400'
                  }`}
                >
                  {word.word}{' '}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state for editor */}
      {editor.segments.length === 0 && editor.words.length === 0 && (
        <div className="text-center py-3">
          <p className="text-[11px] text-zinc-500">
            Use <span className="text-violet-400">AI Trim</span> to auto-detect segments, or drag the yellow handles to trim manually.
          </p>
        </div>
      )}
    </div>
  );
};

// ─── Segment Overlay on Waveform ───

const SegmentOverlay: React.FC<{
  segment: RecordingSegment;
  duration: number;
  onClick: () => void;
}> = ({ segment, duration, onClick }) => {
  const left = (segment.startTime / duration) * 100;
  const width = ((segment.endTime - segment.startTime) / duration) * 100;
  const color = SEGMENT_COLORS[segment.segmentType] || 'bg-zinc-600/20 border-zinc-600/30';

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`absolute top-0 bottom-0 border-t-2 cursor-pointer transition-opacity hover:opacity-100 ${color} ${
        segment.isIncluded ? 'opacity-80' : 'opacity-20'
      }`}
      style={{ left: `${left}%`, width: `${width}%` }}
      title={`${segment.segmentType}: ${segment.label || ''} (${segment.startTime.toFixed(1)}s - ${segment.endTime.toFixed(1)}s)`}
    />
  );
};

export default RecordingEditor;
