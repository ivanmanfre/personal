import React from 'react';
import { motion } from 'framer-motion';

const cases = [
  {
    id: "01",
    client: "B2B sales platform",
    industry: "SaaS",
    title: "AI Call Auditing",
    metric: "5% → 100%",
    desc: "Sales calls are the highest-judgment, lowest-documented work in a sales org. We wrote down how their best manager grades a call — 8 criteria, scored 1-5 — then let the agent apply it to every call instead of the 5% a human could sample. Humans still review flagged calls. That's the design, not a workaround.",
    readiness: "4/4 Agent-Ready",
    color: "bg-[color:var(--color-paper-sunk)]",
    metricBox: "bg-white border border-[color:var(--color-hairline)] text-black"
  },
  {
    id: "02",
    client: "Marketing agency",
    industry: "Services",
    title: "Lead Magnet System",
    metric: "Live in 3 weeks",
    desc: "Their lead gen lived in someone's head. We productized it: interactive landing page, CMS-driven magnet library, CRM wired in, and an email sequence that runs itself. Now when a new magnet is needed, the team swaps copy in the CMS and ships — no dev, no agency, no waiting.",
    readiness: "4/4 Agent-Ready",
    color: "bg-[color:var(--color-paper-sunk)]",
    metricBox: "bg-white border border-[color:var(--color-hairline)] text-black"
  },
  {
    id: "03",
    client: "Content studio",
    industry: "Media",
    title: "Content Engine",
    metric: "1 video → 20 posts",
    desc: "Content repurposing is judgment-heavy until you break it down: what's the hook, what's the takeaway, what's the format. We wrote that logic once. One video in, 20 outputs ready for human review. The person who used to draft posts now edits them.",
    readiness: "4/4 Agent-Ready",
    color: "bg-[color:var(--color-paper-sunk)]",
    metricBox: "bg-white border border-[color:var(--color-hairline)] text-black"
  }
];

const CaseStudies: React.FC = () => {
  return (
    <section id="cases" className="py-24 bg-white border-t border-zinc-200">
      <div className="container mx-auto px-6">
        <motion.h2
          initial={{ y: 50, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          className="text-4xl sm:text-5xl md:text-6xl font-semibold mb-6 text-center tracking-tight"
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
          <span className="inline-block text-[11px] uppercase tracking-[0.14em] font-medium text-ink-soft border border-[color:var(--color-hairline-bold)] bg-paper rounded px-2 py-1">
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
              className="flex-1 rounded-2xl border border-[color:var(--color-hairline)] shadow-card-subtle bg-white group hover-lift hover:shadow-card-lift transition-all overflow-hidden"
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
                  <span className="font-bold uppercase text-xs tracking-widest bg-black text-white px-2 py-1">{study.client}</span>
                  <span className="text-xs font-mono uppercase text-zinc-400 tracking-wide">{study.industry}</span>
                </div>
                <h3 className="text-3xl font-semibold mb-2">{study.title}</h3>
                <p className="text-lg font-normal border-l-2 border-zinc-300 pl-4 leading-relaxed mb-4">{study.desc}</p>
                <div className="flex items-center gap-2 pt-4 border-t border-zinc-200">
                  <span className="w-2 h-2 rounded-full bg-accent"></span>
                  <span className="font-mono text-xs uppercase tracking-widest text-zinc-600">{study.readiness}</span>
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