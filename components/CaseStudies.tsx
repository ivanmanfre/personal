import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const cases = [
  {
    id: "01",
    client: "ProvalTech",
    industry: "Sales Tech",
    title: "AI Call Auditing",
    metric: "5% → 100%",
    desc: "Their best manager could only sample 5% of sales calls. We encoded her 8-criteria rubric into an agent that grades 100% and routes risk to leadership within the hour.",
    readiness: "4/4 Agent-Ready",
    color: "bg-[color:var(--color-paper-sunk)]",
    metricBox: "bg-paper border border-[color:var(--color-hairline)] text-black"
  },
  {
    id: "02",
    client: "Marketing Coach",
    industry: "Agency Operations",
    title: "Lead Magnet System",
    metric: "15 min · idea to launched",
    desc: "Every lead magnet took days of manual work across disconnected tools. One idea in ClickUp now generates the full package: landing page, email, smart link, scheduled post.",
    readiness: "4/4 Agent-Ready",
    color: "bg-[color:var(--color-paper-sunk)]",
    metricBox: "bg-paper border border-[color:var(--color-hairline)] text-black"
  },
  {
    id: "03",
    client: "ProSWPPP",
    industry: "Compliance · 50 states",
    title: "SWPPP Automation",
    metric: "Multi-FTE → same-day",
    desc: "Every permit needed hours of manual environmental research across 50 states. Intake to delivered documents now runs end-to-end, no researcher in the loop.",
    readiness: "4/4 Agent-Ready",
    color: "bg-[color:var(--color-paper-sunk)]",
    metricBox: "bg-paper border border-[color:var(--color-hairline)] text-black"
  }
];

const CaseStudies: React.FC = () => {
  return (
    <section id="cases" className="py-20 bg-paper border-t" style={{ borderColor: 'rgba(26,26,26,0.1)' }}>
      <div className="container mx-auto px-6">
        <motion.h2
          initial={{ opacity: 0, y: 22, filter: 'blur(8px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.9 }}
          className="text-center mb-6"
          style={{ fontFamily: '"DM Serif Display", "Bodoni Moda", Georgia, serif', fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(3rem, 7vw, 6rem)', lineHeight: 1.04, letterSpacing: '-0.02em', color: '#1A1A1A' }}
        >
          Results.
        </motion.h2>

        {/* ICP badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="flex justify-center mb-8"
        >
          <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.45)' }}>
            Agencies · Consultancies · Law &amp; Accounting firms
          </span>
        </motion.div>

        {/* Featured eat-your-own-cooking case study */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 }}
          className="flex justify-center mb-16"
        >
          <Link
            to="/case-studies/own-content-engine"
            className="group inline-flex items-center gap-3 font-mono text-xs uppercase tracking-[0.14em] text-ink-soft hover:text-black transition-colors border-b border-[color:var(--color-hairline-bold)] hover:border-black pb-1"
          >
            <span>See the engine that runs this site</span>
            <span className="font-drama italic font-normal text-base normal-case tracking-normal lowercase text-accent group-hover:text-black transition-colors">live numbers →</span>
          </Link>
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
              <div className={`h-48 ${study.color} border-b border-[color:var(--color-hairline)] flex items-center justify-center relative overflow-hidden`}>
                <div className={`relative z-10 font-semibold text-3xl ${study.metricBox} px-4 py-2 text-center`}>
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
                <div className="flex items-center gap-2 pt-4 border-t border-[color:var(--color-hairline)]">
                  <span className="w-2 h-2 bg-accent"></span>
                  <span className="font-mono text-xs uppercase tracking-widest text-ink-soft">{study.readiness}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* See all work link */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
          className="flex justify-center mt-12"
        >
          <Link
            to="/work"
            className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-ink-soft hover:text-black transition-colors border-b border-[color:var(--color-hairline-bold)] hover:border-black pb-1"
          >
            See all work <ArrowRight size={12} strokeWidth={2} />
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default CaseStudies;