import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Mail } from 'lucide-react';
import { useMetadata } from '../hooks/useMetadata';
import { supabase } from '../lib/supabase';

interface Appearance {
  id: string;
  show_name: string;
  host: string | null;
  episode_title: string | null;
  episode_url: string | null;
  episode_summary: string | null;
  published_at: string | null;
}

const TOPICS = [
  {
    title: 'The four preconditions',
    body:
      'Why most AI deployments fail at the part that isn\'t AI — and the four conditions every successful build has in place before a single prompt is written.',
  },
  {
    title: 'Why headcount stops scaling',
    body:
      'The hidden ceiling growing service businesses hit at 20–80 people, and what changes when ops are encoded instead of staffed.',
  },
  {
    title: 'Productized vs. hourly',
    body:
      'How offer shape determines what you can deliver. Why the firms shipping the most AI work right now don\'t bill hourly.',
  },
  {
    title: 'Eat your own cooking',
    body:
      'How my content engine ships 5 posts a week with 30 minutes of weekly review — applied case study of the methodology to itself.',
  },
  {
    title: 'When NOT to deploy AI',
    body:
      'The cases where the right answer is "fix the foundation first." Most useful conversation a founder can have before writing a check.',
  },
];

const PRE_WRITTEN_INTRO = `Iván Manfredi builds AI systems for growing service businesses. He created the Agent-Ready Ops methodology — the four conditions every AI deployment needs before it ships — and shows up to talk about why most AI projects fail at the part that isn't AI. Based in Argentina, working with founders across the US, EU, and UK.`;

const PodcastPage: React.FC = () => {
  useMetadata({
    title: 'Podcast & speaking | Iván Manfredi',
    description:
      'Available for podcasts on AI systems, growing service businesses, and the Agent-Ready Ops methodology.',
    canonical: 'https://ivanmanfredi.com/podcast',
  });

  const [appearances, setAppearances] = useState<Appearance[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('podcast_appearances')
        .select('id, show_name, host, episode_title, episode_url, episode_summary, published_at')
        .eq('is_published', true)
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(12);
      if (!cancelled && !error) setAppearances((data as Appearance[]) ?? []);
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
            className="mb-6"
          >
            <span className="inline-block text-xs uppercase tracking-[0.1em] font-medium text-ink-soft border border-[color:var(--color-hairline-bold)] rounded px-2 py-1">
              Podcast & speaking
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="text-4xl md:text-5xl lg:text-6xl font-semibold leading-[1.05] tracking-tighter mb-6"
          >
            Available for <span className="font-drama italic font-normal">conversations</span> about AI systems and growing service businesses.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-ink-soft leading-relaxed mb-12 max-w-2xl"
          >
            If you run a podcast, write a newsletter, or host an event for founders or operators in growing service businesses, here's what I can talk about and how to book.
          </motion.p>

          {/* Topic menu */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute mb-8">
              Topics
            </p>
            <div className="space-y-8">
              {TOPICS.map((t, i) => (
                <div
                  key={t.title}
                  className="flex gap-6 border-l border-[color:var(--color-hairline-bold)] pl-5"
                >
                  <span className="font-mono text-xs text-ink-mute mt-1.5 shrink-0 w-6 tabular-nums">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3 className="text-2xl md:text-3xl font-semibold tracking-tight leading-tight mb-2">
                      <span className="font-drama italic font-normal">{t.title}</span>
                    </h3>
                    <p className="text-lg text-ink-soft leading-relaxed">{t.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.section>

          {/* Pre-written intro for hosts to lift */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-paper-sunk border border-[color:var(--color-hairline)] p-8 md:p-10 mb-16"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute mb-3">
              Intro paragraph (lift verbatim)
            </p>
            <p className="text-lg text-ink-soft leading-relaxed">
              {PRE_WRITTEN_INTRO}
            </p>
          </motion.section>

          {/* Recent appearances — auto-populates */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight mb-8">
              <span className="font-drama italic font-normal">Recent</span> appearances
            </h2>

            {appearances === null ? (
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-mute">
                Loading…
              </p>
            ) : appearances.length === 0 ? (
              <p className="text-ink-soft leading-relaxed border-l border-[color:var(--color-hairline-bold)] pl-5">
                None yet — this section grows as episodes ship.
              </p>
            ) : (
              <div className="space-y-6">
                {appearances.map((ap) => (
                  <a
                    key={ap.id}
                    href={ap.episode_url ?? '#'}
                    target={ap.episode_url ? '_blank' : undefined}
                    rel={ap.episode_url ? 'noopener noreferrer' : undefined}
                    className="block group border-l border-[color:var(--color-hairline-bold)] hover:border-accent transition-colors pl-5 py-2"
                  >
                    <div className="flex items-baseline justify-between gap-3 mb-1.5">
                      <span className="font-mono text-xs uppercase tracking-[0.16em] text-ink-soft group-hover:text-accent transition-colors">
                        {ap.show_name}
                        {ap.host ? <span className="text-ink-mute"> · {ap.host}</span> : null}
                      </span>
                      {ap.published_at && (
                        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute shrink-0">
                          {new Date(ap.published_at).toLocaleDateString('en-US', {
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      )}
                    </div>
                    {ap.episode_title && (
                      <p className="text-lg font-semibold tracking-tight mb-1">
                        {ap.episode_title}
                      </p>
                    )}
                    {ap.episode_summary && (
                      <p className="text-ink-soft leading-relaxed">{ap.episode_summary}</p>
                    )}
                  </a>
                ))}
              </div>
            )}
          </motion.section>

          {/* Booking CTA */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-black text-white p-10 md:p-14 text-center"
          >
            <h3 className="text-2xl md:text-3xl font-semibold mb-3 tracking-tight">
              Pitch a show
            </h3>
            <p className="text-zinc-400 mb-8 max-w-xl mx-auto leading-relaxed">
              Send a one-paragraph pitch with show name, audience, and which topic from above lines up. I read everything.
            </p>
            <a
              href="mailto:hello@ivanmanfredi.com?subject=Podcast%20pitch"
              className="btn-magnetic inline-flex items-center gap-3 px-10 py-5 bg-accent text-white font-semibold text-lg tracking-wide border-subtle-thick shadow-card-subtle"
            >
              <Mail size={18} aria-hidden="true" />
              hello@ivanmanfredi.com
            </a>
            <p className="mt-6 text-sm text-zinc-400">
              Or <Link to="/start" className="underline underline-offset-4 text-zinc-200 hover:text-white">book a 30-min call</Link> if it's easier.
            </p>
          </motion.section>

          {/* Cross-link to scorecard */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-12 text-center"
          >
            <p className="text-ink-soft leading-relaxed mb-3">
              Want a sense of the methodology before reaching out?
            </p>
            <Link
              to="/scorecard"
              className="inline-flex items-center gap-2 font-semibold text-ink hover:text-accent transition-colors underline-offset-4 underline decoration-accent"
            >
              Take the 60-second Scorecard <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </motion.div>
        </div>
      </article>
    </div>
  );
};

export default PodcastPage;
