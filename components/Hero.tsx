import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

const Hero: React.FC = () => {
  return (
    <section className="relative min-h-screen flex flex-col justify-center bg-paper overflow-hidden">
      {/* Grid Background */}
      <div className="absolute inset-0 bg-grid-pattern hidden sm:block opacity-[0.12] pointer-events-none z-0" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="flex flex-col lg:flex-row items-start gap-8 lg:gap-10 max-w-5xl mx-auto">

          {/* Portrait — mobile (top) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="lg:hidden shrink-0 self-center"
          >
            <picture>
              <source
                type="image/webp"
                srcSet="/ivan-hero-400.webp 400w, /ivan-hero-800.webp 800w"
                sizes="(max-width: 640px) 160px, 192px"
              />
              <img
                src="/ivan-hero.jpeg"
                alt="Iván Manfredi"
                width="400"
                height="533"
                loading="eager"
                fetchPriority="high"
                className="w-40 sm:w-48 aspect-[3/4] rounded-2xl ring-1 ring-white/10 shadow-card-subtle object-cover object-top portrait-editorial"
              />
            </picture>
          </motion.div>

          {/* Left — Copy */}
          <div className="flex-1 min-w-0">
            {/* Tag */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
              className="mb-5"
            >
              <span className="inline-block text-[11px] uppercase tracking-[0.14em] font-medium text-ink-soft border border-[color:var(--color-hairline-bold)] rounded px-2 py-1">
                Agent-Ready Ops™
              </span>
            </motion.div>

            {/* Headline — editorial restraint, italic serif emphasis */}
            <motion.h1
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', bounce: 0.25, duration: 0.7 }}
              className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-semibold tracking-tight leading-[1.02] mb-6"
            >
              Systems <span className="font-drama italic font-normal">scale.</span>
              <br />
              Headcount <span className="font-drama italic font-normal">doesn't.</span>
            </motion.h1>

            {/* Subheadline — one sentence */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="text-lg md:text-xl font-medium max-w-lg mb-10 leading-relaxed text-zinc-600"
            >
              AI systems for growing service businesses.
            </motion.p>

            {/* Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="flex flex-col sm:flex-row items-start gap-3"
            >
              <a
                href="/assessment"
                className="btn-magnetic w-full sm:w-auto px-7 py-3.5 bg-accent rounded-lg border-subtle-thick shadow-card-subtle flex items-center justify-center gap-2.5 font-semibold text-base tracking-wide text-black"
              >
                Book the Assessment <ArrowRight size={18} />
              </a>

              <a
                href="#method"
                className="w-full sm:w-auto px-7 py-3.5 font-semibold text-base tracking-wide text-zinc-500 hover:text-black transition-colors text-center flex items-center justify-center gap-2"
              >
                See the method <ArrowRight size={16} />
              </a>
            </motion.div>
          </div>

          {/* Right — Portrait */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="hidden lg:block shrink-0 pt-8"
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
                fetchPriority="high"
                className="w-72 xl:w-80 aspect-[3/4] rounded-2xl ring-1 ring-white/10 shadow-card-lift object-cover object-top portrait-editorial"
              />
            </picture>
          </motion.div>

        </div>
      </div>
    </section>
  );
};

export default Hero;
