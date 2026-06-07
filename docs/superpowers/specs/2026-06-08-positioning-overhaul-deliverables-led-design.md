# Positioning Overhaul — Deliverables-Led, Specialist Surface

**Date:** 2026-06-08
**Status:** Design approved, ready for implementation plan
**Scope:** Website (home + /fractional + new /call-intelligence) · LinkedIn profile · LinkedIn content angle

---

## Problem

The current public positioning leads with the wrong shapes for how Ivan's buyers actually buy:

1. **Blueprint-as-front-door.** The home Offers grid marks the **Agent-Ready Blueprint ($2k)** as "Start here." Nobody buys a diagnosis cold — buyers want a *first real thing*, and the build itself is what diagnoses their business.
2. **Fractional-as-headline.** Fractional AI Partner is presented prominently as a "Monthly retainer." But Ivan's buyers are **project-stackers, not retainer buyers** — they buy deliverables, not access/relationships. Leading with a retainer fights buyer psychology and is hard to sell.
3. **No signature differentiator.** The strongest, most unique asset — an AI **Call Intelligence System** (scores sales/client calls, flags churn risk, per-rep scoring) — is not on the site at all.
4. **Generalist risk.** "AI is broad." Presenting many categories or a long service menu reads as a generalist AI agency = commodity, no edge, price competition.

## Goal

Reposition every public surface so Ivan reads as a **specialist** with a sharp niche and a signature edge, while still capturing custom/consultative demand. Convert the funnel to: **free fit call → a growth deliverable → Call Intelligence as the differentiator → Fractional as a quiet wrapper.**

---

## Strategy decisions (locked)

These were resolved through brainstorming and are the spine of every surface.

### 1. Niche line (anti-generalist)
Ivan is **not** "an AI agency." He builds **growth + retention systems for service businesses** ($1–10M agencies). The niche sentence itself kills the generalist read.

### 2. Specialists show few things deeply
- **3 advertised builds, infinite delivered in the engagement.**
- The wider catalog (newsletter, video engine, ICP commenting, proposal gen, call clips, etc.) is **delivery depth inside** a Content System or Fractional engagement — **never** standalone menu cards.
- No category list. No 4th/5th/6th offer card.

### 3. The three surface builds
| # | Build | Role |
|---|---|---|
| 01 | **Content System** (merged: Lead Magnet + Content Engine, ~$7k) | Growth engine — what buyers actively shop for |
| 02 | **Call Intelligence System** | **Signature differentiator** — highlighted |
| 03 | **Fractional AI Partner** | Quiet wrapper for ongoing partnership — de-emphasized, no "retainer" language |

### 4. Call Intelligence framing — offense, not defense
- Lead with **win-rate**: *"Close more of the deals you're already in."*
- Churn-risk flags + per-rep scoring are the **secondary** payload, not the headline (retention is loss-aversion; growth is what sells).
- **Delivery model:** installed, always-on system — scores every call **going forward**. Core promise never depends on their data history.
- **Bonus (conditional):** retro-audit of last ~30 calls *if their call tool is queryable* (Fireflies / Fathom / Otter = easy; Gong = check API access; nothing = set up recording first).
- **Qualifying question** that scopes the deal: *"What do you record calls with?"*
- **Lane discipline (Kyle Hunt referrals):** frame as client-retention / deal-intelligence, NOT team-performance management (that's Kyle's lane). Public page can keep per-rep scoring; emphasis shifts per audience in delivery.
- **Productize by selling:** sell deal #2 as "custom," standardize as delivered. Do not rebuild into polished SaaS before validating demand.

### 5. Blueprint — removed from public site, kept backend
- Remove the Blueprint card from the home Offers grid.
- **Keep all backend infra** (Blueprint Generator workflow `zfSvH4mgXqWwkchu`, `/assessment` route, intake pipeline) for internal/fractional use and for warm buyers who explicitly want a roadmap (reachable by direct link, not advertised).
- Nobody buys it cold; it stops being the front door.

### 6. The free fit call is the universal door — made explicit
- Productized offers = the **credible specialist surface** (what Ivan is known for).
- The **fit call captures everything off-menu** (custom/consultative intent).
- A content-viewer who thinks "this is an AI guy, I have an AI thing" must have an obvious path to book **without** picking a product.
- Counterintuitive truth driving this: narrowing advertised offers *increases* custom inbound — specialists get hired for custom work, generalists don't.

---

## Surface-by-surface design

### Surface 1 — Home hero (`components/LandingHero.tsx`)
**Near-zero change.** Already correct:
- Headline "Systems scale. Headcount doesn't." + "scale without scaling payroll" = growth/leverage framing.
- Primary CTA "Book your fit call" → `/start` = free-call-first, product-agnostic.
- Optional only: a subhead nod to *what* gets built. Low priority; default is leave as-is.

### Surface 2 — Home Offers section (`components/Offers.tsx`) — main rebuild
- **Remove** the Agent-Ready Blueprint card (object index `01`).
- **Merge** Lead Magnet System + Content Engine into a single **Content System** card (~$7k) — the growth engine.
- **Add** a **Call Intelligence** card → links to new `/call-intelligence` page. This card carries the **highlighted / "signature" emphasis** (the visual weight Blueprint currently has).
- **Reframe** the Fractional card: drop "Monthly retainer · 3 tiers" → "Ongoing partnership for clients who want continuous building." De-emphasized (last card, no highlight).
- **New ordering:** `01` Content System · `02` Call Intelligence (signature) · `03` Fractional (wrapper).
- **Add a catch-all line** beneath the grid:
  > *"Working on something that's not here? The call is for that too — I scope custom builds for service businesses every week."*
- Section heading can keep "Pick the engagement that fits where you are" or shift to reinforce the niche; copy TBD in implementation.

### Surface 3 — New `/call-intelligence` page (new component, e.g. `components/CallIntelligencePage.tsx` + route)
Structured like `/lead-magnet-system` (`components/` page + route registration in `App.tsx`). Sections:
- **Hero:** *"Close more of the deals you're already in."* Win-rate framing. CTA → `/start`.
- **The problem:** deals lost on calls + clients quietly churning — money you can't see bleeding.
- **What it is:** installed system; scores every call going forward; per-rep scoring; churn-risk flags. Plug-in, automatic.
- **The head-start bonus:** retro-audit of last ~30 calls *if* their tooling is queryable.
- **Qualifying nudge:** "What do you record calls with?" (Fireflies / Fathom / Otter / Gong / nothing).
- **CTA:** Book your fit call.
- Reuse existing brand system (paper + sage, DM Serif Display, IBM Plex Mono, Source Serif 4) and the page patterns from the LM/Content pages.

### Surface 4 — `/fractional` page (`components/FractionalPage.tsx`)
- Reframe from **"monthly retainer"** → **ongoing partnership / continuation** for warm & returning clients. It is *where engagements go*, not where they start.
- Keep the 4 tiers (Heavy $10k / Active $6.5k / Slow Lane $3.5k / Care $1k) but frame as a progression/wind-down, not a cold entry menu.
- **No cross-offer promotion** on this page — keep it self-contained (per Ivan).
- Audit current copy for retainer/access language and shift to partnership/continuation.

### Surface 5 — LinkedIn profile
*(Requires auditing current profile before rewriting — via browser/playwright or Ivan pastes current text at implementation time.)*
- **Headline:** generic AI/fractional → niche + outcome + signature edge. Direction: growth/retention systems for service businesses + the call-intelligence layer that shows why deals are lost.
- **About:** rebuilt on the deliverables-led + relief narrative (buyer purchases relief / "we've got the AI thing handled," not the system itself).
- **Featured:** fit call · Content System · Call Intelligence.

### Surface 6 — LinkedIn content angle (guidelines doc, not a one-time edit)
- Posting themes shift to **feed the ladder**: growth-systems content (top of funnel) + the win-rate / call-intelligence angle as the signature differentiator.
- Cold outreach angles ≠ site cards. Outreach leads with **pain-led hooks** (Fractional is never a cold hook):
  1. Growth / pipeline (content/authority — default — or lead-gen if sharper for ICP; **to confirm**)
  2. Win-rate (Call Intelligence — "why are you losing deals?")
- Captured as an ongoing positioning guideline, surfaced into the content system's voice/strategy prompts.

---

## Out of scope
- Building/productizing the Call Intelligence System itself (sell-then-productize; this spec is positioning only).
- Rebuilding the home hero beyond an optional subhead tweak.
- Any 4th+ productized offer.
- Touching the Blueprint backend (it stays as-is, just hidden from the public grid).
- Pricing changes beyond merging LM+Content into one ~$7k Content System card.

## Open items to confirm during implementation
1. **Cold-outreach growth hook:** content/authority (default) vs lead-gen/outreach. Affects Surface 6 angle copy.
2. **LinkedIn profile audit:** browser-pull vs Ivan pastes current headline/About/Featured.
3. Exact Content System card price/cadence copy after the merge.

## Success criteria
- No public surface presents the Blueprint as a front door or Fractional as a headline retainer.
- Home shows exactly 3 builds + an explicit catch-all fit-call path.
- Call Intelligence has a live page leading with win-rate.
- LinkedIn profile + site tell the same niche + signature-edge story (a cold lead's profile→site path is coherent).
- Ivan reads as a specialist (sharp niche + signature edge), not a generalist AI agency, while every custom inquiry still has a booking path.
