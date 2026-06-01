import React, { useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Save, CalendarClock, RefreshCw, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import type { CarouselDraft } from '../../hooks/useContentLibrary';
import { saveDraft, scheduleCarousel, buildCarousel } from '../../lib/studioActions';
import { toastError } from '../../lib/dashboardActions';
import AgentLogFeed from './AgentLogFeed';

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

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-200" title="Back">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-lg font-semibold text-zinc-100 truncate">{draft.title}</h2>
        <span className="ml-auto text-xs text-zinc-500">{draft.status}</span>
      </div>

      {qa && qa.verdict && qa.verdict !== 'PASS' && (
        <div className="rounded-md border border-amber-900/60 bg-amber-950/30 px-3 py-2 text-xs text-amber-300">
          QA: {qa.verdict}{qa.failing_slides?.length ? ` — slides ${qa.failing_slides.join(', ')}` : ''}{qa.feedback ? ` · ${qa.feedback}` : ''}
        </div>
      )}

      {/* Taxonomy row */}
      {(pillar || hookType || valueTier || source) && (
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
          {source && (
            <span className="text-zinc-500">via {source}</span>
          )}
        </div>
      )}

      {/* Flickable slide preview */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {draft.imageUrls.length === 0 && <div className="text-sm text-zinc-500">No slides rendered.</div>}
        {draft.imageUrls.map((url, i) => (
          <div key={i} className="flex-none w-[240px]">
            <img src={url} alt={`Slide ${i + 1}`} className="w-full rounded-md border border-zinc-800" />
            <div className="mt-1 text-center text-[11px] text-zinc-500">Slide {i + 1}</div>
          </div>
        ))}
      </div>

      {/* Copy editing */}
      <div className="space-y-3">
        <label className="block text-sm text-zinc-400">LinkedIn caption
          <textarea value={postBody} onChange={(e) => setPostBody(e.target.value)} rows={5}
            className="mt-1 w-full rounded-md bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-zinc-100" />
        </label>
        <label className="block text-sm text-zinc-400">Instagram caption
          <textarea value={igCaption} onChange={(e) => setIgCaption(e.target.value)} rows={3}
            className="mt-1 w-full rounded-md bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-zinc-100" />
        </label>
      </div>

      {/* Imagery accordion */}
      {hasImagery && (
        <div className="rounded-md border border-zinc-800">
          <button
            onClick={() => setImageryOpen((v) => !v)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
          >
            Imagery brief
            <span className="ml-auto text-zinc-500">{imageryOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
          </button>
          {imageryOpen && (
            <div className="border-t border-zinc-800 px-3 py-3 space-y-2 text-xs">
              {imageStyle && (
                <div><span className="text-zinc-500 mr-2">Style</span><span className="text-zinc-200">{imageStyle}</span></div>
              )}
              {imageDesc && (
                <div><span className="text-zinc-500 block mb-1">Description</span><div className="text-zinc-200 whitespace-pre-wrap">{imageDesc}</div></div>
              )}
              {visualLink && (
                <a href={visualLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300">
                  <ExternalLink className="w-3.5 h-3.5" /> Visual reference
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {/* Agent activity — full chronological log from the gen chain (Editorial → Hook → Content → QA → Image → IG Caption → Schedule → Publish) */}
      <AgentLogFeed entries={draft.agentLog} />

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => run('save draft', () => saveDraft({ id: draft.id, post_body: postBody, ig_caption: igCaption }), 'Saved')}
          disabled={!!busy}
          className="inline-flex items-center gap-2 rounded-md bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 px-3 py-2 text-sm text-zinc-100">
          {busy === 'save draft' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save copy
        </button>

        <button
          onClick={() => run('re-author', () => buildCarousel({ carousel_id: draft.id, topic: draft.topic || draft.title, draft_id: draft.id }), 'Re-authored')}
          disabled={!!busy}
          className="inline-flex items-center gap-2 rounded-md bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 px-3 py-2 text-sm text-zinc-100">
          {busy === 're-author' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Re-author (~2 min)
        </button>

        <div className="flex items-center gap-2 ml-auto">
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)}
            className="rounded-md bg-zinc-950 border border-zinc-800 px-2 py-1.5 text-sm text-zinc-100" />
          <button
            onClick={() => {
              if (!when) { toast.error('Pick a date/time'); return; }
              run('schedule', () => scheduleCarousel(draft.id, new Date(when).toISOString()), 'Scheduled');
            }}
            disabled={!!busy}
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-3 py-2 text-sm font-medium text-white">
            {busy === 'schedule' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />} Approve & schedule
          </button>
        </div>
      </div>
      <p className="text-[11px] text-zinc-600">Per-slide image regen is coming next; for now "Re-author" rebuilds all slides. Scheduling writes to the isolated v2 queue (won't publish until cutover).</p>
    </div>
  );
};

export default CarouselEditor;
