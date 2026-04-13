import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { ScrambleText } from './ui/ScrambleText';

const Hero: React.FC = () => {
  return (
    <section className="relative pt-28 sm:pt-36 pb-20 sm:pb-28 bg-paper overflow-hidden">
      {/* Grid Background */}
      <div className="absolute inset-0 bg-grid-pattern opacity-0 sm:opacity-25 pointer-events-none z-0" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="flex flex-col lg:flex-row items-start gap-10 lg:gap-10 max-w-5xl mx-auto">

          {/* Portrait — mobile (top) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="lg:hidden shrink-0"
          >
            <img
              src="/ivan-hero.jpeg"
              alt="Iván Manfredi"
              className="w-24 sm:w-32 aspect-[3/4] rounded-xl ring-1 ring-white/10 shadow-lg object-cover object-top"
            />
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
                AI & Automation Architect
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', bounce: 0.25, duration: 0.7 }}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-[3.5rem] font-black tracking-tight leading-[1.1] mb-5"
            >
              I Build Systems That{' '}
              <br className="hidden md:block" />
              <span className="relative inline-block mt-3 px-4 sm:px-5 md:px-6 py-1.5 md:py-2 border border-zinc-700 bg-black shadow-lg">
                <span className="relative z-10 text-accent font-black tracking-wide text-2xl sm:text-3xl md:text-4xl lg:text-[2.75rem]">
                  <ScrambleText text="RUN WITHOUT YOU" />
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
              I design AI automation systems that handle the repetitive work so your team focuses on what actually moves the business.
            </motion.p>

            {/* Social proof bar */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="flex flex-wrap items-center gap-3 sm:gap-5 mb-8 text-sm text-zinc-500"
            >
              <span>40+ systems deployed</span>
              <span className="hidden sm:inline text-zinc-300">·</span>
              <span>6,000+ hours automated</span>
              <span className="hidden sm:inline text-zinc-300">·</span>
              <span>Clients in 8+ industries</span>
            </motion.div>

            {/* Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="flex flex-col sm:flex-row items-start gap-3"
            >
              <a
                href="https://calendly.com/ivan-intelligents/30min"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-magnetic w-full sm:w-auto px-7 py-3.5 bg-accent border-subtle-thick shadow-card flex items-center justify-center gap-2.5 font-bold text-base tracking-wide text-black"
              >
                Book Strategy Call <ArrowRight size={18} />
              </a>

              <a
                href="#cases"
                className="w-full sm:w-auto px-7 py-3.5 font-bold text-base tracking-wide text-zinc-500 hover:text-black transition-colors text-center flex items-center justify-center gap-2"
              >
                View Case Studies <ArrowRight size={16} />
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
            <img
              src="/ivan-hero.jpeg"
              alt="Iván Manfredi"
              className="w-72 xl:w-80 aspect-[3/4] rounded-xl ring-1 ring-white/10 shadow-xl object-cover object-top"
            />
          </motion.div>

        </div>
      </div>
    </section>
  );
};

export default Hero;
