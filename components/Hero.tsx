import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { ScrambleText } from './ui/ScrambleText';

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
              <span className="font-mono text-xs uppercase tracking-widest bg-black text-accent px-3 py-1.5">
                Agent-Ready Ops™
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', bounce: 0.25, duration: 0.7 }}
              className="text-4xl sm:text-4xl md:text-5xl lg:text-[3.5rem] font-bold tracking-tight leading-[1.1] mb-5"
            >
              Systems scale.{' '}
              <br className="hidden md:block" />
              <span className="relative inline-block mt-3 px-4 sm:px-5 md:px-6 py-1.5 md:py-2 border border-zinc-700 bg-black shadow-card-subtle">
                <span className="relative z-10 text-accent font-bold tracking-wide text-[1.7rem] sm:text-3xl md:text-4xl lg:text-[2.75rem]">
                  <ScrambleText text="HEADCOUNT DOESN'T" />
                </span>
              </span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="text-base md:text-lg font-medium max-w-lg mb-5 leading-relaxed text-zinc-600 border-l-2 border-accent/40 pl-5"
            >
              I build AI systems for growing service businesses that want to grow without the hiring treadmill. Every project pays back in 90 days or I don't build it.
            </motion.p>

            {/* Social proof bar — hidden on mobile */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="hidden sm:flex flex-wrap items-center gap-3 sm:gap-4 mb-8 text-sm text-zinc-500"
            >
              <span>40+ systems shipped</span>
              <span className="text-zinc-300">·</span>
              <span>6,000+ hours automated</span>
              <span className="text-zinc-300">·</span>
              <span>Agencies, consultancies, law &amp; accounting firms</span>
            </motion.div>

            {/* Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="flex flex-col sm:flex-row items-start gap-3 mt-6 sm:mt-0"
            >
              <a
                href="/assessment"
                className="btn-magnetic w-full sm:w-auto px-7 py-3.5 bg-accent border-subtle-thick shadow-card flex items-center justify-center gap-2.5 font-bold text-base tracking-wide text-black"
              >
                Start with the Assessment — $2,500 <ArrowRight size={18} />
              </a>

              <a
                href="#method"
                className="w-full sm:w-auto px-7 py-3.5 font-bold text-base tracking-wide text-zinc-500 hover:text-black transition-colors text-center flex items-center justify-center gap-2"
              >
                See the methodology <ArrowRight size={16} />
              </a>
            </motion.div>

            {/* Methodology sub-line */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-6 text-sm text-zinc-500 max-w-md"
            >
              Built on the Agent-Ready Ops method — the four conditions every AI build needs before you ship.
            </motion.p>
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
