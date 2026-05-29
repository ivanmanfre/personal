import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import { useMetadata } from '../hooks/useMetadata';

const tiers = [
  {
    name: 'Heavy month',
    price: '$10,000/mo',
    badge: 'Recommended starting point',
    fit: 'Best for new engagements with significant build scope.',
    features: [
      '**90-Day Blueprint audit** delivered week 1, yours regardless',
      '2-3 major systems built',
      '**Custom Living Ops Panel**: your stack in one panel; grows a new module with every system shipped',
      'Weekly working sessions',
      'Slack support throughout',
    ],
    bestFor: 'First month with a new partner. Post-pivot rebuilds. "I need a lot built fast."',
  },
  {
    name: 'Active build',
    price: '$6,500/mo',
    bundleNote: 'Most clients here for months 2-3. Bundle both at $12k (saves $1k).',
    fit: 'Ongoing builds + strategy after the heavy month.',
    features: [
      '1-2 new systems per month from your 90-day plan',
      'Bi-weekly working sessions',
      'Slack support + async builds',
      'Monthly recap + next-month priority alignment',
    ],
    bestFor: 'Months 2-3 after Heavy month, executing the 90-day plan priorities. Or smaller new engagements that don\'t need a full Heavy month start.',
    highlighted: true,
  },
];

const slowLaneTier = {
  name: 'Slow lane',
  price: '$3,500/mo',
  fit: 'Light cadence after the build queue empties.',
  features: [
    '1 small build per month',
    'Monthly strategy call',
    'Async Slack support',
    'Monthly system health report',
  ],
  bestFor: 'After the 90-day plan ships, when you want to keep the relationship lighter but not exit entirely. Or smallest-scope new engagements.',
};

const howItWorks = [
  {
    title: 'Discovery call',
    duration: '30-45 min · free',
    description: 'We figure out scope, fit, and the right starting intensity. Not every business needs Heavy month. Some start at Active build, some only want Slow Lane.',
  },
  {
    title: 'Intake',
    duration: '~20 min · conversational AI',
    description: 'You walk an AI agent through your business: content state, outbound, production capacity, team structure, ICP. I prep the Blueprint from your answers.',
  },
  {
    title: 'Kickoff + audit walkthrough',
    duration: 'Week 1 · 60-75 min',
    description: 'Combined call. I walk the 90-Day Blueprint audit findings, you push back where they don\'t match reality, we lock the first month\'s scope and shipping order.',
  },
  {
    title: 'Builds shipping',
    duration: 'Weeks 2-3',
    description: 'Priority systems go live. Voice profile trained. Content engine drafting daily. You self-edit copy through the in-browser editor, so there\'s no Ivan dependency for text changes.',
  },
  {
    title: '90-Day Plan Review',
    duration: 'Week 3-4 · pre-scheduled',
    description: 'We look at the audit findings together, decide what\'s next, recalibrate intensity. Continue, step down, or graduate to Care Plan. No surprises, since it\'s already on the calendar from day one.',
  },
];

const blueprintCovers = [
  '**Business + system map**: where AI/automation can move the needle, where it can\'t, what\'s blocking what',
  '**5-7 priority builds**: costed gaps, severity, sequencing',
  '**90-day roadmap**: 3 phases, who does what, what ships when',
  '**Quick wins**: first 2-3 things to build for fastest visible payoff',
];

const faqs = [
  {
    q: 'Can I start at $6,500 instead of $10,000?',
    a: 'Yes. Heavy month is recommended for first months with a new partner because it covers the audit + 2-3 priority builds. But if your scope is smaller or you already know what you want built, Active build is a fine starting point.',
  },
  {
    q: 'What happens after the first few months?',
    a: 'Most clients move to Slow Lane ($3,500/mo) or the optional Care Plan as the heavy build queue empties. You can also stay at Active build indefinitely.',
  },
  {
    q: 'Can I switch tiers month-to-month?',
    a: 'Yes. Think of the tiers as intensity dials you can turn up or down, with no contract locking you in. We recalibrate monthly based on what\'s actually needed. Step up if a big build is coming, step down when things settle.',
  },
  {
    q: 'What if I just want one thing built, like a lead magnet system?',
    a: 'That\'s a Single Project at $7,500 (see /lead-magnet-system). No engagement, no audit, you own the build. Single Project works best when you know exactly what you want and don\'t need strategic input.',
  },
  {
    q: 'What\'s the 90-Day Blueprint?',
    a: 'The strategic audit + roadmap I deliver in your first Heavy month. Includes a business + system map, 5-7 priority builds with costed gaps, a 3-phase 90-day plan, and quick wins. It\'s yours regardless of whether you continue past month 1.',
  },
  {
    q: 'Refund policy?',
    a: 'Month-to-month. If month 1 ships and you don\'t see value, no continuation. The audit is yours regardless. I\'d rather lose a month\'s revenue than have you stuck in a tier that isn\'t earning it.',
  },
];

const notIncluded = [
  'Bespoke products outside the AI-systems scope (brand design, paid ads management, hiring)',
  'On-site presence. This is remote-first, async-first',
  '24/7 on-call response. Real emergencies handled same-day, but I sleep',
  'Unlimited implementation volume. Each tier has a defined monthly scope',
];

// Renders **bold** markdown inline
function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-black">{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

const FractionalPage: React.FC = () => {
  useMetadata({
    title: 'Fractional AI Partner | Manfredi',
    description: 'Monthly engagement. A senior AI partner embedded in your business, shipping systems every month. Pick an intensity that matches the work ahead: heavy month for big builds, lighter cadence as things settle.',
    canonical: 'https://ivanmanfredi.com/fractional',
  });

  return (
    <div className="min-h-screen bg-paper">
      <section className="pt-32 pb-24 px-6">
        <div className="container mx-auto max-w-5xl">

          {/* HERO */}
          <motion.div
            initial={{ y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <span className="inline-block text-xs uppercase tracking-[0.1em] font-medium text-ink-soft border border-[color:var(--color-hairline-bold)] rounded px-2 py-1">
              Fractional AI Partner · Senior operator, ongoing
            </span>
          </motion.div>

          <motion.h1
            initial={{ y: 30 }}
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
            className="text-xl text-ink-soft max-w-2xl leading-relaxed mb-4"
          >
            Monthly engagement. Pick an intensity that matches the work ahead: heavy month for big builds, lighter cadence as things settle.
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-base text-ink-mute max-w-2xl leading-relaxed mb-16"
          >
            Systems ship every month. Your team owns what gets built. Switch tiers month-to-month as needs change.
          </motion.p>

          {/* HOW IT WORKS — process before tiers */}
          <motion.div
            initial={{ y: 20 }}
            whileInView={{ y: 0 }}
            viewport={{ once: true }}
            className="mb-20"
          >
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-3">
              How the engagement works
            </h2>
            <p className="text-ink-soft mb-8 max-w-2xl">
              Every Fractional engagement follows the same five steps, whether you start at Heavy month or Slow Lane.
            </p>
            <div className="space-y-6">
              {howItWorks.map((step, i) => (
                <div key={step.title} className="border-l border-accent pl-6 relative">
                  <span className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-accent" aria-hidden="true" />
                  <div className="flex items-baseline justify-between gap-4 flex-wrap mb-1">
                    <h3 className="font-semibold text-lg text-black tracking-tight">
                      <span className="font-mono text-[11px] uppercase tracking-widest text-ink-mute mr-3">0{i + 1}</span>
                      {step.title}
                    </h3>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-ink-mute">
                      {step.duration}
                    </span>
                  </div>
                  <p className="text-ink-soft leading-relaxed">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* TIERS — intensity menu, not parallel monthly choices */}
          <motion.div
            initial={{ y: 10 }}
            whileInView={{ y: 0 }}
            viewport={{ once: true }}
            className="mb-4"
          >
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-3">
              Two main options. Pick what matches the work ahead.
            </h2>
            <p className="text-ink-soft mb-10 max-w-2xl">
              Switch tiers month-to-month as your needs change. You're never locked in.
            </p>
          </motion.div>

          {/* Heavy + Active — two main options, equal weight */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {tiers.map((tier) => (
              <motion.div
                key={tier.name}
                initial={{ y: 30 }}
                whileInView={{ y: 0 }}
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
                  {tier.badge && !tier.highlighted && (
                    <span className="font-mono text-xs uppercase tracking-widest text-ink-mute mb-3 block">
                      {tier.badge}
                    </span>
                  )}
                  <h3 className={`text-2xl font-semibold tracking-tight mb-2 ${tier.highlighted ? 'text-white' : ''}`}>
                    {tier.name}
                  </h3>
                  <p className={`text-3xl font-bold tracking-tighter font-mono mb-3 ${tier.highlighted ? 'text-accent' : 'text-black'}`}>
                    {tier.price}
                  </p>
                  <p className={`text-sm italic leading-relaxed ${tier.highlighted ? 'text-zinc-400' : 'text-ink-mute'}`}>
                    {tier.fit}
                  </p>
                  {tier.bundleNote && (
                    <p className={`text-xs mt-3 font-mono ${tier.highlighted ? 'text-accent' : 'text-accent'}`}>
                      → {tier.bundleNote}
                    </p>
                  )}
                </div>

                <ul className="space-y-3 mb-6 flex-1">
                  {tier.features.map((f) => (
                    <li key={f} className={`flex items-start gap-3 text-sm leading-relaxed ${tier.highlighted ? 'text-zinc-300' : 'text-ink-soft'}`}>
                      <Check size={16} className={`shrink-0 mt-1 ${tier.highlighted ? 'text-accent' : 'text-black'}`} strokeWidth={3} />
                      <span>{renderInline(f)}</span>
                    </li>
                  ))}
                </ul>

                <div className={`text-xs italic mb-6 pb-4 border-t pt-4 ${tier.highlighted ? 'border-zinc-700 text-zinc-400' : 'border-zinc-200 text-ink-mute'}`}>
                  <span className={`font-mono not-italic uppercase tracking-widest text-[10px] block mb-1 ${tier.highlighted ? 'text-zinc-500' : 'text-ink-mute'}`}>
                    Best for
                  </span>
                  {tier.bestFor}
                </div>

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

          {/* Slow Lane — secondary tier, smaller, full-width below the main two */}
          <motion.div
            initial={{ y: 20 }}
            whileInView={{ y: 0 }}
            viewport={{ once: true }}
            className="mb-3 max-w-3xl mx-auto bg-paper-sunk border border-zinc-300 p-6 md:p-7"
          >
            <div className="flex items-start gap-6 flex-wrap md:flex-nowrap">
              <div className="flex-shrink-0">
                <span className="font-mono text-xs uppercase tracking-widest text-ink-mute mb-2 block">
                  Step-down tier
                </span>
                <h3 className="text-xl font-semibold tracking-tight mb-1">{slowLaneTier.name}</h3>
                <p className="text-2xl font-bold tracking-tighter font-mono text-black mb-2">{slowLaneTier.price}</p>
                <p className="text-xs italic text-ink-mute max-w-[180px]">{slowLaneTier.fit}</p>
              </div>
              <ul className="flex-1 space-y-2 text-sm text-ink-soft">
                {slowLaneTier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check size={14} className="shrink-0 mt-1 text-ink-mute" strokeWidth={3} />
                    <span>{renderInline(f)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex-shrink-0 self-center">
                <a
                  href="/start"
                  className="inline-block px-5 py-2.5 border border-black bg-paper text-black font-bold tracking-wide text-xs transition-colors hover:bg-black hover:text-white"
                >
                  Discuss
                </a>
              </div>
            </div>
          </motion.div>

          {/* Care Plan footnote — visually subordinate */}
          <div className="mb-20 max-w-3xl mx-auto text-center">
            <p className="text-xs text-ink-mute italic">
              After your active engagement winds down, optional <strong className="not-italic text-ink-soft font-semibold">Care Plan at $1k/mo</strong> available for ongoing maintenance: fixes, prompt updates, monitoring. No new builds.
            </p>
          </div>

          {/* NON-MANDATORY HONESTY CALLOUT */}
          <motion.div
            initial={{ y: 20 }}
            whileInView={{ y: 0 }}
            viewport={{ once: true }}
            className="mb-20 bg-paper-sunk border-l-2 border-accent p-8 md:p-10"
          >
            <h3 className="text-2xl md:text-3xl font-semibold tracking-tight mb-4">
              The 90-Day Blueprint <span className="font-drama italic">is honest.</span>
            </h3>
            <p className="text-lg text-ink-soft leading-relaxed mb-3">
              The audit I deliver in your first Heavy month surfaces 5-7 priority builds across content, outbound, production, and partnerships. It's your roadmap, owned by you.
            </p>
            <p className="text-lg text-black leading-relaxed font-medium">
              If we don't find enough to justify continuation, I tell you straight. You graduate to Care Plan or just walk.
            </p>
          </motion.div>

          {/* 90-DAY BLUEPRINT SECTION */}
          <motion.div
            initial={{ y: 20 }}
            whileInView={{ y: 0 }}
            viewport={{ once: true }}
            className="mb-20"
          >
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-3">
              What the 90-Day Blueprint covers
            </h2>
            <p className="text-ink-soft mb-8 max-w-2xl">
              Delivered in your first Heavy month, yours regardless of whether you continue.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              {blueprintCovers.map((item) => (
                <div key={item} className="bg-paper-sunk border-l-2 border-accent p-5">
                  <p className="text-ink-soft leading-relaxed text-sm">
                    {renderInline(item)}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-sm text-ink-mute mt-6 italic max-w-2xl leading-relaxed">
              Delivered via conversational AI intake → working session with me → published deliverable. Same engine that ships the standalone <a href="/assessment" className="underline hover:text-black not-italic">Agent-Ready Blueprint</a>, scoped to your full system instead of a single workflow.
            </p>
          </motion.div>

          {/* PACE-TO-ABSORPTION */}
          <motion.div
            initial={{ y: 20 }}
            whileInView={{ y: 0 }}
            viewport={{ once: true }}
            className="mb-20 bg-paper-sunk border-l-2 border-accent p-8 md:p-10"
          >
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-ink-mute mb-3">
              How we pace
            </p>
            <p className="text-xl md:text-2xl leading-relaxed text-ink-soft">
              We pace to <span className="font-drama italic text-black">your absorption</span>. With AI in service businesses, the real constraint is usually your team's headspace to take on new systems, so each month we ship only what you can actually integrate, leaving runway for the previous wave to land.
            </p>
          </motion.div>

          {/* ROI vs FULL-TIME HIRE */}
          <motion.div
            initial={{ y: 10 }}
            whileInView={{ y: 0 }}
            viewport={{ once: true }}
            className="mb-20 max-w-3xl space-y-3"
          >
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-3">
              vs full-time hire
            </h2>
            <p className="text-base text-ink-soft leading-relaxed">
              Full-time senior AI hire runs <span className="font-mono">$200k–$400k</span>/yr fully loaded.
            </p>
            <p className="text-base text-ink-soft leading-relaxed">
              Heavy month is <span className="font-mono">$120k</span>/yr if maintained, but most clients step down to Active build or Slow Lane after the build-heavy months. Real-world average: <span className="font-mono">$80-100k</span>/yr for an active partnership.
            </p>
            <p className="text-base text-ink-soft leading-relaxed">
              No recruiting risk. No ramp. No benefits. No severance. Switch intensities month-to-month. Walk anytime.
            </p>
            <p className="text-sm text-ink-mute pt-2">
              Already know what you want built? <a href="/start?path=scope" className="underline hover:text-black">Skip the tier match and book a 30-min scope call</a>.
            </p>
          </motion.div>

          {/* OUT OF SCOPE */}
          <motion.div
            initial={{ y: 20 }}
            whileInView={{ y: 0 }}
            viewport={{ once: true }}
            className="mb-20"
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

          {/* FAQ */}
          <motion.div
            initial={{ y: 20 }}
            whileInView={{ y: 0 }}
            viewport={{ once: true }}
            className="mb-20"
          >
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-8">
              Common questions
            </h2>
            <div className="space-y-6">
              {faqs.map((faq) => (
                <div key={faq.q} className="border-b border-[color:var(--color-hairline)] pb-6">
                  <h3 className="font-semibold text-lg text-black tracking-tight mb-2">
                    {faq.q}
                  </h3>
                  <p className="text-ink-soft leading-relaxed">
                    {faq.a}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* FINAL CTA */}
          <motion.div
            initial={{ y: 20 }}
            whileInView={{ y: 0 }}
            viewport={{ once: true }}
            className="bg-black text-white p-10 md:p-16 text-center border border-[color:var(--color-hairline-bold)]"
          >
            <h2 className="text-3xl md:text-4xl font-semibold mb-4 tracking-tight">
              Start with the discovery
            </h2>
            <p className="text-zinc-400 mb-8 max-w-xl mx-auto leading-relaxed">
              30-45 min call. We figure out if there's a fit, what intensity matches your situation, what shipping order makes sense. Free.
            </p>
            <a
              href="/start"
              className="btn-magnetic inline-flex items-center gap-3 px-10 py-5 bg-accent text-white font-bold text-lg tracking-wide border-subtle-thick shadow-card"
            >
              Book the discovery call
              <ArrowRight aria-hidden="true" size={20} />
            </a>
            <p className="mt-6 text-sm text-ink-mute">
              Cold to my work? <a href="/assessment" className="underline text-zinc-300 hover:text-white">Start with the Agent-Ready Blueprint ($2,000)</a>, credited toward any engagement.
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default FractionalPage;
