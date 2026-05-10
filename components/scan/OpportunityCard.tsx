// components/scan/OpportunityCard.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Plus, Minus } from 'lucide-react';
import type { Opportunity } from '../../lib/scanTypes';
import { Emphasized } from '../ScanReportPage';

interface Props {
  opportunity: Opportunity;
  index: number;
  prominent?: boolean;
  /** Calendly URL for the prominent card's editorial-link CTA (W1.1). Only rendered when prominent is true. */
  inlineCtaHref?: string;
  /** When true, render as a collapsed summary row that expands on click. Top card uses prominent (always full); cards 2-5 use collapsibleByDefault. */
  collapsibleByDefault?: boolean;
  /** P0.4 — count microcopy: when set, this card renders a "+N more · click to expand" header above the row to signal there are collapsed siblings. Only set on the FIRST collapsible card (typically index 1). */
  collapsedCount?: number;
}

const SERIF = '"DM Serif Display", "Bodoni Moda", Georgia, serif';
const BODY_SERIF = '"Source Serif 4", Georgia, serif';
const MONO = '"IBM Plex Mono", monospace';
const EASE = [0.22, 0.84, 0.36, 1] as const;

export const OpportunityCard: React.FC<Props> = ({
  opportunity, index, prominent = false, inlineCtaHref, collapsibleByDefault = false, collapsedCount,
}) => {
  const [expanded, setExpanded] = useState(!collapsibleByDefault);

  const titleSize = prominent ? 'clamp(2rem, 3.6vw, 3rem)' : 'clamp(1.4rem, 2.2vw, 1.75rem)';
  const evidenceSize = prominent ? '19px' : '17px';
  // W1.7 — money column hierarchy: dollar figure dominates.
  const costSize = prominent ? 'clamp(3.5rem, 6vw, 5rem)' : 'clamp(2rem, 3.4vw, 2.75rem)';

  // Collapsed row: kicker + title + dollar figure on the right. Click row to expand.
  // Top card (prominent) is never collapsible; renders full content always.
  if (collapsibleByDefault) {
    return (
      <motion.article
        initial={{ y: 12 }}
        whileInView={{ y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.5, ease: EASE, delay: Math.min(index, 4) * 0.06 }}
        className="border-t border-[color:var(--color-hairline)]"
      >
        {/* P0.4 — count microcopy on the FIRST collapsed card. Signals to the reader that
            the rows below are interactive and there are N hidden details. Without this,
            UX + Visual specialists both flagged the affordance as too quiet. */}
        {collapsedCount != null && collapsedCount > 0 && (
          <p className="pt-4" style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.55)' }}>
            +{collapsedCount} more · click any to expand
          </p>
        )}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="w-full grid grid-cols-[1fr_auto_24px] gap-4 sm:gap-8 items-baseline py-5 sm:py-6 text-left transition-colors hover:bg-[rgba(76,110,61,0.04)] focus:outline-none focus-visible:bg-[rgba(76,110,61,0.06)] -mx-3 px-3"
        >
          <div className="min-w-0">
            <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.55)' }}>
              {`Opportunity ${String(index + 1).padStart(2, '0')}`} · {opportunity.signal_source}
            </p>
            <h3 style={{
              fontFamily: SERIF, fontWeight: 400,
              fontSize: 'clamp(1.25rem, 2vw, 1.6rem)',
              lineHeight: 1.15, letterSpacing: '-0.015em',
              color: '#1A1A1A', marginTop: 6,
            }}>
              {opportunity.title}
            </h3>
          </div>
          <p style={{
            fontFamily: SERIF, fontStyle: 'italic',
            fontSize: 'clamp(1.5rem, 2.4vw, 2rem)', lineHeight: 1,
            color: 'var(--color-accent)', whiteSpace: 'nowrap',
          }}>
            ${opportunity.estimated_monthly_cost.toLocaleString()}
            <span style={{ fontFamily: MONO, fontSize: '10px', color: 'rgba(26,26,26,0.55)', marginLeft: 6, fontStyle: 'normal' }}>/mo</span>
          </p>
          <span aria-hidden style={{ color: 'rgba(26,26,26,0.55)' }}>
            {expanded ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </span>
        </button>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key="content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.32, ease: EASE }}
              style={{ overflow: 'hidden' }}
            >
              <div className="grid lg:grid-cols-[1fr_240px] gap-8 lg:gap-14 pb-8 pt-2">
                <div className="space-y-5 min-w-0">
                  <div>
                    <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)', marginBottom: 6 }}>
                      Evidence
                    </p>
                    <blockquote style={{
                      fontFamily: BODY_SERIF, fontSize: evidenceSize, lineHeight: 1.6,
                      color: '#3D3D3B', fontStyle: 'italic',
                      borderLeft: '2px solid var(--color-accent)', paddingLeft: '14px',
                    }}>
                      "<Emphasized>{opportunity.evidence}</Emphasized>"
                    </blockquote>
                  </div>
                  <div>
                    <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)', marginBottom: 6 }}>
                      What replaces it
                    </p>
                    <p style={{ fontFamily: BODY_SERIF, fontSize: '17px', lineHeight: 1.6, color: '#3D3D3B' }}>
                      <Emphasized>{opportunity.automation_solution}</Emphasized>
                    </p>
                  </div>
                </div>
                <aside className="lg:border-l lg:border-[color:var(--color-hairline)] lg:pl-8 space-y-4">
                  <div>
                    <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.16em', color: 'rgba(26,26,26,0.55)', textTransform: 'uppercase' }}>
                      {opportunity.estimated_weekly_hours}h / week of leverage lost
                    </p>
                  </div>
                  <div>
                    <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)' }}>
                      ROI
                    </p>
                    <p style={{ fontFamily: BODY_SERIF, fontSize: '15px', lineHeight: 1.5, color: '#3D3D3B', marginTop: 4 }}>
                      <Emphasized>{opportunity.roi_estimate}</Emphasized>
                    </p>
                  </div>
                </aside>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.article>
    );
  }

  // Prominent (top card) — always expanded, full-bleed sage tint, large numerals
  return (
    <motion.article
      initial={{ y: 18 }}
      whileInView={{ y: 0 }}
      whileHover={{ y: -2 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, ease: EASE, delay: index * 0.12 }}
      className={`grid lg:grid-cols-[1fr_240px] gap-8 lg:gap-14 ${prominent ? 'py-14 my-2 px-6 lg:px-10 -mx-6 lg:-mx-10' : 'py-10 border-t border-[color:var(--color-hairline)]'}`}
      style={prominent ? {
        background: 'rgba(76,110,61,0.04)',
        borderLeft: '3px solid var(--color-accent)',
      } : undefined}
    >
      {/* Left: prose */}
      <div className="space-y-5 min-w-0">
        <div>
          <p style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: prominent ? 'var(--color-accent)' : 'rgba(26,26,26,0.65)' }}>
            {prominent ? 'Top priority' : `Opportunity ${String(index + 1).padStart(2, '0')}`} · {opportunity.signal_source}
          </p>
          <h3 style={{
            fontFamily: SERIF,
            fontWeight: 400,
            fontSize: titleSize,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            color: '#1A1A1A',
            marginTop: prominent ? 12 : 8,
          }}>
            {opportunity.title}
          </h3>
        </div>

        <div>
          <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)', marginBottom: 6 }}>
            Evidence
          </p>
          <blockquote style={{
            fontFamily: BODY_SERIF,
            fontSize: evidenceSize,
            lineHeight: 1.6,
            color: '#3D3D3B',
            fontStyle: 'italic',
            borderLeft: '2px solid var(--color-accent)',
            paddingLeft: '14px',
          }}>
            "<Emphasized>{opportunity.evidence}</Emphasized>"
          </blockquote>
        </div>

        <div>
          <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)', marginBottom: 6 }}>
            What replaces it
          </p>
          <p style={{ fontFamily: BODY_SERIF, fontSize: '17px', lineHeight: 1.6, color: '#3D3D3B' }}>
            <Emphasized>{opportunity.automation_solution}</Emphasized>
          </p>
        </div>
      </div>

      {/* Right: stats rail. W1.7 — dollar figure dominates; hours becomes microcopy. */}
      <aside className="lg:border-l lg:border-[color:var(--color-hairline)] lg:pl-8 space-y-5">
        {/* Cost — visually dominant */}
        <div>
          <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)' }}>
            Costing you monthly
          </p>
          <p style={{
            fontFamily: SERIF,
            fontStyle: 'italic',
            fontSize: costSize,
            lineHeight: 1,
            letterSpacing: '-0.02em',
            color: 'var(--color-accent)',
            marginTop: 6,
          }}>
            ${opportunity.estimated_monthly_cost.toLocaleString()}
          </p>
          <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.16em', color: 'rgba(26,26,26,0.55)', marginTop: 8, textTransform: 'uppercase' }}>
            {opportunity.estimated_weekly_hours}h / week of leverage lost
          </p>
        </div>
        {/* ROI body */}
        <div>
          <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)' }}>
            ROI
          </p>
          <p style={{ fontFamily: BODY_SERIF, fontSize: '15px', lineHeight: 1.5, color: '#3D3D3B', marginTop: 4 }}>
            <Emphasized>{opportunity.roi_estimate}</Emphasized>
          </p>
        </div>

        {/* W1.1 — Editorial-link inline CTA on the prominent card only.
            Quiet underlined sage text, not a button. Catches the prospect at arousal peak. */}
        {prominent && inlineCtaHref && (
          <a
            href={inlineCtaHref}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-baseline gap-1.5 pt-3"
            style={{
              fontFamily: BODY_SERIF,
              fontSize: '14px',
              fontStyle: 'italic',
              color: 'var(--color-accent)',
              borderTop: '1px solid rgba(76,110,61,0.25)',
              textDecoration: 'underline',
              textUnderlineOffset: '3px',
              textDecorationColor: 'rgba(76,110,61,0.4)',
            }}
          >
            See how the Assessment scopes this <ArrowRight className="w-3 h-3 self-center transition-transform group-hover:translate-x-0.5" />
          </a>
        )}
      </aside>
    </motion.article>
  );
};
