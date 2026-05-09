import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import Marquee from './Marquee';

const STACK_WORDMARKS = [
  'Anthropic',
  'OpenAI',
  'n8n',
  'Supabase',
  'HubSpot',
  'HighLevel',
  'Stripe',
];

const ease = [0.22, 0.84, 0.36, 1] as const;

const Hero: React.FC = () => {
  return (
    <section className="relative min-h-screen pt-28 pb-20 lg:pt-0 lg:pb-24 flex flex-col justify-center bg-paper overflow-hidden">

      <div className="container mx-auto px-6 relative z-10">
        <div className="flex flex-col lg:flex-row items-start gap-10 lg:gap-16 max-w-5xl mx-auto">

          {/* Portrait — mobile (above headline) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.7, ease }}
            className="lg:hidden shrink-0 self-center"
          >
            <picture>
              <source type="image/webp" srcSet="/ivan-hero-400.webp 400w, /ivan-hero-800.webp 800w" sizes="(max-width: 640px) 160px, 192px" />
              <img
                src="/ivan-hero.jpeg"
                alt="Iván Manfredi"
                width="400"
                height="533"
                loading="eager"
                fetchPriority="high"
                className="w-44 sm:w-52 aspect-[3/4] object-cover object-top"
                style={{ borderRadius: 0 }}
              />
            </picture>
          </motion.div>

          {/* Copy column */}
          <div className="flex-1 min-w-0">

            {/* Byline */}
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="mb-8 flex items-center gap-3"
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
                style={{ color: 'var(--color-accent)', fontSize: '8px' }}
              >
                ●
              </motion.span>
              <span>Iván Manfredi · Agent-Ready Ops™</span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease }}
              className="mb-8"
              style={{
                fontFamily: '"DM Serif Display", "Bodoni Moda", Georgia, serif',
                fontWeight: 400,
                fontSize: 'clamp(3rem, 7.5vw, 6rem)',
                lineHeight: 0.96,
                letterSpacing: '-0.02em',
                color: '#1A1A1A',
              }}
            >
              Systems scale.
              <br />
              Headcount <span style={{ fontStyle: 'italic', position: 'relative' }}>
                doesn't.
                <motion.span
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 1.0, duration: 0.9, ease }}
                  style={{
                    position: 'absolute',
                    left: '-2%',
                    right: '-2%',
                    bottom: '0.18em',
                    height: '0.42em',
                    backgroundColor: 'var(--color-accent)',
                    transformOrigin: 'left',
                    opacity: 0.25,
                    zIndex: -1,
                  }}
                />
              </span>
            </motion.h1>

            {/* Lede */}
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="max-w-xl mb-10"
              style={{
                fontFamily: '"Source Serif 4", Georgia, serif',
                fontWeight: 400,
                fontSize: '19px',
                lineHeight: 1.6,
                color: '#3D3D3B',
              }}
            >
              I build AI systems for growing service businesses. So you{' '}
              <span style={{ fontStyle: 'italic', color: 'var(--color-accent)' }}>
                scale without scaling payroll.
              </span>
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.6 }}
              className="flex flex-col sm:flex-row items-start gap-3"
            >
              <a
                href="/assessment"
                className="inline-flex items-center gap-2.5 px-7 py-3.5"
                style={{
                  fontFamily: '"Source Serif 4", Georgia, serif',
                  fontWeight: 600,
                  fontSize: '16px',
                  backgroundColor: '#1A1A1A',
                  color: '#F7F4EF',
                }}
              >
                Build your Blueprint <ArrowRight size={18} />
              </a>
              <a
                href="/scorecard"
                className="inline-flex items-center gap-2 px-7 py-3.5 transition-colors"
                style={{
                  fontFamily: '"Source Serif 4", Georgia, serif',
                  fontWeight: 600,
                  fontSize: '16px',
                  fontStyle: 'italic',
                  color: 'rgba(26,26,26,0.55)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#1A1A1A')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(26,26,26,0.55)')}
              >
                Are you Agent-Ready? <ArrowRight size={16} />
              </a>
            </motion.div>
          </div>

          {/* Portrait — desktop */}
          <motion.div
            initial={{ opacity: 0, scale: 1.08, filter: 'blur(12px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            transition={{ delay: 0.5, duration: 1.2, ease }}
            className="hidden lg:block shrink-0 pt-2"
          >
            <picture>
              <source type="image/webp" srcSet="/ivan-hero-800.webp 800w, /ivan-hero-1200.webp 1200w" sizes="(min-width: 1280px) 320px, 288px" />
              <img
                src="/ivan-hero.jpeg"
                alt="Iván Manfredi"
                width="1200"
                height="1600"
                loading="eager"
                fetchPriority="high"
                className="w-72 xl:w-80 aspect-[3/4] object-cover object-top"
                style={{ borderRadius: 0 }}
              />
            </picture>
          </motion.div>

        </div>
      </div>

      {/* Wordmark strip — built-with marquee */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.0, duration: 0.6 }}
        className="absolute bottom-0 left-0 right-0 z-10 border-t py-4"
        style={{
          backgroundColor: 'rgba(247,244,239,0.9)',
          backdropFilter: 'blur(8px)',
          borderColor: 'rgba(26,26,26,0.08)',
        }}
      >
        <div className="container mx-auto px-6 flex items-center gap-6 max-w-6xl">
          <span
            className="hidden sm:inline-block shrink-0"
            style={{
              fontFamily: '"IBM Plex Mono", monospace',
              fontSize: '10px',
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              color: 'rgba(26,26,26,0.45)',
            }}
          >
            Built with
          </span>
          <div className="flex-1 min-w-0">
            <Marquee speed={60} className="opacity-65">
              {STACK_WORDMARKS.map((mark) => (
                <span
                  key={mark}
                  className="mx-8 shrink-0"
                  style={{
                    fontFamily: '"IBM Plex Mono", monospace',
                    fontSize: '12px',
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: 'rgba(26,26,26,0.62)',
                  }}
                >
                  {mark}
                </span>
              ))}
            </Marquee>
          </div>
        </div>
      </motion.div>
    </section>
  );
};

export default Hero;
