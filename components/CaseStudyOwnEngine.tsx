import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, AlertTriangle } from 'lucide-react';
import { useMetadata } from '../hooks/useMetadata';
import { fetchOwnEngineMetrics, OwnEngineMetrics } from '../lib/ownEngineMetrics';
import LiveMetricCounter from './case-studies/LiveMetricCounter';

const CaseStudyOwnEngine: React.FC = () => {
  useMetadata({
    title: 'How this site\'s content engine ships 5+ posts a week | Manfredi',
    description:
      'A live case study of the Agent-Ready Ops methodology applied to its own content engine. Real metrics, honest tradeoffs.',
    canonical: 'https://ivanmanfredi.com/case-studies/own-content-engine',
  });

  const [metrics, setMetrics] = useState<OwnEngineMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchOwnEngineMetrics();
        if (!cancelled) setMetrics(data);
      } catch (err) {
        console.error('public_engine_metrics failed', err);
        if (!cancelled) setError('Could not load live metrics');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-paper">
      <article className="pt-32 pb-24 px-6">
        <div className="container mx-auto max-w-3xl">
          <Link
            to="/"
            className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-ink-mute hover:text-black transition-colors mb-10"
          >
            <ArrowLeft size={14} aria-hidden="true" /> Back home
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-6"
          >
            <span className="inline-block text-xs uppercase tracking-[0.1em] font-medium text-ink-soft border border-[color:var(--color-hairline-bold)] rounded px-2 py-1">
              Case Study · 01
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="text-4xl md:text-5xl lg:text-6xl font-semibold leading-[1.05] tracking-tighter mb-6"
          >
            How this site's <span className="font-drama italic font-normal">content engine</span> ships five posts a week.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-ink-soft leading-relaxed mb-12 max-w-2xl"
          >
            The Agent-Ready Ops methodology applied to a working content engine. Real numbers, pulled live. The numbers below update on every page load.
          </motion.p>

          {/* Live metric strip */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-paper border border-[color:var(--color-hairline)] p-8 md:p-10 mb-16"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute mb-8">
              Live · pulled from production
            </p>
            {metrics ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                <LiveMetricCounter
                  value={metrics.posts_shipped_quarter}
                  label="Posts shipped this quarter"
                />
                <LiveMetricCounter
                  value={metrics.posts_in_queue}
                  label="Posts in queue"
                />
                <LiveMetricCounter
                  value={metrics.active_workflows}
                  label="Workflows running"
                />
                <LiveMetricCounter
                  value={metrics.avg_days_queue_to_live ?? 0}
                  label="Avg days idea → live"
                  decimals={1}
                />
              </div>
            ) : error ? (
              <p className="text-ink-mute">{error}</p>
            ) : (
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-mute">
                Loading…
              </p>
            )}
          </motion.section>

          {/* The system */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight mb-6">
              <span className="font-drama italic font-normal">The system,</span> in one paragraph
            </h2>
            <div className="space-y-5 text-lg text-ink-soft leading-relaxed">
              <p>
                The pipeline starts in ClickUp where I drop topic ideas. An n8n workflow runs every morning, picks an unscored idea, generates 5–7 hooks via Claude, scores them against my last 50 posts, picks one, drafts the body, and writes it back to ClickUp tagged for review.
              </p>
              <p>
                I review on Sunday — about 30 minutes of edits across the week's drafts. The 5% I touch is hooks, openings, and the occasional voice drift. Approved drafts move to a queue. Another workflow publishes them on schedule via Unipile, scrapes the post a day later for engagement, and stores it in <code className="font-mono text-sm bg-paper-sunk px-1.5 py-0.5 border border-[color:var(--color-hairline)]">own_posts</code> for the next training pass.
              </p>
              <p>
                The numbers above come from those exact tables. The page you're reading runs the same Supabase that the engine writes to.
              </p>
            </div>
          </motion.section>

          {/* The methodology */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight mb-6">
              The four <span className="font-drama italic font-normal">preconditions,</span> applied to itself
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="border-l border-[color:var(--color-hairline-bold)] pl-5 py-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-soft mb-2">
                  01 · Reliable input pipeline
                </p>
                <p className="text-ink-soft leading-relaxed">
                  Topic ideas live in one ClickUp list with a fixed schema. The scraper pulls my published posts back into <code className="font-mono text-xs">own_posts</code> on a schedule. Same input every run.
                </p>
              </div>
              <div className="border-l border-[color:var(--color-hairline-bold)] pl-5 py-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-soft mb-2">
                  02 · Documentable decision logic
                </p>
                <p className="text-ink-soft leading-relaxed">
                  My voice rubric, banned phrases, and pillar mix all live in ClickUp doc pages, not in a prompt. Editing the doc changes the output.
                </p>
              </div>
              <div className="border-l border-[color:var(--color-hairline-bold)] pl-5 py-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-soft mb-2">
                  03 · Narrow initial scope
                </p>
                <p className="text-ink-soft leading-relaxed">
                  Started with single-format text posts only. Carousels and video came later, in their own scope decisions, after the first format ran for 90 days.
                </p>
              </div>
              <div className="border-l border-[color:var(--color-hairline-bold)] pl-5 py-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-soft mb-2">
                  04 · Human-in-the-loop by design
                </p>
                <p className="text-ink-soft leading-relaxed">
                  Sunday review is the design, not the rescue. Drafts can't ship without it. The 5% I touch each week is the most leveraged 30 minutes I spend.
                </p>
              </div>
            </div>
          </motion.section>

          {/* What's broken right now */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-paper-sunk border border-[color:var(--color-hairline)] p-8 md:p-10 mb-16"
          >
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle size={18} className="text-ink-mute" aria-hidden="true" />
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
                What's broken right now
              </p>
            </div>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight leading-tight mb-6">
              Honest list of what doesn't work yet.
            </h2>
            <ul className="space-y-4 text-ink-soft leading-relaxed">
              <li className="flex gap-3">
                <span className="font-mono text-xs text-ink-mute mt-1.5 shrink-0 w-6">01</span>
                <span>The video pipeline auth-fails on bad credentials about once a week. The fix is migrating to the HTTP Request node from a Code node — known, queued, not yet shipped.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-xs text-ink-mute mt-1.5 shrink-0 w-6">02</span>
                <span>The proposal generator runs out of memory on long client briefs. Splitting into sub-workflows is the answer; haven't done it yet because volume is low.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-xs text-ink-mute mt-1.5 shrink-0 w-6">03</span>
                <span>Carousel format is flaky. The merge node in n8n v3.2 fires in batches when given 3+ inputs and downstream guards weren't built in for one specific path. Fix is small, not yet shipped.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-xs text-ink-mute mt-1.5 shrink-0 w-6">04</span>
                <span>I do not have a real engagement-feedback loop yet. The scraper writes to <code className="font-mono text-sm">own_posts</code> but the ranking layer doesn't reread it for hook scoring. That's the next 30 days.</span>
              </li>
            </ul>
            <p className="text-sm text-ink-mute mt-6 pt-6 border-t border-[color:var(--color-hairline)]">
              Including this list because the case for the methodology is more credible when you can see what's broken, not just what works.
            </p>
          </motion.section>

          {/* Cross-link to scorecard */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16 text-center"
          >
            <p className="text-ink-soft leading-relaxed mb-4">
              Curious where your operation sits against the four preconditions?
            </p>
            <Link
              to="/scorecard"
              className="inline-flex items-center gap-2 font-semibold text-ink hover:text-accent transition-colors underline-offset-4 underline decoration-accent"
            >
              Take the 60-second scorecard <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </motion.section>

          {/* Final CTA */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-black text-white p-10 md:p-14 text-center"
          >
            <h3 className="text-2xl md:text-3xl font-semibold mb-3 tracking-tight">
              Want the same shape, mapped to your operation?
            </h3>
            <p className="text-zinc-400 mb-8 max-w-xl mx-auto leading-relaxed">
              The Agent-Ready Blueprint is one week. You leave with the sequenced plan, costed gaps, and decision logic for the first project. $2,500, 100% credited to any follow-on engagement.
            </p>
            <a
              href="/assessment"
              className="btn-magnetic inline-flex items-center gap-3 px-10 py-5 bg-accent text-white font-semibold text-lg tracking-wide border-subtle-thick shadow-card-subtle"
            >
              Build your Blueprint <ArrowRight aria-hidden="true" size={20} />
            </a>
          </motion.section>
        </div>
      </article>
    </div>
  );
};

export default CaseStudyOwnEngine;
