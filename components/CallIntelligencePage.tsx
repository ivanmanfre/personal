import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import { useMetadata } from '../hooks/useMetadata';

// Benefits - what CHANGES for the business (outcome-framed)
const benefits = [
  "Win more of the deals you already have — see exactly where calls go wrong and fix it.",
  "Catch churn before it happens — early-warning flags on accounts going cold.",
  "Know which reps need coaching — per-person scoring across every call, automatically.",
  "No new leads required. This is revenue from pipeline you’ve already paid to create.",
];

// How it works - for buyers who want to know what's under the hood
const howItWorks = [
  "Plugs into your existing call recorder. Once it’s installed, every new call is scored automatically.",
  "A dashboard with per-rep scores, churn-risk flags, and the recurring reasons deals slip.",
  "Head-start bonus: if your call tool is queryable (Fireflies, Fathom, Otter, tl;dv), I’ll retro-score your last ~30 calls so you get value on day one.",
];

const notIncluded =
  "This finds and fixes the deals you’re losing on calls. It doesn’t generate new top-of-funnel leads. That’s the Content System. If your bottleneck is “not enough leads,” start there instead.";

const CallIntelligencePage: React.FC = () => {
  useMetadata({
    title: 'Call Intelligence | Manfredi',
    description:
      "An installed system that scores every sales and client call, flags the accounts about to churn, and shows you exactly why deals slip, so you fix what’s costing you revenue you can already see.",
    canonical: 'https://ivanmanfredi.com/call-intelligence',
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
            <span className="inline-block text-xs uppercase tracking-[0.1em] font-medium text-ink-soft border border-[color:var(--color-hairline-bold)] rounded px-2 py-1">
              Call Intelligence &middot; Win-rate system
            </span>
          </motion.div>

          {/* H1 */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl font-semibold leading-[1.05] tracking-tighter mb-6 max-w-4xl"
          >
            Close more of the deals{' '}
            <span className="font-drama italic">you&rsquo;re already in.</span>
          </motion.h1>

          {/* Hero subhead */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-ink-soft max-w-2xl leading-relaxed mb-10"
          >
            An installed system that scores every sales and client call, flags the accounts about to churn, and shows you exactly why deals slip, so you fix what&rsquo;s costing you revenue you can already see.
          </motion.p>

          {/* Hero CTA */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mb-12"
          >
            <a
              href="/start"
              className="btn-magnetic inline-flex items-center gap-3 px-8 py-4 bg-accent rounded-lg border-subtle-thick shadow-card-subtle font-semibold text-base tracking-wide text-white"
            >
              Book your fit call
              <ArrowRight aria-hidden="true" size={18} />
            </a>
          </motion.div>

          {/* TL;DR */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-paper-sunk border border-[color:var(--color-hairline)] p-6 md:p-8 mb-16 max-w-3xl"
          >
            <p className="font-mono text-xs uppercase tracking-[0.1em] text-ink-mute mb-3">TL;DR</p>
            <p className="text-ink-soft leading-relaxed">
              Most agencies obsess over getting more leads while quietly losing the ones they have &mdash; on calls nobody reviews. Call Intelligence turns every call into data: a per-rep scorecard, churn-risk alerts on at-risk accounts, and the patterns behind why deals die. You stop guessing why you&rsquo;re losing and start closing more of what&rsquo;s already in the pipeline.
            </p>
          </motion.div>

          {/* Benefits - lead with outcomes */}
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
              {benefits.map((item, i) => (
                <li key={i} className="flex items-start gap-4 text-[15px] text-ink-soft border-l border-accent pl-6 py-1">
                  <Check size={18} className="text-accent shrink-0 mt-1" strokeWidth={3} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* How it works - under the hood */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-3">
              How it works
            </h2>
            <p className="text-ink-soft mb-8">What&rsquo;s under the hood &mdash; for the technically curious.</p>
            <ul className="space-y-3">
              {howItWorks.map((item, i) => (
                <li key={i} className="flex items-start gap-4 text-[15px] text-ink-soft">
                  <Check size={18} className="text-accent shrink-0 mt-1" strokeWidth={3} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Qualifier block */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16 bg-paper-sunk border-l-2 border-accent p-8 md:p-10"
          >
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-ink-mute mb-3">
              One question to scope it:
            </p>
            <p className="text-xl md:text-2xl leading-relaxed text-ink-soft">
              What do you use to record your sales and client calls? (Fireflies / Fathom / Otter / Gong / Zoom / nothing yet.) If nothing, step one is a{' '}
              <span className="font-drama italic text-black">lightweight recorder</span>{' '}
              &mdash; then we install.
            </p>
          </motion.div>

          {/* Pricing note */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-4">
              Pricing
            </h2>
            <p className="text-ink-soft leading-relaxed">
              Pricing is scoped to your call volume and stack on the fit call. Every setup is a little different.
            </p>
          </motion.div>

          {/* Not included / honest scope */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-4">
              What&rsquo;s not in scope
            </h2>
            <p className="text-ink-soft mb-6">Being explicit about this up front stops scope arguments later.</p>
            <div className="flex items-start gap-4 text-ink-soft">
              <span className="font-mono text-zinc-400 mt-1">-</span>
              <span>{notIncluded}</span>
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
              See where your deals are leaking.
            </h2>
            <p className="text-zinc-400 mb-8 max-w-xl mx-auto leading-relaxed">
              Book a fit call and I&rsquo;ll come prepared with a scoped plan for your call stack and volume. No guesswork.
            </p>
            <a
              href="/start"
              className="btn-magnetic inline-flex items-center gap-3 px-10 py-5 bg-accent text-white font-bold text-lg tracking-wide border-subtle-thick shadow-card"
            >
              Book your fit call
              <ArrowRight aria-hidden="true" size={20} />
            </a>
          </motion.div>

        </div>
      </section>
    </div>
  );
};

export default CallIntelligencePage;
