import React, { useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, CheckCircle, ExternalLink, RefreshCw, Image as ImageIcon } from 'lucide-react';
import type { LeadMagnetDraft } from '../../hooks/useLeadMagnets';
import { generateLMContent, buildLMAssets, regenLMCover } from '../../lib/studioActions';
import { toastError } from '../../lib/dashboardActions';

interface Props {
  draft: LeadMagnetDraft;
  onClose: () => void;
  onChanged: () => void;
}

const LeadMagnetEditor: React.FC<Props> = ({ draft, onClose, onChanged }) => {
  const [busy, setBusy] = useState<string | null>(null);

  async function run(label: string, fn: () => Promise<unknown>, successMsg: string) {
    setBusy(label);
    try { await fn(); toast.success(successMsg); onChanged(); }
    catch (err) { toastError(label, err); }
    finally { setBusy(null); }
  }

  const isReview = draft.status === 'lm_review';
  const isReady = draft.status === 'ready';

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-200" title="Back">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-lg font-semibold text-zinc-100 truncate">{draft.topic || '(untitled)'}</h2>
        <span className="ml-auto text-xs text-zinc-500">{draft.format || 'no format'} · {draft.status}</span>
      </div>

      {/* Cover preview + regen */}
      {draft.coverUrl ? (
        <div className="flex items-start gap-3">
          <img src={draft.coverUrl} alt="cover" className="max-w-[280px] rounded-md border border-zinc-800" />
          <button
            onClick={() => run('regen-cover', () => regenLMCover({ draft_id: draft.id }), 'Cover regen done — refresh in a moment')}
            disabled={!!busy}
            className="inline-flex items-center gap-2 rounded-md bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 px-2.5 py-1.5 text-xs text-zinc-200 self-start"
            title="Generate a fresh cover image (Gemini, ~2-3 min). Does NOT regenerate content.">
            {busy === 'regen-cover' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />} Regen cover
          </button>
        </div>
      ) : (
        draft.status !== 'idea' && draft.status !== 'generating' && (
          <button
            onClick={() => run('regen-cover', () => regenLMCover({ draft_id: draft.id }), 'Cover gen fired (~2-3 min)')}
            disabled={!!busy}
            className="inline-flex items-center gap-2 rounded-md bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 px-2.5 py-1.5 text-xs text-zinc-200">
            {busy === 'regen-cover' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />} Generate cover
          </button>
        )
      )}

      {/* LinkedIn post */}
      <div>
        <div className="mb-1 text-xs uppercase tracking-wide text-zinc-500">LinkedIn post</div>
        <pre className="whitespace-pre-wrap text-sm text-zinc-200 bg-zinc-950 border border-zinc-800 rounded-md p-3">{draft.postBody || '(empty)'}</pre>
      </div>

      {/* Email copy */}
      <div>
        <div className="mb-1 text-xs uppercase tracking-wide text-zinc-500">Email copy</div>
        <pre className="whitespace-pre-wrap text-sm text-zinc-200 bg-zinc-950 border border-zinc-800 rounded-md p-3 max-h-64 overflow-y-auto">{draft.emailCopy || '(empty)'}</pre>
      </div>

      {/* Resource body (preview head only) */}
      <div>
        <div className="mb-1 text-xs uppercase tracking-wide text-zinc-500">Resource content (head)</div>
        <pre className="whitespace-pre-wrap text-sm text-zinc-200 bg-zinc-950 border border-zinc-800 rounded-md p-3 max-h-64 overflow-y-auto">{(draft.resourceHtml || '(empty)').slice(0, 2000)}</pre>
      </div>

      {/* Resource URL if built */}
      {isReady && draft.resourceUrl && (
        <a href={draft.resourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300">
          <ExternalLink className="w-4 h-4" /> {draft.resourceUrl}
        </a>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        {(draft.status === 'idea' || draft.status === 'generating' || draft.status === 'error') && (
          <button
            onClick={() => run('regen', () => generateLMContent({ draft_id: draft.id, topic: draft.topic || '', format: draft.format || 'Checklist' }), 'Generation fired (~10 min)')}
            disabled={!!busy || !draft.topic || !draft.format}
            className="inline-flex items-center gap-2 rounded-md bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 px-3 py-2 text-sm text-zinc-100">
            {busy === 'regen' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Generate content
          </button>
        )}
        {isReview && (
          <button
            onClick={() => run('assets', () => buildLMAssets({ draft_id: draft.id, topic: draft.topic || '', format: draft.format || 'Checklist' }), 'Approved — building assets (~5 min)')}
            disabled={!!busy}
            className="ml-auto inline-flex items-center gap-2 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-3 py-2 text-sm font-medium text-white">
            {busy === 'assets' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Approve & build assets
          </button>
        )}
      </div>
      <p className="text-[11px] text-zinc-600">Pre-cutover: GitHub deploy is isolated (no live publish), scheduled_posts row gets <code>queued_v2</code> status (live publisher ignores it).</p>
    </div>
  );
};

export default LeadMagnetEditor;
