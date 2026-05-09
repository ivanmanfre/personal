// components/scan/OpportunityCard.tsx
import React from 'react';
import type { Opportunity } from '../../lib/scanTypes';

interface Props {
  opportunity: Opportunity;
  index: number;
}

const SERIF = '"DM Serif Display", "Bodoni Moda", Georgia, serif';
const BODY_SERIF = '"Source Serif 4", Georgia, serif';
const MONO = '"IBM Plex Mono", monospace';

export const OpportunityCard: React.FC<Props> = ({ opportunity, index }) => {
  return (
    <article className="grid lg:grid-cols-[1fr_220px] gap-8 lg:gap-12 py-10 border-t border-[color:var(--color-hairline)] first:border-t-0">
      {/* Left: prose */}
      <div className="space-y-5 min-w-0">
        <div>
          <p style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.6)' }}>
            Opportunity {String(index + 1).padStart(2, '0')} · {opportunity.signal_source}
          </p>
          <h3 style={{
            fontFamily: SERIF,
            fontWeight: 400,
            fontSize: 'clamp(1.5rem, 2.4vw, 1.875rem)',
            lineHeight: 1.15,
            letterSpacing: '-0.015em',
            color: '#1A1A1A',
            marginTop: 8,
          }}>
            {opportunity.title}
          </h3>
        </div>

        <div>
          <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.6)', marginBottom: 6 }}>
            Evidence
          </p>
          <blockquote style={{
            fontFamily: BODY_SERIF,
            fontSize: '17px',
            lineHeight: 1.6,
            color: '#3D3D3B',
            fontStyle: 'italic',
            borderLeft: '2px solid var(--color-accent)',
            paddingLeft: '14px',
          }}>
            "{opportunity.evidence}"
          </blockquote>
        </div>

        <div>
          <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.6)', marginBottom: 6 }}>
            What replaces it
          </p>
          <p style={{ fontFamily: BODY_SERIF, fontSize: '17px', lineHeight: 1.6, color: '#3D3D3B' }}>
            {opportunity.automation_solution}
          </p>
        </div>
      </div>

      {/* Right: stats rail */}
      <aside className="lg:border-l lg:border-[color:var(--color-hairline)] lg:pl-8 space-y-6">
        <div>
          <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.6)' }}>
            Weekly hours
          </p>
          <p style={{
            fontFamily: SERIF,
            fontStyle: 'italic',
            fontSize: 'clamp(2.5rem, 4vw, 3.5rem)',
            lineHeight: 1,
            letterSpacing: '-0.02em',
            color: '#1A1A1A',
            marginTop: 4,
          }}>
            {opportunity.estimated_weekly_hours}<span style={{ fontStyle: 'normal', fontFamily: MONO, fontSize: '14px', color: 'rgba(26,26,26,0.6)', marginLeft: 6 }}>h</span>
          </p>
        </div>
        <div>
          <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.6)' }}>
            Monthly cost
          </p>
          <p style={{
            fontFamily: SERIF,
            fontStyle: 'italic',
            fontSize: 'clamp(2rem, 3.4vw, 2.75rem)',
            lineHeight: 1,
            letterSpacing: '-0.02em',
            color: 'var(--color-accent)',
            marginTop: 4,
          }}>
            ${opportunity.estimated_monthly_cost.toLocaleString()}
          </p>
        </div>
        <div>
          <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.6)' }}>
            ROI
          </p>
          <p style={{ fontFamily: BODY_SERIF, fontSize: '15px', lineHeight: 1.5, color: '#3D3D3B', marginTop: 4 }}>
            {opportunity.roi_estimate}
          </p>
        </div>
      </aside>
    </article>
  );
};
