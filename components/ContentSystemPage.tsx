import React from 'react';
import { ArrowRight } from 'lucide-react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useMetadata } from '../hooks/useMetadata';
import { T, ease, inView, prefersReduced, Label, RevealH2, SageSweep, MagneticCTA, useMediaQuery } from './editorial';
import { HeroVideo } from './HeroVideo';
import { SystemFlowDiagram } from './SystemFlowDiagram';
import { PROMISES, METRICS, LM_FORMATS, LM_PROMISES, SCOPE, ICP_GATE, ONGOING } from '../lib/contentSystemContent';

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

/** A lead-magnet format tile: uniform-cropped real screenshot + name + blurb,
 *  click to expand the full page in a lightbox. Same size regardless of source. */
function FormatCard({ name, blurb, shot, alt, eager }: { name: string; blurb: string; shot: string; alt: string; eager?: boolean }) {
  const [lb, setLb] = React.useState(false);
  return (
    <figure className="m-0 group">
      <button
        type="button" onClick={() => setLb(true)} aria-label={`Expand ${name} sample`}
        className="block w-full cursor-zoom-in text-left"
      >
        <div
          className="overflow-hidden rounded-xl border shadow-[0_14px_44px_-18px_rgba(0,0,0,0.3)] transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_22px_60px_-18px_rgba(0,0,0,0.42)]"
          style={{ borderColor: 'var(--color-hairline-bold)', backgroundColor: '#0E0F12' }}
        >
          <div className="flex items-center gap-1.5 px-3 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }} aria-hidden="true">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.14)' }} />
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
            <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.12em] text-white/30 group-hover:text-white/55 transition-colors">click to expand</span>
          </div>
          <div className="overflow-hidden" style={{ aspectRatio: '16 / 10' }}>
            <img
              src={shot} alt={alt} loading={eager ? 'eager' : 'lazy'}
              className="block h-full w-full object-cover object-top"
              onError={(e) => { const fig = e.currentTarget.closest('figure') as HTMLElement | null; if (fig) fig.style.display = 'none'; }}
            />
          </div>
        </div>
        <figcaption className="mt-3">
          <span className="text-[15px] font-semibold tracking-tight">{name}</span>
          <span className="block mt-0.5 text-sm text-ink-soft leading-relaxed">{blurb}</span>
        </figcaption>
      </button>
      {lb && <Lightbox src={shot} alt={alt} onClose={() => setLb(false)} />}
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
    title: 'Inbound Engine | Manfredi',
    description:
      'An always-on inbound engine that posts daily in your voice, refuses to publish AI slop, and turns the readers who engage into named leads in your inbox. Five posts a week, without writing a word.',
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
    <div className="min-h-screen bg-paper overflow-x-clip">
      <div className="container mx-auto max-w-5xl px-6 pt-32 pb-24">

        {/* 1 — HERO */}
        <section className="mb-12 md:mb-20">
          {/* Label already applies marginBottom 1.75rem internally */}
          <Label>Inbound Engine</Label>
          <motion.h1
            {...(prefersReduced ? {} : inView)}
            className="mt-5 text-4xl md:text-5xl lg:text-6xl font-semibold leading-[1.05] tracking-tighter max-w-4xl"
          >
            Turn your LinkedIn into a{' '}
            <span className="font-drama italic">pipeline you own</span>.
          </motion.h1>
          <p className="mt-6 max-w-2xl text-xl text-ink-soft leading-relaxed">
            We run a LinkedIn inbound engine that posts daily in your voice and turns the readers
            who engage into leads in your inbox. You never write a post.
          </p>
          <div className="mt-8">
            {/* px prop carries the full padding utility string, e.g. "px-9 py-4" */}
            <MagneticCTA href="/start" fontSize="17px" px="px-9 py-4">
              Book the free fit call <ArrowRight aria-hidden="true" size={18} />
            </MagneticCTA>
          </div>
          {/* Trust proof at the fold. */}
          <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="font-mono text-xs uppercase tracking-[0.12em] text-ink-mute">Running for</span>
            <span className="text-[15px] text-ink-soft"><strong className="text-ink font-semibold">20+ agency founders and operators</strong></span>
          </div>
          {/* Hero video — autoplaying kinetic product ad (Hyperframes-rendered). */}
          <div className="mt-12">
            <h2 className="sr-only">Watch the system run</h2>
            <HeroVideo />
          </div>
        </section>

        {/* 2 — REFRAME: why this isn't "AI writes my posts" */}
        <section className="mb-16 md:mb-24">
          <RevealH2 style={{ ...T.display('clamp(2rem,4vw,3rem)'), marginBottom: '1rem' }}>
            Why this isn&apos;t{' '}
            <span style={{ position: 'relative', display: 'inline-block' }}>
              &ldquo;AI writes my posts.&rdquo;
            </span>
          </RevealH2>
          <p className="max-w-2xl text-lg text-ink-soft leading-relaxed mb-10">
            That means a prompt box and generic output. This is the opposite: a system that decides,
            writes, checks and ships on its own, in your voice.
          </p>
          <div className="grid sm:grid-cols-2 gap-x-12 gap-y-9">
            {PROMISES.map((p, i) => (
              <motion.div
                key={p.headline}
                initial={prefersReduced ? false : { opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.55, ease, delay: prefersReduced ? 0 : (i % 2) * 0.08 }}
                className="border-l-2 border-accent pl-6"
              >
                <h3 className="font-drama italic text-2xl text-accent-ink leading-tight">{p.headline}</h3>
                <p className="mt-2.5 text-[15px] text-ink-soft leading-relaxed">{p.benefit}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* 3 — INTERFACE SHOWCASE (real dashboard screenshots) */}
        <section className="mb-16 md:mb-24">
          <Label>The interface</Label>
          <RevealH2 style={{ ...T.display('clamp(2rem,4vw,3rem)'), margin: '1rem 0 1rem' }}>
            Your own{' '}
            <span style={{ position: 'relative', display: 'inline-block' }}>
              inbound engine, running.
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
          <Reveal className="mt-5">
            <BrowserFrame
              src="/content-system/ui/leads.webp"
              mobileSrc="/content-system/ui/leads-m.webp"
              alt="The Leads board: every engager, ICP-scored, with the messages the engine sent"
              caption="Leads · every engager, worked to a reply"
            />
          </Reveal>
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

        {/* 6 — HOW THE SYSTEM WORKS (one idea in, whole funnel out) */}
        {/* Full-bleed breakout so the diagram reads big on wide screens. */}
        <section className="mb-16 md:mb-24 relative left-1/2 -translate-x-1/2 w-screen px-5 sm:px-8">
          <div className="mx-auto max-w-[1480px]">
            <Label>How it works</Label>
            <RevealH2
              style={{ ...T.display('clamp(2rem,4.4vw,3.4rem)'), margin: '1rem 0 1rem' }}
            >
              One idea in.{' '}
              <span style={{ position: 'relative', display: 'inline-block' }}>
                Your whole funnel out.
              </span>
            </RevealH2>
            <p className="max-w-2xl text-lg text-ink-soft leading-relaxed mb-10">
              The same engine runs the entire loop, end to end. You only ever touch one step.
            </p>
            <Reveal>
              <div
                className="rounded-3xl border p-4 sm:p-6 md:p-8 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.28)]"
                style={{ borderColor: 'var(--color-hairline)', backgroundColor: 'var(--color-paper-sunk)' }}
              >
                <SystemFlowDiagram />
              </div>
            </Reveal>
            <p className="mt-6 max-w-2xl text-[15px] text-ink-mute leading-relaxed">
              Click any step to see it running in the real product. Once it's live, your daily lift
              is under ten minutes: read the draft, approve, done.
            </p>
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
            hosted page, and adds every signup to your email list. It then works the best-fit
            engagers with a resource DM and a follow-up until they reply, and routes them to your
            calendar. You wake up to booked calls and a growing list, not busywork.
          </p>
          {/* Every format = a real, currently-live lead magnet. Uniform tiles,
              click any to expand the full page. */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-6">
            {LM_FORMATS.map((f, i) => (
              <FormatCard key={f.name} {...f} eager={i === 0} />
            ))}
          </div>
          <p className="text-sm text-ink-mute mb-14">
            Every tile above is a real lead magnet the engine built and published. Click any one to
            open it full size. Skill packs, templates and more ship from the same pipeline.
          </p>
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

        {/* 7.5 — WHAT YOU OWN (the asset-ownership frame, per positioning lock) */}
        <section className="mb-16 md:mb-24">
          <Label>What you own</Label>
          <RevealH2
            style={{ ...T.display('clamp(2rem,4vw,3rem)'), margin: '1rem 0 1rem' }}
          >
            You own what it{' '}
            <span style={{ position: 'relative', display: 'inline-block' }}>
              builds.
              <SageSweep delay={0.4} opacity={0.85} />
            </span>
          </RevealH2>
          <p className="max-w-2xl text-lg text-ink-soft leading-relaxed">
            The audience, the email list, the content, and every lead the engine captures are yours
            to keep. We run the engine, you keep the asset it builds. If we ever part ways, you walk
            away with all of it.
          </p>
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

          {/* Mid-page CTA at peak conviction (right after the proof). */}
          <div className="mt-16 flex flex-wrap items-center justify-between gap-5 border-t border-b py-8" style={{ borderColor: 'var(--color-hairline)' }}>
            <p className="text-lg md:text-xl text-ink max-w-xl leading-snug">
              Want this running in your voice? Let&apos;s scope it on a quick call.
            </p>
            <MagneticCTA href="/start" fontSize="16px" px="px-7 py-3.5">
              Book the free fit call <ArrowRight aria-hidden="true" size={18} />
            </MagneticCTA>
          </div>
        </section>

        {/* 9 — SCOPE / NOT IN SCOPE */}
        <section className="mb-16 md:mb-24">
          <h2 className="sr-only">Who this is for, and what's in and out of scope</h2>
          <p className="max-w-3xl text-lg md:text-xl text-ink leading-relaxed mb-10 md:mb-12">
            {ICP_GATE}
          </p>
          <div className="grid md:grid-cols-2 gap-10">
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
          </div>
        </section>

        {/* 9b — ONGOING: why the engagement stays live (answers "why not a one-time build I own?") */}
        <section className="mb-16 md:mb-24 max-w-3xl">
          <Label>Kept current</Label>
          <p className="mt-4 mb-6 text-lg md:text-xl text-ink leading-relaxed">
            {ONGOING.lead}
          </p>
          <ul className="space-y-3">
            {ONGOING.items.map((s) => (
              <li
                key={s}
                className="flex items-start gap-3 text-[15px] md:text-base text-ink-soft leading-relaxed"
              >
                <ArrowRight aria-hidden="true" size={16} className="mt-1 shrink-0 text-accent-ink" />
                {s}
              </li>
            ))}
          </ul>
        </section>

        {/* 10 — FINAL CTA */}
        <section
          className="rounded-3xl bg-black text-white p-10 md:p-16 text-center shadow-[0_30px_80px_-24px_rgba(0,0,0,0.45)]"
        >
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-emerald-300/80 mb-5">
            The outcome
          </div>
          <h2 className="mx-auto max-w-3xl text-3xl md:text-5xl font-semibold tracking-tight leading-[1.08]">
            Make your content a{' '}
            <span className="font-drama italic">lead and revenue engine.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-300 leading-relaxed">
            Five posts a week in your voice, lead magnets that capture and qualify every signup, and
            the best-fit engagers worked to a reply and sent straight to your calendar. Content that
            builds pipeline, not just likes.
          </p>
          <div className="mt-9 flex flex-col items-center gap-4">
            <MagneticCTA href="/start" dark fontSize="18px" px="px-10 py-5">
              Book the free fit call <ArrowRight aria-hidden="true" size={18} />
            </MagneticCTA>
            <p className="text-sm text-zinc-400">
              We&apos;ll scope it to your channels, formats, and voice, and you leave knowing exactly
              what it runs and what it costs.
            </p>
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
        Book the free fit call <ArrowRight aria-hidden="true" size={18} />
      </a>
    </div>
  );
}
