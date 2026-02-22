import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';

const cases = [
  {
    id: "01",
    client: "ProvalTech",
    industry: "Sales Tech",
    title: "AI Call Auditing",
    metric: "100% Audit Rate",
    desc: "AI listens to every sales call, scores performance, and flags coaching opportunities. Went from auditing 5% of calls manually to 100% coverage overnight.",
    color: "bg-accent"
  },
  {
    id: "02",
    client: "ProSWPPP",
    industry: "Construction / Compliance",
    title: "Regulatory Doc Automation",
    metric: "800 Hrs/Yr Saved",
    desc: "AI scans state-specific SWPPP regulatory requirements and auto-generates compliant documentation. Invoicing, document assembly, and filing, all hands-free.",
    color: "bg-pink"
  },
  {
    id: "03",
    client: "MediaScale",
    industry: "Media / Content",
    title: "Content Engine",
    metric: "20x Output",
    desc: "One recorded video becomes 20 social posts, a blog article, and a newsletter. AI handles transcription, repurposing, and scheduling across platforms.",
    color: "bg-green-400"
  }
];

const CaseStudies: React.FC = () => {
  return (
    <section id="cases" className="py-24 bg-white border-t-4 border-black">
      <div className="container mx-auto px-6">
        <motion.h2
          initial={{ y: 50, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          className="text-6xl md:text-7xl font-black mb-6 uppercase text-center text-outline font-drama italic"
        >
          Results
        </motion.h2>

        {/* Upwork 100% JSS Badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="flex justify-center mb-16"
        >
          <a
            href="https://www.upwork.com/freelancers/~01ce6d9c9060674d84"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2 bg-black text-white font-mono text-sm uppercase tracking-widest border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,230,118,1)] hover:-translate-y-0.5 transition-transform"
          >
            <ShieldCheck size={16} className="text-accent" />
            <span>100% Job Success</span>
            <span className="text-accent font-black">|</span>
            <span className="text-zinc-400">Upwork Verified</span>
          </a>
        </motion.div>

        <div className="flex flex-col lg:flex-row gap-8">
          {cases.map((study, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.2, type: "spring", bounce: 0.4 }}
              className="flex-1 border-4 border-black shadow-comic bg-white group hover-lift hover:shadow-comic-hover transition-all"
            >
              {/* Metric Area */}
              <div className={`h-48 ${study.color} border-b-4 border-black flex items-center justify-center relative overflow-hidden`}>
                <span className="text-9xl font-black opacity-20 text-black absolute -bottom-10 -right-10 select-none transition-transform group-hover:scale-110">{study.id}</span>
                <div className="relative z-10 font-black text-4xl bg-white border-2 border-black px-4 py-2 shadow-comic transform -rotate-3 group-hover:rotate-0 transition-transform text-center">
                  {study.metric}
                </div>
              </div>

              {/* Content */}
              <div className="p-8">
                <div className="flex justify-between items-start mb-4">
                  <span className="font-bold uppercase text-xs tracking-widest bg-black text-white px-2 py-1">{study.client}</span>
                  <span className="text-xs font-mono uppercase text-gray-400 tracking-wide">{study.industry}</span>
                </div>
                <h3 className="text-3xl font-black uppercase mb-2">{study.title}</h3>
                <p className="text-lg font-bold border-l-4 border-black pl-4 leading-relaxed">{study.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CaseStudies;