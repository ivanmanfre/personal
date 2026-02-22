import React from 'react';
import { motion } from 'framer-motion';

interface MarqueeProps {
  children: React.ReactNode;
  direction?: 'left' | 'right';
  speed?: number;
  className?: string;
}

const Marquee: React.FC<MarqueeProps> = ({ 
  children, 
  direction = 'left', 
  speed = 40,
  className = ''
}) => {
  return (
    <div className={`overflow-hidden whitespace-nowrap flex w-full ${className}`}>
      <motion.div
        className="flex shrink-0 min-w-full items-center justify-around"
        initial={{ x: direction === 'left' ? 0 : '-100%' }}
        animate={{ x: direction === 'left' ? '-100%' : 0 }}
        transition={{
          repeat: Infinity,
          ease: "linear",
          duration: speed
        }}
      >
        {children}
      </motion.div>
      <motion.div
        className="flex shrink-0 min-w-full items-center justify-around"
        initial={{ x: direction === 'left' ? 0 : '-100%' }}
        animate={{ x: direction === 'left' ? '-100%' : 0 }}
        transition={{
          repeat: Infinity,
          ease: "linear",
          duration: speed
        }}
      >
        {children}
      </motion.div>
    </div>
  );
};

export default Marquee;
