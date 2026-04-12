import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { ScrambleText } from './ui/ScrambleText';

const Hero: React.FC = () => {
  return (
    <section className="relative min-h-screen flex flex-col justify-center pt-32 pb-24 bg-paper overflow-hidden">
      {/* Grid Background */}
      <div className="absolute inset-0 bg-grid-pattern opacity-50 pointer-events-none z-0" />

      <div className="container mx-auto px-6 relative z-10">

        {/* Tag */}
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
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight leading-none mb-8 max-w-5xl"
        >
          I Build Systems That{' '}
          <br className="hidden md:block" />
          <span className="relative inline-block mt-4 px-4 sm:px-6 md:px-8 py-2 md:py-3 border border-zinc-700 bg-black shadow-lg">
            <span className="relative z-10 text-accent font-black tracking-wide text-3xl sm:text-4xl md:text-5xl lg:text-6xl">
              <ScrambleText text="FREE YOUR TEAM" />
            </span>
          </span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="text-xl md:text-2xl font-normal max-w-2xl mb-10 leading-relaxed text-zinc-600 border-l-2 border-zinc-300 pl-6"
        >
          I design AI automation systems that handle the repetitive work — so your team focuses on what actually moves the business.
        </motion.p>

        {/* Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="flex flex-col sm:flex-row items-start gap-4 mb-14"
        >
          <a
            href="https://calendly.com/ivan-intelligents/30min"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-magnetic w-full sm:w-auto px-10 py-5 bg-black border-subtle-thick shadow-card flex items-center justify-center gap-3 font-bold text-xl tracking-wide text-white group"
          >
            <span className="group-hover:text-black transition-colors duration-300 z-10 flex items-center gap-3">
              Book Strategy Call <ArrowRight size={24} />
            </span>
          </a>

          <a
            href="#cases"
            className="btn-magnetic w-full sm:w-auto px-10 py-5 bg-white border-subtle-thick shadow-card font-bold text-xl tracking-wide text-black text-center"
          >
            View Case Studies
          </a>
        </motion.div>

      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-8 flex flex-col items-center gap-2">
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          className="w-0.5 h-10 bg-black/30"
        />
        <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">Scroll</span>
      </div>
    </section>
  );
};

export default Hero;
