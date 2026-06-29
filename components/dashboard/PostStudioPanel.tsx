import React, { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Loader2, RefreshCw, FileText, ChevronDown, ChevronUp, Calendar, Columns3, List as ListIcon } from 'lucide-react';
import { useContentLibrary, type CarouselDraft } from '../../hooks/useContentLibrary';
import { useIdeaCandidates } from '../../hooks/useIdeaCandidates';
import { decideIdea } from '../../lib/ideaProjection';
import IdeaDetail from './IdeaDetail';
import { generatePostContent, buildCarousel, regenerateDraft } from '../../lib/studioActions';
import { toastError } from '../../lib/dashboardActions';
import { supabase } from '../../lib/supabase';
import CarouselEditor from './CarouselEditor';
import { StudioListView } from './StudioListView';
import Sheet from '../ui/Sheet';
import { driveThumbUrl } from '../../lib/driveThumb';
import { statusLabel, POST_STATUSES } from '../../lib/statusLabels';
import { LifecycleLegend } from '../dashboard-v2/primitives';
import { getTourIntent, onTourIntent } from '../dashboard-v2/tour/tourBus';

type PostType = 'text' | 'single_image' | 'carousel';

const TYPE_LABELS: Record<PostType, string> = {
  text: 'Text post',
  single_image: 'Single image',
  carousel: 'Carousel',
};

// Status -> { dot color, text class, pill bg+text } — for light theme
const STATUS_META: Record<string, { dot: string; label: string; pill?: string }> = {
  draft:         { dot: 'bg-slate-400',    label: 'text-[var(--ds-dim)]',   pill: 'bg-slate-100 text-slate-600' },
  idea:          { dot: 'bg-blue-400',     label: 'text-blue-700',           pill: 'bg-blue-50 text-blue-700' },
  generating:    { dot: 'bg-sky-500',      label: 'text-sky-700',            pill: 'bg-sky-50 text-sky-700' },
  review:        { dot: 'bg-amber-400',    label: 'text-amber-700',          pill: 'bg-amber-50 text-amber-700' },
  approved:      { dot: 'bg-emerald-500',  label: 'text-emerald-700',        pill: 'bg-emerald-50 text-emerald-700' },
  scheduled:     { dot: 'bg-violet-500',   label: 'text-violet-700',         pill: 'bg-violet-50 text-violet-700' },
  published:     { dot: 'bg-slate-400',    label: 'text-[var(--ds-dim)]',    pill: 'bg-slate-100 text-slate-500' },
  disqualified:  { dot: 'bg-slate-300',    label: 'text-[var(--ds-faint)]',  pill: 'bg-slate-50 text-slate-600' },
  error:         { dot: 'bg-red-500',      label: 'text-red-700',            pill: 'bg-red-50 text-red-700' },
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

const PostStudioPanel: React.FC<PostStudioPanelProps> = ({ restrictTypes, title = 'Posts' }) => {
  const { drafts: realDrafts, loading, refresh, applyOptimistic, applyOptimisticMany, applyOptimisticDelete } = useContentLibrary();
  // Curator-scored ideas, projected onto the board's Idea stage. They live as
  // status='idea' rows alongside the real drafts so the pipeline reads
  // Idea → Generating → Review → … → Published in one board. Only the full
  // (unrestricted) Posts board surfaces ideas.
  const { ideas, refreshIdeas, removeIdea } = useIdeaCandidates();
  const drafts = React.useMemo(
    () => (restrictTypes ? realDrafts : [...ideas, ...realDrafts]),
    [ideas, realDrafts, restrictTypes],
  );
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
  const [view, setView] = useState<'board' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      const v = localStorage.getItem('post-studio-view');
      // List is the ClickUp-style table equivalent (all columns, horizontal scroll
      // at narrow widths) — separate Grid + Table views were redundant. Old
      // values migrate: grid/table → list (they all flattened to the same shape).
      if (v === 'board' || v === 'list') return v;
      if (v === 'grid' || v === 'table' || v === 'calendar') return 'list';
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

  // ── Guided-tour hooks ────────────────────────────────────────────────────
  // The tour can trigger real interactions here: open the compose form, or open
  // a draft's editor. We read the intent on the tour event AND on mount (so
  // back-navigation into this panel mid-tour still resolves). The reset path
  // only runs on a tour event — never on a normal data refresh — so this never
  // fights a user operating the panel outside the tour.
  const draftsRef = React.useRef(drafts);
  draftsRef.current = drafts;
  const pickEditable = React.useCallback(() => {
    const ds = draftsRef.current;
    return (
      ds.find((d) => d.status === 'review') ||
      ds.find((d) => d.status === 'approved') ||
      ds.find((d) => d.status === 'scheduled') ||
      ds.find((d) => d.status === 'published') ||
      ds[0] || null
    );
  }, []);
  React.useEffect(() => {
    const apply = () => {
      const intent = getTourIntent();
      if (intent === 'posts-compose') {
        setFormOpen(true);
        setOpenId(null);
        setTimeout(() => {
          try { (document.querySelector('[data-tour="new-post"] input') as HTMLInputElement | null)?.focus(); } catch {}
        }, 80);
      } else if (intent === 'posts-edit') {
        setFormOpen(false);
        const pick = pickEditable();
        if (pick) setOpenId(pick.id);
      } else {
        // Tour advanced away / ended — clear any tour-driven UI.
        setFormOpen(false);
        setOpenId(null);
      }
    };
    const off = onTourIntent(apply);
    if (getTourIntent() !== null) apply();
    return off;
  }, [pickEditable]);
  // If the edit step fired before drafts loaded, open one as soon as they arrive.
  React.useEffect(() => {
    if (getTourIntent() === 'posts-edit' && !openId) {
      const pick = pickEditable();
      if (pick) setOpenId(pick.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drafts]);

  async function handleCreate() {
    if (!topic.trim()) { toast.error('Enter a topic'); return; }
    setCreating(true);
    try {
      if (type === 'carousel') {
        // Persist a real carousel_drafts row FIRST and use its uuid as the
        // draft_id — same pattern as text/image below. Previously this fired
        // the webhook with a throwaway `studio-<rand>` id, which the carousel
        // sub-workflow then looked up against carousel_drafts.id (a uuid column)
        // → "invalid input syntax for type uuid" and the carousel never built.
        const { data, error } = await supabase
          .from('carousel_drafts')
          .insert({ topic: topic.trim(), type: 'carousel', status: 'generating' })
          .select('id')
          .single();
        if (error) throw error;
        const draftId = data.id as string;
        const r = await buildCarousel({
          carousel_id: draftId,
          draft_id: draftId,
          topic: topic.trim(),
          key_points: keyPoints.split('\n').map((s) => s.trim()).filter(Boolean),
        });
        toast.success(`Built — ${r.verdict} (${r.attempts} attempt${r.attempts > 1 ? 's' : ''})`);
        setOpenId(draftId);
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
      <LifecycleLegend />
      <div className="flex items-center gap-3" data-tour="posts">
        <div className="w-9 h-9 rounded-xl bg-[var(--ds-bg)] ring-1 ring-[var(--ds-line)] flex items-center justify-center">
          <FileText className="w-4 h-4 text-[var(--ds-accent)]" />
        </div>
        <div>
          <h2 className="dv-section-h flex items-center gap-2">
            {title}
            <span className="rounded-full bg-[var(--ds-bg)] border border-[var(--ds-line)] px-2 py-0.5 text-[12px] font-medium text-[var(--ds-dim)] tabular-nums leading-none">{drafts.length}</span>
          </h2>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="inline-flex rounded-lg bg-[var(--ds-bg)] ring-1 ring-[var(--ds-line)] p-0.5">
            <button
              onClick={() => setView('list')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium rounded-md transition-all ${view === 'list' ? 'bg-[var(--ds-card)] text-[var(--ds-ink)] shadow-sm border border-[var(--ds-line)]' : 'text-[var(--ds-dim)] hover:text-[var(--ds-ink)]'}`}
              title="List view — ClickUp-style table grouped by status (all columns, horizontal scroll)"
            ><ListIcon className="w-3.5 h-3.5" /> List</button>
            <button
              onClick={() => setView('board')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium rounded-md transition-all ${view === 'board' ? 'bg-[var(--ds-card)] text-[var(--ds-ink)] shadow-sm border border-[var(--ds-line)]' : 'text-[var(--ds-dim)] hover:text-[var(--ds-ink)]'}`}
              title="Board view — kanban by status"
            ><Columns3 className="w-3.5 h-3.5" /> Board</button>
          </div>
          <button onClick={() => { refresh(); refreshIdeas(); }} className="relative p-2 text-[var(--ds-dim)] hover:text-[var(--ds-ink)]" title={generatingCount > 0 ? `${generatingCount} generating · auto-refresh on` : 'Refresh'}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {generatingCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500 animate-refresh-pulse" />
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
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 shadow-sm"
        >
          <button
            onClick={() => setShowStuckList((v) => !v)}
            className="w-full flex items-center gap-2 text-left text-[13px] text-amber-800"
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span className="font-medium">{stuckScheduled.length} scheduled posts past due with no LinkedIn URN</span>
            <span className="text-amber-600">— publisher likely failed, please triage</span>
            <span className="ml-auto text-amber-500">{showStuckList ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}</span>
          </button>
          {showStuckList && (
            <div className="mt-2 space-y-1 max-h-[200px] overflow-y-auto">
              {stuckScheduled.slice(0, 50).map((d) => (
                <button
                  key={d.id}
                  onClick={() => setOpenId(d.id)}
                  className="w-full flex items-center gap-2 text-left text-[12px] text-amber-900 hover:text-amber-950 hover:bg-amber-100 rounded px-1 py-0.5"
                >
                  <span className="text-amber-600 tabular-nums text-[12px] shrink-0">
                    {new Date(d.scheduledAt!).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                  <span className="truncate">{d.title || d.topic || '(untitled)'}</span>
                </button>
              ))}
              <div className="pt-1 flex items-center gap-3 text-[12px] text-amber-700">
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
                  className="rounded px-2 py-0.5 bg-amber-100 border border-amber-200 hover:bg-amber-200"
                >Disqualify all</button>
                <span className="text-amber-500">Or open each to re-publish manually.</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* New post — collapsed by default. Polished container with subtle gradient. */}
      <div data-tour="new-post" className="rounded-xl border border-[var(--ds-line)] bg-[var(--ds-card)] overflow-hidden shadow-sm">
        <button
          onClick={() => setFormOpen((v) => !v)}
          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-[var(--ds-ink)] hover:bg-[#fafafc] transition-colors group"
        >
          <span className="w-6 h-6 rounded-md bg-[var(--ds-accent)]/10 border border-[var(--ds-accent)]/20 flex items-center justify-center group-hover:bg-[var(--ds-accent)]/15 transition-colors">
            <Plus className="w-3.5 h-3.5 text-[var(--ds-accent)]" />
          </span>
          New post
          <span className="ml-auto text-[var(--ds-faint)] transition-transform">{formOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
        </button>
        {formOpen && (
          <div className="px-4 pb-4 space-y-4 border-t border-[var(--ds-line)] pt-4">
            <div>
              <div className="dv-field-label">Format</div>
              <div className="flex items-center gap-1.5">
                {(['text','single_image','carousel'] as PostType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`rounded-md px-3 py-1.5 transition-all duration-150 text-[12px] font-medium ${type === t ? 'bg-[var(--ds-accent)]/10 text-[var(--ds-accent)] ring-1 ring-inset ring-[var(--ds-accent)]/30 shadow-sm' : 'bg-[var(--ds-bg)] text-[var(--ds-dim)] ring-1 ring-inset ring-[var(--ds-line)] hover:text-[var(--ds-ink)] hover:ring-[#cbd5e1]'}`}
                  >{TYPE_LABELS[t]}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="dv-field-label">What should it be about?</div>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={type === 'carousel' ? 'e.g. Why hiring more people made your firm slower' : "e.g. Stop hiring to fix a process you haven't automated yet"}
                className="w-full rounded-lg bg-[var(--ds-bg)] border border-[var(--ds-line)] px-3 py-2.5 text-sm text-[var(--ds-ink)] placeholder-[var(--ds-faint)] focus:outline-none focus:border-[var(--ds-accent)] focus:ring-1 focus:ring-[var(--ds-accent)]/30 transition-all"
              />
              <p className="mt-1.5 text-[12px] text-[var(--ds-faint)]">One line is enough. The system writes the hook, body{type === 'single_image' ? ', and image' : ''} in your voice.</p>
            </div>
            {type === 'carousel' ? (
              <div>
                <div className="dv-field-label">Key points <span className="normal-case font-normal text-[var(--ds-faint)]">· optional, one per line</span></div>
                <textarea
                  value={keyPoints}
                  onChange={(e) => setKeyPoints(e.target.value)}
                  placeholder="One point per line"
                  rows={3}
                  className="w-full rounded-lg bg-[var(--ds-bg)] border border-[var(--ds-line)] px-3 py-2.5 text-sm text-[var(--ds-ink)] placeholder-[var(--ds-faint)] focus:outline-none focus:border-[var(--ds-accent)] focus:ring-1 focus:ring-[var(--ds-accent)]/30 transition-all"
                />
              </div>
            ) : (
              <div>
                <div className="dv-field-label">Direction <span className="normal-case font-normal text-[var(--ds-faint)]">· optional</span></div>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Any angle, tone, or detail to steer it"
                  rows={2}
                  className="w-full rounded-lg bg-[var(--ds-bg)] border border-[var(--ds-line)] px-3 py-2.5 text-sm text-[var(--ds-ink)] placeholder-[var(--ds-faint)] focus:outline-none focus:border-[var(--ds-accent)] focus:ring-1 focus:ring-[var(--ds-accent)]/30 transition-all"
                />
              </div>
            )}
            <button
              onClick={handleCreate}
              disabled={creating}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--ds-accent)] hover:bg-[var(--ds-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition-all"
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
        <div className="space-y-2 text-[12px]" data-tour="post-lifecycle">
          {/* Topic search — slimmer than before */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by topic or body…"
            className="w-full rounded-lg bg-[var(--ds-card)] border border-[var(--ds-line)] px-3 py-2 text-[13px] text-[var(--ds-ink)] placeholder-[var(--ds-faint)] focus:outline-none focus:border-[var(--ds-accent)] focus:ring-1 focus:ring-[var(--ds-accent)]/20"
          />
          {/* Status + Type + Sort all on one line. Tinted pills per status color. */}
          <div className="flex items-center gap-x-1.5 gap-y-1.5 flex-wrap text-[var(--ds-dim)]">
            {(['all', ...visibleStatuses] as const).filter((s) => s !== 'disqualified').map((s) => {
              const count = statusCounts[s] || 0;
              const isPinned = s !== 'all' && PINNED_STATUSES.has(s);
              const isCritical = s === 'error' && count > 0;
              const isActive = statusFilter === s;
              const meta = s === 'all' ? null : STATUS_META[s];
              const dot = meta?.dot;
              const pillClass = meta?.pill;
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition-all duration-150 ${
                    isActive && s !== 'all' && pillClass ? pillClass + ' ring-1 ring-inset ring-current/20 shadow-sm font-medium' :
                    isActive && s === 'all' ? 'bg-[var(--ds-accent)]/10 text-[var(--ds-accent)] ring-1 ring-inset ring-[var(--ds-accent)]/20 shadow-sm font-medium' :
                    isCritical ? 'text-red-600 hover:bg-red-50' :
                    isPinned && count === 0 ? 'text-[var(--ds-dim)] opacity-60 hover:opacity-100' :
                    'text-[var(--ds-dim)] hover:text-[var(--ds-ink)] hover:bg-black/[.03]'
                  }`}
                >
                  {dot && <span className={`inline-block w-1.5 h-1.5 rounded-full ${dot}`} />}
                  <span className="leading-none">{s === 'all' ? 'All' : statusLabel(s)}</span>
                  {count > 0 && <span className={`tabular-nums text-[12px] leading-none opacity-70`}>{count}</span>}
                </button>
              );
            })}
            <span className="mx-1.5 h-4 w-px bg-[var(--ds-line)]" />
            {(['all', 'text', 'single_image', 'carousel'] as const).filter((t) => t === 'all' || typeCounts[t]).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition-all duration-150 ${
                  typeFilter === t
                    ? 'bg-[var(--ds-accent)]/10 text-[var(--ds-accent)] ring-1 ring-inset ring-[var(--ds-accent)]/20 shadow-sm font-medium'
                    : 'text-[var(--ds-dim)] hover:text-[var(--ds-ink)] hover:bg-black/[.03]'
                }`}
              >
                <span className="leading-none">{t === 'all' ? 'All' : t === 'single_image' ? 'Single image' : t === 'carousel' ? 'Carousel' : 'Text'}</span>
                {(typeCounts[t] || 0) > 0 && t !== 'all' && <span className="tabular-nums text-[12px] leading-none opacity-70">{typeCounts[t] || 0}</span>}
              </button>
            ))}
            <span className="ml-auto inline-flex items-center gap-1.5 text-[var(--ds-dim)]">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'auto' | 'updated' | 'scheduled')}
                className="rounded-md bg-[var(--ds-card)] border border-[var(--ds-line)] px-2 py-1 text-[var(--ds-dim)] hover:border-[#cbd5e1] cursor-pointer transition-colors text-[12px]"
              >
                <option value="auto">Smart sort</option>
                <option value="updated">Sort: updated</option>
                <option value="scheduled">Sort: scheduled</option>
              </select>
              {(statusCounts.disqualified || 0) > 0 && (
                <button
                  onClick={() => setShowDisqualified((v) => !v)}
                  className={`rounded-md px-2 py-1 transition-all duration-150 text-[12px] ${
                    showDisqualified ? 'text-[var(--ds-ink)] bg-[var(--ds-bg)] border border-[var(--ds-line)]' : 'text-[var(--ds-dim)] hover:text-[var(--ds-dim)] hover:bg-black/[.03]'
                  }`}
                  title={showDisqualified ? 'Hide disqualified' : `Show ${statusCounts.disqualified} disqualified`}
                >
                  {showDisqualified ? 'Hide disqualified' : `${statusCounts.disqualified} more`}
                </button>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Library — filtered. Empty states use a polished card layout that
          matches the list container instead of bare text. */}
      {loading && drafts.length === 0 ? (
        <div className="rounded-xl border border-[var(--ds-line)] bg-[var(--ds-card)] px-6 py-12 text-center shadow-sm">
          <div className="text-[13px] text-[var(--ds-dim)] font-medium">Loading posts…</div>
        </div>
      ) : drafts.length === 0 ? (
        <div className="rounded-xl border border-[var(--ds-line)] bg-[var(--ds-card)] px-6 py-12 text-center shadow-sm">
          <div className="mx-auto w-12 h-12 rounded-full bg-[var(--ds-accent)]/8 border border-[var(--ds-accent)]/20 flex items-center justify-center mb-3">
            <Plus className="w-5 h-5 text-[var(--ds-accent)]" />
          </div>
          <div className="text-[13px] text-[var(--ds-ink)] font-medium">No posts yet</div>
          <div className="text-[12px] text-[var(--ds-dim)] mt-0.5">Click <span className="text-[var(--ds-accent)] font-medium">New post</span> above to draft one.</div>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-[var(--ds-line)] bg-[var(--ds-card)] px-6 py-12 text-center shadow-sm">
          <div className="mx-auto w-12 h-12 rounded-full bg-[var(--ds-bg)] border border-[var(--ds-line)] flex items-center justify-center mb-3">
            <RefreshCw className="w-5 h-5 text-[var(--ds-faint)]" />
          </div>
          <div className="text-[13px] text-[var(--ds-ink)] font-medium">No posts match the current filter</div>
          <div className="text-[12px] text-[var(--ds-dim)] mt-0.5">Try clearing the filters above.</div>
        </div>
      ) : view === 'list' ? (
        <StudioListView
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
              kicker: d.type === 'carousel' ? 'CAR' : d.type === 'single_image' ? 'IMG' : d.type === 'text' ? 'TXT' : (d.isIdea ? '—' : 'TXT'),
              // Idea rows have no schedule — the Date column shows when the idea
              // was created (ingested) instead of a "set date" picker.
              date: d.isIdea ? (formatScheduled(d.updatedAt) || undefined) : (formatScheduled(d.scheduledAt) || undefined),
              dateSort: d.scheduledAt ? new Date(d.scheduledAt).getTime() : new Date(d.updatedAt).getTime(),
              pillar: tax.pillar,
              hookType: tax.hook_type,
              valueTier: tax.value_tier,
              source: tax.source,
              // Don't fake a format when the curator left none — show "—".
              formatLabel: d.type || (d.isIdea ? '—' : undefined),
              topicStrength: d.topicStrength || undefined,
            };
          })}
          statusMeta={STATUS_META}
          onOpen={setOpenId}
          loading={loading && drafts.length === 0}
          // Hide the ML taxonomy columns (pillar / hook / tier / source) — they're
          // pipeline internals that read as jargon on a client-facing surface.
          hiddenCols={new Set(['pillar', 'hookType', 'valueTier', 'source'])}
          groupByStatus={'post-studio'}
          statusOrder={STATUS_ORDER}
          pinnedStatuses={['idea', 'generating', 'review', 'scheduled', 'published', 'error']}
          statusChoices={STATUS_ORDER}
          onStatusChange={async (id, next) => {
            // Idea-stage rows aren't carousel_drafts — route their status moves
            // through the curator decide path. Forward (anything but 'idea') =
            // approve & generate; 'disqualified' = reject.
            if (id.startsWith('idea:')) {
              const cid = id.slice(5);
              if (next === 'idea') return;
              const decision = next === 'disqualified' ? 'reject' : 'approve';
              try {
                await decideIdea(cid, decision);
                removeIdea(cid);
                refresh();
                toast.success(decision === 'approve' ? 'Approved — generating' : 'Rejected');
              } catch (err) { toastError('idea ' + decision, err); }
              return;
            }
            const cur = drafts.find((d) => d.id === id);
            // ClickUp parity: flipping a row BACK to 'idea' triggers a real
            // regeneration via the right pipeline for the row's type. Mirrors
            // how dragging a card to a previous column in ClickUp re-runs the
            // workflow. Confirm first since this overwrites existing copy.
            const LATER = new Set(['generating','review','approved','scheduled','published','disqualified','error']);
            if (next === 'idea' && cur && LATER.has(cur.status)) {
              if (!confirm(`Regenerate this ${cur.type || 'post'}? Flipping to 'idea' will refire the pipeline and overwrite the current copy${cur.imageUrls?.[0] ? ' and image' : ''}.`)) return;
              applyOptimistic(id, { status: 'generating' });
              try {
                await regenerateDraft({ id, type: cur.type, topic: cur.topic, title: cur.title, taxonomy: cur.taxonomy });
                toast.success('Regeneration fired');
              } catch (err) {
                toastError('regenerate', err);
                refresh();
              }
              return;
            }
            // Default path: status-only flip, optimistic + supabase update.
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
            // Setting a future date must also promote status→'scheduled' so the Bridge
            // (yzXqLDIpuNzuhUQq) queues a scheduled_posts row; otherwise a 'review' post
            // gets a date but never publishes (incident-calendar-schedule-no-queue-2026-06-13).
            const curStatus = drafts.find((d) => d.id === id)?.status;
            const SCHEDULABLE = new Set(['review', 'approved', 'scheduled']);
            const promote = !!(nextISO && curStatus && SCHEDULABLE.has(curStatus));
            const patch: { scheduled_at: string | null; status?: string } = { scheduled_at: nextISO };
            if (promote) patch.status = 'scheduled';
            applyOptimistic(id, { scheduledAt: nextISO, ...(promote ? { status: 'scheduled' } : {}) });
            try {
              const { error } = await supabase.from('carousel_drafts').update(patch).eq('id', id);
              if (error) throw error;
              toast.success(nextISO ? 'Rescheduled' : 'Date cleared');
            } catch (err) {
              toastError('reschedule', err);
              refresh();
            }
          }}
          onBulkAction={async (action, ids) => {
            // Peel off idea-stage rows — they reject via the curator, not a
            // carousel_drafts delete/disqualify.
            const ideaIds = ids.filter((i) => i.startsWith('idea:'));
            ids = ids.filter((i) => !i.startsWith('idea:'));
            if (ideaIds.length) {
              await Promise.allSettled(ideaIds.map(async (i) => {
                const cid = i.slice(5);
                await decideIdea(cid, 'reject');
                removeIdea(cid);
              }));
              if (!ids.length) { toast.success(`Removed ${ideaIds.length} idea${ideaIds.length === 1 ? '' : 's'}`); return; }
            }
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
        <div className="flex gap-4 overflow-x-auto pb-3 -mx-2 px-2 snap-x">
          {visibleStatuses.map((status) => {
            const col = visible.filter((d) => d.status === status);
            const meta = STATUS_META[status] || STATUS_META.draft;
            return (
              <div key={status} className="flex-none w-[200px] snap-start rounded-xl border border-[var(--ds-line)] bg-[var(--ds-card)] flex flex-col max-h-[75vh] shadow-sm">
                <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-[var(--ds-line)] sticky top-0 bg-[var(--ds-card)] backdrop-blur">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                  <span className={`text-[11px] font-semibold uppercase tracking-wider ${meta.label} truncate`}>{status}</span>
                  <span className="ml-auto text-[12px] text-[var(--ds-faint)] font-mono">{col.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-1.5 space-y-1.5">
                  {col.length === 0 ? (
                    <div className="text-[12px] text-[var(--ds-faint)] italic py-1.5 text-center">—</div>
                  ) : col.map((d: CarouselDraft) => {
                    const sched = formatScheduled(d.scheduledAt);
                    const thumb = driveThumbUrl((d.imageUrls && d.imageUrls[0]) || null, 200);
                    const kicker = d.type === 'carousel' ? 'Carousel' : d.type === 'single_image' ? 'Image' : 'Text';
                    return (
                      <button
                        key={d.id}
                        onClick={() => setOpenId(d.id)}
                        className="w-full text-left rounded-xl border border-[var(--ds-line)] bg-[var(--ds-card)] hover:border-[var(--ds-accent)]/30 hover:bg-[#fafafe] hover:shadow-md transition-all overflow-hidden shadow-sm"
                      >
                        {thumb && (
                          <div className="aspect-[16/9] bg-[var(--ds-bg)] overflow-hidden">
                            <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" />
                          </div>
                        )}
                        <div className="px-3 py-3">
                          <div className="text-[10px] uppercase tracking-widest text-[var(--ds-faint)] mb-1 font-semibold">{kicker}</div>
                          <div className="text-[14px] text-[var(--ds-ink)] line-clamp-3 leading-snug font-medium">{d.title || d.topic || 'Untitled'}</div>
                          {sched && (
                            <div className="mt-1 flex items-center gap-1 text-[12px] text-[var(--ds-faint)]">
                              <Calendar className="w-2.5 h-2.5" /> {sched}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Editor opens in a right-anchored side-sheet — list stays visible behind */}
      <Sheet
        open={!!open}
        onClose={() => setOpenId(null)}
        size="full"
        title={open ? <span className="truncate">{open.isIdea ? 'Idea' : open.title}</span> : ''}
      >
        {open && (open.isIdea
          ? (
            <IdeaDetail
              draft={open}
              onClose={() => setOpenId(null)}
              onDecided={(cid) => { removeIdea(cid); refresh(); }}
            />
          )
          : <CarouselEditor draft={open} onClose={() => setOpenId(null)} onChanged={refresh} />
        )}
      </Sheet>
    </div>
  );
};

export default PostStudioPanel;
