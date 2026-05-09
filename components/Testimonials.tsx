import React from 'react';
import { Star } from 'lucide-react';
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

// Duplicate list for infinite scroll. Row 2 starts halfway through the
// rotation so identical cards never sit adjacent to their twin.
const marqueeRow1 = [...reviews, ...reviews];
const offset = Math.floor(reviews.length / 2);
const reviewsOffset = [...reviews.slice(offset), ...reviews.slice(0, offset)];
const marqueeRow2 = [...reviewsOffset, ...reviewsOffset];

const TestimonialCard: React.FC<{ review: typeof reviews[0] }> = ({ review }) => (
  <div className="w-[85vw] sm:w-[420px] shrink-0 p-7 relative group flex flex-col h-full transition-all duration-200 hover:-translate-y-1" style={{ backgroundColor: 'var(--color-paper)', border: '1px solid rgba(26,26,26,0.1)' }}>

    {/* Project Badge */}
    <div className="mb-5">
      <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.45)' }}>
        {review.project}
      </span>
    </div>

    {/* Content — italic serif pull quote */}
    <div className="relative z-10 mb-6 flex-grow">
      <p style={{ fontFamily: '"Source Serif 4", Georgia, serif', fontStyle: 'italic', fontSize: '17px', lineHeight: 1.5, color: '#1A1A1A' }}>
        "{review.text}"
      </p>
    </div>

    {/* Footer */}
    <div className="border-t border-[color:var(--color-hairline)] pt-5 mt-auto flex justify-between items-center">
      <div className="flex gap-1">
        {[...Array(review.rating)].map((_, i) => (
          <Star key={i} size={14} className="fill-accent text-accent" />
        ))}
      </div>
      <span className="text-xs font-medium uppercase text-ink-mute tracking-widest">
        Verified review
      </span>
    </div>
  </div>
);

const Testimonials: React.FC = () => {
  return (
    <section className="py-20 bg-paper border-t border-zinc-200 overflow-hidden relative z-20 flex flex-col gap-8">
      {/* Section Label */}
      <div className="container mx-auto px-6 relative z-40 flex justify-center mb-4">
        <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.45)' }}>
          Client Reviews
        </span>
      </div>

      {/* Marquee Area */}
      <div className="flex flex-col gap-8 relative">
        {/* Vignettes */}
        <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-paper to-transparent z-30 pointer-events-none"></div>
        <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-paper to-transparent z-30 pointer-events-none"></div>

        {/* Row 1: Left Direction */}
        <div className="relative flex w-full">
          <motion.div
            className="flex gap-4 sm:gap-8 items-stretch w-max px-4"
            animate={{ x: "-50%" }}
            transition={{
              duration: 120,
              repeat: Infinity,
              ease: "linear"
            }}
          >
            {marqueeRow1.map((review, i) => (
              <TestimonialCard key={`row1-${i}`} review={review} />
            ))}
          </motion.div>
        </div>

        {/* Row 2: Right Direction */}
        <div className="relative flex w-full">
          <motion.div
            className="flex gap-4 sm:gap-8 items-stretch w-max px-4"
            initial={{ x: "-50%" }}
            animate={{ x: "0%" }}
            transition={{
              duration: 140,
              repeat: Infinity,
              ease: "linear"
            }}
          >
            {marqueeRow2.map((review, i) => (
              <TestimonialCard key={`row2-${i}`} review={review} />
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
