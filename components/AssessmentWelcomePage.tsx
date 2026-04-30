import React from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { useMetadata } from '../hooks/useMetadata';

// Day 2 working session booking (60 min).
const CALENDLY_DAY2_URL = 'https://calendly.com/im-ivanmanfredi/60-minute-meeting';

const timeline = [
  {
    day: 'Day 1',
    title: 'Intake',
    description: 'Check your inbox. I send a structured intake questionnaire - 20-30 questions across the four Agent-Ready preconditions. 30 minutes of focused answering.',
  },
  {
    day: 'Day 2',
    title: 'Working session',
    description: 'A 60-minute video call where I walk through your answers, ask follow-ups, and observe how your current systems actually run. Book the time below.',
  },
  {
    day: 'Day 3-6',
    title: 'Analysis',
    description: 'I produce your evaluation, your 90-Day AI Rollout Plan, and specific recommendations. You get time back.',
  },
  {
    day: 'Day 7',
    title: 'Presentation',
    description: 'Final 60-minute call. I deliver the findings and recommend the path forward - Fractional, productized project, or wait-and-build.',
  },
];

const AssessmentWelcomePage: React.FC = () => {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id');
  const intakeDone = params.get('intake') === 'done';
  const intakeHref = sessionId ? `/assessment/intake?session_id=${encodeURIComponent(sessionId)}` : '/assessment/intake';

  useMetadata({
    title: 'Welcome to the Blueprint | Manfredi',
    description: 'Payment received. Next steps for your Agent-Ready Blueprint.',
    canonical: 'https://ivanmanfredi.com/assessment/welcome',
    noindex: true,
  });

  return (
    <div className="min-h-screen bg-paper">
      <section className="pt-32 pb-24 px-6">
        <div className="container mx-auto max-w-4xl">

          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex items-center gap-2"
          >
            <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.1em] font-medium text-ink-soft border border-[color:var(--color-hairline-bold)] px-2 py-1">
              <Check size={12} strokeWidth={3} className="text-accent-ink" /> Payment received
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl font-semibold leading-[1.05] tracking-tighter mb-6 max-w-3xl"
          >
            You're booked. <br />
            <span className="font-drama italic">Here's what happens next.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-ink-soft max-w-2xl leading-relaxed mb-16"
          >
            Thanks for paying for the Agent-Ready Blueprint. The full $2,500 is credited back toward any follow-on engagement within 60 days. Here are your two next actions.
          </motion.p>

          {/* Two immediate actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid md:grid-cols-2 gap-6 mb-20"
          >
            <div className="bg-paper border border-[color:var(--color-hairline-bold)] p-8">
              <p className="font-mono text-xs uppercase tracking-[0.1em] text-ink-mute mb-3">
                {intakeDone ? '01 · Intake received' : '01 · Fill out the intake'}
              </p>
              <h3 className="text-2xl font-semibold tracking-tight mb-3">
                {intakeDone ? 'Intake complete' : 'Intake questionnaire'}
              </h3>
              <p className="text-ink-soft leading-relaxed mb-6">
                {intakeDone
                  ? 'Thanks. I\'ll review your answers before the Day 2 working session.'
                  : 'Twenty questions across the four preconditions, roughly 25 minutes. Saves as you type — close the tab and come back whenever.'}
              </p>
              {intakeDone ? (
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-ink">
                  <Check size={14} strokeWidth={3} /> Received
                </span>
              ) : (
                <a
                  href={intakeHref}
                  className="inline-flex items-center gap-2 px-5 py-3 bg-accent text-white font-semibold tracking-wide hover:bg-accent-ink hover:text-white transition-colors"
                >
                  Open the intake <ArrowRight aria-hidden="true" size={16} />
                </a>
              )}
            </div>

            <div className="bg-black text-white p-8 border border-[color:var(--color-hairline-bold)]">
              <p className="font-mono text-xs uppercase tracking-[0.1em] text-ink-mute mb-3">02 · Book now</p>
              <h3 className="text-2xl font-semibold tracking-tight mb-3">
                Day 2 working session
              </h3>
              <p className="text-[color:rgba(255,255,255,0.75)] leading-relaxed mb-6">
                Pick a slot in the next 3 business days. I walk through your answers, ask follow-ups, and map your current systems live.
              </p>
              <a
                href={CALENDLY_DAY2_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 px-5 py-3 bg-accent text-white font-semibold tracking-wide hover:bg-paper transition-colors"
              >
                Book the session <ArrowRight aria-hidden="true" size={16} />
              </a>
            </div>
          </motion.div>

          {/* Full timeline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-20"
          >
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-10">
              The 7-day flow
            </h2>
            <div className="space-y-8">
              {timeline.map((step) => (
                <div key={step.day} className="flex flex-col md:flex-row gap-6 md:gap-10 border-t border-[color:var(--color-hairline)] pt-8">
                  <div className="md:w-32 shrink-0">
                    <p className="font-mono text-xs uppercase tracking-[0.1em] text-ink-mute mb-1">{step.day}</p>
                    <h3 className="text-lg font-semibold tracking-tight">{step.title}</h3>
                  </div>
                  <p className="text-lg text-ink-soft leading-relaxed flex-1">{step.description}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Credit reminder */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-paper-sunk border border-[color:var(--color-hairline)] p-8 md:p-10 mb-16"
          >
            <p className="font-mono text-xs uppercase tracking-[0.1em] text-ink-mute mb-3">The credit clause</p>
            <p className="text-lg text-ink-soft leading-relaxed">
              The full $2,500 is credited 100% toward any follow-on engagement - Lead Magnet System, Fractional AI Partner, or custom build - within 60 days of your Day 7 presentation. If the recommendation is to wait and fix the foundation first, that recommendation is the deliverable.
            </p>
          </motion.div>

          {sessionId && (
            <p className="font-mono text-xs uppercase tracking-[0.1em] text-ink-mute">
              Receipt ref · {sessionId.slice(0, 16)}…
            </p>
          )}

        </div>
      </section>
    </div>
  );
};

export default AssessmentWelcomePage;
