import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { ScrambleText } from './ui/ScrambleText';

const stats = [
  { number: '800+', label: 'Hours Eliminated' },
  { number: '100%', label: 'Job Success Score' },
  { number: '20x', label: 'Output Multiplier' },
];

const Hero: React.FC = () => {
  return (
    <section className="relative min-h-screen flex flex-col justify-center pt-32 pb-24 bg-paper overflow-hidden">
      {/* Grid Background */}
      <div className="absolute inset-0 bg-grid-pattern opacity-50 pointer-events-none z-0" />

      {/* Decorative large number */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 text-[22rem] font-black text-black/[0.03] select-none pointer-events-none leading-none pr-8">
        01
      </div>

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
          className="text-5xl md:text-6xl lg:text-7xl font-black tracking-tight leading-none mb-8 uppercase max-w-5xl"
        >
          Replacing Operational Drag With{' '}
          <br className="hidden md:block" />
          <span className="relative inline-block mt-4 px-6 md:px-8 py-2 md:py-3 border-2 border-zinc-800 bg-black shadow-[6px_6px_0px_0px_rgba(0,230,118,1)]">
            <span className="relative z-10 text-accent font-black tracking-widest text-4xl md:text-5xl lg:text-6xl">
              <ScrambleText text="IMMUTABLE INFRASTRUCTURE" />
            </span>
          </span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="text-xl md:text-2xl font-bold max-w-2xl mb-10 leading-relaxed text-gray-700 border-l-4 border-black pl-6"
        >
          I engineer self-healing AI and API systems that permanently eliminate repetitive labor.
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
            className="btn-magnetic w-full sm:w-auto px-10 py-5 bg-black comic-border-thick shadow-comic flex items-center justify-center gap-3 font-black text-xl uppercase tracking-wide text-white group"
          >
            <span className="group-hover:text-black transition-colors duration-300 z-10 flex items-center gap-3">
              Book Strategy Call <ArrowRight size={24} />
            </span>
          </a>

          <a
            href="#cases"
            className="btn-magnetic w-full sm:w-auto px-10 py-5 bg-white comic-border-thick shadow-comic font-black text-xl uppercase tracking-wide text-black text-center"
          >
            View Case Studies
          </a>
        </motion.div>

        {/* Stat Strip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="flex flex-col sm:flex-row border-4 border-black divide-y-4 sm:divide-y-0 sm:divide-x-4 divide-black max-w-xl"
        >
          {stats.map((stat, i) => (
            <div key={i} className="flex-1 px-6 py-4 bg-white">
              <div className="text-3xl font-black">{stat.number}</div>
              <div className="text-xs font-bold uppercase tracking-widest text-gray-500 mt-0.5">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-8 flex flex-col items-center gap-2">
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          className="w-0.5 h-10 bg-black/30"
        />
        <span className="font-mono text-[10px] uppercase tracking-widest text-gray-400">Scroll</span>
      </div>
    </section>
  );
};

export default Hero;
