import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Terminal } from 'lucide-react';
import { ScrambleText } from './ui/ScrambleText';

const Hero: React.FC = () => {
  return (
    <section className="relative min-h-screen flex flex-col justify-center items-center pt-32 pb-20 bg-paper overflow-hidden">
      {/* Subtle Grid Background */}
      <div className="absolute inset-0 bg-grid-pattern opacity-50 pointer-events-none z-0" />

      <div className="container mx-auto px-6 relative z-10 flex flex-col items-center text-center">



        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl md:text-6xl lg:text-7xl font-black tracking-tight leading-none mb-10 uppercase max-w-5xl mx-auto"
        >
          Replacing Operational Drag With{' '}
          <br className="hidden md:block" />
          <span className="relative inline-block mt-4 px-6 md:px-8 py-2 md:py-3 border-2 border-zinc-800 bg-black shadow-[4px_4px_0px_0px_rgba(0,230,118,0.15)] overflow-hidden group">
            {/* Subtle background glow */}
            <span className="absolute inset-0 w-full h-full bg-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></span>

            {/* Scanning Laser Line */}
            <motion.span
              initial={{ top: '-10%' }}
              animate={{ top: '110%' }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              className="absolute left-0 right-0 h-[1px] bg-accent/40 drop-shadow-[0_0_8px_rgba(0,230,118,0.8)] z-0"
            />

            <span className="relative z-10 text-accent font-black tracking-widest text-4xl md:text-5xl lg:text-6xl drop-shadow-[0_0_10px_rgba(0,230,118,0.3)]">
              <ScrambleText text="IMMUTABLE INFRASTRUCTURE" />
            </span>
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-xl md:text-2xl font-bold max-w-3xl mx-auto mb-12 leading-relaxed text-gray-800"
        >
          I engineer continuous, self-healing AI and API systems that permanently eliminate repetitive labor.
        </motion.p>

        {/* Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center gap-6 w-full sm:w-auto"
        >
          <a
            href="https://calendly.com/ivan-intelligents/30min"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-magnetic w-full sm:w-auto px-10 py-5 bg-black comic-border-thick shadow-comic flex items-center justify-center gap-3 font-black text-xl uppercase tracking-wide text-white group"
          >
            <span className="group-hover:text-black transition-colors duration-300 z-10 flex items-center gap-3">Book Strategy Call <ArrowRight size={24} /></span>
          </a>

          <a
            href="#cases"
            className="btn-magnetic w-full sm:w-auto px-10 py-5 bg-white comic-border-thick shadow-comic font-black text-xl uppercase tracking-wide text-black text-center"
          >
            View Case Studies
          </a>
        </motion.div>
      </div>

    </section>
  );
};

export default Hero;
