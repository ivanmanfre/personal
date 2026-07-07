// components/ui/NewsletterMockup.tsx
// Brand-mirrored email-client card: the newsletter the engine drafts for a prospect,
// framed like an inbox email in THEIR accent so it reads as their owned asset.
import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const SERIF = '"DM Serif Display", "Bodoni Moda", Georgia, serif';
const BODY_SERIF = '"Source Serif 4", Georgia, serif';
const MONO = '"IBM Plex Mono", monospace';
const EASE = [0.22, 0.84, 0.36, 1] as const;
const CI_CARD = '#FCFBF7';
const CI_R = 22;
const CI_SHADOW = '0 1px 2px rgba(26,26,26,0.04), 0 10px 28px rgba(26,26,26,0.06)';
const HAIRLINE = 'rgba(26,26,26,0.10)';

export interface NewsletterData {
  subject: string;
  preview?: string;
  sections: { h: string; body: string }[];
  cta: string;
}

interface Props {
  data?: NewsletterData | null;
  accent: string;
  who: string;
  logoUrl?: string;
}

const NewsletterMockup: React.FC<Props> = ({ data, accent, who, logoUrl }) => {
  const reduce = useReducedMotion();
  if (!data || !data.subject || !Array.isArray(data.sections) || data.sections.length === 0) return null;

  const initial = (who || 'Y').trim().charAt(0).toUpperCase();

  return (
    <motion.div
      className="w-full max-w-[640px] mx-auto overflow-hidden"
      initial={reduce ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, ease: EASE }}
      style={{ background: CI_CARD, borderRadius: CI_R, border: `1px solid ${HAIRLINE}`, boxShadow: CI_SHADOW }}
    >
      {/* Inbox header row — sender identity */}
      <div className="flex items-center gap-3 px-5 sm:px-7 py-4" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={who}
            className="w-9 h-9 rounded-full object-cover shrink-0"
            style={{ background: '#fff', border: `1px solid ${HAIRLINE}` }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <span
            aria-hidden
            className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-[15px] font-semibold"
            style={{ background: accent, color: '#fff' }}
          >
            {initial}
          </span>
        )}
        <div className="min-w-0">
          <div className="text-[14px] font-semibold leading-tight truncate" style={{ color: '#1A1A1A' }}>{who}</div>
          <div className="text-[12px] leading-tight truncate" style={{ fontFamily: MONO, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.5)' }}>Newsletter</div>
        </div>
        <span className="ml-auto text-[11px] shrink-0" style={{ fontFamily: MONO, color: 'rgba(26,26,26,0.4)' }}>Inbox</span>
      </div>

      {/* Body */}
      <div className="px-5 sm:px-7 py-6">
        <h3 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(1.35rem, 4vw, 1.9rem)', lineHeight: 1.12, letterSpacing: '-0.02em', color: '#1A1A1A' }}>{data.subject}</h3>
        {data.preview && (
          <p className="mt-2" style={{ fontFamily: BODY_SERIF, fontSize: '15px', lineHeight: 1.5, color: 'rgba(26,26,26,0.55)' }}>{data.preview}</p>
        )}

        <div className="mt-6 space-y-6">
          {data.sections.map((s, i) => (
            <div key={i}>
              <div style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase', color: accent, fontWeight: 600 }}>{s.h}</div>
              <p className="mt-2" style={{ fontFamily: BODY_SERIF, fontSize: '15.5px', lineHeight: 1.55, color: '#3D3D3B' }}>{s.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-7">
          <span
            className="inline-flex items-center gap-2"
            style={{ fontFamily: MONO, fontSize: '12.5px', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600, color: '#fff', background: accent, borderRadius: 999, padding: '12px 22px' }}
          >
            {data.cta}
            <span aria-hidden>→</span>
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default NewsletterMockup;
