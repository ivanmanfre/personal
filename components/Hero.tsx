import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

const Hero: React.FC = () => {
  return (
    <section
      className="relative min-h-screen flex flex-col justify-center items-center pt-32 pb-20 bg-white overflow-hidden"
    >
      {/* Subtle Grid Background */}
      <div className="absolute inset-0 bg-grid-pattern opacity-30 pointer-events-none z-0" />

      <div className="container mx-auto px-6 relative z-10 flex flex-col items-center text-center">

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tighter leading-[0.9] mb-8 uppercase max-w-5xl"
        >
          Your Best People Are Stuck{' '}
          <span className="relative inline-block">
            <span className="absolute inset-0 bg-accent -z-10 transform -rotate-1 border-2 border-black shadow-comic translate-y-1 md:translate-y-2"></span>
            <span className="relative z-10 px-2 md:px-4">Doing Your Worst Work</span>
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-lg md:text-xl font-medium max-w-2xl mx-auto mb-12 leading-relaxed text-gray-700"
        >
          I build AI agents and automation systems that free your team from manual work, so they can focus on what actually grows the business.
        </motion.p>

        {/* Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto"
        >
          <a
            href="https://calendly.com/ivan-intelligents/30min"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-8 py-4 bg-black border-2 border-black shadow-comic hover:shadow-comic-hover hover:-translate-y-1 transition-all active:shadow-none active:translate-y-1 flex items-center justify-center gap-2 font-bold text-lg uppercase tracking-wide text-white"
          >
            Book Strategy Call <ArrowRight size={20} />
          </a>

          <a
            href="#cases"
            className="w-full sm:w-auto px-8 py-4 bg-white border-2 border-black shadow-comic hover:shadow-comic-hover hover:-translate-y-1 transition-all active:shadow-none active:translate-y-1 font-bold text-lg uppercase tracking-wide text-black text-center"
          >
            See Results
          </a>
        </motion.div>

      </div>
    </section>
  );
};

export default Hero;
