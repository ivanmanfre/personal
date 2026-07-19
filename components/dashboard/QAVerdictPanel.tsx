import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import type { AgentLogEntry } from '../../hooks/useContentLibrary';
import { renderLightMarkdown } from '../../lib/lightMarkdown';

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
  rewrite?: string;       // extracted REWRITE: block — what auto-publish shipped
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
  // Extract REWRITE: block — when present + verdict is REWRITE_OK this is what
  // the auto-publish pipeline actually shipped. Surfacing it closes the voice-
  // drift blind spot where rewrites land silently with no pre/post comparison.
  const rewriteMatch = body.match(/REWRITE:\s*([\s\S]*?)(?:\n\s*\n[A-Z]{3,}:|END[\s_]*REWRITE|VOICE|$)/i);
  const rewrite = rewriteMatch?.[1]?.trim() || undefined;
  return {
    ts: e.ts,
    agent: e.agent,
    body,
    status,
    verdict,
    score,
    issuesCount,
    isHalt: /HALT/i.test(e.agent),
    rewrite: rewrite && rewrite.length > 30 ? rewrite : undefined,
  };
}

// Map raw QA verdict codes to readable labels (presentation only).
const VERDICT_LABEL: Record<string, string> = {
  PASS: 'Passed',
  REWRITE_OK: 'Auto-rewritten',
  NEEDS_REGENERATE: 'Needs another pass',
  FAIL: 'Needs another pass',
  APPROVED: 'Approved',
};
function prettyVerdict(v: string, fallback: string): string {
  if (!v) return fallback;
  if (VERDICT_LABEL[v]) return VERDICT_LABEL[v];
  return v.replace(/_/g, ' ').toLowerCase().replace(/\b\w/, (c) => c.toUpperCase());
}

function verdictTone(it: QAIteration): { tone: string; label: string; Icon: React.ComponentType<{ className?: string }> } {
  // Black Box v4 register — red #C8361B for halt, ink on paper for pass (no green), muted ink for revision.
  if (it.isHalt) return { tone: 'text-[#C8361B] bg-[#FAF9F7] border-[#C8361B4D]', label: 'Halted', Icon: AlertTriangle };
  const v = (it.verdict || '').toUpperCase();
  if (v === 'PASS' || v === 'REWRITE_OK' || (it.status || '').includes('APPROV')) {
    return { tone: 'text-[#131210] bg-[#FAF9F7] border-[#1312102E]', label: prettyVerdict(v, 'Approved'), Icon: CheckCircle2 };
  }
  return { tone: 'text-[#6B675E] bg-[#FAF9F7] border-[#1312102E]', label: prettyVerdict(v, 'Needs revision'), Icon: RefreshCw };
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
    <div className="rounded-md border border-[var(--ds-line)] bg-[var(--ds-card)] overflow-hidden">
      {/* Summary header — single-line latest verdict + iteration count + score trend */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-black/[.03] transition-colors text-left"
      >
        <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs border ${finalTone.tone}`}>
          <FinalIcon className="w-3 h-3" /> {finalTone.label}
        </span>
        {typeof final.score === 'number' && (
          <span className="text-xs text-[var(--ds-dim)]">score <span className="text-[var(--ds-ink)] font-medium tabular-nums">{final.score}/10</span></span>
        )}
        <span className="text-xs text-[var(--ds-dim)]">
          · {iterations.length} iteration{iterations.length === 1 ? '' : 's'}
        </span>
        {scoreDelta !== null && scoreDelta !== 0 && (
          <span className={`text-xs tabular-nums ${scoreDelta > 0 ? 'text-[#131210]' : 'text-[#C8361B]'}`}>
            {scoreDelta > 0 ? '+' : ''}{scoreDelta.toFixed(1)} since first pass
          </span>
        )}
        <span className="ml-auto text-[var(--ds-dim)]">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {open && (
        <div className="border-t border-[var(--ds-line)]">
          {/* Mini score-over-iterations sparkline (only if 2+ scores) */}
          {scores.length >= 2 && (
            <div className="px-3 py-2 border-b border-[var(--ds-line)] flex items-center gap-1.5">
              {iterations.map((it, i) => {
                const t = verdictTone(it);
                const Icon = t.Icon;
                return (
                  <div key={i} className="flex items-center gap-1">
                    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs border ${t.tone}`}>
                      <Icon className="w-2.5 h-2.5" />
                      {typeof it.score === 'number' ? `${it.score}/10` : t.label.slice(0, 4)}
                    </span>
                    {i < iterations.length - 1 && (
                      <span className="text-[var(--ds-dim)] text-xs">→</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {/* Per-iteration rows — compact one-liners with expandable body */}
          <div className="divide-y divide-[var(--ds-line)]">
            {iterations.map((it, i) => {
              const t = verdictTone(it);
              const Icon = t.Icon;
              const isExpanded = expandedIdx === i;
              return (
                <div key={i} className="px-3 py-1 hover:bg-black/[.02] transition-colors">
                  <button
                    onClick={() => setExpandedIdx(isExpanded ? null : i)}
                    className="w-full flex items-center gap-1.5 text-left text-xs"
                  >
                    <span className="text-[var(--ds-dim)] font-mono w-4 tabular-nums text-xs">#{i + 1}</span>
                    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium ring-1 ring-inset ${t.tone}`}>
                      <Icon className="w-2.5 h-2.5" /> {t.label}
                    </span>
                    {typeof it.score === 'number' && (
                      <span className="text-[var(--ds-ink)] tabular-nums font-medium">{it.score}/10</span>
                    )}
                    {typeof it.issuesCount === 'number' && it.issuesCount > 0 && (
                      <span className="text-[var(--ds-dim)]">{it.issuesCount}↯</span>
                    )}
                    {it.rewrite && (
                      <span className="text-[#6B675E] text-xs" title="A rewrite was applied">rewrite</span>
                    )}
                    <span className="text-[var(--ds-dim)] ml-auto font-mono tabular-nums text-xs">{relTime(it.ts)}</span>
                    {isExpanded ? <ChevronUp className="w-3 h-3 text-[var(--ds-dim)]" /> : <ChevronDown className="w-3 h-3 text-[var(--ds-dim)]" />}
                  </button>
                  {isExpanded && (
                    <div className="mt-1 ml-5 pl-2 border-l-2 border-[var(--ds-line)] text-xs text-[var(--ds-ink)] leading-snug max-h-[360px] overflow-y-auto space-y-2">
                      {it.rewrite && (
                        <div className="rounded border-l-[3px] border-[#1312102E] bg-[#FAF9F7] pl-2 pr-2 py-1.5 -ml-2">
                          <div className="text-xs uppercase tracking-wider text-[#6B675E] mb-1">
                            Applied rewrite (what auto-publish shipped)
                          </div>
                          <div className="whitespace-pre-wrap text-[var(--ds-ink)] text-xs leading-snug">{it.rewrite}</div>
                        </div>
                      )}
                      {renderLightMarkdown(it.body || '(empty)', { textClass: 'text-xs text-[var(--ds-ink)] leading-snug' })}
                    </div>
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
