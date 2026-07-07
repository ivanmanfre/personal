// components/ui/EngagerOutreachMockup.tsx
// Brand-mirrored proof that reactions become conversations: each reader who reacts to a
// post gets a personal DM. Explainer line + a "Reacted → DM" pair per sample.
import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const BODY_SERIF = '"Source Serif 4", Georgia, serif';
const MONO = '"IBM Plex Mono", monospace';
const EASE = [0.22, 0.84, 0.36, 1] as const;
const CI_CARD = '#FCFBF7';
const CI_R = 18;
const CI_SHADOW = '0 1px 2px rgba(26,26,26,0.04), 0 10px 28px rgba(26,26,26,0.06)';
const HAIRLINE = 'rgba(26,26,26,0.10)';

export interface EngagerOutreach {
  explainer: string;
  samples: { trigger: string; dm: string }[];
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

const EngagerOutreachMockup: React.FC<Props> = ({ data, accent }) => {
  const reduce = useReducedMotion();
  if (!data || !Array.isArray(data.samples) || data.samples.length === 0) return null;

  const bubbleBg = tint(accent, 0.12);

  return (
    <div className="w-full max-w-[640px] mx-auto">
      {data.explainer && (
        <p className="mb-6" style={{ fontFamily: BODY_SERIF, fontSize: '16px', lineHeight: 1.55, color: '#3D3D3B' }}>{data.explainer}</p>
      )}
      <div className="space-y-5">
        {data.samples.map((s, i) => (
          <motion.div
            key={i}
            className="p-4 sm:p-5"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.55, ease: EASE, delay: reduce ? 0 : i * 0.08 }}
            style={{ background: CI_CARD, borderRadius: CI_R, border: `1px solid ${HAIRLINE}`, boxShadow: CI_SHADOW }}
          >
            {/* Reaction trigger */}
            <div className="flex items-center gap-2">
              <span aria-hidden className="w-5 h-5 rounded-full flex items-center justify-center text-[10px]" style={{ background: accent, color: '#fff' }}>♥</span>
              <span style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.55)' }}>
                Reacted: <span style={{ color: '#1A1A1A', fontWeight: 600 }}>{s.trigger}</span>
              </span>
            </div>
            {/* DM bubble */}
            <div className="mt-3 flex justify-end">
              <div
                className="max-w-[85%] px-4 py-3"
                style={{ background: bubbleBg, border: `1px solid ${accent}`, borderRadius: '16px 16px 4px 16px' }}
              >
                <p style={{ fontFamily: BODY_SERIF, fontSize: '15px', lineHeight: 1.5, color: '#1A1A1A' }}>{s.dm}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default EngagerOutreachMockup;
