import React, { useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Save, CalendarClock, RefreshCw } from 'lucide-react';
import type { CarouselDraft } from '../../hooks/useContentLibrary';
import { saveDraft, scheduleCarousel, buildCarousel } from '../../lib/studioActions';
import { toastError } from '../../lib/dashboardActions';

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
