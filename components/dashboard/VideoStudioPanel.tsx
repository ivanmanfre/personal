import React, { useState, useMemo, useCallback } from 'react';
import { Video, Loader2, RotateCcw, CheckCircle2, AlertCircle, Clock, Film, ChevronDown, ChevronRight } from 'lucide-react';
import { useContentLibrary } from '../../hooks/useContentLibrary';
import { redoVideo, approveVideo } from '../../lib/studioActions';
import { toastError, toastSuccess } from '../../lib/dashboardActions';
import { PanelIntro } from '../dashboard-v2/primitives';
import EmptyState from './shared/EmptyState';

// Animated-video review studio. Video drafts are carousel_drafts rows with
// type='video'; the curator (LM Scorer) suggests them and video-gen-v2 renders
// async, landing them here at video_status='review'. Ivan watches, optionally
// leaves feedback + Redo (re-renders with the feedback folded into the spec),
// then Approve.

const STATUS_STYLE: Record<string, string> = {
  queued:     'bg-slate-500/20 text-slate-300 border-slate-500/30',
  generating: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  review:     'bg-sky-500/20 text-sky-300 border-sky-500/30',
  approved:   'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  failed:     'bg-rose-500/20 text-rose-300 border-rose-500/30',
};
const STATUS_ICON: Record<string, React.ReactNode> = {
  queued:     <Clock className="w-3.5 h-3.5" />,
  generating: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
  review:     <Video className="w-3.5 h-3.5" />,
  approved:   <CheckCircle2 className="w-3.5 h-3.5" />,
  failed:     <AlertCircle className="w-3.5 h-3.5" />,
};
const STYLE_LABEL: Record<string, string> = {
  'serpentine-flow': 'Serpentine Flow',
  'product-ui-showcase': 'Product UI',
  'before-after': 'Before / After',
};

export default function VideoStudioPanel() {
  const { drafts, loading, applyOptimistic } = useContentLibrary();
  const [openId, setOpenId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const videos = useMemo(
    () => drafts.filter((d) => d.type === 'video' || d.videoStatus || d.videoUrl),
    [drafts],
  );

  const setBusyFor = (id: string, v: boolean) => setBusy((p) => ({ ...p, [id]: v }));

  const doRedo = useCallback(async (id: string, style: string | null) => {
    setBusyFor(id, true);
    try {
      await redoVideo({ draft_id: id, style: style || 'serpentine-flow', feedback: feedback[id] ?? undefined });
      applyOptimistic(id, { videoStatus: 'generating', videoFeedback: feedback[id] ?? null });
      toastSuccess('Re-rendering — back in ~2-3 min');
    } catch (e) {
      toastError('redo video', e);
    } finally {
      setBusyFor(id, false);
    }
  }, [feedback, applyOptimistic]);

  const doApprove = useCallback(async (id: string) => {
    setBusyFor(id, true);
    try {
      const r = await approveVideo(id);
      applyOptimistic(id, { videoStatus: 'approved', status: 'scheduled', scheduledAt: r.scheduled_at });
      const when = r.scheduled_at ? new Date(r.scheduled_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
      toastSuccess(when ? `Approved — scheduled for ${when}` : 'Video approved');
    } catch (e) {
      toastError('approve video', e);
    } finally {
      setBusyFor(id, false);
    }
  }, [applyOptimistic]);

  if (loading) {
    return <div className="p-8 text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading video drafts…</div>;
  }

  if (videos.length === 0) {
    return (
      <EmptyState
        title="No videos in review"
        description="When a post is a good fit for motion, an animated vertical video is generated and lands here for your approval."
      />
    );
  }

  return (
    <div className="space-y-3 p-1">
      <PanelIntro
        tourId="video"
        purpose="Animated, on-brand videos that publish natively to LinkedIn and Reels."
        how="Claude authors a per-topic spec; the render engine turns it into a vertical animated infographic you review and approve."
      />
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Video className="w-4 h-4" /> Animated videos
          <span className="text-slate-500 font-normal">({videos.length})</span>
        </h3>
      </div>

      {videos.map((d) => {
        const st = d.videoStatus || 'queued';
        const open = openId === d.id;
        const isBusy = !!busy[d.id];
        const rendering = st === 'queued' || st === 'generating';
        const steps = (d.videoSpec && (d.videoSpec.steps || d.videoSpec.before)) as any[] | undefined;
        return (
          <div key={d.id} className="rounded-xl border border-slate-700/60 bg-slate-900/40 overflow-hidden">
            <button
              onClick={() => setOpenId(open ? null : d.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-800/40 transition-colors"
            >
              {open ? <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-200 truncate">{d.title}</p>
                <p className="text-xs text-slate-500 truncate">{d.topic}</p>
              </div>
              {d.videoStyle && (
                <span className="hidden sm:inline text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                  {STYLE_LABEL[d.videoStyle] || d.videoStyle}
                </span>
              )}
              <span className={`text-[11px] px-2 py-0.5 rounded-full border flex items-center gap-1 shrink-0 ${STATUS_STYLE[st] || STATUS_STYLE.queued}`}>
                {STATUS_ICON[st]} {st}
              </span>
            </button>

            {open && (
              <div className="px-4 pb-4 pt-1 border-t border-slate-800 space-y-3">
                {/* Preview */}
                {d.videoUrl ? (
                  <video
                    src={d.videoUrl}
                    controls
                    playsInline
                    className="w-full max-w-[320px] mx-auto rounded-lg border border-slate-700 bg-black"
                    style={{ aspectRatio: '9 / 16' }}
                  />
                ) : rendering ? (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="text-sm">{st === 'queued' ? 'Queued…' : 'Rendering… (~2-3 min)'}</span>
                  </div>
                ) : st === 'failed' ? (
                  <div className="flex items-center gap-2 text-rose-300 text-sm py-6 justify-center">
                    <AlertCircle className="w-4 h-4" /> Render failed — try Redo.
                  </div>
                ) : null}

                {/* Spec step summary */}
                {Array.isArray(steps) && steps.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {steps.slice(0, 9).map((s: any, i: number) => (
                      <span key={i} className="text-[11px] px-2 py-0.5 rounded bg-slate-800/70 text-slate-400 border border-slate-700/60">
                        {s.kw || s.label || s.title || (typeof s === 'string' ? s : `step ${i + 1}`)}
                      </span>
                    ))}
                  </div>
                )}

                {/* Feedback + actions */}
                <textarea
                  value={feedback[d.id] ?? (d.videoFeedback || '')}
                  onChange={(e) => setFeedback((p) => ({ ...p, [d.id]: e.target.value }))}
                  placeholder="Feedback for a redo — e.g. 'slow the score beat', 'cut step 6', 'punchier payoff'…"
                  rows={2}
                  className="w-full text-sm rounded-lg bg-slate-950/60 border border-slate-700 text-slate-200 placeholder-slate-600 px-3 py-2 resize-y focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => doRedo(d.id, d.videoStyle)}
                    disabled={isBusy || rendering}
                    className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Redo
                  </button>
                  <button
                    onClick={() => doApprove(d.id)}
                    disabled={isBusy || st !== 'review'}
                    className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approve & schedule
                  </button>
                  {d.videoStatus === 'approved' && (
                    <span className="text-xs text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approved{d.scheduledAt ? ` · ${new Date(d.scheduledAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}` : ''}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
