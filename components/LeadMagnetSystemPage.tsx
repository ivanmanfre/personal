import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import { useMetadata } from '../hooks/useMetadata';

const deliverables = [
  'Interactive landing page (scorecard, assessment, or calculator format)',
  'CMS-driven magnet system — swap copy, images, or full variants without touching code',
  'CRM integration (HubSpot, Apollo, or whatever you use) — every lead arrives pre-scored',
  'Email delivery via Resend — the magnet gets to the prospect within minutes of submission',
  'Automated nurture sequence — 4–6 emails that follow up without you touching it',
  'Dashboard showing downloads, completion rate, and qualified lead count',
];

const timeline = [
  { week: 'Week 1', title: 'Intake + architecture', description: 'Kickoff call. I audit your current lead gen, pull brand + copy assets, and send you the full architecture doc. You approve scope before anything ships.' },
  { week: 'Week 2', title: 'Build + content', description: 'I build the interactive page, wire CRM integration, set up email automation, and draft the magnet copy. You review and mark changes.' },
  { week: 'Week 3', title: 'Launch + handoff', description: 'We go live. I monitor the first 48 hours, fix anything that surfaces, then hand you the dashboard and docs so your team can run it.' },
];

const notIncluded = [
  'Paid traffic to drive visitors (I can recommend a partner)',
  'Original magnet content — you bring the expertise, I build the delivery system',
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
            <span className="font-mono text-xs uppercase tracking-widest bg-black text-accent px-3 py-1.5">
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
            A productized 3-week build. Interactive landing page. CMS-driven magnet. CRM wired. Nurture sequence running. You get a lead gen asset that works without a marketing team behind it.
          </motion.p>

          {/* Price box */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white border border-zinc-300 shadow-card p-8 md:p-12 mb-16"
          >
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8">
              <div>
                <p className="font-mono text-xs uppercase tracking-widest text-zinc-500 mb-2">
                  Fixed project
                </p>
                <p className="text-5xl md:text-6xl font-bold tracking-tighter">$8–12k</p>
                <p className="text-sm text-zinc-500 mt-2">3-week delivery · 50% upfront, 50% on launch</p>
              </div>
              <a
                href="/start"
                className="btn-magnetic w-full md:w-auto px-8 py-4 bg-accent border-subtle-thick shadow-card flex items-center justify-center gap-3 font-bold text-base tracking-wide text-black"
              >
                Start the conversation
                <ArrowRight size={18} />
              </a>
            </div>
            <p className="text-sm text-zinc-600 border-t border-zinc-200 pt-6">
              Price varies by complexity. A simple interactive scorecard + nurture = $8k. A multi-step assessment with branching logic + custom visualizations + advanced CRM routing = $12k. I quote after a 30-minute scope call.
            </p>
          </motion.div>

          {/* Deliverables */}
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
                <li key={i} className="flex items-start gap-4 text-lg text-zinc-700">
                  <Check size={22} className="text-accent shrink-0 mt-1" strokeWidth={3} />
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
                  <span className="font-mono text-zinc-400 mt-1">—</span>
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
            className="bg-black text-white p-10 md:p-12 text-center"
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
