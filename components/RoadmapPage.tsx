import React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { useMetadata } from '../hooks/useMetadata';
import { roadmapBySlug } from '../lib/roadmaps';

const RoadmapPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const roadmap = slug ? roadmapBySlug(slug) : undefined;

  useMetadata({
    title: roadmap
      ? `${roadmap.title} | Manfredi`
      : 'Roadmap not found | Manfredi',
    description: roadmap?.subtitle ?? 'Agent-Ready Ops 30-day roadmap.',
    canonical: roadmap
      ? `https://ivanmanfredi.com/scorecard/roadmap/${roadmap.slug}`
      : 'https://ivanmanfredi.com/scorecard',
  });

  if (!roadmap) {
    return <Navigate to="/scorecard" replace />;
  }

  return (
    <div className="min-h-screen bg-paper">
      <article className="pt-32 pb-24 px-6">
        <div className="container mx-auto max-w-3xl">
          {/* Back link */}
          <Link
            to="/scorecard"
            className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-ink-mute hover:text-black transition-colors mb-10"
          >
            <ArrowLeft size={14} aria-hidden="true" /> Back to the Scorecard
          </Link>

          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-6"
          >
            <span className="inline-block text-xs uppercase tracking-[0.1em] font-medium text-ink-soft border border-[color:var(--color-hairline-bold)] rounded px-2 py-1">
              Agent-Ready Roadmap
            </span>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="text-4xl md:text-5xl lg:text-6xl font-semibold leading-[1.05] tracking-tighter mb-4"
          >
            {roadmap.title.split(' to ')[0]} to{' '}
            <span className="font-drama italic font-normal">
              {roadmap.title.split(' to ')[1]}
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-ink-soft leading-relaxed mb-12 max-w-2xl"
          >
            {roadmap.subtitle}
          </motion.p>

          {/* Intro */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-paper-sunk border border-[color:var(--color-hairline)] p-8 md:p-10 mb-16"
          >
            <p className="text-lg text-ink-soft leading-relaxed">
              {roadmap.intro}
            </p>
          </motion.div>

          {/* Weeks */}
          <div className="space-y-12 mb-16">
            {roadmap.weeks.map((week) => (
              <motion.section
                key={week.number}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px 0px' }}
                className="border-l-2 border-accent pl-6 md:pl-8"
              >
                <div className="flex items-baseline gap-4 mb-4">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
                    Week {String(week.number).padStart(2, '0')}
                  </span>
                </div>
                <h2 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight mb-6">
                  <span className="font-drama italic font-normal">{week.title}</span>
                </h2>
                <ol className="space-y-4">
                  {week.steps.map((step, i) => (
                    <li
                      key={i}
                      className="flex gap-4 text-lg text-ink-soft leading-relaxed"
                    >
                      <span className="font-mono text-xs text-ink-mute pt-1.5 shrink-0 w-8 tabular-nums">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </motion.section>
            ))}
          </div>

          {/* How to know it worked */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-paper border border-[color:var(--color-hairline)] p-8 md:p-10 mb-8 shadow-card-subtle"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute mb-4">
              How to know it worked
            </p>
            <p className="text-lg text-ink-soft leading-relaxed">
              {roadmap.howToKnow}
            </p>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-paper border border-[color:var(--color-hairline)] p-8 md:p-10 mb-16"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute mb-4">
              When to come back to me
            </p>
            <p className="text-lg text-ink-soft leading-relaxed">
              {roadmap.whenToReturn}
            </p>
          </motion.section>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-black text-white p-10 md:p-14 text-center"
          >
            <h3 className="text-2xl md:text-3xl font-semibold mb-3 tracking-tight">
              Want help mapping this for your operation?
            </h3>
            <p className="text-zinc-400 mb-8 max-w-xl mx-auto leading-relaxed">
              The Agent-Ready Blueprint is one week. You leave with the sequenced plan, costed gaps, and decision logic for the first project. $2,000, 100% credited to any follow-on engagement.
            </p>
            <a
              href="/assessment"
              className="btn-magnetic inline-flex items-center gap-3 px-10 py-5 bg-accent text-white font-semibold text-lg tracking-wide border-subtle-thick shadow-card-subtle"
            >
              Build your Blueprint <ArrowRight aria-hidden="true" size={20} />
            </a>
          </motion.div>
        </div>
      </article>
    </div>
  );
};

export default RoadmapPage;
