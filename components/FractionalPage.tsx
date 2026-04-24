import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import { useMetadata } from '../hooks/useMetadata';

const tiers = [
  {
    name: 'Essential',
    price: 'From $3,500/mo',
    fit: 'Firms at $1–2M ARR',
    features: [
      '1 strategy call per month',
      'Ongoing improvements + 1 new build per month',
      'Async support (Slack or email)',
      'System health monitoring',
    ],
  },
  {
    name: 'Standard',
    price: 'From $6,500/mo',
    fit: 'Firms at $2–5M ARR',
    features: [
      '2 strategy calls per month',
      'Running backlog — 2-3 builds or improvements per month, prioritized together',
      'Dedicated Slack channel',
      'Monthly AI roadmap doc',
    ],
    highlighted: true,
  },
  {
    name: 'Partner',
    price: 'From $10,000/mo',
    fit: 'Firms at $5M+ ARR',
    features: [
      'Weekly strategy calls',
      'Full implementation bandwidth — whatever moves the needle that month',
      'Priority response (24-hr SLA)',
      'Full AI and ops strategy ownership',
      'Quarterly business review',
    ],
  },
];

const howItWorks = [
  { title: 'Month 1: Agent-Ready Assessment', description: 'Every Fractional engagement starts with the $2,500 diagnostic (credited to month 1). I score your ops, we agree on scope, you approve the 30-day roadmap.' },
  { title: 'Monthly cadence', description: 'Strategy calls happen on a fixed day. Implementation projects get delivered within the month. I track scope in a shared doc so you know where every hour went.' },
  { title: 'Quarterly review', description: 'Every 90 days we pull up the roadmap, measure what shipped, decide what stays, what\'s dropped, and what\'s added for the next quarter.' },
  { title: 'No lock-in', description: 'Month-to-month. If the partnership isn\'t working, we end it cleanly.' },
];

const notIncluded = [
  'Bespoke products outside the AI-systems scope (brand design, paid ads management, hiring)',
  'On-site presence - this is remote-first, async-first',
  '24/7 on-call response - real emergencies handled same-day, but I sleep',
  'Unlimited implementation volume — scope is agreed at the start of each month',
];

const FractionalPage: React.FC = () => {
  useMetadata({
    title: 'Fractional AI Partner | Manfredi',
    description: 'Monthly retainer. A senior AI and ops partner embedded in your business, shipping systems every month. Three tiers for growing service firms at $1-5M+ ARR.',
    canonical: 'https://ivanmanfredi.com/fractional',
  });
  return (
    <div className="min-h-screen bg-paper">
      <section className="pt-32 pb-24 px-6">
        <div className="container mx-auto max-w-5xl">

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <span className="inline-block text-xs uppercase tracking-[0.1em] font-medium text-ink-soft border border-[color:var(--color-hairline-bold)] rounded px-2 py-1">
              Fractional AI Partner
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl font-semibold leading-[1.05] tracking-tighter mb-6 max-w-4xl"
          >
            A senior AI partner, <br />
            <span className="font-drama italic">embedded in your business.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-ink-soft max-w-2xl leading-relaxed mb-16"
          >
            Monthly retainer. Three tiers based on the volume and depth of work your team needs. Systems ship every month.
          </motion.p>

          {/* Tiers */}
          <div className="grid md:grid-cols-3 gap-6 mb-20">
            {tiers.map((tier) => (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className={`flex flex-col p-8 border shadow-card ${
                  tier.highlighted
                    ? 'bg-black text-white border-black'
                    : 'bg-paper text-black border-zinc-300'
                }`}
              >
                <div className="mb-6">
                  {tier.highlighted && (
                    <span className="font-mono text-xs uppercase tracking-widest text-accent mb-3 block">
                      Most common
                    </span>
                  )}
                  <h3 className={`text-2xl font-semibold tracking-tight mb-2 ${tier.highlighted ? 'text-white' : ''}`}>
                    {tier.name}
                  </h3>
                  <p className={`text-3xl font-bold tracking-tighter font-mono mb-2 ${tier.highlighted ? 'text-accent' : 'text-black'}`}>
                    {tier.price}
                  </p>
                  <p className={`text-xs font-mono uppercase tracking-widest ${tier.highlighted ? 'text-zinc-400' : 'text-ink-mute'}`}>
                    {tier.fit}
                  </p>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {tier.features.map((f) => (
                    <li key={f} className={`flex items-start gap-3 text-sm leading-relaxed ${tier.highlighted ? 'text-zinc-300' : 'text-ink-soft'}`}>
                      <Check size={16} className={`shrink-0 mt-1 ${tier.highlighted ? 'text-accent' : 'text-black'}`} strokeWidth={3} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href="/start"
                  className={`w-full text-center px-6 py-3 border font-bold tracking-wide text-sm transition-colors ${
                    tier.highlighted
                      ? 'bg-accent text-black border-accent hover:bg-paper'
                      : 'bg-paper text-black border-black hover:bg-black hover:text-white'
                  }`}
                >
                  Discuss this tier
                </a>
              </motion.div>
            ))}
          </div>

          {/* How it works */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-8">
              How the partnership works
            </h2>
            <div className="space-y-6">
              {howItWorks.map((step) => (
                <div key={step.title} className="border-l border-accent pl-6">
                  <h3 className="font-mono text-sm uppercase tracking-widest font-bold mb-2">
                    {step.title}
                  </h3>
                  <p className="text-lg text-ink-soft leading-relaxed">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Not included */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-4">
              What's not in scope
            </h2>
            <p className="text-ink-soft mb-6">Clear boundaries protect both of us.</p>
            <ul className="space-y-3">
              {notIncluded.map((item, i) => (
                <li key={i} className="flex items-start gap-4 text-ink-soft">
                  <span className="font-mono text-zinc-400 mt-1">-</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Final CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-black text-white p-10 md:p-16 text-center border border-[color:var(--color-hairline-bold)]"
          >
            <h2 className="text-3xl md:text-4xl font-semibold mb-4 tracking-tight">
              Talk through the fit
            </h2>
            <p className="text-zinc-400 mb-8 max-w-xl mx-auto leading-relaxed">
              Fractional is a relationship sale. Fill out the 5-minute intake, then we jump on a call and figure out which tier actually matches your situation. No pressure to commit.
            </p>
            <a
              href="/start"
              className="btn-magnetic inline-flex items-center gap-3 px-10 py-5 bg-accent text-white font-bold text-lg tracking-wide border-subtle-thick shadow-card"
            >
              Start the conversation
              <ArrowRight aria-hidden="true" size={20} />
            </a>
            <p className="mt-6 text-sm text-ink-mute">
              Not ready for retainer? <a href="/assessment" className="underline text-zinc-300 hover:text-white">Start with the Agent-Ready Assessment</a>.
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default FractionalPage;
