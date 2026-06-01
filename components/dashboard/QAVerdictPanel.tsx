import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import type { AgentLogEntry } from '../../hooks/useContentLibrary';

// Parsed shape of one QA iteration extracted from agent_log.
type QAIteration = {
  ts: string | null;
  agent: string;          // QA Agent / LM QA Agent / Carousel QA / *HALT*
  body: string;
  status?: string;        // NEEDS REVISION / APPROVED
  verdict?: string;       // PASS / FAIL / REWRITE_OK
  score?: number;         // 1-10
  issuesCount?: number;
  isHalt: boolean;
};

const QA_AGENTS = new Set([
  'QA Agent', 'LM QA Agent', 'Carousel QA',
  'QA HALT', 'Carousel QA Gate HALT',
]);

function parseIteration(e: AgentLogEntry): QAIteration {
  const body = e.body || '';
  const status = body.match(/Status:\s*([A-Z][A-Z ]+)/)?.[1]?.trim();
  const verdict = body.match(/VERDICT:\s*([A-Z_]+)/)?.[1]?.trim();
  const scoreStr = body.match(/SCORE:\s*(\d+(?:\.\d+)?)/)?.[1];
  const score = scoreStr ? Number(scoreStr) : undefined;
  // Count enumerated items under "ISSUES:" section (lines like "1.", "2." up to the next section).
  let issuesCount: number | undefined;
  const issuesMatch = body.match(/ISSUES:\s*([\s\S]*?)(?:\n\s*\n|SUGGESTIONS:|REWRITE:|$)/i);
  if (issuesMatch) {
    issuesCount = (issuesMatch[1].match(/^\s*\d+[.)]/gm) || []).length;
  }
  return {
    ts: e.ts,
    agent: e.agent,
    body,
    status,
    verdict,
    score,
    issuesCount,
    isHalt: /HALT/i.test(e.agent),
  };
}

function verdictTone(it: QAIteration): { tone: string; label: string; Icon: React.ComponentType<{ className?: string }> } {
  if (it.isHalt) return { tone: 'text-red-300 bg-red-500/10 border-red-500/30', label: 'HALT', Icon: AlertTriangle };
  const v = (it.verdict || '').toUpperCase();
  if (v === 'PASS' || v === 'REWRITE_OK' || (it.status || '').includes('APPROV')) {
    return { tone: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30', label: v || 'APPROVED', Icon: CheckCircle2 };
  }
  return { tone: 'text-amber-300 bg-amber-500/10 border-amber-500/30', label: v || 'REVISION', Icon: RefreshCw };
}

function relTime(iso: string | null): string {
  if (!iso) return '';
  try {
    const t = new Date(iso).getTime();
    if (!t) return '';
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' +
           d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  } catch { return iso; }
}

type Props = {
  entries: AgentLogEntry[];
};

const QAVerdictPanel: React.FC<Props> = ({ entries }) => {
  const iterations = useMemo<QAIteration[]>(() => {
    return (entries || [])
      .filter((e) => QA_AGENTS.has(e.agent))
      .sort((a, b) => (a.ts || '').localeCompare(b.ts || ''))
      .map(parseIteration);
  }, [entries]);

  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [open, setOpen] = useState<boolean>(true);

  if (!iterations.length) return null;

  const final = iterations[iterations.length - 1];
  const finalTone = verdictTone(final);
  const FinalIcon = finalTone.Icon;
  const scores = iterations.map((it) => it.score).filter((n): n is number => typeof n === 'number');
  const scoreDelta = scores.length >= 2 ? scores[scores.length - 1] - scores[0] : null;

  return (
    <div className="rounded-md border border-zinc-800/60 bg-zinc-900/30 overflow-hidden">
      {/* Summary header — single-line latest verdict + iteration count + score trend */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-900 transition-colors text-left"
      >
        <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] border ${finalTone.tone}`}>
          <FinalIcon className="w-3 h-3" /> {finalTone.label}
        </span>
        {typeof final.score === 'number' && (
          <span className="text-[11px] text-zinc-400">score <span className="text-zinc-200 font-medium tabular-nums">{final.score}/10</span></span>
        )}
        <span className="text-[11px] text-zinc-500">
          · {iterations.length} iteration{iterations.length === 1 ? '' : 's'}
        </span>
        {scoreDelta !== null && scoreDelta !== 0 && (
          <span className={`text-[11px] tabular-nums ${scoreDelta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {scoreDelta > 0 ? '+' : ''}{scoreDelta.toFixed(1)} since first pass
          </span>
        )}
        <span className="ml-auto text-zinc-500">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {open && (
        <div className="border-t border-zinc-800/60">
          {/* Mini score-over-iterations sparkline (only if 2+ scores) */}
          {scores.length >= 2 && (
            <div className="px-3 py-2 border-b border-zinc-800/40 flex items-center gap-1.5">
              {iterations.map((it, i) => {
                const t = verdictTone(it);
                const Icon = t.Icon;
                return (
                  <div key={i} className="flex items-center gap-1">
                    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] border ${t.tone}`}>
                      <Icon className="w-2.5 h-2.5" />
                      {typeof it.score === 'number' ? `${it.score}/10` : t.label.slice(0, 4)}
                    </span>
                    {i < iterations.length - 1 && (
                      <span className="text-zinc-700 text-[10px]">→</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {/* Per-iteration rows */}
          <div className="divide-y divide-zinc-800/40">
            {iterations.map((it, i) => {
              const t = verdictTone(it);
              const Icon = t.Icon;
              const isExpanded = expandedIdx === i;
              return (
                <div key={i} className="px-3 py-2">
                  <button
                    onClick={() => setExpandedIdx(isExpanded ? null : i)}
                    className="w-full flex items-center gap-2 text-left"
                  >
                    <span className="text-[11px] text-zinc-500 font-mono w-5 tabular-nums">#{i + 1}</span>
                    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] border ${t.tone}`}>
                      <Icon className="w-3 h-3" /> {t.label}
                    </span>
                    {typeof it.score === 'number' && (
                      <span className="text-[11px] text-zinc-300 tabular-nums">{it.score}/10</span>
                    )}
                    {typeof it.issuesCount === 'number' && it.issuesCount > 0 && (
                      <span className="text-[11px] text-zinc-500">· {it.issuesCount} issue{it.issuesCount === 1 ? '' : 's'}</span>
                    )}
                    <span className="text-[11px] text-zinc-600 ml-auto font-mono">{relTime(it.ts)}</span>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />}
                  </button>
                  {isExpanded && (
                    <pre className="mt-2 whitespace-pre-wrap text-[12px] text-zinc-300 leading-snug font-sans bg-zinc-950/60 border border-zinc-800/60 rounded p-2 max-h-[420px] overflow-y-auto">
                      {it.body || '(empty)'}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default QAVerdictPanel;
