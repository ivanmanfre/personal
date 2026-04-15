import React from 'react';
import { Check, X, Play, Loader2, ExternalLink, AlertCircle, Film, Monitor } from 'lucide-react';
import type { VideoShort } from '../../types/dashboard';

interface Props {
  short: VideoShort;
  onApprove: () => void;
  onReject: () => void;
  onRender: () => void;
  onFormatToggle: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const statusStyles: Record<string, string> = {
  pending: 'bg-zinc-800/50 border-zinc-700/50',
  approved: 'bg-emerald-900/20 border-emerald-500/30',
  rejected: 'bg-red-900/10 border-red-500/20 opacity-50',
  rendering: 'bg-cyan-900/20 border-cyan-500/30',
  done: 'bg-emerald-900/20 border-emerald-500/30',
  error: 'bg-red-900/20 border-red-500/30',
};

const ShortCard: React.FC<Props> = ({ short, onApprove, onReject, onRender, onFormatToggle }) => {
  const isRendering = short.status === 'rendering';
  const isDone = short.status === 'done';

  return (
    <div className={`rounded-lg border p-3 space-y-2 ${statusStyles[short.status] || statusStyles.pending}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{short.title || 'Untitled segment'}</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            {formatTime(short.startTime)} — {formatTime(short.endTime)} · {Math.round(short.durationSeconds)}s
          </p>
        </div>
        <button
          onClick={onFormatToggle}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700 hover:text-white transition-colors"
          title={short.format === 'short' ? '9:16 Portrait' : '16:9 Landscape'}
        >
          {short.format === 'short' ? <Film className="w-3 h-3" /> : <Monitor className="w-3 h-3" />}
          {short.format === 'short' ? '9:16' : '16:9'}
        </button>
      </div>

      {short.transcriptText && (
        <p className="text-[11px] text-zinc-400 line-clamp-2">{short.transcriptText}</p>
      )}

      {short.status === 'error' && short.renderError && (
        <p className="text-[10px] text-red-400 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> {short.renderError}
        </p>
      )}

      <div className="flex items-center gap-1.5">
        {short.status === 'pending' && (
          <>
            <button onClick={onApprove} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 transition-colors">
              <Check className="w-3 h-3" /> Approve
            </button>
            <button onClick={onReject} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-zinc-800 text-zinc-500 border border-zinc-700 hover:text-red-400 transition-colors">
              <X className="w-3 h-3" /> Skip
            </button>
          </>
        )}
        {short.status === 'approved' && (
          <button onClick={onRender} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 transition-colors">
            <Play className="w-3 h-3" /> Render
          </button>
        )}
        {isRendering && (
          <span className="flex items-center gap-1 text-[10px] text-cyan-400">
            <Loader2 className="w-3 h-3 animate-spin" /> Rendering...
          </span>
        )}
        {isDone && short.videoUrl && (
          <a href={short.videoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 transition-colors">
            <ExternalLink className="w-3 h-3" /> View
          </a>
        )}
      </div>
    </div>
  );
};

export default ShortCard;
