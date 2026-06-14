import React from 'react';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useMetadata } from '../hooks/useMetadata';
import { T, ease, inView, prefersReduced, Label, RevealH2, SageSweep, MagneticCTA } from './editorial';
import { VideoSlot } from './VideoSlot';
import { PROMISES, METRICS, LM_FORMATS, LM_PROMISES, ONE_IDEA_FORMATS, SCOPE } from '../lib/contentSystemContent';

export default function ContentSystemPage() {
  useMetadata({
    title: 'Content System | Manfredi',
    description:
      'An always-on content engine that decides what to post, writes it in your voice, refuses to ship AI slop, turns one idea into every format, and publishes itself. Five posts a week — without writing a word.',
    canonical: 'https://ivanmanfredi.com/content-system',
  });

  return (
    <div className="min-h-screen bg-paper">
      <div className="container mx-auto max-w-5xl px-6 pt-32 pb-24">

        {/* 1 — HERO */}
        <section className="mb-20">
          {/* Label already applies marginBottom 1.75rem internally */}
          <Label>Content System</Label>
          <motion.h1
            {...(prefersReduced ? {} : inView)}
            className="mt-5 text-4xl md:text-5xl lg:text-6xl font-semibold leading-[1.05] tracking-tighter max-w-4xl"
          >
            Be the sharpest voice in your space —{' '}
            <span className="font-drama italic">every day,</span> without writing a word.
          </motion.h1>
          <p className="mt-6 max-w-2xl text-xl text-ink-soft leading-relaxed">
            Five posts a week, carousels, lead magnets, even video — all in your voice, all on
            autopilot. You approve. It does the rest.
          </p>
          <div className="mt-8">
            {/* px prop carries the full padding utility string, e.g. "px-9 py-4" */}
            <MagneticCTA href="/start" fontSize="17px" px="px-9 py-4">
              Book a 20-min look <ArrowRight aria-hidden="true" size={18} />
            </MagneticCTA>
          </div>
        </section>

        {/* 2 — WALKTHROUGH VIDEO SLOT (src passed when filmed) */}
        <section className="mb-24">
          <VideoSlot caption="Watch the system run — 3 min" scriptHref="/content-system-walkthrough.md" />
        </section>

        {/* 3 — PROBLEM → FLIP */}
        <section className="mb-24 max-w-3xl">
          <p className="text-lg md:text-xl text-ink-soft leading-relaxed">
            Showing up daily is the whole game — and it's the thing that always slips. The blank
            page, the posts that sound like everyone else, the weeks you go quiet.{' '}
            <span className="font-drama italic text-ink">
              This removes the bottleneck entirely.
            </span>{' '}
            Not a tool you operate — a system that operates itself, in your voice.
          </p>
        </section>

        {/* 4 — SIX PROMISES */}
        <section className="mb-24">
          <RevealH2
            style={{ ...T.display('clamp(2rem,4vw,3rem)'), marginBottom: '2.5rem' }}
          >
            Why this isn&apos;t{' '}
            <span style={{ position: 'relative', display: 'inline-block' }}>
              &ldquo;AI writes my posts.&rdquo;
              <SageSweep delay={0.4} opacity={0.85} />
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
        <section className="mb-24">
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
        <section className="mb-24">
          <RevealH2
            style={{ ...T.display('clamp(1.8rem,3.6vw,2.6rem)'), marginBottom: '1.5rem' }}
          >
            One idea,{' '}
            <span style={{ position: 'relative', display: 'inline-block' }}>
              everywhere.
              <SageSweep delay={0.3} opacity={0.85} />
            </span>
          </RevealH2>
          <p className="max-w-2xl text-lg text-ink-soft leading-relaxed mb-8">
            A single approved idea fans out into every format you&apos;d ever post — each one
            on-brand, each one in your voice.
          </p>
          <div className="flex flex-wrap gap-3">
            {ONE_IDEA_FORMATS.map((f) => (
              <span
                key={f}
                className="rounded-lg border px-4 py-2 text-sm text-ink"
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
        <section className="mb-24">
          <Label>Lead Magnets</Label>
          <RevealH2
            style={{ ...T.display('clamp(2rem,4vw,3rem)'), margin: '1rem 0 1rem' }}
          >
            Turn attention into{' '}
            <span style={{ position: 'relative', display: 'inline-block' }}>
              qualified leads.
              <SageSweep delay={0.4} opacity={0.85} />
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
                className="rounded-xl border p-5"
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

        {/* 8 — RECEIPTS (3 real auto-captured live assets) */}
        <section className="mb-24">
          <Label>Receipts</Label>
          <RevealH2
            style={{ ...T.display('clamp(1.8rem,3.6vw,2.6rem)'), margin: '1rem 0 2rem' }}
          >
            Real output, live right now.
          </RevealH2>
          <div className="grid md:grid-cols-3 gap-4">
            {(
              [
                {
                  src: '/content-system/lead-magnet.png',
                  alt: 'A live interactive assessment lead magnet',
                  cap: 'Interactive assessment — live & scoring',
                },
                {
                  src: '/content-system/calculator.png',
                  alt: 'A live ROI calculator lead magnet',
                  cap: 'ROI calculator — live page',
                },
                {
                  src: '/content-system/lm-cover.jpg',
                  alt: 'An auto-generated on-brand lead-magnet cover',
                  cap: 'On-brand cover — auto-generated',
                },
              ] as { src: string; alt: string; cap: string }[]
            ).map((r) => (
              <figure key={r.src}>
                <div
                  className="overflow-hidden rounded-xl border"
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
        </section>

        {/* 9 — SCOPE / NOT IN SCOPE */}
        <section className="mb-24 grid md:grid-cols-2 gap-10">
          <div>
            <Label>What you get</Label>
            <ul className="mt-4 space-y-3">
              {SCOPE.inScope.map((s) => (
                <li
                  key={s}
                  className="flex items-start gap-3 text-[15px] text-ink-soft leading-relaxed"
                >
                  <span className="text-accent-ink mt-1 shrink-0">✓</span>
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
                  <span className="font-mono text-ink-mute mt-0.5 shrink-0">—</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 10 — PRICING + FINAL CTA */}
        <section
          className="rounded-2xl border bg-black text-white p-10 md:p-16 text-center"
          style={{ borderColor: 'var(--color-hairline-bold)' }}
        >
          <p className="font-mono text-xs uppercase tracking-[0.1em] text-zinc-400">
            Productized build · from $6k
          </p>
          <h2 className="mt-4 text-3xl md:text-4xl font-semibold tracking-tight">
            Ready to{' '}
            <span className="font-drama italic">stop writing posts?</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-zinc-300 leading-relaxed">
            Book a 20-minute look. We&apos;ll scope it to your channels, formats, and voice, and
            you&apos;ll get a fixed proposal — no obligation.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4">
            <MagneticCTA href="/start" dark fontSize="18px" px="px-10 py-5">
              Book a 20-min look <ArrowRight aria-hidden="true" size={18} />
            </MagneticCTA>
            <a
              href="/assessment"
              className="text-sm underline text-zinc-300 hover:text-white"
            >
              Or take the Agent-Ready assessment first
            </a>
          </div>
        </section>

      </div>
    </div>
  );
}
