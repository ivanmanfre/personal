import React from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

// Variant I — Scroll-pinned cinematic letter assembly.
// On enter, individual letters of the headline are scattered across the viewport
// at random offsets/rotations, then fly into final position in a staggered cascade.
// Italic pivot arrives last with a weight-shift entrance. Sub-copy + CTAs cascade
// after. The reader's eye assembles meaning in real time.
const HeroI: React.FC = () => {
  const ease = [0.22, 0.84, 0.36, 1] as const;

  // Random offsets are deterministic per-letter so HMR doesn't shuffle on every save
  const seed = (i: number) => {
    const s = Math.sin(i * 9.7) * 10000;
    return s - Math.floor(s);
  };

  const letterFly = (text: string, baseDelay: number, italic = false) => {
    return text.split('').map((char, i) => {
      if (char === ' ') return <span key={`s-${i}`}>&nbsp;</span>;
      const r = seed(i + (italic ? 100 : 0));
      const xOffset = (r - 0.5) * 800;
      const yOffset = (seed(i + (italic ? 200 : 50)) - 0.5) * 600;
      const rot = (seed(i + (italic ? 300 : 150)) - 0.5) * 80;
      return (
        <motion.span
          key={`${italic ? 'i' : 'n'}-${i}`}
          initial={{
            x: xOffset,
            y: yOffset,
            rotate: rot,
            opacity: 0,
            filter: 'blur(20px)',
          }}
          animate={{ x: 0, y: 0, rotate: 0, opacity: 1, filter: 'blur(0px)' }}
          transition={{
            delay: baseDelay + i * 0.04,
            duration: 1.0,
            ease,
          }}
          style={{
            display: 'inline-block',
            fontStyle: italic ? 'italic' : 'normal',
          }}
        >
          {char}
        </motion.span>
      );
    });
  };

  // Cursor-driven gradient spotlight
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.3);
  const sx = useSpring(mouseX, { stiffness: 80, damping: 20 });
  const sy = useSpring(mouseY, { stiffness: 80, damping: 20 });
  const bgGradient = useTransform(
    [sx, sy] as const,
    ([x, y]: number[]) =>
      `radial-gradient(circle at ${x * 100}% ${y * 100}%, rgba(42,143,101,0.10), transparent 50%)`
  );

  return (
    <section
      className="relative min-h-screen pt-28 pb-12 flex flex-col justify-center bg-paper overflow-hidden"
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        mouseX.set((e.clientX - rect.left) / rect.width);
        mouseY.set((e.clientY - rect.top) / rect.height);
      }}
    >
      {/* Cursor-tracking sage spotlight */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ background: bgGradient }}
      />

      {/* Sage edge rule with ticking dot at end */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.2, duration: 1.4, ease }}
        style={{
          position: 'absolute',
          top: '5rem',
          left: 0,
          right: 0,
          height: '1px',
          backgroundColor: '#2A8F65',
          transformOrigin: 'left',
          opacity: 0.5,
        }}
      />

      <div className="container mx-auto px-6 relative z-10">
        <div className="flex flex-col lg:flex-row items-start gap-12 max-w-5xl mx-auto">
          <div className="flex-1 min-w-0">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.6 }}
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
                animate={{ scale: [1, 1.4, 1] }}
                transition={{ duration: 1.6, repeat: Infinity }}
                style={{ color: '#2A8F65' }}
              >
                ●
              </motion.span>
              Iván Manfredi · Founder, Agent-Ready Ops
            </motion.div>

            <h1
              className="mb-10"
              style={{
                fontFamily: '"Instrument Serif", serif',
                fontWeight: 400,
                fontSize: 'clamp(3.5rem, 9vw, 7.5rem)',
                lineHeight: 0.94,
                letterSpacing: '-0.015em',
                color: '#1A1A1A',
              }}
            >
              <span style={{ display: 'inline-block' }}>
                {letterFly('Systems scale.', 0.5)}
              </span>
              <br />
              <span style={{ display: 'inline-block' }}>
                {letterFly('Headcount ', 1.6)}
                <span style={{ position: 'relative', display: 'inline-block' }}>
                  {letterFly("doesn't.", 2.4, true)}
                  <motion.span
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 3.4, duration: 0.9, ease }}
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
              </span>
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 3.0, duration: 1.0, ease }}
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
              transition={{ delay: 3.4, duration: 0.7, ease }}
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
            initial={{ opacity: 0, x: 60, filter: 'blur(20px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            transition={{ delay: 1.2, duration: 1.2, ease }}
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
      </div>
    </section>
  );
};

export default HeroI;
