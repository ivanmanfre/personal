# The Working Page — Landing Revamp Design (Option B)

**Date:** 2026-06-11
**Status:** Approved direction (Ivan, 2026-06-11) — Option B, live status strip explicitly cut.
**Surfaces:** `components/LandingPage.tsx`, `components/LandingHero.tsx`, new `components/landing/diagrams/*`, plus `~/.claude/memory/global/brand-visual-system.md`.

## 1. Goal

The landing page currently *tells* "I build systems" in editorial serif but never *shows* a system. This revamp keeps the optimized copy arc and section structure (June 10 readability/flow passes stay intact) and adds three demonstration scenes that make the page behave like one of Ivan's running systems.

**Governing principle: motion demonstrates the system, it doesn't decorate the page.** Every scene is a persuasion device — proof, not spectacle. Conversion outranks technical impressiveness everywhere a tradeoff appears.

**Success criteria:**

1. A first-time visitor can *see* what a built system looks like within the first viewport.
2. No CTA moves; the June 10 max-CTA-gap discipline holds (≤ ~2,600px desktop between asks, pinned scroll distance included).
3. Lighthouse/perf: no LCP regression, zero CLS from the new scenes, added JS ≤ 60KB gzipped.
4. Reduced-motion and mobile users get complete, legible static equivalents — no blank or broken states.
5. Every receipt shown is real (verified by Ivan before ship) — no invented numbers, per the fake-stats rejection of 2026-05-06.

## 2. Out of scope

- **Live status strip** (Supabase-fed real-time counters) — cut by Ivan 2026-06-11: conversion over technical flash. Revisit later if ever.
- three.js / WebGL — rejected: flat ink-on-paper is the brand; 3D/glow is on the forbidden list.
- Other pages (sub-pages, LM engines, dashboard). They adopt the diagram language later via the brand doc.
- Copy changes beyond receipt lines. The June 10 copy arc is frozen.

## 3. Tech approach

- **Add `gsap` + `ScrollTrigger`** (npm, ~36KB gz combined). Scoped to the three scenes only; framer-motion stays for everything else on the page. No other GSAP plugins.
- New module `components/landing/diagrams/` containing:
  - `tokens.ts` — the diagram language constants (single source for node/connector/pulse styles).
  - `DiagramNode.tsx`, `DiagramPath.tsx` — SVG primitives.
  - `SignalPulse.tsx` — the traveling sage pulse (a small sage square or dash moving along an SVG path via GSAP `MotionPathPlugin`-free technique: `stroke-dashoffset` animation on a sage overlay path — keeps bundle minimal).
  - One component per scene: `HeroPipeline.tsx`, `ProcessAssembly.tsx`, `BuildCardDiagram.tsx`.
- **Reduced motion:** every scene checks the existing `prefersReduced` pattern. Fallback = the diagram's *final* state rendered statically (fully drawn, signal path solid sage). Never hidden, never mid-animation.
- **Init discipline:** scenes initialize after first paint (`requestIdleCallback` / `useEffect` post-mount); SVG containers have fixed aspect-ratio boxes so layout never shifts.
- **Pinning hygiene:** exactly one pinned section on the page (Scene 2). ScrollTrigger pin uses `pinSpacing: true` with reserved height so the page length is deterministic.

## 4. The diagram language (shared spec)

These tokens go in `tokens.ts` AND get canonicalized in `brand-visual-system.md` (§9 below).

| Element | Spec |
|---|---|
| Node | Sharp-cornered rect, 1px stroke `rgba(26,26,26,0.35)`, fill `var(--color-paper)`, no radius, no shadow |
| Node label | IBM Plex Mono 11px, uppercase, tracking 0.14em, `#5A5752`; inside or below the node |
| Node state: done | Stroke shifts to `#1A1A1A`, tiny sage square (6×6px) appears at the node's top-right corner |
| Connector | 1px line `rgba(26,26,26,0.25)`, square ends, orthogonal or gently curved — never arrowheads larger than 6px |
| Signal path | The ONE active path per diagram renders in sage `#2A8F65`, 1.5px. Sage is punctuation: one lit path per diagram, never all paths |
| Signal pulse | 8px sage square (sharp corners) traveling the path, or an animated sage dash segment; 0.85s per hop, ease `[0.22, 0.84, 0.36, 1]` (house ease) |
| Failure/before state | Muted pink `#E8366D`, 1px, used ONLY for the "before" or error branch in a before/after diagram. Its single sanctioned job |
| Counter | IBM Plex Mono, settles on a real number; numerals may upgrade to the italic-serif numeral lockup when featured |
| Canvas | Always on paper (`--color-paper` or `--color-paper-sunk`); diagrams never sit on dark bands |

## 5. Scene 1 — Hero: the system runs under the cover

**What:** A horizontal pipeline strip across the bottom of the hero viewport — full container width, ~110–130px tall, sitting below the copy/CTA block and beneath the portrait's bottom edge. Thin ink nodes + connectors, mono labels, one sage signal pulse looping end-to-end (~7s cycle, 2s rest between cycles).

**The pipeline is real — Call Intelligence (signature offer):**

`CALL RECORDED → TRANSCRIBED → GRADED VS 8-CRITERIA RUBRIC → RISK FLAGGED → ROUTED < 1 HR`

Five nodes. As the pulse passes each node, the node ticks to its done state (stroke darkens, sage corner square appears). After the last node, a small mono caption at the strip's right end: `every call · daily` (verbatim from the live case data).

**Why this placement:** the headline/portrait magazine cover stays untouched (it converts; don't fight it). The strip occupies currently-empty hero bottom space and reads as "work happening under the surface" — operator signal without competing with the CTA. Desktop shows it fully; the hero remains `min-h-screen` with the strip inside the first viewport at ≥1280px.

**Mobile (<1024px):** static fully-drawn version compressed to 3 nodes (`RECORDED → GRADED → ROUTED`) so it fits 375px without scrolling. No pulse loop on mobile (battery + noise) — static sage path.

**Reduced motion:** static, fully drawn, sage path solid.

## 6. Scene 2 — Process section becomes a pinned assembly

**What:** `WorkSection` ("Diagnose first. Build second.") gains a pinned diagram canvas. Section pins for **150vh of scroll** (modest — conversion guardrail). Layout: existing three step rows compress to the left column (~40% width, copy unchanged); right column (~55%) is one persistent diagram canvas replacing the three small decorative icons.

**Choreography (scroll-scrubbed, three stages mapped to the three rows; the active row highlights as its stage plays):**

1. **Diagnose (0 → 33%):** scattered nodes fade in one by one with mono labels naming real leak points — `MANUAL TRIAGE`, `PARTNER REVIEW`, `RE-KEYED DATA`, `APPROVAL QUEUE`, `STATUS CHASING`. Disconnected. One node gets a pink 1px outline (the costliest leak — the "before" state earning pink its job).
2. **Design (33 → 66%):** connectors draw between the nodes (stroke-dashoffset line drawing), the scatter reorganizes into an ordered left-to-right pipeline (GSAP position tween). The pink outline resolves to ink as the node gets wired in.
3. **Build (66 → 100%):** the sage signal pulse runs the assembled pipeline end-to-end; two mono counters settle beneath the canvas using real case numbers: `5% → 100% calls graded` and `multi-FTE → same-day turnaround` (both verbatim from the live OUTCOMES data).

**Exit:** pin releases; the existing `MidCTA` placement after this zone is preserved so the added 150vh doesn't open a CTA dead zone (verify measured gap post-build).

**Mobile (<1024px):** NO pin. The three step rows render as today, each with a small static snapshot of its stage (scatter / wired / running) where the icons used to be. Scroll-scrub pinning on touch is a known conversion killer — never ship it on mobile.

**Reduced motion:** no pin, final assembled state with solid sage path and settled counters.

## 7. Scene 3 — Build cards carry micro-diagrams + receipts

**What:** each of the 4 `OUTCOMES` cards gets:

1. **A micro-diagram** (static SVG, 3–5 nodes, ~48px tall) between the metric and the story text. On hover, the card's signal path lights sage (CSS transition or one GSAP tween — cheap). On touch devices the path is simply always sage.
2. **A receipt line** in mono at the card footer (replacing/extending the current `qualifier`), with real operational facts.

**Per-card pipelines (from the actual builds):**

| Card | Micro-diagram | Receipt line (candidate — Ivan verifies each before ship) |
|---|---|---|
| Sales-Call Auditor | `call → transcript → rubric → route` | `running daily · every call graded` |
| Lead Magnet System | `idea → page → email → link → post` | `idea to launched: 15 min` |
| SWPPP Automation | `intake → state rules → research → delivered` | `live across 50 states` |
| Supplier Menu Sync | `whatsapp / sites / sheets → consolidate → sheet` | `refreshes hourly` |

**Acceptance rule:** every receipt line must be confirmed-real by Ivan at review. If a candidate can't be verified, it's replaced with a verifiable one — never softened into something vague, never invented.

## 8. Conversion guardrails (checked at verification, not optional)

1. All existing CTAs keep their position and copy. `MidCTA` instances stay.
2. Max gap between asks ≤ June 10 values (~2,600px desktop / ~3,600 mobile), measured *with* the 150vh pin included.
3. Words-per-viewport corridor unchanged (scenes add diagrams, not text).
4. Page weight: added JS ≤ 60KB gz; diagrams are inline SVG (no image requests).
5. The offers grid remains the page's single dark band; all diagrams live on paper.
6. Sweep economy holds (2 sage sweeps on page); the diagram signal paths are a different element class and don't count against it, but max one looping animation visible per viewport.

## 9. Brand doc update (ships with this work)

`brand-visual-system.md` gains, in the same change cycle:

1. **Evidence Register** section — every brand surface carries ≥1 real receipt; invented/rounded numbers forbidden.
2. **Mono register** spec — mono is the system's voice (data, statuses, logs, field names); serif speaks, mono proves; sizes 11/13/18–20px.
3. **Diagram language** — the §4 token table above, written as the canonical cross-surface spec (site, carousels, infographics, flow videos).
4. **Motion** section — governing principle ("demonstrates, not decorates"), confirmed moves (sweep, spotlight), new vocabulary (signal pulse, node tick, settling counter), economy rules, reduced-motion requirement.
5. **Numeral lockup** named + specced (italic DM Serif numeral + mono-caps label).
6. Hygiene: contrast ladder (sage <19px on paper → `#1F6B4B` ink), italic-as-body ban, one-dark-band rule, micro-type floor (11px), palette table updated to sage family (`#2A8F65` / `#4FB286` / `#1F6B4B`).

## 10. Verification

- Playwright (playwright-driver Mode 1): screenshots at 375/768/1440, normal AND `reducedMotion: 'reduce'`, plus 4–5 scroll positions through the pinned scene. Console clean, zero network failures.
- Self-test screenshots reviewed before reporting done (per `feedback-visual-work-test-yourself`).
- Measured: CTA max gap, pin scroll length, CLS (compare `layout-shift` entries before/after), bundle delta (`vite build` size report).
- `tsc` clean for touched files; existing tests pass.
- Ivan reviews receipt lines + one full walkthrough before deploy.

## 11. Build/deploy notes

- Work in an isolated worktree, push via `HEAD:main` refspec (per `personal-site-concurrent-git-hazard` — live automation commits on main).
- Suggested phases: (1) diagram primitives + tokens, (2) Scene 3 cards (lowest risk, ships value alone), (3) Scene 1 hero strip, (4) Scene 2 pinned assembly, (5) brand doc update, (6) verification pass. Each phase independently shippable.
