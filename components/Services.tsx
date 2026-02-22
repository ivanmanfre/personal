import React from 'react';
import { motion } from 'framer-motion';
import TelemetryTypewriter from './ui/TelemetryTypewriter';
import AutomationCursorFlow from './ui/AutomationCursorFlow';

const Services: React.FC = () => {
  return (
    <section id="services" className="py-32 border-t-4 border-black bg-white overflow-hidden">
      <div className="container mx-auto px-6 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="mb-24 flex flex-col md:flex-row items-end gap-6 justify-between border-b-4 border-black pb-8"
        >
          <div>
            <h2 className="text-xl font-bold bg-black text-white inline-block px-3 py-1 mb-2 uppercase transform -rotate-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]">Core Architectures</h2>
            <h3 className="text-5xl md:text-6xl font-black uppercase leading-[0.9] tracking-tighter">Systems That Run <br /> <span className="font-drama italic">Without You</span></h3>
          </div>
          <p className="text-xl font-bold max-w-sm text-right text-gray-600 leading-relaxed border-r-4 border-accent pr-6">
            I don't sell hours. I build infrastructure that gives you your hours back.
          </p>
        </motion.div>

        <div className="flex flex-col gap-32">

          {/* Artifact 1 */}
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="w-full lg:w-1/2"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="bg-black text-white font-mono font-bold px-2 py-1 text-xs">01</span>
                <h4 className="text-3xl font-black uppercase tracking-tight">AI & API Orchestration</h4>
              </div>
              <p className="text-xl font-medium text-zinc-600 mb-6 leading-relaxed">
                Replacing manual data entry and handoffs with mercilessly efficient API workflows. I connect your entire tech stack (CRMs, Slack, Docs, AI Models) so information flows instantly and accurately, 24/7.
              </p>
              <ul className="space-y-3 font-mono text-sm font-bold text-zinc-500 uppercase">
                <li className="flex gap-2 items-center"><div className="w-1.5 h-1.5 bg-accent"></div> Multi-Platform Syncing</li>
                <li className="flex gap-2 items-center"><div className="w-1.5 h-1.5 bg-accent"></div> Automated Client Onboarding</li>
                <li className="flex gap-2 items-center"><div className="w-1.5 h-1.5 bg-accent"></div> Custom LLM Routing</li>
              </ul>
            </motion.div>
            <div className="w-full lg:w-1/2 relative hover-lift group cursor-crosshair">
              <div className="absolute inset-0 bg-accent translate-x-4 translate-y-4 border-2 border-black transition-transform group-hover:translate-x-6 group-hover:translate-y-6"></div>
              <AutomationCursorFlow />
            </div>
          </div>

          {/* Artifact 2 */}
          <div className="flex flex-col lg:flex-row-reverse items-center gap-12 lg:gap-20">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="w-full lg:w-1/2"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="bg-black text-white font-mono font-bold px-2 py-1 text-xs">02</span>
                <h4 className="text-3xl font-black uppercase tracking-tight">Autonomous Agents</h4>
              </div>
              <p className="text-xl font-medium text-zinc-600 mb-6 leading-relaxed">
                Not generic chatbots. I deploy autonomous agents trained on your exact SOPs and company data to qualify leads, handle tier-1 support, and parse complex documents faster and cheaper than an entire offshore team.
              </p>
              <ul className="space-y-3 font-mono text-sm font-bold text-zinc-500 uppercase">
                <li className="flex gap-2 items-center"><div className="w-1.5 h-1.5 bg-black"></div> RAG Knowledge Bases</li>
                <li className="flex gap-2 items-center"><div className="w-1.5 h-1.5 bg-black"></div> Semantic Data Extraction</li>
                <li className="flex gap-2 items-center"><div className="w-1.5 h-1.5 bg-black"></div> Voice & Text Interface</li>
              </ul>
            </motion.div>
            <div className="w-full lg:w-1/2 relative hover-lift group cursor-crosshair">
              <div className="absolute inset-0 bg-cyan translate-x-[-1rem] translate-y-4 border-2 border-black transition-transform group-hover:translate-x-[-1.5rem] group-hover:translate-y-6"></div>
              <TelemetryTypewriter />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default Services;