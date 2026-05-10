# AI Opportunity Scan — Iteration Plan

**Compiled:** 2026-05-10
**Source:** Multi-agent audit (4 specialists + synthesizer) of `/audit` + `/scan/directiveconsulting`
**Baseline score:** 66/100 against original spec ("free lead-magnet that converts cold prospects to $2,000 Agent-Ready Assessment")
**Target after this plan:** ~85/100

---

## Original goal (the spec, unchanged)

A free, automated company audit at https://ivanmanfredi.com/audit. Cold prospects (B2B service business CEOs, 10-500 employees) submit URL + email. ~3 minutes later they get a personalized editorial report at /scan/[slug] showing tech stack, traffic, ad activity, hiring patterns, AI adoption, and 3-5 specific opportunities with dollar-cost estimates. **Single business goal:** convert that prospect to book a $2,000 paid Agent-Ready Assessment (Calendly link at the close). Cost target: under $0.10 per scan. Must work for any B2B service business in the size range, gracefully degrading when data is thin.

---

## Where we are right now (audit baseline)

| Lens | Score | Load-bearing finding |
|---|---|---|
| Conversion | ~50% | $2K ask hits at fatigue, not arousal. Schwartz awareness stalls at Solution-Aware (Assessment described in 1 sentence with no plan/proof/specifics). |
| Editorial Visual | ~80% | Closer to 2026 editorial spread than generic AI report. Loses points for grid drift in leak cards + traffic-source bars dropping into 2018 dashboard vernacular. |
| Trust + AI Credibility | ~61% | Cardinal AI-trust sin: hides provenance entirely while form admits "a model reads it all." No methodology, no source list, no model name, no confidence levels. Buying-committee CFO can't verify anything. |
| IA + UX | ~72% | Form is exemplary. Report shows three big serif numbers (52 hero / 94 mid-count / 58 peer) in identical typography within 2 scrolls — comprehension blocker. |

**Composite:** 66/100, weighted toward conversion + trust since spec is cold prospect → $2K booking.

---

## What we're keeping (preserved wins, do not change)

These got high marks from multiple specialists. Don't lose them in iteration:

1. **The /audit form itself.** IA scored it 5/5: "exemplary, restrained, fast-scent, low-friction." 2 fields, no popups, mono microcopy handling objections inline. Do not redesign the form.
2. **Italic-as-pivot grammar.** Visual scored 5/5: "italic doing semantic work, not decorative work — rarest discipline in AI-product UI right now." Reduce frequency (Week 1) but preserve the device — it's the page's signature.
3. **Color discipline.** Paper #F7F4EF + sage #4C6E3D + warm #D89254 only. Visual scored 4.5/5. Do not introduce additional accent colors.
4. **Act-2 dark-panel reveal as a structural beat.** Both IA and Visual praise the dark band as "the page's literal page turn — earns the score its scale." Fix the number confusion *inside* it (Week 1), don't remove the reveal.
5. **Single clean $2K CTA at the close.** Conversion explicitly notes "finishes with one clean CTA." Adding inline CTA earlier (Week 1) does NOT mean cluttering the close.
6. **Mono eyebrow + section-label system.** Visual scored 4/5: "consistent navigational skeleton across all three URLs — that's a design system, not a stylesheet."

---

## Owner decisions required (5 tradeoffs)

These are not implementation choices — they are positioning commitments. Commit before Week 2 starts.

### Decision 1: Inline CTAs vs editorial restraint
- **Conversion says:** 30-40% lift on the table by repeating the ask at arousal peaks (after the top opportunity card).
- **Visual says:** the magazine feel is the page's actual category differentiator; inline CTAs cheapen it.
- **Compromise on offer:** an *editorial-feeling* inline link (quiet underlined sage text, not a button). Looks like a footnote, behaves like a CTA.
- **Decision needed:** approve the editorial-link compromise OR keep zero mid-page CTAs.

### Decision 2: AI prominence vs AI restraint
- **Trust says:** form sells AI loudly ("a model reads it all"); report hides AI completely. Exactly inverted.
- **Recommended posture:** "AI-accelerated, human-reviewed" on both surfaces.
- **Implication:** form copy softens, report adds methodology footer + Ivan-reviewed line.
- **Decision needed:** commit to "AI-accelerated, human-reviewed" framing across both surfaces.

### Decision 3: Logos / proof vs magazine aesthetic
- **Conversion + Trust both say:** $2K ask floats with one bio paragraph as the only authority signal. Comparable-firm proof is the missing lever.
- **Visual says:** logos cheapen editorial feel.
- **Compromise on offer:** hairline-bordered "Track record" mono strip with 2-3 named clients (no logos), positioned one section before the close. Not a "trusted by" badge wall.
- **Decision needed:** Ivan supplies 2-3 named clients (or anonymized firm descriptors like "$15M B2B SaaS scale-up"). Without these, Week 2's #3 task can't ship.

### Decision 4: Page length — proof depth vs scroll fatigue
- **Trust wants:** methodology footer + per-data-point confidence tags (longer page).
- **IA wants:** less scroll before the priority gap appears (shorter page).
- **Conversion wants:** stakes-of-failure block (longer page).
- **Resolution path:** collapse methodology + confidence tags behind a `<details>` disclosure styled as an editorial sidenote. One tap for the 30% of viewers who care.
- **Decision needed:** approve the disclosure pattern OR pick a side (more proof / less scroll).

### Decision 5: 3-day follow-up email vs "no follow-ups" promise
- **Conversion says:** single 3-day follow-up scoped to their #1 gap would 2x bookings.
- **Brand promise on form says:** "no spam, no follow-ups." Load-bearing trust signal.
- **No specialist resolves this.** Pure tradeoff.
- **Decision needed:** Ivan picks. Default = honor the promise (don't add follow-up).

---

## WEEK 1 — Cheap, low-risk, copy + repositioning (~7 hours, no new design system)

Goal: move score from 66 → ~75 with no owner-decision dependencies.

### W1.1 — Inline CTA after top opportunity card
- **Why:** Page's arousal peak. Conversion specialist + UX both agree: ask when desire fires, not when fatigue fires.
- **Where:** `components/scan/OpportunityCard.tsx` — add an "editorial link" footer to the `prominent={true}` (top) card only.
- **Spec:** quiet underlined sage text, not a button. Copy: *"Want this one scoped into a 90-day plan? See the Assessment →"* Links to same Calendly URL.
- **Effort:** 1 hour
- **Acceptance:** top card has a single inline link below the stats rail; remaining 4 cards unchanged.

### W1.2 — Promote "Your highest-priority gap" block to position 2
- **Why:** Currently user reads through 5 leak cards before the page tells them which one matters most. Front-load the verdict.
- **Where:** `components/ScanReportPage.tsx` main render order. Currently: Hero → Company → Dark Band → Opportunities (5 cards) → Numbers → Ad Activity → Hiring → Voice → News → Competitive → Closing Arc.
- **Spec:** Insert a small "verdict block" between Dark Band and Opportunities. Headline: top_gap_title. Body: top_gap_summary. One inline link to "scroll to all opportunities ↓" or just a quiet visual cue. The full Closing Arc stays at the end (gives the close + Monday move).
- **Effort:** 1.5 hours (new component + reorder)
- **Acceptance:** verdict appears immediately after dark band; user knows the #1 gap before scrolling 5 cards.

### W1.3 — Fix Act-2 number confusion
- **Why:** UX specialist flagged this as the "single highest-impact comprehension blocker." User sees `52 → 94 (mid-count) → 58 (peer)` in identical serif treatment within 2 scrolls.
- **Three sub-fixes (all in `components/ScanReportPage.tsx` `SectionScoreRevealDark`):**
  - **a.** Cap the count-up animation at 400ms (Doherty Threshold). Already runs ~1.2s — bring to 0.4s.
  - **b.** Add a persistent "YOUR SCORE" eyebrow above every recurrence of the score number.
  - **c.** Color-lock the score: keep 52 in warm orange-red across hero AND dark band. Never re-tint to sage green during count-up. Sage stays reserved for the breakdown bars and grade letter.
- **Effort:** 2 hours
- **Acceptance:** scrolling from hero → dark band, the score 52 keeps the same color and is labeled "YOUR SCORE" both times. Animation completes within 400ms.

### W1.4 — Soften form AI copy + add Ivan-reviews line
- **Why:** Trust specialist: form sells AI loudly, report hides AI completely. Pick one posture.
- **Where:** `components/AuditPage.tsx` lede paragraph (line ~152-156).
- **Current copy:** *"We pull your tech stack, ad activity, hiring, and traffic from 14 public sources. Then a model reads it all and tells you exactly where the AI gaps live, in plain English."*
- **New copy:** *"We pull your tech stack, ad activity, hiring, and traffic from 14 public sources. AI synthesizes the patterns. Ivan reviews every report before it ships."*
- **Effort:** 30 minutes
- **Acceptance:** form copy commits to "AI-accelerated, human-reviewed" posture. Pairs with W2.1 methodology footer.

### W1.5 — Reduce italic-pivot device from 7+ instances to 2-3
- **Why:** Trust + Visual both flag this as templating signal. By third occurrence reads as system, not editorial. Damages specificity perception.
- **Where:** `components/ScanReportPage.tsx`. Current italic-pivot instances on the report:
  - Hero (kept — signature)
  - Dark band ("Where you're winning. Where you're not.") (kept — signature)
  - "The Company" → "Who you are, what you run on" (REMOVE italic, keep plain)
  - "Live Ad Activity" → "Where your spend lands" (REMOVE)
  - "AI Adoption" → folded into dark band (already gone)
  - "Hiring" → "What you're paying humans to do" (REMOVE)
  - "Your Voice" → "What you're publishing" (REMOVE)
  - "Recent Momentum" → "What's happened in the last 90 days" (REMOVE)
  - "Competitive Context" → "The field you play in" (REMOVE)
  - "Traffic Mix" → "Where your visitors come from" (KEEP — load-bearing for the new editorial verdict line below it)
  - Closing arc ("Your highest-priority gap is X") (KEEP — final emotional pivot)
- **Effort:** 1 hour (copy pass + remove `<Italic>` wraps)
- **Acceptance:** italic-pivot device appears only on hero, dark band, traffic mix, and closing arc. All other section titles are plain serif.

### W1.6 — Drop the peer median entirely (revised from synthesizer's #6)
- **Why:** Owner flagged: we have no real peer data. Currently `peer_median.score` is hardcoded per size tier in the Claude prompt (micro: 35, small: 42, mid: 50, large: 58). Re-labeling as "you scored 6 points below typical" is misleading when "typical" is an estimate.
- **Where:**
  - `components/ScanReportPage.tsx` `PeerComparisonInlineDark` — comment out the call inside `SectionScoreRevealDark` (don't render).
  - n8n Claude prompt: keep the field generated for now (no harm), just hide on frontend.
- **Effort:** 15 minutes
- **Acceptance:** dark band shows score + breakdown + AI posture row; no peer comparison row.
- **Future (Week 3+):** rebuild peer comparison from real Supabase aggregation once we have 50+ scans per size tier. Use `select percentile_cont(0.5) within group (order by automation_score) from scans where company_size_tier = X`. Then revisit copy.

### W1.7 — Tighten right-rail money column on opportunity cards
- **Why:** Visual specialist: $3,200 should be visually dominant (it's the buying argument), not competing with `10h`. Currently both ~28px serif.
- **Where:** `components/scan/OpportunityCard.tsx` right-rail.
- **Spec:** Keep the 3 stats (hours / cost / ROI) but bump cost to 48px+ DM Serif Display. Demote hours to a small mono line under it. ROI text stays small.
- **Effort:** 30 minutes
- **Acceptance:** dollar figure is visually dominant; hours feels like a supporting microcopy.

**Week 1 total: ~7 hours. Single bundled commit. Push + observe before Week 2.**

---

## WEEK 2 — Higher-impact, requires design + owner decisions (~3-4 days)

### W2.1 — Methodology + sources footer (collapsible) + narrated 14-source wait screen
- **Why:** Trust specialist's load-bearing fix. Same intervention solves both the AI-trust gap AND the highest-risk drop-off in the funnel (~3 min silent wait). Two-for-one.
- **Where (two surfaces):**
  - `components/AuditPage.tsx` `ProcessingPanel`: replace the static "phase headline" with a checklist UI showing 14 sources being checked one-by-one with checkmarks. Source names appear in editorial mono caps. Visual cadence: each source flips checked at intervals tied to actual pipeline progress (we can fake the cadence based on EXPECTED_SECONDS — the real n8n flow doesn't expose source-level progress).
  - `components/ScanReportPage.tsx` — new `SectionMethodology` collapsible block before `SectionClosingArc`. Default collapsed (`<details>` element, editorial mono trigger label "View methodology + sources"). Expanded contents: full list of 14 sources with date pulled, model name + version (Claude Opus 4.7), one-line "what we couldn't see" disclosure.
- **Effort:** 1.5 days (new wait UI + new methodology component + source-list data structure)
- **Acceptance:** during the 3-min wait, user sees a live checklist of 14 sources being checked. On the final report, a discreet "View methodology + sources" link expands a full provenance footer.
- **Depends on:** Decision 2 (AI prominence/restraint commit), Decision 4 (page length disclosure pattern approved).

### W2.2 — Hairline "Track record" strip with 2-3 named clients
- **Why:** Conversion + Trust: $2K ask floats with one bio paragraph. Comparable-firm proof is the missing lever.
- **Where:** `components/ScanReportPage.tsx` — new strip above `SectionClosingArc`, BEFORE the price line.
- **Spec:** hairline top + bottom border, mono caps eyebrow ("Recent Assessments shipped for"), 2-3 lines of plain serif text. Format per line: `[Firm name or descriptor] · [one-line outcome with a number]`. E.g., *"$15M B2B SaaS scale-up · Cut SDR scheduling friction from 12 hrs/wk to 2."*
- **Effort:** 0.5 day
- **Depends on:** Decision 3 approved + Ivan supplies 2-3 named clients (or anonymized descriptors).

### W2.3 — Redesign traffic-source bars + lock leak-card grid
- **Why:** Visual specialist: "the bars are the weakest two square inches in the whole report and they sit in a money-slide position." Leak cards drift between text-block widths.
- **Where:**
  - `components/ScanReportPage.tsx` `SectionFundingTraffic` — replace separate `Organic search 45% / Direct 38% / ...` rows with a single horizontal stacked bar (FT/Bloomberg style). One thick bar, segmented, labels inline.
  - `components/scan/OpportunityCard.tsx` — pin to strict 2-col grid (8-col text / 2-col stats / 2-col gutter). Already mostly there but vertical rhythm drifts; lock to a baseline.
- **Effort:** 1 day
- **Acceptance:** traffic source breakdown is a single stacked bar with inline labels (no separate rows). Leak cards align perfectly to a baseline grid.

### W2.4 — Mobile dark-panel padding + desktop body line-length cap
- **Why:** Visual: at 390px the score 52 sits ~16px from top, comparison numeral 54 jammed against dividing rule. Desktop: several paragraphs run 95-110ch (should cap at 68ch).
- **Where:**
  - `SectionScoreRevealDark` mobile padding: add 48-64px top/bottom on mobile specifically.
  - Various sections: cap body `max-w` on `lg:max-w-2xl` (~620px = 68ch at 17px).
- **Effort:** 0.5 day
- **Acceptance:** mobile dark band has breathing room; desktop body never exceeds 68ch.

**Week 2 total: ~3-4 days. Multiple commits.**

---

## DEFERRED (Week 3+)

These are real but lower-leverage OR require more research:

1. **Real peer benchmarks from Supabase aggregation.** Once we have 50+ scans per size tier, compute actual median scores. Rebuild `SectionScoreRevealDark` peer comparison row.
2. **Inline per-data-point confidence tags.** When report says `$1,200/week`, follow with mono `[derived from: Meta Ad Library × industry rate]`. Defer until methodology footer is shipped and measured.
3. **Stakes-of-failure block** between `SectionAdActivity` and `SectionHiring`. High impact but writing risk; A/B test after Week 2.
4. **SPA 404 fix for social-share crawlers.** Both `/audit` and `/scan/*` return HTTP 404 from GitHub Pages and rely on SPA fallback. LinkedIn/Slack/Twitter crawlers won't render link previews. Separate infra ticket.
5. **3-day follow-up email** scoped to #1 gap (Owner Decision 5 — pending).
6. **Replace "90-day payback" claim with proof.** Already in W2.2 effectively. Confirm the unsupported claim is rewritten when Track Record strip ships.

---

## Success metrics (how we know this worked)

After Week 1 + Week 2:

| Metric | Before | Target |
|---|---|---|
| Composite audit score | 66/100 | 85/100 |
| Page length (desktop VPs) | ~10 VPs | ~7-8 VPs |
| Time to first comprehension of "what's my #1 gap" | ~scroll position 5 | scroll position 2 |
| Trust score (Fogg checklist) | 3.5/5 | 4.5/5 |
| AI provenance score | 1.5/5 | 4/5 |
| Cialdini deployment | 2/5 | 4/5 |

Real-world signals to watch (after deploy):
- Booking conversion rate (Calendly bookings / scans completed)
- Scroll depth at 75% mark (proxy for completion before fatigue)
- Time on /audit form before submit (anti-spam plus quality signal)
- Email open rate on the "scan ready" notification (should be ~80%+ since user opted in)

---

## Appendix: 5 owner-decisions checklist

Before Week 2 work starts, confirm:

- [ ] **Decision 1:** Approve editorial-link inline CTA (quiet underlined sage text, not button). Default: yes.
- [ ] **Decision 2:** Commit to "AI-accelerated, human-reviewed" framing on both surfaces. Default: yes.
- [ ] **Decision 3:** Supply 2-3 named client one-liners + outcomes for the Track Record strip. **BLOCKER for W2.2.**
- [ ] **Decision 4:** Approve `<details>` disclosure pattern for methodology footer. Default: yes.
- [ ] **Decision 5:** Honor "no follow-ups" promise (no 3-day email) OR break it for measured 2x lift. Default: honor.
