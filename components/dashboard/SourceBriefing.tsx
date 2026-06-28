import React, { useState } from 'react';
import { ChevronDown, ChevronUp, FileText, Quote } from 'lucide-react';
import { renderLightMarkdown } from '../../lib/lightMarkdown';
import { SOURCE_LABEL } from '../../lib/ideaProjection';
import type { UpstreamSource } from '../../hooks/useUpstreamSource';

/**
 * Renders the markdown source briefing pulled from the ClickUp task description.
 * "Description / Suggested Angle / Source Story / Quotes" — the material that
 * fed the gen chain. Collapsible because some briefings run 1k+ chars.
 *
 * Uses the shared lightMarkdown renderer in editorial mode (softer headings,
 * larger body, blockquote support for "> ..." source quotes, inline link
 * support). Previously had its own renderer that lagged the shared one.
 */

interface Props {
  description: string | null;
  /** Default: closed if > 240 chars, open otherwise */
  defaultOpen?: boolean;
  /** Optional upstream-source object resolved from taxonomy (call / web / competitor / curator). */
  upstream?: UpstreamSource | null;
}

const SourceBriefing: React.FC<Props> = ({ description, defaultOpen, upstream }) => {
  const [open, setOpen] = useState(defaultOpen ?? (description ?? '').length <= 240);
  if (!description && !upstream) return null;
  const upstreamTint: Record<string, string> = {
    call: 'text-sky-700 border-sky-200',
    web_research: 'text-violet-700 border-violet-200',
    competitor: 'text-amber-700 border-amber-200',
    curator: 'text-emerald-700 border-emerald-200',
    manual: 'text-slate-600 border-slate-200',
    unknown: 'text-slate-500 border-slate-200',
  };

  return (
    <div className="rounded-md border border-[var(--ds-line)] bg-[var(--ds-card)]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--ds-ink)] hover:bg-black/[.03]"
      >
        <FileText className="w-3.5 h-3.5 text-[var(--ds-accent)]" />
        Source briefing
        {description && (
          <span className="text-xs text-[var(--ds-dim)]">· {description.length.toLocaleString()} chars</span>
        )}
        {upstream && (
          <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0 text-xs uppercase tracking-wider ${upstreamTint[upstream.kind] || upstreamTint.unknown}`}>
            from {upstream.kind.replace('_', ' ')}
          </span>
        )}
        <span className="ml-auto text-[var(--ds-dim)]">{open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
      </button>
      {open && (
        <div className="border-t border-[var(--ds-line)] px-3 py-2 max-h-[50vh] overflow-y-auto space-y-3">
          {upstream && (
            <div className="rounded border border-[var(--ds-line)] bg-[var(--ds-bg)] px-2.5 py-2">
              <div className={`text-xs uppercase tracking-wider font-medium mb-1 ${upstreamTint[upstream.kind]?.split(' ')[0] || 'text-[var(--ds-dim)]'}`}>
                Upstream · {upstream.kind.replace('_', ' ')}
              </div>
              {upstream.title && <div className="text-[13px] text-[var(--ds-ink)] font-medium mb-1">{upstream.title}</div>}
              {upstream.body && <div className="text-xs text-[var(--ds-ink)] whitespace-pre-wrap leading-snug">{upstream.body}</div>}

              {/* Signal scores — the strength band + ICP/Viral/Gap breakdown */}
              {upstream.scores && (upstream.scores.composite != null || upstream.scores.icp != null) && (
                <div className="mt-2 flex items-center gap-2 flex-wrap text-xs">
                  {upstream.strengthBand && (
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-50 ring-1 ring-inset ring-emerald-200 px-1.5 py-0.5 text-emerald-700 font-semibold">
                      {upstream.strengthBand}{upstream.scores.composite != null && <span className="text-emerald-600 font-normal">· {upstream.scores.composite}</span>}
                    </span>
                  )}
                  <span className="text-[var(--ds-dim)] tabular-nums">
                    ICP {upstream.scores.icp ?? '—'} · Viral {upstream.scores.virality ?? '—'} · Gap {upstream.scores.gap ?? '—'}
                  </span>
                </div>
              )}

              {/* Why it scored */}
              {upstream.why && (
                <div className="mt-2">
                  <div className="text-xs uppercase tracking-wider text-[var(--ds-dim)] mb-0.5">Why it scored</div>
                  <p className="text-xs leading-relaxed text-[var(--ds-ink)] italic">{upstream.why}</p>
                </div>
              )}

              {/* Editorial assessment (Opus, when run at the idea stage) */}
              {upstream.editorial && (
                <div className="mt-2">
                  <div className="text-xs uppercase tracking-wider text-[var(--ds-dim)] mb-0.5">
                    Editorial assessment{upstream.editorialStrength ? ` · ${upstream.editorialStrength}` : ''}
                  </div>
                  <p className="text-xs leading-relaxed text-[var(--ds-ink)]">{upstream.editorial}</p>
                </div>
              )}

              {/* Evidence — verbatim quotes that grounded the idea */}
              {upstream.evidence && upstream.evidence.length > 0 && (
                <div className="mt-2">
                  <div className="text-xs uppercase tracking-wider text-[var(--ds-dim)] mb-1">Evidence</div>
                  <div className="space-y-2">
                    {upstream.evidence.slice(0, 6).map((e, i) => (
                      <blockquote key={i} className="border-l-2 border-emerald-300 pl-2.5">
                        {e.quote && (
                          <p className="text-xs leading-relaxed text-[var(--ds-ink)] italic flex gap-1.5">
                            <Quote className="w-3 h-3 text-emerald-500 flex-none mt-1" />
                            <span>{e.quote}</span>
                          </p>
                        )}
                        {(e.persona || e.source) && (
                          <div className="mt-0.5 text-xs text-[var(--ds-dim)]">
                            — {[e.persona, e.source && (SOURCE_LABEL[e.source] || e.source)].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </blockquote>
                    ))}
                  </div>
                </div>
              )}

              {upstream.url && (
                <a href={upstream.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-[var(--ds-accent)] hover:opacity-75">↗ open source</a>
              )}
            </div>
          )}
          {description && renderLightMarkdown(description, { editorial: true })}
        </div>
      )}
    </div>
  );
};

export default SourceBriefing;
