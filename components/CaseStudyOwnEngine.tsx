import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, ExternalLink } from 'lucide-react';
import { useMetadata } from '../hooks/useMetadata';
import {
  fetchOwnEngineMetrics,
  fetchRecentOwnPosts,
  OwnEngineMetrics,
  RecentOwnPost,
} from '../lib/ownEngineMetrics';
import LiveMetricCounter from './case-studies/LiveMetricCounter';

function excerpt(s: string, max = 220): string {
  const flat = s.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  return flat.slice(0, max).replace(/[\s,;:.\-]+$/, '') + '…';
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86400000);
  if (days < 1) return 'today';
  if (days < 2) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const CaseStudyOwnEngine: React.FC = () => {
  useMetadata({
    title: 'How this site\'s content engine ships 5+ posts a week | Manfredi',
    description:
      'A live case study of the Agent-Ready Ops methodology applied to its own content engine. Real metrics, honest tradeoffs.',
    canonical: 'https://ivanmanfredi.com/case-studies/own-content-engine',
  });

  const [metrics, setMetrics] = useState<OwnEngineMetrics | null>(null);
  const [posts, setPosts] = useState<RecentOwnPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [m, p] = await Promise.all([
          fetchOwnEngineMetrics(),
          fetchRecentOwnPosts(6),
        ]);
        if (!cancelled) {
          setMetrics(m);
          setPosts(p);
        }
      } catch (err) {
        console.error('case study load failed', err);
        if (!cancelled) setError('Could not load live data');
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
            The engine that <span className="font-drama italic font-normal">ships this site.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-ink-soft leading-relaxed mb-12 max-w-2xl"
          >
            Real numbers, pulled live from the same Supabase the engine writes to. Updated on every page load.
          </motion.p>

          {/* Live metric strip */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-paper border border-[color:var(--color-hairline)] p-8 md:p-10 mb-16"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute mb-8">
              Live · this quarter
            </p>
            {metrics ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                <LiveMetricCounter
                  value={metrics.posts_shipped_quarter}
                  label="LinkedIn posts shipped"
                />
                <LiveMetricCounter
                  value={metrics.outreach_messages_quarter}
                  label="Outreach messages sent"
                />
                <LiveMetricCounter
                  value={metrics.lead_magnets_quarter}
                  label="Lead magnets delivered"
                />
                <LiveMetricCounter
                  value={metrics.active_workflows}
                  label="Workflows running"
                />
              </div>
            ) : error ? (
              <p className="text-ink-mute">{error}</p>
            ) : (
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-mute">
                Loading…
              </p>
            )}
            {metrics && (
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute mt-8 pt-6 border-t border-[color:var(--color-hairline)]">
                {metrics.posts_lifetime} posts shipped lifetime · last post {metrics.last_post_at ? timeAgo(metrics.last_post_at) : '—'}
              </p>
            )}
          </motion.section>

          {/* The system — tighter, no wall of text */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight mb-8">
              <span className="font-drama italic font-normal">The system,</span> in four steps.
            </h2>
            <ol className="space-y-5">
              <li className="flex gap-5 border-l border-[color:var(--color-hairline-bold)] pl-5">
                <span className="font-mono text-xs text-ink-mute shrink-0 mt-1.5 w-6">01</span>
                <div>
                  <p className="font-semibold text-ink mb-1">Ideas</p>
                  <p className="text-ink-soft leading-relaxed">
                    Mined automatically from client call transcripts, Slack threads, podcast appearances, and inbound questions. Topic ideas land in ClickUp without me typing them.
                  </p>
                </div>
              </li>
              <li className="flex gap-5 border-l border-[color:var(--color-hairline-bold)] pl-5">
                <span className="font-mono text-xs text-ink-mute shrink-0 mt-1.5 w-6">02</span>
                <div>
                  <p className="font-semibold text-ink mb-1">Drafts</p>
                  <p className="text-ink-soft leading-relaxed">
                    Every morning, an n8n workflow pulls an unscored topic, generates 5–7 hooks via Claude, scores them against my last 50 posts, picks one, drafts the body.
                  </p>
                </div>
              </li>
              <li className="flex gap-5 border-l border-[color:var(--color-hairline-bold)] pl-5">
                <span className="font-mono text-xs text-ink-mute shrink-0 mt-1.5 w-6">03</span>
                <div>
                  <p className="font-semibold text-ink mb-1">Review</p>
                  <p className="text-ink-soft leading-relaxed">
                    30 minutes on Sunday. I touch the 5% that needs voice — hooks, openings, the occasional drift. Approved drafts move to a queue.
                  </p>
                </div>
              </li>
              <li className="flex gap-5 border-l border-[color:var(--color-hairline-bold)] pl-5">
                <span className="font-mono text-xs text-ink-mute shrink-0 mt-1.5 w-6">04</span>
                <div>
                  <p className="font-semibold text-ink mb-1">Ship + learn</p>
                  <p className="text-ink-soft leading-relaxed">
                    Unipile publishes on schedule. A scraper writes engagement back into <code className="font-mono text-sm">own_posts</code> for the next training pass.
                  </p>
                </div>
              </li>
            </ol>
          </motion.section>

          {/* Latest LinkedIn posts gallery */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <div className="flex items-baseline justify-between gap-4 mb-8">
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight">
                <span className="font-drama italic font-normal">What it just shipped.</span>
              </h2>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
                Live
              </span>
            </div>
            {posts && posts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {posts.map((p) => (
                  <a
                    key={p.id}
                    href={p.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col bg-paper border border-[color:var(--color-hairline)] hover:border-accent transition-colors p-6 hover-lift"
                  >
                    <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[color:var(--color-hairline)]">
                      <img
                        src="/ivan-portrait.jpg"
                        alt=""
                        className="w-10 h-10 rounded-full object-cover object-top portrait-editorial shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-xs uppercase tracking-[0.14em] text-ink truncate">
                          Iván Manfredi
                        </p>
                        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
                          {timeAgo(p.posted_at)}
                          {p.post_type === 'image' ? ' · image' : ''}
                        </p>
                      </div>
                      <ExternalLink size={14} className="text-ink-mute group-hover:text-accent transition-colors shrink-0" aria-hidden="true" />
                    </div>
                    <p className="text-ink-soft text-sm leading-relaxed flex-1 mb-4 whitespace-pre-line">
                      {excerpt(p.post_text, 220)}
                    </p>
                    {(p.num_likes > 0 || p.num_comments > 0 || p.num_shares > 0) && (
                      <div className="flex items-center gap-4 pt-3 border-t border-[color:var(--color-hairline)] font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
                        {p.num_likes > 0 && <span>{p.num_likes} ♡</span>}
                        {p.num_comments > 0 && <span>{p.num_comments} 💬</span>}
                        {p.num_shares > 0 && <span>{p.num_shares} ↻</span>}
                      </div>
                    )}
                  </a>
                ))}
              </div>
            ) : posts && posts.length === 0 ? (
              <p className="text-ink-mute">No published posts yet.</p>
            ) : (
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-mute">
                Loading…
              </p>
            )}
          </motion.section>

          {/* The methodology */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight mb-8">
              The four <span className="font-drama italic font-normal">preconditions,</span> applied to itself
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="border-l border-[color:var(--color-hairline-bold)] pl-5 py-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-soft mb-2">
                  01 · Reliable input pipeline
                </p>
                <p className="text-ink-soft leading-relaxed">
                  Topic ideas come from structured sources — call transcripts, scraped posts, ClickUp lists. Same input every run.
                </p>
              </div>
              <div className="border-l border-[color:var(--color-hairline-bold)] pl-5 py-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-soft mb-2">
                  02 · Documentable decision logic
                </p>
                <p className="text-ink-soft leading-relaxed">
                  Voice rubric, banned phrases, pillar mix all live in ClickUp doc pages, not in a prompt. Edit the doc, output changes.
                </p>
              </div>
              <div className="border-l border-[color:var(--color-hairline-bold)] pl-5 py-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-soft mb-2">
                  03 · Narrow initial scope
                </p>
                <p className="text-ink-soft leading-relaxed">
                  Started single-format text only. Carousels and video came later, in their own scope decisions, after the first format ran for 90 days.
                </p>
              </div>
              <div className="border-l border-[color:var(--color-hairline-bold)] pl-5 py-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-soft mb-2">
                  04 · Human-in-the-loop by design
                </p>
                <p className="text-ink-soft leading-relaxed">
                  Sunday review is the design, not the rescue. Drafts can't ship without it.
                </p>
              </div>
            </div>
          </motion.section>

          {/* What's broken — only the honest one */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-paper-sunk border border-[color:var(--color-hairline)] p-8 md:p-10 mb-16"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute mb-3">
              What's not done yet
            </p>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight leading-tight mb-4">
              No real <span className="font-drama italic font-normal">engagement feedback loop.</span>
            </h2>
            <p className="text-ink-soft leading-relaxed">
              The scraper writes engagement back into <code className="font-mono text-sm">own_posts</code>, but the ranking layer doesn't yet reread it for hook scoring. Posts get scored against my last 50 by similarity, not by what actually performed. That's the next 30 days of work.
            </p>
            <p className="text-sm text-ink-mute mt-6 pt-6 border-t border-[color:var(--color-hairline)]">
              Listed because the case for the methodology is more credible when you can see what's still being built.
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
              Take the Agent-Ready Scorecard <ArrowRight size={16} aria-hidden="true" />
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
              The Agent-Ready Blueprint is one week. You leave with the sequenced plan, costed gaps, and decision logic for the first project. $2,000, 100% credited to any follow-on engagement.
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
