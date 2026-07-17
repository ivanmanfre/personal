// components/ui/FollowUpSequence.tsx
// Brand-mirrored vertical timeline: the post-capture email sequence everyone who grabs
// the lead magnet receives. Accent-tinted Day badges connected by a thin spine.
import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const SERIF = '"DM Serif Display", "Bodoni Moda", Georgia, serif';
const BODY_SERIF = '"Source Serif 4", Georgia, serif';
const MONO = '"IBM Plex Mono", monospace';
const EASE = [0.22, 0.84, 0.36, 1] as const;
const CI_CARD = '#FCFBF7';
const CI_R = 18;
const CI_SHADOW = '0 1px 2px rgba(26,26,26,0.04), 0 10px 28px rgba(26,26,26,0.06)';
const HAIRLINE = 'rgba(26,26,26,0.10)';

export interface FollowUp {
  step: number;
  day: number;
  subject: string;
  body: string;
}

interface Props {
  data?: FollowUp[] | null;
  accent: string;
  who?: string;
}

const FollowUpSequence: React.FC<Props> = ({ data, accent }) => {
  const reduce = useReducedMotion();
  if (!Array.isArray(data) || data.length === 0) return null;

  const sorted = [...data].sort((a, b) => (a.day ?? 0) - (b.day ?? 0));
  // Excerpt, not essay: the sequence reads as a schedule, so cap the visible steps and
  // clamp each body to two lines. The full sequence ships; the exhibit proves the cadence.
  const items = sorted.slice(0, 3);
  const remaining = sorted.length - items.length;

  return (
    <div className="w-full max-w-[640px] mx-auto">
      <div className="relative">
        {/* Vertical spine */}
        <div aria-hidden className="absolute top-2 bottom-2 left-[15px] w-px" style={{ background: HAIRLINE }} />
        <div className="space-y-4">
          {items.map((f, i) => (
            <motion.div
              key={`${f.step}-${f.day}-${i}`}
              className="relative pl-10"
              initial={reduce ? false : { y: 16 }}
              whileInView={{ y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.55, ease: EASE, delay: reduce ? 0 : i * 0.08 }}
            >
              {/* Node */}
              <span aria-hidden className="absolute left-0 top-4 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: '#fff', border: `1px solid ${HAIRLINE}` }}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: accent }} />
              </span>
              <div className="p-4 sm:p-5" style={{ background: CI_CARD, borderRadius: CI_R, border: `1px solid ${HAIRLINE}`, boxShadow: CI_SHADOW }}>
                <span
                  className="inline-flex items-center"
                  style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, color: '#fff', background: accent, borderRadius: 999, padding: '4px 11px' }}
                >
                  Day {f.day}
                </span>
                <h4 className="mt-3" style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(1.05rem, 3vw, 1.35rem)', lineHeight: 1.15, letterSpacing: '-0.01em', color: '#1A1A1A' }}>{f.subject}</h4>
                <p className="mt-2 line-clamp-2" style={{ fontFamily: BODY_SERIF, fontSize: '15px', lineHeight: 1.55, color: '#3D3D3B' }}>{f.body}</p>
              </div>
            </motion.div>
          ))}
          {remaining > 0 && (
            <div className="relative pl-10">
              <span aria-hidden className="absolute left-0 top-1 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: '#fff', border: `1px solid ${HAIRLINE}` }}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: HAIRLINE }} />
              </span>
              <div className="pt-2" style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.45)' }}>+{remaining} more in the sequence</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FollowUpSequence;
