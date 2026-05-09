import React from 'react';
import { motion } from 'framer-motion';
import TelemetryTypewriter from './ui/TelemetryTypewriter';
import AutomationCursorFlow from './ui/AutomationCursorFlow';
import VoiceAnnotationArtifact from './ui/VoiceAnnotationArtifact';

const Services: React.FC = () => {
  return (
    <section id="services" className="py-20 border-t bg-paper overflow-hidden" style={{ borderColor: 'rgba(26,26,26,0.1)' }}>
      <div className="container mx-auto px-6 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.85 }}
          className="mb-20 flex flex-col md:flex-row items-end gap-6 justify-between border-b pb-8"
          style={{ borderColor: 'rgba(26,26,26,0.1)' }}
        >
          <div>
            <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.45)', marginBottom: '1.5rem', display: 'inline-block' }}>What I Build</span>
            <h2 style={{ fontFamily: '"DM Serif Display", "Bodoni Moda", Georgia, serif', fontWeight: 400, fontSize: 'clamp(2.4rem, 5vw, 4.5rem)', lineHeight: 1.04, letterSpacing: '-0.02em', color: '#1A1A1A' }}>Systems that handle <br /> <span style={{ fontStyle: 'italic' }}>the thinking work.</span></h2>
          </div>
          <p style={{ fontFamily: '"Source Serif 4", Georgia, serif', fontStyle: 'italic', fontSize: '17px', maxWidth: '24rem', textAlign: 'right', color: 'rgba(26,26,26,0.6)', lineHeight: 1.6, paddingRight: '1.5rem', borderRight: '1px solid var(--color-accent)' }}>
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
              <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute mb-3">
                Productized build · 4–8 weeks
              </span>
              <div className="flex items-center gap-3 mb-4">
                <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-mute">01</span>
                <h3 style={{ fontFamily: '"DM Serif Display", "Bodoni Moda", Georgia, serif', fontWeight: 400, fontSize: 'clamp(1.8rem, 2.5vw, 2.4rem)', lineHeight: 1.1, letterSpacing: '-0.02em', color: '#1A1A1A' }}>Back-office <span className="italic">that runs itself.</span></h3>
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
              <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute mb-3">
                Custom build or Fractional · Ongoing fit
              </span>
              <div className="flex items-center gap-3 mb-4">
                <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-mute">02</span>
                <h3 style={{ fontFamily: '"DM Serif Display", "Bodoni Moda", Georgia, serif', fontWeight: 400, fontSize: 'clamp(1.8rem, 2.5vw, 2.4rem)', lineHeight: 1.1, letterSpacing: '-0.02em', color: '#1A1A1A' }}>AI for <span className="italic">judgment-heavy work.</span></h3>
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
              <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute mb-3">
                Content Engine · 3-week ship
              </span>
              <div className="flex items-center gap-3 mb-4">
                <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-mute">03</span>
                <h3 style={{ fontFamily: '"DM Serif Display", "Bodoni Moda", Georgia, serif', fontWeight: 400, fontSize: 'clamp(1.8rem, 2.5vw, 2.4rem)', lineHeight: 1.1, letterSpacing: '-0.02em', color: '#1A1A1A' }}>Content that <span className="italic">sounds like you.</span></h3>
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