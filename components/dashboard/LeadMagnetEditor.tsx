import React, { useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, CheckCircle, ExternalLink, RefreshCw, Image as ImageIcon, Save, ChevronDown, ChevronUp } from 'lucide-react';
import type { LeadMagnetDraft } from '../../hooks/useLeadMagnets';
import { generateLMContent, buildLMAssets, regenLMCover, saveLMDraft } from '../../lib/studioActions';
import { toastError } from '../../lib/dashboardActions';

interface Props {
  draft: LeadMagnetDraft;
  onClose: () => void;
  onChanged: () => void;
}

const LeadMagnetEditor: React.FC<Props> = ({ draft, onClose, onChanged }) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [postBody, setPostBody] = useState(draft.postBody || '');
  const [emailCopy, setEmailCopy] = useState(draft.emailCopy || '');
  const [resourceHtml, setResourceHtml] = useState(draft.resourceHtml || '');
  const spec = (draft.spec || {}) as Record<string, any>;
  const [dmA, setDmA] = useState((spec.dm_template_a as string) || '');
  const [dmB, setDmB] = useState((spec.dm_template_b as string) || '');
  const [resourceOpen, setResourceOpen] = useState(false);

  async function run(label: string, fn: () => Promise<unknown>, successMsg: string) {
    setBusy(label);
    try { await fn(); toast.success(successMsg); onChanged(); }
    catch (err) { toastError(label, err); }
    finally { setBusy(null); }
  }

  const isReview = draft.status === 'lm_review';
  const isReady = draft.status === 'ready';
  const dirty = postBody !== (draft.postBody || '')
    || emailCopy !== (draft.emailCopy || '')
    || resourceHtml !== (draft.resourceHtml || '')
    || dmA !== ((spec.dm_template_a as string) || '')
    || dmB !== ((spec.dm_template_b as string) || '');

  async function saveAll() {
    await saveLMDraft({
      id: draft.id,
      post_body: postBody,
      email_copy: emailCopy,
      resource_html: resourceHtml,
      spec_patch: { dm_template_a: dmA, dm_template_b: dmB },
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-200" title="Back">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-lg font-semibold text-zinc-100 truncate">{draft.topic || '(untitled)'}</h2>
        <span className="ml-auto text-xs text-zinc-500">{draft.format || 'no format'} · {draft.status}</span>
      </div>

      {/* Target audience (read-only context) */}
      {spec.target_audience && (
        <div className="rounded-md border border-emerald-900/40 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-300/80">
          <span className="uppercase tracking-wider text-emerald-400/60 mr-2">Audience</span>
          {spec.target_audience}
        </div>
      )}

      {/* Covers row: main cover + promo image */}
      <div className="flex flex-wrap items-start gap-4">
        {draft.coverUrl ? (
          <div className="flex flex-col gap-1">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">Cover</div>
            <img src={draft.coverUrl} alt="cover" className="max-w-[240px] rounded-md border border-zinc-800" />
            <button
              onClick={() => run('regen-cover', () => regenLMCover({ draft_id: draft.id }), 'Cover regen done — refresh in a moment')}
              disabled={!!busy}
              className="mt-1 inline-flex items-center gap-2 rounded-md bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 px-2.5 py-1.5 text-xs text-zinc-200"
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
        {spec.promo_image_url && (
          <div className="flex flex-col gap-1">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">Promo image</div>
            <img src={spec.promo_image_url as string} alt="promo" className="max-w-[160px] rounded-md border border-zinc-800" />
          </div>
        )}
      </div>

      {/* LinkedIn post — EDITABLE */}
      <label className="block text-sm text-zinc-400">LinkedIn post
        <textarea value={postBody} onChange={(e) => setPostBody(e.target.value)} rows={8}
          className="mt-1 w-full rounded-md bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-zinc-100 font-mono" />
      </label>

      {/* Email copy — EDITABLE */}
      <label className="block text-sm text-zinc-400">Email copy (24h follow-up)
        <textarea value={emailCopy} onChange={(e) => setEmailCopy(e.target.value)} rows={8}
          className="mt-1 w-full rounded-md bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-zinc-100 font-mono" />
      </label>

      {/* DM Templates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="block text-sm text-zinc-400">DM Template A
          <textarea value={dmA} onChange={(e) => setDmA(e.target.value)} rows={4}
            placeholder="Hey {{firstName}}, here's the …"
            className="mt-1 w-full rounded-md bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-zinc-100" />
        </label>
        <label className="block text-sm text-zinc-400">DM Template B
          <textarea value={dmB} onChange={(e) => setDmB(e.target.value)} rows={4}
            placeholder="Hey {{firstName}}, the … is yours: …"
            className="mt-1 w-full rounded-md bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-zinc-100" />
        </label>
      </div>

      {/* Resource content — collapsed accordion, EDITABLE when open */}
      <div className="rounded-md border border-zinc-800">
        <button
          onClick={() => setResourceOpen((v) => !v)}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
        >
          Resource content {resourceHtml && <span className="text-zinc-600 text-xs">({resourceHtml.length.toLocaleString()} chars)</span>}
          <span className="ml-auto text-zinc-500">{resourceOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
        </button>
        {resourceOpen && (
          <div className="border-t border-zinc-800 p-2">
            <textarea value={resourceHtml} onChange={(e) => setResourceHtml(e.target.value)} rows={16}
              className="w-full rounded-md bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-zinc-100 font-mono" />
          </div>
        )}
      </div>

      {/* Resource URL if built */}
      {isReady && draft.resourceUrl && (
        <a href={draft.resourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300">
          <ExternalLink className="w-4 h-4" /> {draft.resourceUrl}
        </a>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => run('save', saveAll, 'Saved')}
          disabled={!!busy || !dirty}
          className="inline-flex items-center gap-2 rounded-md bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 px-3 py-2 text-sm text-zinc-100">
          {busy === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save changes
        </button>
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
      <p className="text-[11px] text-zinc-600">Saves write directly to Supabase. DM Templates and other extras live in <code>spec</code> JSON.</p>
    </div>
  );
};

export default LeadMagnetEditor;
