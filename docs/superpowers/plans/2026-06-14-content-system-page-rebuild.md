# /content-system Page Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. For the page-build tasks, the implementer should ALSO use the `frontend-grounded` skill (brand-locked surface) to craft + self-test the markup against `brand-visual-system.md`.

**Goal:** Rebuild `components/ContentSystemPage.tsx` so it works cold AND as a sales-call leave-behind — outcome-led, proving the system is advanced, with a reserved walkthrough-video slot and a dedicated Lead Magnets section.

**Architecture:** The page composes the existing editorial system (`components/editorial.tsx`: `Label`, `RevealH2`, `SageSweep`, `MagneticCTA`, `T`, `inView`, `ease`, `prefersReduced`, `useMediaQuery`) on the cream/sage brand tokens in `styles.css`. All page copy + lists live in a typed, vitest-tested data module so the JSX stays declarative and the "honesty rule" (no pending capabilities) is enforced by a test. A small reusable `VideoSlot` component holds the walkthrough (poster + optional `src`; renders an on-brand "coming" state until the video exists).

**Tech Stack:** React 19, TypeScript 5.8 (strict), Vite 6, Tailwind 4, framer-motion 12, vitest 2 (node env, `*.test.ts`), playwright 1.59 (via playwright-driver). Plain `<a href>` CTAs to `/start`.

**Scope:** This is **Plan 2 of 2** (Plan 1 = dashboard demo, merged). Presentation-layer only; no backend. The walkthrough video itself is filmed later — this reserves and styles its slot. Pricing is unchanged (keep "from $6k").

**Source spec:** `docs/superpowers/specs/2026-06-14-content-system-demo-readiness-design.md` (Part B, §4).

**Execution note:** Build in a FRESH worktree off updated `main` (Plan 1 is merged). Copy this plan + the spec into that worktree first (same pattern Plan 1 used).

---

## File Structure

**New files**
- `lib/contentSystemContent.ts` — typed page content: six promises, the metrics strip, the 10 lead-magnet formats, the 3 LM promises, the "one idea → formats" list, scope/not-in-scope. Honesty flags on anything not fully live.
- `lib/contentSystemContent.test.ts` — vitest: counts + honesty assertions.
- `components/VideoSlot.tsx` — reusable on-brand video frame (poster + optional `src`; "coming" state).

**Modified files**
- `components/ContentSystemPage.tsx` — full rebuild to the §4 section order on the editorial system.

**New assets**
- `public/content-system/` — 3 real receipt screenshots (carousel, newsjack post, lead-magnet page) + optional video poster.

---

## Page section order (target)
1. Hero (cold hook + outcome subhead + primary CTA)
2. Walkthrough video slot
3. Brief problem → flip
4. The six promises (the "why it's advanced" section)
5. "One idea, everywhere"
6. Lead Magnets (dedicated)
7. Receipts (real screenshots)
8. Scope / not in scope
9. Pricing + final CTA

---

## Task 1: Page content data module (pure, TDD)

**Files:**
- Create: `lib/contentSystemContent.ts`
- Test: `lib/contentSystemContent.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/contentSystemContent.test.ts
import { describe, it, expect } from 'vitest';
import {
  PROMISES, METRICS, LM_FORMATS, LM_PROMISES, ONE_IDEA_FORMATS, SCOPE,
} from './contentSystemContent';

describe('content-system page content', () => {
  it('has exactly six outcome promises, each with headline/benefit/how', () => {
    expect(PROMISES).toHaveLength(6);
    for (const p of PROMISES) {
      expect(p.headline.length).toBeGreaterThan(0);
      expect(p.benefit.length).toBeGreaterThan(0);
      expect(p.how.length).toBeGreaterThan(0);
    }
  });

  it('has four buyer-facing metrics', () => {
    expect(METRICS).toHaveLength(4);
    for (const m of METRICS) {
      expect(m.value.length).toBeGreaterThan(0);
      expect(m.label.length).toBeGreaterThan(0);
    }
  });

  it('lists ten lead-magnet formats and marks not-yet-live ones', () => {
    expect(LM_FORMATS).toHaveLength(10);
    const coming = LM_FORMATS.filter(f => f.coming);
    // Live AI Walkthrough is the only one not fully live (honesty rule).
    expect(coming.map(f => f.name)).toEqual(['Live AI Walkthrough']);
  });

  it('has three lead-magnet promises with a how line', () => {
    expect(LM_PROMISES).toHaveLength(3);
    for (const p of LM_PROMISES) expect(p.how.length).toBeGreaterThan(0);
  });

  it('lists the formats one idea fans into', () => {
    expect(ONE_IDEA_FORMATS.length).toBeGreaterThanOrEqual(4);
  });

  it('has both in-scope and not-in-scope items', () => {
    expect(SCOPE.inScope.length).toBeGreaterThan(0);
    expect(SCOPE.notInScope.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/contentSystemContent.test.ts`
Expected: FAIL — cannot find `./contentSystemContent`.

- [ ] **Step 3: Implement the data module**

```ts
// lib/contentSystemContent.ts
// All buyer-facing copy for /content-system. Outcome-led; the `how` line is the
// only place implementation sophistication appears (reason-to-believe).
// HONESTY RULE: only claim live capabilities. Anything not fully live is marked.

export interface Promise {
  headline: string;
  benefit: string;
  how: string; // small grey "how it's possible" proof line
}

export const PROMISES: Promise[] = [
  {
    headline: 'Never face a blank page',
    benefit: "It decides what to post — pulling ideas from across the web and your own calls, then ranking them by what'll actually land.",
    how: '6-source idea curator + nightly fit-scoring brain.',
  },
  {
    headline: 'It sounds like you — not AI',
    benefit: 'Trained on your voice and grounded in your real conversations, so every post reads like you wrote it on your best day.',
    how: 'Voice training + retrieval over your transcripts.',
  },
  {
    headline: 'It never ships slop',
    benefit: 'Every post is quality-checked against the tells that make content feel AI-written — and rewritten until it passes.',
    how: 'Deterministic quality gates + a 9-point review that self-rewrites.',
  },
  {
    headline: 'One idea becomes everything',
    benefit: 'A single idea turns into a post, a carousel (9 on-brand styles), a short video, and a lead magnet — all at once.',
    how: 'Multi-format engine with real-logo, on-brand rendering.',
  },
  {
    headline: 'Always first to the trend',
    benefit: "The moment a big AI story breaks, you've got an on-brand post ready — while everyone else is still reading the news.",
    how: 'News radar scanning every 2h + an instant alert to you.',
  },
  {
    headline: 'It runs — and learns',
    benefit: 'Publishes natively to LinkedIn, captures qualified leads through self-publishing lead magnets, and tracks what works.',
    how: 'Native publishing + 10 lead-magnet formats + a performance loop.',
  },
];

export interface Metric { value: string; label: string; }
export const METRICS: Metric[] = [
  { value: '5+',  label: 'posts a week, in your voice' },
  { value: '0',   label: 'blank pages — ever' },
  { value: '10',  label: 'lead-magnet formats that build themselves' },
  { value: 'hrs', label: 'on a breaking trend — not days' },
];

export interface LmFormat { name: string; blurb: string; coming?: boolean; }
export const LM_FORMATS: LmFormat[] = [
  { name: 'Interactive Assessment',  blurb: 'Scored quiz that qualifies the reader and books the right next step.' },
  { name: 'Calculator',              blurb: 'Live ROI / cost calculator tailored to your offer.' },
  { name: 'Guide',                   blurb: 'Deep, on-brand playbook — every promise delivered inline.' },
  { name: 'AI Kit',                  blurb: 'Ready-to-run prompts and agents — proof you actually build.' },
  { name: 'n8n Workflow',            blurb: 'A real importable automation, not a screenshot.' },
  { name: 'Stack Picker',            blurb: "Guided tool selector for the reader's situation." },
  { name: 'Annotated Architecture',  blurb: 'A diagrammed system teardown they can copy.' },
  { name: 'Skill Pack',              blurb: 'Packaged capabilities the reader installs.' },
  { name: 'Checklist',               blurb: 'The fast-win format — instant, shareable.' },
  { name: 'Live AI Walkthrough',     blurb: "Runs on the reader's own input, live.", coming: true },
];

export interface LmPromise { headline: string; benefit: string; how: string; }
export const LM_PROMISES: LmPromise[] = [
  {
    headline: 'It builds AND publishes itself',
    benefit: 'One request → a finished, interactive asset on a live page at your domain. No designer, no dev, no upload.',
    how: 'Auto-generated + auto-deployed hosted resource pages.',
  },
  {
    headline: 'It qualifies leads for you',
    benefit: 'Every signup is scored by fit — top prospects get a call link, the rest get nurtured. No wasted calendar slots.',
    how: 'Qualification-gated CTAs that route by persona + score.',
  },
  {
    headline: 'It launches the whole campaign',
    benefit: 'Each magnet ships with its launch post, DM, email sequence, and cover — written and scheduled in one pass.',
    how: 'One run produces the asset + the full distribution kit.',
  },
];

export const ONE_IDEA_FORMATS: string[] = [
  'Text post', 'Single image', 'Carousel (9 styles)', 'Short video', 'Lead magnet', 'IG caption', 'Newsletter',
];

export const SCOPE: { inScope: string[]; notInScope: string[] } = {
  inScope: [
    'Voice training on your real posts + calls',
    'The idea curator, scorer, and newsjack radar',
    'Multi-format generation (posts, carousels, video, lead magnets)',
    'Quality + anti-slop gating on every piece',
    'Native LinkedIn publishing + the performance loop',
    'A dashboard where you approve and schedule',
  ],
  notInScope: [
    'We don’t write your content by hand',
    'No paid ads management',
    'No general marketing strategy coaching',
    'No guaranteed follower or engagement numbers',
  ],
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/contentSystemContent.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/contentSystemContent.ts lib/contentSystemContent.test.ts
git commit -m "feat(content-system): typed page content module + honesty test

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: VideoSlot component

**Files:**
- Create: `components/VideoSlot.tsx`

A reusable, brand-styled frame for the walkthrough. Renders the real `<video controls poster>` when a `src` is provided; otherwise an on-brand "coming" placeholder (so the page ships now and the video drops in later by passing `src`).

- [ ] **Step 1: Implement the component**

```tsx
// components/VideoSlot.tsx
import React from 'react';
import { Play } from 'lucide-react';

interface VideoSlotProps {
  /** When set, renders a real player. When omitted, renders the on-brand "coming" frame. */
  src?: string;
  poster?: string;
  /** Caption under the frame. */
  caption?: string;
  /** Aspect ratio of the frame; default 16/9. */
  ratio?: string;
}

export function VideoSlot({ src, poster, caption, ratio = '16 / 9' }: VideoSlotProps) {
  return (
    <figure className="my-4">
      <div
        className="relative w-full overflow-hidden rounded-2xl border shadow-card-lift"
        style={{ aspectRatio: ratio, borderColor: 'var(--color-hairline-bold)', backgroundColor: 'var(--color-paper-sunk)' }}
      >
        {src ? (
          <video src={src} poster={poster} controls preload="metadata" className="h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
            <span
              className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{ backgroundColor: 'var(--color-accent-soft)', color: 'var(--color-accent-ink)' }}
            >
              <Play aria-hidden="true" size={22} />
            </span>
            <span className="font-mono text-xs uppercase tracking-[0.1em] text-ink-mute">
              Walkthrough — coming
            </span>
          </div>
        )}
      </div>
      {caption && (
        <figcaption className="mt-3 text-center font-mono text-xs uppercase tracking-[0.1em] text-ink-mute">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
```

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit 2>&1 | grep -i "VideoSlot" || echo "no VideoSlot errors"` → expect "no VideoSlot errors"
Run: `npm run build` → success

- [ ] **Step 3: Commit**

```bash
git add components/VideoSlot.tsx
git commit -m "feat(content-system): reusable on-brand VideoSlot (coming-state + player)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Receipt assets

The Receipts section (Task 5) shows real proof. Collect three real screenshots into `public/content-system/`. Use the playwright-driver skill (Mode 1/2) OR ask Ivan to drop files. The page references these exact paths; if a file is missing the receipt card falls back to a framed empty state (built in Task 5), so a missing asset never breaks the build.

**Files:**
- Create dir + assets: `public/content-system/carousel.png`, `public/content-system/newsjack.png`, `public/content-system/lead-magnet.png` (and optional `public/content-system/walkthrough-poster.jpg`).

- [ ] **Step 1: Create the directory**

Run: `mkdir -p public/content-system`

- [ ] **Step 2: Capture or collect the three screenshots**

Preferred (real product proof):
- **carousel.png** — a finished carousel (a few slides) from the dashboard Styles/Posts surface or a published LinkedIn carousel.
- **newsjack.png** — the brand-newsjack post (e.g. the Fable-ban post, which was delivered) — a real on-brand newsjack image/post.
- **lead-magnet.png** — a live lead-magnet landing page from `resources.ivanmanfredi.com`.

Use the playwright-driver skill to screenshot the live LM page and a dashboard carousel at ~1200px wide, or have Ivan provide the files. Save with the exact names above.

- [ ] **Step 3: Confirm files exist**

Run: `ls -la public/content-system/`
Expected: the 3 PNGs present (poster optional).

- [ ] **Step 4: Commit**

```bash
git add public/content-system/
git commit -m "assets(content-system): real receipt screenshots (carousel, newsjack, lead magnet)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

> If real assets can't be gathered this pass, commit the directory with a `.gitkeep` and note it — Task 5's receipt cards render a graceful framed "sample" state when an image is absent, so the page still ships. Do NOT fabricate screenshots.

---

## Task 4: Rebuild ContentSystemPage — top half (hero → six promises)

Rebuild the page on the editorial system. This task covers the imports, meta, hero, video slot, problem→flip, the six promises, and the metrics strip. (Task 5 adds the bottom half.)

**Files:**
- Modify (rewrite): `components/ContentSystemPage.tsx`

USE the `frontend-grounded` skill for this task: ground in `brand-visual-system.md`, then build, then self-test with playwright-driver. Match the conventions in `components/FractionalPage.tsx` and `components/WorkPage.tsx` (same editorial primitives + tokens).

- [ ] **Step 1: Replace imports + meta + page shell + hero + video + problem-flip + promises + metrics**

Write the top of the new `ContentSystemPage.tsx`:

```tsx
import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useMetadata } from '../hooks/useMetadata';
import { T, ease, inView, prefersReduced, Label, RevealH2, SageSweep, MagneticCTA } from './editorial';
import { VideoSlot } from './VideoSlot';
import { PROMISES, METRICS } from '../lib/contentSystemContent';
import { motion } from 'framer-motion';

export default function ContentSystemPage() {
  useMetadata({
    title: 'Content System | Manfredi',
    description: 'An always-on content engine that decides what to post, writes it in your voice, refuses to ship AI slop, turns one idea into every format, and publishes itself. Five posts a week — without writing a word.',
    canonical: 'https://ivanmanfredi.com/content-system',
  });

  return (
    <div className="min-h-screen bg-paper">
      <div className="container mx-auto max-w-5xl px-6 pt-32 pb-24">

        {/* 1 — HERO */}
        <section className="mb-20">
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
            <MagneticCTA href="/start" fontSize="17px" px="px-9 py-4">
              Book a 20-min look <ArrowRight aria-hidden="true" size={18} />
            </MagneticCTA>
          </div>
        </section>

        {/* 2 — WALKTHROUGH VIDEO (slot reserved; pass src when filmed) */}
        <section className="mb-24">
          <VideoSlot caption="Watch the system run — 3 min" />
        </section>

        {/* 3 — PROBLEM → FLIP */}
        <section className="mb-24 max-w-3xl">
          <p className="text-lg md:text-xl text-ink-soft leading-relaxed">
            Showing up daily is the whole game — and it's the thing that always slips. The blank page,
            the posts that sound like everyone else, the weeks you go quiet.{' '}
            <span className="font-drama italic text-ink">This removes the bottleneck entirely.</span>{' '}
            Not a tool you operate — a system that operates itself, in your voice.
          </p>
        </section>

        {/* 4 — THE SIX PROMISES (why it's advanced) */}
        <section className="mb-24">
          <RevealH2 style={{ ...T.display('clamp(2rem,4vw,3rem)'), marginBottom: '2.5rem' }}>
            Why this isn't <span style={{ position: 'relative', display: 'inline-block' }}>
              "AI writes my posts."<SageSweep delay={0.4} opacity={0.85} />
            </span>
          </RevealH2>
          <div className="grid md:grid-cols-2 gap-x-10 gap-y-10">
            {PROMISES.map((p, i) => (
              <motion.div
                key={p.headline}
                initial={prefersReduced ? false : { opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.55, ease, delay: prefersReduced ? 0 : (i % 2) * 0.08 }}
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 border-y py-10"
               style={{ borderColor: 'var(--color-hairline)' }}>
            {METRICS.map((m) => (
              <div key={m.label} className="text-center">
                <div className="font-drama italic text-4xl md:text-5xl text-accent-ink leading-none">{m.value}</div>
                <div className="mt-2 text-sm text-ink-soft leading-snug">{m.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom half added in Task 5 (one-idea / lead magnets / receipts / scope / pricing+CTA) */}
      </div>
    </div>
  );
}
```

> Note: the page previously default-exported `ContentSystemPage`; keep it a default export so `App.tsx`'s existing `import ContentSystemPage from './ContentSystemPage'` (verify the exact import form in App.tsx and match it — named vs default).

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit 2>&1 | grep -i "ContentSystemPage" || echo "no page errors"` → "no page errors"
Run: `npm run build` → success

- [ ] **Step 3: Self-test with playwright-driver** — load `/content-system` at 1440×900 and 390×844; confirm hero, video slot ("Walkthrough — coming"), problem-flip, six promise cards, and the metrics strip render on-brand (cream bg, sage accents, DM Serif italic emphasis). Screenshot to `docs/superpowers/verification/page-top.png`.

- [ ] **Step 4: Commit**

```bash
git add components/ContentSystemPage.tsx
git commit -m "feat(content-system): rebuild page top — hero, video slot, six promises, metrics

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: ContentSystemPage — bottom half (one idea → lead magnets → receipts → scope → pricing/CTA)

Append the remaining sections inside the same container, before the closing `</div></div>`.

**Files:**
- Modify: `components/ContentSystemPage.tsx`

- [ ] **Step 1: Add imports for the bottom-half data + a receipts helper**

Extend the top import from the data module:
```tsx
import { PROMISES, METRICS, LM_FORMATS, LM_PROMISES, ONE_IDEA_FORMATS, SCOPE } from '../lib/contentSystemContent';
```

- [ ] **Step 2: Add the sections** (insert where the Task-4 comment marks "bottom half")

```tsx
        {/* 6 — ONE IDEA, EVERYWHERE */}
        <section className="mb-24">
          <RevealH2 style={{ ...T.display('clamp(1.8rem,3.6vw,2.6rem)'), marginBottom: '1.5rem' }}>
            One idea, <span style={{ position: 'relative', display: 'inline-block' }}>
              everywhere.<SageSweep delay={0.3} opacity={0.85} />
            </span>
          </RevealH2>
          <p className="max-w-2xl text-lg text-ink-soft leading-relaxed mb-8">
            A single approved idea fans out into every format you'd ever post — each one on-brand,
            each one in your voice.
          </p>
          <div className="flex flex-wrap gap-3">
            {ONE_IDEA_FORMATS.map((f) => (
              <span key={f}
                className="rounded-lg border px-4 py-2 text-sm text-ink"
                style={{ borderColor: 'var(--color-hairline-bold)', backgroundColor: 'var(--color-paper-raise)' }}>
                {f}
              </span>
            ))}
          </div>
        </section>

        {/* 7 — LEAD MAGNETS */}
        <section className="mb-24">
          <Label>Lead Magnets</Label>
          <RevealH2 style={{ ...T.display('clamp(2rem,4vw,3rem)'), margin: '1rem 0 1rem' }}>
            Turn attention into <span style={{ position: 'relative', display: 'inline-block' }}>
              qualified leads.<SageSweep delay={0.4} opacity={0.85} />
            </span>
          </RevealH2>
          <p className="max-w-2xl text-lg text-ink-soft leading-relaxed mb-10">
            From one idea, the system builds an interactive lead magnet, publishes it as a live hosted
            page, and routes every signup by how good a fit they are. You wake up to booked calls, not
            busywork.
          </p>

          {/* 10 formats */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
            {LM_FORMATS.map((f) => (
              <div key={f.name}
                className="rounded-xl border p-5"
                style={{ borderColor: 'var(--color-hairline)', backgroundColor: 'var(--color-paper-raise)' }}>
                <div className="flex items-center gap-2">
                  <h3 className="text-[15px] font-semibold tracking-tight">{f.name}</h3>
                  {f.coming && (
                    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">coming</span>
                  )}
                </div>
                <p className="mt-1.5 text-sm text-ink-soft leading-relaxed">{f.blurb}</p>
              </div>
            ))}
          </div>

          {/* 3 LM promises */}
          <div className="grid md:grid-cols-3 gap-8">
            {LM_PROMISES.map((p) => (
              <div key={p.headline} className="border-l border-accent pl-6">
                <h3 className="text-lg font-semibold tracking-tight">{p.headline}</h3>
                <p className="mt-2 text-[15px] text-ink-soft leading-relaxed">{p.benefit}</p>
                <p className="mt-3 font-mono text-xs uppercase tracking-[0.08em] text-ink-mute">How: {p.how}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 8 — RECEIPTS */}
        <section className="mb-24">
          <Label>Receipts</Label>
          <RevealH2 style={{ ...T.display('clamp(1.8rem,3.6vw,2.6rem)'), margin: '1rem 0 2rem' }}>
            Real output, not promises.
          </RevealH2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { src: '/content-system/carousel.png',    alt: 'A finished on-brand carousel',  cap: 'Carousel — 9 styles' },
              { src: '/content-system/newsjack.png',    alt: 'A breaking-news brand post',    cap: 'Newsjack — within hours' },
              { src: '/content-system/lead-magnet.png', alt: 'A live lead-magnet page',       cap: 'Lead magnet — live page' },
            ].map((r) => (
              <figure key={r.src}>
                <div className="overflow-hidden rounded-xl border"
                     style={{ borderColor: 'var(--color-hairline-bold)', backgroundColor: 'var(--color-paper-sunk)', aspectRatio: '4 / 5' }}>
                  {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role */}
                  <img src={r.src} alt={r.alt} loading="lazy" className="h-full w-full object-cover"
                       onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
                </div>
                <figcaption className="mt-2 text-center font-mono text-xs uppercase tracking-[0.1em] text-ink-mute">{r.cap}</figcaption>
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
                <li key={s} className="flex items-start gap-3 text-[15px] text-ink-soft leading-relaxed">
                  <span className="text-accent-ink mt-1 shrink-0">✓</span>{s}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <Label>Not in scope</Label>
            <ul className="mt-4 space-y-3">
              {SCOPE.notInScope.map((s) => (
                <li key={s} className="flex items-start gap-3 text-[15px] text-ink-mute leading-relaxed">
                  <span className="font-mono text-ink-mute mt-0.5 shrink-0">—</span>{s}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 10 — PRICING + FINAL CTA */}
        <section className="rounded-2xl border bg-black text-white p-10 md:p-16 text-center"
                 style={{ borderColor: 'var(--color-hairline-bold)' }}>
          <p className="font-mono text-xs uppercase tracking-[0.1em] text-zinc-400">Productized build · from $6k</p>
          <h2 className="mt-4 text-3xl md:text-4xl font-semibold tracking-tight">
            Ready to <span className="font-drama italic">stop writing posts?</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-zinc-300 leading-relaxed">
            Book a 20-minute look. We'll scope it to your channels, formats, and voice, and you'll get
            a fixed proposal — no obligation.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4">
            <MagneticCTA href="/start" dark fontSize="18px" px="px-10 py-5">
              Book a 20-min look <ArrowRight aria-hidden="true" size={18} />
            </MagneticCTA>
            <a href="/assessment" className="text-sm underline text-zinc-300 hover:text-white">
              Or take the Agent-Ready assessment first
            </a>
          </div>
        </section>
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit 2>&1 | grep -i "ContentSystemPage" || echo "no page errors"` → "no page errors"
Run: `npm run build` → success

- [ ] **Step 4: Commit**

```bash
git add components/ContentSystemPage.tsx
git commit -m "feat(content-system): rebuild page bottom — one-idea, lead magnets, receipts, scope, pricing/CTA

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: End-to-end visual + brand verification (playwright-driver + ascension-audit)

**Files:** none (verification). Screenshots to `docs/superpowers/verification/`.

- [ ] **Step 1:** `npm run dev`; capture the URL.
- [ ] **Step 2:** With playwright-driver, load `/content-system` at 1440×900 and 390×844. Confirm, in order: hero (cold hook + CTA), video slot, problem-flip, six promise cards (each with a grey "How:" line), metrics strip, "one idea" pills, Lead Magnets (10 format cards incl. "coming" tag on Live AI Walkthrough; 3 promises), receipts (3 frames; images load OR degrade gracefully if assets absent), scope/not-in-scope, dark pricing/CTA band. Screenshot full page at both widths to `docs/superpowers/verification/page-desktop.png` and `page-mobile.png`.
- [ ] **Step 3:** Confirm both CTAs point to `/start` and the secondary link to `/assessment` (read hrefs).
- [ ] **Step 4:** Confirm brand fidelity: cream `--color-paper` background, sage `--color-accent` accents, `font-drama` italic on emphasis words, mono uppercase labels. No dashboard `--d-*` tokens leaked in.
- [ ] **Step 5 (recommended):** Run the `ascension-audit` skill on `/content-system` (flow A–G + design H–L) and address any P1/P2 it raises.
- [ ] **Step 6:** Kill dev server. Commit screenshots:
```bash
git add docs/superpowers/verification/
git commit -m "test(content-system): page visual + brand verification screenshots

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (against spec §4)

- **§4.1 Hero (cold hook + outcome + CTA)** → Task 4 hero. ✔
- **§4.2 Walkthrough video slot (reserved)** → Task 2 `VideoSlot` + Task 4 placement; films later by passing `src`. ✔
- **§4.3 Problem→flip** → Task 4. ✔
- **§4.4 Six promises (deep "why advanced", outcome-led + how lines)** → Task 1 `PROMISES` + Task 4 render. ✔
- **§4.5 "One idea, everywhere"** → Task 1 `ONE_IDEA_FORMATS` + Task 5. ✔
- **§4.6 Lead Magnets (10 formats + 3 promises)** → Task 1 `LM_FORMATS`/`LM_PROMISES` + Task 5. ✔
- **§4.7 Receipts (real screenshots)** → Task 3 assets + Task 5 render with graceful fallback. ✔
- **§4.8 Scope / not in scope** → Task 1 `SCOPE` + Task 5. ✔
- **§4.9 Pricing + final CTA (unchanged $6k)** → Task 5. ✔
- **Honesty rule** → Task 1 test asserts only "Live AI Walkthrough" is marked `coming`; no pending capability claimed. ✔
- **Works cold + leave-behind** → outcome hook first, deep proof + receipts below; video for warm viewers. ✔
- **Brand fidelity** → editorial primitives + tokens; Task 6 verifies + ascension-audit. ✔
- **Type/name consistency:** data exports (`PROMISES`, `METRICS`, `LM_FORMATS`, `LM_PROMISES`, `ONE_IDEA_FORMATS`, `SCOPE`) defined once in Task 1, imported in Tasks 4–5; `VideoSlot` props consistent. ✔

> Execution caveats: (1) confirm `App.tsx` imports the page as a default export and keep that shape; (2) `MagneticCTA` prop names (`href`, `dark`, `fontSize`, `px`, `variant`) — verify against `components/editorial.tsx` and adjust usage if signatures differ; (3) `RevealH2`/`SageSweep`/`T` usage should mirror `WorkPage.tsx` exactly; (4) if receipt assets aren't ready, the `onError` fallback keeps the page clean — don't fabricate screenshots.
