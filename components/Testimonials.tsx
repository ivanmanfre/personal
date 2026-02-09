import React from 'react';
import { Star, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

const reviews = [
  {
    text: "Ivan is top notch. Response time is incredible, he is eager to do the work and deliverables are high functioning products.",
    name: "Don Morron",
    company: "Highland Tech",
    project: "N8N Inventory Autonomous System",
    rating: 5
  },
  {
    text: "Working with Ivan has been an absolute game-changer! He exceeded all expectations and saved our team countless hours.",
    name: "Sydney McCoy",
    company: "Real McCoy Real Estate",
    project: "Lead Flow & Slack Integration",
    rating: 5
  },
  {
    text: "Ivan is pure class, excellent, hard working and has attention to detail. Hire him!",
    name: "Client",
    company: "Construction Tech",
    project: "AI Voice Agent Infrastructure",
    rating: 5
  },
  {
    text: "Ivan is fantastic. Very knowledgable in n8n. Will be doing more projects with Ivan.",
    name: "Client",
    company: "SaaS Platform",
    project: "SaaS Backend Automation",
    rating: 5
  },
  {
    text: "His solutions helped uncover opportunities we were missing—directly impacting our bottom line.",
    name: "Client",
    company: "E-Commerce",
    project: "Make.com Workflow Audit",
    rating: 5
  },
  {
    text: "Complete architectural overhaul. The documentation alone was worth the price.",
    name: "Client",
    company: "Enterprise",
    project: "Enterprise Systems Architecture",
    rating: 5
  }
];

// Duplicate list for infinite scroll
const marqueeReviews = [...reviews, ...reviews, ...reviews];

const TestimonialCard: React.FC<{ review: typeof reviews[0] }> = ({ review }) => (
    <div className="w-[500px] shrink-0 bg-zinc-900 border-2 border-zinc-800 p-8 relative group hover:border-accent transition-all duration-300 hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,230,118,0.15)] flex flex-col h-full">
        {/* Tech Decoration: Parallel Lines */}
        <div className="absolute top-0 right-0 p-4 flex gap-1.5 opacity-30 group-hover:opacity-100 transition-opacity">
            <div className="w-1.5 h-6 bg-zinc-700 group-hover:bg-accent transform -skew-x-12 transition-colors duration-300"></div>
            <div className="w-1.5 h-6 bg-zinc-700 group-hover:bg-accent transform -skew-x-12 transition-colors duration-300 delay-75"></div>
            <div className="w-1.5 h-6 bg-zinc-700 group-hover:bg-accent transform -skew-x-12 transition-colors duration-300 delay-100"></div>
        </div>

        {/* Project Badge */}
        <div className="mb-8">
            <div className="flex flex-col items-start gap-1">
                <span className="text-[10px] font-mono uppercase text-zinc-500 tracking-widest group-hover:text-zinc-400 transition-colors">Project Deployed</span>
                <span className="bg-zinc-800 text-gray-200 px-3 py-1.5 text-sm font-bold uppercase tracking-wide border border-zinc-600 group-hover:border-accent group-hover:text-accent group-hover:bg-zinc-900 transition-all shadow-[2px_2px_0px_0px_black]">
                    {review.project}
                </span>
            </div>
        </div>

        {/* Content: Kinetic Typography */}
        <div className="relative z-10 mb-8 flex-grow">
            <p className="font-display font-bold text-2xl md:text-3xl text-zinc-400 italic leading-tight tracking-wide group-hover:text-white transition-colors duration-300">
                "{review.text}"
            </p>
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-800 pt-5 mt-auto flex justify-between items-end">
            <div className="flex flex-col gap-2">
                <div>
                    <span className="text-sm font-bold text-white">{review.name}</span>
                    <span className="text-xs text-zinc-500 ml-2">{review.company}</span>
                </div>
                <div className="flex gap-1">
                    {[...Array(review.rating)].map((_, i) => (
                        <Star key={i} size={14} className="fill-accent text-accent drop-shadow-[0_0_8px_rgba(0,230,118,0.3)]" />
                    ))}
                </div>
            </div>
            <div className="flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                <ShieldCheck size={18} className="text-accent" />
                <span className="text-xs font-bold uppercase text-white tracking-wider">Verified</span>
            </div>
        </div>
    </div>
);

const Testimonials: React.FC = () => {
  return (
    <section className="py-20 bg-black border-y-4 border-black overflow-hidden relative z-20 flex flex-col gap-8">
      {/* Marquee Area */}
      <div className="flex flex-col gap-8 relative">
          {/* Vignettes */}
          <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-black to-transparent z-30 pointer-events-none"></div>
          <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-black to-transparent z-30 pointer-events-none"></div>

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