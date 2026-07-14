import React, { useEffect, useState } from 'react';

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
  /** Header background — pass the prospect's real header color for dark-site brands. */
  headerBg?: string;
  /** CTA label in the simulated nav (e.g. their real "Free Strategy Call"). */
  ctaText?: string;
  /** Phone number shown before the CTA, like many agency navs. */
  phone?: string;
  /** Load the engine immediately (loading="eager") so a scroll-through never meets a
   *  white void. Default false keeps the lazy behavior for existing call sites. */
  eager?: boolean;
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
  headerBg, ctaText, phone, eager = false,
}) => {
  const cleanDomain = (domain || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
  const showBar = !!cleanDomain;
  const url = cleanDomain + (urlPath ? '/' + urlPath : '');
  const accent = accentHex && /^#?[0-9a-fA-F]{6}$/.test(accentHex) ? (accentHex[0] === '#' ? accentHex : '#' + accentHex) : '#1A1A1A';
  const ctaInk = inkOn(accent);
  const hdrBg = headerBg && /^#?[0-9a-fA-F]{6}$/.test(headerBg) ? (headerBg[0] === '#' ? headerBg : '#' + headerBg) : '#ffffff';
  const hdrDark = inkOn(hdrBg) === '#ffffff';
  const navInk = hdrDark ? 'rgba(255,255,255,0.78)' : 'rgba(26,26,26,0.66)';
  // Slow-load fallback: if the engine hasn't loaded within ~6s, swap the white void
  // for a branded card inside the browser frame. The iframe stays mounted (height 0)
  // so a late load still swaps the real assessment back in. A no-cors reachability
  // probe backs up the timer: an unreachable engine paints Chrome's error page, which
  // still fires the iframe's load event, so onLoad alone can't be trusted.
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  const [unreachable, setUnreachable] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setSlow(true), 6000);
    let cancelled = false;
    fetch(src, { mode: 'no-cors' }).catch(() => { if (!cancelled) setUnreachable(true); });
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [src]);
  const showFallback = unreachable || (slow && !loaded);
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
        style={{ height: 60, background: hdrBg, borderBottom: hdrDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(26,26,26,0.08)' }}
      >
        <div className="flex items-center" style={{ flexShrink: 0 }}>
          {logoUrl
            ? <img src={logoUrl} alt={companyName || 'logo'} style={{ height: 30, width: 'auto', maxWidth: 170, objectFit: 'contain', display: 'block' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            : <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-0.01em', color: hdrDark ? '#fff' : '#1A1A1A' }}>{companyName}</span>}
        </div>
        <nav className="hidden md:flex items-center gap-7 ml-9">
          {navLinks.map((l) => (
            <span key={l} style={{ fontSize: 13.5, fontWeight: 500, color: navInk }}>{l}</span>
          ))}
        </nav>
        <span className="ml-auto inline-flex items-center gap-5">
          {phone && (
            <span className="hidden sm:inline" style={{ fontSize: 13, fontWeight: 600, color: hdrDark ? '#fff' : '#1A1A1A' }}>{phone}</span>
          )}
          <span
            className="inline-flex items-center"
            style={{ background: accent, color: ctaInk, fontSize: 12.5, fontWeight: 600, letterSpacing: '0.01em', padding: '9px 18px', borderRadius: 4 }}
          >
            {ctaText || 'Get in touch'}
          </span>
        </span>
      </div>
      {showFallback && (
        <div className="flex items-center justify-center px-6" style={{ minHeight: 380, background: '#fff' }}>
          <div className="w-full max-w-md rounded-xl p-6 text-center" style={{ border: '1px solid rgba(26,26,26,0.08)' }}>
            <span className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full" style={{ background: accent }} aria-hidden>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M13 2 4.5 13.5H11l-1.5 8.5L18 10.5h-6.5L13 2z" stroke={ctaInk} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>The live assessment is loading slowly.</div>
            <p style={{ marginTop: 6, fontSize: 13.5, lineHeight: 1.5, color: 'rgba(26,26,26,0.66)' }}>
              It runs at{' '}
              <a href={src} target="_blank" rel="noreferrer" style={{ color: accent, fontWeight: 600, textDecoration: 'underline' }}>
                {url || 'your assessment page'}
              </a>
            </p>
          </div>
        </div>
      )}
      <iframe
        src={src}
        title={title || 'Your live assessment'}
        loading={eager ? 'eager' : 'lazy'}
        onLoad={() => setLoaded(true)}
        style={{ width: '100%', height: showFallback ? 0 : height, border: 'none', display: 'block' }}
        sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
      />
    </div>
  );
};

export default LiveAssessmentEmbed;
