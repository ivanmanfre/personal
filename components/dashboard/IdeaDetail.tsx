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
    <div className="p-5 space-y-5 text-[var(--ds-ink)] max-w-3xl">
      {/* Header: strength band + score breakdown + source */}
      <div className="flex items-center gap-3 flex-wrap text-[12px]">
        {draft.topicStrength && (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 ring-1 ring-inset ring-emerald-200 px-2.5 py-1 text-emerald-700 font-semibold">
            {draft.topicStrength}{s?.composite != null && <span className="text-emerald-600/60 font-normal">· {s.composite}</span>}
          </span>
        )}
        {s && (s.icp != null || s.virality != null || s.gap != null) && (
          <span className="text-[var(--ds-dim)] tabular-nums">
            ICP {s.icp ?? '—'} · Viral {s.virality ?? '—'} · Gap {s.gap ?? '—'}
          </span>
        )}
        {srcLabel && <span className="text-[var(--ds-faint)]">· {srcLabel}</span>}
        {draft.ideaStrength && (
          <span className="ml-auto inline-flex items-center rounded-md bg-[var(--ds-bg)] border border-[var(--ds-line)] px-2 py-0.5 text-[11px] text-[var(--ds-dim)]">
            {draft.ideaStrength}
          </span>
        )}
      </div>

      {/* Topic */}
      <h2 className="text-xl font-semibold leading-snug text-[var(--ds-ink)]">{draft.title || draft.topic}</h2>

      {/* Angle */}
      {draft.topic && draft.topic !== draft.title && (
        <p className="text-[14px] leading-relaxed text-[var(--ds-dim)]">{draft.topic}</p>
      )}

      {/* Why it scores */}
      {draft.ideaWhy && (
        <div>
          <div className="text-[11px] uppercase tracking-wider text-[var(--ds-faint)] mb-1">Why it scores</div>
          <p className="text-[13.5px] leading-relaxed text-[var(--ds-dim)] italic">{draft.ideaWhy}</p>
        </div>
      )}

      {/* Editorial assessment (Opus, when run at the idea stage) */}
      {draft.ideaAssessment && (
        <div>
          <div className="text-[11px] uppercase tracking-wider text-[var(--ds-faint)] mb-1">Editorial assessment</div>
          <p className="text-[13.5px] leading-relaxed text-[var(--ds-dim)]">{draft.ideaAssessment}</p>
        </div>
      )}

      {/* Evidence */}
      {draft.ideaEvidence && draft.ideaEvidence.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-wider text-[var(--ds-faint)] mb-2">Evidence</div>
          <div className="space-y-2.5">
            {draft.ideaEvidence.slice(0, 6).map((e, i) => (
              <blockquote key={i} className="border-l-2 border-emerald-400/60 pl-3 py-0.5">
                {e.quote && (
                  <p className="text-[13px] leading-relaxed text-[var(--ds-dim)] italic flex gap-1.5">
                    <Quote className="w-3 h-3 text-emerald-500/70 flex-none mt-1" />
                    <span>{e.quote}</span>
                  </p>
                )}
                {(e.persona || e.source) && (
                  <div className="mt-1 text-[11px] text-[var(--ds-faint)]">
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
        <div className="text-[12px] text-[var(--ds-dim)]">
          Recommended: <span className="text-[var(--ds-ink)]">{draft.ideaFormat || '—'}</span>
          {draft.ideaLadder && <> · ladder <span className="text-[var(--ds-ink)]">{draft.ideaLadder}</span></>}
        </div>
      )}

      {/* Actions */}
      <div className="pt-3 border-t border-[var(--ds-line)] space-y-3">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Optional note (steers the curator / logs the reason)"
          className="w-full rounded-lg bg-[var(--ds-card)] border border-[var(--ds-line)] px-3 py-2 text-[13px] text-[var(--ds-ink)] placeholder:text-[var(--ds-faint)] focus:outline-none focus:border-[var(--ds-accent)] focus:ring-2 focus:ring-[var(--ds-accent)]/20 transition-all"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => act('approve')}
            disabled={!!busy}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-50 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-900/20 ring-1 ring-emerald-400/30"
          >
            {busy === 'approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Approve &amp; generate
          </button>
          <button
            onClick={() => act('reject')}
            disabled={!!busy}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--ds-card)] hover:bg-red-50 border border-[var(--ds-line)] hover:border-red-200 disabled:opacity-50 px-3.5 py-2 text-sm font-medium text-[var(--ds-dim)] hover:text-red-600 transition-colors"
          >
            {busy === 'reject' ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
            Reject
          </button>
          <button
            onClick={() => act('defer')}
            disabled={!!busy}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--ds-card)] hover:bg-black/[.03] border border-[var(--ds-line)] disabled:opacity-50 px-3.5 py-2 text-sm font-medium text-[var(--ds-dim)] hover:text-[var(--ds-ink)] transition-colors"
          >
            {busy === 'defer' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            Keep for later
          </button>
        </div>
      </div>
    </div>
  );
}
