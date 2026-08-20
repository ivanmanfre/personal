// components/ui/IcpTargetingBlock.tsx
import React from 'react';
import type { DerivedIcpTargeting } from '../../lib/icpTargeting';

// The targeting read for Chapter 03. Every value here is derived upstream by
// deriveIcpTargeting, which fails closed. This component makes no decisions about
// whether there is enough evidence to show; it only draws what it is handed.
const IcpTargetingBlock: React.FC<{ data: DerivedIcpTargeting; who: string }> = ({ data, who }) => (
  <div className="icp-block" style={{ marginTop: 'clamp(24px,3vw,36px)' }}>
    <div className="icp-lead">
      <span className="icp-k">Who we go after for you</span>
      <p className="icp-line">{data.icpLine}</p>
    </div>

    {/* The niche cut. This is the only part of the block that changes shape with the
        prospect's industry, so it earns its own register: an ecommerce agency's segments
        and a mobile UA studio's segments should look nothing alike here. Segments are
        optional upstream, so an empty list renders nothing rather than an empty frame. */}
    {data.segments.length > 0 && (
      <ol className="icp-segs">
        {data.segments.map((seg, i) => (
          <li key={`${i}-${seg.label}`}>
            <span className="icp-seg-n">{String(i + 1).padStart(2, '0')}</span>
            <span className="icp-seg-label">{seg.label}</span>
            {seg.note && <span className="icp-seg-note">{seg.note}</span>}
          </li>
        ))}
      </ol>
    )}

    {data.poolLabels.length > 0 && (
      <div className="icp-pool-wrap">
        {/* The pools are a fact about our delivery, identical for every client, which is
            why they are set upstream rather than read off this prospect. The heading says
            where we look, never how many we expect to find there. */}
        <span className="icp-k">Where we find them</span>
        <ul className="icp-pools">
          {data.poolLabels.map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
      </div>
    )}

    <div className="icp-leads">
      {/* Claims provenance, never a match. These names come from audience.named, which is
          counted audience data; nothing here checks any one of them against the ICP line
          above, so this heading must not imply that it did. */}
      <span className="icp-k">Real people already around you, {who}</span>
      {data.leads.map((lead, i) => (
        <div className="icp-lead-row" key={`${i}-${lead.name}`}>
          <span className="icp-name">{lead.name}</span>
          <span className="icp-headline">{lead.headline}</span>
          <span className="icp-reason">{lead.reason}</span>
        </div>
      ))}
    </div>

    <p className="icp-gov">
      Every profile gets a liveness check before it enters the send queue, and the lane runs
      under a fixed weekly cap on your account. Warm sends land at about 30% acceptance across
      the lanes we run. Cold sits near 10%, which is why we keep the pool warm.
    </p>
  </div>
);

export default IcpTargetingBlock;
