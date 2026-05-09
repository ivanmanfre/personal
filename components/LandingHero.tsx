import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

// Production hero for /landing — no font picker, no right rail.
// Motion: status strip drops → byline → words blur in one-by-one → italic
// pivot lands last with rotateX entrance + sage sweep → body clips in → CTAs lift.
// Portrait does entrance scale + scroll parallax. Page-level cursor spotlight in LandingPage.

const ease = [0.22, 0.84, 0.36, 1] as const;

// Auto-rolling booking quarter — always next calendar quarter
const getBookingQuarter = (): string => {
  const now = new Date();
  const currentQ = Math.floor(now.getMonth() / 3) + 1;
  const nextQ = currentQ === 4 ? 1 : currentQ + 1;
  const year = currentQ === 4 ? now.getFullYear() + 1 : now.getFullYear();
  return `Q${nextQ} ${year}`;
};

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
          fontSize: '11px',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'rgba(26,26,26,0.65)',
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
          <span style={{ color: '#2A8F65' }}>Booking {getBookingQuarter()} · 2 slots open</span>
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

      {/* Main content */}
      <motion.div
        style={{ y: headlineY, opacity: headlineOpacity }}
        className="flex-1 flex flex-col justify-center relative z-10"
      >
        <div className="container mx-auto px-8 max-w-6xl">
          <div className="flex flex-col lg:flex-row items-start gap-12 lg:gap-16">

            {/* Copy column */}
            <div className="flex-1 min-w-0 pt-8 lg:pt-0">
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
                  color: 'rgba(26,26,26,0.5)',
                }}
              >
                <motion.span
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{ color: '#2A8F65', fontSize: '8px' }}
                >
                  ●
                </motion.span>
                <span>Iván Manfredi · Agent-Ready Ops</span>
              </motion.div>

              {/* Headline — word-by-word blur reveal */}
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
                {word('Systems', 0.6)}{' '}{word('scale.', 0.78)}
                <br />
                {word('Headcount', 0.96)}{' '}
                <motion.span
                  initial={{ opacity: 0, y: 60, filter: 'blur(18px)', rotateX: 28 }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)', rotateX: 0 }}
                  transition={{ delay: 1.5, duration: 1.1, ease }}
                  style={{
                    display: 'inline-block',
                    fontStyle: 'italic',
                    position: 'relative',
                    transformStyle: 'preserve-3d',
                    transformOrigin: 'bottom',
                  }}
                >
                  doesn't.
                  {/* Sage sweep highlight */}
                  <motion.span
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 2.4, duration: 0.9, ease }}
                    style={{
                      position: 'absolute',
                      left: '-2%',
                      right: '-2%',
                      bottom: '0.18em',
                      height: '0.44em',
                      backgroundColor: '#2A8F65',
                      transformOrigin: 'left',
                      opacity: 0.28,
                      zIndex: -1,
                    }}
                  />
                </motion.span>
              </h1>

              {/* Body — clip-mask reveal */}
              <motion.p
                initial={{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }}
                animate={{ opacity: 1, clipPath: 'inset(0 0% 0 0)' }}
                transition={{ delay: 2.2, duration: 1.4, ease }}
                className="max-w-xl mb-10"
                style={{
                  fontFamily: '"Source Serif 4", Georgia, serif',
                  fontWeight: 400,
                  fontSize: '19px',
                  lineHeight: 1.62,
                  color: '#3D3D3B',
                }}
              >
                I build AI systems for growing service businesses, so you scale without
                scaling payroll.{' '}
                <span style={{ fontStyle: 'italic', color: '#2A8F65' }}>
                  Ninety-day payback, or I don't build it.
                </span>
              </motion.p>

              {/* CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 2.8, duration: 0.7, ease }}
                className="flex flex-col sm:flex-row items-start gap-3"
              >
                <a
                  href="/assessment"
                  className="btn-magnetic inline-flex items-center gap-2.5 px-7 py-3.5 bg-accent text-white"
                  style={{
                    fontFamily: '"Source Serif 4", serif',
                    fontWeight: 600,
                    fontSize: '16px',
                  }}
                >
                  Build your Blueprint <ArrowRight size={18} />
                </a>
                <a
                  href="/scorecard"
                  className="inline-flex items-center gap-2 px-7 py-3.5 text-ink-mute hover:text-black transition-colors"
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

            {/* Portrait — entrance scale + scroll parallax */}
            <motion.div
              style={{ scale: portraitScale, y: portraitY, position: 'relative' }}
              initial={{ opacity: 0, scale: 1.12, filter: 'blur(18px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              transition={{ delay: 0.8, duration: 1.4, ease }}
              className="hidden lg:block shrink-0 pt-4"
            >
              <picture>
                <source
                  type="image/webp"
                  srcSet="/ivan-hero-800.webp 800w, /ivan-hero-1200.webp 1200w"
                  sizes="(min-width: 1280px) 320px, 288px"
                />
                <img
                  src="/ivan-hero.jpeg"
                  alt="Iván Manfredi"
                  width="1200"
                  height="1600"
                  loading="eager"
                  className="w-72 xl:w-80 aspect-[3/4] object-cover object-top"
                  style={{ borderRadius: '0', display: 'block' }}
                />
              </picture>
            </motion.div>

          </div>
        </div>
      </motion.div>
    </section>
  );
};

export default LandingHero;
