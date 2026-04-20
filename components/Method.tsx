import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

const preconditions = [
  {
    number: '01',
    title: 'Structured input data',
    description: 'Intake captures what the agent needs, every time. No free-text chaos.',
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
    <section id="method" className="py-32 bg-white border-t border-zinc-200 relative overflow-hidden">
      <div className="container mx-auto px-6 max-w-6xl">

        {/* Section eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-8"
        >
          <span className="inline-block text-[11px] uppercase tracking-[0.14em] font-medium text-ink-soft border border-[color:var(--color-hairline-bold)] rounded px-2 py-1">
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
          <span className="font-drama italic">before the model gets involved.</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="text-xl font-medium text-zinc-600 mb-16 max-w-2xl leading-relaxed"
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
            className="space-y-6 text-lg text-zinc-700 leading-relaxed"
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
            className="space-y-6 text-lg text-zinc-700 leading-relaxed"
          >
            <p>
              The four conditions are simple, not easy. If any one is missing, the build breaks within weeks. If all four are present, the system runs without you.
            </p>
            <p>
              Before any engagement, I run a paid 1-week Agent-Ready Assessment that scores your operation on all four. You get a scorecard and a 30-day roadmap.
            </p>
          </motion.div>
        </div>

        {/* 4 Preconditions scorecard */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="bg-paper border border-[color:var(--color-hairline)] rounded-2xl p-8 md:p-12 mb-12 shadow-card-subtle"
        >
          <div className="flex items-center justify-between mb-8 border-b border-zinc-300 pb-4">
            <span className="font-mono text-xs uppercase tracking-widest text-zinc-500">
              Agent-Ready Scorecard
            </span>
            <span className="font-mono text-xs uppercase tracking-widest text-accent flex items-center gap-2">
              <span className="w-2 h-2 bg-accent rounded-full" />
              4 Preconditions
            </span>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {preconditions.map((item, i) => (
              <motion.div
                key={item.number}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.6 + i * 0.1 }}
                className="flex gap-4 border-l-2 border-accent/50 pl-5 py-2"
              >
                <span className="font-mono text-xs text-zinc-500 mt-1">{item.number}</span>
                <div>
                  <h4 className="font-mono text-sm uppercase tracking-widest font-bold mb-1">
                    {item.title}
                  </h4>
                  <p className="text-sm text-zinc-600 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </motion.div>
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
            className="btn-magnetic px-8 py-4 bg-accent border-subtle-thick shadow-card flex items-center gap-3 font-bold text-base tracking-wide text-black"
          >
            Book an Agent-Ready Assessment — $2,500
            <ArrowRight size={18} />
          </a>
          <span className="text-sm text-zinc-500">
            100% credited toward any follow-on engagement.
          </span>
        </motion.div>
      </div>
    </section>
  );
};

export default Method;
