import React, { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Loader2, RefreshCw, Layers } from 'lucide-react';
import { useContentLibrary, type CarouselDraft } from '../../hooks/useContentLibrary';
import { buildCarousel } from '../../lib/studioActions';
import { toastError } from '../../lib/dashboardActions';
import CarouselEditor from './CarouselEditor';

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-zinc-700/60 text-zinc-300',
  review: 'bg-amber-900/50 text-amber-300',
  ready: 'bg-emerald-900/50 text-emerald-300',
  scheduled: 'bg-sky-900/50 text-sky-300',
  published: 'bg-zinc-800 text-zinc-400',
  failed: 'bg-red-900/50 text-red-300',
};

const CarouselStudioPanel: React.FC = () => {
  const { drafts: allDrafts, loading, refresh } = useContentLibrary();
  // Show only carousels here; text + single-image live in Post Studio
  const drafts = allDrafts.filter((d) => d.type === 'carousel' || (!d.type && d.imageUrls.length > 1));
  const [topic, setTopic] = useState('');
  const [keyPoints, setKeyPoints] = useState('');
  const [building, setBuilding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const open = drafts.find((d) => d.id === openId) || null;

  async function handleBuild() {
    if (!topic.trim()) { toast.error('Enter a topic'); return; }
    setBuilding(true);
    try {
      const carouselId = `studio-${(crypto.randomUUID?.() || String(Date.now())).slice(0, 12)}`;
      const r = await buildCarousel({
        carousel_id: carouselId,
        topic: topic.trim(),
        key_points: keyPoints.split('\n').map((s) => s.trim()).filter(Boolean),
      });
      toast.success(`Built — ${r.verdict} (${r.attempts} attempt${r.attempts > 1 ? 's' : ''})`);
      setTopic(''); setKeyPoints('');
      await refresh();
      if (r.draft_id) setOpenId(r.draft_id);
    } catch (err) {
      toastError('build carousel', err);
    } finally {
      setBuilding(false);
    }
  }

  if (open) {
    return <CarouselEditor draft={open} onClose={() => setOpenId(null)} onChanged={refresh} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Layers className="w-5 h-5 text-emerald-400" />
        <h2 className="text-lg font-semibold text-zinc-100">Carousel Studio</h2>
        <button onClick={refresh} className="ml-auto p-2 text-zinc-400 hover:text-zinc-200" title="Refresh">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* New carousel */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
        <div className="text-sm font-medium text-zinc-300">New carousel</div>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Topic — e.g. Why hiring more people made your firm slower"
          className="w-full rounded-md bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600"
        />
        <textarea
          value={keyPoints}
          onChange={(e) => setKeyPoints(e.target.value)}
          placeholder="Key points (one per line, optional)"
          rows={3}
          className="w-full rounded-md bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600"
        />
        <button
          onClick={handleBuild}
          disabled={building}
          className="inline-flex items-center gap-2 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white"
        >
          {building ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {building ? 'Building (~2 min)…' : 'Build carousel'}
        </button>
      </div>

      {/* Library */}
      {loading && drafts.length === 0 ? (
        <div className="text-sm text-zinc-500">Loading…</div>
      ) : drafts.length === 0 ? (
        <div className="text-sm text-zinc-500">No carousels yet — build one above.</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {drafts.map((d: CarouselDraft) => (
            <button
              key={d.id}
              onClick={() => setOpenId(d.id)}
              className="text-left rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-hidden hover:border-zinc-600 transition"
            >
              <div className="aspect-[4/5] bg-zinc-950 overflow-hidden">
                {d.imageUrls[0] && <img src={d.imageUrls[0]} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="p-3 space-y-2">
                <div className="text-sm text-zinc-200 line-clamp-2">{d.title}</div>
                <span className={`inline-block rounded px-2 py-0.5 text-[11px] ${STATUS_STYLE[d.status] || STATUS_STYLE.draft}`}>
                  {d.status}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CarouselStudioPanel;
