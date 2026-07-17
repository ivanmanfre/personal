// components/ui/EngagerOutreachMockup.tsx
// Brand-mirrored proof that reactions become conversations: each reader who reacts to a
// post gets a personal DM. Rendered as a message thread — the real engager (name +
// headline from their profile) on top, the drafted DM beneath, so it reads as the
// prospect's own inbox, not an abstract diagram.
import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const BODY_SERIF = '"Source Serif 4", Georgia, serif';
const SANS = '"Inter", ui-sans-serif, system-ui, sans-serif';
const MONO = '"IBM Plex Mono", monospace';
const EASE = [0.22, 0.84, 0.36, 1] as const;
const CI_CARD = '#FCFBF7';
const CI_R = 18;
const CI_SHADOW = '0 1px 2px rgba(26,26,26,0.04), 0 10px 28px rgba(26,26,26,0.06)';
const HAIRLINE = 'rgba(26,26,26,0.10)';

export interface EngagerOutreach {
  explainer: string;
  samples: { trigger: string; dm: string; engager?: { name?: string; headline?: string } }[];
}

interface Props {
  data?: EngagerOutreach | null;
  accent: string;
  who?: string;
}

/** Lightens a hex accent for a soft chat-bubble tint. */
function tint(hex: string, alpha = 0.10): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 'rgba(31,111,235,0.10)';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

const EngagerOutreachMockup: React.FC<Props> = ({ data, accent, who }) => {
  const reduce = useReducedMotion();
  if (!data || !Array.isArray(data.samples) || data.samples.length === 0) return null;

  const bubbleBg = tint(accent, 0.12);
  // Excerpt, not essay: cap the visible DM pairs and clamp each bubble to four lines.
  const samples = data.samples.slice(0, 3);
  const remaining = data.samples.length - samples.length;

  return (
    <div className="w-full max-w-[640px] mx-auto">
      {data.explainer && (
        <p className="mb-6 line-clamp-2" style={{ fontFamily: BODY_SERIF, fontSize: '16px', lineHeight: 1.55, color: '#3D3D3B' }}>{data.explainer}</p>
      )}
      <div className="space-y-5">
        {samples.map((s, i) => {
          const name = (s.engager?.name || '').trim();
          const headline = (s.engager?.headline || '').trim();
          const initial = (name || '?').charAt(0).toUpperCase();
          // Trigger shortened when it just repeats the name — "commented on the X post".
          const trigger = name && s.trigger?.startsWith(name)
            ? s.trigger.slice(name.length).trim()
            : s.trigger;
          return (
            <motion.div
              key={i}
              className="overflow-hidden"
              initial={reduce ? false : { y: 16 }}
              whileInView={{ y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.55, ease: EASE, delay: reduce ? 0 : i * 0.08 }}
              style={{ background: CI_CARD, borderRadius: CI_R, border: `1px solid ${HAIRLINE}`, boxShadow: CI_SHADOW }}
            >
              {/* The real engager — name + profile headline, as a DM thread header */}
              <div className="flex items-start gap-3 px-4 sm:px-5 pt-4 pb-3" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
                <span aria-hidden className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-[14px] font-semibold" style={{ background: accent, color: '#fff' }}>{initial}</span>
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold leading-tight truncate" style={{ fontFamily: SANS, color: '#1A1A1A' }}>{name || 'A reader from your comments'}</div>
                  {headline && <div className="text-[12px] leading-snug truncate" style={{ fontFamily: SANS, color: 'rgba(26,26,26,0.55)', marginTop: 2 }}>{headline}</div>}
                  {trigger && (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span aria-hidden className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] shrink-0" style={{ background: accent, color: '#fff' }}>♥</span>
                      <span className="truncate" style={{ fontFamily: MONO, fontSize: '10.5px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.55)' }}>{trigger}</span>
                    </div>
                  )}
                </div>
              </div>
              {/* The drafted DM — sent from the prospect's side */}
              <div className="px-4 sm:px-5 py-4">
                <div className="flex justify-end">
                  <div className="max-w-[88%] px-4 py-3" style={{ background: bubbleBg, border: `1px solid ${accent}`, borderRadius: '16px 16px 4px 16px' }}>
                    <p className="line-clamp-4" style={{ fontFamily: BODY_SERIF, fontSize: '15px', lineHeight: 1.5, color: '#1A1A1A' }}>{s.dm}</p>
                  </div>
                </div>
                {who && (
                  <div className="mt-2 flex justify-end">
                    <span style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.4)' }}>{who} · within 48h of the comment</span>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
        {remaining > 0 && (
          <p style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.45)' }}>+{remaining} more keyed to your posts</p>
        )}
      </div>
    </div>
  );
};

export default EngagerOutreachMockup;
