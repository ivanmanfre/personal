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

    {data.poolLabels.length > 0 && (
      <ul className="icp-pools">
        {data.poolLabels.map((label) => (
          <li key={label}>{label}</li>
        ))}
      </ul>
    )}

    <div className="icp-leads">
      <span className="icp-k">A few of them, {who}</span>
      {data.leads.map((lead) => (
        <div className="icp-lead-row" key={lead.name}>
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
