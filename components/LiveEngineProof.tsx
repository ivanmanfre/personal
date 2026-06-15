import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ThumbsUp, MessageSquare, Repeat2, Send, Globe } from 'lucide-react';
import { supabase } from '../lib/supabase';

// ─── Live-proof band — content SAMPLES, shown the way they ship ──────────────
// Not a wall of text linking to a profile. Three real outputs of the engine,
// shown visually: a LinkedIn post rendered as it appears in-feed (text pulled
// live from the latest posted row, so it's genuinely current), a carousel, and
// a lead magnet. The quality of the work is the proof — no "made by AI" labels.

const ease = [0.22, 0.84, 0.36, 1] as const;

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
// Authentic LinkedIn chrome reads in a neutral system sans (it's a faithful
// preview of the platform, not a brand surface — see ascension-audit arbitration).
const LI_SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

const reveal = prefersReduced
  ? {}
  : { initial: { opacity: 0, y: 20 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-60px' }, transition: { duration: 0.7, ease } };

// Static fallback post — a real shipped post, so the preview is never empty.
const FALLBACK_POST =
  'An ops lead forwarded me a quote for an "AI agent" to run their client onboarding last week. Here is what was actually under the hood, and why it would have broken in a month.';

// ─── A faithful LinkedIn post preview ────────────────────────────────────────
const LinkedInPost: React.FC<{ text: string; image: string | null }> = ({ text, image }) => (
  <div
    style={{
      fontFamily: LI_SANS,
      backgroundColor: '#fff',
      borderRadius: '10px',
      border: '1px solid rgba(0,0,0,0.10)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      overflow: 'hidden',
    }}
  >
    <div style={{ padding: '16px 16px 0' }}>
      {/* author row */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <img src="/ivan-portrait-400.webp" alt="" style={{ width: '48px', height: '48px', borderRadius: '9999px', objectFit: 'cover', flexShrink: 0 }} />
        <div style={{ lineHeight: 1.25, minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'rgba(0,0,0,0.9)' }}>
            Iván Manfredi <span style={{ fontWeight: 400, color: 'rgba(0,0,0,0.55)' }}>· 1st</span>
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.6)' }}>AI content systems for agencies</div>
          <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            2h · <Globe size={12} aria-hidden />
          </div>
        </div>
      </div>
      {/* body */}
      <p
        style={{
          fontSize: '14px',
          lineHeight: 1.45,
          color: 'rgba(0,0,0,0.9)',
          margin: '12px 0 14px',
          display: '-webkit-box',
          WebkitLineClamp: image ? 4 : 8,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {text}
      </p>
    </div>
    {image && (
      <div style={{ width: '100%', aspectRatio: '1.91 / 1', backgroundColor: '#f3f2ef', overflow: 'hidden' }}>
        <img src={image} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    )}
    {/* reaction + action chrome */}
    <div style={{ padding: '8px 16px 4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingBottom: '8px', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <span style={{ display: 'inline-flex' }}>
          <span style={{ width: '18px', height: '18px', borderRadius: '9999px', background: '#378fe9', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <ThumbsUp size={10} color="#fff" fill="#fff" />
          </span>
          <span style={{ width: '18px', height: '18px', borderRadius: '9999px', background: '#df704d', marginLeft: '-5px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>❤</span>
          <span style={{ width: '18px', height: '18px', borderRadius: '9999px', background: '#f5bb5c', marginLeft: '-5px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px' }}>💡</span>
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0 8px' }}>
        {[
          { Icon: ThumbsUp, label: 'Like' },
          { Icon: MessageSquare, label: 'Comment' },
          { Icon: Repeat2, label: 'Repost' },
          { Icon: Send, label: 'Send' },
        ].map(({ Icon, label }) => (
          <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'rgba(0,0,0,0.6)' }}>
            <Icon size={16} aria-hidden /> {label}
          </span>
        ))}
      </div>
    </div>
  </div>
);

// ─── A framed sample (carousel / lead magnet) ────────────────────────────────
const SampleFrame: React.FC<{ label: string; src: string; alt: string; ratio?: string }> = ({ label, src, alt, ratio = '4 / 3' }) => (
  <div className="flex flex-col">
    <div style={{ ...MONO, marginBottom: '12px' }}>{label}</div>
    <div
      className="overflow-hidden border"
      style={{ borderColor: 'rgba(26,26,26,0.14)', aspectRatio: ratio, backgroundColor: 'var(--color-paper-raise)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
    >
      <img src={src} alt={alt} loading="lazy" className="w-full h-full object-cover object-top" />
    </div>
  </div>
);

const LiveEngineProof: React.FC = () => {
  const [post, setPost] = useState<{ text: string; image: string | null }>({ text: FALLBACK_POST, image: null });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('scheduled_posts')
          .select('post_text, media_urls, posted_at')
          .eq('status', 'posted')
          .eq('platform', 'linkedin')
          .not('post_text', 'is', null)
          .order('posted_at', { ascending: false })
          .limit(6);
        if (!active || error || !data) return;
        const row = data.find((r: any) => r.post_text && r.post_text.trim().length > 60);
        if (row) {
          setPost({
            text: row.post_text.replace(/\s+/g, ' ').trim(),
            image: Array.isArray(row.media_urls) && row.media_urls.length > 0 ? row.media_urls[0] : null,
          });
        }
      } catch {
        // keep fallback
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <section className="py-24 md:py-32 border-t" style={{ borderColor: 'rgba(26,26,26,0.1)' }}>
      <div className="container mx-auto px-8 max-w-6xl">
        <motion.div {...reveal} className="mb-12 md:mb-16 max-w-2xl">
          <h2
            style={{
              fontFamily: '"DM Serif Display", "Bodoni Moda", Georgia, serif',
              fontWeight: 400,
              fontSize: 'clamp(2.2rem,3.6vw,3.2rem)',
              lineHeight: 1.06,
              letterSpacing: '-0.02em',
              color: '#1A1A1A',
            }}
          >
            This feed is the system, working.
          </h2>
          <p style={{ fontFamily: '"Source Serif 4", Georgia, serif', fontSize: '17px', lineHeight: 1.6, color: '#3D3D3B', marginTop: '1.25rem', maxWidth: '46ch' }}>
            A post, a carousel, a lead magnet, all from the same engine, all in one voice. If it reads like a person, that's the point.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-start">
          {/* The post — shown the way it lands on LinkedIn */}
          <motion.div {...reveal} className="lg:col-span-6">
            <div style={{ ...MONO, marginBottom: '12px' }}>Post · on LinkedIn</div>
            <LinkedInPost text={post.text} image={post.image} />
          </motion.div>

          {/* Carousel + lead magnet, stacked */}
          <motion.div
            {...(prefersReduced ? {} : { initial: { opacity: 0, y: 20 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-60px' }, transition: { duration: 0.7, ease, delay: 0.12 } })}
            className="lg:col-span-6 grid sm:grid-cols-2 gap-8"
          >
            <SampleFrame label="Carousel" src="https://bjbvqvzbzczjbatgmccb.supabase.co/storage/v1/object/public/lm-og/claude-agency-ops-square-clean.jpg" alt="A branded carousel slide produced by the engine" ratio="4 / 5" />
            <SampleFrame label="Lead magnet" src="/content-system/lead-magnet.png" alt="A live interactive lead magnet built by the engine" ratio="4 / 5" />
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default LiveEngineProof;
