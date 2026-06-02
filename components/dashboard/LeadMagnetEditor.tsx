import React, { useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, CheckCircle, ExternalLink, RefreshCw, Image as ImageIcon, Save, ChevronDown, ChevronUp } from 'lucide-react';
import type { LeadMagnetDraft } from '../../hooks/useLeadMagnets';
import { generateLMContent, buildLMAssets, regenLMCover, saveLMDraft } from '../../lib/studioActions';
import { toastError } from '../../lib/dashboardActions';
import AgentLogFeed from './AgentLogFeed';
import QAVerdictPanel from './QAVerdictPanel';
import SourceBriefing from './SourceBriefing';
import { useUpstreamSource } from '../../hooks/useUpstreamSource';
import { Card, CardLabel, Button, Textarea, FieldLabel, EmptyState } from '../ui/primitives';
import PostPreview from '../ui/PostPreview';

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
  // LM upstream-source resolver — uses spec.source_candidate_id when present,
  // OR falls back to draft.source (Client Calls / Web Research / Competitor / Manual).
  const upstream = useUpstreamSource({ source_candidate_id: spec.source_candidate_id, source: draft.source });
  const [dmA, setDmA] = useState((spec.dm_template_a as string) || '');
  const [dmB, setDmB] = useState((spec.dm_template_b as string) || '');
  const [resourceOpen, setResourceOpen] = useState(false);
  const [postMode, setPostMode] = useState<'edit' | 'preview'>('edit');

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
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <FieldLabel className="!mb-0">LinkedIn post</FieldLabel>
              <div className="inline-flex rounded-md bg-zinc-900 border border-zinc-800 p-0.5">
                <button
                  onClick={() => setPostMode('edit')}
                  className={`px-2 py-0.5 text-[11px] rounded transition-colors ${postMode === 'edit' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
                >Edit</button>
                <button
                  onClick={() => setPostMode('preview')}
                  className={`px-2 py-0.5 text-[11px] rounded transition-colors ${postMode === 'preview' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
                >Preview</button>
              </div>
              <span className="text-[10.5px] text-zinc-600 tabular-nums">{postBody.length}{postBody.length > 210 && <span className="text-amber-400 ml-1">· past fold</span>}</span>
            </div>
            {postMode === 'edit' ? (
              <Textarea value={postBody} onChange={(e) => setPostBody(e.target.value)} rows={6} className="text-[13.5px] leading-relaxed font-sans" />
            ) : (
              <div className="min-h-[240px] rounded-md bg-zinc-950 border border-zinc-800 px-3 py-2">
                <PostPreview text={postBody} />
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <FieldLabel className="!mb-0">Email copy <span className="text-zinc-600 normal-case font-normal">· 24h follow-up</span></FieldLabel>
              <span className="text-[10.5px] text-zinc-600 tabular-nums">{emailCopy.length}</span>
            </div>
            <Textarea value={emailCopy} onChange={(e) => setEmailCopy(e.target.value)} rows={5} className="text-[13.5px] leading-relaxed font-sans" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <FieldLabel className="!mb-0">DM Template A</FieldLabel>
              <span className="text-[10.5px] text-zinc-600 tabular-nums">{dmA.length}</span>
            </div>
            <Textarea value={dmA} onChange={(e) => setDmA(e.target.value)} rows={5} placeholder="Hey {{firstName}}, here's the …" className="text-[13px]" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <FieldLabel className="!mb-0">DM Template B</FieldLabel>
              <span className="text-[10.5px] text-zinc-600 tabular-nums">{dmB.length}</span>
            </div>
            <Textarea value={dmB} onChange={(e) => setDmB(e.target.value)} rows={5} placeholder="Hey {{firstName}}, the … is yours: …" className="text-[13px]" />
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
                  className="w-full rounded-md bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-zinc-100 leading-relaxed focus:outline-none focus:border-zinc-600"
                />
              </div>
            )}
          </div>

          <SourceBriefing description={draft.description} upstream={upstream} />

          {draft.notes && (
            <div className="rounded-md border border-zinc-800/60 bg-zinc-900/30 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1 font-medium">Notes</div>
              <pre className="whitespace-pre-wrap text-xs text-zinc-300 font-sans leading-snug">{draft.notes}</pre>
            </div>
          )}

          <QAVerdictPanel entries={draft.agentLog} />

          <AgentLogFeed
            entries={draft.agentLog}
            table="lm_drafts_v2"
            rowId={draft.id}
            onNoteAdded={onChanged}
            defaultOpen
            renderMarkdown
          />
        </div>

        {/* RIGHT COLUMN — preview + actions */}
        <div className="space-y-3 min-w-0">
          <Card>
            <CardLabel>Cover</CardLabel>
            {draft.coverUrl ? (
              <>
                <img src={draft.coverUrl} alt="cover" className="w-full rounded-md border border-zinc-800 mb-2" />
                <Button
                  variant="secondary" size="sm" block
                  disabled={!!busy}
                  onClick={() => run('regen-cover', () => regenLMCover({ draft_id: draft.id }), 'Cover regen done — refresh in a moment')}
                  title="Generate a fresh cover image (Gemini, ~2-3 min). Does NOT regenerate content.">
                  {busy === 'regen-cover' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />} Regen cover
                </Button>
              </>
            ) : (
              <EmptyState
                title="No cover yet"
                action={draft.status !== 'idea' && draft.status !== 'generating' ? (
                  <Button
                    variant="secondary" size="sm"
                    disabled={!!busy}
                    onClick={() => run('regen-cover', () => regenLMCover({ draft_id: draft.id }), 'Cover gen fired (~2-3 min)')}>
                    {busy === 'regen-cover' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />} Generate cover
                  </Button>
                ) : undefined}
              />
            )}
          </Card>

          {spec.promo_image_url && (
            <Card>
              <CardLabel>Promo image</CardLabel>
              <img src={spec.promo_image_url as string} alt="promo" className="w-full rounded-md border border-zinc-800" />
            </Card>
          )}

          {isReady && draft.resourceUrl && (
            <a
              href={draft.resourceUrl}
              target="_blank"
              rel="noreferrer"
              className="block rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-3 py-2.5 text-sm text-emerald-300 hover:bg-emerald-950/30 transition-colors"
            >
              <CardLabel className="!text-emerald-500/70 !mb-1">Live URL</CardLabel>
              <div className="inline-flex items-center gap-1.5 truncate">
                <ExternalLink className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{draft.resourceUrl}</span>
              </div>
            </a>
          )}

          <div className="space-y-2">
            <Button
              variant="secondary" block
              disabled={!!busy || !dirty}
              onClick={() => run('save', saveAll, 'Saved')}>
              {busy === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save changes
            </Button>
            {(draft.status === 'idea' || draft.status === 'generating' || draft.status === 'error') && (
              <Button
                variant="secondary" block
                disabled={!!busy || !draft.topic || !draft.format}
                onClick={() => run('regen', () => generateLMContent({ draft_id: draft.id, topic: draft.topic || '', format: draft.format || 'Checklist' }), 'Generation fired (~10 min)')}>
                {busy === 'regen' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Generate content <span className="text-[10px] text-zinc-500">~10 min</span>
              </Button>
            )}
            {isReview && (
              <Button
                variant="primary" block
                disabled={!!busy}
                onClick={() => run('assets', () => buildLMAssets({ draft_id: draft.id, topic: draft.topic || '', format: draft.format || 'Checklist' }), 'Approved — building assets (~5 min)')}>
                {busy === 'assets' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Approve &amp; build assets
              </Button>
            )}
          </div>
        </div>
      </div>

      <p className="text-[11px] text-zinc-600">Saves write directly to Supabase. DM Templates and other extras live in <code>spec</code> JSON.</p>
    </div>
  );
};

export default LeadMagnetEditor;
