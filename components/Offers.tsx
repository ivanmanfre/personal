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
  cta: string;
  highlighted?: boolean;
  creditNote?: string;
}

const offers: Offer[] = [
  {
    id: '01',
    name: 'Agent-Ready Blueprint',
    price: '$2,500',
    cadence: 'One-week engagement',
    description: 'A 1-week diagnostic. You leave with your 90-Day AI Rollout Plan — sequenced builds, costed gaps, and decision logic for the first project.',
    creditNote: '100% credited toward any follow-on engagement within 60 days.',
    href: '/assessment',
    cta: 'Build your Blueprint',
    highlighted: true,
  },
  {
    id: '02',
    name: 'Fractional AI Partner',
    price: 'From $3,500/mo',
    cadence: 'Monthly retainer · 3 tiers',
    description: 'Your AI strategy, owned by someone who ships. Senior partner embedded monthly - not another consultant selling slide decks.',
    href: '/fractional',
    cta: 'Apply for fit',
  },
  {
    id: '03',
    name: 'Lead Magnet System',
    price: 'From $7k',
    cadence: '3-week project',
    description: 'Your best salesperson stops doing triage. Launch new magnets in an afternoon. Every lead gets followed up, every time.',
    href: '/lead-magnet-system',
    cta: 'Scope your build',
  },
  {
    id: '04',
    name: 'Content Engine',
    price: 'From $6k',
    cadence: '3-week project',
    description: 'Ship 5 posts a week without writing them. Weekly planning agent trained on your voice. You approve; the system ships.',
    href: '/content-system',
    cta: 'Plan your engine',
  },
];

const Offers: React.FC = () => {
  return (
    <section id="offers" className="py-20 bg-paper border-t relative" style={{ borderColor: 'rgba(26,26,26,0.1)' }}>
      <div className="container mx-auto px-6 max-w-6xl">

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.85 }}
          className="mb-14"
        >
          <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.45)', marginBottom: '1.5rem', display: 'inline-block' }}>
            Work with me
          </span>
          <h2 style={{ fontFamily: '"DM Serif Display", "Bodoni Moda", Georgia, serif', fontWeight: 400, fontSize: 'clamp(2.4rem, 5vw, 4.5rem)', lineHeight: 1.04, letterSpacing: '-0.02em', color: '#1A1A1A' }}>
            Pick the engagement<br />
            <span style={{ fontStyle: 'italic' }}>that fits where you are.</span>
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
              className={`group flex flex-col p-8 border transition-all ${
                offer.highlighted
                  ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                  : 'bg-paper text-black border-[rgba(26,26,26,0.12)] hover:border-[rgba(26,26,26,0.4)]'
              }`}
              whileHover={{ y: -4 }}
            >
              <div className="flex items-start justify-between mb-6">
                <span className={`font-mono text-xs uppercase tracking-widest font-medium ${offer.highlighted ? 'text-[var(--color-accent-light)]' : 'text-ink-mute'}`}>
                  {offer.id}
                </span>
                {offer.highlighted && (
                  <span className="font-mono text-xs uppercase tracking-widest text-[var(--color-accent-light)] font-medium">
                    Start here
                  </span>
                )}
              </div>

              <h3 style={{ fontFamily: '"DM Serif Display", "Bodoni Moda", Georgia, serif', fontStyle: 'italic', fontWeight: 400, fontSize: '1.6rem', lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: '0.75rem', color: offer.highlighted ? '#F7F4EF' : '#1A1A1A' }}>
                {offer.name}
              </h3>

              <div className="mb-4">
                <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: '24px', fontWeight: 500, color: offer.highlighted ? 'var(--color-accent-light)' : '#1A1A1A', letterSpacing: '-0.01em' }}>
                  {offer.price}
                </div>
                <div className={`text-xs font-mono uppercase tracking-widest font-medium mt-2 ${offer.highlighted ? 'text-zinc-400' : 'text-ink-mute'}`}>
                  {offer.cadence}
                </div>
              </div>

              <p className={`text-[15px] leading-relaxed mb-4 ${offer.highlighted ? 'text-zinc-300' : 'text-ink-soft'}`}>
                {offer.description}
              </p>

              {offer.creditNote && (
                <p className={`text-xs leading-relaxed mb-6 flex-1 italic ${offer.highlighted ? 'text-[var(--color-accent-light)]' : 'text-ink-mute'}`}>
                  {offer.creditNote}
                </p>
              )}
              {!offer.creditNote && <div className="flex-1 mb-6" />}

              <div className={`flex items-center gap-2 font-semibold text-sm tracking-wide ${offer.highlighted ? 'text-[var(--color-accent-light)]' : 'text-black'} group-hover:gap-3 transition-all`}>
                {offer.cta}
                <ArrowRight aria-hidden="true" size={16} />
              </div>
            </motion.a>
          ))}
        </div>

      </div>
    </section>
  );
};

export default Offers;
