import React, { useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, CheckCircle, ExternalLink, RefreshCw, Image as ImageIcon, Save, ChevronDown, ChevronUp } from 'lucide-react';
import type { LeadMagnetDraft } from '../../hooks/useLeadMagnets';
import { generateLMContent, buildLMAssets, regenLMCover, saveLMDraft } from '../../lib/studioActions';
import { toastError } from '../../lib/dashboardActions';
import AgentLogFeed from './AgentLogFeed';
import SourceBriefing from './SourceBriefing';

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

  const isReview = draft.status === 'review';
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-200" title="Back">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-lg font-semibold text-zinc-100 truncate flex-1">{draft.topic || '(untitled)'}</h2>
        <span className="text-xs text-zinc-500">{draft.format || 'no format'} · {draft.status}</span>
      </div>

      {/* Taxonomy chips */}
      {(draft.topicStrength || draft.source || spec.target_audience) && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {draft.topicStrength && (
            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800/60 border border-zinc-700/50 px-2.5 py-0.5 text-zinc-300">
              <span className="text-zinc-500 text-[10px] uppercase">Strength</span> {draft.topicStrength}
            </span>
          )}
          {draft.source && (
            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800/60 border border-zinc-700/50 px-2.5 py-0.5 text-zinc-300">
              <span className="text-zinc-500 text-[10px] uppercase">Source</span> {draft.source}
            </span>
          )}
          {spec.target_audience && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/40 border border-emerald-900/40 px-2.5 py-0.5 text-emerald-300/90">
              <span className="text-emerald-500/60 text-[10px] uppercase">Audience</span> <span className="truncate max-w-[420px]">{spec.target_audience}</span>
            </span>
          )}
        </div>
      )}

      {/* 2-column body: left = editing, right = preview + meta + actions */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5">
        {/* LEFT COLUMN — editing surfaces */}
        <div className="space-y-4 min-w-0">
          <label className="block text-xs font-medium uppercase tracking-wider text-zinc-500">
            LinkedIn post
            <textarea
              value={postBody}
              onChange={(e) => setPostBody(e.target.value)}
              rows={10}
              className="mt-1.5 w-full rounded-md bg-zinc-950 border border-zinc-800 px-3 py-2 text-[13.5px] text-zinc-100 leading-relaxed font-sans focus:outline-none focus:border-zinc-600"
            />
          </label>

          <label className="block text-xs font-medium uppercase tracking-wider text-zinc-500">
            Email copy <span className="text-zinc-600 normal-case font-normal">(24h follow-up)</span>
            <textarea
              value={emailCopy}
              onChange={(e) => setEmailCopy(e.target.value)}
              rows={8}
              className="mt-1.5 w-full rounded-md bg-zinc-950 border border-zinc-800 px-3 py-2 text-[13.5px] text-zinc-100 leading-relaxed font-sans focus:outline-none focus:border-zinc-600"
            />
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block text-xs font-medium uppercase tracking-wider text-zinc-500">
              DM Template A
              <textarea
                value={dmA}
                onChange={(e) => setDmA(e.target.value)}
                rows={4}
                placeholder="Hey {{firstName}}, here's the …"
                className="mt-1.5 w-full rounded-md bg-zinc-950 border border-zinc-800 px-3 py-2 text-[13px] text-zinc-100 focus:outline-none focus:border-zinc-600"
              />
            </label>
            <label className="block text-xs font-medium uppercase tracking-wider text-zinc-500">
              DM Template B
              <textarea
                value={dmB}
                onChange={(e) => setDmB(e.target.value)}
                rows={4}
                placeholder="Hey {{firstName}}, the … is yours: …"
                className="mt-1.5 w-full rounded-md bg-zinc-950 border border-zinc-800 px-3 py-2 text-[13px] text-zinc-100 focus:outline-none focus:border-zinc-600"
              />
            </label>
          </div>

          <div className="rounded-md border border-zinc-800/60 bg-zinc-900/30">
            <button
              onClick={() => setResourceOpen((v) => !v)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs uppercase tracking-wider text-zinc-500 font-medium hover:bg-zinc-900"
            >
              Resource content
              {resourceHtml && <span className="text-zinc-600 normal-case font-normal">({resourceHtml.length.toLocaleString()} chars)</span>}
              <span className="ml-auto text-zinc-500">{resourceOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
            </button>
            {resourceOpen && (
              <div className="border-t border-zinc-800/60 p-2">
                <textarea
                  value={resourceHtml}
                  onChange={(e) => setResourceHtml(e.target.value)}
                  rows={16}
                  className="w-full rounded-md bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-zinc-600"
                />
              </div>
            )}
          </div>

          <SourceBriefing description={draft.description} />

          {draft.notes && (
            <div className="rounded-md border border-zinc-800/60 bg-zinc-900/30 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1 font-medium">Notes</div>
              <pre className="whitespace-pre-wrap text-xs text-zinc-300 font-sans leading-snug">{draft.notes}</pre>
            </div>
          )}

          <AgentLogFeed
            entries={draft.agentLog}
            table="lm_drafts_v2"
            rowId={draft.id}
            onNoteAdded={onChanged}
          />
        </div>

        {/* RIGHT COLUMN — preview + actions */}
        <div className="space-y-4 min-w-0">
          {/* Cover preview */}
          <div className="rounded-md border border-zinc-800/60 bg-zinc-900/30 p-3 space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Cover</div>
            {draft.coverUrl ? (
              <>
                <img src={draft.coverUrl} alt="cover" className="w-full rounded-md border border-zinc-800" />
                <button
                  onClick={() => run('regen-cover', () => regenLMCover({ draft_id: draft.id }), 'Cover regen done — refresh in a moment')}
                  disabled={!!busy}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 px-2.5 py-1.5 text-xs text-zinc-200 border border-zinc-700/40"
                  title="Generate a fresh cover image (Gemini, ~2-3 min). Does NOT regenerate content.">
                  {busy === 'regen-cover' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />} Regen cover
                </button>
              </>
            ) : (
              <div className="rounded-md border border-dashed border-zinc-800 bg-zinc-950/40 p-6 text-center text-xs text-zinc-500 italic">
                No cover yet
                {draft.status !== 'idea' && draft.status !== 'generating' && (
                  <button
                    onClick={() => run('regen-cover', () => regenLMCover({ draft_id: draft.id }), 'Cover gen fired (~2-3 min)')}
                    disabled={!!busy}
                    className="mt-3 mx-auto inline-flex items-center gap-2 rounded-md bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 px-2.5 py-1.5 text-xs text-zinc-200">
                    {busy === 'regen-cover' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />} Generate cover
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Promo image (if exists) */}
          {spec.promo_image_url && (
            <div className="rounded-md border border-zinc-800/60 bg-zinc-900/30 p-3 space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Promo image</div>
              <img src={spec.promo_image_url as string} alt="promo" className="w-full rounded-md border border-zinc-800" />
            </div>
          )}

          {/* Resource URL (if built) */}
          {isReady && draft.resourceUrl && (
            <a
              href={draft.resourceUrl}
              target="_blank"
              rel="noreferrer"
              className="block rounded-md border border-emerald-900/40 bg-emerald-950/20 px-3 py-2.5 text-sm text-emerald-300 hover:bg-emerald-950/30"
            >
              <div className="text-[10px] uppercase tracking-wider text-emerald-500/70 font-medium mb-1">Live URL</div>
              <div className="inline-flex items-center gap-1.5 truncate">
                <ExternalLink className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{draft.resourceUrl}</span>
              </div>
            </a>
          )}

          {/* Actions stack */}
          <div className="space-y-2">
            <button
              onClick={() => run('save', saveAll, 'Saved')}
              disabled={!!busy || !dirty}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 px-3 py-2 text-sm text-zinc-200 border border-zinc-700/40">
              {busy === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save changes
            </button>
            {(draft.status === 'idea' || draft.status === 'generating' || draft.status === 'error') && (
              <button
                onClick={() => run('regen', () => generateLMContent({ draft_id: draft.id, topic: draft.topic || '', format: draft.format || 'Checklist' }), 'Generation fired (~10 min)')}
                disabled={!!busy || !draft.topic || !draft.format}
                className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 px-3 py-2 text-sm text-zinc-200 border border-zinc-700/40">
                {busy === 'regen' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Generate content <span className="text-[10px] text-zinc-500">~10 min</span>
              </button>
            )}
            {isReview && (
              <button
                onClick={() => run('assets', () => buildLMAssets({ draft_id: draft.id, topic: draft.topic || '', format: draft.format || 'Checklist' }), 'Approved — building assets (~5 min)')}
                disabled={!!busy}
                className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-3 py-2 text-sm font-medium text-white">
                {busy === 'assets' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Approve &amp; build assets
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="text-[11px] text-zinc-600">Saves write directly to Supabase. DM Templates and other extras live in <code>spec</code> JSON.</p>
    </div>
  );
};

export default LeadMagnetEditor;
