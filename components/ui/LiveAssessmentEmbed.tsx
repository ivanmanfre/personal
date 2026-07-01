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
  /** The prospect's logo, shown in the simulated site nav. */
  logoUrl?: string;
  /** The prospect's accent hex, used for the nav CTA. */
  accentHex?: string;
  /** The prospect's company name — the wordmark fallback when there's no logo. */
  companyName?: string;
  /** Nav links shown in the simulated site header. */
  navLinks?: string[];
}

const Lock: React.FC = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden style={{ flexShrink: 0 }}>
    <rect x="5" y="11" width="14" height="9" rx="2" fill="currentColor" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" fill="none" />
  </svg>
);

// Dark vs light text on a given accent, so the nav CTA stays legible on any brand color.
function inkOn(hex?: string): string {
  const h = (hex || '').replace(/[^0-9a-fA-F]/g, '');
  if (h.length !== 6) return '#fff';
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.6 ? '#141210' : '#ffffff';
}

/**
 * The prospect's lead magnet, presented as their OWN live deployed website: a realistic browser
 * window (traffic lights + their domain in the address bar) over a full site header (their logo,
 * nav, a CTA in their accent), wrapping the live, fully interactive assessment engine. It reads
 * 100% as a page running on their site — no ivanmanfredi.com anywhere.
 *
 * sandbox: allow-scripts (engine), allow-forms (email gate), allow-popups (Calendly CTA opens in
 * a new tab), allow-same-origin (engine fetches its own data.json).
 */
const LiveAssessmentEmbed: React.FC<Props> = ({
  src, title, height = 1100, domain, urlPath, logoUrl, accentHex, companyName,
  navLinks = ['Home', 'About', 'Services', 'Contact'],
}) => {
  const cleanDomain = (domain || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
  const showBar = !!cleanDomain;
  const url = cleanDomain + (urlPath ? '/' + urlPath : '');
  const accent = accentHex && /^#?[0-9a-fA-F]{6}$/.test(accentHex) ? (accentHex[0] === '#' ? accentHex : '#' + accentHex) : '#1A1A1A';
  const ctaInk = inkOn(accent);
  return (
    <div
      className="w-full overflow-hidden"
      style={{ borderRadius: 14, border: '1px solid var(--color-hairline)', boxShadow: '0 28px 70px rgba(26,26,26,0.20), 0 2px 8px rgba(26,26,26,0.06)', background: '#fff' }}
    >
      {showBar && (
        <div
          className="flex items-center gap-3 px-3.5"
          style={{ height: 44, background: 'linear-gradient(180deg,#F2EFE9 0%,#E9E5DD 100%)', borderBottom: '1px solid var(--color-hairline)' }}
        >
          <div className="flex items-center gap-2" aria-hidden>
            <span style={{ width: 11, height: 11, borderRadius: 999, background: '#FF5F57' }} />
            <span style={{ width: 11, height: 11, borderRadius: 999, background: '#FEBC2E' }} />
            <span style={{ width: 11, height: 11, borderRadius: 999, background: '#28C840' }} />
          </div>
          <div
            className="flex items-center gap-2 mx-auto"
            style={{ maxWidth: 420, width: '100%', height: 27, padding: '0 12px', borderRadius: 8, background: '#FCFBF7', border: '1px solid rgba(26,26,26,0.08)', color: 'rgba(26,26,26,0.62)' }}
          >
            <Lock />
            <span style={{ fontFamily: '"IBM Plex Mono", ui-monospace, monospace', fontSize: 12, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {url}
            </span>
          </div>
          <div style={{ width: 46, flexShrink: 0 }} aria-hidden />
        </div>
      )}
      {/* Simulated site header — their logo + nav + a CTA in their brand color. */}
      <div
        className="flex items-center px-5 sm:px-7"
        style={{ height: 60, background: '#ffffff', borderBottom: '1px solid rgba(26,26,26,0.08)' }}
      >
        <div className="flex items-center" style={{ flexShrink: 0 }}>
          {logoUrl
            ? <img src={logoUrl} alt={companyName || 'logo'} style={{ height: 26, width: 'auto', maxWidth: 160, objectFit: 'contain', display: 'block' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            : <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-0.01em', color: '#1A1A1A' }}>{companyName}</span>}
        </div>
        <nav className="hidden md:flex items-center gap-7 ml-9">
          {navLinks.map((l) => (
            <span key={l} style={{ fontSize: 13.5, fontWeight: 500, color: 'rgba(26,26,26,0.66)' }}>{l}</span>
          ))}
        </nav>
        <span
          className="ml-auto inline-flex items-center"
          style={{ background: accent, color: ctaInk, fontSize: 12.5, fontWeight: 600, letterSpacing: '0.01em', padding: '9px 18px', borderRadius: 8 }}
        >
          Get in touch
        </span>
      </div>
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
