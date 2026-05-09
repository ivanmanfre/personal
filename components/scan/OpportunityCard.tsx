// components/scan/OpportunityCard.tsx
import React from 'react';
import { motion } from 'framer-motion';
import type { Opportunity } from '../../lib/scanTypes';
import { Emphasized } from '../ScanReportPage';

interface Props {
  opportunity: Opportunity;
  index: number;
  prominent?: boolean;
}

const SERIF = '"DM Serif Display", "Bodoni Moda", Georgia, serif';
const BODY_SERIF = '"Source Serif 4", Georgia, serif';
const MONO = '"IBM Plex Mono", monospace';

export const OpportunityCard: React.FC<Props> = ({ opportunity, index, prominent = false }) => {
  const titleSize = prominent ? 'clamp(2rem, 3.6vw, 3rem)' : 'clamp(1.4rem, 2.2vw, 1.75rem)';
  const evidenceSize = prominent ? '19px' : '17px';
  const numeralSize = prominent ? 'clamp(3.5rem, 5.5vw, 5rem)' : 'clamp(2.25rem, 3.6vw, 3rem)';
  const costSize = prominent ? 'clamp(2.5rem, 4.5vw, 4rem)' : 'clamp(1.75rem, 3vw, 2.5rem)';

  return (
    <motion.article
      initial={{ y: 14 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.85, ease: [0.22, 0.84, 0.36, 1], delay: index * 0.04 }}
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

      {/* Right: stats rail */}
      <aside className="lg:border-l lg:border-[color:var(--color-hairline)] lg:pl-8 space-y-6">
        <div>
          <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)' }}>
            Weekly hours
          </p>
          <p style={{
            fontFamily: SERIF,
            fontStyle: 'italic',
            fontSize: numeralSize,
            lineHeight: 1,
            letterSpacing: '-0.02em',
            color: '#1A1A1A',
            marginTop: 4,
          }}>
            {opportunity.estimated_weekly_hours}<span style={{ fontStyle: 'normal', fontFamily: MONO, fontSize: '14px', color: 'rgba(26,26,26,0.65)', marginLeft: 6 }}>h</span>
          </p>
        </div>
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
            marginTop: 4,
          }}>
            ${opportunity.estimated_monthly_cost.toLocaleString()}
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
    </motion.article>
  );
};
