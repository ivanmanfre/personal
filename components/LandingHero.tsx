import React from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { getBookingQuarter } from '../lib/bookingConfig';

// Production hero for /landing — no font picker, no right rail.
// v2 (2026-05-24): v20-magazine-cover transformation
//   - Sage sweep redrawn to match v20 (mostly rectangular highlighter, subtle imperfect edges, centered on letterforms)
//   - Portrait pulled out of flex flow → absolutely positioned, truly bleeds off section right edge
//   - Scroll parallax preserved via wrapper
// v3 (2026-06-15): content-engine rebrand. Headline/lede/benefits repointed to
//   the AI content system for agencies. Sage hero phrase = "$15k-$50k/mo of new pipeline".

const ease = [0.22, 0.84, 0.36, 1] as const;

const LandingHero: React.FC = () => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  });

  const headlineY = useTransform(scrollYProgress, [0, 1], [0, -36]);
  const headlineOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0.5]);
  const reduced = useReducedMotion();

  // Hand-painted sage highlighter sweep — the §2/§4 emphasis move. Sits behind a
  // ROMAN phrase (never fills it green). Scales to the wrapped phrase box.
  const HeroSweep: React.FC<{ delay?: number }> = ({ delay = 0.55 }) => (
    <motion.svg
      initial={reduced ? false : { scaleX: 0, opacity: 0 }}
      animate={{ scaleX: 1, opacity: 1 }}
      transition={{ delay, duration: 0.9, ease }}
      viewBox="0 0 400 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: '-2%',
        right: '-2%',
        top: '0.26em',
        width: '104%',
        height: '0.72em',
        transformOrigin: 'left',
        zIndex: -1,
        overflow: 'visible',
      }}
    >
      <path
        d="M 5 16 Q 80 9 160 14 Q 250 19 320 11 Q 365 14 396 15 L 396 84 Q 360 89 300 83 Q 220 91 150 85 Q 75 90 5 83 Z"
        fill="#2A8F65"
        opacity={0.82}
      />
    </motion.svg>
  );

  // Editorial line-mask reveal — display lines rise out of a clip mask, settle, stop.
  // Replaces the blur-on-every-element entrance with one decisive typographic move.
  const Reveal: React.FC<{ children: React.ReactNode; delay?: number }> = ({ children, delay = 0 }) => (
    // paddingBottom + matching negative margin keeps the clip mask from cutting
    // descenders (the 'g' in "being", 'y' in "your") while preserving line spacing.
    <span style={{ display: 'block', overflow: 'hidden', paddingBottom: '0.16em', marginBottom: '-0.16em' }}>
      <motion.span
        style={{ display: 'block' }}
        initial={reduced ? false : { y: '118%' }}
        animate={{ y: 0 }}
        transition={{ delay, duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.span>
    </span>
  );


  return (
    <section
      ref={containerRef}
      className="relative min-h-screen flex flex-col bg-paper overflow-hidden"
    >
      {/* Faint editorial grid — 40×40px lines at ~3.5% black */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(26,26,26,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(26,26,26,0.035) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Slow drifting paper grain */}
      <motion.div
        className="absolute inset-0 pointer-events-none opacity-25 z-0"
        animate={{ backgroundPosition: ['0px 0px', '120px 120px'] }}
        transition={{ duration: 90, repeat: Infinity, ease: 'linear' }}
        style={{
          backgroundImage:
            'url("data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22/></filter><rect width=%22120%22 height=%22120%22 filter=%22url(%23n)%22 opacity=%220.3%22/></svg>")',
        }}
      />

      {/* Status strip */}
      <motion.div
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease }}
        className="border-b px-8 py-3 flex items-center justify-between relative z-10"
        style={{
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: '12px',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'rgba(26,26,26,0.7)',
          borderColor: 'rgba(26,26,26,0.1)',
        }}
      >
        <div className="flex items-center gap-2">
          <motion.span
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 1.4, repeat: Infinity }}
            style={{ width: '7px', height: '7px', backgroundColor: '#2A8F65', flexShrink: 0 }}
            aria-hidden="true"
          />
          <span style={{ color: '#1F6B4B' }}>Booking {getBookingQuarter()}</span>
        </div>
      </motion.div>

      {/* Expanding sage rule across top */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.15, duration: 1.8, ease }}
        style={{
          position: 'absolute',
          top: '3.5rem',
          left: 0,
          right: 0,
          height: '1px',
          backgroundColor: '#2A8F65',
          transformOrigin: 'left',
          opacity: 0.3,
          zIndex: 5,
        }}
      />

      {/* Main content — EDITORIAL COVER, CENTERED axis (Ivan's call, W3.2): the
          type is still the visual, but the headline / lede / CTA stack on one
          centered column and vertically center in the fold, so the fold reads as
          a balanced composition instead of a top-left block with dead space. */}
      <motion.div
        style={{ y: headlineY, opacity: headlineOpacity }}
        className="flex-1 flex flex-col justify-center relative z-10"
      >
        <div className="container mx-auto px-8 max-w-5xl w-full">
          <div className="py-12 lg:py-0 text-center">

            {/* Byline */}
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.6 }}
              className="mb-7 flex items-center justify-center gap-3"
              style={{
                fontFamily: '"IBM Plex Mono", monospace',
                fontSize: '11px',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: '#5A5752',
              }}
            >
              <motion.span
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{ width: '6px', height: '6px', backgroundColor: '#2A8F65', flexShrink: 0 }}
                aria-hidden="true"
              />
              <span>Iván Manfredi · For agencies</span>
            </motion.div>

            {/* Headline: mixed-scale cover. Sage line is the hero phrase. */}
            <h1
              className="mb-9"
              style={{
                fontFamily: '"DM Serif Display", "Bodoni Moda", Georgia, serif',
                fontWeight: 400,
                color: '#1A1A1A',
                letterSpacing: '-0.02em',
              }}
            >
              <Reveal delay={0.15}>
                <span style={{ display: 'block', fontSize: 'clamp(1.9rem, 4vw, 3.25rem)', lineHeight: 1.05 }}>
                  Add
                </span>
              </Reveal>
              {/* Pivot phrase: ROMAN ink (not sage fill). The dollar figure — the
                  proof pivot — carries the hand-painted sage highlighter sweep, so
                  sage stays punctuation on the single most important token. */}
              <Reveal delay={0.3}>
                <span
                  style={{
                    display: 'block',
                    color: '#1A1A1A',
                    fontSize: 'clamp(2.7rem, 8.2vw, 6.75rem)',
                    lineHeight: 0.98,
                    letterSpacing: '-0.035em',
                    marginLeft: '-0.015em',
                    marginTop: '0.04em',
                  }}
                >
                  <span style={{ position: 'relative', display: 'inline-block', whiteSpace: 'nowrap' }}>
                    $15k-$50k/mo
                    <HeroSweep delay={0.6} />
                  </span>{' '}
                  of new pipeline
                </span>
              </Reveal>
              <Reveal delay={0.46}>
                <span
                  style={{
                    display: 'inline-block',
                    marginTop: '0.5rem',
                    backgroundColor: '#1A1A1A',
                    color: '#F7F4EF',
                    fontStyle: 'italic',
                    fontSize: 'clamp(1.4rem, 3vw, 2.6rem)',
                    lineHeight: 1.12,
                    padding: '0.04em 0.42em 0.2em',
                  }}
                >
                  in 90 days.
                </span>
              </Reveal>
            </h1>

            {/* Lede + CTAs — centered column, right side no longer dead space */}
            <div className="max-w-2xl mx-auto">
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.75, duration: 0.9, ease }}
                className="mb-7"
                style={{
                  fontFamily: '"Source Serif 4", Georgia, serif',
                  fontWeight: 400,
                  fontSize: '21px',
                  lineHeight: 1.55,
                  color: '#3D3D3B',
                }}
              >
                An AI content system that writes your posts, builds your lead magnets, and ships them daily in your voice.{' '}
                <span style={{ fontWeight: 600, color: '#1A1A1A' }}>
                  You own the system, instead of renting an agency that posts for you.
                </span>
              </motion.p>

              {/* Benefit row — mono spec line */}
              <motion.ul
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.86, duration: 0.7, ease }}
                className="mb-9 flex flex-col sm:flex-row items-center justify-center gap-y-2.5 sm:gap-0"
              >
                {['Daily content in your voice', 'A feed that brings you inbound', 'On-brand, every post'].map((b, i) => (
                  <li
                    key={b}
                    className={`flex items-center gap-2.5 sm:px-5 ${i === 0 ? 'sm:pl-0' : 'sm:border-l sm:border-black/10'} ${i === 2 ? 'sm:pr-0' : ''}`}
                    style={{
                      fontFamily: '"IBM Plex Mono", monospace',
                      fontSize: '14.5px',
                      letterSpacing: '0.03em',
                      color: '#2C3A31',
                    }}
                  >
                    <span
                      className={i === 0 ? '' : 'sm:hidden'}
                      style={{ width: '6px', height: '6px', backgroundColor: '#2A8F65', flexShrink: 0 }}
                      aria-hidden="true"
                    />
                    {b}
                  </li>
                ))}
              </motion.ul>

              {/* CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.96, duration: 0.6, ease }}
                className="flex flex-col sm:flex-row items-center justify-center gap-3"
              >
                <a
                  href="/start"
                  className="btn-magnetic inline-flex items-center gap-3 px-9 py-4"
                  style={{
                    fontFamily: '"Source Serif 4", serif',
                    fontWeight: 600,
                    fontSize: '17px',
                    letterSpacing: '0.005em',
                    backgroundColor: '#1A1A1A',
                    color: '#F7F4EF',
                  }}
                >
                  Book your fit call <ArrowRight size={19} />
                </a>
                <a
                  href="/scorecard"
                  className="inline-flex items-center gap-2 px-7 py-3.5 transition-colors"
                  style={{
                    fontFamily: '"Source Serif 4", serif',
                    fontWeight: 600,
                    fontSize: '15px',
                    fontStyle: 'italic',
                    color: '#4A4A48',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#1A1A1A')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#4A4A48')}
                >
                  See where you're leaking <ArrowRight size={14} />
                </a>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
};

export default LandingHero;
