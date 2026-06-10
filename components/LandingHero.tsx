import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import { getBookingQuarter, OPEN_SLOTS } from '../lib/bookingConfig';

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

  const portraitScale = useTransform(scrollYProgress, [0, 1], [1, 1.15]);
  const portraitY = useTransform(scrollYProgress, [0, 1], [0, -70]);
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
            style={{ color: '#2A8F65', fontSize: '9px' }}
          >
            ●
          </motion.span>
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

      {/* Portrait — tight editorial head/shoulders crop, less aggressive bleed */}
      <div
        className="hidden lg:block absolute pointer-events-none"
        style={{
          right: '-50px',
          top: '54%',
          transform: 'translateY(-50%)',
          width: 'clamp(380px, 36vw, 540px)',
          zIndex: 5,
        }}
      >
        <motion.div
          style={{ scale: portraitScale, y: portraitY }}
          initial={{ opacity: 0, scale: 1.06 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.9, ease }}
        >
          <picture>
            <source
              type="image/webp"
              srcSet="/ivan-hero-duotone-800.webp 800w, /ivan-hero-duotone-1200.webp 1200w"
              sizes="(min-width: 1280px) 540px, 432px"
            />
            <img
              src="/ivan-hero-duotone.png"
              alt="Iván Manfredi"
              width="928"
              height="1152"
              loading="eager"
              className="w-full aspect-[928/1152] object-cover object-top"
              style={{ borderRadius: '0', display: 'block' }}
            />
          </picture>
        </motion.div>
      </div>

      {/* Main content — copy column only now (portrait is absolute) */}
      <motion.div
        style={{ y: headlineY, opacity: headlineOpacity }}
        className="flex-1 flex flex-col justify-center relative z-10"
      >
        <div className="container mx-auto px-8 max-w-6xl">
          <div className="max-w-[640px] xl:max-w-[720px] pt-8 lg:pt-0">

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
                style={{ color: '#2A8F65', fontSize: '8px' }}
              >
                ●
              </motion.span>
              <span>Iván Manfredi · Agent-Ready Ops™</span>
            </motion.div>

            {/* Headline — DM Serif Display (brand spec) */}
            <h1
              className="mb-10"
              style={{
                fontFamily: '"DM Serif Display", "Bodoni Moda", Georgia, serif',
                fontWeight: 400,
                fontSize: 'clamp(3.2rem, 8.5vw, 7rem)',
                lineHeight: 0.96,
                letterSpacing: '-0.02em',
                color: '#1A1A1A',
              }}
            >
              {word('Systems', 0.4)}{' '}{word('scale.', 0.52)}
              <br />
              {word('Headcount', 0.64)}{' '}
              <motion.span
                initial={{ opacity: 0, y: 60, filter: 'blur(18px)', rotateX: 28 }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)', rotateX: 0 }}
                transition={{ delay: 0.85, duration: 0.9, ease }}
                style={{
                  display: 'inline-block',
                  fontStyle: 'italic',
                  position: 'relative',
                  transformStyle: 'preserve-3d',
                  transformOrigin: 'bottom',
                }}
              >
                doesn't.
                {/* Sage sweep — v20-style highlighter: mostly rectangular, subtle imperfect edges, centered on letterforms */}
                <motion.svg
                  initial={{ scaleX: 0, opacity: 0 }}
                  animate={{ scaleX: 1, opacity: 1 }}
                  transition={{ delay: 1.4, duration: 0.85, ease }}
                  viewBox="0 0 400 100"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: '-5%',
                    right: '-5%',
                    top: '0.18em',
                    width: '110%',
                    height: '0.78em',
                    transformOrigin: 'left',
                    zIndex: -1,
                    overflow: 'visible',
                  }}
                >
                  {/* Highlighter band: top edge ~y=10-18, bottom edge ~y=82-92.
                      Mostly flat with subtle bumps — reads as hand-painted marker stroke, not wavy ribbon. */}
                  <path
                    d="M 6 14 Q 70 10 140 14 Q 220 18 290 12 Q 350 15 394 16 L 394 86 Q 350 88 290 84 Q 220 92 140 86 Q 70 90 6 84 Z"
                    fill="#2A8F65"
                    opacity="0.85"
                  />
                </motion.svg>
              </motion.span>
            </h1>

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
              Growth and retention systems for service businesses, so you add pipeline and margin without adding payroll.{' '}
              <span style={{ fontStyle: 'italic', color: '#1A1A1A', fontWeight: 500 }}>
                Stop being the bottleneck in your own company.
              </span>
            </motion.p>

            <motion.ul
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.05, duration: 0.7, ease }}
              className="mb-10 flex flex-wrap gap-2.5"
            >
              {['More pipeline without more hires', "Win more of the deals you're already in", "Clients that don't quietly churn"].map((b) => (
                <li
                  key={b}
                  className="inline-flex items-center gap-2 rounded-full"
                  style={{
                    border: '1px solid rgba(42,143,101,0.30)',
                    backgroundColor: 'rgba(42,143,101,0.07)',
                    padding: '7px 15px',
                    fontFamily: '"IBM Plex Mono", monospace',
                    fontSize: '12px',
                    letterSpacing: '0.02em',
                    color: '#2C3A31',
                  }}
                >
                  <Check size={13} strokeWidth={2.6} style={{ color: '#2A8F65', flexShrink: 0 }} aria-hidden="true" />
                  {b}
                </li>
              ))}
            </motion.ul>

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
                Take the 2-min Scorecard <ArrowRight size={14} />
              </a>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </section>
  );
};

export default LandingHero;
