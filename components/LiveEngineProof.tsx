import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

// ─── Live-proof band ─────────────────────────────────────────────────────────
// Shows recent real posts from the content engine. The quality of the feed is
// the proof, so there are no "made by AI" labels anywhere. Pulls the latest
// posted rows from scheduled_posts; degrades to static placeholders if Supabase
// returns nothing (offline, RLS, empty table) so the section never crashes or
// renders blank.

const ease = [0.22, 0.84, 0.36, 1] as const;
const LINKEDIN_FEED = 'https://www.linkedin.com/in/iv%C3%A1n-manfredi-120841202/recent-activity/all/';

const prefersReduced =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const MONO: React.CSSProperties = {
  fontFamily: '"IBM Plex Mono", monospace',
  fontSize: '11px',
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  color: '#5A5752',
};

type ProofCard = {
  id: string;
  text: string;
  format: string;
  image: string | null;
};

const FORMAT_LABEL: Record<string, string> = {
  text: 'Post',
  single_image: 'Image post',
  image: 'Image post',
  carousel: 'Carousel',
  video: 'Video',
};

// Static fallback — real shipped posts, so the section is never empty.
const FALLBACK: ProofCard[] = [
  {
    id: 'fb-1',
    text: '"Is this better than what I already have?" That is what I ask before every system goes live. If the answer is no, it does not ship.',
    format: 'text',
    image: null,
  },
  {
    id: 'fb-2',
    text: 'An ops lead forwarded me a quote for an "AI agent" to run their client onboarding last week. Here is what was actually under the hood, and why it would have broken in a month.',
    format: 'text',
    image: null,
  },
  {
    id: 'fb-3',
    text: 'I kept wishing this existed, so I built it for my own agency work, then realized every operator I talk to needs the same thing.',
    format: 'single_image',
    image: 'https://bjbvqvzbzczjbatgmccb.supabase.co/storage/v1/object/public/lm-og/claude-agency-ops-square-clean.jpg',
  },
  {
    id: 'fb-4',
    text: '"No one is getting AI. It is like 1 percent, and they are just using ChatGPT." A guy who runs environmental field crews told me that, and he is mostly right.',
    format: 'single_image',
    image: 'https://bjbvqvzbzczjbatgmccb.supabase.co/storage/v1/object/public/post-stills/library/IMG_4492.jpg',
  },
];

const cleanText = (raw: string): string => {
  // Strip surrounding quotes-only artifacts and collapse whitespace for the
  // card preview; the full post lives on LinkedIn.
  return raw.replace(/\s+/g, ' ').trim();
};

const LiveEngineProof: React.FC = () => {
  const [cards, setCards] = useState<ProofCard[]>(FALLBACK);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('scheduled_posts')
          .select('id, post_text, post_format, media_urls, posted_at')
          .eq('status', 'posted')
          .eq('platform', 'linkedin')
          .not('post_text', 'is', null)
          .order('posted_at', { ascending: false })
          .limit(8);

        if (!active) return;
        if (error || !data || data.length === 0) return; // keep fallback

        const mapped: ProofCard[] = data
          .filter((row: any) => row.post_text && row.post_text.trim().length > 30)
          .slice(0, 4)
          .map((row: any) => ({
            id: row.id,
            text: cleanText(row.post_text),
            format: row.post_format || 'text',
            image: Array.isArray(row.media_urls) && row.media_urls.length > 0 ? row.media_urls[0] : null,
          }));

        if (mapped.length >= 3) setCards(mapped);
      } catch {
        // network/RLS failure — keep the static fallback, never crash
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <section className="py-24 md:py-32 border-t" style={{ borderColor: 'rgba(26,26,26,0.1)' }}>
      <div className="container mx-auto px-8 max-w-6xl">
        <motion.div
          {...(prefersReduced ? {} : { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-60px' }, transition: { duration: 0.7, ease } })}
          className="mb-16 max-w-2xl"
        >
          {/* Numbered intro — sharp black mono pill + sage left-rule kicker, matching
              the SectionIntro lockup used across the page for a consistent entry. */}
          <div className="flex items-center gap-4" style={{ marginBottom: '1.5rem' }}>
            <span
              style={{
                fontFamily: '"IBM Plex Mono", monospace',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.16em',
                color: '#F7F4EF',
                backgroundColor: '#1A1A1A',
                padding: '5px 9px',
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              03
            </span>
            <span style={{ ...MONO, paddingLeft: '14px', borderLeft: '2px solid #2A8F65', lineHeight: 1.1 }}>
              LIVE FROM THE FEED
            </span>
          </div>
          <h2
            style={{
              fontFamily: '"DM Serif Display", "Bodoni Moda", Georgia, serif',
              fontWeight: 400,
              fontSize: 'clamp(2rem,3.4vw,3rem)',
              lineHeight: 1.08,
              letterSpacing: '-0.02em',
              color: '#1A1A1A',
            }}
          >
            This feed is the system, working.
          </h2>
          <p style={{ fontFamily: '"Source Serif 4", Georgia, serif', fontSize: '16px', lineHeight: 1.6, color: '#3D3D3B', marginTop: '1.25rem', maxWidth: '44ch' }}>
            Recent posts, on the same engine you'd own. If the writing sounds like a person, that's the point.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-12">
          {cards.slice(0, 3).map((c, i) => (
            <motion.a
              key={c.id}
              href={LINKEDIN_FEED}
              target="_blank"
              rel="noopener noreferrer"
              initial={prefersReduced ? false : { opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.6, ease, delay: (i % 4) * 0.08 }}
              className="group flex flex-col border-t pt-5"
              style={{ borderColor: 'rgba(26,26,26,0.16)' }}
            >
              <div style={{ ...MONO, marginBottom: '14px' }}>{FORMAT_LABEL[c.format] || 'Post'}</div>
              {c.image && (
                <div className="mb-4 overflow-hidden" style={{ aspectRatio: '4 / 3', backgroundColor: 'rgba(26,26,26,0.04)' }}>
                  <img
                    src={c.image}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                </div>
              )}
              <p
                style={{
                  fontFamily: '"Source Serif 4", Georgia, serif',
                  fontSize: '15px',
                  lineHeight: 1.6,
                  color: '#1A1A1A',
                  display: '-webkit-box',
                  WebkitLineClamp: c.image ? 3 : 4,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  flex: 1,
                }}
              >
                {c.text}
              </p>
            </motion.a>
          ))}
        </div>

        <motion.div
          {...(prefersReduced ? {} : { initial: { opacity: 0, y: 16 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-40px' }, transition: { duration: 0.6, ease } })}
          className="mt-12"
        >
          <a
            href={LINKEDIN_FEED}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 transition-colors"
            style={{ fontFamily: '"Source Serif 4", serif', fontWeight: 600, fontSize: '15px', color: 'var(--color-accent-ink)' }}
          >
            See the live feed <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default LiveEngineProof;
