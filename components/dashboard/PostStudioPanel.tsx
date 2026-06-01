import React, { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Loader2, RefreshCw, FileText, ChevronDown, ChevronUp, Calendar, LayoutGrid, Columns3, List as ListIcon } from 'lucide-react';
import { useContentLibrary, type CarouselDraft } from '../../hooks/useContentLibrary';
import { generatePostContent, buildCarousel } from '../../lib/studioActions';
import { toastError } from '../../lib/dashboardActions';
import { supabase } from '../../lib/supabase';
import CarouselEditor from './CarouselEditor';
import { StudioListView } from './StudioListView';

type PostType = 'text' | 'single_image' | 'carousel';

const TYPE_LABELS: Record<PostType, string> = {
  text: 'Text post',
  single_image: 'Single image',
  carousel: 'Carousel',
};

// Status -> { dot color, text class } — colored dot in front of label is the scan anchor
const STATUS_META: Record<string, { dot: string; label: string }> = {
  draft:        { dot: 'bg-zinc-500',   label: 'text-zinc-300' },
  idea:         { dot: 'bg-zinc-400',   label: 'text-zinc-300' },
  generating:   { dot: 'bg-sky-400',    label: 'text-sky-300' },
  review:       { dot: 'bg-amber-400',  label: 'text-amber-300' },
  approved:     { dot: 'bg-emerald-400',label: 'text-emerald-300' },
  ready:        { dot: 'bg-emerald-400',label: 'text-emerald-300' },
  scheduled:    { dot: 'bg-sky-400',    label: 'text-sky-300' },
  published:    { dot: 'bg-zinc-500',   label: 'text-zinc-400' },
  disqualified: { dot: 'bg-zinc-600',   label: 'text-zinc-500' },
  error:        { dot: 'bg-red-500',    label: 'text-red-400' },
};

const STATUS_ORDER = ['idea', 'generating', 'review', 'approved', 'scheduled', 'published', 'disqualified', 'error'];
// Always-pinned triage states — show even at 0 so Ivan gets the "nothing broken" signal at a glance.
const PINNED_STATUSES = new Set(['generating', 'review', 'error']);

function formatScheduled(iso: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) + ' ' +
           d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

function postExcerpt(d: CarouselDraft): string {
  const src = (d.postBody || d.topic || d.title || '').replace(/\s+/g, ' ').trim();
  return src.slice(0, 140);
}

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
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'auto' | 'updated' | 'scheduled'>('auto');
  const [formOpen, setFormOpen] = useState(false);
  const [view, setView] = useState<'grid' | 'board' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      const v = localStorage.getItem('post-studio-view');
      if (v === 'board' || v === 'grid' || v === 'list') return v;
    }
    return 'list';
  });
  React.useEffect(() => { try { localStorage.setItem('post-studio-view', view); } catch {} }, [view]);

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
  // Effective sort: auto -> 'scheduled' when scheduled filter active, else 'updated'.
  const effectiveSort: 'updated' | 'scheduled' = sortBy === 'auto'
    ? (statusFilter === 'scheduled' ? 'scheduled' : 'updated')
    : sortBy;
  const visible = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = drafts.filter((d) => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      if (typeFilter !== 'all' && (d.type || 'unknown') !== typeFilter) return false;
      if (q) {
        const hay = `${d.title || ''} ${d.topic || ''} ${d.postBody || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return filtered.sort((a, b) => {
      if (effectiveSort === 'scheduled') {
        const av = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
        const bv = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
        // For scheduled view: soonest-upcoming first (ascending), past at bottom
        if (statusFilter === 'scheduled') return av - bv;
        return bv - av;
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [drafts, statusFilter, typeFilter, searchQuery, effectiveSort]);

  const open = drafts.find((d) => d.id === openId) || null;

  async function handleCreate() {
    if (!topic.trim()) { toast.error('Enter a topic'); return; }
    setCreating(true);
    try {
      if (type === 'carousel') {
        const carouselId = `studio-${(crypto.randomUUID?.() || String(Date.now())).slice(0, 12)}`;
        const r = await buildCarousel({
          carousel_id: carouselId,
          topic: topic.trim(),
          key_points: keyPoints.split('\n').map((s) => s.trim()).filter(Boolean),
        });
        toast.success(`Built — ${r.verdict} (${r.attempts} attempt${r.attempts > 1 ? 's' : ''})`);
        if (r.draft_id) setOpenId(r.draft_id);
      } else {
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
        toast.success('Generation fired (~8 min). Status will move to review when done.');
        setOpenId(draftId);
      }
      setTopic(''); setDetails(''); setKeyPoints('');
      setFormOpen(false);
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

  // Pinned + present statuses, ordered.
  const visibleStatuses = STATUS_ORDER.filter((s) => statusCounts[s] || PINNED_STATUSES.has(s));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <FileText className="w-5 h-5 text-emerald-400" />
        <h2 className="text-lg font-semibold text-zinc-100">Posts</h2>
        <span className="text-xs text-zinc-500">— text, single-image, carousel</span>
        <div className="ml-auto flex items-center gap-1">
          <div className="inline-flex rounded-md bg-zinc-900 border border-zinc-800 p-0.5">
            <button
              onClick={() => setView('list')}
              className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded ${view === 'list' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
              title="List view (grouped by status)"
            ><ListIcon className="w-3.5 h-3.5" /> List</button>
            <button
              onClick={() => setView('grid')}
              className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded ${view === 'grid' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
              title="Grid view"
            ><LayoutGrid className="w-3.5 h-3.5" /> Grid</button>
            <button
              onClick={() => setView('board')}
              className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded ${view === 'board' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
              title="Board view (kanban by status)"
            ><Columns3 className="w-3.5 h-3.5" /> Board</button>
          </div>
          <button onClick={refresh} className="p-2 text-zinc-400 hover:text-zinc-200" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* New post — collapsed by default */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50">
        <button
          onClick={() => setFormOpen((v) => !v)}
          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-900"
        >
          <Plus className="w-4 h-4 text-emerald-400" />
          New post
          <span className="ml-auto text-zinc-500">{formOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
        </button>
        {formOpen && (
          <div className="px-4 pb-4 space-y-3 border-t border-zinc-800/60">
            <div className="flex items-center gap-2 text-xs pt-3">
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
        )}
      </div>

      {/* Filters / sort */}
      {drafts.length > 0 && (
        <div className="space-y-2 text-xs">
          {/* Topic search — substring match on title / topic / post body */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by topic or body…"
            className="w-full rounded-md bg-zinc-950 border border-zinc-800 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
          />
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-zinc-500 mr-1">Status</span>
            {(['all', ...visibleStatuses] as const).map((s) => {
              const count = statusCounts[s] || 0;
              const isPinned = s !== 'all' && PINNED_STATUSES.has(s);
              const isCritical = s === 'error' && count > 0;
              const isActive = statusFilter === s;
              const dot = s === 'all' ? null : STATUS_META[s]?.dot;
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 transition ${
                    isActive ? 'bg-emerald-600 text-white' :
                    isCritical ? 'bg-red-900/40 text-red-300 hover:bg-red-900/60' :
                    isPinned && count === 0 ? 'bg-zinc-900 text-zinc-500 hover:bg-zinc-800' :
                    'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  {dot && <span className={`inline-block w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white' : dot}`} />}
                  {s === 'all' ? 'All' : s} <span className="opacity-60">{count}</span>
                </button>
              );
            })}
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
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'auto' | 'updated' | 'scheduled')}
                className="ml-1 rounded bg-zinc-950 border border-zinc-800 px-2 py-0.5 text-zinc-200"
              >
                <option value="auto">Smart ({effectiveSort === 'scheduled' ? 'scheduled' : 'last updated'})</option>
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
      ) : view === 'list' ? (
        <StudioListView
          rows={visible.map((d) => {
            const tax = (d.taxonomy as any) || {};
            const imageThumb = (d.imageUrls && d.imageUrls[0]) || null;
            // Drive PDFs aren't directly img-renderable; skip thumb for those
            const isPdfThumb = imageThumb && /drive\.google\.com\/file\//.test(imageThumb);
            return {
              id: d.id,
              title: d.title || d.topic || '(untitled)',
              excerpt: d.postBody ? postExcerpt(d) : undefined,
              status: d.status,
              thumbUrl: isPdfThumb ? null : imageThumb,
              kicker: d.type === 'carousel' ? 'CAR' : d.type === 'single_image' ? 'IMG' : 'TXT',
              date: formatScheduled(d.scheduledAt) || undefined,
              dateSort: d.scheduledAt ? new Date(d.scheduledAt).getTime() : new Date(d.updatedAt).getTime(),
              pillar: tax.pillar,
              hookType: tax.hook_type,
              valueTier: tax.value_tier,
              source: tax.source,
              formatLabel: d.type || undefined,
              topicStrength: d.topicStrength || undefined,
            };
          })}
          statusMeta={STATUS_META}
          onOpen={setOpenId}
        />
      ) : view === 'board' ? (
        <div className="flex gap-3 overflow-x-auto pb-3 -mx-2 px-2 snap-x">
          {visibleStatuses.map((status) => {
            const col = visible.filter((d) => d.status === status);
            const meta = STATUS_META[status] || STATUS_META.draft;
            return (
              <div key={status} className="flex-none w-[160px] snap-start rounded-md border border-zinc-800 bg-zinc-950/40 flex flex-col max-h-[75vh]">
                <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-zinc-800 sticky top-0 bg-zinc-950/80 backdrop-blur">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                  <span className={`text-[10.5px] font-medium uppercase tracking-wider ${meta.label} truncate`}>{status}</span>
                  <span className="ml-auto text-[10px] text-zinc-500 font-mono">{col.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-1.5 space-y-1.5">
                  {col.length === 0 ? (
                    <div className="text-[10px] text-zinc-700 italic py-1.5 text-center">—</div>
                  ) : col.map((d: CarouselDraft) => {
                    const sched = formatScheduled(d.scheduledAt);
                    return (
                      <button
                        key={d.id}
                        onClick={() => setOpenId(d.id)}
                        className="w-full text-left rounded border border-zinc-800/70 bg-zinc-900/60 hover:border-zinc-600 hover:bg-zinc-900 transition px-1.5 py-1.5"
                      >
                        <div className="text-[11.5px] text-zinc-200 line-clamp-3 leading-tight">{d.title}</div>
                        {sched && (
                          <div className="mt-1 flex items-center gap-1 text-[9.5px] text-zinc-500">
                            <Calendar className="w-2.5 h-2.5" /> {sched}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {visible.map((d: CarouselDraft) => {
            const meta = STATUS_META[d.status] || STATUS_META.draft;
            const pillar = (d.taxonomy as any)?.pillar;
            const hookType = (d.taxonomy as any)?.hook_type;
            const sched = formatScheduled(d.scheduledAt);
            const hasImage = d.imageUrls && d.imageUrls[0];
            const excerpt = postExcerpt(d);
            return (
              <button
                key={d.id}
                onClick={() => setOpenId(d.id)}
                className="text-left rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-hidden hover:border-zinc-600 transition flex flex-col"
              >
                {/* Hero: image if present, else stylized excerpt (no more gray TEXT placeholder) */}
                {hasImage ? (
                  <div className="aspect-[4/5] bg-zinc-950 overflow-hidden">
                    <img src={d.imageUrls[0]} alt="" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="aspect-[4/5] bg-emerald-950/30 border-b border-emerald-900/30 overflow-hidden p-4 flex flex-col justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-emerald-500/70 font-mono">{d.type === 'carousel' ? 'CAROUSEL' : d.type === 'single_image' ? 'IMAGE' : 'TEXT'}</span>
                    <p className="text-[13px] text-zinc-300 leading-snug line-clamp-7 font-serif italic">{excerpt || '(no copy yet)'}</p>
                  </div>
                )}
                {/* Body */}
                <div className="p-3 space-y-1.5 flex-1">
                  <div className="text-sm text-zinc-200 line-clamp-2 font-medium">{d.title}</div>
                  {sched && (
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                      <Calendar className="w-3 h-3" /> {sched}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className={`inline-flex items-center gap-1 text-[11px] ${meta.label}`}>
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                      {d.status}
                    </span>
                    {pillar && <span className="text-[11px] text-zinc-500 px-1.5 py-0.5 rounded bg-zinc-800/60">{pillar}</span>}
                    {hookType && <span className="text-[11px] text-zinc-500 px-1.5 py-0.5 rounded bg-zinc-800/60">{hookType}</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PostStudioPanel;
