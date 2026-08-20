// components/ui/ColdOutboundBlock.tsx
import React from 'react';
import type { DerivedColdOutbound } from '../../lib/icpTargeting';

// Chapter 04's body. The warm chapter above it shows people the founder already has;
// this shows the list we build from people who have never heard of them. Presentational
// only: deriveColdOutbound decides whether there is enough here to render at all.
const ColdOutboundBlock: React.FC<{ data: DerivedColdOutbound; who: string }> = ({ data, who }) => (
  <div className="cold-block" style={{ marginTop: 'clamp(24px,3vw,36px)' }}>
    <div className="cold-lead">
      <span className="cold-k">How we build your cold list, {who}</span>
      <p className="cold-note">{data.note}</p>
    </div>

    <ol className="cold-srcs">
      {data.sources.map((src, i) => (
        <li key={`${i}-${src.label}`}>
          <span className="cold-src-n">{String(i + 1).padStart(2, '0')}</span>
          <span className="cold-src-label">{src.label}</span>
          {src.detail && <span className="cold-src-detail">{src.detail}</span>}
        </li>
      ))}
    </ol>

    {data.filters.length > 0 && (
      <div className="cold-cut">
        {/* Names what we throw away, never how much. Nothing upstream counted a pool for
            this prospect, so a volume claim here would be unbacked. */}
        <span className="cold-k">What we cut before anyone gets a message</span>
        <ul className="cold-cut-list">
          {data.filters.map((f, i) => (
            <li key={`${i}-${f}`}>{f}</li>
          ))}
        </ul>
      </div>
    )}
  </div>
);

export default ColdOutboundBlock;
