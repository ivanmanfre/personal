import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import { useMetadata } from '../hooks/useMetadata';

// Benefits - what CHANGES for the business (outcome-framed)
const benefits = [
  {
    headline: 'Your best salesperson stops doing triage',
    body: 'Leads arrive pre-scored. No more manual qualification on every inbound. Your team spends hours on qualified conversations instead of filtering the noise.',
  },
  {
    headline: 'Launch new magnets in an afternoon, not 3 weeks',
    body: 'When you want a new guide or scorecard, you swap copy and a brief in the CMS. The system generates a branded cover image, deploys the page, wires the CRM, and fires the nurture sequence. No dev, no agency, no waiting.',
  },
  {
    headline: 'Every lead gets followed up, every time',
    body: 'The nurture sequence runs automatically. 4-6 emails over 2 weeks, personalized to what they downloaded. You stop losing leads to "I meant to email them back."',
  },
  {
    headline: 'Your content library builds your email list',
    body: 'Every magnet download flows into your newsletter. The people who liked your guide on lead qualification are the same people who want your weekly thinking on the topic. One asset, two revenue lines.',
  },
  {
    headline: 'You see which magnets actually convert',
    body: 'A dashboard shows downloads, completion rate, and qualified-lead count by magnet. You stop guessing which topics work. You know.',
  },
  {
    headline: 'Consistent brand on every asset',
    body: 'Gemini generates a branded hero image for every new magnet from your visual template. No more paying a designer for a cover image on every launch. No more ugly PDF covers that make the magnet look cheap.',
  },
];

// Technical deliverables - for buyers who want to know what\'s under the hood
const deliverables = [
  'Interactive landing page (scorecard, assessment, guide, or calculator format)',
  'CMS-driven magnet library - add or edit magnets without touching code',
  'AI-generated cover images via Gemini - branded hero image per magnet',
  'Newsletter integration - Resend, Kit, Beehiiv, or your existing stack',
  'CRM integration - HubSpot, Apollo, Attio, or whatever you use',
  'Automated email delivery + nurture sequence (4-6 emails)',
  'Analytics dashboard - downloads, completion rate, qualified leads by magnet',
];

const timeline = [
  { week: 'Week 1', title: 'Intake + architecture', description: 'Kickoff call. I audit your current lead gen, pull brand + copy assets, and send you the full architecture doc. You approve scope before anything ships.' },
  { week: 'Week 2', title: 'Build + content', description: 'I build the interactive page, wire CRM integration, set up email automation, and draft the magnet copy. You review and mark changes.' },
  { week: 'Week 3', title: 'Launch + handoff', description: 'We go live. I monitor the first 48 hours, fix anything that surfaces, then hand you the dashboard and docs so your team can run it.' },
];

const notIncluded = [
  'Paid traffic to drive visitors (I can recommend a partner)',
  'Original magnet content - you bring the expertise, I build the delivery system',
  'Sales outreach to the leads (that\'s the Fractional Partner or Care Plan layer)',
];

const LeadMagnetSystemPage: React.FC = () => {
  useMetadata({
    title: 'Lead Magnet System | Manfredi',
    description: 'Productized 3-week build. Interactive landing page + CMS-driven magnet + CRM wired + nurture sequence. A lead gen asset that works without a marketing team. $8-12k fixed.',
    canonical: 'https://ivanmanfredi.com/lead-magnet-system',
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
            <span className="inline-block text-[11px] uppercase tracking-[0.14em] font-medium text-ink-soft border border-[color:var(--color-hairline-bold)] rounded px-2 py-1">
              Lead Magnet System
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl font-semibold leading-[1.05] tracking-tighter mb-6 max-w-4xl"
          >
            Turn your expertise into <br />
            <span className="font-drama italic">a qualified-lead engine.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-zinc-600 max-w-2xl leading-relaxed mb-12"
          >
            Stop losing warm leads to follow-up neglect. Stop paying a designer every time you launch a new magnet. Stop guessing which topics convert. One system, installed once, runs forever.
          </motion.p>

          {/* Price box */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl border border-[color:var(--color-hairline)] shadow-card-subtle p-8 md:p-12 mb-16"
          >
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8">
              <div>
                <p className="font-mono text-xs uppercase tracking-widest text-zinc-500 mb-2">
                  Fixed project
                </p>
                <p className="text-5xl md:text-6xl font-bold tracking-tight">$6–10k</p>
                <p className="text-sm text-zinc-500 mt-2">3-week delivery · 50% upfront, 50% on launch</p>
              </div>
              <a
                href="/start"
                className="btn-magnetic w-full md:w-auto px-8 py-4 bg-accent rounded-lg border-subtle-thick shadow-card-subtle flex items-center justify-center gap-3 font-semibold text-base tracking-wide text-black"
              >
                Start the conversation
                <ArrowRight size={18} />
              </a>
            </div>
            <p className="text-sm text-zinc-600 border-t border-[color:var(--color-hairline)] pt-6">
              Price depends on how many magnet formats you want live at launch, CRM routing complexity, and whether you need a custom newsletter integration. I quote after a 30-minute scope call.
            </p>
          </motion.div>

          {/* Benefits - lead with outcomes, not features */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-8">
              What changes for you
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              {benefits.map((b, i) => (
                <div key={i} className="border-l-2 border-accent pl-6">
                  <h3 className="text-lg font-semibold mb-2 leading-tight">{b.headline}</h3>
                  <p className="text-zinc-600 leading-relaxed">{b.body}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Under the hood - for buyers who want the tech specs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-3">
              Under the hood
            </h2>
            <p className="text-zinc-600 mb-8">What's actually in the box - for the technically curious.</p>
            <ul className="space-y-3">
              {deliverables.map((item, i) => (
                <li key={i} className="flex items-start gap-4 text-[15px] text-zinc-700">
                  <Check size={18} className="text-accent shrink-0 mt-1" strokeWidth={3} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Timeline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-8">
              The 3-week flow
            </h2>
            <div className="space-y-6">
              {timeline.map((step) => (
                <div key={step.week} className="flex gap-6 items-start border-l-2 border-accent pl-6">
                  <span className="font-mono text-sm text-zinc-500 mt-1 shrink-0 w-20">{step.week}</span>
                  <div>
                    <h3 className="font-mono text-sm uppercase tracking-widest font-bold mb-2">
                      {step.title}
                    </h3>
                    <p className="text-lg text-zinc-700 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
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
            <p className="text-zinc-600 mb-6">Being explicit about this up front stops scope arguments later.</p>
            <ul className="space-y-3">
              {notIncluded.map((item, i) => (
                <li key={i} className="flex items-start gap-4 text-zinc-700">
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
            className="bg-black text-white rounded-2xl p-8 md:p-12 text-center"
          >
            <h2 className="text-3xl md:text-4xl font-semibold mb-4 tracking-tight">
              Ready to start?
            </h2>
            <p className="text-zinc-400 mb-8 max-w-xl mx-auto leading-relaxed">
              Fill out the 5-minute intake and I'll come to our call with a scoped proposal. No guesswork, no back-and-forth on what gets built.
            </p>
            <a
              href="/start"
              className="btn-magnetic inline-flex items-center gap-3 px-10 py-5 bg-accent text-black font-bold text-lg tracking-wide border-subtle-thick shadow-card"
            >
              Start the conversation
              <ArrowRight size={20} />
            </a>
            <p className="mt-6 text-sm text-zinc-500">
              Want a diagnostic first? <a href="/assessment" className="underline text-zinc-300 hover:text-white">Start with the Agent-Ready Assessment</a>.
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default LeadMagnetSystemPage;
