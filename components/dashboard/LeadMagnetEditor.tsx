import React, { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, CheckCircle, ExternalLink, RefreshCw, Image as ImageIcon, Save, ChevronDown, ChevronUp, Trash2, CalendarClock } from 'lucide-react';
import type { LeadMagnetDraft } from '../../hooks/useLeadMagnets';
import { generateLMContent, buildLMAssets, scheduleLM, regenLMCover, saveLMDraft } from '../../lib/studioActions';
import { findNextSlot, toDatetimeLocalString } from '../../lib/findNextSlot';
import { versionedAssetUrl } from '../../lib/driveThumb';
import { supabase } from '../../lib/supabase';
import { toastError } from '../../lib/dashboardActions';
import AgentLogFeed from './AgentLogFeed';
import QAVerdictPanel from './QAVerdictPanel';
import SourceBriefing from './SourceBriefing';
import { useUpstreamSource } from '../../hooks/useUpstreamSource';
import { Card, CardLabel, Button, Input, Textarea, FieldLabel, EmptyState } from '../ui/primitives';
import LinkedInPostPreview from '../ui/LinkedInPostPreview';
import { InternalTabs } from './InternalTabs';

interface Props {
  draft: LeadMagnetDraft;
  onClose: () => void;
  onChanged: () => void;
}

// Layout mirrors CarouselEditor (Posts) for cross-editor consistency:
// LEFT = content editing, MIDDLE = reference tabs (Preview / Cover / Checks),
// RIGHT = sticky agent-log rail, plus a sticky bottom action bar. LM-specific
// content sections and actions are preserved; only the distribution changed.
const LeadMagnetEditor: React.FC<Props> = ({ draft, onClose, onChanged }) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [postBody, setPostBody] = useState(draft.postBody || '');
  const [emailCopy, setEmailCopy] = useState(draft.emailCopy || '');
  const [resourceHtml, setResourceHtml] = useState(draft.resourceHtml || '');
  const spec = (draft.spec || {}) as Record<string, any>;
  // Cover regen overwrites the SAME slug-derived storage path, so the URL is
  // stable — version it by updatedAt so a fresh render actually refetches
  // instead of showing the browser-cached old cover.
  const coverSrc = versionedAssetUrl(draft.coverUrl, draft.updatedAt);
  // LM upstream-source resolver — uses spec.source_candidate_id when present,
  // OR falls back to draft.source (Client Calls / Web Research / Competitor / Manual).
  const upstream = useUpstreamSource({ source_candidate_id: spec.source_candidate_id, source: draft.source });
  const [dmA, setDmA] = useState((spec.dm_template_a as string) || '');
  const [dmB, setDmB] = useState((spec.dm_template_b as string) || '');
  const [resourceOpen, setResourceOpen] = useState(false);
  const [postMode, setPostMode] = useState<'edit' | 'preview'>('edit');
  const [when, setWhen] = useState('');

  async function run(label: string, fn: () => Promise<unknown>, successMsg: string) {
    setBusy(label);
    try { await fn(); toast.success(successMsg); onChanged(); }
    catch (err) { toastError(label, err); }
    finally { setBusy(null); }
  }

  const isReview = draft.status === 'review';
  // Once assets are built (page deployed), the promo post can be scheduled to a
  // time you pick — or rescheduled if already queued. Mirrors the carousel editor.
  const canSchedule = draft.status === 'approved' || draft.status === 'scheduled';
  const isScheduled = draft.status === 'scheduled';
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
      {/* Taxonomy line — muted editorial annotation (title lives in the Sheet header). */}
      {(draft.topicStrength || draft.source || spec.target_audience || draft.format) && (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[length:var(--t-sm)] text-[color:var(--d-paper-dimmer)]">
          {draft.format && <span><span className="opacity-60 mr-1">Format</span>{draft.format}</span>}
          {draft.topicStrength && <span className="before:content-['·'] before:mr-2 before:opacity-50"><span className="opacity-60 mr-1">Strength</span>{draft.topicStrength}</span>}
          {draft.source && <span className="before:content-['·'] before:mr-2 before:opacity-50"><span className="opacity-60 mr-1">via</span>{draft.source}</span>}
          {spec.target_audience && <span className="before:content-['·'] before:mr-2 before:opacity-50"><span className="opacity-60 mr-1">Audience</span><span className="truncate max-w-[420px]">{spec.target_audience}</span></span>}
        </div>
      )}

      {/* Adaptive grid — identical to CarouselEditor: 1col → md 2col (rail spans
          both on row 2) → lg 3col with sticky rail. */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_360px] gap-5 md:[&>*:nth-child(3)]:col-span-2 lg:[&>*:nth-child(3)]:col-span-1">
        {/* LEFT COLUMN — content editing surfaces */}
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
              <div className="rounded-md bg-zinc-950/80 border border-zinc-800 p-3">
                <LinkedInPostPreview text={postBody} mediaUrl={coverSrc} />
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
        </div>

        {/* MIDDLE COLUMN — reference tabs (Preview / Cover / Checks). */}
        <div className="space-y-3 min-w-0">
          <Card padded={false} className="px-3 pt-2 pb-3">
            <InternalTabs
              storageKey="lm-editor-reference"
              tabs={[
                {
                  key: 'preview',
                  label: 'Preview',
                  render: () => (
                    <div className="rounded-md bg-zinc-950/60 border border-zinc-800/60 p-3">
                      <LinkedInPostPreview text={postBody} mediaUrl={coverSrc} />
                    </div>
                  ),
                },
                {
                  key: 'cover',
                  label: 'Cover',
                  render: () => (
                    <div className="space-y-3">
                      {draft.coverUrl ? (
                        <>
                          <img src={coverSrc || undefined} alt="cover" className="w-full rounded-md border border-zinc-800" />
                          <Button
                            variant="secondary" size="sm" block
                            disabled={!!busy}
                            onClick={() => run('regen-cover', () => regenLMCover({ draft_id: draft.id }), 'Cover regen done — updates live in a moment')}
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
                      {spec.promo_image_url && (
                        <div>
                          <CardLabel>Promo image</CardLabel>
                          <img src={spec.promo_image_url as string} alt="promo" className="w-full rounded-md border border-zinc-800" />
                        </div>
                      )}
                      {draft.resourceUrl && (
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
                    </div>
                  ),
                },
                {
                  key: 'checks',
                  label: 'Checks',
                  render: () => <QAVerdictPanel entries={draft.agentLog} />,
                },
              ]}
            />
          </Card>
        </div>

        {/* RIGHT RAIL — sticky agent activity feed (matches Posts). */}
        <div className="min-w-0">
          <div className="lg:sticky lg:top-2">
            <AgentLogFeed
              entries={draft.agentLog}
              table="lm_drafts_v2"
              rowId={draft.id}
              onNoteAdded={onChanged}
              defaultOpen
              renderMarkdown
            />
          </div>
        </div>
      </div>

      {/* Sticky bottom action bar — spans the full sheet width. State action on
          the left, persistent Save / Delete on the right. Mirrors Posts. */}
      <div className="sticky bottom-0 z-10 -mx-4 mt-6 px-4 py-2.5 bg-[color:var(--d-ink-2)]/95 backdrop-blur border-t border-[color:var(--d-rule-strong)]">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            {(draft.status === 'idea' || draft.status === 'generating' || draft.status === 'error') && (
              <Button
                variant="secondary"
                disabled={!!busy || !draft.topic || !draft.format}
                onClick={() => run('regen', () => generateLMContent({ draft_id: draft.id, topic: draft.topic || '', format: draft.format || 'Checklist' }), 'Generation fired (~10 min)')}>
                {busy === 'regen' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Generate content <span className="text-[10px] text-zinc-500">~10 min</span>
              </Button>
            )}
            {isReview && (
              <Button
                variant="primary"
                disabled={!!busy}
                onClick={() => run('assets', () => buildLMAssets({ draft_id: draft.id, topic: draft.topic || '', format: draft.format || 'Checklist' }), 'Approved — building assets (~5 min)')}>
                {busy === 'assets' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Approve &amp; build assets
              </Button>
            )}
            {canSchedule && (
              <>
                <Input
                  type="datetime-local"
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                  title="Your local time. Leave empty to auto-pick the next free slot."
                  className="py-1.5 max-w-[220px]"
                />
                <Button
                  variant="primary"
                  disabled={!!busy}
                  onClick={async () => {
                    let iso: string;
                    if (when) {
                      iso = new Date(when).toISOString();
                    } else {
                      const slot = await findNextSlot();
                      iso = slot.toISOString();
                      setWhen(toDatetimeLocalString(slot));
                      toast.message(`Auto-scheduled for ${slot.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`);
                    }
                    run('schedule', () => scheduleLM(draft.id, iso), isScheduled ? 'Rescheduled' : 'Scheduled');
                  }}>
                  {busy === 'schedule' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />}{' '}
                  {isScheduled ? (when ? 'Update' : 'Reschedule · auto-slot') : (when ? 'Schedule' : 'Schedule · auto-slot')}
                </Button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <Button
              variant="ghost"
              className="text-red-400 hover:text-red-300 hover:bg-red-950/40"
              disabled={!!busy}
              title="Delete this lead magnet permanently"
              onClick={() => {
                if (!confirm(`Delete this lead magnet permanently? This can't be undone.`)) return;
                run('delete', async () => {
                  const { error } = await supabase.from('lm_drafts_v2').delete().eq('id', draft.id);
                  if (error) throw error;
                  onClose();
                }, 'Lead magnet deleted');
              }}>
              {busy === 'delete' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete
            </Button>
            <Button
              variant="secondary"
              disabled={!!busy || !dirty}
              onClick={() => run('save', saveAll, 'Saved')}>
              {busy === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadMagnetEditor;
