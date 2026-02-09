import React from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { ArrowRight, Activity } from 'lucide-react';

const Hero: React.FC = () => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Parallax factors
  const x1 = useTransform(x, [0, window.innerWidth], [-20, 20]);
  const y1 = useTransform(y, [0, window.innerHeight], [-20, 20]);
  const x2 = useTransform(x, [0, window.innerWidth], [30, -30]);
  const y2 = useTransform(y, [0, window.innerHeight], [30, -30]);

  const handleMouseMove = (event: React.MouseEvent) => {
    x.set(event.clientX);
    y.set(event.clientY);
  };

  return (
    <section 
      className="relative min-h-screen flex flex-col justify-center items-center pt-32 pb-20 bg-white overflow-hidden"
      onMouseMove={handleMouseMove}
    >
      {/* Blueprint Grid Background */}
      <div className="absolute inset-0 bg-grid-pattern opacity-60 pointer-events-none z-0" />

      {/* Floating Architect Elements (Parallax) */}
      <motion.div style={{ x: x1, y: y1 }} className="absolute top-24 left-12 opacity-60 pointer-events-none z-0 hidden lg:block">
         <div className="border-2 border-dashed border-black w-64 h-64 rounded-full flex items-center justify-center">
            <div className="w-2 h-2 bg-black rounded-full"></div>
         </div>
      </motion.div>

      <motion.div style={{ x: x2, y: y2 }} className="absolute bottom-32 right-12 opacity-60 pointer-events-none z-0 hidden lg:block">
         <div className="border-2 border-black w-40 h-40 rotate-12 bg-accent/20 backdrop-blur-sm"></div>
      </motion.div>

      <div className="container mx-auto px-6 relative z-10 flex flex-col items-center text-center">
        
        {/* Badge */}
        <motion.div
          initial={{ scale: 0, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          className="mb-8 bg-black text-white px-4 py-1 border-2 border-black shadow-comic flex items-center gap-2"
        >
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="font-mono font-bold uppercase text-xs md:text-sm tracking-widest">
            System Status: Operational
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          style={{
            x: useTransform(x, [0, window.innerWidth], [-5, 5]),
            y: useTransform(y, [0, window.innerHeight], [-5, 5])
          }}
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-6xl lg:text-8xl font-black tracking-tighter leading-[0.85] mb-8 uppercase relative max-w-7xl"
        >
          Your Best People <br className="md:hidden"/> Are Stuck <br />
          <span className="relative inline-block mt-2 md:mt-0">
            <span className="absolute inset-0 bg-accent -z-10 transform -rotate-1 border-2 border-black shadow-comic translate-y-1 md:translate-y-3"></span>
            <span className="relative z-10 px-2 md:px-6 text-black">Doing Your Worst Work</span>
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-xl md:text-2xl font-medium max-w-3xl mx-auto mb-12 leading-relaxed text-gray-800"
        >
          Your senior talent is buried in manual processes, copy-pasting data, and babysitting workflows that a machine should run. I build the systems that <span className="bg-black text-white px-1 font-bold">free your team</span> to do the work that actually <span className="bg-black text-white px-1 font-bold">moves the needle</span>.
        </motion.p>

        {/* Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col sm:flex-row items-center gap-6 w-full sm:w-auto"
        >
          <a
            href="https://calendly.com/ivan-intelligents/30min"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-8 py-4 bg-cyan border-2 border-black shadow-comic hover:shadow-comic-hover hover:-translate-y-1 transition-all active:shadow-none active:translate-y-1 flex items-center justify-center gap-2 font-bold text-lg uppercase tracking-wide text-white"
          >
            Book Strategy Call <ArrowRight size={24} />
          </a>

          <a
            href="#cases"
            className="w-full sm:w-auto px-8 py-4 bg-white border-2 border-black shadow-comic hover:shadow-comic-hover hover:-translate-y-1 transition-all active:shadow-none active:translate-y-1 font-bold text-lg uppercase tracking-wide text-black text-center"
          >
            See Results
          </a>
        </motion.div>

        {/* Stats Bar */}
        <div className="mt-24 w-full max-w-5xl border-2 border-black bg-white shadow-comic relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-black"></div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x-2 divide-black">
                {[
                    { label: 'Systems Deployed', value: '140+' },
                    { label: 'Hours Saved Yearly', value: '10k+' },
                    { label: 'Client Retention', value: '95%' },
                    { label: 'Avg. ROI', value: '12x' },
                ].map((stat, i) => (
                    <div key={i} className="text-center py-6 md:py-8 hover:bg-gray-50 transition-colors group">
                        <div className="text-3xl md:text-4xl font-black mb-2 group-hover:scale-110 transition-transform duration-300">{stat.value}</div>
                        <div className="font-mono font-bold uppercase text-xs text-gray-500">{stat.label}</div>
                    </div>
                ))}
            </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;