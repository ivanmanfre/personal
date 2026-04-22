import React from 'react';
import { motion } from 'framer-motion';
import TelemetryTypewriter from './ui/TelemetryTypewriter';
import AutomationCursorFlow from './ui/AutomationCursorFlow';
import VoiceAnnotationArtifact from './ui/VoiceAnnotationArtifact';

const Services: React.FC = () => {
  return (
    <section id="services" className="py-32 border-t border-zinc-200 bg-paper overflow-hidden">
      <div className="container mx-auto px-6 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="mb-24 flex flex-col md:flex-row items-end gap-6 justify-between border-b border-zinc-200 pb-8"
        >
          <div>
            <span className="inline-block text-xs uppercase tracking-[0.1em] font-medium text-ink-soft border border-[color:var(--color-hairline-bold)] rounded px-2 py-1 mb-4">What I Build</span>
            <h2 className="text-5xl md:text-6xl font-bold leading-[0.9] tracking-tight">Systems that handle <br /> <span className="font-drama italic">the thinking work.</span></h2>
          </div>
          <p className="text-lg md:text-xl font-medium max-w-sm text-left md:text-right text-ink-soft leading-relaxed border-l md:border-l-0 md:border-r border-accent pl-4 md:pl-0 md:pr-6">
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
                <span className="font-mono text-xs uppercase tracking-[0.1em] text-ink-soft border border-[color:var(--color-hairline-bold)] px-2 py-1">01</span>
                <h3 className="text-3xl font-semibold tracking-tight">Back-office <span className="font-drama italic font-normal">that runs itself.</span></h3>
              </div>
              <p className="text-xl font-medium text-ink-soft mb-6 leading-relaxed">
                Your ops lead writes the same four onboarding emails every week, pulls the same reports, chases the same stuck handoffs. A month from now, the system does it, personalized from intake data, routed through your existing CRM and Slack, flagged to her only when something's off.
              </p>
              <ul className="space-y-3 text-sm font-medium text-ink-mute">
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
                <span className="font-mono text-xs uppercase tracking-[0.1em] text-ink-soft border border-[color:var(--color-hairline-bold)] px-2 py-1">02</span>
                <h3 className="text-3xl font-semibold tracking-tight">AI for <span className="font-drama italic font-normal">judgment-heavy work.</span></h3>
              </div>
              <p className="text-xl font-medium text-ink-soft mb-6 leading-relaxed">
                Lead qualification, tier-1 support, document parsing, the work your best person does that creates the bottleneck. I encode how they decide, wire it to the data it needs, and keep them in the loop for the edge cases. The second half is why most AI projects stall.
              </p>
              <ul className="space-y-3 text-sm font-medium text-ink-mute">
                <li className="flex gap-2 items-center"><div className="w-1.5 h-1.5 bg-accent"></div> Trained on your SOPs and company data</li>
                <li className="flex gap-2 items-center"><div className="w-1.5 h-1.5 bg-accent"></div> Reads and extracts from any document format</li>
                <li className="flex gap-2 items-center"><div className="w-1.5 h-1.5 bg-accent"></div> Human-in-the-loop by design, not by accident</li>
              </ul>
            </motion.div>
            <div className="w-full lg:w-1/2 relative hover-lift group cursor-default">
              <TelemetryTypewriter />
            </div>
          </div>

          {/* Artifact 3 */}
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="w-full lg:w-1/2"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="font-mono text-xs uppercase tracking-[0.1em] text-ink-soft border border-[color:var(--color-hairline-bold)] px-2 py-1">03</span>
                <h3 className="text-3xl font-semibold tracking-tight">Content that <span className="font-drama italic font-normal">sounds like you.</span></h3>
              </div>
              <p className="text-xl font-medium text-ink-soft mb-6 leading-relaxed">
                Your founder voice is the moat, but you haven't posted in six weeks because you're heads-down running the business. A month from now the system ships your voice weekly: 5-7 drafts land in your review queue every Sunday, topics pre-scored, formats rotated so you stop shipping four text posts in a row by accident. You edit the 5% that matters.
              </p>
              <ul className="space-y-3 text-sm font-medium text-ink-mute">
                <li className="flex gap-2 items-center"><div className="w-1.5 h-1.5 bg-accent"></div> Trained on your last 50 posts so drafts sound like you</li>
                <li className="flex gap-2 items-center"><div className="w-1.5 h-1.5 bg-accent"></div> Multi-format rotation, text, carousels, image prompts, hooks</li>
                <li className="flex gap-2 items-center"><div className="w-1.5 h-1.5 bg-accent"></div> Top performers auto-identified and repurposed</li>
              </ul>
            </motion.div>
            <div className="w-full lg:w-1/2 relative hover-lift group cursor-default">
              <VoiceAnnotationArtifact />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default Services;