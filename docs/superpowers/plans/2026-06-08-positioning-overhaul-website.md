# Positioning Overhaul (Website) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reposition the public website from Blueprint-front-door / Fractional-retainer to a specialist surface — sharpened hero, 3-build Offers grid (Content System · Call Intelligence signature · Fractional wrapper), a new `/call-intelligence` page, and a reframed `/fractional` page — with a free fit call as the universal door.

**Architecture:** React + Vite + react-router-dom SPA. Pages are components in `components/`, registered as `<Route>` entries in `App.tsx` and imported at the top. Brand system: paper + sage (`bg-paper`, `text-accent`/`#2A8F65`), fonts DM Serif Display (headings), Source Serif 4 (body), IBM Plex Mono (eyebrows). No test runner — **verification is `npm run build` (Vite typecheck) + Playwright screenshots via the `playwright-driver` skill** (per the rule that visual work needs self-tested screenshots, not just functional asserts).

**Tech Stack:** React 18, TypeScript, Vite, react-router-dom, framer-motion, lucide-react, Tailwind utility classes + CSS vars.

**Scope:** Website code only. LinkedIn profile + content-angle (spec surfaces 5–6) are a separate copy-deliverable, not part of this code plan (see "Out of scope / follow-up" at the end).

**Source spec:** `docs/superpowers/specs/2026-06-08-positioning-overhaul-deliverables-led-design.md`

---

## Required input before starting

- **Call Intelligence pricing.** Not yet set (offer is unproductized). This plan uses a **no-number framing** — card cadence "Installed system", and the page states pricing is "scoped on a fit call." If Ivan provides a number before execution, substitute it in Task 2 (card) and Task 3 (pricing section). Do NOT invent a price.

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `components/LandingHero.tsx` | Modify | Sharpen subhead + add 3 outcome bullets |
| `components/Offers.tsx` | Modify | Rebuild offers array (3 cards) + catch-all line |
| `components/CallIntelligencePage.tsx` | Create | New `/call-intelligence` landing page |
| `App.tsx` | Modify | Import + register `/call-intelligence` route |
| `components/FractionalPage.tsx` | Modify | Reframe retainer/embedded copy → partnership/continuation |

---

## Task 0: Isolated worktree

**Why:** `personal-site` has live automation committing to `main` and switching branches on the shared tree. Feature work MUST happen in an isolated worktree, never the shared tree.

- [ ] **Step 1: Create the worktree**

REQUIRED SUB-SKILL: Use `superpowers:using-git-worktrees` to create an isolated worktree off `main` for branch `feat/positioning-overhaul`. Run all subsequent tasks inside that worktree. If the skill is unavailable, fall back to:

```bash
cd ~/Desktop/personal-site
git worktree add -b feat/positioning-overhaul ../personal-site-positioning main
cd ../personal-site-positioning
npm install
```

- [ ] **Step 2: Verify clean baseline build**

Run: `npm run build`
Expected: build succeeds with no TypeScript errors. (Establishes a green baseline before changes.)

---

## Task 1: Hero — sharpen subhead + add outcome bullets

**Files:**
- Modify: `components/LandingHero.tsx` (subhead `<p>` at ~241-246; insert bullet row between the `<p>` and the CTAs `<motion.div>` at ~249)

- [ ] **Step 1: Replace the subhead copy**

Find the subhead paragraph text (currently "AI systems for growing service businesses, so you scale without scaling payroll. Hiring another person just buys a bigger team and the same bottleneck: you.") and replace its inner content with:

```
Growth and retention systems for service businesses —
so you add pipeline and margin without adding payroll.
<span style={{ fontStyle: 'italic', color: '#1A1A1A', fontWeight: 500 }}>Stop being the bottleneck in your own company.</span>
```

Keep the existing `<motion.p>` wrapper, classes, and animation untouched — only swap the inner text/spans.

- [ ] **Step 2: Add the outcome-bullet row**

Immediately after the closing `</motion.p>` of the subhead and before the CTA `<motion.div>`, insert a bullet row. Match the hero's existing visual language (IBM Plex Mono eyebrow style, sage accent). Use this content (three items):

- "More pipeline without more hires"
- "Win more of the deals you're already in"
- "Clients that don't quietly churn"

Implementation (framer-motion fade-in consistent with siblings, sage check glyphs):

```tsx
<motion.ul
  initial={{ opacity: 0, y: 16 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 1.05, duration: 0.7, ease }}
  className="mb-10 flex flex-col sm:flex-row gap-x-6 gap-y-2"
  style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: '13px', color: '#3D3D3B', letterSpacing: '0.01em' }}
>
  {['More pipeline without more hires', "Win more of the deals you're already in", "Clients that don't quietly churn"].map((b) => (
    <li key={b} className="flex items-center gap-2">
      <span style={{ color: '#2A8F65' }} aria-hidden="true">✓</span>
      {b}
    </li>
  ))}
</motion.ul>
```

(`ease` is already defined at the top of the file.)

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: PASS, no TS errors.

- [ ] **Step 4: Commit**

```bash
git add components/LandingHero.tsx
git commit -m "feat(hero): sharpen subhead to niche framing + add outcome bullets"
```

---

## Task 2: Offers grid — 3-build specialist surface

**Files:**
- Modify: `components/Offers.tsx` (the `offers` array at lines 17-56; add catch-all line after the grid `</div>` near line 136)

- [ ] **Step 1: Replace the `offers` array**

Replace the entire `offers: Offer[]` array (currently 4 entries: Blueprint, Fractional, Lead Magnet, Content Engine) with these 3 entries. This removes the Blueprint card, merges Lead Magnet + Content Engine into one **Content System** card, adds **Call Intelligence** as the highlighted signature card, and reframes Fractional (no "retainer" language):

```tsx
const offers: Offer[] = [
  {
    id: '01',
    name: 'Content System',
    price: 'From $7k',
    cadence: '3-week build',
    description: 'Your growth engine: lead magnets plus a content engine trained on your voice. New pipeline without new hires — you approve, the system ships.',
    href: '/content-system',
    cta: 'Scope your build',
  },
  {
    id: '02',
    name: 'Call Intelligence',
    price: 'Installed system',
    cadence: 'Scoped on a fit call',
    description: "Close more of the deals you're already in. It scores every sales call, flags the accounts about to churn, and shows you exactly why deals slip.",
    href: '/call-intelligence',
    cta: 'See how it works',
    highlighted: true,
  },
  {
    id: '03',
    name: 'Fractional AI Partner',
    price: 'From $3,500/mo',
    cadence: 'Ongoing partnership',
    description: 'Want me building alongside you month over month? An embedded senior partner at an intensity you control. Step up for big builds, down as things settle — no lock-in.',
    href: '/fractional',
    cta: 'Explore partnership',
  },
];
```

Note: the `highlighted` card already renders the dark "Start here"-style treatment via existing logic. With Call Intelligence highlighted, update the highlight badge text (Step 2).

- [ ] **Step 2: Update the highlight badge label**

The highlighted card currently shows "Start here" (Offers.tsx ~100-103). Change that badge text to **"Signature"** so the highlight reads as "this is the differentiator," not "start here" (the fit call is the real start). Find:

```tsx
Start here
```

Replace with:

```tsx
Signature
```

- [ ] **Step 3: Add the catch-all fit-call line under the grid**

After the offers grid container closes (`</div>` ending the `grid md:grid-cols-2` block, ~line 136) and before the section's closing `</div>`, add:

```tsx
<motion.p
  initial={{ opacity: 0, y: 16 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true }}
  transition={{ duration: 0.6 }}
  className="mt-10 text-center text-[15px] text-ink-soft"
  style={{ fontFamily: '"Source Serif 4", Georgia, serif' }}
>
  Working on something that's not here?{' '}
  <a href="/start" className="underline decoration-[#2A8F65] underline-offset-4 hover:text-black">
    The call is for that too
  </a>{' '}
  — I scope custom builds for service businesses every week.
</motion.p>
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: PASS. (If `highlighted`/`creditNote` typing complains, note the `Offer` interface keeps `creditNote?` optional — leaving it unused is fine.)

- [ ] **Step 5: Commit**

```bash
git add components/Offers.tsx
git commit -m "feat(offers): 3-build specialist grid — drop Blueprint, add Call Intelligence signature, reframe Fractional, catch-all line"
```

---

## Task 3: New `/call-intelligence` page

**Files:**
- Create: `components/CallIntelligencePage.tsx`
- Modify: `App.tsx` (add import ~line 19; add route ~line 202)

Mirror the structure, brand classes, and section components of `components/LeadMagnetSystemPage.tsx` (hero → TL;DR → price/scope box → benefits → under-the-hood → qualifier → not-included → final CTA). Use the exact copy below; reuse the existing styling patterns from that file so the new page is visually consistent (eyebrow span, `font-drama italic` for emphasis, `btn-magnetic ... bg-accent` CTA buttons, `<Helmet>`/meta if that page uses it).

**Exact page copy (section by section):**

- **Eyebrow:** `Call Intelligence · Win-rate system`
- **H1:** `Close more of the deals you're already in.`
- **Hero sub:** `An installed system that scores every sales and client call, flags the accounts about to churn, and shows you exactly why deals slip — so you fix what's costing you revenue you can already see.`
- **Primary CTA:** `Book your fit call` → `/start`

- **TL;DR:** `Most agencies obsess over getting more leads while quietly losing the ones they have — on calls nobody reviews. Call Intelligence turns every call into data: a per-rep scorecard, churn-risk alerts on at-risk accounts, and the patterns behind why deals die. You stop guessing why you're losing and start closing more of what's already in the pipeline.`

- **What you get (benefits — lead with outcomes):**
  - `Win more of the deals you already have — see exactly where calls go wrong and fix it.`
  - `Catch churn before it happens — early-warning flags on accounts going cold.`
  - `Know which reps need coaching — per-person scoring across every call, automatically.`
  - `No new leads required — this is revenue from pipeline you've already paid to create.`

- **How it works (under the hood):**
  - `Plugs into your existing call recorder — once it's installed, every new call is scored automatically.`
  - `A dashboard with per-rep scores, churn-risk flags, and the recurring reasons deals slip.`
  - `Head-start bonus: if your call tool is queryable (Fireflies, Fathom, Otter, tl;dv), I'll retro-score your last ~30 calls so you get value on day one.`

- **Qualifier block (small, before CTA):** Heading `One question to scope it:` Body `What do you use to record your sales and client calls? (Fireflies / Fathom / Otter / Gong / Zoom / nothing yet.) If nothing, step one is a lightweight recorder — then we install.`

- **Pricing note:** `Pricing is scoped to your call volume and stack on the fit call — every setup is a little different.` (Replace with a fixed number only if Ivan provides one.)

- **Not included / honest scope:** `This finds and fixes the deals you're losing on calls. It doesn't generate new top-of-funnel leads — that's the Content System. If your bottleneck is "not enough leads," start there instead.`

- **Final CTA:** Heading `See where your deals are leaking.` Button `Book your fit call` → `/start`

- [ ] **Step 1: Create the page component**

Create `components/CallIntelligencePage.tsx` as a `React.FC` mirroring `LeadMagnetSystemPage.tsx`'s layout and styling, populated with the copy above. Keep section order: hero, TL;DR, benefits, how-it-works, qualifier, pricing note, not-included, final CTA. Use `href="/start"` for both CTAs.

- [ ] **Step 2: Register import in `App.tsx`**

Add after the existing offer-page imports (~line 19):

```tsx
import CallIntelligencePage from './components/CallIntelligencePage';
```

- [ ] **Step 3: Register route in `App.tsx`**

Add inside the main `<Routes>` block, next to the other offer routes (after line 202 `/fractional`):

```tsx
<Route path="/call-intelligence" element={<CallIntelligencePage />} />
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: PASS, no TS errors, route resolves.

- [ ] **Step 5: Commit**

```bash
git add components/CallIntelligencePage.tsx App.tsx
git commit -m "feat(call-intelligence): add /call-intelligence landing page (win-rate framing)"
```

---

## Task 4: Reframe `/fractional` — retainer/access → ongoing partnership

**Files:**
- Modify: `components/FractionalPage.tsx` (meta ~132-133; hero eyebrow ~149; H1 ~159-160; hero sub ~169)

Goal: shift the top-level framing from "monthly retainer / senior partner embedded (cold entry)" to "ongoing partnership / where engagements continue." Keep the tier mechanics (intensity dials, no lock-in) — those are already good. Do NOT add cross-promotion of other offers (keep the page self-contained).

- [ ] **Step 1: Reframe the meta description (~line 132-133)**

Replace the `description` value:

```
Ongoing partnership for service businesses that want a senior AI operator building alongside them month over month. Intensity you control, no lock-in — step up for big builds, down as things settle.
```

- [ ] **Step 2: Reframe the hero eyebrow (~line 149)**

Replace `Fractional AI Partner · Senior operator, ongoing` with:

```
Fractional AI Partner · Ongoing partnership
```

- [ ] **Step 3: Reframe the H1 (~line 159-160)**

Replace `A senior AI partner, <br /> embedded in your business.` with:

```tsx
A senior AI partner who <br />
<span className="font-drama italic">keeps building with you.</span>
```

- [ ] **Step 4: Reframe the hero sub (~line 169)**

Replace the "Monthly engagement. Pick an intensity..." sentence with:

```
For clients who want to keep going after the first build. Pick an intensity that matches the work ahead — heavy month for big builds, lighter cadence as things settle. No retainer lock-in.
```

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/FractionalPage.tsx
git commit -m "feat(fractional): reframe from retainer/access to ongoing partnership / continuation"
```

---

## Task 5: Visual verification (screenshots)

**Why:** No unit tests exist, and per project rule visual/positioning work must be self-verified with screenshots before claiming done — functional/build pass alone is insufficient.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (note the localhost URL, typically `http://localhost:5173`)

- [ ] **Step 2: Screenshot each changed surface (desktop + mobile)**

REQUIRED SUB-SKILL: Use the `playwright-driver` skill (Mode 1 — inspect) to capture screenshots at desktop (1440) and mobile (390) widths for:
- `/` (hero + offers grid + catch-all line)
- `/call-intelligence`
- `/fractional`

- [ ] **Step 3: Review against the spec**

Confirm visually:
- Hero shows the new subhead + 3 outcome bullets; CTAs intact.
- Offers grid shows exactly 3 cards (no Blueprint), Call Intelligence is the highlighted "Signature" card, Fractional reads as partnership (no "retainer"), catch-all line present.
- `/call-intelligence` renders all sections, win-rate H1, both CTAs → `/start`.
- `/fractional` hero reframed; tiers still render; no other-offer cross-promo.
- No layout breakage at 390px.

Fix any visual issues inline and re-screenshot before proceeding. (Copy/spacing iteration here is expected — use the `frontend-design` skill if the new page needs polish.)

- [ ] **Step 4: Final full build**

Run: `npm run build`
Expected: PASS.

---

## Task 6: Finish the branch

- [ ] **Step 1: Integrate**

REQUIRED SUB-SKILL: Use `superpowers:finishing-a-development-branch` to choose how to integrate `feat/positioning-overhaul`. Note: deploy is `git push origin main` only; given the live-automation hazard on the shared tree, push the feature branch via refspec / merge per the worktree workflow rather than switching branches on the shared checkout.

- [ ] **Step 2: Clean up the worktree** once merged (per using-git-worktrees skill).

---

## Out of scope / follow-up (not this plan)
- **LinkedIn profile** (headline / About / Featured) — copy deliverable: audit current profile, then draft. Handle after website ships.
- **LinkedIn content angle** — ongoing positioning guideline, to be folded into the content system's voice/strategy prompts.
- **Call Intelligence productization** (sell-then-productize) — building the actual system is separate from this positioning work.
- **Blueprint backend** — untouched; only removed from the public grid. `/assessment` route stays live for warm/direct use.

## Self-review notes (author)
- Spec coverage: Surface 1 → Task 1; Surface 2 → Task 2; Surface 3 → Task 3; Surface 4 → Task 4; Surfaces 5–6 → explicitly deferred (copy, not code). Verification (visual-self-test rule) → Task 5.
- Open item carried forward: Call Intelligence price (no fabricated number; no-price framing used).
- Type consistency: reuses existing `Offer` interface (`highlighted?`, `creditNote?` optional) — new entries omit `creditNote`, which is valid.
