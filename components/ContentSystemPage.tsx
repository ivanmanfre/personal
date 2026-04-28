import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import { useMetadata } from '../hooks/useMetadata';

// Benefits first - outcomes the founder actually cares about
const benefits = [
  {
    headline: 'Stop staring at the blank page',
    body: 'Every Monday morning, a 7-day content plan lands in your review queue. Topics are pre-scored against what your audience actually engages with. You approve; the system ships.',
  },
  {
    headline: 'Your brand voice survives scale',
    body: 'The system is trained on your existing posts. New drafts sound like you, not like ChatGPT. When you ship 5 posts a week instead of 1 a month, the voice holds.',
  },
  {
    headline: 'Your best-performing posts compound',
    body: 'Top performers get identified automatically and repurposed into new angles. Your hits don\'t die in the scroll - they come back as carousels, newsletter issues, and follow-ups.',
  },
  {
    headline: 'You review, you don\'t write',
    body: '30 minutes reviewing a week\'s worth of drafts beats 3 hours staring at Google Docs. Edit the 5% that matters. The rest ships as-is.',
  },
  {
    headline: 'Formats mix without you thinking about them',
    body: 'Text posts, carousels, image posts, lead-magnet promos - the system rotates formats based on what\'s working this month. You stop shipping 4 text posts in a row by accident.',
  },
  {
    headline: 'One system, both engines',
    body: 'Pairs natively with the Lead Magnet System. Your posts promote your magnets. Your magnets feed your newsletter. Your newsletter republishes your best posts. Content engine + lead gen engine = one machine.',
  },
];

// Technical deliverables - for buyers who want the spec
const deliverables = [
  'Weekly content planning agent - generates 5-7 post plan every Sunday',
  'Topic scoring - against your audience, your competitors, and your quarterly strategy',
  'Voice training - trained on your last 50 published posts so drafts sound like you',
  'Multi-format generation - text, carousels, hooks, image prompts',
  'Human-in-the-loop approval - you review in your existing tool (ClickUp, Notion, Asana, Linear, etc.); system waits for sign-off',
  'Auto-publish to LinkedIn (or your primary channel) with scheduled cadence',
  'Top performer detection - winning posts get flagged for repurposing',
  'Dashboard - what\'s planned, what\'s scheduled, what shipped, what worked',
];

const timeline = [
  {
    week: 'Week 1',
    title: 'Voice + strategy',
    description: 'Kickoff call. I read your last 50 posts to train voice. You walk me through quarterly strategy and non-negotiables. I build the planning agent and scoring prompts.',
  },
  {
    week: 'Week 2',
    title: 'Integration + formats',
    description: 'I wire LinkedIn, your project tool (ClickUp, Notion, Asana - whatever your team uses), and your analytics. Build the multi-format generators (text / carousel / image). You review first sample outputs.',
  },
  {
    week: 'Week 3',
    title: 'Review loop + launch',
    description: 'The system generates a real week of content on your live schedule. We run it together, edit the approval flow, then hand it off. You own it after Week 3.',
  },
];

const notIncluded = [
  'Writing the content for you - you approve and edit; the system drafts',
  'Paid amplification or ad buying (not this offer)',
  'Replacing human strategy - if you don\'t know what you want to be known for, the system amplifies the confusion',
  'Guaranteed engagement - the system ships; the market decides',
];

const ContentSystemPage: React.FC = () => {
  useMetadata({
    title: 'Content Engine | Manfredi',
    description: 'Weekly content planning agent trained on your voice. You review; the system ships. 5-7 posts a week without staring at a blank page.',
    canonical: 'https://ivanmanfredi.com/content-system',
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
              Content Engine
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl font-semibold leading-[1.05] tracking-tight mb-6 max-w-4xl"
          >
            Ship 5 posts a week <br />
            <span className="font-drama italic">without writing them.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-ink-soft max-w-2xl leading-relaxed mb-10"
          >
            Stop staring at the blank page every Monday. Stop shipping ghostwriter-grade content that sounds like everyone else. Stop losing momentum because you got busy for two weeks.
          </motion.p>

          {/* TL;DR */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-paper-sunk border border-[color:var(--color-hairline)] p-6 md:p-8 mb-12 max-w-3xl"
          >
            <p className="font-mono text-xs uppercase tracking-[0.1em] text-ink-mute mb-3">TL;DR</p>
            <ul className="space-y-2 text-ink-soft leading-relaxed">
              <li>· 3-week productized build · from $6k</li>
              <li>· Weekly content planning agent trained on your voice, auto-publishing to your channels</li>
              <li>· You review and approve; the system plans, drafts, schedules, and tracks what performs</li>
            </ul>
          </motion.div>

          {/* Price */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-paper rounded-2xl border border-[color:var(--color-hairline)] shadow-card-subtle p-8 md:p-12 mb-16"
          >
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8">
              <div>
                <p className="font-mono text-xs uppercase tracking-widest text-ink-mute mb-2">
                  Fixed project
                </p>
                <p className="text-5xl md:text-6xl font-bold tracking-tight">From $6k</p>
                <p className="text-sm text-ink-mute mt-2">3-week delivery · 50% upfront, 50% on launch</p>
              </div>
              <a
                href="/start"
                className="btn-magnetic w-full md:w-auto px-8 py-4 bg-accent rounded-lg border-subtle-thick shadow-card-subtle flex items-center justify-center gap-3 font-semibold text-base tracking-wide text-white"
              >
                Start the conversation
                <ArrowRight aria-hidden="true" size={18} />
              </a>
            </div>
            <p className="text-sm text-ink-soft border-t border-[color:var(--color-hairline)] pt-6">
              Price depends on number of channels (LinkedIn only vs multi-platform), format variety, and how sophisticated your voice training and analytics need to be. I quote after a 30-minute scope call.
            </p>
          </motion.div>

          {/* Benefits */}
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
                <div key={i} className="border-l border-accent pl-6">
                  <h3 className="text-lg font-semibold mb-2 leading-tight">{b.headline}</h3>
                  <p className="text-ink-soft leading-relaxed">{b.body}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Under the hood */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-3">
              Under the hood
            </h2>
            <p className="text-ink-soft mb-8">What's actually in the box - for the technically curious.</p>
            <ul className="space-y-3">
              {deliverables.map((item, i) => (
                <li key={i} className="flex items-start gap-4 text-[15px] text-ink-soft">
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
                <div key={step.week} className="flex gap-6 items-start border-l border-accent pl-6">
                  <span className="font-mono text-sm text-ink-mute mt-1 shrink-0 w-20">{step.week}</span>
                  <div>
                    <h3 className="font-mono text-sm uppercase tracking-widest font-bold mb-2">
                      {step.title}
                    </h3>
                    <p className="text-lg text-ink-soft leading-relaxed">
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
              Ready to stop writing posts?
            </h2>
            <p className="text-zinc-400 mb-8 max-w-xl mx-auto leading-relaxed">
              Fill out the 5-minute intake and I'll come to our call with a scoped proposal - specific formats, specific channels, specific voice guardrails.
            </p>
            <a
              href="/start"
              className="btn-magnetic inline-flex items-center gap-3 px-10 py-5 bg-accent rounded-lg text-white font-bold text-lg tracking-wide border-subtle-thick shadow-card-subtle"
            >
              Start the conversation
              <ArrowRight aria-hidden="true" size={20} />
            </a>
            <p className="mt-6 text-sm text-ink-mute">
              Want a diagnostic first? <a href="/assessment" className="underline text-zinc-300 hover:text-white">Start with the Agent-Ready Blueprint</a>.
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default ContentSystemPage;
