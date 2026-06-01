import React, { useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Save, CalendarClock, RefreshCw, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import type { CarouselDraft } from '../../hooks/useContentLibrary';
import { saveDraft, scheduleCarousel, buildCarousel } from '../../lib/studioActions';
import { toastError } from '../../lib/dashboardActions';
import AgentLogFeed from './AgentLogFeed';
import SourceBriefing from './SourceBriefing';
import { findNextSlot, toDatetimeLocalString } from '../../lib/findNextSlot';

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
  const tax = (draft.taxonomy || {}) as Record<string, any>;
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

      {/* 2-column body: left = editing surface, right = preview + actions */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5">
        {/* LEFT COLUMN — copy editing + context */}
        <div className="space-y-4 min-w-0">
          {qa && qa.verdict && (
            <div className={`rounded-md border px-3 py-2 text-xs ${
              qa.verdict === 'PASS'
                ? 'border-emerald-900/60 bg-emerald-950/30 text-emerald-300'
                : 'border-amber-900/60 bg-amber-950/30 text-amber-300'
            }`}>
              QA: {qa.verdict}{qa.failing_slides?.length ? ` — slides ${qa.failing_slides.join(', ')}` : ''}{qa.feedback ? ` · ${qa.feedback}` : ''}
            </div>
          )}

          <label className="block text-xs font-medium uppercase tracking-wider text-zinc-500">
            LinkedIn caption
            <textarea
              value={postBody}
              onChange={(e) => setPostBody(e.target.value)}
              rows={10}
              className="mt-1.5 w-full rounded-md bg-zinc-950 border border-zinc-800 px-3 py-2 text-[13.5px] text-zinc-100 leading-relaxed focus:outline-none focus:border-zinc-600"
            />
          </label>

          <label className="block text-xs font-medium uppercase tracking-wider text-zinc-500">
            Instagram caption
            <textarea
              value={igCaption}
              onChange={(e) => setIgCaption(e.target.value)}
              rows={4}
              className="mt-1.5 w-full rounded-md bg-zinc-950 border border-zinc-800 px-3 py-2 text-[13px] text-zinc-100 leading-relaxed focus:outline-none focus:border-zinc-600"
            />
          </label>

          <SourceBriefing description={draft.description} />

          <AgentLogFeed
            entries={draft.agentLog}
            table="carousel_drafts"
            rowId={draft.id}
            onNoteAdded={onChanged}
          />
        </div>

        {/* RIGHT COLUMN — visual preview + scheduling + actions */}
        <div className="space-y-4 min-w-0">
          <div className="rounded-md border border-zinc-800/60 bg-zinc-900/30 p-3 space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Preview</div>
            {renderMedia()}
          </div>

          {hasImagery && (
            <div className="rounded-md border border-zinc-800/60 bg-zinc-900/30">
              <button
                onClick={() => setImageryOpen((v) => !v)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs uppercase tracking-wider text-zinc-500 font-medium hover:bg-zinc-900"
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
            </div>
          )}

          {/* Scheduling block — own card, prominent */}
          <div className="rounded-md border border-zinc-800/60 bg-zinc-900/30 p-3 space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Schedule</div>
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="w-full rounded-md bg-zinc-950 border border-zinc-800 px-2 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-zinc-600"
              title="Leave empty to auto-pick the next free 9am slot"
            />
            <button
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
                run('schedule', () => scheduleCarousel(draft.id, iso), 'Scheduled');
              }}
              disabled={!!busy}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-3 py-2 text-sm font-medium text-white"
            >
              {busy === 'schedule' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />}
              {when ? 'Approve & schedule' : 'Approve · auto-slot'}
            </button>
          </div>

          {/* Secondary actions */}
          <div className="space-y-2">
            <button
              onClick={() => run('save draft', () => saveDraft({ id: draft.id, post_body: postBody, ig_caption: igCaption }), 'Saved')}
              disabled={!!busy}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 px-3 py-2 text-sm text-zinc-200 border border-zinc-700/40">
              {busy === 'save draft' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save copy
            </button>
            <button
              onClick={() => run('re-author', () => buildCarousel({ carousel_id: draft.id, topic: draft.topic || draft.title, draft_id: draft.id }), 'Re-authored')}
              disabled={!!busy}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 px-3 py-2 text-sm text-zinc-200 border border-zinc-700/40">
              {busy === 're-author' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Re-author <span className="text-[10px] text-zinc-500">~2 min</span>
            </button>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-zinc-600">Per-slide image regen is coming next; for now "Re-author" rebuilds all slides. Scheduling writes to the isolated v2 queue (won't publish until cutover).</p>
    </div>
  );
};

export default CarouselEditor;
