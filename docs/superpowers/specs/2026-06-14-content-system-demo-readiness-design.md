# Content System — Demo Readiness Design

**Date:** 2026-06-14
**Author:** Ivan (with Claude)
**Status:** Approved for planning
**Scope of this spec:** Two surfaces — (A) the live dashboard demo experience, (B) the public `/content-system` page. A walkthrough video is explicitly **deferred** to after the dashboard ships (it films the cleaned-up dashboard).

---

## 1. Goal & context

Ivan demos the content system live on sales calls. Two problems:

1. **The live surface (dashboard)** isn't self-evidently impressive or legible. A first-time viewer can't follow "what does what," there's no guided path, and v2 chrome wrapping v1 panels creates visual seams.
2. **The public `/content-system` page** *asserts* the system is advanced (thin "Under the Hood" list) but doesn't *prove* it, and omits lead magnets entirely.

This spec makes both demo-ready and makes the page work **both cold (for strangers) and as a leave-behind (around a call)**.

### Hard constraints / principles
- **Sell outcomes, never plumbing.** No node counts, no "N LLM calls," no internal jargon in buyer-facing copy. Technical sophistication appears ONLY as a small "how it's possible" proof line under an outcome.
- **Honesty rule:** only the **28 live + validated** capabilities may be claimed. The ~15 partial/pending capabilities (see §6) are off-limits in copy and the guided tour.
- **Real dashboard, not a fake demo.** The guided tour drives the actual dashboard-v2 UI; nothing is mocked.
- Brand-locked surfaces → build per `brand-visual-system.md` (use the `frontend-grounded` skill at implementation).

---

## 2. The shared spine — six outcome promises

Both surfaces tell ONE story as six outcome promises. The dashboard *demonstrates* them; the page *narrates* them.

1. **Never face a blank page** — it decides what to post. *How: 6-source idea curator + nightly fit-scoring brain.*
2. **It sounds like you — not AI** — trained on your voice, grounded in your real calls. *How: voice training + retrieval over your transcripts.*
3. **It never ships slop** — every post quality-checked and rewritten until it passes. *How: deterministic quality gates + a 9-point review that self-rewrites.*
4. **One idea becomes everything** — post, carousel (9 styles), short video, lead magnet. *How: multi-format engine with on-brand, real-logo rendering.*
5. **Always first to the trend** — on-brand post ready within hours of a breaking AI story. *How: news radar scanning every 2h + instant alert.*
6. **It runs — and learns** — native LinkedIn publishing, self-publishing lead magnets, performance loop. *How: native publishing + 10 LM formats + performance tracking.*

**Buyer-facing numbers (the only ones allowed):** 5+ posts/week in your voice · 0 blank pages · 10 lead-magnet formats that build themselves · on a trend in hours, not days · 9 on-brand carousel styles.

---

## 3. Part A — Dashboard demo experience

Built on the **real dashboard-v2** (`components/dashboard-v2/`). Scoped to the **demo path only** — Briefing, Content Studio ▸ Posts, Lead Magnets, Styles, Calendar, Performance, Video — NOT all ~30 panels.

### A1. Guided Tour mode
- Opt-in entry: a **"▶ Tour"** control in the dashboard-v2 shell header, plus a `?tour=1` deep link.
- Drives the real UI through **7 stops** mapped to the six promises:
  1. **Briefing (home)** — "your system's status at a glance" (promise framing: it runs).
  2. **Content Studio ▸ Posts (board view)** — the lifecycle idea→generating→review→approved→scheduled→published (promises 1 + 6).
  3. **Open a post in `review`** — surface the QA/voice (promises 2 + 3).
  4. **Calendar** — the publishing rhythm (promise 6).
  5. **Lead Magnets** — one idea → live resource + qualified capture (promise 6 / LM pillar).
  6. **Styles / formats** — one idea → 9 carousel styles + video (promise 4).
  7. **Performance** — it measures and learns (promise 6).
- **Narrator card:** small fixed card (bottom-right) per stop — outcome headline + one line + "Next"/"Back"/"End tour". Gentle spotlight/scroll to the relevant panel.
- **Demo-safe routing:** the tour only visits demo-path surfaces and **skips anything flagged unfinished** (Agent stub, idle Video Pipeline, empty Call Clips, Newsletter). Introduce a lightweight `demoSafe` flag/registry so the tour route is data-driven.
- New component(s): `dashboard-v2/tour/` — `TourProvider` (state, current stop, navigation), `TourNarratorCard`, a `useTourSpotlight` hook. Tour steps defined declaratively (section id + selector + copy).

### A2. Per-screen self-explanation
- **`PanelIntro` primitive** (`dashboard-v2/primitives/`): a one-line purpose header + an optional "?" popover containing the deeper "how." Added to each demo-path panel.
- **Status-lifecycle legend:** a small reusable legend component for the kanban/status chips (idea → generating → review → approved → scheduled → published) so a viewer instantly reads the board. Reuse the existing status-dot/chip styling.
- **Empty states:** replace empty card grids on demo-path panels with a one-line "what shows here" + a sample/illustration (extend the existing `EmptyState` shared component).

### A3. Visual consistency pass (demo path only)
- Standardize on the v2 tokens/primitives across the demo-path panels so v1/v2 seams disappear where shown live: panel header (`HeadRow`), card radius/shadow (`--d-r`, shadow tokens), the **status chip** component, KPI tiles (`KpiRow`/`KpiTile`), and the spacing scale.
- Out of scope: migrating non-demo panels (Outreach, Clients, Health, Upwork, etc.). They keep working; they're just not on the tour and not part of the consistency pass.

### A4. Dashboard success criteria
- A first-time viewer can start the Tour and follow the full idea→published→measured story with zero explanation.
- Every demo-path panel states its purpose in one line on screen.
- No visible v1/v2 styling seam on any demo-path panel.
- The Tour never lands on an unfinished/empty surface.

---

## 4. Part B — `/content-system` page

Rebuild of `components/ContentSystemPage.tsx`, outcome-first, working cold AND as a leave-behind.

### Page order
1. **Hero** — cold hook ("Be the sharpest voice in your space — every day, without writing a word.") + outcome subhead + primary CTA (book/continue the conversation).
2. **Walkthrough video** — placed high; **slot reserved now** (poster + "Watch it run, 3 min" placeholder), video filmed after the dashboard ships.
3. **Brief problem → flip** — short, for cold readers (blank page / inconsistency / sounds-like-AI → the flip).
4. **The six promises** — the deep "why it's advanced" section (replaces the thin "Under the Hood" list). Outcome headline + benefit + small grey "how" proof line each. (See §2.)
5. **"One idea, everywhere"** — visual: one idea fanning into post / carousel / video / lead magnet.
6. **Lead Magnets** (NEW dedicated section) — "Turn attention into qualified leads — automatically."
   - The **10 formats** it builds itself (Assessment, Calculator, Guide, AI Kit, n8n Workflow, Stack Picker, Annotated Architecture, Skill Pack, Checklist, Live AI Walkthrough — last marked *coming*).
   - **Three outcome promises:** it builds *and* publishes itself (auto-deployed hosted pages) · it qualifies leads for you (gated CTAs route by fit) · it launches the whole campaign (asset + launch post + DM + email + cover in one pass).
7. **Receipts** — real outputs: carousel thumbnails, the Fable newsjack example, a live lead-magnet page, performance angle.
8. **Scope / not in scope** — tightened version of the current section.
9. **Pricing + final CTA** — kept as-is (pricing is NOT changed in this work).

### Page success criteria
- A cold reader gets the outcome + a reason to believe within the first viewport and the six-promise scan.
- A warm reader (post-call) finds depth/proof that backs up what they saw demoed.
- Lead magnets are presented as a first-class pillar, not a footnote.
- Every claim maps to a live capability (§6); nothing pending is claimed.
- Brand-faithful per `brand-visual-system.md`.

---

## 5. Sequencing

1. **Dashboard** (Part A) — it's both the live-call surface and what the video later films.
2. **Page** (Part B) — can begin in parallel on copy/structure; the video slot stays a placeholder.
3. **Video** — deferred; separate spec/cycle once the dashboard is clean.

---

## 6. Capability honesty ledger

**Safe to claim & demo (live + validated):** deterministic lint engine + 9-dimension QA + self-rewrite loop; voice guardrails across 50+ prompts; 6-source idea curator + nightly quality-weighted scorer + editorial agent + format router; dual RAG grounding; post-gen v2; carousel gen (9 styles, real logos); IG captions; video gen v2 (native LinkedIn/Reels); 9 lead-magnet formats live + qualification-gated CTAs + auto-deployed resource pages + launch-kit distribution copy; breaking-news radar (Fable ban proof) + model-launch detection; on-brand AI imagery with vision-QA; native publishing; performance tracking; self-improving skills/memory + ops alerting.

**Do NOT claim (partial/pending):** launch-kit *asset* generation (cover only today); Live AI Walkthrough engine (runtime issue — page may list it as *coming*); auto carousel/video *suggestion* (manual button today); Style Scout discovery (not built); one-tap WhatsApp video approval (manual); LM Studio not yet prod-browser-tested.

---

## 7. Key files (implementation targets)

**Dashboard**
- `components/dashboard-v2/Shell.tsx` / `DemoShell.tsx` — add Tour entry control.
- `components/dashboard-v2/tour/` (NEW) — `TourProvider`, `TourNarratorCard`, `useTourSpotlight`, tour-step definitions, `demoSafe` registry.
- `components/dashboard-v2/primitives/` — add `PanelIntro`, status-lifecycle legend.
- `components/dashboard-v2/sections/ContentStudio.tsx` + the demo-path panels (`PostStudioPanel`, `LeadMagnetStudioPanel`, `StyleGalleryPanel`, `Calendar`, `PerformancePanel`, `VideoStudioPanel`, `Briefing`) — wire `PanelIntro`, legend, empty states; consistency pass.
- `components/dashboard-v2/dashboard-v2.css` — any shared token/chip additions.

**Page**
- `components/ContentSystemPage.tsx` — full rebuild to the §4 order.
- Brand source of truth: `brand-visual-system.md` (via `frontend-grounded`).

---

## 8. Out of scope
- The walkthrough video (separate cycle).
- Pricing changes.
- Non-demo-path dashboard panels.
- New backend/n8n work — this is presentation-layer only; it surfaces capabilities that already exist.
