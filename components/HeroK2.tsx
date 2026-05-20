import React from 'react';
import { motion, useMotionValue, useSpring, useTransform, useMotionTemplate } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useFontPicker } from './FontPicker';

// Variant K2 — Qualification right-rail.
// Same editorial typography + cinematic reveal motion as K, but the right-rail
// answers BUYER questions:
//   1. Is this for me? (vertical-qualifier list)
//   2. What's my risk? (risk-reversal guarantee)
//   3. Are they available? (single real capacity indicator)
//
// Portrait restored, cursor sage spotlight added.

const VERTICALS = [
  { label: 'Marketing & creative agencies', sub: 'Scale output without scaling headcount' },
  { label: 'Consultancies & strategy firms', sub: 'Productize repeatable delivery' },
  { label: 'Accounting & tax advisory', sub: 'Reclaim partner-level billable hours' },
  { label: 'Coaches & boutique advisors', sub: 'Ops that run without you' },
];

const HeroK2: React.FC = () => {
  const [font, FontPicker] = useFontPicker('hero-k2', 'dmserif');
  const ease = [0.22, 0.84, 0.36, 1] as const;

  // Sage cursor spotlight
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);
  const springX = useSpring(mouseX, { stiffness: 80, damping: 20 });
  const springY = useSpring(mouseY, { stiffness: 80, damping: 20 });
  const xPct = useTransform(springX, (x) => `${x * 100}%`);
  const yPct = useTransform(springY, (y) => `${y * 100}%`);
  const spotlightBg = useMotionTemplate`radial-gradient(circle at ${xPct} ${yPct}, rgba(42,143,101,0.10), transparent 50%)`;

  return (
    <section
      className="relative min-h-screen pt-24 pb-8 flex flex-col bg-paper overflow-hidden"
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        mouseX.set((e.clientX - rect.left) / rect.width);
        mouseY.set((e.clientY - rect.top) / rect.height);
      }}
    >
      <FontPicker />

      {/* Sage cursor spotlight */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ background: spotlightBg }}
      />

      {/* Top status strip — only what's verifiable */}
      <motion.div
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease }}
        className="border-b px-8 py-3 flex items-center justify-between relative z-10"
        style={{
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: '11px',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'rgba(26,26,26,0.7)',
          borderColor: 'rgba(26,26,26,0.12)',
        }}
      >
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <motion.span
              animate={{ opacity: [1, 0.2, 1] }}
              transition={{ duration: 1.4, repeat: Infinity }}
              style={{ color: '#2A8F65', fontSize: '10px' }}
            >
              ●
            </motion.span>
            <span style={{ color: '#2A8F65' }}>Booking Q3 2026 · 2 slots open</span>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-6">
          <span>90-day payback or no-build</span>
        </div>
      </motion.div>

      <div className="container mx-auto px-8 max-w-6xl flex-1 flex flex-col justify-center py-12 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mb-10"
          style={{
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: '11px',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'rgba(26,26,26,0.55)',
          }}
        >
          — 01 / Manfredi // Agent-Ready Ops
        </motion.div>

        {/* 3-col at lg+: portrait | copy | qual-rail */}
        <div className="grid lg:grid-cols-[220px_1.4fr_1fr] xl:grid-cols-[260px_1.4fr_1fr] gap-12 xl:gap-16 items-start">

          {/* Portrait column */}
          <motion.div
            initial={{ opacity: 0, scale: 1.06, filter: 'blur(16px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            transition={{ delay: 0.8, duration: 1.4, ease }}
            className="hidden lg:block pt-4 shrink-0"
          >
            <picture>
              <source
                type="image/webp"
                srcSet="/ivan-hero-800.webp 800w, /ivan-hero-1200.webp 1200w"
                sizes="260px"
              />
              <img
                src="/ivan-hero.jpeg"
                alt="Iván Manfredi"
                width="1200"
                height="1600"
                className="w-full aspect-[3/4] object-cover object-top"
                style={{ borderRadius: '0' }}
              />
            </picture>
          </motion.div>

          {/* LEFT — copy column */}
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 1.2, ease }}
              className="mb-10"
              style={{
                fontFamily: font.family,
                fontWeight: font.weight,
                fontSize: `clamp(${3.5 * (font.scaleAdjust ?? 1)}rem, ${8.5 * (font.scaleAdjust ?? 1)}vw, ${7.5 * (font.scaleAdjust ?? 1)}rem)`,
                lineHeight: 0.96,
                letterSpacing: font.letterSpacing ?? '-0.015em',
                color: '#1A1A1A',
              }}
            >
              Systems scale.
              <br />
              <span style={{ position: 'relative', display: 'inline-block', fontStyle: 'italic' }}>
                Headcount doesn't.
                <motion.span
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 1.7, duration: 0.9, ease }}
                  style={{
                    position: 'absolute',
                    left: '-2%',
                    right: '-2%',
                    bottom: '0.18em',
                    height: '0.42em',
                    backgroundColor: '#2A8F65',
                    transformOrigin: 'left',
                    opacity: 0.28,
                    zIndex: -1,
                  }}
                />
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0, duration: 0.9 }}
              className="max-w-xl mb-10"
              style={{
                fontFamily: '"Source Serif 4", Georgia, serif',
                fontWeight: 400,
                fontSize: '19px',
                lineHeight: 1.6,
                color: '#3D3D3B',
              }}
            >
              I diagnose where AI actually moves the needle in your business — then implement
              alongside the team you already trust.{' '}
              <span style={{ fontStyle: 'italic', color: '#2A8F65' }}>
                Ninety-day payback, or I don't build it.
              </span>
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.3, duration: 0.7 }}
              className="flex flex-col sm:flex-row items-start gap-3"
            >
              <a
                href="/assessment"
                className="btn-magnetic inline-flex items-center gap-2.5 px-7 py-3.5 bg-accent text-white"
                style={{ fontFamily: '"Source Serif 4", serif', fontWeight: 600, fontSize: '16px' }}
              >
                Build your Blueprint <ArrowRight size={18} />
              </a>
              <a
                href="/scorecard"
                className="inline-flex items-center gap-2 px-7 py-3.5 text-ink-mute hover:text-black"
                style={{
                  fontFamily: '"Source Serif 4", serif',
                  fontWeight: 600,
                  fontSize: '16px',
                  fontStyle: 'italic',
                }}
              >
                Are you Agent-Ready? <ArrowRight size={16} />
              </a>
            </motion.div>
          </div>

          {/* RIGHT — qualification rail */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.0, duration: 1.0 }}
            className="border-l pl-8"
            style={{ borderColor: 'rgba(26,26,26,0.12)' }}
          >
            {/* Block 1 — Is this you? */}
            <div className="mb-10">
              <div
                className="mb-4"
                style={{
                  fontFamily: '"IBM Plex Mono", monospace',
                  fontSize: '10px',
                  letterSpacing: '0.25em',
                  textTransform: 'uppercase',
                  color: 'rgba(26,26,26,0.5)',
                }}
              >
                Is this for you?
              </div>
              <ul className="space-y-3">
                {VERTICALS.map((v, i) => (
                  <motion.li
                    key={v.label}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1.4 + i * 0.1, duration: 0.5 }}
                    className="flex items-start gap-3 group cursor-default"
                  >
                    <span
                      style={{
                        color: '#2A8F65',
                        fontFamily: '"Source Serif 4", serif',
                        fontStyle: 'italic',
                        fontSize: '16px',
                        lineHeight: 1.4,
                      }}
                    >
                      ↳
                    </span>
                    <div>
                      <div
                        style={{
                          fontFamily: '"Source Serif 4", Georgia, serif',
                          fontWeight: 600,
                          fontSize: '15px',
                          color: '#1A1A1A',
                          lineHeight: 1.3,
                        }}
                      >
                        {v.label}
                      </div>
                      <div
                        style={{
                          fontFamily: '"Source Serif 4", Georgia, serif',
                          fontStyle: 'italic',
                          fontSize: '13px',
                          color: 'rgba(26,26,26,0.55)',
                          lineHeight: 1.4,
                          marginTop: '2px',
                        }}
                      >
                        {v.sub}
                      </div>
                    </div>
                  </motion.li>
                ))}
              </ul>
            </div>

            {/* Block 2 — The guarantee */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2.0, duration: 0.8, ease }}
              className="pt-8 border-t"
              style={{ borderColor: 'rgba(26,26,26,0.12)' }}
            >
              <div
                className="mb-3"
                style={{
                  fontFamily: '"IBM Plex Mono", monospace',
                  fontSize: '10px',
                  letterSpacing: '0.25em',
                  textTransform: 'uppercase',
                  color: 'rgba(26,26,26,0.5)',
                }}
              >
                The guarantee
              </div>
              <div
                style={{
                  fontFamily: font.family,
                  fontStyle: 'italic',
                  fontWeight: font.weight,
                  fontSize: '32px',
                  lineHeight: 1.05,
                  color: '#1A1A1A',
                  letterSpacing: '-0.01em',
                  marginBottom: '8px',
                }}
              >
                90-day payback,
                <br />
                or I don't build.
              </div>
              <p
                style={{
                  fontFamily: '"Source Serif 4", Georgia, serif',
                  fontSize: '13px',
                  lineHeight: 1.5,
                  color: 'rgba(26,26,26,0.65)',
                  fontStyle: 'italic',
                }}
              >
                Diagnostic refunded if the four preconditions aren't there.
                You walk away with the scorecard either way.
              </p>
            </motion.div>

            {/* Block 3 — Capacity bar */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.4, duration: 0.6 }}
              className="mt-8 pt-6 border-t"
              style={{ borderColor: 'rgba(26,26,26,0.12)' }}
            >
              <div
                className="flex justify-between items-baseline mb-2"
                style={{
                  fontFamily: '"IBM Plex Mono", monospace',
                  fontSize: '10px',
                  letterSpacing: '0.25em',
                  textTransform: 'uppercase',
                  color: 'rgba(26,26,26,0.5)',
                }}
              >
                <span>Q3 diagnostic slots</span>
                <span style={{ color: '#1A1A1A' }}>2 of 8 open</span>
              </div>
              <div
                className="h-1 w-full"
                style={{ backgroundColor: 'rgba(26,26,26,0.1)' }}
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '75%' }}
                  transition={{ delay: 2.6, duration: 1.4, ease }}
                  className="h-full"
                  style={{ backgroundColor: '#1A1A1A' }}
                />
              </div>
              <div
                className="mt-2"
                style={{
                  fontFamily: '"Source Serif 4", Georgia, serif',
                  fontStyle: 'italic',
                  fontSize: '13px',
                  color: 'rgba(26,26,26,0.6)',
                  lineHeight: 1.4,
                }}
              >
                Bookings open through August. Diagnostic week → build kickoff
                takes ~14 days.
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroK2;
