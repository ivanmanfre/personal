import React from 'react';
import { ExternalLink } from 'lucide-react';
import { clean } from './shared';
import { funnelTouchpoints } from '../../../../../lib/strategyConfig';

interface Props {
  activeClients: number;
}

// buildStatus -> non-hue fill: built = solid ink, partial = ink hatch, else = dashed outline.
function fillClass(status: string): string {
  if (status === 'built') return 'pos-fun-bar--built';
  if (status === 'partial') return 'pos-fun-bar--partial';
  return 'pos-fun-bar--none';
}
function statusBadge(status: string): string {
  if (status === 'built') return 'built';
  if (status === 'partial') return 'partial';
  return 'not built';
}

/**
 * Funnel Touchpoints — a literal narrowing funnel. Each step's bar is narrower
 * than the one above it (cold to closed), centered so the taper reads as a
 * funnel. Build status is a non-hue cue (solid / hatch / dashed outline). Funnel
 * links survive (ledger element 14); the live active-client count rides step 3.
 */
export const FunnelTouchpoints: React.FC<Props> = ({ activeClients }) => (
  <section className="pos-sec">
    <div className="pos-sec-head">
      <h2 className="pos-sec-title">Funnel Touchpoints</h2>
      <span className="pos-sec-meta">Cold to closed</span>
    </div>
    <p className="pos-sec-note">
      The path from cold to closed. Lead magnets feed touchpoint 1; the free fit call closes into the $2k retainer at step 3.
    </p>
    <div className="pos-funnel">
      {funnelTouchpoints.map((tp, i) => {
        const width = `${100 - i * 17}%`;
        const liveMetric =
          tp.step === 3
            ? activeClients > 0
              ? `${activeClients} active client${activeClients === 1 ? '' : 's'}`
              : null
            : tp.metric;
        return (
          <div key={tp.step}>
            <div className="pos-fun-row">
              <span className="pos-fun-step">{tp.step}</span>
              <div className="pos-fun-barwrap">
                <div className={`pos-fun-bar ${fillClass(tp.buildStatus)}`} style={{ width }}>
                  <span className="pos-fun-name">{tp.name}</span>
                  <span className="pos-fun-badge">{statusBadge(tp.buildStatus)}</span>
                </div>
              </div>
              <span className="pos-fun-side">
                {liveMetric && <span className="pos-fun-metric">{liveMetric}</span>}
                {tp.url && (
                  <a
                    href={tp.url}
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
            <p className="pos-fun-desc">{clean(tp.description)}</p>
          </div>
        );
      })}
    </div>
  </section>
);
