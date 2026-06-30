import React from 'react';

interface Props {
  src: string;
  title?: string;
  /** iframe height in px. The results view is tall; default leaves room. */
  height?: number;
}

/**
 * Embeds the live, results-forward assessment engine (resources.ivanmanfredi.com)
 * as the hero lead-magnet sample inside a prospect scan. The iframe loads the real
 * production engine, so what the prospect sees is exactly what they'd ship.
 *
 * sandbox: allow-scripts (engine), allow-forms (email gate), allow-popups (Calendly
 * CTA opens in a new tab), allow-same-origin (engine fetches its own data.json).
 */
const LiveAssessmentEmbed: React.FC<Props> = ({ src, title, height = 1100 }) => (
  <div
    className="w-full overflow-hidden"
    style={{ borderRadius: 16, border: '1px solid var(--color-hairline)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', background: '#fff' }}
  >
    <iframe
      src={src}
      title={title || 'Your live assessment'}
      loading="lazy"
      style={{ width: '100%', height, border: 'none', display: 'block' }}
      sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
    />
  </div>
);

export default LiveAssessmentEmbed;
