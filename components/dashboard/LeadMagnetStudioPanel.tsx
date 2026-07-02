import React, { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Loader2, RefreshCw, Magnet, ChevronDown, ChevronUp, LayoutGrid, Columns3, List as ListIcon, Table2 } from 'lucide-react';
import { useLeadMagnets, type LeadMagnetDraft } from '../../hooks/useLeadMagnets';
import { generateLMContent } from '../../lib/studioActions';
import { toastError } from '../../lib/dashboardActions';
import { supabase } from '../../lib/supabase';
import LeadMagnetEditor from './LeadMagnetEditor';
import { StudioListView } from './StudioListView';
import Sheet from '../ui/Sheet';
import { driveThumbUrl, versionedAssetUrl } from '../../lib/driveThumb';
import { statusLabel } from '../../lib/statusLabels';
import { PanelIntro } from '../dashboard-v2/primitives';
import EmptyState from './shared/EmptyState';

// Canonical LM formats — sourced from the curator + content pipeline.
// Anything outside this set in lm_drafts_v2 is data pollution (newsletter
// signups, qualified-leads, deprecated Template) and is filtered out of the
// LM panel. Shown only behind a "+N misclassified" footer toggle.
const FORMATS = [
  'Checklist', 'Calculator', 'Interactive Assessment', 'Guide', 'AI Kit',
  'N8N Workflow', 'Stack Picker', 'Annotated Architecture', 'Live AI Walkthrough', 'Skill Pack',
];
const FORMATS_SET = new Set(FORMATS);

const STATUS_STYLE: Record<string, string> = {
  idea: 'bg-zinc-700/60 text-zinc-300',
  generating: 'bg-sky-900/50 text-sky-300',
  generating_assets: 'bg-sky-900/50 text-sky-300',
  review: 'bg-amber-900/50 text-amber-300',
  approved: 'bg-emerald-900/40 text-emerald-300',
  scheduled: 'bg-emerald-900/40 text-emerald-300',
  published: 'bg-emerald-900/50 text-emerald-300',
  disqualified: 'bg-zinc-800 text-zinc-400',
  error: 'bg-red-900/50 text-red-300',
};

const STATUS_DOT: Record<string, string> = {
  idea: 'bg-zinc-500',
  generating: 'bg-sky-400',
  generating_assets: 'bg-sky-400',
  review: 'bg-amber-400',
  approved: 'bg-emerald-400',
  scheduled: 'bg-emerald-400',
  published: 'bg-emerald-500',
  disqualified: 'bg-zinc-600',
  error: 'bg-red-500',
};

const STATUS_ORDER = ['idea', 'generating', 'generating_assets', 'review', 'approved', 'scheduled', 'published', 'disqualified', 'error'];
const PINNED_STATUSES = new Set(['generating', 'generating_assets', 'review', 'scheduled', 'published', 'error']);

// dot + label pairing for the shared list view (dot is the scan anchor).
const STATUS_META: Record<string, { dot: string; label: string }> = {
  idea:              { dot: 'bg-zinc-500',   label: 'text-zinc-300' },
  generating:        { dot: 'bg-sky-400',    label: 'text-sky-300' },
  generating_assets: { dot: 'bg-sky-400',    label: 'text-sky-300' },
  review:         { dot: 'bg-amber-400',  label: 'text-amber-300' },
  approved:          { dot: 'bg-emerald-400',label: 'text-emerald-300' },
  scheduled:         { dot: 'bg-emerald-400',label: 'text-emerald-300' },
  published:         { dot: 'bg-emerald-500',label: 'text-emerald-300' },
  disqualified:      { dot: 'bg-zinc-600',   label: 'text-zinc-500' },
  error:             { dot: 'bg-red-500',    label: 'text-red-400' },
};

function lmDate(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); } catch { return undefined; }
}

const LeadMagnetStudioPanel: React.FC = () => {
  const { drafts, loading, refresh } = useLeadMagnets();
  const [topic, setTopic] = useState('');
  const [format, setFormat] = useState(FORMATS[0]);
  const [editorialNotes, setEditorialNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [formatFilter, setFormatFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [formOpen, setFormOpen] = useState(false);
  const [showDisqualified, setShowDisqualified] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('lm-studio-show-disqualified') === '1';
  });
  // Rows with non-canonical formats (newsletter, /start funnel forms, deprecated
  // Template) are NOT lead magnets — they leaked into lm_drafts_v2 but back live
  // pages elsewhere. They are always excluded from this section (no toggle).
  React.useEffect(() => {
    try { localStorage.setItem('lm-studio-show-disqualified', showDisqualified ? '1' : '0'); } catch {}
  }, [showDisqualified]);
  const [view, setView] = useState<'grid' | 'board' | 'list' | 'table'>(() => {
    if (typeof window !== 'undefined') {
      const v = localStorage.getItem('lm-studio-view');
      if (v === 'board' || v === 'grid' || v === 'list' || v === 'table') return v;
    }
    return 'list';
  });
  React.useEffect(() => { try { localStorage.setItem('lm-studio-view', view); } catch {} }, [view]);

  // Counts exclude non-LM formats so the chip counts match the visible rows.
  const countedDrafts = React.useMemo(
    () => drafts.filter((d) => FORMATS_SET.has(d.format || '')),
    [drafts],
  );
  const statusCounts = React.useMemo(() => {
    const c: Record<string, number> = { all: countedDrafts.length };
    for (const d of countedDrafts) c[d.status] = (c[d.status] || 0) + 1;
    return c;
  }, [countedDrafts]);
  const formatCounts = React.useMemo(() => {
    const c: Record<string, number> = { all: countedDrafts.length };
    for (const d of countedDrafts) {
      const k = d.format || 'unknown';
      c[k] = (c[k] || 0) + 1;
    }
    return c;
  }, [countedDrafts]);
  // Auto-refresh while LM generation/asset-build is in flight.
  const generatingCount = React.useMemo(
    () => drafts.filter((d) => d.status === 'generating' || d.status === 'generating_assets').length,
    [drafts],
  );
  React.useEffect(() => {
    if (generatingCount === 0) return;
    const iv = setInterval(() => { refresh(); }, 20_000);
    return () => clearInterval(iv);
  }, [generatingCount, refresh]);

  const visible = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return drafts
      .filter((d) => {
        // Exclude rows whose format isn't a real LM format (newsletter / forms /
        // deprecated Template — they back live pages but aren't lead magnets).
        const fmt = d.format || '';
        if (!FORMATS_SET.has(fmt)) return false;
        if (d.status === 'disqualified' && !showDisqualified && statusFilter !== 'disqualified') return false;
        if (statusFilter !== 'all' && d.status !== statusFilter) return false;
        if (formatFilter !== 'all' && (d.format || 'unknown') !== formatFilter) return false;
        if (q) {
          const hay = `${d.topic || ''} ${d.postBody || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [drafts, statusFilter, formatFilter, searchQuery, showDisqualified]);

  const open = drafts.find((d) => d.id === openId) || null;

  async function handleCreate() {
    if (!topic.trim()) { toast.error('Enter a topic'); return; }
    setCreating(true);
    try {
      // Studio pre-creates the lm_drafts_v2 row, then fires the webhook with phase=content.
      const { data, error } = await supabase
        .from('lm_drafts_v2')
        .insert({ topic: topic.trim(), format, status: 'generating' })
        .select('id')
        .single();
      if (error) throw error;
      const draftId = data.id as string;
      await generateLMContent({ draft_id: draftId, topic: topic.trim(), format, editorial_notes: editorialNotes.trim() || undefined });
      toast.success('Generation fired (~10 min) — Status will move to review when done.');
      setTopic(''); setEditorialNotes('');
      await refresh();
      setOpenId(draftId);
    } catch (err) {
      toastError('create lead magnet', err);
    } finally {
      setCreating(false);
    }
  }

  // URL ↔ openId sync — same race-fix as PostStudioPanel.
  const initialOpenRef = React.useRef<string | null>(
    typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('open'),
  );
  const initialRestoredRef = React.useRef(false);
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!initialRestoredRef.current && initialOpenRef.current) return;
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
      initialOpenRef.current = null;
      initialRestoredRef.current = true;
    }
  }, [drafts]);

  return (
    <div className="space-y-6">
      <PanelIntro
        tourId="leadmagnets"
        purpose="Turn attention into qualified leads, built and published automatically."
        how="One idea becomes an interactive asset on a live hosted page, with gated CTAs that route signups by fit and a full launch kit (post, DM, email, cover)."
      />
      <div className="flex items-center gap-2">
        <Magnet className="w-5 h-5 text-emerald-400" />
        <h2 className="text-lg font-semibold text-zinc-100">Lead Magnet Studio</h2>
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
            <button
              onClick={() => setView('table')}
              className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded ${view === 'table' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
              title="Table view (dense spreadsheet, no grouping)"
            ><Table2 className="w-3.5 h-3.5" /> Table</button>
          </div>
          <button onClick={refresh} className="p-2 text-zinc-400 hover:text-zinc-200" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* New LM — collapsed by default */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50">
        <button
          onClick={() => setFormOpen((v) => !v)}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium text-zinc-300 hover:bg-zinc-900"
        >
          <Plus className="w-3.5 h-3.5 text-emerald-400" />
          New lead magnet
          <span className="ml-auto text-zinc-500">{formOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}</span>
        </button>
        {formOpen && (
          <div className="px-4 pb-4 space-y-4 border-t border-zinc-800/60 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 sm:items-end">
              <div>
                <div className="dv-field-label">What should it help with?</div>
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. The 12 ops checks that catch 80% of revenue leaks"
                  className="w-full rounded-lg bg-zinc-950/60 ring-1 ring-zinc-800/80 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all"
                />
              </div>
              <div>
                <div className="dv-field-label">Format</div>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="rounded-lg bg-zinc-950/60 ring-1 ring-zinc-800/80 px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all cursor-pointer"
                >
                  {FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>
            <div>
              <div className="dv-field-label">Direction <span className="normal-case font-normal text-zinc-600">· optional</span></div>
              <textarea
                value={editorialNotes}
                onChange={(e) => setEditorialNotes(e.target.value)}
                placeholder="Any angle, audience, or detail to steer it"
                rows={2}
                className="w-full rounded-lg bg-zinc-950/60 ring-1 ring-zinc-800/80 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { handleCreate(); setFormOpen(false); }}
                disabled={creating}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--ds-ok)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {creating ? 'Firing…' : 'Generate'}
              </button>
              <span className="text-[11px] text-zinc-600">Builds the asset, a live page, and the launch kit. ~10 min.</span>
            </div>
          </div>
        )}
      </div>

      {/* Filters — compact, muted, single line */}
      {drafts.length > 0 && (
        <div className="space-y-1.5 text-[11.5px]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by topic or body…"
            className="w-full rounded bg-zinc-950 border border-zinc-800 px-2.5 py-1 text-[12.5px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
          />
          <div className="flex items-center gap-x-1 gap-y-1 flex-wrap text-zinc-400">
            {(['all', ...STATUS_ORDER.filter((s) => statusCounts[s] || PINNED_STATUSES.has(s))] as const).filter((s) => s !== 'disqualified').map((s) => {
              const count = statusCounts[s] || 0;
              const isActive = statusFilter === s;
              const dot = s === 'all' ? null : STATUS_DOT[s];
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition ${
                    isActive ? 'bg-emerald-600/90 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                  }`}
                >
                  {dot && <span className={`inline-block w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white' : dot}`} />}
                  {s === 'all' ? 'All' : statusLabel(s)}
                  {count > 0 && <span className="opacity-60 tabular-nums">{count}</span>}
                </button>
              );
            })}
            <span className="text-zinc-700 mx-1">·</span>
            {(['all', ...FORMATS.filter((f) => formatCounts[f])] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFormatFilter(f)}
                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition ${
                  formatFilter === f ? 'bg-emerald-600/90 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                }`}
              >
                {f === 'all' ? 'All' : f}
                {(formatCounts[f] || 0) > 0 && f !== 'all' && <span className="opacity-60 tabular-nums">{formatCounts[f] || 0}</span>}
              </button>
            ))}
            <span className="ml-auto inline-flex items-center gap-1.5">
              {(statusCounts.disqualified || 0) > 0 && (
                <button
                  onClick={() => setShowDisqualified((v) => !v)}
                  className={`rounded px-1.5 py-0.5 transition ${
                    showDisqualified ? 'text-zinc-300 bg-zinc-900/60' : 'text-zinc-600 hover:text-zinc-400'
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

      {/* Library — filtered. Polished empty states matching the list chrome. */}
      {loading && drafts.length === 0 ? (
        <div className="rounded-xl ring-1 ring-zinc-800/60 bg-gradient-to-b from-zinc-900/30 to-zinc-950/40 px-6 py-12 text-center">
          <div className="text-[13px] text-zinc-400 font-medium">Loading lead magnets…</div>
        </div>
      ) : drafts.length === 0 ? (
        <EmptyState
          title="No lead magnets yet"
          description="Pick a format and the system builds an interactive asset, publishes it to a live page, and writes the launch kit."
        />
      ) : visible.length === 0 ? (
        <div className="rounded-xl ring-1 ring-zinc-800/60 bg-gradient-to-b from-zinc-900/30 to-zinc-950/40 px-6 py-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-gradient-to-br from-zinc-800/60 to-zinc-900/40 ring-1 ring-zinc-700/40 flex items-center justify-center mb-3">
            <RefreshCw className="w-5 h-5 text-zinc-500" />
          </div>
          <div className="text-[13px] text-zinc-300 font-medium">No lead magnets match the current filter</div>
          <div className="text-[11.5px] text-zinc-500 mt-0.5">Try clearing the filters above.</div>
        </div>
      ) : view === 'list' || view === 'table' ? (
        <StudioListView
          dense={view === 'table'}
          rows={visible.map((d) => ({
            id: d.id,
            // Title priority: topic (the real headline) → description → format +
            // date (e.g. "Checklist — Jun 14") → bare format. Never "(untitled)".
            title: d.topic
              || d.description
              || (d.format
                ? `${d.format} — ${new Date(d.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                : `Lead magnet — ${new Date(d.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`),
            excerpt: (d as any).postBody ? String((d as any).postBody).replace(/\s+/g, ' ').trim().slice(0, 140) : undefined,
            status: d.status,
            thumbUrl: driveThumbUrl(versionedAssetUrl(d.coverUrl, d.updatedAt), 96),
            kicker: 'LM',
            date: lmDate(d.updatedAt),
            dateSort: d.updatedAt ? new Date(d.updatedAt).getTime() : 0,
            formatLabel: d.format || undefined,
            source: d.source || undefined,
            topicStrength: d.topicStrength || undefined,
          }))}
          statusMeta={STATUS_META}
          onOpen={setOpenId}
          loading={loading && drafts.length === 0}
          hiddenCols={new Set(['pillar', 'hookType', 'valueTier'])}
          groupByStatus={view === 'table' ? undefined : 'lm-studio'}
          statusOrder={STATUS_ORDER}
          pinnedStatuses={view === 'table' ? [] : ['idea', 'generating', 'generating_assets', 'review', 'scheduled', 'published', 'error']}
          statusChoices={STATUS_ORDER}
          onStatusChange={async (id, next) => {
            try {
              const { error } = await supabase.from('lm_drafts_v2').update({ status: next }).eq('id', id);
              if (error) throw error;
              toast.success(`Status → ${next}`);
              await refresh();
            } catch (err) { toastError('update status', err); }
          }}
          onBulkAction={async (action, ids) => {
            try {
              if (action === 'disqualify') {
                const { error } = await supabase.from('lm_drafts_v2').update({ status: 'disqualified' }).in('id', ids);
                if (error) throw error;
                toast.success(`Disqualified ${ids.length} LM${ids.length === 1 ? '' : 's'}`);
              } else if (action === 'delete') {
                const { error } = await supabase.from('lm_drafts_v2').delete().in('id', ids);
                if (error) throw error;
                toast.success(`Deleted ${ids.length} LM${ids.length === 1 ? '' : 's'}`);
              }
              await refresh();
            } catch (err) { toastError(`bulk ${action}`, err); }
          }}
        />
      ) : view === 'board' ? (
        <div className="flex gap-3 overflow-x-auto pb-3 -mx-2 px-2 snap-x">
          {STATUS_ORDER.filter((s) => statusCounts[s] || PINNED_STATUSES.has(s)).map((status) => {
            const col = visible.filter((d) => d.status === status);
            const dotClass = STATUS_DOT[status] || STATUS_DOT.idea;
            return (
              <div key={status} className="flex-none w-[160px] snap-start rounded-md border border-zinc-800 bg-zinc-950/40 flex flex-col max-h-[75vh]">
                <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-zinc-800 sticky top-0 bg-zinc-950/80 backdrop-blur">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${dotClass}`} />
                  <span className="text-[10.5px] font-medium uppercase tracking-wider text-zinc-300 truncate">{status}</span>
                  <span className="ml-auto text-[10px] text-zinc-500 font-mono">{col.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-1.5 space-y-1.5">
                  {col.length === 0 ? (
                    <div className="text-[10px] text-zinc-700 italic py-1.5 text-center">—</div>
                  ) : col.map((d) => {
                    const cover = driveThumbUrl(versionedAssetUrl(d.coverUrl, d.updatedAt), 200);
                    const titleText = d.topic || d.description || (d.format ? `${d.format} — ${new Date(d.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : `Lead magnet — ${new Date(d.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`);
                    return (
                    <button
                      key={d.id}
                      onClick={() => setOpenId(d.id)}
                      className="w-full text-left rounded-md border border-zinc-800/70 bg-zinc-900/60 hover:border-zinc-600 hover:bg-zinc-900 transition overflow-hidden"
                    >
                      {cover && (
                        <div className="aspect-[16/9] bg-zinc-950 overflow-hidden">
                          <img src={cover} alt="" className="w-full h-full object-cover" loading="lazy" />
                        </div>
                      )}
                      <div className="px-1.5 py-1.5">
                        {d.format && <div className="text-[8.5px] uppercase tracking-wider text-emerald-400/50 mb-0.5">{d.format}</div>}
                        <div className="text-[11.5px] text-zinc-200 line-clamp-3 leading-tight">{titleText}</div>
                      </div>
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
          {visible.map((d: LeadMagnetDraft) => (
            <button
              key={d.id}
              onClick={() => setOpenId(d.id)}
              className="text-left rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-hidden hover:border-zinc-600 transition group"
            >
              <div className="aspect-[16/9] bg-zinc-950 overflow-hidden relative">
                {d.coverUrl
                  ? <img src={driveThumbUrl(versionedAssetUrl(d.coverUrl, d.updatedAt), 400) || d.coverUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                  : (
                    <div className="w-full h-full flex flex-col justify-center px-3 py-2 bg-gradient-to-br from-[#1c241f] via-[#161914] to-[#14110d]">
                      <div className="text-[10px] uppercase tracking-wider text-emerald-400/60 mb-1">{d.format || 'Lead magnet'}</div>
                      <div className="text-[12px] leading-tight text-zinc-300/90 font-serif italic line-clamp-3">
                      {d.topic || d.description || (d.format ? `${d.format} — ${new Date(d.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : `Lead magnet — ${new Date(d.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`)}
                    </div>
                    </div>
                  )}
                <span className={`absolute top-2 right-2 inline-block w-2 h-2 rounded-full ${STATUS_DOT[d.status] || STATUS_DOT.idea} shadow-[0_0_0_2px_rgba(0,0,0,0.4)]`} />
              </div>
              <div className="p-3 space-y-2">
                <div className="text-sm text-zinc-200 line-clamp-2">
                  {d.topic || d.description || (d.format ? `${d.format} — ${new Date(d.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : `Lead magnet — ${new Date(d.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`)}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-block rounded px-2 py-0.5 text-[11px] ${STATUS_STYLE[d.status] || STATUS_STYLE.idea}`}>
                    {d.status}
                  </span>
                  {d.format && <span className="text-[11px] text-zinc-500">{d.format}</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Editor side-sheet — list stays visible behind */}
      <Sheet
        open={!!open}
        onClose={() => setOpenId(null)}
        size="full"
        title={open ? <span className="truncate">{open.topic || '(untitled)'}</span> : ''}
      >
        {open && <LeadMagnetEditor draft={open} onClose={() => setOpenId(null)} onChanged={refresh} />}
      </Sheet>
    </div>
  );
};

export default LeadMagnetStudioPanel;
