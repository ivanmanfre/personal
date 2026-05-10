// components/scan/OpportunityCard.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import type { Opportunity } from '../../lib/scanTypes';
import { Emphasized } from '../ScanReportPage';

interface Props {
  opportunity: Opportunity;
  index: number;
  prominent?: boolean;
  /** Calendly URL for the prominent card's editorial-link CTA (W1.1). Only rendered when prominent is true. */
  inlineCtaHref?: string;
}

const SERIF = '"DM Serif Display", "Bodoni Moda", Georgia, serif';
const BODY_SERIF = '"Source Serif 4", Georgia, serif';
const MONO = '"IBM Plex Mono", monospace';

export const OpportunityCard: React.FC<Props> = ({ opportunity, index, prominent = false, inlineCtaHref }) => {
  const titleSize = prominent ? 'clamp(2rem, 3.6vw, 3rem)' : 'clamp(1.4rem, 2.2vw, 1.75rem)';
  const evidenceSize = prominent ? '19px' : '17px';
  // W1.7 — money column hierarchy: dollar figure is the buying argument, must dominate visually.
  // Hours demoted to a small mono microcopy line above (was a competing italic numeral).
  const costSize = prominent ? 'clamp(3.5rem, 6vw, 5rem)' : 'clamp(2.25rem, 4vw, 3.25rem)';

  return (
    <motion.article
      initial={{ y: 18 }}
      whileInView={{ y: 0 }}
      whileHover={{ y: -2 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, ease: [0.22, 0.84, 0.36, 1], delay: index * 0.12 }}
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
            Quiet underlined sage text, not a button. Catches the prospect at arousal peak
            (right after the highest-leverage opportunity) instead of waiting for the close. */}
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
