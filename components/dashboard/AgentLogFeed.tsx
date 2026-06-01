import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Sparkles, MessageSquareDashed, CheckCircle2, AlertTriangle, FileText, ImageIcon, Send } from 'lucide-react';
import type { AgentLogEntry } from '../../hooks/useContentLibrary';

/**
 * Chronological agent commentary feed — mirrors the comment stream that used to
 * live in ClickUp tasks. Each entry shows ts + agent + body. Newest at top,
 * collapsed by default so the editor stays scrollable.
 *
 * The body is rendered as `<pre>` so the agents' formatted blocks (QA scores,
 * verdict bars, "━━━" separators) keep their shape exactly like ClickUp showed.
 */
const AGENT_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
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
}

const AgentLogFeed: React.FC<Props> = ({ entries, defaultOpen }) => {
  const sorted = React.useMemo(
    () => [...entries].sort((a, b) => (b.ts || '').localeCompare(a.ts || '')),
    [entries],
  );
  const [open, setOpen] = useState(defaultOpen ?? sorted.length <= 5);
  const [bodyOpen, setBodyOpen] = useState<Record<number, boolean>>({});

  if (sorted.length === 0) {
    return (
      <div className="rounded-md border border-zinc-800/60 bg-zinc-900/30 px-3 py-2 text-xs text-zinc-500 italic">
        No agent activity yet — entries will appear here as the generation chain runs.
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
        <div className="border-t border-zinc-800/60 divide-y divide-zinc-800/40 max-h-[60vh] overflow-y-auto">
          {sorted.map((e, i) => {
            const Icon = AGENT_ICON[e.agent] || MessageSquareDashed;
            const tint = AGENT_TINT[e.agent] || 'text-zinc-300 bg-zinc-800/40 border-zinc-700/30';
            const expanded = bodyOpen[i] ?? false;
            const preview = (e.body || '').replace(/\s+/g, ' ').slice(0, 180);
            const truncated = (e.body || '').length > 180;
            return (
              <div key={i} className="px-3 py-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] border ${tint}`}>
                    <Icon className="w-3 h-3" /> {e.agent}
                  </span>
                  <span className="text-[11px] text-zinc-500 font-mono">{relTime(e.ts)}</span>
                  {e.source === 'clickup_backfill' && (
                    <span className="text-[10px] text-zinc-600 uppercase tracking-wider">backfilled</span>
                  )}
                  {truncated && (
                    <button
                      onClick={() => setBodyOpen((s) => ({ ...s, [i]: !s[i] }))}
                      className="ml-auto text-[11px] text-zinc-500 hover:text-zinc-300"
                    >
                      {expanded ? 'collapse' : 'expand'}
                    </button>
                  )}
                </div>
                <div className="mt-1.5">
                  {expanded || !truncated ? (
                    <pre className="whitespace-pre-wrap text-[12px] text-zinc-300 leading-snug font-sans">{e.body || '(empty)'}</pre>
                  ) : (
                    <p className="text-[12px] text-zinc-400 line-clamp-2">{preview}{truncated ? '…' : ''}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AgentLogFeed;
