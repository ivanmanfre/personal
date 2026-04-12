import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { ScrambleText } from './ui/ScrambleText';

const Hero: React.FC = () => {
  return (
    <section className="relative min-h-screen flex flex-col justify-center pt-20 sm:pt-32 pb-16 sm:pb-24 bg-paper overflow-hidden">
      {/* Grid Background */}
      <div className="absolute inset-0 bg-grid-pattern opacity-0 sm:opacity-25 pointer-events-none z-0" />

      <div className="container mx-auto px-6 relative z-10">

        {/* Tag — proof signal instead of title */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
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
          className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight leading-none mb-8 max-w-5xl"
        >
          I Build Systems That{' '}
          <br className="hidden md:block" />
          <span className="relative inline-block mt-4 px-4 sm:px-6 md:px-8 py-2 md:py-3 border border-zinc-700 bg-black shadow-lg">
            <span className="relative z-10 text-accent font-black tracking-wide text-2xl sm:text-4xl md:text-5xl lg:text-6xl">
              <ScrambleText text="RUN WITHOUT YOU" />
            </span>
          </span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="text-lg md:text-2xl font-medium max-w-2xl mb-6 leading-relaxed text-zinc-700 border-l-2 border-accent/40 pl-6"
        >
          I design AI automation systems that handle the repetitive work so your team focuses on what actually moves the business.
        </motion.p>

        {/* Social proof bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap items-center gap-4 sm:gap-6 mb-10 text-sm font-medium text-zinc-500"
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
          className="flex flex-col sm:flex-row items-start gap-4"
        >
          <a
            href="https://calendly.com/ivan-intelligents/30min"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-magnetic w-full sm:w-auto px-8 sm:px-10 py-4 sm:py-5 bg-accent border-subtle-thick shadow-card flex items-center justify-center gap-3 font-bold text-lg sm:text-xl tracking-wide text-black"
          >
            Book Strategy Call <ArrowRight size={20} />
          </a>

          <a
            href="#cases"
            className="w-full sm:w-auto px-8 sm:px-10 py-4 sm:py-5 font-bold text-lg sm:text-xl tracking-wide text-zinc-600 hover:text-black transition-colors text-center flex items-center justify-center gap-2"
          >
            View Case Studies <ArrowRight size={18} />
          </a>
        </motion.div>

      </div>
    </section>
  );
};

export default Hero;
