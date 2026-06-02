import React, { useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Save, CalendarClock, RefreshCw, ChevronDown, ChevronUp, ExternalLink, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CarouselDraft } from '../../hooks/useContentLibrary';
import { saveDraft, scheduleCarousel, buildCarousel, generatePostContent } from '../../lib/studioActions';
import { supabase } from '../../lib/supabase';
import { Sparkles } from 'lucide-react';
import { toastError } from '../../lib/dashboardActions';
import AgentLogFeed from './AgentLogFeed';
import QAVerdictPanel from './QAVerdictPanel';
import FieldGrid from './FieldGrid';
import PostMetricsPanel from './PostMetricsPanel';
import SourceBriefing from './SourceBriefing';
import { findNextSlot, toDatetimeLocalString } from '../../lib/findNextSlot';
import { useUpstreamSource } from '../../hooks/useUpstreamSource';
import { Card, CardLabel, Button, Input, Textarea, FieldLabel } from '../ui/primitives';
import PostPreview from '../ui/PostPreview';
import LinkedInPostPreview from '../ui/LinkedInPostPreview';

interface Props {
  draft: CarouselDraft;
  onClose: () => void;
  onChanged: () => void;
}

const CarouselEditor: React.FC<Props> = ({ draft, onClose, onChanged }) => {
  const [postBody, setPostBody] = useState(draft.postBody || '');
  const [igCaption, setIgCaption] = useState(draft.igCaption || '');
  const [when, setWhen] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [imageryOpen, setImageryOpen] = useState(false);
  const [postMode, setPostMode] = useState<'edit' | 'preview'>('edit');
  const [igMode, setIgMode] = useState<'edit' | 'preview'>('edit');
  const tax = (draft.taxonomy || {}) as Record<string, any>;
  const upstream = useUpstreamSource(tax);
  const pillar = tax.pillar as string | undefined;
  const hookType = tax.hook_type as string | undefined;
  const valueTier = tax.value_tier as string | undefined;
  const source = tax.source as string | undefined;
  const imageStyle = tax.image_style as string | undefined;
  const imageDesc = tax.image_description as string | undefined;
  const visualLink = tax.visual_content_link as string | undefined;
  const hasImagery = imageStyle || imageDesc || visualLink;

  async function run(label: string, fn: () => Promise<unknown>, successMsg: string) {
    setBusy(label);
    try { await fn(); toast.success(successMsg); onChanged(); }
    catch (err) { toastError(label, err); }
    finally { setBusy(null); }
  }

  // While THIS draft is generating, poll for updates every 15s so the editor
  // reflects status transitions (review/published/error) without a manual refresh.
  React.useEffect(() => {
    if (draft.status !== 'generating') return;
    const iv = setInterval(() => { onChanged(); }, 15_000);
    return () => clearInterval(iv);
  }, [draft.status, onChanged]);

  // Detect status transitions on THIS draft + fire a toast so the user notices
  // even when not looking at the right-card. Skip the initial mount.
  const prevStatusRef = React.useRef<string>(draft.status);
  React.useEffect(() => {
    if (prevStatusRef.current === draft.status) return;
    const from = prevStatusRef.current;
    const to = draft.status;
    prevStatusRef.current = to;
    // Friendly transition messages
    const msgs: Record<string, string> = {
      'idea>generating': 'Generation fired — agents drafting now',
      'generating>review': '✓ Generation complete — ready for review',
      'generating>error':  '⚠ Generation failed — see Agent activity for details',
      'review>scheduled':  '📅 Approved and scheduled',
      'review>approved':   '✓ Approved',
      'scheduled>published': '🚀 Published live on LinkedIn',
      'approved>scheduled': '📅 Scheduled',
    };
    const key = `${from}>${to}`;
    const message = msgs[key] || `Status: ${from} → ${to}`;
    toast.success(message, { duration: 5000 });
  }, [draft.status]);

  const qa = draft.qa;

  // Media-preview render (used inside the right column of the 2-col layout below).
  const renderMedia = () => {
    const urls = draft.imageUrls || [];
    const firstUrl = urls[0] || '';
    const isPdf = /\.pdf($|\?)|drive\.google\.com\/file\//i.test(firstUrl);
    if (isPdf) {
      const driveMatch = firstUrl.match(/drive\.google\.com\/file\/d\/([^/]+)/);
      const embedSrc = driveMatch ? `https://drive.google.com/file/d/${driveMatch[1]}/preview` : firstUrl;
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            <span className="uppercase tracking-wider text-emerald-500/70">Carousel PDF</span>
            <a href={firstUrl} target="_blank" rel="noreferrer" className="ml-auto text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1">
              <ExternalLink className="w-3 h-3" /> open
            </a>
          </div>
          <iframe src={embedSrc} className="w-full aspect-square rounded-md border border-zinc-800 bg-zinc-950" title="Carousel PDF preview" />
        </div>
      );
    }
    if (urls.length > 0) {
      return (
        <div className="grid grid-cols-2 gap-2">
          {urls.map((url, i) => (
            <div key={i} className="rounded-md border border-zinc-800 bg-zinc-950 overflow-hidden">
              <img src={url} alt={`Slide ${i + 1}`} className="w-full h-auto" />
              <div className="px-1 py-0.5 text-center text-[10px] text-zinc-500">{i + 1}</div>
            </div>
          ))}
        </div>
      );
    }
    if (draft.slides.length > 0) {
      return (
        <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
          {draft.slides.map((s, i) => {
            const title = s?.title || s?.headline || s?.hook || `Slide ${i + 1}`;
            const body  = s?.body || s?.content || s?.subtext || s?.image_prompt || '';
            return (
              <div key={i} className="rounded-md border border-zinc-800 bg-zinc-900/50 p-2.5">
                <div className="text-[10px] uppercase tracking-wider text-emerald-500/70 mb-1">Slide {i + 1}</div>
                <div className="text-[12.5px] font-medium text-zinc-200 leading-snug line-clamp-2">{title}</div>
                {body && <div className="mt-1 text-[11px] text-zinc-400 leading-snug line-clamp-4">{body}</div>}
              </div>
            );
          })}
        </div>
      );
    }
    return (
      <div className="rounded-md border border-dashed border-zinc-800 bg-zinc-950/40 p-6 text-center text-sm text-zinc-500 italic">
        No slides rendered yet — build will populate.
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-200" title="Back">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-lg font-semibold text-zinc-100 truncate flex-1">{draft.title}</h2>
        <span className="text-xs text-zinc-500">{draft.status}</span>
      </div>

      {/* Taxonomy chips — full width */}
      {(pillar || hookType || valueTier || source || draft.topicStrength || draft.renderEngine || draft.sourcePostId) && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {pillar && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/40 border border-emerald-900/40 px-2.5 py-0.5 text-emerald-300">
              <span className="text-emerald-500/60 text-[10px] uppercase">Pillar</span> {pillar}
            </span>
          )}
          {hookType && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-950/40 border border-sky-900/40 px-2.5 py-0.5 text-sky-300">
              <span className="text-sky-500/60 text-[10px] uppercase">Hook</span> {hookType}
            </span>
          )}
          {valueTier && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-950/40 border border-amber-900/40 px-2.5 py-0.5 text-amber-300">
              <span className="text-amber-500/60 text-[10px] uppercase">Tier</span> {valueTier}
            </span>
          )}
          {draft.topicStrength && (
            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800/60 border border-zinc-700/50 px-2.5 py-0.5 text-zinc-300">
              <span className="text-zinc-500 text-[10px] uppercase">Strength</span> {draft.topicStrength}
            </span>
          )}
          {source && <span className="text-[11px] text-zinc-500">via {source}</span>}
          {draft.renderEngine && <span className="text-[11px] text-zinc-500">render: {draft.renderEngine}</span>}
          {draft.sourcePostId && (
            <a
              href={draft.sourcePostId.startsWith('urn:li:activity:')
                ? `https://www.linkedin.com/feed/update/${draft.sourcePostId}/`
                : `https://www.linkedin.com/in/ivanmanfredi/`}
              target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-mono"
              title={draft.sourcePostId}
            >
              <ExternalLink className="w-3 h-3" /> on LinkedIn
            </a>
          )}
        </div>
      )}

      {/* 3-column ClickUp-style: left = editing surface, center = preview + actions,
          right = sticky agent activity rail (full height of the sheet). */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr_360px] gap-5">
        {/* LEFT COLUMN — context first (source), then copy editing */}
        <div className="space-y-4 min-w-0">
          {/* Source briefing on top — the raw material that fed generation. */}
          <SourceBriefing description={draft.description} upstream={upstream} defaultOpen />

          {/* QA verdict timeline */}
          <QAVerdictPanel entries={draft.agentLog} />
          {/* Final fallback for older drafts whose agent_log wasn't backfilled */}
          {qa && qa.verdict && !draft.agentLog.some((e) => /QA|HALT/i.test(e.agent)) && (
            <div className={`rounded-md border px-3 py-2 text-xs ${
              qa.verdict === 'PASS'
                ? 'border-emerald-900/60 bg-emerald-950/30 text-emerald-300'
                : 'border-amber-900/60 bg-amber-950/30 text-amber-300'
            }`}>
              QA: {qa.verdict}{qa.failing_slides?.length ? ` — slides ${qa.failing_slides.join(', ')}` : ''}{qa.feedback ? ` · ${qa.feedback}` : ''}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <FieldLabel className="!mb-0">LinkedIn caption</FieldLabel>
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
              <Textarea
                value={postBody}
                onChange={(e) => setPostBody(e.target.value)}
                rows={6}
                className="text-[13.5px] leading-relaxed"
              />
            ) : (
              <div className="rounded-md bg-zinc-950/80 border border-zinc-800 p-3">
                <LinkedInPostPreview
                  text={postBody}
                  mediaUrl={(() => {
                    const u = (draft.imageUrls && draft.imageUrls[0]) || null;
                    if (!u) return null;
                    // Drive URLs → thumbnail render
                    const m = u.match(/drive\.google\.com\/file\/d\/([^/]+)/);
                    return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w800` : u;
                  })()}
                />
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <FieldLabel className="!mb-0">Instagram caption</FieldLabel>
              <div className="inline-flex rounded-md bg-zinc-900 border border-zinc-800 p-0.5">
                <button
                  onClick={() => setIgMode('edit')}
                  className={`px-2 py-0.5 text-[11px] rounded transition-colors ${igMode === 'edit' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
                >Edit</button>
                <button
                  onClick={() => setIgMode('preview')}
                  className={`px-2 py-0.5 text-[11px] rounded transition-colors ${igMode === 'preview' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
                >Preview</button>
              </div>
              <span className="text-[10.5px] text-zinc-600 tabular-nums">{igCaption.length}</span>
            </div>
            {igMode === 'edit' ? (
              <Textarea
                value={igCaption}
                onChange={(e) => setIgCaption(e.target.value)}
                rows={3}
                className="text-[13px] leading-relaxed"
              />
            ) : (
              <div className="min-h-[100px] rounded-md bg-zinc-950 border border-zinc-800 px-3 py-2">
                <PostPreview text={igCaption} showFold={false} />
              </div>
            )}
          </div>

          <FieldGrid draft={draft} />
        </div>

        {/* RIGHT COLUMN — visual preview + scheduling + actions */}
        <div className="space-y-3 min-w-0">
          <Card>
            <CardLabel>Preview</CardLabel>
            {renderMedia()}
          </Card>

          <PostMetricsPanel draft={draft} />

          {hasImagery && (
            <Card padded={false}>
              <button
                onClick={() => setImageryOpen((v) => !v)}
                className="w-full flex items-center gap-2 px-3 py-2 text-[10px] uppercase tracking-[0.08em] text-zinc-500 font-semibold hover:bg-zinc-800/40 transition-colors"
              >
                Imagery brief
                <span className="ml-auto text-zinc-500">{imageryOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
              </button>
              {imageryOpen && (
                <div className="border-t border-zinc-800/60 px-3 py-2.5 space-y-1.5 text-xs">
                  {imageStyle && <div><span className="text-zinc-500 mr-2">Style</span><span className="text-zinc-200">{imageStyle}</span></div>}
                  {imageDesc && <div><span className="text-zinc-500 block mb-1">Description</span><div className="text-zinc-200 whitespace-pre-wrap">{imageDesc}</div></div>}
                  {visualLink && (
                    <a href={visualLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300">
                      <ExternalLink className="w-3.5 h-3.5" /> Visual reference
                    </a>
                  )}
                </div>
              )}
            </Card>
          )}

          {/* Right-column primary action card — driven by draft.status.
              State machine (matches the pipeline):
                idea / suggestion → Generate
                generating        → "In progress" + spinner + elapsed time
                review            → Approve (schedule + auto-slot)
                approved          → Approve (kept for re-scheduling)
                scheduled         → Reschedule (already approved, can shift date)
                published         → Already published (read-only)
                disqualified      → Restart (back to idea)
                error             → Retry generation
              Approve never shows during generation / before content exists.
              Wrapped in AnimatePresence so the card slides + fades when status
              changes — gives visible feedback for the workflow flipping under
              your feet. */}
          <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={draft.status}
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
          {(() => {
            const s = draft.status;
            const fireGenerate = async () => {
              const startedAt = new Date().toISOString();
              const nextTax = { ...(draft.taxonomy as any || {}), generating_started_at: startedAt };
              // Update first — and check the response. supabase queries return
              // { error } instead of throwing, so awaiting blindly was silent on failure.
              const { error: upErr } = await supabase.from('carousel_drafts').update({
                status: 'generating',
                taxonomy: nextTax,
              }).eq('id', draft.id);
              if (upErr) throw upErr;
              if (draft.type === 'carousel') {
                const carouselId = `studio-${(crypto.randomUUID?.() || String(Date.now())).slice(0, 12)}`;
                return buildCarousel({ carousel_id: carouselId, topic: draft.topic || draft.title || '', key_points: [] });
              }
              return generatePostContent({
                draft_id: draft.id,
                topic: draft.topic || draft.title || '',
                title: draft.title || draft.topic || '',
                author: 'Ivan',
                source: (tax.source as string) || 'Studio',
                post_format: draft.type === 'single_image' ? 'Single Image' : 'Text Post',
                post_format_details: draft.type === 'single_image' ? 'standard post with concept image' : 'standard text post',
                include_image: draft.type === 'single_image' ? 'Yes' : 'No',
                image_style: draft.type === 'single_image' ? ((tax.image_style as string) || 'Concept Visual') : undefined,
              });
            };

            if (s === 'idea' || s === 'suggestion') {
              return (
                <Card>
                  <CardLabel>Generate</CardLabel>
                  <p className="text-[11.5px] text-zinc-500 mb-2 leading-snug">
                    This post is a suggestion. Fire generation to draft the LinkedIn copy{draft.type === 'carousel' ? ' + carousel slides' : ''} (~{draft.type === 'carousel' ? '2 min' : '8 min'}).
                  </p>
                  <Button
                    variant="primary"
                    block
                    disabled={!!busy}
                    onClick={() => run('generate', fireGenerate, draft.type === 'carousel' ? 'Generation fired — building carousel (~2 min)' : 'Generation fired — drafting content (~8 min)')}
                  >
                    {busy === 'generate' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {busy === 'generate' ? 'Firing…' : 'Generate content'}
                  </Button>
                </Card>
              );
            }

            if (s === 'generating') {
              const startStr = (draft.taxonomy as any)?.generating_started_at as string | undefined;
              const elapsedMin = startStr ? Math.round((Date.now() - new Date(startStr).getTime()) / 60_000) : null;
              const stuck = elapsedMin !== null && elapsedMin >= 15;
              return (
                <Card>
                  <CardLabel>{stuck ? 'Generation stuck' : 'Generating'}</CardLabel>
                  <div className="flex items-center gap-2 mb-2">
                    {stuck
                      ? <AlertTriangle className="w-4 h-4 text-amber-400" />
                      : <Loader2 className="w-4 h-4 animate-spin text-sky-400" />}
                    <span className={`text-[12px] ${stuck ? 'text-amber-300' : 'text-sky-300'} font-medium`}>
                      {elapsedMin === null ? 'In progress' : stuck ? `${elapsedMin}m elapsed — likely failed silently` : `${elapsedMin}m elapsed`}
                    </span>
                  </div>
                  <p className="text-[11.5px] text-zinc-500 leading-snug mb-3">
                    Watch the Agent activity feed for live updates. Status will auto-flip to review when done.
                  </p>
                  {stuck && (
                    <Button
                      variant="secondary"
                      block
                      disabled={!!busy}
                      onClick={() => run('retry', fireGenerate, 'Retry fired')}
                    >
                      {busy === 'retry' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      Retry generation
                    </Button>
                  )}
                </Card>
              );
            }

            if (s === 'published') {
              return (
                <Card>
                  <CardLabel>Published</CardLabel>
                  <div className="text-[12px] text-emerald-300 font-medium mb-1">✓ Live on LinkedIn</div>
                  {draft.sourcePostId && (
                    <a
                      href={`https://www.linkedin.com/feed/update/${draft.sourcePostId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11.5px] text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" /> open on LinkedIn
                    </a>
                  )}
                </Card>
              );
            }

            if (s === 'disqualified') {
              return (
                <Card>
                  <CardLabel>Disqualified</CardLabel>
                  <p className="text-[11.5px] text-zinc-500 mb-2 leading-snug">
                    This post was disqualified. Restart to send it back through generation.
                  </p>
                  <Button
                    variant="secondary"
                    block
                    disabled={!!busy}
                    onClick={async () => {
                      run('restart', async () => {
                        const { error: upErr } = await supabase.from('carousel_drafts').update({ status: 'idea' }).eq('id', draft.id);
                        if (upErr) throw upErr;
                      }, 'Restarted — back to Suggestion');
                    }}
                  >
                    {busy === 'restart' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Restart
                  </Button>
                </Card>
              );
            }

            if (s === 'error') {
              return (
                <Card>
                  <CardLabel className="text-red-400">Error</CardLabel>
                  <p className="text-[11.5px] text-red-300 mb-2 leading-snug">
                    Last generation failed. Retry will refire generation.
                  </p>
                  <Button
                    variant="primary"
                    block
                    disabled={!!busy}
                    onClick={() => run('retry', fireGenerate, 'Retry fired')}
                  >
                    {busy === 'retry' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Retry generation
                  </Button>
                </Card>
              );
            }

            // review / approved / scheduled — Approve & schedule
            const isScheduled = s === 'scheduled';
            return (
              <Card>
                <CardLabel>{isScheduled ? 'Reschedule' : 'Schedule'}</CardLabel>
                <Input
                  type="datetime-local"
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                  title="Leave empty to auto-pick the next free 9am slot"
                  className="mb-2 py-1.5"
                />
                <Button
                  variant="primary"
                  block
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
                    run('schedule', () => scheduleCarousel(draft.id, iso), isScheduled ? 'Rescheduled' : 'Scheduled');
                  }}
                >
                  {busy === 'schedule' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />}
                  {isScheduled
                    ? (when ? 'Update schedule' : 'Reschedule · auto-slot')
                    : (when ? 'Approve & schedule' : 'Approve · auto-slot')}
                </Button>
              </Card>
            );
          })()}
          </motion.div>
          </AnimatePresence>

          <div className="space-y-2">
            <Button
              variant="secondary"
              block
              disabled={!!busy}
              onClick={() => run('save draft', () => saveDraft({ id: draft.id, post_body: postBody, ig_caption: igCaption }), 'Saved')}
            >
              {busy === 'save draft' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save copy
            </Button>
            <Button
              variant="secondary"
              block
              disabled={!!busy}
              onClick={() => run('re-author', () => buildCarousel({ carousel_id: draft.id, topic: draft.topic || draft.title, draft_id: draft.id }), 'Re-authored')}
            >
              {busy === 're-author' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Re-author <span className="text-[10px] text-zinc-500">~2 min</span>
            </Button>
          </div>
        </div>

        {/* RIGHT RAIL — sticky agent activity (ClickUp-style activity feed) */}
        <div className="min-w-0">
          <div className="lg:sticky lg:top-2">
            <AgentLogFeed
              entries={draft.agentLog}
              table="carousel_drafts"
              rowId={draft.id}
              onNoteAdded={onChanged}
              defaultOpen
              renderMarkdown
            />
          </div>
        </div>
      </div>

      <p className="text-[11px] text-zinc-600">Per-slide image regen is coming next; for now "Re-author" rebuilds all slides. Scheduling writes to the isolated v2 queue (won't publish until cutover).</p>
    </div>
  );
};

export default CarouselEditor;
