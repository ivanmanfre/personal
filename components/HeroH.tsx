import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useFontPicker } from './FontPicker';

// Variant H — Cinematic kinetic reveal with live font picker.
// Multi-stage choreography: tag fades, headline assembles word-by-word with blur,
// italic pivot lands LAST with weighted entrance + sage highlight sweep, sub-copy
// types in, CTAs lift. Portrait does an entrance scale + scroll parallax.
const HeroH: React.FC = () => {
  const [font, FontPicker] = useFontPicker('hero-h', 'dmserif');
  const containerRef = React.useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  });

  const portraitScale = useTransform(scrollYProgress, [0, 1], [1, 1.18]);
  const portraitY = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const headlineY = useTransform(scrollYProgress, [0, 1], [0, -40]);
  const headlineOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0.4]);

  const ease = [0.22, 0.84, 0.36, 1] as const;

  const word = (text: string, delay: number, italic = false) => (
    <motion.span
      initial={{ opacity: 0, y: 40, filter: 'blur(10px)' }}
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
      className="relative min-h-screen pt-28 pb-12 flex flex-col justify-center bg-paper overflow-hidden"
    >
      <FontPicker />

      {/* Slow drifting paper grain */}
      <motion.div
        className="absolute inset-0 pointer-events-none opacity-30"
        animate={{ backgroundPosition: ['0px 0px', '120px 120px'] }}
        transition={{ duration: 90, repeat: Infinity, ease: 'linear' }}
        style={{
          backgroundImage:
            'url("data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22/></filter><rect width=%22120%22 height=%22120%22 filter=%22url(%23n)%22 opacity=%220.3%22/></svg>")',
        }}
      />

      {/* Slow expanding sage rule across the top */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.1, duration: 1.6, ease }}
        style={{
          position: 'absolute',
          top: '5rem',
          left: 0,
          right: 0,
          height: '1px',
          backgroundColor: '#2A8F65',
          transformOrigin: 'left',
          opacity: 0.4,
        }}
      />

      <motion.div
        style={{ y: headlineY, opacity: headlineOpacity }}
        className="container mx-auto px-6 relative z-10"
      >
        <div className="flex flex-col lg:flex-row items-start gap-12 max-w-5xl mx-auto">
          <div className="flex-1 min-w-0">
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
                color: 'rgba(26,26,26,0.55)',
              }}
            >
              <motion.span
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{ color: '#2A8F65', fontSize: '8px' }}
              >
                ●
              </motion.span>
              <span>Iván Manfredi · Agent-Ready Ops · Live</span>
            </motion.div>

            <h1
              className="mb-10"
              style={{
                fontFamily: font.family,
                fontWeight: font.weight,
                fontSize: `clamp(${3.5 * (font.scaleAdjust ?? 1)}rem, ${9 * (font.scaleAdjust ?? 1)}vw, ${7.5 * (font.scaleAdjust ?? 1)}rem)`,
                lineHeight: 0.94,
                letterSpacing: font.letterSpacing ?? '-0.015em',
                color: '#1A1A1A',
              }}
            >
              {word('Systems', 0.6)} {word('scale.', 0.78)}
              <br />
              {word('Headcount', 0.96)}{' '}
              <motion.span
                initial={{ opacity: 0, y: 60, filter: 'blur(20px)', rotateX: 30 }}
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
                <motion.span
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 2.4, duration: 0.9, ease }}
                  style={{
                    position: 'absolute',
                    left: '-2%',
                    right: '-2%',
                    bottom: '0.18em',
                    height: '0.45em',
                    backgroundColor: '#2A8F65',
                    transformOrigin: 'left',
                    opacity: 0.28,
                    zIndex: -1,
                  }}
                />
              </motion.span>
            </h1>

            {/* Sub-copy types in via mask */}
            <motion.p
              initial={{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }}
              animate={{ opacity: 1, clipPath: 'inset(0 0% 0 0)' }}
              transition={{ delay: 2.2, duration: 1.5, ease }}
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
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2.8, duration: 0.7, ease }}
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

          <motion.div
            style={{ scale: portraitScale, y: portraitY }}
            initial={{ opacity: 0, scale: 1.15, filter: 'blur(20px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            transition={{ delay: 0.8, duration: 1.4, ease }}
            className="hidden lg:block shrink-0 pt-2"
          >
            <picture>
              <source
                type="image/webp"
                srcSet="/ivan-hero-800.webp 800w, /ivan-hero-1200.webp 1200w"
                sizes="320px"
              />
              <img
                src="/ivan-hero.jpeg"
                alt="Iván Manfredi"
                width="1200"
                height="1600"
                className="w-72 xl:w-80 aspect-[3/4] object-cover object-top"
                style={{ borderRadius: '0' }}
              />
            </picture>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
};

export default HeroH;
