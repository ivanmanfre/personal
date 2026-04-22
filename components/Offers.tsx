import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

interface Offer {
  id: string;
  name: string;
  price: string;
  cadence: string;
  description: string;
  href: string;
  highlighted?: boolean;
}

const offers: Offer[] = [
  {
    id: '01',
    name: 'Agent-Ready Assessment',
    price: '$2,500',
    cadence: 'One-week engagement · 100% credit',
    description: 'Paid diagnostic that scores your ops on the 4 preconditions. Scorecard plus a 30-day roadmap. Credited toward any follow-on engagement.',
    href: '/assessment',
    highlighted: true,
  },
  {
    id: '02',
    name: 'Lead Magnet System',
    price: '$6–10k',
    cadence: '3-week project',
    description: 'Your best salesperson stops doing triage. Launch new magnets in an afternoon. Every lead gets followed up, every time.',
    href: '/lead-magnet-system',
  },
  {
    id: '03',
    name: 'Content Engine',
    price: '$5–9k',
    cadence: '3-week project',
    description: 'Ship 5 posts a week without writing them. Weekly planning agent trained on your voice. You approve; the system ships.',
    href: '/content-system',
  },
  {
    id: '04',
    name: 'Fractional AI Partner',
    price: 'From $3,500/mo',
    cadence: 'Monthly retainer · 3 tiers',
    description: 'Your AI strategy, owned by someone who ships. Senior partner embedded monthly - not another consultant selling slide decks.',
    href: '/fractional',
  },
];

const Offers: React.FC = () => {
  return (
    <section id="offers" className="py-32 bg-paper border-t border-zinc-200 relative">
      <div className="container mx-auto px-6 max-w-6xl">

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <span className="inline-block text-xs uppercase tracking-[0.1em] font-medium text-ink-soft border border-[color:var(--color-hairline-bold)] rounded px-2 py-1 mb-6">
            Work with me
          </span>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-semibold leading-[1] tracking-tighter">
            Pick the engagement <br />
            <span className="font-drama italic">that fits where you are.</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {offers.map((offer, i) => (
            <motion.a
              key={offer.id}
              href={offer.href}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className={`group flex flex-col rounded-xl p-8 border shadow-card-subtle hover:shadow-card-lift transition-all ${
                offer.highlighted
                  ? 'bg-black text-white border-black'
                  : 'bg-paper text-black border-[color:var(--color-hairline)] hover:border-black'
              }`}
            >
              <div className="flex items-start justify-between mb-6">
                <span className={`font-mono text-xs uppercase tracking-widest font-medium ${offer.highlighted ? 'text-accent' : 'text-ink-mute'}`}>
                  {offer.id}
                </span>
                {offer.highlighted && (
                  <span className="font-mono text-xs uppercase tracking-widest text-accent font-medium">
                    Start here
                  </span>
                )}
              </div>

              <h3 className={`text-xl font-semibold tracking-tight mb-3 ${offer.highlighted ? 'text-white' : ''}`}>
                {offer.name}
              </h3>

              <div className="mb-4">
                <div className={`text-3xl font-bold tracking-tight font-mono ${offer.highlighted ? 'text-accent' : 'text-black'}`}>
                  {offer.price}
                </div>
                <div className={`text-xs font-mono uppercase tracking-widest font-medium mt-2 ${offer.highlighted ? 'text-zinc-400' : 'text-ink-mute'}`}>
                  {offer.cadence}
                </div>
              </div>

              <p className={`text-[15px] leading-relaxed mb-6 flex-1 ${offer.highlighted ? 'text-zinc-300' : 'text-ink-soft'}`}>
                {offer.description}
              </p>

              <div className={`flex items-center gap-2 font-semibold text-sm tracking-wide ${offer.highlighted ? 'text-accent' : 'text-black'} group-hover:gap-3 transition-all`}>
                {offer.highlighted ? 'Book the Assessment' : 'Start the conversation'}
                <ArrowRight size={16} />
              </div>
            </motion.a>
          ))}
        </div>

      </div>
    </section>
  );
};

export default Offers;
