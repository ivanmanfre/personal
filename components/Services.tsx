import React from 'react';
import { motion } from 'framer-motion';
import TelemetryTypewriter from './ui/TelemetryTypewriter';
import AutomationCursorFlow from './ui/AutomationCursorFlow';

const Services: React.FC = () => {
  return (
    <section id="services" className="py-32 border-t border-zinc-200 bg-white overflow-hidden">
      <div className="container mx-auto px-6 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="mb-24 flex flex-col md:flex-row items-end gap-6 justify-between border-b border-zinc-200 pb-8"
        >
          <div>
            <span className="inline-block text-[11px] uppercase tracking-[0.14em] font-medium text-ink-soft border border-[color:var(--color-hairline-bold)] rounded px-2 py-1 mb-4">What I Build</span>
            <h3 className="text-5xl md:text-6xl font-bold leading-[0.9] tracking-tight">Systems that handle <br /> <span className="font-drama italic">the thinking work.</span></h3>
          </div>
          <p className="text-lg md:text-xl font-medium max-w-sm text-left md:text-right text-zinc-600 leading-relaxed border-l md:border-l-0 md:border-r border-accent pl-4 md:pl-0 md:pr-6">
            I don't bill hourly. Every engagement is a productized project or a flat-rate retainer tied to outcomes.
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
                <h4 className="text-3xl font-semibold tracking-tight">Back-office automation</h4>
              </div>
              <p className="text-xl font-medium text-zinc-600 mb-6 leading-relaxed">
                The manual handoffs between your CRM, Slack, docs, and AI tools get replaced with systems that do the work. Your team stops copy-pasting. The data moves itself.
              </p>
              <ul className="space-y-3 text-sm font-medium text-zinc-500">
                <li className="flex gap-2 items-center"><div className="w-1.5 h-1.5 bg-accent"></div> Connect your existing tools without another platform</li>
                <li className="flex gap-2 items-center"><div className="w-1.5 h-1.5 bg-accent"></div> Client onboarding that doesn't need a human</li>
                <li className="flex gap-2 items-center"><div className="w-1.5 h-1.5 bg-accent"></div> Right AI model picked per task, not defaulted</li>
              </ul>
            </motion.div>
            <div className="w-full lg:w-1/2 relative hover-lift group cursor-default">
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
                <h4 className="text-3xl font-semibold tracking-tight">AI for judgment-heavy work</h4>
              </div>
              <p className="text-xl font-medium text-zinc-600 mb-6 leading-relaxed">
                Lead qualification. Tier-1 support. Document parsing. The judgment-heavy work your best person can't scale. I build the agent and get your ops ready to run it - skipping that second half is why most AI projects stall.
              </p>
              <ul className="space-y-3 text-sm font-medium text-zinc-500">
                <li className="flex gap-2 items-center"><div className="w-1.5 h-1.5 bg-accent"></div> Trained on your SOPs and company data</li>
                <li className="flex gap-2 items-center"><div className="w-1.5 h-1.5 bg-accent"></div> Reads and extracts from any document format</li>
                <li className="flex gap-2 items-center"><div className="w-1.5 h-1.5 bg-accent"></div> Human-in-the-loop by design, not by accident</li>
              </ul>
            </motion.div>
            <div className="w-full lg:w-1/2 relative hover-lift group cursor-default">
              <TelemetryTypewriter />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default Services;