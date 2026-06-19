# Personalized Content Preview — Reply-to-Call Conversion Asset

**Date:** 2026-06-19
**Status:** Design approved (brainstorming) — pending spec review → implementation plan
**Scope of THIS spec:** Sub-project A — the **manual-first MVP** + the one net-new component. Automation (sub-project B) is explicitly out of scope until A validates.

---

## 1. Problem & Purpose

The outreach funnel's binding constraint is **conversion, not volume**: ~12 replies → **0 booked calls** (14-day window). A generic "want to hop on a call?" after a positive reply books nothing.

This asset replaces that ask with a **personalized, already-built preview of the prospect's content engine** — sent only *after* a positive reply to cold-email DM#1 / LinkedIn DM#1. It proves quality before any meeting, self-qualifies the prospect, and turns the call from "convince them the content's good" into "here's how we'd run it for you."

**Cross-channel:** the same asset serves both the cold-email reply and the LinkedIn DM#2 follow-up.

**Core reframe:** the preview gives away the **proof**, not the sale. The call still sells the *system + relationship* (ongoing run, pricing, partnership) — which the preview can't do.

---

## 2. Funnel Model (decided)

**Hybrid: tease in the reply → full reveal on the call.**

- **Reply gets:** diagnosis + the LinkedIn-feed mockup with **2 text posts + 1 branded image post** (a populated feed reads as "killer," a single card does not).
- **Call holds:** the **lead-magnet concept** (distinct, high-value capability) + the **"how I'd run this for you"** strategy. These give the call a spine and a reason to attend.

Rationale: booking is the tighter constraint (baseline 0), so we must give enough to earn the call; but withholding the LM + strategy keeps the live call worth showing up for.

---

## 3. What's Reused vs. Net-New

This is mostly a **re-targeting of existing engines** from Ivan's voice/brand to the *prospect's*.

| Job | Existing engine (today aimed at Ivan) | Re-pointed to |
|---|---|---|
| 2 text posts, anti-slop | Post Gen v3 + content-lint engine | Prospect's voice profile |
| 1 branded image post | brand-newsjack image engine + scroll-recorder | Prospect's brand kit |
| 1 LM concept (cover + outline) | lm-gen-v2 + lm-cover Gemini renderer | Prospect's niche |
| Host the preview page | LM landing-page-per-resource system + lm-beacon | `preview.ivanmanfredi.com/<slug>` |
| Audit / diagnosis structure | `/content-system` audit page format | Prospect's current 30 posts |

**Net-new (only two real builds):**
1. **Prospect voice + brand profiler** — analyze 30 LinkedIn posts → voice signature; scrape their site → brand kit (logo/colors). These are the re-pointing inputs.
2. **LinkedIn-feed mockup component** — the visual centerpiece (Section 5). The *only* piece worth engineering up front.

---

## 4. Per-Lead Runbook (the manual recipe)

One positive reply → one preview. Seven steps; the conceptual core is step 2 (re-pointing every engine off the prospect, not Ivan).

| # | Step | Tool / engine | Output |
|---|---|---|---|
| 1 | **Harvest** | Apify `harvestapi/linkedin-profile-posts` (`A3cAPGpwBEG8RJwse`), `maxPosts: 30`; grab company site URL | 30 posts + profile (name/headline/avatar) |
| 2 | **Profile** | (a) voice: analyze 30 posts → voice signature; (b) brand: scrape site → colors/logo | Voice profile + brand kit |
| 3 | **Diagnose** | `/content-system` audit logic vs. their 30 posts | Score + 2–3 gaps (opportunity-framed) |
| 4 | **Generate** (fan-out) | Post Gen v3 + lint → 2 text posts · brand image engine → 1 branded post · lm-gen-v2 + cover → 1 LM concept | Sample assets in their voice/brand |
| 5 | **QA gate** | content-lint + human pass | **Blocks publish** until samples clear the bar |
| 6 | **Assemble + Publish** | LinkedIn-mockup component → LM landing infra | `preview.ivanmanfredi.com/<slug>` + lm-beacon open/scroll tracking |
| 7 | **Send** | Link in the reply (+ optional teaser screenshot) | — |

**QA is non-negotiable (step 5):** a mediocre sample proves the *opposite* of the pitch. Redo a weak post rather than ship it.

**Apify note (verify at build):** the posts actor returns post + author data; if profile pic/headline are not in its output, add a lightweight profile-detail actor for the mockup header.

---

## 5. LinkedIn-Feed Mockup Component (the one net-new build)

A **pure presentational** component in `personal-site` (built later via frontend-grounded). One job: content spec → believable LinkedIn feed. No data fetching, no logic — feed it fixtures, it renders. Independently testable.

```
Input spec:
{
  profile: { name, headline, avatarUrl },          // from Apify scrape
  posts: [
    { type: 'text',  body, reactions, comments },   // Post Gen output (1 of 2)
    { type: 'text',  body, reactions, comments },   // Post Gen output (2 of 2)
    { type: 'image', body, imageUrl, reactions },   // branded image engine
  ],
  lmCard: { coverUrl, title }   // supported, OMITTED on tease page (held for call)
}
→ renders: profile header + post cards with LinkedIn chrome (reactions, comments, follow)
```

Two deliberate design points:
- **Split visual register:** the embedded feed mimics LinkedIn's neutral UI (reads as *their* feed); the surrounding audit page uses *Ivan's* brand system (reads as *his* work).
- **One component, two render configs:** tease page renders 2 posts + image; the full render (with `lmCard`) is the call asset. No rework between tease and call.

---

## 6. The Preview Page (reuse `/content-system` audit format)

Audit-led → preview-payoff → soft close. Exact section components to be mapped onto the live `/content-system` page structure at implementation time.

1. **Personalized hero** — "What {{FirstName}}'s feed could be doing for {{Company}}."
2. **Diagnosis** — score + 2–3 specific gaps, opportunity-framed (the audit's persuasive spine).
3. **The payoff — their feed, leveled up** — the live LinkedIn mockup (2 posts + branded image). The centerpiece.
4. **Soft CTA** — "I also built you a lead-magnet concept and mapped how I'd actually run this — want me to walk you through it?" → book `/start`. The held LM + strategy pull the booking.

Tracking: lm-beacon open + scroll-depth → Ivan sees engagement before follow-up.

**Copy rules (brand-kit):** benefit-led, never narrate the mechanism ("here's what your feed could look like," NOT "here's what my AI made"). Run all generated copy through content-lint / Forbidden Language before publish.

---

## 7. Trigger & Success Criteria

- **Trigger (MVP):** manual. Ivan judges a reply genuinely positive (interested — not "no"/"unsubscribe") → runs the runbook (himself or via Claude).
- **Test:** hand-make the **first 3 previews.**
- **Primary metric:** reply → booked call. Baseline = **0 / 12**. Bar: **≥2 of 3** previewed leads book → step-change worth codifying.
- **Secondary:** page opens / scroll depth (lm-beacon), reply sentiment after viewing.
- **Decision gate:**
  - Converts meaningfully better than the generic ask → codify into a `/content-preview` skill (Approach 2), then automate in n8n (Approach 3 = sub-project B).
  - 3 *well-made* previews convert **0** → problem is the offer/close, not the channel. **Stop; do not automate.** Rethink the offer. (The cheap lesson the MVP buys.)
- **Cost guardrail:** per preview ≈ Apify cents + engine compute + Ivan's QA time. Positive-reply gate keeps volume + spend low.

---

## 8. Build Order (gated)

1. **Approach 1 (this spec):** build the LinkedIn-mockup component; run the 7-step runbook by hand for the first 3 leads.
2. **Approach 2:** if it converts, codify the runbook into a `/content-preview` skill.
3. **Approach 3:** if the skill earns its keep at volume, automate trigger→fan-out→assemble→publish in n8n.

Each step funded by the previous one working. **Only step 1 is in scope now.**

---

## 9. Out of Scope (YAGNI)

- n8n orchestration / automated trigger (sub-project B).
- Carousel sample, second LM concept (full-showcase tier) — not until validated.
- Automated positive-reply detection — manual judgment for MVP.
