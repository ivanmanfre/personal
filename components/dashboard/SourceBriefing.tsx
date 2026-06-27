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
    call: 'text-sky-300 border-sky-500/30',
    web_research: 'text-violet-300 border-violet-500/30',
    competitor: 'text-amber-300 border-amber-500/30',
    curator: 'text-emerald-300 border-emerald-500/30',
    manual: 'text-zinc-300 border-zinc-700/30',
    unknown: 'text-zinc-400 border-zinc-700/30',
  };

  return (
    <div className="rounded-md border border-zinc-800/60 bg-zinc-900/30">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
      >
        <FileText className="w-3.5 h-3.5 text-emerald-400/70" />
        Source briefing
        {description && (
          <span className="text-[11px] text-zinc-500">· {description.length.toLocaleString()} chars</span>
        )}
        {upstream && (
          <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0 text-[10px] uppercase tracking-wider ${upstreamTint[upstream.kind] || upstreamTint.unknown}`}>
            from {upstream.kind.replace('_', ' ')}
          </span>
        )}
        <span className="ml-auto text-zinc-500">{open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
      </button>
      {open && (
        <div className="border-t border-zinc-800/60 px-3 py-2 max-h-[50vh] overflow-y-auto space-y-3">
          {upstream && (
            <div className="rounded border border-zinc-800/60 bg-zinc-950/50 px-2.5 py-2">
              <div className={`text-[10px] uppercase tracking-wider font-medium mb-1 ${upstreamTint[upstream.kind]?.split(' ')[0] || 'text-zinc-400'}`}>
                Upstream · {upstream.kind.replace('_', ' ')}
              </div>
              {upstream.title && <div className="text-[12.5px] text-zinc-200 font-medium mb-1">{upstream.title}</div>}
              {upstream.body && <div className="text-[12px] text-zinc-300 whitespace-pre-wrap leading-snug">{upstream.body}</div>}

              {/* Signal scores — the strength band + ICP/Viral/Gap breakdown */}
              {upstream.scores && (upstream.scores.composite != null || upstream.scores.icp != null) && (
                <div className="mt-2 flex items-center gap-2 flex-wrap text-[11px]">
                  {upstream.strengthBand && (
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 ring-1 ring-inset ring-emerald-500/30 px-1.5 py-0.5 text-emerald-200 font-semibold">
                      {upstream.strengthBand}{upstream.scores.composite != null && <span className="text-emerald-300/60 font-normal">· {upstream.scores.composite}</span>}
                    </span>
                  )}
                  <span className="text-zinc-400 tabular-nums">
                    ICP {upstream.scores.icp ?? '—'} · Viral {upstream.scores.virality ?? '—'} · Gap {upstream.scores.gap ?? '—'}
                  </span>
                </div>
              )}

              {/* Why it scored */}
              {upstream.why && (
                <div className="mt-2">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">Why it scored</div>
                  <p className="text-[12px] leading-relaxed text-zinc-300 italic">{upstream.why}</p>
                </div>
              )}

              {/* Editorial assessment (Opus, when run at the idea stage) */}
              {upstream.editorial && (
                <div className="mt-2">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">
                    Editorial assessment{upstream.editorialStrength ? ` · ${upstream.editorialStrength}` : ''}
                  </div>
                  <p className="text-[12px] leading-relaxed text-zinc-300">{upstream.editorial}</p>
                </div>
              )}

              {/* Evidence — verbatim quotes that grounded the idea */}
              {upstream.evidence && upstream.evidence.length > 0 && (
                <div className="mt-2">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Evidence</div>
                  <div className="space-y-2">
                    {upstream.evidence.slice(0, 6).map((e, i) => (
                      <blockquote key={i} className="border-l-2 border-emerald-500/60 pl-2.5">
                        {e.quote && (
                          <p className="text-[12px] leading-relaxed text-zinc-300 italic flex gap-1.5">
                            <Quote className="w-3 h-3 text-emerald-500/70 flex-none mt-1" />
                            <span>{e.quote}</span>
                          </p>
                        )}
                        {(e.persona || e.source) && (
                          <div className="mt-0.5 text-[10.5px] text-zinc-500">
                            — {[e.persona, e.source && (SOURCE_LABEL[e.source] || e.source)].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </blockquote>
                    ))}
                  </div>
                </div>
              )}

              {upstream.url && (
                <a href={upstream.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[11px] text-emerald-400 hover:text-emerald-300">↗ open source</a>
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
