import React from 'react';
import { ExternalLink, EyeOff } from 'lucide-react';
import { StatusCue, clean } from './shared';
import { offerLadder } from '../../../../../lib/strategyConfig';

interface Props {
  activeClients: number;
}

// Explicit price rank so the two $2k / $3k rungs (both priceTier "high") do not
// collide at the same step. Fallback to the coarse tier rank for any new rung.
const RUNG_RANK: Record<string, number> = {
  'lm-free': 0,
  'content-system-2k': 1,
  'inbound-outbound-3k': 2,
};
const TIER_RANK: Record<string, number> = { free: 0, low: 1, mid: 2, high: 3, enterprise: 4 };
const rankOf = (r: typeof offerLadder[number]) =>
  RUNG_RANK[r.id] ?? TIER_RANK[r.priceTier] ?? 0;

/**
 * Offer Ladder — an actual ascending staircase. Each rung is an L-step (left
 * riser + top tread) indented by its price tier; the priciest rung sits highest
 * and furthest right. Rung links survive (ledger element 12); the live active-
 * client count rides the $2k rung.
 */
export const OfferLadder: React.FC<Props> = ({ activeClients }) => {
  // Highest price first: the summit rung sits at the top, indented furthest
  // right, and each cheaper rung steps down and to the left = an ascending ladder.
  const rungs = [...offerLadder].sort((a, b) => rankOf(b) - rankOf(a));
  const n = rungs.length;

  return (
    <section className="pos-sec">
      <div className="pos-sec-head">
        <h2 className="pos-sec-title">Offer Ladder</h2>
        <span className="pos-sec-meta">Free to $3k</span>
      </div>
      <div className="pos-ladder">
        {rungs.map((rung, i) => {
          const indent = `${(n - 1 - i) * 3.2}rem`;
          const href = rung.resourceUrl || rung.stripeUrl || null;
          const extraMetric =
            rung.id === 'content-system-2k' && activeClients > 0
              ? `${activeClients} active client${activeClients === 1 ? '' : 's'}`
              : null;
          return (
            <div className="pos-rung" key={rung.id} style={{ marginLeft: indent }}>
              <div className="pos-rung-top">
                <span className="pos-rung-price">{rung.priceLabel}</span>
                <span className="pos-rung-name">{rung.name}</span>
                {rung.visibility === 'unlisted' && (
                  <span className="pos-rung-unlisted">
                    <EyeOff size={10} style={{ verticalAlign: '-1px', marginRight: 3 }} />
                    unlisted
                  </span>
                )}
                <span className="pos-rung-right">
                  <StatusCue status={rung.status} />
                  {href && (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pos-iconbtn"
                      title="Open"
                    >
                      <ExternalLink size={13} />
                    </a>
                  )}
                </span>
              </div>
              <p className="pos-rung-desc">{clean(rung.description)}</p>
              {extraMetric && <p className="pos-rung-metric">{extraMetric}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
};
