import React, { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Loader2, RefreshCw, FileText, ChevronDown, ChevronUp, Calendar, LayoutGrid, Columns3, List as ListIcon, Table2 } from 'lucide-react';
import { useContentLibrary, type CarouselDraft } from '../../hooks/useContentLibrary';
import { generatePostContent, buildCarousel } from '../../lib/studioActions';
import { toastError } from '../../lib/dashboardActions';
import { supabase } from '../../lib/supabase';
import CarouselEditor from './CarouselEditor';
import { StudioListView } from './StudioListView';
import Sheet from '../ui/Sheet';
import { driveThumbUrl } from '../../lib/driveThumb';
import { statusLabel, POST_STATUSES } from '../../lib/statusLabels';

type PostType = 'text' | 'single_image' | 'carousel';

const TYPE_LABELS: Record<PostType, string> = {
  text: 'Text post',
  single_image: 'Single image',
  carousel: 'Carousel',
};

// Status -> { dot color, text class } — colored dot in front of label is the scan anchor
const STATUS_META: Record<string, { dot: string; label: string }> = {
  draft:         { dot: 'bg-zinc-500',   label: 'text-zinc-300' },
  idea:          { dot: 'bg-zinc-400',   label: 'text-zinc-300' },
  generating:    { dot: 'bg-sky-400',    label: 'text-sky-300' },
  review:        { dot: 'bg-amber-400',  label: 'text-amber-300' },
  approved:      { dot: 'bg-emerald-400',label: 'text-emerald-300' },
  scheduled:     { dot: 'bg-sky-400',    label: 'text-sky-300' },
  published:     { dot: 'bg-zinc-500',   label: 'text-zinc-400' },
  disqualified:  { dot: 'bg-zinc-600',   label: 'text-zinc-500' },
  error:         { dot: 'bg-red-500',    label: 'text-red-400' },
};

// STATUS_ORDER comes from lib/statusLabels.ts so it stays in sync with labels.
const STATUS_ORDER = POST_STATUSES;
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

interface PostStudioPanelProps {
  /** Restrict the panel to a subset of post types. Used to split Carousels
   *  into its own sub-tab — Posts shows ['text','single_image'], Carousels
   *  shows ['carousel']. When undefined, all types render. */
  restrictTypes?: ('text' | 'single_image' | 'carousel')[];
  /** Override the panel title (default: 'Posts'). */
  title?: string;
  /** Override the title subline. */
  subtitle?: string;
}

const PostStudioPanel: React.FC<PostStudioPanelProps> = ({ restrictTypes, title = 'Posts', subtitle = 'text · single-image · carousel' }) => {
  const { drafts, loading, refresh, applyOptimistic, applyOptimisticMany, applyOptimisticDelete } = useContentLibrary();
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
  // Disqualified rows hidden by default — Ivan never wants to scroll past 33 dead drafts.
  // Toggle exposed as a small footer button. Persists across sessions.
  const [showDisqualified, setShowDisqualified] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('post-studio-show-disqualified') === '1';
  });
  React.useEffect(() => {
    try { localStorage.setItem('post-studio-show-disqualified', showDisqualified ? '1' : '0'); } catch {}
  }, [showDisqualified]);
  const [view, setView] = useState<'grid' | 'board' | 'list' | 'table'>(() => {
    if (typeof window !== 'undefined') {
      const v = localStorage.getItem('post-studio-view');
      // Legacy 'calendar' view migrates to 'list' — Calendar is its own sub-tab now.
      if (v === 'board' || v === 'grid' || v === 'list' || v === 'table') return v;
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
      // Sub-tab restriction: Carousels tab only shows carousels, Posts excludes them.
      if (restrictTypes && !restrictTypes.includes((d.type || 'text') as any)) return false;
      // Hide disqualified unless explicitly toggled OR user is drilled into that status
      if (d.status === 'disqualified' && !showDisqualified && statusFilter !== 'disqualified') return false;
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
        if (statusFilter === 'scheduled') return av - bv;
        return bv - av;
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [drafts, statusFilter, typeFilter, searchQuery, effectiveSort, showDisqualified, restrictTypes]);

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

  // URL ↔ openId sync. Subtle: the initial `?open=<id>` from a deeplink
  // arrives BEFORE drafts have loaded. So we stash it in a ref and apply
  // it once drafts populate. The URL-write effect skips writes until the
  // first restore has had a chance to run, otherwise it'd strip the param.
  const initialOpenRef = React.useRef<string | null>(
    typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('open'),
  );
  const initialRestoredRef = React.useRef(false);
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!initialRestoredRef.current && initialOpenRef.current) return; // wait for restore
    const params = new URLSearchParams(window.location.search);
    const cur = params.get('open');
    if (openId !== cur) {
      if (openId) params.set('open', openId); else params.delete('open');
      const url = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
      window.history.replaceState(null, '', url);
    }
  }, [openId]);
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const target = initialOpenRef.current;
    if (!target) { initialRestoredRef.current = true; return; }
    if (drafts.some((d) => d.id === target)) {
      setOpenId(target);
      initialOpenRef.current = null;
      initialRestoredRef.current = true;
    } else if (drafts.length > 0) {
      // Drafts loaded but the deeplink doesn't match — give up.
      initialOpenRef.current = null;
      initialRestoredRef.current = true;
    }
  }, [drafts]);

  const buttonLabel = creating
    ? (type === 'carousel' ? 'Building carousel…' : 'Firing…')
    : (type === 'carousel' ? 'Build carousel (~2 min)' : `Generate ${type === 'single_image' ? 'single-image' : 'text'} post (~8 min)`);

  // Pinned + present statuses, ordered.
  const visibleStatuses = STATUS_ORDER.filter((s) => statusCounts[s] || PINNED_STATUSES.has(s));

  // Stuck posts: status='scheduled', scheduled_at in the past, and NO LinkedIn URN
  // (sourcePostId empty). These either failed to post or the publisher never picked
  // them up. They're invisible problems unless we surface them — the publisher
  // workflow has been silently flaking for weeks.
  const stuckScheduled = React.useMemo(() => drafts.filter((d) => {
    if (d.status !== 'scheduled') return false;
    if (!d.scheduledAt) return false;
    if (new Date(d.scheduledAt).getTime() >= Date.now()) return false;
    return !d.sourcePostId;
  }), [drafts]);
  const [showStuckList, setShowStuckList] = useState(false);

  // Polling removed — useContentLibrary now subscribes to a Supabase realtime
  // channel on carousel_drafts. Status flips (idea → generating → review →
  // scheduled → published) propagate immediately. refresh() is still callable
  // for cases that need a deliberate full reconcile.
  // generatingCount still drives the refresh-button label + pulse indicator.
  const generatingCount = React.useMemo(
    () => drafts.filter((d) => d.status === 'generating').length,
    [drafts],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 ring-1 ring-emerald-500/20 flex items-center justify-center">
          <FileText className="w-4 h-4 text-emerald-400" />
        </div>
        <div>
          <h2 className="dv-section-h">
            {title}
            <span className="dv-editorial-num text-[18px]">{drafts.length}</span>
          </h2>
          <span className="text-[length:var(--t-sm)] text-zinc-500">{subtitle}</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="inline-flex rounded-lg bg-zinc-900/60 ring-1 ring-zinc-800/80 p-0.5">
            <button
              onClick={() => setView('list')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11.5px] font-medium rounded-md transition-all ${view === 'list' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
              title="List view (grouped by status)"
            ><ListIcon className="w-3.5 h-3.5" /> List</button>
            <button
              onClick={() => setView('grid')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11.5px] font-medium rounded-md transition-all ${view === 'grid' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
              title="Grid view"
            ><LayoutGrid className="w-3.5 h-3.5" /> Grid</button>
            <button
              onClick={() => setView('board')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11.5px] font-medium rounded-md transition-all ${view === 'board' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
              title="Board view (kanban by status)"
            ><Columns3 className="w-3.5 h-3.5" /> Board</button>
            <button
              onClick={() => setView('table')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11.5px] font-medium rounded-md transition-all ${view === 'table' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
              title="Table view (dense spreadsheet, no grouping)"
            ><Table2 className="w-3.5 h-3.5" /> Table</button>
          </div>
          <button onClick={refresh} className="relative p-2 text-zinc-400 hover:text-zinc-200" title={generatingCount > 0 ? `${generatingCount} generating · auto-refresh on` : 'Refresh'}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {generatingCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400 animate-refresh-pulse" />
            )}
          </button>
        </div>
      </div>

      {/* Stuck-scheduled triage banner — only shows when there are past-due
          scheduled posts WITHOUT a LinkedIn URN. These are publisher misfires
          and need manual action (re-publish or disqualify). */}
      {stuckScheduled.length > 0 && (
        <div
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
          className="rounded-xl ring-1 ring-amber-500/30 bg-gradient-to-r from-amber-950/40 to-amber-950/20 px-4 py-2.5 shadow-lg shadow-amber-950/10"
        >
          <button
            onClick={() => setShowStuckList((v) => !v)}
            className="w-full flex items-center gap-2 text-left text-[12.5px] text-amber-200"
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span className="font-medium">{stuckScheduled.length} scheduled posts past due with no LinkedIn URN</span>
            <span className="text-amber-400/70">— publisher likely failed, please triage</span>
            <span className="ml-auto text-amber-300/70">{showStuckList ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}</span>
          </button>
          {showStuckList && (
            <div className="mt-2 space-y-1 max-h-[200px] overflow-y-auto">
              {stuckScheduled.slice(0, 50).map((d) => (
                <button
                  key={d.id}
                  onClick={() => setOpenId(d.id)}
                  className="w-full flex items-center gap-2 text-left text-[11.5px] text-amber-100 hover:text-white hover:bg-amber-950/30 rounded px-1 py-0.5"
                >
                  <span className="text-amber-400/70 tabular-nums text-[10.5px] shrink-0">
                    {new Date(d.scheduledAt!).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                  <span className="truncate">{d.title || d.topic || '(untitled)'}</span>
                </button>
              ))}
              <div className="pt-1 flex items-center gap-3 text-[11px] text-amber-300/80">
                <button
                  onClick={async () => {
                    if (!confirm(`Mark all ${stuckScheduled.length} stuck posts as disqualified? They didn't publish to LinkedIn.`)) return;
                    try {
                      const { error } = await supabase
                        .from('carousel_drafts')
                        .update({ status: 'disqualified' })
                        .in('id', stuckScheduled.map((d) => d.id));
                      if (error) throw error;
                      toast.success(`Disqualified ${stuckScheduled.length} stuck posts`);
                      await refresh();
                    } catch (err) { toastError('bulk disqualify stuck', err); }
                  }}
                  className="rounded px-2 py-0.5 bg-amber-900/40 hover:bg-amber-900/60"
                >Disqualify all</button>
                <span className="text-amber-300/50">Or open each to re-publish manually.</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* New post — collapsed by default. Polished container with subtle gradient. */}
      <div className="rounded-xl ring-1 ring-zinc-800/60 bg-gradient-to-b from-zinc-900/50 to-zinc-950/30 overflow-hidden shadow-lg shadow-black/10">
        <button
          onClick={() => setFormOpen((v) => !v)}
          className="w-full flex items-center gap-2.5 px-4 py-2 text-[13px] font-medium text-zinc-200 hover:bg-zinc-900/40 transition-colors group"
        >
          <span className="w-6 h-6 rounded-md bg-emerald-500/15 ring-1 ring-emerald-500/30 flex items-center justify-center group-hover:bg-emerald-500/25 transition-colors">
            <Plus className="w-3.5 h-3.5 text-emerald-300" />
          </span>
          New post
          <span className="ml-auto text-zinc-500 transition-transform">{formOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
        </button>
        {formOpen && (
          <div className="px-4 pb-4 space-y-3 border-t border-zinc-800/60">
            <div className="flex items-center gap-1.5 text-xs pt-3">
              <span className="text-zinc-500 mr-1 font-medium tracking-tight">Type</span>
              {(['text','single_image','carousel'] as PostType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`rounded-md px-3 py-1.5 transition-all duration-150 text-[12px] font-medium ${type === t ? 'bg-emerald-500/15 text-emerald-200 ring-1 ring-inset ring-emerald-500/40 shadow-sm shadow-emerald-500/10' : 'bg-zinc-900/40 text-zinc-400 ring-1 ring-inset ring-zinc-800/80 hover:text-zinc-200 hover:ring-zinc-700'}`}
                >{TYPE_LABELS[t]}</button>
              ))}
            </div>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={type === 'carousel' ? 'Topic — e.g. Why hiring more people made your firm slower' : "Topic — e.g. Stop hiring to fix a process you haven't automated yet"}
              className="w-full rounded-lg bg-zinc-950/60 ring-1 ring-zinc-800/80 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-emerald-500/40 transition-all"
            />
            {type === 'carousel' ? (
              <textarea
                value={keyPoints}
                onChange={(e) => setKeyPoints(e.target.value)}
                placeholder="Key points (one per line, optional)"
                rows={3}
                className="w-full rounded-lg bg-zinc-950/60 ring-1 ring-zinc-800/80 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-emerald-500/40 transition-all"
              />
            ) : (
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Post format details (optional)"
                rows={2}
                className="w-full rounded-lg bg-zinc-950/60 ring-1 ring-zinc-800/80 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-emerald-500/40 transition-all"
              />
            )}
            <button
              onClick={handleCreate}
              disabled={creating}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-900/40 ring-1 ring-emerald-400/30 transition-all"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {buttonLabel}
            </button>
          </div>
        )}
      </div>

      {/* Filters / sort — single muted line. Status + type pills are visually
          quiet (no high-contrast fill on non-active), keep more room for content. */}
      {drafts.length > 0 && (
        <div className="space-y-1.5 text-[11.5px]">
          {/* Topic search — slimmer than before */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by topic or body…"
            className="w-full rounded bg-zinc-950 border border-zinc-800 px-2.5 py-1 text-[12.5px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
          />
          {/* Status + Type + Sort all on one line. Inactive pills are bare text with a
              dot; active pill gets the emerald fill. Disqualified moved to a footer toggle. */}
          <div className="flex items-center gap-x-1 gap-y-1 flex-wrap text-zinc-400">
            {(['all', ...visibleStatuses] as const).filter((s) => s !== 'disqualified').map((s) => {
              const count = statusCounts[s] || 0;
              const isPinned = s !== 'all' && PINNED_STATUSES.has(s);
              const isCritical = s === 'error' && count > 0;
              const isActive = statusFilter === s;
              const dot = s === 'all' ? null : STATUS_META[s]?.dot;
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition-all duration-150 ${
                    isActive ? 'bg-emerald-500/15 text-emerald-200 ring-1 ring-inset ring-emerald-500/40 shadow-sm shadow-emerald-500/10' :
                    isCritical ? 'text-red-300 hover:bg-red-500/10 hover:ring-1 hover:ring-inset hover:ring-red-500/30' :
                    isPinned && count === 0 ? 'text-zinc-600 hover:text-zinc-400' :
                    'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 hover:ring-1 hover:ring-inset hover:ring-zinc-700/60'
                  }`}
                >
                  {dot && <span className={`inline-block w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-300' : dot}`} />}
                  <span className="leading-none">{s === 'all' ? 'All' : statusLabel(s)}</span>
                  {count > 0 && <span className={`tabular-nums text-[10.5px] leading-none ${isActive ? 'opacity-80' : 'opacity-60'}`}>{count}</span>}
                </button>
              );
            })}
            <span className="text-zinc-700 mx-1.5 h-4 w-px bg-zinc-800/80" />
            {(['all', 'text', 'single_image', 'carousel'] as const).filter((t) => t === 'all' || typeCounts[t]).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition-all duration-150 ${
                  typeFilter === t ? 'bg-emerald-500/15 text-emerald-200 ring-1 ring-inset ring-emerald-500/40 shadow-sm shadow-emerald-500/10'
                                   : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 hover:ring-1 hover:ring-inset hover:ring-zinc-700/60'
                }`}
              >
                <span className="leading-none">{t === 'all' ? 'All' : t === 'single_image' ? 'Single image' : t === 'carousel' ? 'Carousel' : 'Text'}</span>
                {(typeCounts[t] || 0) > 0 && t !== 'all' && <span className={`tabular-nums text-[10.5px] leading-none ${typeFilter === t ? 'opacity-80' : 'opacity-60'}`}>{typeCounts[t] || 0}</span>}
              </button>
            ))}
            <span className="ml-auto inline-flex items-center gap-1.5 text-zinc-500">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'auto' | 'updated' | 'scheduled')}
                className="rounded-md bg-zinc-900/40 ring-1 ring-inset ring-zinc-800/80 px-2 py-1 text-zinc-300 hover:ring-zinc-700 cursor-pointer transition-colors text-[11px]"
              >
                <option value="auto">Sort: smart</option>
                <option value="updated">Sort: updated</option>
                <option value="scheduled">Sort: scheduled</option>
              </select>
              {(statusCounts.disqualified || 0) > 0 && (
                <button
                  onClick={() => setShowDisqualified((v) => !v)}
                  className={`rounded-md px-2 py-1 transition-all duration-150 text-[11px] ${
                    showDisqualified ? 'text-zinc-200 bg-zinc-800/80 ring-1 ring-inset ring-zinc-700' : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/40'
                  }`}
                  title={showDisqualified ? 'Hide disqualified' : `Show ${statusCounts.disqualified} disqualified`}
                >
                  {showDisqualified ? 'Hide disqualified' : `+${statusCounts.disqualified} hidden`}
                </button>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Library — filtered. Empty states use a polished card layout that
          matches the list container instead of bare text. */}
      {loading && drafts.length === 0 ? (
        <div className="rounded-xl ring-1 ring-zinc-800/60 bg-gradient-to-b from-zinc-900/30 to-zinc-950/40 px-6 py-12 text-center">
          <div className="text-[13px] text-zinc-400 font-medium">Loading posts…</div>
        </div>
      ) : drafts.length === 0 ? (
        <div className="rounded-xl ring-1 ring-zinc-800/60 bg-gradient-to-b from-zinc-900/30 to-zinc-950/40 px-6 py-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 ring-1 ring-emerald-500/30 flex items-center justify-center mb-3">
            <Plus className="w-5 h-5 text-emerald-300" />
          </div>
          <div className="text-[13px] text-zinc-300 font-medium">No posts yet</div>
          <div className="text-[11.5px] text-zinc-500 mt-0.5">Click <span className="text-emerald-300">New post</span> above to draft one.</div>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl ring-1 ring-zinc-800/60 bg-gradient-to-b from-zinc-900/30 to-zinc-950/40 px-6 py-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-gradient-to-br from-zinc-800/60 to-zinc-900/40 ring-1 ring-zinc-700/40 flex items-center justify-center mb-3">
            <RefreshCw className="w-5 h-5 text-zinc-500" />
          </div>
          <div className="text-[13px] text-zinc-300 font-medium">No posts match the current filter</div>
          <div className="text-[11.5px] text-zinc-500 mt-0.5">Try clearing the filters above.</div>
        </div>
      ) : view === 'list' || view === 'table' ? (
        <StudioListView
          dense={view === 'table'}
          rows={visible.map((d) => {
            const tax = (d.taxonomy as any) || {};
            const imageThumb = (d.imageUrls && d.imageUrls[0]) || null;
            // Progress hint for generating-status rows
            const genStart = tax.generating_started_at as string | undefined;
            const genHint = d.status === 'generating' && genStart
              ? (() => {
                  const elapsed = Math.round((Date.now() - new Date(genStart).getTime()) / 60_000);
                  return elapsed >= 15
                    ? `⚠ stuck — started ${elapsed}m ago`
                    : `generating · started ${elapsed}m ago`;
                })()
              : d.status === 'generating' ? 'generating…' : undefined;
            return {
              id: d.id,
              title: d.title || d.topic || '(untitled)',
              excerpt: genHint || (d.postBody ? postExcerpt(d) : undefined),
              status: d.status,
              thumbUrl: driveThumbUrl(imageThumb, 96),
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
          loading={loading && drafts.length === 0}
          // Dense table doesn't group by status — it's a flat sortable spreadsheet.
          groupByStatus={view === 'table' ? undefined : 'post-studio'}
          statusOrder={STATUS_ORDER}
          pinnedStatuses={view === 'table' ? [] : ['idea', 'generating', 'review', 'scheduled', 'published', 'error']}
          statusChoices={STATUS_ORDER}
          onStatusChange={async (id, next) => {
            // Optimistic: flip the pill immediately. Realtime confirms; refresh()
            // on error reverts. Eliminates the 400-700ms full-table-refetch lag.
            applyOptimistic(id, { status: next });
            try {
              const { error } = await supabase.from('carousel_drafts').update({ status: next }).eq('id', id);
              if (error) throw error;
              toast.success(`Status → ${next}`);
            } catch (err) {
              toastError('update status', err);
              refresh();
            }
          }}
          onDateChange={async (id, iso) => {
            // Preserve existing time-of-day if present, else default to 09:00 local.
            const cur = drafts.find((d) => d.id === id)?.scheduledAt;
            let nextISO: string | null = null;
            if (iso) {
              const [y, m, d] = iso.split('-').map(Number);
              const base = cur ? new Date(cur) : new Date();
              base.setFullYear(y, m - 1, d);
              if (!cur) base.setHours(9, 0, 0, 0);
              nextISO = base.toISOString();
            }
            applyOptimistic(id, { scheduledAt: nextISO });
            try {
              const { error } = await supabase.from('carousel_drafts').update({ scheduled_at: nextISO }).eq('id', id);
              if (error) throw error;
              toast.success(nextISO ? 'Rescheduled' : 'Date cleared');
            } catch (err) {
              toastError('reschedule', err);
              refresh();
            }
          }}
          onBulkAction={async (action, ids) => {
            try {
              if (action === 'disqualify') {
                applyOptimisticMany(ids, { status: 'disqualified' });
                const { error } = await supabase.from('carousel_drafts').update({ status: 'disqualified' }).in('id', ids);
                if (error) throw error;
                toast.success(`Disqualified ${ids.length} draft${ids.length === 1 ? '' : 's'}`);
              } else if (action === 'delete') {
                applyOptimisticDelete(ids);
                const { error } = await supabase.from('carousel_drafts').delete().in('id', ids);
                if (error) throw error;
                toast.success(`Deleted ${ids.length} draft${ids.length === 1 ? '' : 's'}`);
              }
            } catch (err) {
              toastError(`bulk ${action}`, err);
              refresh();
            }
          }}
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
                    <img src={driveThumbUrl(d.imageUrls[0], 400) || d.imageUrls[0]} alt="" className="w-full h-full object-cover" loading="lazy" />
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

      {/* Editor opens in a right-anchored side-sheet — list stays visible behind */}
      <Sheet
        open={!!open}
        onClose={() => setOpenId(null)}
        size="full"
        title={open ? <span className="truncate">{open.title}</span> : ''}
      >
        {open && <CarouselEditor draft={open} onClose={() => setOpenId(null)} onChanged={refresh} />}
      </Sheet>
    </div>
  );
};

export default PostStudioPanel;
