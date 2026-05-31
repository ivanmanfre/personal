import React, { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Loader2, RefreshCw, Magnet, ChevronDown, ChevronUp } from 'lucide-react';
import { useLeadMagnets, type LeadMagnetDraft } from '../../hooks/useLeadMagnets';
import { generateLMContent } from '../../lib/studioActions';
import { toastError } from '../../lib/dashboardActions';
import { supabase } from '../../lib/supabase';
import LeadMagnetEditor from './LeadMagnetEditor';

const FORMATS = [
  'Checklist', 'Calculator', 'Interactive Assessment', 'Guide', 'AI Kit',
  'N8N Workflow', 'Stack Picker', 'Annotated Architecture', 'Live AI Walkthrough', 'Skill Pack',
];

const STATUS_STYLE: Record<string, string> = {
  idea: 'bg-zinc-700/60 text-zinc-300',
  generating: 'bg-sky-900/50 text-sky-300',
  generating_assets: 'bg-sky-900/50 text-sky-300',
  lm_review: 'bg-amber-900/50 text-amber-300',
  ready: 'bg-emerald-900/50 text-emerald-300',
  disqualified: 'bg-zinc-800 text-zinc-400',
  error: 'bg-red-900/50 text-red-300',
};

const STATUS_ORDER = ['idea', 'generating', 'generating_assets', 'lm_review', 'approved', 'scheduled', 'ready', 'disqualified', 'error', 'draft'];
const PINNED_STATUSES = new Set(['generating', 'generating_assets', 'lm_review', 'error']);

const LeadMagnetStudioPanel: React.FC = () => {
  const { drafts, loading, refresh } = useLeadMagnets();
  const [topic, setTopic] = useState('');
  const [format, setFormat] = useState(FORMATS[0]);
  const [editorialNotes, setEditorialNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [formatFilter, setFormatFilter] = useState<string>('all');
  const [formOpen, setFormOpen] = useState(false);

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
  const visible = React.useMemo(() => drafts
    .filter((d) => (statusFilter === 'all' || d.status === statusFilter) && (formatFilter === 'all' || (d.format || 'unknown') === formatFilter))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [drafts, statusFilter, formatFilter]);

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
      toast.success('Generation fired (~10 min) — Status will move to lm_review when done.');
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
        <button onClick={refresh} className="ml-auto p-2 text-zinc-400 hover:text-zinc-200" title="Refresh">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
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
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {visible.map((d: LeadMagnetDraft) => (
            <button
              key={d.id}
              onClick={() => setOpenId(d.id)}
              className="text-left rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-hidden hover:border-zinc-600 transition"
            >
              <div className="aspect-[16/9] bg-zinc-950 overflow-hidden">
                {d.coverUrl
                  ? <img src={d.coverUrl} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-zinc-700 text-xs">{d.format || '—'}</div>}
              </div>
              <div className="p-3 space-y-2">
                <div className="text-sm text-zinc-200 line-clamp-2">{d.topic || '(untitled)'}</div>
                <div className="flex items-center gap-2">
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
