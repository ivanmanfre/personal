import React, { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Loader2, RefreshCw, FileText } from 'lucide-react';
import { useContentLibrary, type CarouselDraft } from '../../hooks/useContentLibrary';
import { generatePostContent, buildCarousel } from '../../lib/studioActions';
import { toastError } from '../../lib/dashboardActions';
import { supabase } from '../../lib/supabase';
import CarouselEditor from './CarouselEditor';

type PostType = 'text' | 'single_image' | 'carousel';

const TYPE_LABELS: Record<PostType, string> = {
  text: 'Text post',
  single_image: 'Single image',
  carousel: 'Carousel',
};

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-zinc-700/60 text-zinc-300',
  generating: 'bg-sky-900/50 text-sky-300',
  qa_review: 'bg-amber-900/50 text-amber-300',
  ready: 'bg-emerald-900/50 text-emerald-300',
  scheduled: 'bg-sky-900/50 text-sky-300',
  published: 'bg-zinc-800 text-zinc-400',
  failed: 'bg-red-900/50 text-red-300',
};

const STATUS_ORDER = ['idea', 'generating', 'qa_review', 'approved', 'scheduled', 'published', 'disqualified', 'error'];

const PostStudioPanel: React.FC = () => {
  const { drafts, loading, refresh } = useContentLibrary();
  const [type, setType] = useState<PostType>('text');
  const [topic, setTopic] = useState('');
  const [details, setDetails] = useState('');
  const [keyPoints, setKeyPoints] = useState('');
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'updated' | 'scheduled'>('updated');

  // Filter + sort
  const statusCounts = React.useMemo(() => {
    const counts: Record<string, number> = { all: drafts.length };
    for (const d of drafts) counts[d.status] = (counts[d.status] || 0) + 1;
    return counts;
  }, [drafts]);
  const typeCounts = React.useMemo(() => {
    const counts: Record<string, number> = { all: drafts.length };
    for (const d of drafts) {
      const k = d.type || 'unknown';
      counts[k] = (counts[k] || 0) + 1;
    }
    return counts;
  }, [drafts]);
  const visible = React.useMemo(() => {
    const filtered = drafts.filter((d) => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      if (typeFilter !== 'all' && (d.type || 'unknown') !== typeFilter) return false;
      return true;
    });
    return filtered.sort((a, b) => {
      if (sortBy === 'scheduled') {
        const av = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
        const bv = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
        return bv - av;
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [drafts, statusFilter, typeFilter, sortBy]);

  const open = drafts.find((d) => d.id === openId) || null;

  async function handleCreate() {
    if (!topic.trim()) { toast.error('Enter a topic'); return; }
    setCreating(true);
    try {
      if (type === 'carousel') {
        // Carousel: direct render via /carousel/build (Claude author + Chrome render + Gemini QA)
        const carouselId = `studio-${(crypto.randomUUID?.() || String(Date.now())).slice(0, 12)}`;
        const r = await buildCarousel({
          carousel_id: carouselId,
          topic: topic.trim(),
          key_points: keyPoints.split('\n').map((s) => s.trim()).filter(Boolean),
        });
        toast.success(`Built — ${r.verdict} (${r.attempts} attempt${r.attempts > 1 ? 's' : ''})`);
        if (r.draft_id) setOpenId(r.draft_id);
      } else {
        // Text/single-image: studio pre-creates row + fires post-gen-v2 webhook (~8 min)
        const { data, error } = await supabase
          .from('carousel_drafts')
          .insert({ topic: topic.trim(), type, status: 'generating' })
          .select('id')
          .single();
        if (error) throw error;
        const draftId = data.id as string;
        await generatePostContent({
          draft_id: draftId,
          topic: topic.trim(),
          title: topic.trim(),
          author: 'Ivan',
          source: 'Studio',
          post_format: type === 'single_image' ? 'Single Image' : 'Text Post',
          post_format_details: details.trim() || (type === 'single_image' ? 'standard post with concept image' : 'standard text post'),
          include_image: type === 'single_image' ? 'Yes' : 'No',
          image_style: type === 'single_image' ? 'Concept Visual' : undefined,
        });
        toast.success('Generation fired (~8 min). Status will move to qa_review when done.');
        setOpenId(draftId);
      }
      setTopic(''); setDetails(''); setKeyPoints('');
      await refresh();
    } catch (err) {
      toastError('create post', err);
    } finally {
      setCreating(false);
    }
  }

  if (open) {
    return <CarouselEditor draft={open} onClose={() => setOpenId(null)} onChanged={refresh} />;
  }

  const buttonLabel = creating
    ? (type === 'carousel' ? 'Building carousel…' : 'Firing…')
    : (type === 'carousel' ? 'Build carousel (~2 min)' : `Generate ${type === 'single_image' ? 'single-image' : 'text'} post (~8 min)`);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <FileText className="w-5 h-5 text-emerald-400" />
        <h2 className="text-lg font-semibold text-zinc-100">Posts</h2>
        <span className="text-xs text-zinc-500">— text, single-image, carousel</span>
        <button onClick={refresh} className="ml-auto p-2 text-zinc-400 hover:text-zinc-200" title="Refresh">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* New post */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
        <div className="text-sm font-medium text-zinc-300">New post</div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-zinc-400">Type</span>
          {(['text','single_image','carousel'] as PostType[]).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`rounded px-3 py-1 ${type === t ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
            >{TYPE_LABELS[t]}</button>
          ))}
        </div>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder={type === 'carousel' ? 'Topic — e.g. Why hiring more people made your firm slower' : "Topic — e.g. Stop hiring to fix a process you haven't automated yet"}
          className="w-full rounded-md bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600"
        />
        {type === 'carousel' ? (
          <textarea
            value={keyPoints}
            onChange={(e) => setKeyPoints(e.target.value)}
            placeholder="Key points (one per line, optional)"
            rows={3}
            className="w-full rounded-md bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600"
          />
        ) : (
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Post format details (optional)"
            rows={2}
            className="w-full rounded-md bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600"
          />
        )}
        <button
          onClick={handleCreate}
          disabled={creating}
          className="inline-flex items-center gap-2 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {buttonLabel}
        </button>
      </div>

      {/* Filters / sort */}
      {drafts.length > 0 && (
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-zinc-500 mr-1">Status</span>
            {(['all', ...STATUS_ORDER.filter((s) => statusCounts[s])] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-full px-2.5 py-1 transition ${statusFilter === s ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
              >
                {s === 'all' ? 'All' : s} <span className="opacity-60">{statusCounts[s] || 0}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-zinc-500 mr-1">Type</span>
            {(['all', 'text', 'single_image', 'carousel'] as const).filter((t) => t === 'all' || typeCounts[t]).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`rounded-full px-2.5 py-1 transition ${typeFilter === t ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
              >
                {t === 'all' ? 'All' : t === 'single_image' ? 'single image' : t} <span className="opacity-60">{typeCounts[t] || 0}</span>
              </button>
            ))}
            <span className="ml-auto text-zinc-500">
              Sort:
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'updated' | 'scheduled')}
                className="ml-1 rounded bg-zinc-950 border border-zinc-800 px-2 py-0.5 text-zinc-200">
                <option value="updated">Last updated</option>
                <option value="scheduled">Scheduled date</option>
              </select>
            </span>
          </div>
        </div>
      )}

      {/* Library — filtered */}
      {loading && drafts.length === 0 ? (
        <div className="text-sm text-zinc-500">Loading…</div>
      ) : drafts.length === 0 ? (
        <div className="text-sm text-zinc-500">No posts yet — create one above.</div>
      ) : visible.length === 0 ? (
        <div className="text-sm text-zinc-500">No posts match the current filter.</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {visible.map((d: CarouselDraft) => (
            <button
              key={d.id}
              onClick={() => setOpenId(d.id)}
              className="text-left rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-hidden hover:border-zinc-600 transition"
            >
              <div className="aspect-[4/5] bg-zinc-950 overflow-hidden">
                {d.imageUrls[0]
                  ? <img src={d.imageUrls[0]} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-zinc-700 text-xs">{d.type === 'text' ? 'TEXT' : d.type === 'single_image' ? 'IMAGE' : d.type === 'carousel' ? 'CAROUSEL' : '—'}</div>}
              </div>
              <div className="p-3 space-y-2">
                <div className="text-sm text-zinc-200 line-clamp-2">{d.title}</div>
                <div className="flex items-center gap-2">
                  <span className={`inline-block rounded px-2 py-0.5 text-[11px] ${STATUS_STYLE[d.status] || STATUS_STYLE.draft}`}>
                    {d.status}
                  </span>
                  {d.type && <span className="text-[11px] text-zinc-500">{d.type === 'single_image' ? 'single image' : d.type}</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default PostStudioPanel;
