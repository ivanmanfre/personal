import React from 'react';
import { ArrowRight } from 'lucide-react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useMetadata } from '../hooks/useMetadata';
import { T, ease, inView, prefersReduced, Label, RevealH2, SageSweep, MagneticCTA, useMediaQuery } from './editorial';
import { VideoSlot } from './VideoSlot';
import { PROMISES, METRICS, LM_FORMATS, LM_PROMISES, ONE_IDEA_FORMATS, SCOPE } from '../lib/contentSystemContent';

/** Scroll-reveal wrapper with staggered delay. */
function Reveal({ children, i = 0, className }: { children: React.ReactNode; i?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={prefersReduced ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease, delay: prefersReduced ? 0 : i * 0.08 }}
    >
      {children}
    </motion.div>
  );
}

/** Full-screen zoomable image overlay. Click image to toggle zoom; Esc / backdrop to close. */
function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [zoom, setZoom] = React.useState(false);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 md:p-10"
      role="dialog" aria-modal="true" aria-label={alt} onClick={onClose}
    >
      <button
        type="button" onClick={onClose} aria-label="Close"
        className="fixed top-5 right-6 z-[101] flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white text-2xl leading-none hover:bg-white/20 transition-colors"
      >×</button>
      <div className="max-h-full max-w-full overflow-auto" onClick={(e) => e.stopPropagation()}>
        <img
          src={src} alt={alt} onClick={() => setZoom((z) => !z)}
          className={`block rounded-xl shadow-2xl transition-[width] duration-300 ${zoom ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
          style={{ width: zoom ? '165%' : '100%', maxWidth: zoom ? 'none' : '1200px' }}
        />
      </div>
    </div>
  );
}

/** A dark dashboard screenshot in a soft, floating browser-window frame.
 *  Click to open a zoomable lightbox. `mobileSrc` swaps in a legible crop below 768px. */
function BrowserFrame({ src, mobileSrc, alt, caption, eager }: { src: string; mobileSrc?: string; alt: string; caption?: string; eager?: boolean }) {
  const [lb, setLb] = React.useState(false);
  return (
    <figure className="m-0">
      <button
        type="button" onClick={() => setLb(true)} aria-label={`Expand screenshot: ${alt}`}
        className="group block w-full cursor-zoom-in"
      >
        <div
          className="overflow-hidden rounded-xl border shadow-[0_24px_70px_-20px_rgba(0,0,0,0.35)] transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_34px_90px_-20px_rgba(0,0,0,0.5)]"
          style={{ borderColor: 'var(--color-hairline-bold)', backgroundColor: '#0E0F12' }}
        >
          <div
            className="flex items-center gap-1.5 px-3.5 py-2.5 border-b"
            style={{ borderColor: 'rgba(255,255,255,0.07)' }}
            aria-hidden="true"
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.20)' }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.14)' }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.10)' }} />
            <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.12em] text-white/30 group-hover:text-white/50 transition-colors">click to expand</span>
          </div>
          <picture>
            {mobileSrc && <source media="(max-width: 767px)" srcSet={mobileSrc} />}
            <img
              src={src}
              alt={alt}
              loading={eager ? 'eager' : 'lazy'}
              {...(eager ? { fetchPriority: 'high' as const } : {})}
              className="block w-full"
            />
          </picture>
        </div>
      </button>
      {caption && (
        <figcaption className="mt-2.5 text-center font-mono text-xs uppercase tracking-[0.1em] text-ink-mute">
          {caption}
        </figcaption>
      )}
      {lb && <Lightbox src={src} alt={alt} onClose={() => setLb(false)} />}
    </figure>
  );
}

interface CaseMetric { value: string; label: string; }
/** Client case-study row: framed screenshot + name + summary + big metrics. */
function CaseStudy({ client, role, src, alt, summary, metrics, flip }: {
  client: string; role: string; src: string; alt: string; summary: string; metrics: CaseMetric[]; flip?: boolean;
}) {
  // Scroll-linked parallax on the screenshot (lg+ only), borrowed from the
  // landing page's two-column depth treatment.
  const ref = React.useRef<HTMLDivElement>(null);
  const isLg = useMediaQuery('(min-width: 1024px)');
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const shotY = useTransform(scrollYProgress, [0, 1], [44, -44]);
  return (
    <Reveal>
      <div ref={ref} className="grid lg:grid-cols-2 gap-8 lg:gap-14 items-center">
        <motion.div style={isLg && !prefersReduced ? { y: shotY } : undefined} className={flip ? 'lg:order-2' : ''}>
          <BrowserFrame eager src={src} alt={alt} />
        </motion.div>
        <div className={flip ? 'lg:order-1' : ''}>
          <div className="font-mono text-xs uppercase tracking-[0.1em] text-ink-mute">{role}</div>
          <h3 className="mt-1.5 text-2xl md:text-3xl font-semibold tracking-tight">{client}</h3>
          <p className="mt-3 text-[15px] md:text-base text-ink-soft leading-relaxed">{summary}</p>
          <div className="mt-7 flex flex-wrap gap-x-10 gap-y-6">
            {metrics.map((m) => (
              <div key={m.label}>
                <div className="font-drama italic text-4xl md:text-5xl text-accent-ink leading-none">{m.value}</div>
                <div className="mt-2 text-sm text-ink-soft leading-snug max-w-[190px]">{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Reveal>
  );
}

export default function ContentSystemPage() {
  useMetadata({
    title: 'Content System | Manfredi',
    description:
      'An always-on content engine that decides what to post, writes it in your voice, refuses to ship AI slop, turns one idea into every format, and publishes itself. Five posts a week, without writing a word.',
    canonical: 'https://ivanmanfredi.com/content-system',
  });

  // Sticky mobile CTA: slides in once the hero scrolls off (64% of mobile
  // visitors never scroll far, so keep the ask persistent).
  const [showSticky, setShowSticky] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => setShowSticky(window.scrollY > 700);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-paper">
      <div className="container mx-auto max-w-5xl px-6 pt-32 pb-24">

        {/* 1 — HERO */}
        <section className="mb-12 md:mb-20">
          {/* Label already applies marginBottom 1.75rem internally */}
          <Label>Content System</Label>
          <motion.h1
            {...(prefersReduced ? {} : inView)}
            className="mt-5 text-4xl md:text-5xl lg:text-6xl font-semibold leading-[1.05] tracking-tighter max-w-4xl"
          >
            Be the sharpest voice in your space,{' '}
            <span className="font-drama italic">every day</span>, without writing a word.
          </motion.h1>
          <p className="mt-6 max-w-2xl text-xl text-ink-soft leading-relaxed">
            Five posts a week, carousels, lead magnets, even video, all in your voice and all on
            autopilot. You approve. It does the rest.
          </p>
          <div className="mt-8">
            {/* px prop carries the full padding utility string, e.g. "px-9 py-4" */}
            <MagneticCTA href="/start" fontSize="17px" px="px-9 py-4">
              Book a 20-min look <ArrowRight aria-hidden="true" size={18} />
            </MagneticCTA>
          </div>
          {/* Trust proof at the fold (named, attributed). */}
          <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-2">
            <span className="font-mono text-xs uppercase tracking-[0.12em] text-ink-mute">Running for</span>
            <span className="text-[15px] text-ink-soft"><strong className="text-ink font-semibold">Kyle Hunt</strong> · 30K impressions/post</span>
            <span className="text-[15px] text-ink-soft"><strong className="text-ink font-semibold">Lemonade</strong> · 5 new clients/mo</span>
          </div>
          {/* Hero video — the demonstrative payoff, front and center. */}
          <div className="mt-10">
            <h2 className="sr-only">Watch the system run</h2>
            <VideoSlot caption="Watch the system run, 3 min" scriptHref="/content-system-walkthrough.md" />
          </div>
        </section>

        {/* 2 — INTERFACE SHOWCASE (real dashboard screenshots) */}
        <section className="mb-16 md:mb-24">
          <Label>The interface</Label>
          <RevealH2 style={{ ...T.display('clamp(2rem,4vw,3rem)'), margin: '1rem 0 1rem' }}>
            Not a prompt box.{' '}
            <span style={{ position: 'relative', display: 'inline-block' }}>
              A real operating console.
              <SageSweep delay={0.4} opacity={0.85} />
            </span>
          </RevealH2>
          <p className="max-w-2xl text-lg text-ink-soft leading-relaxed mb-10">
            Every post, lead magnet, and metric lives in one place. You glance, approve, and move on.
            This is the actual system, running.
          </p>
          <Reveal>
            <BrowserFrame
              eager
              src="/content-system/ui/board.webp"
              mobileSrc="/content-system/ui/board-m.webp"
              alt="The content pipeline board, a week of posts drafted and queued"
              caption="The pipeline · a week of posts, drafted and queued"
            />
          </Reveal>
          <div className="grid md:grid-cols-2 gap-5 mt-5">
            <Reveal i={0}>
              <BrowserFrame src="/content-system/ui/editor.webp" mobileSrc="/content-system/ui/editor-m.webp" alt="The post editor: edit a draft's copy, image, and schedule" caption="Edit any draft · copy, image, timing" />
            </Reveal>
            <Reveal i={1}>
              <BrowserFrame src="/content-system/ui/calendar.webp" mobileSrc="/content-system/ui/calendar-m.webp" alt="The publishing calendar with scheduled posts across the month" caption="Calendar · it schedules itself" />
            </Reveal>
            <Reveal i={2}>
              <BrowserFrame src="/content-system/ui/performance.webp" mobileSrc="/content-system/ui/performance-m.webp" alt="The performance dashboard: impressions and engagement per post" caption="Performance · it learns what lands" />
            </Reveal>
            <Reveal i={3}>
              <BrowserFrame src="/content-system/ui/leadmagnets.webp" mobileSrc="/content-system/ui/leadmagnets-m.webp" alt="The lead-magnet studio with built, on-brand assets" caption="Lead magnets · built and published" />
            </Reveal>
          </div>
        </section>

        {/* 3 — PROBLEM → FLIP */}
        <section className="mb-16 md:mb-24 max-w-3xl">
          <h2 className="sr-only">The problem this removes</h2>
          <p className="text-lg md:text-xl text-ink-soft leading-relaxed">
            Showing up daily is the whole game, and it's the thing that always slips. The blank
            page, the posts that sound like everyone else, the weeks you go quiet.{' '}
            <span className="font-semibold text-ink">
              This removes the bottleneck entirely.
            </span>{' '}
            Not a tool you operate. A system that operates itself, in your voice.
          </p>
        </section>

        {/* 4 — SIX PROMISES */}
        <section className="mb-16 md:mb-24">
          <RevealH2
            style={{ ...T.display('clamp(2rem,4vw,3rem)'), marginBottom: '2.5rem' }}
          >
            Why this isn&apos;t{' '}
            <span style={{ position: 'relative', display: 'inline-block' }}>
              &ldquo;AI writes my posts.&rdquo;
            </span>
          </RevealH2>
          <div className="grid md:grid-cols-2 gap-x-10 gap-y-10">
            {PROMISES.map((p, i) => (
              <motion.div
                key={p.headline}
                initial={prefersReduced ? false : { opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{
                  duration: 0.55,
                  ease,
                  delay: prefersReduced ? 0 : (i % 2) * 0.08,
                }}
                className="border-l border-accent pl-6"
              >
                <h3 className="text-xl font-semibold tracking-tight">{p.headline}</h3>
                <p className="mt-2 text-[15px] text-ink-soft leading-relaxed">{p.benefit}</p>
                <p className="mt-3 font-mono text-xs uppercase tracking-[0.08em] text-ink-mute">
                  How: {p.how}
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* 5 — METRICS STRIP */}
        <section className="mb-16 md:mb-24">
          <h2 className="sr-only">By the numbers</h2>
          <div
            className="grid grid-cols-2 md:grid-cols-4 gap-6 border-y py-10"
            style={{ borderColor: 'var(--color-hairline)' }}
          >
            {METRICS.map((m) => (
              <div key={m.label} className="text-center">
                <div className="font-drama italic text-4xl md:text-5xl text-accent-ink leading-none">
                  {m.value}
                </div>
                <div className="mt-2 text-sm text-ink-soft leading-snug">{m.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 6 — ONE IDEA, EVERYWHERE */}
        <section className="mb-16 md:mb-24">
          <RevealH2
            style={{ ...T.display('clamp(1.8rem,3.6vw,2.6rem)'), marginBottom: '1.5rem' }}
          >
            One idea,{' '}
            <span style={{ position: 'relative', display: 'inline-block' }}>
              everywhere.
            </span>
          </RevealH2>
          <p className="max-w-2xl text-lg text-ink-soft leading-relaxed mb-8">
            A single approved idea fans out into every format you&apos;d ever post, each one
            on-brand, each one in your voice.
          </p>
          <div className="flex flex-wrap gap-3">
            {ONE_IDEA_FORMATS.map((f) => (
              <span
                key={f}
                className="rounded-full border px-4 py-2 text-sm text-ink shadow-sm transition-transform duration-200 hover:-translate-y-0.5"
                style={{
                  borderColor: 'var(--color-hairline-bold)',
                  backgroundColor: 'var(--color-paper-raise)',
                }}
              >
                {f}
              </span>
            ))}
          </div>
        </section>

        {/* 7 — LEAD MAGNETS */}
        <section className="mb-16 md:mb-24">
          <Label>Lead Magnets</Label>
          <RevealH2
            style={{ ...T.display('clamp(2rem,4vw,3rem)'), margin: '1rem 0 1rem' }}
          >
            Turn attention into{' '}
            <span style={{ position: 'relative', display: 'inline-block' }}>
              qualified leads.
            </span>
          </RevealH2>
          <p className="max-w-2xl text-lg text-ink-soft leading-relaxed mb-10">
            From one idea, the system builds an interactive lead magnet, publishes it as a live
            hosted page, and routes every signup by how good a fit they are. You wake up to booked
            calls, not busywork.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
            {LM_FORMATS.map((f) => (
              <div
                key={f.name}
                className="rounded-2xl border p-5 shadow-[0_6px_24px_rgba(0,0,0,0.05)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_44px_rgba(0,0,0,0.10)]"
                style={{
                  borderColor: 'var(--color-hairline)',
                  backgroundColor: 'var(--color-paper-raise)',
                }}
              >
                <div className="flex items-center gap-2">
                  <h3 className="text-[15px] font-semibold tracking-tight">{f.name}</h3>
                  {f.coming && (
                    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">
                      coming
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-sm text-ink-soft leading-relaxed">{f.blurb}</p>
              </div>
            ))}
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {LM_PROMISES.map((p) => (
              <div key={p.headline} className="border-l border-accent pl-6">
                <h3 className="text-lg font-semibold tracking-tight">{p.headline}</h3>
                <p className="mt-2 text-[15px] text-ink-soft leading-relaxed">{p.benefit}</p>
                <p className="mt-3 font-mono text-xs uppercase tracking-[0.08em] text-ink-mute">
                  How: {p.how}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* 8 — CLIENT CASE STUDIES (real operators + numbers) */}
        <section className="mb-16 md:mb-24">
          <Label>Client results</Label>
          <RevealH2
            style={{ ...T.display('clamp(2rem,4vw,3rem)'), margin: '1rem 0 2.5rem' }}
          >
            Already running for{' '}
            <span style={{ position: 'relative', display: 'inline-block' }}>
              real operators.
              <SageSweep delay={0.4} opacity={0.85} />
            </span>
          </RevealH2>

          <div className="space-y-16 md:space-y-20">
            <CaseStudy
              client="Kyle Hunt"
              role="Creative-video agency · founder"
              src="/content-system/kyle-guides.webp"
              alt="A live lead-magnet guide the system built for Kyle Hunt"
              summary="Kyle runs his content and lead magnets through the system. Every post and every guide is drafted in his voice and shipped on a live page, without him ever facing a blank page."
              metrics={[
                { value: '30K', label: 'impressions per post' },
                { value: '~300', label: 'comments on a lead-magnet post' },
                { value: '100%', label: 'of his content, run by the system' },
              ]}
            />
            <CaseStudy
              flip
              client="Lemonade"
              role="Demand-gen studio"
              src="/content-system/lemonade-thankyou.webp"
              alt="Lemonade's lead-capture page built by the system"
              summary="Lemonade points the lead-magnet engine at one job: booking fit calls. Gated assets on live pages qualify every signup and send the best straight to the calendar."
              metrics={[
                { value: '5', label: 'new clients a month from the lead-magnet system' },
                { value: 'Live', label: 'gated funnel, running on autopilot' },
              ]}
            />
          </div>

          {/* Supplementary: live output straight from the engine */}
          <div className="mt-20">
            <div className="font-mono text-xs uppercase tracking-[0.1em] text-ink-mute mb-5">
              Also live, straight from the engine
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(
                [
                  { src: '/content-system/lead-magnet.webp', alt: 'A live interactive assessment lead magnet', cap: 'Interactive assessment · scoring' },
                  { src: '/content-system/calculator.webp', alt: 'A live ROI calculator lead magnet', cap: 'ROI calculator · live page' },
                  { src: '/content-system/lm-cover.webp', alt: 'An auto-generated on-brand lead-magnet cover', cap: 'On-brand cover · auto-made' },
                ] as { src: string; alt: string; cap: string }[]
              ).map((r) => (
                <figure key={r.src} className="m-0">
                  <div
                    className="overflow-hidden rounded-2xl border shadow-[0_8px_30px_rgba(0,0,0,0.07)]"
                    style={{
                      borderColor: 'var(--color-hairline-bold)',
                      backgroundColor: 'var(--color-paper-sunk)',
                      aspectRatio: '4 / 5',
                    }}
                  >
                    <img
                      src={r.src}
                      alt={r.alt}
                      loading="lazy"
                      className="h-full w-full object-cover object-top"
                      onError={(e) => {
                        const fig = e.currentTarget.closest('figure') as HTMLElement | null;
                        if (fig) fig.style.display = 'none';
                      }}
                    />
                  </div>
                  <figcaption className="mt-2 text-center font-mono text-xs uppercase tracking-[0.1em] text-ink-mute">
                    {r.cap}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>

          {/* Mid-page CTA at peak conviction (right after the proof). */}
          <div className="mt-16 flex flex-wrap items-center justify-between gap-5 border-t border-b py-8" style={{ borderColor: 'var(--color-hairline)' }}>
            <p className="text-lg md:text-xl text-ink max-w-xl leading-snug">
              Want this running in your voice? Let&apos;s scope it on a quick call.
            </p>
            <MagneticCTA href="/start" fontSize="16px" px="px-7 py-3.5">
              Book a 20-min look <ArrowRight aria-hidden="true" size={18} />
            </MagneticCTA>
          </div>
        </section>

        {/* 9 — SCOPE / NOT IN SCOPE */}
        <section className="mb-16 md:mb-24 grid md:grid-cols-2 gap-10">
          <h2 className="sr-only">What's in and out of scope</h2>
          <div>
            <Label>What you get</Label>
            <ul className="mt-4 space-y-3">
              {SCOPE.inScope.map((s) => (
                <li
                  key={s}
                  className="flex items-start gap-3 text-[15px] text-ink-soft leading-relaxed"
                >
                  <span className="mt-1.5 shrink-0 inline-block h-2 w-2" style={{ backgroundColor: 'var(--color-accent)' }} aria-hidden="true" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <Label>Not in scope</Label>
            <ul className="mt-4 space-y-3">
              {SCOPE.notInScope.map((s) => (
                <li
                  key={s}
                  className="flex items-start gap-3 text-[15px] text-ink-mute leading-relaxed"
                >
                  <span className="mt-1.5 shrink-0 inline-block h-2 w-2 border" style={{ borderColor: 'var(--color-hairline-bold)' }} aria-hidden="true" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 10 — FINAL CTA */}
        <section
          className="rounded-3xl bg-black text-white p-10 md:p-16 text-center shadow-[0_30px_80px_-24px_rgba(0,0,0,0.45)]"
        >
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Ready to{' '}
            <span className="font-drama italic">stop writing posts?</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-zinc-300 leading-relaxed">
            Book a 20-minute look. We&apos;ll scope it to your channels, formats, and voice, and
            you&apos;ll get a fixed proposal, no obligation.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4">
            <MagneticCTA href="/start" dark fontSize="18px" px="px-10 py-5">
              Book a 20-min look <ArrowRight aria-hidden="true" size={18} />
            </MagneticCTA>
          </div>
        </section>

      </div>

      {/* Sticky mobile CTA */}
      <a
        href="/start"
        className={`md:hidden fixed inset-x-0 bottom-0 z-40 flex items-center justify-center gap-2 py-4 text-center shadow-[0_-6px_24px_rgba(0,0,0,0.18)] transition-transform duration-300 ${showSticky ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ backgroundColor: '#1A1A1A', color: '#F7F4EF', fontFamily: '"Source Serif 4", Georgia, serif', fontStyle: 'italic', fontWeight: 600, fontSize: '16px' }}
        tabIndex={showSticky ? 0 : -1}
        aria-hidden={!showSticky}
      >
        Book a 20-min look <ArrowRight aria-hidden="true" size={18} />
      </a>
    </div>
  );
}
