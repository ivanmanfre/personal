import React from 'react';
import { motion } from 'framer-motion';

const cases = [
  {
    id: "01",
    client: "ProvalTech",
    industry: "Sales Tech",
    title: "AI Call Auditing",
    metric: "5% → 100%",
    desc: "We encoded how their best manager grades a call - 8 criteria, 1–5 - and let the agent apply it to 100% of calls. Humans review flagged outliers.",
    readiness: "4/4 Agent-Ready",
    color: "bg-[color:var(--color-paper-sunk)]",
    metricBox: "bg-paper border border-[color:var(--color-hairline)] text-black"
  },
  {
    id: "02",
    client: "Marketing agency",
    industry: "Services",
    title: "Lead Magnet System",
    metric: "Live in 3 weeks",
    desc: "We productized their lead gen into one CMS. New magnets ship in an afternoon. Every lead arrives pre-scored.",
    readiness: "4/4 Agent-Ready",
    color: "bg-[color:var(--color-paper-sunk)]",
    metricBox: "bg-paper border border-[color:var(--color-hairline)] text-black"
  },
  {
    id: "03",
    client: "MediaScale",
    industry: "Media / Content",
    title: "Content Engine",
    metric: "1 video → 20 posts",
    desc: "We encoded the repurposing logic once. One video in, 20 outputs ready for human review. The writer became an editor.",
    readiness: "4/4 Agent-Ready",
    color: "bg-[color:var(--color-paper-sunk)]",
    metricBox: "bg-paper border border-[color:var(--color-hairline)] text-black"
  }
];

const CaseStudies: React.FC = () => {
  return (
    <section id="cases" className="py-32 bg-paper border-t border-[color:var(--color-hairline)]">
      <div className="container mx-auto px-6">
        <motion.h2
          initial={{ y: 50, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          className="text-5xl sm:text-6xl md:text-7xl font-semibold mb-6 text-center tracking-tight"
        >
          <span className="font-drama italic">Results.</span>
        </motion.h2>

        {/* ICP badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="flex justify-center mb-16"
        >
          <span className="inline-block text-xs uppercase tracking-[0.1em] font-medium text-ink-soft border border-[color:var(--color-hairline-bold)] bg-paper rounded px-2 py-1">
            Agencies · Consultancies · Law &amp; Accounting firms
          </span>
        </motion.div>

        <div className="flex flex-col lg:flex-row gap-8">
          {cases.map((study, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.2, type: "spring", bounce: 0.4 }}
              className="flex-1 rounded-xl border border-[color:var(--color-hairline)] shadow-card-subtle bg-paper group hover-lift hover:shadow-card-lift transition-all overflow-hidden"
            >
              {/* Metric Area */}
              <div className={`h-48 ${study.color} border-b border-zinc-200 flex items-center justify-center relative overflow-hidden`}>
                <div className={`relative z-10 font-semibold text-4xl ${study.metricBox} px-4 py-2 shadow-card text-center`}>
                  {study.metric}
                </div>
              </div>

              {/* Content */}
              <div className="p-8">
                <div className="flex justify-between items-start mb-4">
                  <span className="font-mono text-xs uppercase tracking-[0.1em] text-ink-soft border border-[color:var(--color-hairline-bold)] px-2 py-1">{study.client}</span>
                  <span className="text-xs font-mono uppercase text-ink-mute tracking-[0.1em]">{study.industry}</span>
                </div>
                <h3 className="text-3xl font-semibold mb-2">{study.title}</h3>
                <p className="text-lg font-normal border-l border-[color:var(--color-hairline-bold)] pl-4 leading-relaxed mb-4">{study.desc}</p>
                <div className="flex items-center gap-2 pt-4 border-t border-zinc-200">
                  <span className="w-2 h-2 bg-accent"></span>
                  <span className="font-mono text-xs uppercase tracking-widest text-ink-soft">{study.readiness}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CaseStudies;