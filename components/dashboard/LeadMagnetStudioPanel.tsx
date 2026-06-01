import React, { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Loader2, RefreshCw, Magnet, ChevronDown, ChevronUp, LayoutGrid, Columns3, List as ListIcon } from 'lucide-react';
import { useLeadMagnets, type LeadMagnetDraft } from '../../hooks/useLeadMagnets';
import { generateLMContent } from '../../lib/studioActions';
import { toastError } from '../../lib/dashboardActions';
import { supabase } from '../../lib/supabase';
import LeadMagnetEditor from './LeadMagnetEditor';
import { StudioListView } from './StudioListView';

const FORMATS = [
  'Checklist', 'Calculator', 'Interactive Assessment', 'Guide', 'AI Kit',
  'N8N Workflow', 'Stack Picker', 'Annotated Architecture', 'Live AI Walkthrough', 'Skill Pack',
];

const STATUS_STYLE: Record<string, string> = {
  idea: 'bg-zinc-700/60 text-zinc-300',
  generating: 'bg-sky-900/50 text-sky-300',
  generating_assets: 'bg-sky-900/50 text-sky-300',
  review: 'bg-amber-900/50 text-amber-300',
  ready: 'bg-emerald-900/50 text-emerald-300',
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
  ready: 'bg-emerald-500',
  disqualified: 'bg-zinc-600',
  error: 'bg-red-500',
  draft: 'bg-zinc-500',
};

const STATUS_ORDER = ['idea', 'generating', 'generating_assets', 'review', 'approved', 'scheduled', 'ready', 'disqualified', 'error', 'draft'];
const PINNED_STATUSES = new Set(['generating', 'generating_assets', 'review', 'error']);

// dot + label pairing for the shared list view (dot is the scan anchor).
const STATUS_META: Record<string, { dot: string; label: string }> = {
  idea:              { dot: 'bg-zinc-500',   label: 'text-zinc-300' },
  generating:        { dot: 'bg-sky-400',    label: 'text-sky-300' },
  generating_assets: { dot: 'bg-sky-400',    label: 'text-sky-300' },
  review:         { dot: 'bg-amber-400',  label: 'text-amber-300' },
  approved:          { dot: 'bg-emerald-400',label: 'text-emerald-300' },
  scheduled:         { dot: 'bg-emerald-400',label: 'text-emerald-300' },
  ready:             { dot: 'bg-emerald-500',label: 'text-emerald-300' },
  disqualified:      { dot: 'bg-zinc-600',   label: 'text-zinc-500' },
  error:             { dot: 'bg-red-500',    label: 'text-red-400' },
  draft:             { dot: 'bg-zinc-500',   label: 'text-zinc-300' },
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
  const [view, setView] = useState<'grid' | 'board' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      const v = localStorage.getItem('lm-studio-view');
      if (v === 'board' || v === 'grid' || v === 'list') return v;
    }
    return 'list';
  });
  React.useEffect(() => { try { localStorage.setItem('lm-studio-view', view); } catch {} }, [view]);

  const statusCounts = React.useMemo(() => {
    const c: Record<string, number> = { all: drafts.length };
    for (const d of drafts) c[d.status] = (c[d.status] || 0) + 1;
    return c;
  }, [drafts]);
  const formatCounts = React.useMemo(() => {
    const c: Record<string, number> = { all: drafts.length };
    for (const d of drafts) {
      const k = d.format || 'unknown';
      c[k] = (c[k] || 0) + 1;
    }
    return c;
  }, [drafts]);
  const visible = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return drafts
      .filter((d) => {
        if (statusFilter !== 'all' && d.status !== statusFilter) return false;
        if (formatFilter !== 'all' && (d.format || 'unknown') !== formatFilter) return false;
        if (q) {
          const hay = `${d.topic || ''} ${d.postBody || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [drafts, statusFilter, formatFilter, searchQuery]);

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

  if (open) {
    return <LeadMagnetEditor draft={open} onClose={() => setOpenId(null)} onChanged={refresh} />;
  }

  return (
    <div className="space-y-6">
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
          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-900"
        >
          <Plus className="w-4 h-4 text-emerald-400" />
          New lead magnet
          <span className="ml-auto text-zinc-500">{formOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
        </button>
        {formOpen && (
          <div className="px-4 pb-4 space-y-3 border-t border-zinc-800/60 pt-3">
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Topic — e.g. The 12 ops checks that catch 80% of revenue leaks"
              className="w-full rounded-md bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600"
            />
            <div className="flex items-center gap-3">
              <label className="text-xs text-zinc-400">Format</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="rounded-md bg-zinc-950 border border-zinc-800 px-2 py-1.5 text-sm text-zinc-100"
              >
                {FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <textarea
              value={editorialNotes}
              onChange={(e) => setEditorialNotes(e.target.value)}
              placeholder="Editorial notes (optional)"
              rows={2}
              className="w-full rounded-md bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600"
            />
            <button
              onClick={() => { handleCreate(); setFormOpen(false); }}
              disabled={creating}
              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {creating ? 'Firing…' : 'Generate content (~10 min)'}
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      {drafts.length > 0 && (
        <div className="space-y-2 text-xs">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by topic or body…"
            className="w-full rounded-md bg-zinc-950 border border-zinc-800 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
          />
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-zinc-500 mr-1">Status</span>
            {(['all', ...STATUS_ORDER.filter((s) => statusCounts[s] || PINNED_STATUSES.has(s))] as const).map((s) => (
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
            <span className="text-zinc-500 mr-1">Format</span>
            {(['all', ...Object.keys(formatCounts).filter((k) => k !== 'all' && formatCounts[k])] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFormatFilter(f)}
                className={`rounded-full px-2.5 py-1 transition ${formatFilter === f ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
              >
                {f === 'all' ? 'All' : f} <span className="opacity-60">{formatCounts[f] || 0}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Library — filtered */}
      {loading && drafts.length === 0 ? (
        <div className="text-sm text-zinc-500">Loading…</div>
      ) : drafts.length === 0 ? (
        <div className="text-sm text-zinc-500">No lead magnets yet — create one above.</div>
      ) : visible.length === 0 ? (
        <div className="text-sm text-zinc-500">No lead magnets match the current filter.</div>
      ) : view === 'list' ? (
        <StudioListView
          rows={visible.map((d) => ({
            id: d.id,
            title: d.topic || '(untitled)',
            excerpt: (d as any).postBody ? String((d as any).postBody).replace(/\s+/g, ' ').trim().slice(0, 140) : undefined,
            status: d.status,
            thumbUrl: d.coverUrl || null,
            kicker: 'LM',
            date: lmDate(d.updatedAt),
            dateSort: d.updatedAt ? new Date(d.updatedAt).getTime() : 0,
            formatLabel: d.format || undefined,
            source: d.source || undefined,
            topicStrength: d.topicStrength || undefined,
          }))}
          statusMeta={STATUS_META}
          onOpen={setOpenId}
          // LM doesn't have pillar/hook/tier in the same way carousels do; hide those columns
          hiddenCols={new Set(['pillar', 'hookType', 'valueTier'])}
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
                  ) : col.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => setOpenId(d.id)}
                      className="w-full text-left rounded border border-zinc-800/70 bg-zinc-900/60 hover:border-zinc-600 hover:bg-zinc-900 transition px-1.5 py-1.5"
                    >
                      <div className="text-[11.5px] text-zinc-200 line-clamp-3 leading-tight">{d.topic || '(untitled)'}</div>
                    </button>
                  ))}
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
                  ? <img src={d.coverUrl} alt="" className="w-full h-full object-cover" />
                  : (
                    <div className="w-full h-full flex flex-col justify-center px-3 py-2 bg-gradient-to-br from-[#1c241f] via-[#161914] to-[#14110d]">
                      <div className="text-[10px] uppercase tracking-wider text-emerald-400/60 mb-1">{d.format || 'Lead magnet'}</div>
                      <div className="text-[12px] leading-tight text-zinc-300/90 font-serif italic line-clamp-3">{d.topic || '(untitled)'}</div>
                    </div>
                  )}
                <span className={`absolute top-2 right-2 inline-block w-2 h-2 rounded-full ${STATUS_DOT[d.status] || STATUS_DOT.idea} shadow-[0_0_0_2px_rgba(0,0,0,0.4)]`} />
              </div>
              <div className="p-3 space-y-2">
                <div className="text-sm text-zinc-200 line-clamp-2">{d.topic || '(untitled)'}</div>
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
    </div>
  );
};

export default LeadMagnetStudioPanel;
