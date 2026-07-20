import React, { useState } from 'react';
import { toast } from 'sonner';
import {
  ChevronDown, ChevronUp, Sparkles, MessageSquareDashed,
  CheckCircle2, AlertTriangle, FileText, ImageIcon, Send,
  User, Loader2, Bot, Zap, Cpu, ScanLine, Megaphone,
} from 'lucide-react';
import type { AgentLogEntry } from '../../hooks/useContentLibrary';
import { supabase } from '../../lib/supabase';
import { toastError } from '../../lib/dashboardActions';
import { renderLightMarkdown } from '../../lib/lightMarkdown';

/**
 * Chronological agent run-log rendered as a vertical TIMELINE.
 * A continuous spine runs down the left; each agent event is a node on the
 * spine. Clicking a node expands its full reasoning text inline.
 */

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
  'Ivan':                   User,
  'Editorial Agent':        Sparkles,
  'LM Editorial Agent':     Sparkles,
  'Hook Agent':             MessageSquareDashed,
  'Content Agent':          FileText,
  'Carousel Structurer':    FileText,
  'Carousel Content Agent': FileText,
  'Carousel QA':            CheckCircle2,
  'QA Agent':               CheckCircle2,
  'LM QA Agent':            CheckCircle2,
  'QA HALT':                AlertTriangle,
  'Carousel QA Gate HALT':  AlertTriangle,
  'LM Cover Copy Agent':    ImageIcon,
  'Image Generation':       ImageIcon,
  'IG Caption Generator':   MessageSquareDashed,
  'Scheduling Agent':       Send,
  'Publisher':              Send,
  'AI-Slop Gate':           ScanLine,
  'Lint Gate':              Cpu,
  'Promoter':               Megaphone,
};

// Verdict/status detection — drives the node color on the spine
type NodeStatus = 'pass' | 'fail' | 'rewrite' | 'info' | 'halt';

function detectStatus(e: AgentLogEntry): NodeStatus {
  const body = (e.body || '').toUpperCase();
  const agent = (e.agent || '').toUpperCase();
  if (agent.includes('HALT')) return 'halt';
  if (body.includes('VERDICT: PASS') || body.includes('VERDICT:PASS')) return 'pass';
  if (body.includes('VERDICT: REWRITE_OK') || body.includes('VERDICT:REWRITE_OK')) return 'rewrite';
  if (body.includes('VERDICT: FAIL') || body.includes('VERDICT:FAIL') ||
      body.includes('VERDICT: NEEDS_REGENERATE') || body.includes('FAIL')) return 'fail';
  if (body.includes('APPROVED') || body.includes('STATUS: APPROVED')) return 'pass';
  if (agent.includes('PUBLISHER') || agent.includes('SCHEDULING')) return 'pass';
  return 'info';
}

// Black Box v4 register — ink dot on paper, muted for pending, red #C8361B for failure. No green.
const NODE_COLOR: Record<NodeStatus, string> = {
  pass:    'bg-[#131210] ring-[#13121026]',
  fail:    'bg-[#C8361B] ring-[#C8361B40]',
  rewrite: 'bg-[#6B675E] ring-[#13121026]',
  info:    'bg-[#B4B0A8] ring-[#13121026]',
  halt:    'bg-[#C8361B] ring-[#C8361B4D]',
};

const VERDICT_CHIP: Record<NodeStatus, { label: string; cls: string } | null> = {
  pass:    { label: 'PASS',    cls: 'text-[#131210] bg-[#FAF9F7] ring-[#1312102E]' },
  fail:    { label: 'FAIL',    cls: 'text-[#C8361B] bg-[#FAF9F7] ring-[#C8361B4D]' },
  rewrite: { label: 'REWRITE', cls: 'text-[#6B675E] bg-[#FAF9F7] ring-[#1312102E]' },
  halt:    { label: 'HALT',    cls: 'text-[#C8361B] bg-[#FAF9F7] ring-[#C8361B4D]' },
  info:    null,
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
  table?: 'carousel_drafts' | 'lm_drafts_v2' | 'client_ideas';
  rowId?: string;
  /** Called after a successful note write so the parent can refresh. */
  onNoteAdded?: () => void;
  /** Render entry bodies as markdown (paragraphs, lists, bold, code, label-prefixes)
   *  instead of the raw <pre> block. */
  renderMarkdown?: boolean;
}

const AgentLogFeed: React.FC<Props> = ({ entries, defaultOpen, table, rowId, onNoteAdded, renderMarkdown = false }) => {
  const sorted = React.useMemo(
    () => [...entries].sort((a, b) => (b.ts || '').localeCompare(a.ts || '')),
    [entries],
  );
  // Timeline reads oldest→newest top-to-bottom, so reverse the sort for display
  const chronological = React.useMemo(() => [...sorted].reverse(), [sorted]);

  const [open, setOpen] = useState(defaultOpen ?? sorted.length <= 5);
  const [bodyOpen, setBodyOpen] = useState<Record<number, boolean>>({});

  // Track new entries for pulse animation
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
    <div className="border-t border-[var(--ds-line)] px-4 py-3 bg-[var(--ds-bg)]">
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
        <div className="px-3 py-3 text-xs text-[var(--ds-dim)] italic">
          No agent activity yet — entries will appear here as the generation chain runs.
        </div>
        {composer}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-[var(--ds-line)] bg-[var(--ds-card)]">
      {/* Panel header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-[var(--ds-ink)] hover:bg-black/[.03] transition-colors"
      >
        <Sparkles className="w-3.5 h-3.5 text-[#6B675E] flex-shrink-0" />
        <span className="font-medium text-[var(--ds-ink)] text-[13px]">Agent run log</span>
        <span className="text-xs text-[var(--ds-dim)]">· {sorted.length} event{sorted.length === 1 ? '' : 's'}</span>
        <span className="ml-auto text-[var(--ds-dim)]">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {open && (
        <>
          {/* TIMELINE body */}
          <div
            className="border-t border-[var(--ds-line)] max-h-[60vh] overflow-y-auto"
            style={{ padding: '16px 16px 8px 16px' }}
          >
            {chronological.map((e, i) => {
              const Icon = AGENT_ICON[e.agent] || Bot;
              const status = detectStatus(e);
              const nodeColor = NODE_COLOR[status];
              const chip = VERDICT_CHIP[status];
              const expanded = bodyOpen[i] ?? false;
              const display = humanizeBody(e.body || '');
              const preview = display.replace(/\s+/g, ' ').slice(0, 160);
              const truncated = display.length > 160;
              const isNew = newKeys.has(`${e.ts}|${e.agent}`);
              const isLast = i === chronological.length - 1;

              return (
                <div
                  key={i}
                  className={`relative flex gap-3 ${isNew ? 'animate-log-pulse' : ''}`}
                  style={{ paddingBottom: isLast ? 8 : 20 }}
                >
                  {/* Spine + node column */}
                  <div className="flex flex-col items-center flex-shrink-0" style={{ width: 24 }}>
                    {/* Node dot */}
                    <div
                      className={`relative z-10 rounded-full ring-2 flex-shrink-0 ${nodeColor}`}
                      style={{ width: 10, height: 10, marginTop: 4 }}
                    />
                    {/* Spine line below (not rendered for last item) */}
                    {!isLast && (
                      <div
                        className="flex-1 w-px"
                        style={{ marginTop: 4, backgroundColor: 'var(--ds-line)' }}
                      />
                    )}
                  </div>

                  {/* Event content */}
                  <div className="flex-1 min-w-0" style={{ paddingBottom: 2 }}>
                    {/* Header row: icon + name + chip + timestamp */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Icon className="w-3.5 h-3.5 text-[var(--ds-dim)] flex-shrink-0" />
                      <span
                        className="font-medium text-[var(--ds-ink)]"
                        style={{ fontSize: 13 }}
                      >
                        {e.agent}
                      </span>
                      {chip && (
                        <span
                          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${chip.cls}`}
                        >
                          {chip.label}
                        </span>
                      )}
                      {e.source === 'clickup_backfill' && (
                        <span className="text-[10px] text-[var(--ds-dim)] uppercase tracking-wider">backfill</span>
                      )}
                      <span className="ml-auto text-[10px] text-[var(--ds-dim)] tabular-nums font-mono flex-shrink-0">
                        {relTime(e.ts)}
                      </span>
                    </div>

                    {/* Body preview / expand */}
                    <div className="mt-1.5">
                      {expanded || !truncated ? (
                        <>
                          {renderMarkdown ? (
                            <div
                              className="text-xs text-[var(--ds-ink)] leading-relaxed pl-2.5"
                              style={{ borderLeft: '2px solid var(--ds-line)' }}
                            >
                              {renderLightMarkdown(display || '(empty)', { textClass: 'text-xs text-[var(--ds-ink)] leading-relaxed' })}
                            </div>
                          ) : (
                            <pre
                              className="whitespace-pre-wrap text-xs text-[var(--ds-ink)] leading-relaxed font-sans pl-2.5"
                              style={{ borderLeft: '2px solid var(--ds-line)' }}
                            >
                              {display || '(empty)'}
                            </pre>
                          )}
                          {truncated && (
                            <button
                              onClick={() => setBodyOpen((s) => ({ ...s, [i]: false }))}
                              className="mt-1 text-xs text-[var(--ds-dim)] hover:text-[var(--ds-ink)] px-1 rounded hover:bg-black/[.04] transition-colors"
                            >
                              collapse
                            </button>
                          )}
                        </>
                      ) : (
                        <div>
                          <p className="text-xs text-[var(--ds-dim)] line-clamp-2 leading-snug">
                            {preview}{truncated ? '…' : ''}
                          </p>
                          <button
                            onClick={() => setBodyOpen((s) => ({ ...s, [i]: true }))}
                            className="mt-1 text-xs text-[var(--ds-dim)] hover:text-[var(--ds-ink)] px-1 rounded hover:bg-black/[.04] transition-colors"
                          >
                            expand
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {composer}
        </>
      )}
    </div>
  );
};

export default AgentLogFeed;
