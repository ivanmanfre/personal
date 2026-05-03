import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import { useMetadata } from '../hooks/useMetadata';
import { preconditions } from '../lib/preconditions';
import { buildStripeCheckoutUrl } from '../lib/utmCapture';

// Stripe Payment Link (live): prod_UNL0AY5g21pMLX / price_1TOaK906n8CBtSkjxVlpZcWa
// Post-checkout redirect: /start?intent=assessment-paid&session_id={CHECKOUT_SESSION_ID}
// Webhook: we_1TOaKL06n8CBtSkjlBuYIYkk -> stripe-webhook edge function -> paid_assessments table
//
// Wave 0 / P30-1: client_reference_id carries first-touch UTM fingerprint
// (utm_source__utm_medium__utm_campaign__utm_content__ref) so the webhook
// can write attribution to paid_assessments.utm_*. See lib/utmCapture.ts.
const ASSESSMENT_PAYMENT_LINK_BASE = 'https://buy.stripe.com/dRm28jfCXbrP9p40v1fEk0G';
const DISCOVERY_CALL_LINK = '/start';

const useAssessmentCheckoutUrl = () => {
  const [url, setUrl] = React.useState(ASSESSMENT_PAYMENT_LINK_BASE);
  React.useEffect(() => {
    setUrl(buildStripeCheckoutUrl(ASSESSMENT_PAYMENT_LINK_BASE));
  }, []);
  return url;
};

const deliverables = [
  'Your 90-Day AI Rollout Plan: sequenced builds for the next 90 and 180 days',
  'Workflow scorecard against the 4 Agent-Ready preconditions',
  'Costed gap analysis with a dollar number on every gap',
  'Decision logic for the first project, ready to hand to any builder',
  '60-minute live walkthrough of the findings',
];

const AssessmentPage: React.FC = () => {
  useMetadata({
    title: 'The Agent-Ready Blueprint | Manfredi',
    description: 'A 1-week diagnostic. You leave with your 90-Day AI Rollout Plan: sequenced builds, costed gaps, and decision logic for the first project. $2,500, 100% credited toward any follow-on engagement.',
    canonical: 'https://ivanmanfredi.com/assessment',
  });
  const ASSESSMENT_PAYMENT_LINK = useAssessmentCheckoutUrl();
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
            <span className="inline-block text-xs uppercase tracking-[0.1em] font-medium text-ink-soft border border-[color:var(--color-hairline-bold)] rounded px-2 py-1">
              Agent-Ready Blueprint
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
            A 1-week diagnostic. I evaluate your operation against the four conditions every AI build needs before it ships. You leave with your 90-Day AI Rollout Plan: sequenced builds, costed gaps, and decision logic for the first project. If you move forward, the full $2,500 is credited back.
          </motion.p>

          {/* Who this is for - self-select gate */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-paper-sunk border border-[color:var(--color-hairline)] p-6 md:p-8 mb-12 max-w-3xl"
          >
            <p className="font-mono text-xs uppercase tracking-[0.1em] text-ink-mute mb-3">
              Who this is for
            </p>
            <p className="text-ink-soft leading-relaxed mb-4">
              The Blueprint is for founders who want AI to handle a specific piece of judgment work, like lead qualification, document classification, tier-1 support, or call scoring. You don't need a fully formed use case, but you need to know the work exists.
            </p>
            <p className="text-ink-soft leading-relaxed">
              Not sure where AI fits in your operation yet? <a href="/start" className="underline underline-offset-2 text-black hover:text-accent-ink transition-colors">Book a free discovery call</a> first. We'll figure out the right path before any money moves.
            </p>
          </motion.div>

          {/* Price box */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-paper border border-zinc-300 shadow-card p-8 md:p-12 mb-16"
          >
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-6">
              <div>
                <p className="font-mono text-xs uppercase tracking-widest text-ink-mute mb-2">
                  Blueprint
                </p>
                <p className="text-5xl md:text-6xl font-bold tracking-tighter">$2,500</p>
                <p className="text-sm text-ink-mute mt-2">One-week engagement · 100% credited toward any follow-on engagement</p>
              </div>
              <div className="flex flex-col gap-2 md:items-end">
                <a
                  href={ASSESSMENT_PAYMENT_LINK}
                  target={ASSESSMENT_PAYMENT_LINK.startsWith('http') ? '_blank' : undefined}
                  rel={ASSESSMENT_PAYMENT_LINK.startsWith('http') ? 'noopener noreferrer' : undefined}
                  className="btn-magnetic w-full md:w-auto px-8 py-4 bg-accent rounded-lg border-subtle-thick shadow-card-subtle flex items-center justify-center gap-3 font-semibold text-base tracking-wide text-white"
                >
                  Build your Blueprint
                  <ArrowRight aria-hidden="true" size={18} />
                </a>
                <p className="text-xs text-ink-soft md:text-right max-w-[260px]">
                  Credited 100% if you book any follow-on within 60 days.
                </p>
              </div>
            </div>
            <div className="border-t border-zinc-200 pt-6 space-y-4">
              <p className="text-sm text-ink-soft">
                The $2,500 is credited 100% toward any follow-on engagement (Lead Magnet System, Fractional AI Partner, or custom build) within 60 days. If I recommend you wait and fix the foundation first, that recommendation is the deliverable.
              </p>
              <p className="text-sm text-ink-mute">
                Already know what you want built? <a href={DISCOVERY_CALL_LINK} className="underline hover:text-black">Skip ahead — book a 30-min scope call</a>.
              </p>
            </div>
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
                  key={item.key}
                  className="rounded-2xl border border-[color:var(--color-hairline)] bg-paper p-6"
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
                <span className="font-mono text-sm text-ink-mute mt-1 shrink-0 w-12">Day 0</span>
                <p className="text-lg text-ink-soft leading-relaxed">
                  Conversational intake (20 questions across the 4 Agent-Ready preconditions). About 25 minutes, saves as you type. Book your Day 2 session in the same flow.
                </p>
              </div>
              <div className="flex gap-6 items-start">
                <span className="font-mono text-sm text-ink-mute mt-1 shrink-0 w-12">Day 2</span>
                <p className="text-lg text-ink-soft leading-relaxed">
                  60-minute working session. We walk your intake together, you push back where it does not match reality, and the diagnostic gets sharper because of the conversation.
                </p>
              </div>
              <div className="flex gap-6 items-start">
                <span className="font-mono text-sm text-ink-mute mt-1 shrink-0 w-12">Day 3–5</span>
                <p className="text-lg text-ink-soft leading-relaxed">
                  You receive the Blueprint: the 60/25/15 work split, a 90-day roadmap, quick wins, costed gaps, and a recommended next step (Fractional, project, or wait-and-build).
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
              Build your Blueprint
            </h2>
            <p className="text-zinc-400 mb-8 max-w-xl mx-auto leading-relaxed">
              If your operation clears the 4 conditions, AI becomes a force multiplier. If it doesn't, you're funding demos that never ship. Let's find out which one you are.
            </p>
            <a
              href={ASSESSMENT_PAYMENT_LINK}
              target={ASSESSMENT_PAYMENT_LINK.startsWith('http') ? '_blank' : undefined}
              rel={ASSESSMENT_PAYMENT_LINK.startsWith('http') ? 'noopener noreferrer' : undefined}
              className="btn-magnetic inline-flex items-center gap-3 px-10 py-5 bg-accent rounded-lg text-white font-semibold text-lg tracking-wide border-subtle-thick shadow-card-subtle"
            >
              Build your Blueprint
              <ArrowRight aria-hidden="true" size={20} />
            </a>
            <p className="mt-4 text-sm text-zinc-300">
              Credited 100% if you book any follow-on within 60 days.
            </p>
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
