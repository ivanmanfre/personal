import React from 'react';
import { ThumbsUp, MessageSquare, Repeat2, Send, Globe } from 'lucide-react';

/**
 * Shared bits for the reading-first review flows (Posts + Lead Magnets).
 *
 * The LinkedIn preview is a SANCTIONED platform artifact: it depicts the
 * platform a draft ships to, so it renders in neutral system-sans with LinkedIn
 * chrome (avatar, radius, reaction row) rather than Ivan's brand type. This is
 * the same arbitration as components/LiveEngineProof.tsx — but here the body is
 * shown in FULL (no line clamp) because the whole point is reading the draft.
 */

// Authentic LinkedIn chrome reads in a neutral system sans.
const LI_SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

export function ageLabel(iso: string | null | undefined): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return '—';
  const m = ms / 60000;
  if (m < 60) return `${Math.max(1, Math.round(m))}m`;
  const h = m / 60;
  if (h < 24) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
}

// A faithful LinkedIn post preview — full body, no clamp. Optional single image
// (single-image posts). Carousel slides render as a separate strip below.
export const LinkedInPost: React.FC<{ text: string; image?: string | null }> = ({ text, image }) => (
  <div
    style={{
      fontFamily: LI_SANS,
      backgroundColor: '#fff',
      borderRadius: '10px',
      border: '1px solid rgba(0,0,0,0.10)',
      boxShadow: '0 2px 10px rgba(15,23,42,0.08)',
      overflow: 'hidden',
    }}
  >
    <div style={{ padding: '16px 16px 0' }}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <img
          src="/ivan-portrait-400.webp"
          alt=""
          style={{ width: '48px', height: '48px', borderRadius: '9999px', objectFit: 'cover', flexShrink: 0 }}
        />
        <div style={{ lineHeight: 1.25, minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'rgba(0,0,0,0.9)' }}>
            Iván Manfredi <span style={{ fontWeight: 400, color: 'rgba(0,0,0,0.55)' }}>· 1st</span>
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.6)' }}>AI content systems for agencies</div>
          <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            now · <Globe size={12} aria-hidden />
          </div>
        </div>
      </div>
      <p
        style={{
          fontSize: '15px',
          lineHeight: 1.6,
          color: 'rgba(0,0,0,0.9)',
          margin: '14px 0 16px',
          whiteSpace: 'pre-wrap',
        }}
      >
        {text || <span style={{ color: 'rgba(0,0,0,0.4)' }}>(no body yet)</span>}
      </p>
    </div>
    {image && (
      <div style={{ width: '100%', backgroundColor: '#f3f2ef', overflow: 'hidden' }}>
        <img src={image} alt="" loading="lazy" style={{ width: '100%', display: 'block', objectFit: 'cover' }} />
      </div>
    )}
    <div style={{ padding: '8px 16px 4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingBottom: '8px', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <span style={{ display: 'inline-flex' }}>
          <span style={{ width: '18px', height: '18px', borderRadius: '9999px', background: '#378fe9', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <ThumbsUp size={10} color="#fff" fill="#fff" />
          </span>
          <span style={{ width: '18px', height: '18px', borderRadius: '9999px', background: '#df704d', marginLeft: '-5px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>❤</span>
          <span style={{ width: '18px', height: '18px', borderRadius: '9999px', background: '#f5bb5c', marginLeft: '-5px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px' }}>💡</span>
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0 8px' }}>
        {[
          { Icon: ThumbsUp, label: 'Like' },
          { Icon: MessageSquare, label: 'Comment' },
          { Icon: Repeat2, label: 'Repost' },
          { Icon: Send, label: 'Send' },
        ].map(({ Icon, label }) => (
          <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'rgba(0,0,0,0.6)' }}>
            <Icon size={16} aria-hidden /> {label}
          </span>
        ))}
      </div>
    </div>
  </div>
);

// One-line CSS keyframe (opacity + slight rise) reused for the advance transition.
export const REVIEW_FADE_CSS = `
@keyframes review-advance { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.review-advance { animation: review-advance 0.28s cubic-bezier(0.22,0.84,0.36,1); }
@media (prefers-reduced-motion: reduce) { .review-advance { animation: none; } }
`;

// A key/action button in the review action bar. Shows the shortcut key as a kbd.
export const ActionKey: React.FC<{
  k: string;
  label: string;
  onClick: () => void;
  tone?: 'approve' | 'reject' | 'neutral';
  disabled?: boolean;
}> = ({ k, label, onClick, tone = 'neutral', disabled }) => {
  const toneStyle =
    tone === 'approve'
      ? 'text-white bg-[var(--ds-ok)] hover:opacity-90 border-transparent'
      : tone === 'reject'
        ? 'text-[#b91c1c] bg-[#fef2f2] hover:bg-[#fee2e2] border-[#fca5a5]'
        : 'text-[var(--ds-ink)] bg-[var(--ds-card)] hover:bg-[var(--ds-bg)] border-[var(--ds-line)]';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-medium transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[var(--ds-accent)] outline-none ${toneStyle}`}
    >
      <kbd
        className="inline-flex items-center justify-center w-5 h-5 rounded border text-[11px] font-mono leading-none"
        style={{ borderColor: 'currentColor', opacity: 0.55 }}
      >
        {k}
      </kbd>
      {label}
    </button>
  );
};
