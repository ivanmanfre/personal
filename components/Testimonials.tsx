import React from 'react';
import { Star, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

const reviews = [
  {
    text: "Ivan is top notch. Response time is incredible, he is eager to do the work and deliverables are high functioning products.",
    project: "N8N Inventory Autonomous System",
    rating: 5
  },
  {
    text: "Working with Ivan has been an absolute game-changer! He exceeded all expectations and saved our team countless hours.",
    project: "Lead Flow & Slack Integration",
    rating: 5
  },
  {
    text: "Ivan is pure class, excellent, hard working and has attention to detail. Hire him!",
    project: "AI Voice Agent Infrastructure",
    rating: 5
  },
  {
    text: "Ivan is fantastic. Very knowledgable in n8n. Will be doing more projects with Ivan.",
    project: "SaaS Backend Automation",
    rating: 5
  },
  {
    text: "His solutions helped uncover opportunities we were missing, directly impacting our bottom line.",
    project: "Make.com Workflow Audit",
    rating: 5
  },
  {
    text: "Complete architectural overhaul. The documentation alone was worth the price.",
    project: "Enterprise Systems Architecture",
    rating: 5
  }
];

// Duplicate list for infinite scroll
const marqueeReviews = [...reviews, ...reviews, ...reviews];

const TestimonialCard: React.FC<{ review: typeof reviews[0] }> = ({ review }) => (
  <div className="w-[500px] shrink-0 bg-white border-4 border-black p-8 relative group hover:shadow-comic-hover hover-lift transition-all duration-300 flex flex-col h-full shadow-comic">
    {/* Tech Decoration: Parallel Lines */}
    <div className="absolute top-0 right-0 p-4 flex gap-1.5 opacity-20 group-hover:opacity-100 transition-opacity">
      <div className="w-1.5 h-6 bg-black transform -skew-x-12"></div>
      <div className="w-1.5 h-6 bg-black transform -skew-x-12"></div>
      <div className="w-1.5 h-6 bg-accent transform -skew-x-12"></div>
    </div>

    {/* Project Badge */}
    <div className="mb-8">
      <div className="flex flex-col items-start gap-1">
        <span className="text-[10px] font-mono uppercase text-gray-400 tracking-widest">Project Deployed</span>
        <span className="bg-black text-white px-3 py-1.5 text-sm font-bold uppercase tracking-wide border border-black shadow-[2px_2px_0px_0px_rgba(0,230,118,1)]">
          {review.project}
        </span>
      </div>
    </div>

    {/* Content */}
    <div className="relative z-10 mb-8 flex-grow">
      <p className="font-display font-bold text-2xl md:text-3xl text-zinc-700 italic leading-tight tracking-wide group-hover:text-black transition-colors duration-300">
        "{review.text}"
      </p>
    </div>

    {/* Footer */}
    <div className="border-t-4 border-black pt-5 mt-auto flex justify-between items-end">
      <div className="flex flex-col gap-1">
        <span className="text-[10px] uppercase font-mono text-gray-500 font-bold">Client Rating</span>
        <div className="flex gap-1">
          {[...Array(review.rating)].map((_, i) => (
            <Star key={i} size={18} className="fill-accent text-accent" />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ShieldCheck size={18} className="text-accent" />
        <span className="text-xs font-bold uppercase text-black tracking-wider">Verified</span>
      </div>
    </div>
  </div>
);

const Testimonials: React.FC = () => {
  return (
    <section className="py-20 bg-paper border-t-4 border-black overflow-hidden relative z-20 flex flex-col gap-8">
      {/* Section Label */}
      <div className="container mx-auto px-6 relative z-40 flex justify-center mb-4">
        <a
          href="https://www.upwork.com/freelancers/~01ce6d9c9060674d84"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-black border-2 border-black text-white font-mono text-xs uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,230,118,1)] hover:-translate-y-0.5 transition-transform"
        >
          [ DEPLOYMENT FEEDBACK ] <span className="text-accent">| 100% JSS</span>
        </a>
      </div>

      {/* Marquee Area */}
      <div className="flex flex-col gap-8 relative">
        {/* Vignettes */}
        <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-paper to-transparent z-30 pointer-events-none"></div>
        <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-paper to-transparent z-30 pointer-events-none"></div>

        {/* Row 1: Left Direction */}
        <div className="relative flex w-full">
          <motion.div
            className="flex gap-8 items-stretch w-max px-4"
            animate={{ x: "-50%" }}
            transition={{
              duration: 120,
              repeat: Infinity,
              ease: "linear"
            }}
          >
            {marqueeReviews.map((review, i) => (
              <TestimonialCard key={`row1-${i}`} review={review} />
            ))}
          </motion.div>
        </div>

        {/* Row 2: Right Direction */}
        <div className="relative flex w-full">
          <motion.div
            className="flex gap-8 items-stretch w-max px-4"
            initial={{ x: "-50%" }}
            animate={{ x: "0%" }}
            transition={{
              duration: 140,
              repeat: Infinity,
              ease: "linear"
            }}
          >
            {marqueeReviews.map((review, i) => (
              <TestimonialCard key={`row2-${i}`} review={review} />
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
