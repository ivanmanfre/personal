import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';

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
            <span className="font-mono text-xs uppercase tracking-widest bg-black text-accent px-3 py-1.5">
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
            className="text-xl text-zinc-600 max-w-2xl leading-relaxed mb-12"
          >
            A paid 1-week diagnostic. I score your operation on the four conditions every AI build needs before it ships. You get a scorecard and a 30-day roadmap. If you move forward, the full $2,500 is credited back.
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
                  Assessment
                </p>
                <p className="text-5xl md:text-6xl font-bold tracking-tighter">$2,500</p>
                <p className="text-sm text-zinc-500 mt-2">One-week engagement · 100% credit clause</p>
              </div>
              <a
                href="https://calendly.com/ivan-intelligents/30min"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-magnetic w-full md:w-auto px-8 py-4 bg-accent border-subtle-thick shadow-card flex items-center justify-center gap-3 font-bold text-base tracking-wide text-black"
              >
                Book the Assessment
                <ArrowRight size={18} />
              </a>
            </div>
            <p className="text-sm text-zinc-600 border-t border-zinc-200 pt-6">
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
                <li key={i} className="flex items-start gap-4 text-lg text-zinc-700">
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
                  className="border border-zinc-300 bg-white p-6 shadow-sm"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="font-mono text-xs text-zinc-500">{item.number}</span>
                    <h3 className="font-mono text-sm uppercase tracking-widest font-bold">
                      {item.title}
                    </h3>
                  </div>
                  <p className="text-zinc-600 leading-relaxed">
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
                <span className="font-mono text-sm text-zinc-500 mt-1 shrink-0 w-12">Day 1</span>
                <p className="text-lg text-zinc-700 leading-relaxed">
                  You complete a structured intake questionnaire (30 minutes of your time). 20–30 questions across the 4 preconditions.
                </p>
              </div>
              <div className="flex gap-6 items-start">
                <span className="font-mono text-sm text-zinc-500 mt-1 shrink-0 w-12">Day 2</span>
                <p className="text-lg text-zinc-700 leading-relaxed">
                  We run a 60–90 minute working session. I walk through your answers, ask follow-ups, observe your current systems.
                </p>
              </div>
              <div className="flex gap-6 items-start">
                <span className="font-mono text-sm text-zinc-500 mt-1 shrink-0 w-12">Day 3–6</span>
                <p className="text-lg text-zinc-700 leading-relaxed">
                  I produce your scorecard, 30-day prioritized roadmap, and specific recommendations.
                </p>
              </div>
              <div className="flex gap-6 items-start">
                <span className="font-mono text-sm text-zinc-500 mt-1 shrink-0 w-12">Day 7</span>
                <p className="text-lg text-zinc-700 leading-relaxed">
                  60-minute presentation call. I deliver the findings and recommend the path forward — Fractional, project, or wait-and-build.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Final CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-black text-white p-10 md:p-12 text-center"
          >
            <h2 className="text-3xl md:text-4xl font-semibold mb-4 tracking-tight">
              Start the Assessment
            </h2>
            <p className="text-zinc-400 mb-8 max-w-xl mx-auto leading-relaxed">
              If your operation clears the 4 conditions, AI becomes a force multiplier. If it doesn't, you're funding demos that never ship. Let's find out which one you are.
            </p>
            <a
              href="https://calendly.com/ivan-intelligents/30min"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-magnetic inline-flex items-center gap-3 px-10 py-5 bg-accent text-black font-bold text-lg tracking-wide border-subtle-thick shadow-card"
            >
              Book the Assessment — $2,500
              <ArrowRight size={20} />
            </a>
            <p className="mt-6 text-sm text-zinc-500">
              Not sure yet? <a href="/start" className="underline text-zinc-300 hover:text-white">Book a call first</a>.
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default AssessmentPage;
