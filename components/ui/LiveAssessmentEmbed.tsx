import React from 'react';

interface Props {
  src: string;
  title?: string;
  /** iframe height in px. The results view is tall; default leaves room. */
  height?: number;
  /** The prospect's domain, shown in the simulated address bar (e.g. "sci-rec.com"). */
  domain?: string;
  /** The path shown after the domain (e.g. "placement-capacity-score"). */
  urlPath?: string;
}

const Lock: React.FC = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden style={{ flexShrink: 0 }}>
    <rect x="5" y="11" width="14" height="9" rx="2" fill="currentColor" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" fill="none" />
  </svg>
);

/**
 * The prospect's lead magnet, presented as their OWN live deployed page: a realistic browser
 * window (traffic lights + their domain in the address bar) wrapping the live, fully interactive
 * assessment engine. The prospect never sees an ivanmanfredi.com URL — it reads 100% as the page
 * running on their site. The iframe is the real production engine, branded to them.
 *
 * sandbox: allow-scripts (engine), allow-forms (email gate), allow-popups (Calendly CTA opens in
 * a new tab), allow-same-origin (engine fetches its own data.json).
 */
const LiveAssessmentEmbed: React.FC<Props> = ({ src, title, height = 1100, domain, urlPath }) => {
  const cleanDomain = (domain || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
  const showBar = !!cleanDomain;
  const url = cleanDomain + (urlPath ? '/' + urlPath : '');
  return (
    <div
      className="w-full overflow-hidden"
      style={{ borderRadius: 14, border: '1px solid var(--color-hairline)', boxShadow: '0 24px 60px rgba(26,26,26,0.16), 0 2px 8px rgba(26,26,26,0.06)', background: '#fff' }}
    >
      {showBar && (
        <div
          className="flex items-center gap-3 px-3.5"
          style={{ height: 46, background: 'linear-gradient(180deg,#F2EFE9 0%,#E9E5DD 100%)', borderBottom: '1px solid var(--color-hairline)' }}
        >
          <div className="flex items-center gap-2" aria-hidden>
            <span style={{ width: 11, height: 11, borderRadius: 999, background: '#FF5F57' }} />
            <span style={{ width: 11, height: 11, borderRadius: 999, background: '#FEBC2E' }} />
            <span style={{ width: 11, height: 11, borderRadius: 999, background: '#28C840' }} />
          </div>
          <div
            className="flex items-center gap-2 mx-auto"
            style={{ maxWidth: 420, width: '100%', height: 28, padding: '0 12px', borderRadius: 8, background: '#FCFBF7', border: '1px solid rgba(26,26,26,0.08)', color: 'rgba(26,26,26,0.62)' }}
          >
            <Lock />
            <span style={{ fontFamily: '"IBM Plex Mono", ui-monospace, monospace', fontSize: 12, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {url}
            </span>
          </div>
          <div style={{ width: 46, flexShrink: 0 }} aria-hidden />
        </div>
      )}
      <iframe
        src={src}
        title={title || 'Your live assessment'}
        loading="lazy"
        style={{ width: '100%', height, border: 'none', display: 'block' }}
        sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
      />
    </div>
  );
};

export default LiveAssessmentEmbed;
