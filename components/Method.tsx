import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

const preconditions = [
  {
    number: '01',
    title: 'Reliable input pipeline',
    description: 'The agent reads the same data every time. Either the source is structured, or extraction from it is.',
  },
  {
    number: '02',
    title: 'Documentable decision logic',
    description: 'Your best person can write down how they decide. Then we encode it.',
  },
  {
    number: '03',
    title: 'Narrow initial scope',
    description: 'One job, done end-to-end, before widening. Small wins compound.',
  },
  {
    number: '04',
    title: 'Human-in-the-loop by design',
    description: 'Routed review is the design, not the rescue. Failure paths planned upfront.',
  },
];

const Method: React.FC = () => {
  return (
    <section id="method" className="py-32 bg-paper border-t border-zinc-200 relative overflow-hidden">
      <div className="container mx-auto px-6 max-w-6xl">

        {/* Section eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-8"
        >
          <span className="inline-block text-xs uppercase tracking-[0.1em] font-medium text-ink-soft border border-[color:var(--color-hairline-bold)] rounded px-2 py-1">
            The Method
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-4xl md:text-5xl lg:text-6xl font-semibold leading-[1] tracking-tighter mb-6 max-w-4xl"
        >
          Most AI projects fail <br />
          <span className="font-drama italic">at the part that isn't AI.</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="text-xl font-medium text-ink-soft mb-16 max-w-2xl leading-relaxed"
        >
          The problem isn't the tech. It's that the work underneath isn't ready for an agent to touch.
        </motion.p>

        {/* Body */}
        <div className="grid md:grid-cols-2 gap-12 mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="space-y-6 text-lg text-ink-soft leading-relaxed"
          >
            <p>
              After enough builds, a pattern shows up. Every AI project that actually ships has four things in place before a single prompt is written. Every project that stalls is missing at least one of them.
            </p>
            <p>
              I call it Agent-Ready Ops. It's the checklist I run before I agree to build anything.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="space-y-6 text-lg text-ink-soft leading-relaxed"
          >
            <p>
              The four conditions are simple, not easy. If any one is missing, the build breaks within weeks. If all four are present, the system runs without you.
            </p>
            <p>
              Before any engagement, I run a 1-week Agent-Ready Blueprint that evaluates your operation on all four. You leave knowing what to build first and what needs foundation work before it ships.
            </p>
          </motion.div>
        </div>

        {/* 4 Preconditions scorecard */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-150px 0px' }}
          transition={{ duration: 0.5 }}
          className="bg-paper border border-[color:var(--color-hairline)] rounded-xl p-8 md:p-12 mb-12 shadow-card-subtle"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8 border-b border-[color:var(--color-hairline)] pb-4">
            <span className="font-drama italic text-2xl md:text-3xl text-black leading-none">
              Agent-Ready Ops™
            </span>
            <span className="font-mono text-xs uppercase tracking-[0.1em] text-ink-mute flex items-center gap-2 whitespace-nowrap">
              <span className="w-1.5 h-1.5 bg-accent rounded-full" />
              The 4 Preconditions
            </span>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {preconditions.map((item) => (
              <div
                key={item.number}
                className="flex gap-4 border-l border-[color:var(--color-hairline-bold)] pl-5 py-2"
              >
                <span className="font-mono text-xs text-ink-mute mt-1">{item.number}</span>
                <div className="flex-1">
                  <h4 className="font-mono text-sm uppercase tracking-widest font-bold mb-2">
                    {item.title}
                  </h4>
                  <p className="text-sm text-ink-soft leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 1.0 }}
          className="flex flex-col sm:flex-row items-center gap-6"
        >
          <a
            href="/assessment"
            className="btn-magnetic px-8 py-4 bg-accent border-subtle-thick shadow-card-subtle flex items-center gap-3 font-semibold text-base tracking-wide text-white"
          >
            Book an Agent-Ready Blueprint
            <ArrowRight aria-hidden="true" size={18} />
          </a>
          <span className="text-sm text-ink-mute">
            One week. You leave with your 90-Day AI Rollout Plan.
          </span>
        </motion.div>
      </div>
    </section>
  );
};

export default Method;
