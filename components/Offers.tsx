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
    price: '$8–12k',
    cadence: '3-week project',
    description: 'Productized lead-gen infrastructure. Interactive landing page, CMS-driven magnet, CRM integration, and email automation. Built once, runs forever.',
    href: '/lead-magnet-system',
  },
  {
    id: '03',
    name: 'Care Plan',
    price: '$1,000/mo',
    cadence: '8-hr soft cap · $150/hr overage',
    description: 'Post-project maintenance. Bug fixes, small tweaks, monitoring, auth refreshes. 48-hour async response. For clients with an existing system to maintain.',
    href: '/start',
  },
  {
    id: '04',
    name: 'Fractional AI Partner — Essential',
    price: 'From $3,500/mo',
    cadence: 'Light strategic partnership',
    description: '1 strategy call and 1 implementation project per month. Async support. System health monitoring. For firms at $1–2M ARR who want ongoing AI direction.',
    href: '/fractional',
  },
  {
    id: '05',
    name: 'Fractional AI Partner — Standard',
    price: 'From $6,500/mo',
    cadence: 'Core strategic partnership',
    description: '2 strategy calls and 2 implementation projects per month. Dedicated comms channel. Tool and vendor management. Monthly AI roadmap.',
    href: '/fractional',
  },
  {
    id: '06',
    name: 'Fractional AI Partner — Partner',
    price: 'From $10,000/mo',
    cadence: 'Full strategic ownership',
    description: 'Weekly calls. 3–4 projects per month. Full AI and ops strategy ownership. Quarterly business review. Priority response. For $5M+ firms.',
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
          <span className="font-mono text-xs uppercase tracking-widest bg-black text-accent px-3 py-1.5 mb-6 inline-block">
            Work with me
          </span>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-semibold leading-[1] tracking-tighter">
            Pick the engagement <br />
            <span className="font-drama italic">that fits where you are.</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {offers.map((offer, i) => (
            <motion.a
              key={offer.id}
              href={offer.href}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className={`group flex flex-col p-8 border shadow-card hover-lift transition-all ${
                offer.highlighted
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-black border-zinc-300 hover:border-black'
              }`}
            >
              <div className="flex items-start justify-between mb-6">
                <span className={`font-mono text-xs uppercase tracking-widest ${offer.highlighted ? 'text-accent' : 'text-zinc-500'}`}>
                  {offer.id}
                </span>
                {offer.highlighted && (
                  <span className="font-mono text-xs uppercase tracking-widest text-accent">
                    Start here
                  </span>
                )}
              </div>

              <h3 className={`text-xl font-semibold tracking-tight mb-3 ${offer.highlighted ? 'text-white' : ''}`}>
                {offer.name}
              </h3>

              <div className="mb-4">
                <div className={`text-3xl font-bold tracking-tighter font-mono ${offer.highlighted ? 'text-accent' : 'text-black'}`}>
                  {offer.price}
                </div>
                <div className={`text-xs font-mono uppercase tracking-widest mt-1 ${offer.highlighted ? 'text-zinc-400' : 'text-zinc-500'}`}>
                  {offer.cadence}
                </div>
              </div>

              <p className={`text-sm leading-relaxed mb-6 flex-1 ${offer.highlighted ? 'text-zinc-300' : 'text-zinc-600'}`}>
                {offer.description}
              </p>

              <div className={`flex items-center gap-2 font-bold text-sm tracking-wide ${offer.highlighted ? 'text-accent' : 'text-black'} group-hover:gap-3 transition-all`}>
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
