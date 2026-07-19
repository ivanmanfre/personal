import React from 'react';
import '../../editorial-cockpit.css';
import './positioning/positioning.css';
import { useStrategyMap } from '../../../../hooks/useStrategyMap';
import { PositioningOfferDoc } from './positioning/PositioningOfferDoc';
import { OfferLadder } from './positioning/OfferLadder';
import { FunnelTouchpoints } from './positioning/FunnelTouchpoints';
import { IcpCampaigns } from './positioning/IcpCampaigns';
import { LeadMagnetInventory } from './positioning/LeadMagnetInventory';
import { PillarMix } from './positioning/PillarMix';
import { IndexFooter } from './positioning/IndexFooter';

/**
 * Positioning — the InboundOnSteroids positioning record, Black Box v4.
 *
 * The refutation this rebuild flips: "8 near-identical stacked PanelCards, same
 * card rhythm end to end." Each strategy section now reads as its own instrument
 * on one printed editorial page. The positioning lock is the typographic
 * document centerpiece; the offer ladder is a literal ascending staircase; the
 * funnel is a narrowing figure; the LM inventory is a demand-sorted heat table
 * with 5 non-hue lifecycle cues; ICP is a compact stage-count register; the
 * pillar mix keeps the proven ink tonal ramp and its drift rules; cross-refs and
 * source-of-truth fold into a compact index footer. Zero DB mutations (the LM
 * edit pencil is a read-only token reveal). Scoped under `.ec` so it speaks the
 * same born-surface register as Today / Outreach.
 */
export default function PositioningRebuilt() {
  const {
    campaigns, leadMagnets, campaignsWithoutLM,
    activeClients, loading, lastRefreshed, refresh,
  } = useStrategyMap();

  return (
    <div className="ec">
      {/* Masthead register bar + document title. */}
      <div className="ec-topline">
        <span className="ec-topline-brand">Positioning Record</span>
        <span className="ec-topline-meta" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.8rem' }}>
          <span>
            Locked 2026-07-03
            {lastRefreshed ? ` · read ${lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
          </span>
          <button type="button" className="pos-refresh" onClick={refresh} disabled={loading}>
            {loading ? 'Reading' : 'Refresh'}
          </button>
        </span>
      </div>
      <h1 className="ec-hed ec-hed--today">Positioning</h1>

      {loading && campaigns.length === 0 && leadMagnets.length === 0 ? (
        <p className="ec-note">Reading the strategy map...</p>
      ) : (
        <>
          {/* The lock — typographic document centerpiece. */}
          <PositioningOfferDoc />
          {/* Ascending staircase of rungs. */}
          <OfferLadder activeClients={activeClients} />
          {/* Narrowing funnel. */}
          <FunnelTouchpoints activeClients={activeClients} />
          {/* Compact stage-count register. */}
          <IcpCampaigns campaigns={campaigns} campaignsWithoutLM={campaignsWithoutLM} />
          {/* Demand-sorted heat table + non-hue lifecycle cues. */}
          <LeadMagnetInventory leadMagnets={leadMagnets} campaignsWithoutLM={campaignsWithoutLM} />
          {/* Proven ink tonal ramp + drift rules (the reference pattern). */}
          <PillarMix />
          {/* Compact index of cross-references + source of truth. */}
          <IndexFooter />
        </>
      )}
    </div>
  );
}
