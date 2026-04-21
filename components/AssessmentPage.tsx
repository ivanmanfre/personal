import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import { useMetadata } from '../hooks/useMetadata';

// Stripe Payment Link (live): prod_UNL0AY5g21pMLX / price_1TOaK906n8CBtSkjxVlpZcWa
// Post-checkout redirect: /start?intent=assessment-paid&session_id={CHECKOUT_SESSION_ID}
// Webhook: we_1TOaKL06n8CBtSkjlBuYIYkk -> stripe-webhook edge function -> paid_assessments table
const ASSESSMENT_PAYMENT_LINK = 'https://buy.stripe.com/dRm28jfCXbrP9p40v1fEk0G';
const DISCOVERY_CALL_LINK = '/start';

const preconditions = [
  {
    number: '01',
    title: 'Structured input data',
    question: 'Is your intake capturing what an agent would need, every time?',
  },
  {
    number: '02',
    title: 'Documentable decision logic',
    question: 'Can your best person actually write down how they decide?',
  },
  {
    number: '03',
    title: 'Narrow initial scope',
    question: 'Is the first use case tightly bounded, or is it trying to handle everything?',
  },
  {
    number: '04',
    title: 'Human-in-the-loop by design',
    question: 'Is routed review built into the design, or bolted on after things break?',
  },
];

const deliverables = [
  'Scored readiness across the 4 Agent-Ready conditions',
  '30-day prioritized roadmap with specific next moves',
  'A clear yes or no on whether to build now or fix the foundation first',
  '60-minute live presentation call walking through the findings',
];

const AssessmentPage: React.FC = () => {
  useMetadata({
    title: 'Agent-Ready Assessment | Manfredi',
    description: 'A paid 1-week diagnostic that scores your operation on the 4 Agent-Ready preconditions. Scorecard + 30-day roadmap. $2,500, 100% credited toward any follow-on engagement.',
    canonical: 'https://ivanmanfredi.com/assessment',
  });
  return (
    <div className="min-h-screen bg-paper">
      <section className="pt-32 pb-24 px-6">
        <div className="container mx-auto max-w-5xl">

          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <span className="inline-block text-[11px] uppercase tracking-[0.14em] font-medium text-ink-soft border border-[color:var(--color-hairline-bold)] rounded px-2 py-1">
              Agent-Ready Assessment
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl font-semibold leading-[1.05] tracking-tighter mb-6 max-w-4xl"
          >
            Find out if your business <br />
            <span className="font-drama italic">is Agent-Ready.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-ink-soft max-w-2xl leading-relaxed mb-12"
          >
            A paid 1-week diagnostic. I score your operation on the four conditions every AI build needs before it ships. You get a scorecard and a 30-day roadmap. If you move forward, the full $2,500 is credited back.
          </motion.p>

          {/* Who this is for — self-select gate */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-paper-sunk border border-[color:var(--color-hairline)] p-6 md:p-8 mb-12 max-w-3xl"
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-mute mb-3">
              Who this is for
            </p>
            <p className="text-ink-soft leading-relaxed mb-4">
              The Assessment is for founders who want AI to handle a specific piece of judgment work — lead qualification, document classification, tier-1 support, call scoring, or similar. You don't need a fully formed use case, but you need to know the work exists.
            </p>
            <p className="text-ink-soft leading-relaxed">
              Not sure where AI fits in your operation yet? <a href="/start" className="underline underline-offset-2 text-black hover:text-accent-ink transition-colors">Book a free discovery call</a> first — we'll figure out the right path before any money moves.
            </p>
          </motion.div>

          {/* Price box */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white border border-zinc-300 shadow-card p-8 md:p-12 mb-16"
          >
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8">
              <div>
                <p className="font-mono text-xs uppercase tracking-widest text-ink-mute mb-2">
                  Assessment
                </p>
                <p className="text-5xl md:text-6xl font-bold tracking-tighter">$2,500</p>
                <p className="text-sm text-ink-mute mt-2">One-week engagement · 100% credit clause</p>
              </div>
              <a
                href={ASSESSMENT_PAYMENT_LINK}
                target={ASSESSMENT_PAYMENT_LINK.startsWith('http') ? '_blank' : undefined}
                rel={ASSESSMENT_PAYMENT_LINK.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="btn-magnetic w-full md:w-auto px-8 py-4 bg-accent rounded-lg border-subtle-thick shadow-card-subtle flex items-center justify-center gap-3 font-semibold text-base tracking-wide text-black"
              >
                Book the Assessment
                <ArrowRight size={18} />
              </a>
            </div>
            <p className="text-sm text-ink-soft border-t border-zinc-200 pt-6">
              The $2,500 is credited 100% toward any follow-on engagement (Lead Magnet System, Fractional AI Partner, or custom build) within 60 days. If I recommend you wait and fix the foundation first, that recommendation is the deliverable.
            </p>
          </motion.div>

          {/* What you get */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-8">
              What you get
            </h2>
            <ul className="space-y-4">
              {deliverables.map((item, i) => (
                <li key={i} className="flex items-start gap-4 text-lg text-ink-soft">
                  <Check size={22} className="text-accent shrink-0 mt-1" strokeWidth={3} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* The 4 preconditions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-8">
              What I'll score you on
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {preconditions.map((item) => (
                <div
                  key={item.number}
                  className="rounded-2xl border border-[color:var(--color-hairline)] bg-white p-6"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="font-mono text-xs text-ink-mute">{item.number}</span>
                    <h3 className="font-mono text-sm uppercase tracking-widest font-bold">
                      {item.title}
                    </h3>
                  </div>
                  <p className="text-ink-soft leading-relaxed">
                    {item.question}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* How it works */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-8">
              How it works
            </h2>
            <div className="space-y-6">
              <div className="flex gap-6 items-start">
                <span className="font-mono text-sm text-ink-mute mt-1 shrink-0 w-12">Day 1</span>
                <p className="text-lg text-ink-soft leading-relaxed">
                  You complete a structured intake questionnaire (30 minutes of your time). 20–30 questions across the 4 preconditions.
                </p>
              </div>
              <div className="flex gap-6 items-start">
                <span className="font-mono text-sm text-ink-mute mt-1 shrink-0 w-12">Day 2</span>
                <p className="text-lg text-ink-soft leading-relaxed">
                  We run a 60-minute working session. I walk through your answers, ask follow-ups, observe your current systems.
                </p>
              </div>
              <div className="flex gap-6 items-start">
                <span className="font-mono text-sm text-ink-mute mt-1 shrink-0 w-12">Day 3–6</span>
                <p className="text-lg text-ink-soft leading-relaxed">
                  I produce your scorecard, 30-day prioritized roadmap, and specific recommendations.
                </p>
              </div>
              <div className="flex gap-6 items-start">
                <span className="font-mono text-sm text-ink-mute mt-1 shrink-0 w-12">Day 7</span>
                <p className="text-lg text-ink-soft leading-relaxed">
                  60-minute presentation call. I deliver the findings and recommend the path forward - Fractional, project, or wait-and-build.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Final CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-black text-white p-10 md:p-16 text-center border border-[color:var(--color-hairline-bold)]"
          >
            <h2 className="text-3xl md:text-4xl font-semibold mb-4 tracking-tight">
              Start the Assessment
            </h2>
            <p className="text-zinc-400 mb-8 max-w-xl mx-auto leading-relaxed">
              If your operation clears the 4 conditions, AI becomes a force multiplier. If it doesn't, you're funding demos that never ship. Let's find out which one you are.
            </p>
            <a
              href={ASSESSMENT_PAYMENT_LINK}
              target={ASSESSMENT_PAYMENT_LINK.startsWith('http') ? '_blank' : undefined}
              rel={ASSESSMENT_PAYMENT_LINK.startsWith('http') ? 'noopener noreferrer' : undefined}
              className="btn-magnetic inline-flex items-center gap-3 px-10 py-5 bg-accent rounded-lg text-black font-semibold text-lg tracking-wide border-subtle-thick shadow-card-subtle"
            >
              Book the Assessment
              <ArrowRight size={20} />
            </a>
            <p className="mt-6 text-sm text-ink-mute">
              Not sure yet? <a href={DISCOVERY_CALL_LINK} className="underline text-zinc-300 hover:text-white">Book a call first</a>.
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default AssessmentPage;
