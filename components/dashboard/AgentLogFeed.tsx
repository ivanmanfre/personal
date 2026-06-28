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
// Many n8n agents (QA, Content, Hook, …) write their log body as a raw JSON-stringified
// blob, with the actual human-readable text buried inside as one field. Un-wrap it for
// display: prefer a known prose field; otherwise pretty-print a slimmed object. Plain-text
// bodies (Promoter, lint gates) pass through untouched.
const HUMAN_FIELDS = [
  'qa_feedback', 'feedback', 'overall_feedback', 'generated_post', 'final_post',
  'hooks_text', 'revised_caption', 'summary', 'verdict_summary', 'note', 'text', 'body', 'message',
];
function humanizeBody(raw: string): string {
  const s = (raw || '').trim();
  if (!s || (s[0] !== '{' && s[0] !== '[')) return raw;
  let obj: any;
  try { obj = JSON.parse(s); } catch { return raw; }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return raw;
  for (const f of HUMAN_FIELDS) {
    if (typeof obj[f] === 'string' && obj[f].trim()) return obj[f].trim();
  }
  // No known prose field — pretty-print, dropping bulky/duplicate/noise keys.
  try {
    const slim: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k.endsWith('_body') || k.endsWith('_raw') || k === 'rewrite' || k === 'qa_rewrite') continue;
      if (typeof v === 'string' && v.length > 600) continue;
      slim[k] = v;
    }
    return JSON.stringify(Object.keys(slim).length ? slim : obj, null, 2);
  } catch { return raw; }
}

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
  'Ivan':                  'text-emerald-700 bg-emerald-50 border-emerald-200 font-semibold',
  'Editorial Agent':       'text-violet-700 bg-violet-50 border-violet-200',
  'LM Editorial Agent':    'text-violet-700 bg-violet-50 border-violet-200',
  'Hook Agent':            'text-sky-700 bg-sky-50 border-sky-200',
  'Content Agent':         'text-slate-700 bg-slate-50 border-slate-200',
  'Carousel Structurer':   'text-slate-700 bg-slate-50 border-slate-200',
  'Carousel Content Agent':'text-slate-700 bg-slate-50 border-slate-200',
  'QA Agent':              'text-amber-700 bg-amber-50 border-amber-200',
  'LM QA Agent':           'text-amber-700 bg-amber-50 border-amber-200',
  'Carousel QA':           'text-amber-700 bg-amber-50 border-amber-200',
  'QA HALT':               'text-red-700 bg-red-50 border-red-200',
  'Carousel QA Gate HALT': 'text-red-700 bg-red-50 border-red-200',
  'LM Cover Copy Agent':   'text-emerald-700 bg-emerald-50 border-emerald-200',
  'Image Generation':      'text-emerald-700 bg-emerald-50 border-emerald-200',
  'IG Caption Generator':  'text-pink-700 bg-pink-50 border-pink-200',
  'Scheduling Agent':      'text-cyan-700 bg-cyan-50 border-cyan-200',
  'Publisher':             'text-emerald-700 bg-emerald-50 border-emerald-200',
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
    <div className="border-t border-[var(--ds-line)] px-3 py-2 bg-[var(--ds-bg)]">
      <div className="flex items-start gap-2">
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) postNote(); }}
          placeholder="Add a note for future-you (⌘+Enter to post)…"
          rows={2}
          className="flex-1 rounded-md bg-[var(--ds-card)] border border-[var(--ds-line)] px-2.5 py-1.5 text-xs text-[var(--ds-ink)] placeholder-[var(--ds-dim)] focus:outline-none focus:border-[var(--ds-accent)] resize-none"
        />
        <button
          onClick={postNote}
          disabled={posting || !noteText.trim()}
          className="inline-flex items-center gap-1 rounded-md bg-[var(--ds-accent)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed px-2.5 py-1.5 text-xs font-medium text-white"
        >
          {posting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          Post
        </button>
      </div>
    </div>
  );

  if (sorted.length === 0) {
    return (
      <div className="rounded-md border border-[var(--ds-line)] bg-[var(--ds-card)]">
        <div className="px-3 py-2 text-xs text-[var(--ds-dim)] italic">
          No agent activity yet — entries will appear here as the generation chain runs.
        </div>
        {composer}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-[var(--ds-line)] bg-[var(--ds-card)]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--ds-ink)] hover:bg-black/[.03]"
      >
        <Sparkles className="w-3.5 h-3.5 text-violet-500" />
        Agent activity
        <span className="text-xs text-[var(--ds-dim)]">· {sorted.length} entr{sorted.length === 1 ? 'y' : 'ies'}</span>
        <span className="ml-auto text-[var(--ds-dim)]">{open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
      </button>
      {open && (
        <div className="border-t border-[var(--ds-line)] divide-y divide-[var(--ds-line)] max-h-[60vh] overflow-y-auto">
          {sorted.map((e, i) => {
            const Icon = AGENT_ICON[e.agent] || MessageSquareDashed;
            const tint = AGENT_TINT[e.agent] || 'text-slate-700 bg-slate-50 border-slate-200';
            const expanded = bodyOpen[i] ?? false;
            const display = humanizeBody(e.body || '');
            const preview = display.replace(/\s+/g, ' ').slice(0, 140);
            const truncated = display.length > 140;
            return (
              <div key={i} className={`px-3 py-1.5 hover:bg-black/[.02] transition-colors ${newKeys.has(`${e.ts}|${e.agent}`) ? 'animate-log-pulse' : ''}`}>
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium ring-1 ring-inset ${tint}`}>
                    <Icon className="w-3 h-3" /> {e.agent}
                  </span>
                  <span className="text-[var(--ds-dim)] font-mono tabular-nums text-xs">{relTime(e.ts)}</span>
                  {e.source === 'clickup_backfill' && (
                    <span className="text-xs text-[var(--ds-faint)] uppercase tracking-wider">backfill</span>
                  )}
                  {truncated && (
                    <button
                      onClick={() => setBodyOpen((s) => ({ ...s, [i]: !s[i] }))}
                      className="ml-auto text-xs text-[var(--ds-dim)] hover:text-[var(--ds-ink)] px-1.5 py-0.5 rounded hover:bg-black/[.03] transition-colors"
                    >
                      {expanded ? 'collapse' : 'expand'}
                    </button>
                  )}
                </div>
                <div className="mt-1">
                  {expanded || !truncated ? (
                    renderMarkdown
                      ? <div className="text-xs text-[var(--ds-ink)] leading-snug pl-2 border-l-2 border-[var(--ds-line)]">{renderLightMarkdown(display || '(empty)', { textClass: 'text-xs text-[var(--ds-ink)] leading-snug' })}</div>
                      : <pre className="whitespace-pre-wrap text-xs text-[var(--ds-ink)] leading-snug font-sans pl-2 border-l-2 border-[var(--ds-line)]">{display || '(empty)'}</pre>
                  ) : (
                    <p className="text-xs text-[var(--ds-dim)] line-clamp-1 pl-1">{preview}{truncated ? '…' : ''}</p>
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
