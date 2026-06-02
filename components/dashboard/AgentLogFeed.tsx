import React, { useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp, Sparkles, MessageSquareDashed, CheckCircle2, AlertTriangle, FileText, ImageIcon, Send, User, Loader2 } from 'lucide-react';
import type { AgentLogEntry } from '../../hooks/useContentLibrary';
import { supabase } from '../../lib/supabase';
import { toastError } from '../../lib/dashboardActions';
import { renderLightMarkdown } from '../../lib/lightMarkdown';

/**
 * Chronological agent commentary feed — mirrors the comment stream that used to
 * live in ClickUp tasks. Each entry shows ts + agent + body. Newest at top,
 * collapsed by default so the editor stays scrollable.
 *
 * The body is rendered as `<pre>` so the agents' formatted blocks (QA scores,
 * verdict bars, "━━━" separators) keep their shape exactly like ClickUp showed.
 */
const AGENT_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  'Ivan':                  User,
  'Editorial Agent':       Sparkles,
  'LM Editorial Agent':    Sparkles,
  'Hook Agent':            MessageSquareDashed,
  'Content Agent':         FileText,
  'Carousel Structurer':   FileText,
  'Carousel Content Agent':FileText,
  'Carousel QA':           CheckCircle2,
  'QA Agent':              CheckCircle2,
  'LM QA Agent':           CheckCircle2,
  'QA HALT':               AlertTriangle,
  'Carousel QA Gate HALT': AlertTriangle,
  'LM Cover Copy Agent':   ImageIcon,
  'Image Generation':      ImageIcon,
  'IG Caption Generator':  MessageSquareDashed,
  'Scheduling Agent':      Send,
  'Publisher':             Send,
};

const AGENT_TINT: Record<string, string> = {
  'Ivan':                  'text-emerald-200 bg-emerald-500/15 border-emerald-500/30 font-semibold',
  'Editorial Agent':       'text-violet-300 bg-violet-500/10 border-violet-500/20',
  'LM Editorial Agent':    'text-violet-300 bg-violet-500/10 border-violet-500/20',
  'Hook Agent':            'text-sky-300 bg-sky-500/10 border-sky-500/20',
  'Content Agent':         'text-zinc-200 bg-zinc-800/50 border-zinc-700/40',
  'Carousel Structurer':   'text-zinc-200 bg-zinc-800/50 border-zinc-700/40',
  'Carousel Content Agent':'text-zinc-200 bg-zinc-800/50 border-zinc-700/40',
  'QA Agent':              'text-amber-300 bg-amber-500/10 border-amber-500/20',
  'LM QA Agent':           'text-amber-300 bg-amber-500/10 border-amber-500/20',
  'Carousel QA':           'text-amber-300 bg-amber-500/10 border-amber-500/20',
  'QA HALT':               'text-red-300 bg-red-500/10 border-red-500/20',
  'Carousel QA Gate HALT': 'text-red-300 bg-red-500/10 border-red-500/20',
  'LM Cover Copy Agent':   'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  'Image Generation':      'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  'IG Caption Generator':  'text-pink-300 bg-pink-500/10 border-pink-500/20',
  'Scheduling Agent':      'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
  'Publisher':             'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
};

function relTime(iso: string | null): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!t) return '';
  const diffMs = Date.now() - t;
  const m = Math.round(diffMs / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
  catch { return iso; }
}

interface Props {
  entries: AgentLogEntry[];
  /** Default open vs closed. Default: closed if >5 entries, open otherwise. */
  defaultOpen?: boolean;
  /** Supplying both enables the "add note" composer (Ivan types → append via append_agent_log RPC). */
  table?: 'carousel_drafts' | 'lm_drafts_v2';
  rowId?: string;
  /** Called after a successful note write so the parent can refresh. */
  onNoteAdded?: () => void;
  /** Render entry bodies as markdown (paragraphs, lists, bold, code, label-prefixes)
   *  instead of the raw <pre> block. The QA / Editorial agents emit markdown-ish
   *  bodies that look much better rendered. */
  renderMarkdown?: boolean;
}

const AgentLogFeed: React.FC<Props> = ({ entries, defaultOpen, table, rowId, onNoteAdded, renderMarkdown = false }) => {
  const sorted = React.useMemo(
    () => [...entries].sort((a, b) => (b.ts || '').localeCompare(a.ts || '')),
    [entries],
  );
  const [open, setOpen] = useState(defaultOpen ?? sorted.length <= 5);
  const [bodyOpen, setBodyOpen] = useState<Record<number, boolean>>({});

  // Track which entries are NEW since the panel mounted/refreshed, so we can
  // highlight them with a violet pulse on appearance. Compare by ts+agent.
  const [newKeys, setNewKeys] = useState<Set<string>>(new Set());
  const seenKeysRef = React.useRef<Set<string>>(new Set(sorted.map((e) => `${e.ts}|${e.agent}`)));
  React.useEffect(() => {
    const newly: string[] = [];
    for (const e of sorted) {
      const k = `${e.ts}|${e.agent}`;
      if (!seenKeysRef.current.has(k)) { newly.push(k); seenKeysRef.current.add(k); }
    }
    if (newly.length === 0) return;
    setNewKeys((s) => { const n = new Set(s); newly.forEach((k) => n.add(k)); return n; });
    const t = setTimeout(() => {
      setNewKeys((s) => { const n = new Set(s); newly.forEach((k) => n.delete(k)); return n; });
    }, 1200);
    return () => clearTimeout(t);
  }, [sorted]);
  const [noteText, setNoteText] = useState('');
  const [posting, setPosting] = useState(false);
  const canCompose = !!(table && rowId);

  async function postNote() {
    const body = noteText.trim();
    if (!body || !canCompose) return;
    setPosting(true);
    try {
      const { error } = await supabase.rpc('append_agent_log', {
        p_table: table,
        p_id: rowId,
        p_agent: 'Ivan',
        p_body: body,
      });
      if (error) throw error;
      setNoteText('');
      toast.success('Note added');
      onNoteAdded?.();
    } catch (err) {
      toastError('post note', err);
    } finally {
      setPosting(false);
    }
  }

  const composer = canCompose && (
    <div className="border-t border-zinc-800/60 px-3 py-2 bg-zinc-900/40">
      <div className="flex items-start gap-2">
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) postNote(); }}
          placeholder="Add a note for future-you (⌘+Enter to post)…"
          rows={2}
          className="flex-1 rounded-md bg-zinc-950 border border-zinc-800 px-2.5 py-1.5 text-[12px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-700/60 resize-none"
        />
        <button
          onClick={postNote}
          disabled={posting || !noteText.trim()}
          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed px-2.5 py-1.5 text-xs font-medium text-white"
        >
          {posting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          Post
        </button>
      </div>
    </div>
  );

  if (sorted.length === 0) {
    return (
      <div className="rounded-md border border-zinc-800/60 bg-zinc-900/30">
        <div className="px-3 py-2 text-xs text-zinc-500 italic">
          No agent activity yet — entries will appear here as the generation chain runs.
        </div>
        {composer}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-zinc-800/60 bg-zinc-900/30">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
      >
        <Sparkles className="w-3.5 h-3.5 text-purple-400/70" />
        Agent activity
        <span className="text-[11px] text-zinc-500">· {sorted.length} entr{sorted.length === 1 ? 'y' : 'ies'}</span>
        <span className="ml-auto text-zinc-500">{open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
      </button>
      {open && (
        <div className="border-t border-zinc-800/60 divide-y divide-zinc-800/30 max-h-[60vh] overflow-y-auto">
          {sorted.map((e, i) => {
            const Icon = AGENT_ICON[e.agent] || MessageSquareDashed;
            const tint = AGENT_TINT[e.agent] || 'text-zinc-300 bg-zinc-800/40 border-zinc-700/30';
            const expanded = bodyOpen[i] ?? false;
            const preview = (e.body || '').replace(/\s+/g, ' ').slice(0, 140);
            const truncated = (e.body || '').length > 140;
            return (
              <div key={i} className={`px-3 py-1.5 hover:bg-zinc-800/20 transition-colors ${newKeys.has(`${e.ts}|${e.agent}`) ? 'animate-log-pulse' : ''}`}>
                <div className="flex items-center gap-2 flex-wrap text-[11px]">
                  <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium ring-1 ring-inset ${tint}`}>
                    <Icon className="w-3 h-3" /> {e.agent}
                  </span>
                  <span className="text-zinc-500 font-mono tabular-nums text-[10.5px]">{relTime(e.ts)}</span>
                  {e.source === 'clickup_backfill' && (
                    <span className="text-[9.5px] text-zinc-700 uppercase tracking-wider">backfill</span>
                  )}
                  {truncated && (
                    <button
                      onClick={() => setBodyOpen((s) => ({ ...s, [i]: !s[i] }))}
                      className="ml-auto text-[10.5px] text-zinc-500 hover:text-zinc-300 px-1.5 py-0.5 rounded hover:bg-zinc-800/60 transition-colors"
                    >
                      {expanded ? 'collapse' : 'expand'}
                    </button>
                  )}
                </div>
                <div className="mt-1">
                  {expanded || !truncated ? (
                    renderMarkdown
                      ? <div className="text-[12px] text-zinc-300 leading-snug pl-1 border-l-2 border-zinc-800/60 ml-0.5 pl-2">{renderLightMarkdown(e.body || '(empty)', { textClass: 'text-[12px] text-zinc-300 leading-snug' })}</div>
                      : <pre className="whitespace-pre-wrap text-[12px] text-zinc-300 leading-snug font-sans pl-2 border-l-2 border-zinc-800/60">{e.body || '(empty)'}</pre>
                  ) : (
                    <p className="text-[11.5px] text-zinc-500 line-clamp-1 pl-1">{preview}{truncated ? '…' : ''}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {open && composer}
    </div>
  );
};

export default AgentLogFeed;
