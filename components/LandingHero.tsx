import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { getBookingQuarter, OPEN_SLOTS } from '../lib/bookingConfig';
import HeroPipeline from './landing/diagrams/HeroPipeline';

// Production hero for /landing — no font picker, no right rail.
// v2 (2026-05-24): v20-magazine-cover transformation
//   - Sage sweep redrawn to match v20 (mostly rectangular highlighter, subtle imperfect edges, centered on letterforms)
//   - Portrait pulled out of flex flow → absolutely positioned, truly bleeds off section right edge
//   - Lede restored with italic + sage emphasis on "scale without scaling payroll"
//   - Scroll parallax preserved via wrapper

const ease = [0.22, 0.84, 0.36, 1] as const;

const LandingHero: React.FC = () => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  });

  const headlineY = useTransform(scrollYProgress, [0, 1], [0, -36]);
  const headlineOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0.5]);

  const word = (text: string, delay: number, italic = false) => (
    <motion.span
      initial={{ opacity: 0, y: 38, filter: 'blur(10px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ delay, duration: 0.85, ease }}
      style={{ display: 'inline-block', fontStyle: italic ? 'italic' : 'normal' }}
    >
      {text}
    </motion.span>
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
          <span style={{ color: '#1F6B4B' }}>Booking {getBookingQuarter()} · {OPEN_SLOTS} slots open</span>
        </div>
        <div className="hidden md:block">90-day payback or no-build</div>
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

      {/* Main content — text-only hero */}
      <motion.div
        style={{ y: headlineY, opacity: headlineOpacity }}
        className="flex-1 flex flex-col justify-center relative z-10"
      >
        <div className="container mx-auto px-8 max-w-6xl lg:max-w-7xl">
          {/* Byline + headline span the full container — display scale comes first,
              the diagram shares the row with the lede/CTA block below. */}
          <div className="pt-8 lg:pt-0">

            {/* Byline */}
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="mb-10 flex items-center gap-3"
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
              <span>Iván Manfredi · Agent-Ready Ops™</span>
            </motion.div>

            {/* Headline — DM Serif Display (brand spec) */}
            <h1
              className="mb-10"
              style={{
                fontFamily: '"DM Serif Display", "Bodoni Moda", Georgia, serif',
                fontWeight: 400,
                fontSize: 'clamp(2.6rem, 7.5vw, 6.5rem)',
                lineHeight: 0.98,
                letterSpacing: '-0.02em',
                color: '#1A1A1A',
              }}
            >
              {word('Take', 0.4)}{' '}{word('on', 0.5)}{' '}
              <motion.span
                initial={{ opacity: 0, y: 38, filter: 'blur(10px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ delay: 0.6, duration: 0.85, ease }}
                style={{ display: 'inline-block', color: '#2A8F65' }}
              >
                2–3x
              </motion.span>{' '}
              {word('more', 0.72)}{' '}{word('clients', 0.82)}
              <br />
              {/* Solid black block with paper text — brand signature move */}
              <motion.span
                initial={{ opacity: 0, y: 50, filter: 'blur(14px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ delay: 0.95, duration: 0.9, ease }}
                className="whitespace-normal sm:whitespace-nowrap"
                style={{
                  display: 'inline-block',
                  fontStyle: 'italic',
                  backgroundColor: '#1A1A1A',
                  color: '#F7F4EF',
                  padding: '0 18px 9px',
                  marginTop: '0.12em',
                }}
              >
                without adding headcount.
              </motion.span>
            </h1>
          </div>

          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_clamp(300px,23vw,340px)] lg:gap-12 lg:items-start">
          <div className="max-w-[680px]">
            {/* Body — restored italic emphasis on closer phrase */}
            <motion.p
              initial={{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }}
              animate={{ opacity: 1, clipPath: 'inset(0 0% 0 0)' }}
              transition={{ delay: 0.95, duration: 1.1, ease }}
              className="max-w-xl mb-10"
              style={{
                fontFamily: '"Source Serif 4", Georgia, serif',
                fontWeight: 400,
                fontSize: '21px',
                lineHeight: 1.55,
                color: '#3D3D3B',
              }}
            >
              AI growth and retention systems for service businesses.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.15, duration: 0.6, ease }}
              className="flex flex-col sm:flex-row items-start gap-3"
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
                See the scorecard <ArrowRight size={14} />
              </a>
            </motion.div>

            {/* Compact pipeline — mobile only, below the CTAs */}
            <div className="lg:hidden mt-14">
              <HeroPipeline compact />
            </div>
          </div>

          {/* Scene 1 — the system is the hero's visual object (desktop) */}
          <motion.div
            className="hidden lg:block"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.3, duration: 1.2, ease }}
          >
            <HeroPipeline />
          </motion.div>
          </div>
        </div>
      </motion.div>
    </section>
  );
};

export default LandingHero;
