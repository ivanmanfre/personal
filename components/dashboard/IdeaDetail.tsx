import React, { useState } from 'react';
import { toast } from 'sonner';
import { Check, X, RotateCcw, Loader2, Quote } from 'lucide-react';
import type { CarouselDraft } from '../../hooks/useContentLibrary';
import { decideIdea, SOURCE_LABEL, type IdeaDecision } from '../../lib/ideaProjection';

// IdeaDetail — the Idea-stage equivalent of CarouselEditor. Shows the full
// curator context (angle, why, editorial assessment, evidence, signal scores,
// recommended format) and the three editorial actions. Approve fires the
// existing decide → Promoter path (creates the generating draft); the row then
// leaves the Idea stage.
export default function IdeaDetail({
  draft,
  onClose,
  onDecided,
}: {
  draft: CarouselDraft;
  onClose: () => void;
  onDecided: (candidateId: string, decision: IdeaDecision) => void;
}) {
  const [busy, setBusy] = useState<IdeaDecision | null>(null);
  const [reason, setReason] = useState('');
  const cid = draft.ideaCandidateId || '';
  const s = draft.ideaScores;

  const act = async (decision: IdeaDecision) => {
    if (busy) return;
    setBusy(decision);
    try {
      await decideIdea(cid, decision, reason.trim() || undefined);
      if (decision === 'approve') {
        toast.success('Approved — generating now', { description: 'Moves Idea → Generating → Review.' });
      } else if (decision === 'reject') {
        toast.success('Rejected — removed from ideas');
      } else {
        toast.success('Kept for later');
      }
      onDecided(cid, decision);
      onClose();
    } catch (e: any) {
      toast.error('Action failed', { description: e?.message || String(e) });
    } finally {
      setBusy(null);
    }
  };

  const srcLabel = draft.ideaSource ? (SOURCE_LABEL[draft.ideaSource] || draft.ideaSource) : null;

  return (
    <div className="p-5 space-y-5 text-zinc-200 max-w-3xl">
      {/* Header: score + source */}
      <div className="flex items-center gap-3 flex-wrap text-[12px]">
        {s?.composite != null && (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 ring-1 ring-inset ring-emerald-500/30 px-2.5 py-1 text-emerald-200 font-semibold">
            {s.composite}/30
          </span>
        )}
        {s && (s.icp != null || s.virality != null || s.gap != null) && (
          <span className="text-zinc-400 tabular-nums">
            ICP {s.icp ?? '—'} · Viral {s.virality ?? '—'} · Gap {s.gap ?? '—'}
          </span>
        )}
        {srcLabel && <span className="text-zinc-500">· {srcLabel}</span>}
        {draft.ideaStrength && (
          <span className="ml-auto inline-flex items-center rounded-md bg-zinc-800/80 px-2 py-0.5 text-[11px] text-zinc-300">
            {draft.ideaStrength}
          </span>
        )}
      </div>

      {/* Topic */}
      <h2 className="text-xl font-semibold leading-snug text-zinc-50">{draft.title || draft.topic}</h2>

      {/* Angle */}
      {draft.topic && draft.topic !== draft.title && (
        <p className="text-[14px] leading-relaxed text-zinc-300">{draft.topic}</p>
      )}

      {/* Why it scores */}
      {draft.ideaWhy && (
        <div>
          <div className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">Why it scores</div>
          <p className="text-[13.5px] leading-relaxed text-zinc-300 italic">{draft.ideaWhy}</p>
        </div>
      )}

      {/* Editorial assessment (Opus, when run at the idea stage) */}
      {draft.ideaAssessment && (
        <div>
          <div className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">Editorial assessment</div>
          <p className="text-[13.5px] leading-relaxed text-zinc-300">{draft.ideaAssessment}</p>
        </div>
      )}

      {/* Evidence */}
      {draft.ideaEvidence && draft.ideaEvidence.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-wider text-zinc-500 mb-2">Evidence</div>
          <div className="space-y-2.5">
            {draft.ideaEvidence.slice(0, 6).map((e, i) => (
              <blockquote key={i} className="border-l-2 border-emerald-500/60 pl-3 py-0.5">
                {e.quote && (
                  <p className="text-[13px] leading-relaxed text-zinc-300 italic flex gap-1.5">
                    <Quote className="w-3 h-3 text-emerald-500/70 flex-none mt-1" />
                    <span>{e.quote}</span>
                  </p>
                )}
                {(e.persona || e.source) && (
                  <div className="mt-1 text-[11px] text-zinc-500">
                    — {[e.persona, e.source && (SOURCE_LABEL[e.source] || e.source)].filter(Boolean).join(' · ')}
                  </div>
                )}
              </blockquote>
            ))}
          </div>
        </div>
      )}

      {/* Recommended */}
      {(draft.ideaFormat || draft.ideaLadder) && (
        <div className="text-[12px] text-zinc-400">
          Recommended: <span className="text-zinc-200">{draft.ideaFormat || '—'}</span>
          {draft.ideaLadder && <> · ladder <span className="text-zinc-200">{draft.ideaLadder}</span></>}
        </div>
      )}

      {/* Actions */}
      <div className="pt-3 border-t border-zinc-800 space-y-3">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Optional note (steers the curator / logs the reason)"
          className="w-full rounded-lg bg-zinc-950/60 ring-1 ring-zinc-800/80 px-3 py-2 text-[13px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => act('approve')}
            disabled={!!busy}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-50 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-900/40 ring-1 ring-emerald-400/30"
          >
            {busy === 'approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Approve &amp; generate
          </button>
          <button
            onClick={() => act('reject')}
            disabled={!!busy}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-900/60 hover:bg-red-500/10 ring-1 ring-inset ring-zinc-800 hover:ring-red-500/40 disabled:opacity-50 px-3.5 py-2 text-sm font-medium text-zinc-300 hover:text-red-300"
          >
            {busy === 'reject' ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
            Reject
          </button>
          <button
            onClick={() => act('defer')}
            disabled={!!busy}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-900/60 hover:bg-zinc-800 ring-1 ring-inset ring-zinc-800 disabled:opacity-50 px-3.5 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200"
          >
            {busy === 'defer' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            Keep for later
          </button>
        </div>
      </div>
    </div>
  );
}
