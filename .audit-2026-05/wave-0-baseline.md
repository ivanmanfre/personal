# Wave 0 Baseline — 30-Day Post-Instrumentation Epoch Lock

> **DO NOT** compare any audit recommendation's lift against the original
> 9-day audit window (2026-04-23 → 2026-05-02). That window pre-dates the
> measurement plumbing and is unattributable. Every Day 90 / Day 180
> strategic trigger from the 2026-04-19 strategy doc compares against
> **THIS** epoch.

## Epoch lock

| Marker | Value |
|---|---|
| Wave 0 went live | **2026-05-03** (today) |
| Pre-period start | 2026-05-03 00:00 UTC |
| Pre-period end (Day 30) | **2026-06-02 00:00 UTC** |
| Day 60 baseline check | 2026-07-02 |
| Day 90 strategic-trigger window | 2026-08-01 → 2026-08-15 (mid-month for moving average) |
| Day 180 strategic-trigger window | 2026-10-31 → 2026-11-15 |

## What shipped in Wave 0 (the things being measured AGAINST)

- P30-1 — `paid_assessments` + `calendar_events` + `lm_events` source/utm/ref columns; Stripe webhook + Calendly webhook decode source attribution
- P30-2 — UTM convention doc + LM share buttons auto-tag + Newsletter Broadcast Sender auto-injects UTMs into all ivanmanfredi.com links
- P30-3 — `is_test` column + email-pattern backfill on 7 tables; pageviews aggregate views collapse same-host referrers to `(direct)` and filter `is_test=true` rows
- P30-4 — `Outreach - Unipile Stage Reconcile` n8n cron, every 15 min, ID `MTwoBg36orOx6xFK` — fixes the 0.85% accept-rate phantom by syncing prospect.stage with Unipile relations + chats
- P30-5 — 7 ClickUp custom fields on Linkedin Posts list 901324306245 (Impressions / Reactions / Comments / Shares / Saves / Profile Clicks / Follower Delta) + `ClickUp - LinkedIn Engagement Pull` n8n daily 2am UTC, ID `S05kVGFB1BIlAjlm`
- P30-6 — same-host referrer collapse baked into `pageviews_top_referrers` view
- P30-7 — this file

## Pre/post comparison fields (Day 30 ledger fill-in)

These are the metrics the orchestrator will compare against the original
audit baseline (the `agent-11-analytics-baseline/baseline-ledger.json`
snapshot at 2026-05-02). Capture each on 2026-06-02.

### Traffic + engagement (filtered `is_test=false`)
- 30d sessions (target: 30d-of-9d-extrapolation = ~675; growth-driven if higher)
- 30d pageviews
- avg pages-per-session
- multi-page-session rate
- mobile share %
- bounce-equivalent (single-page session %)
- channel mix (utm_source distribution; same-host collapsed)
- LinkedIn-attributed sessions (the killer metric — currently 0)
- direct-traffic share (post-collapse)
- google.com referrer share

### Behavior (NEW, not measurable pre-Wave 0)
- scroll-depth distribution per page (25/50/75/90 milestones)
  *(not yet shipped; placeholder — flag if Wave 1 lands scroll tracking before Day 30)*
- primary-CTA CTR per offer page (Hero, AssessmentPage, FractionalPage, LMPage, StorePage)
  *(not yet shipped; placeholder)*

### Funnel
- form completion rate (intake form, assessment-intake)
- scorecard completion rate (currently 33%)
- scorecard email-capture rate (currently 11.1% — target 40%+ per L8 R09)
- LM view → complete rate
- LM complete → capture rate
- checkout-page → checkout-complete rate (NEW once GAP-03 lands)
- booking → call-show rate
- paid → converted rate (`pipeline_stage='converted'`)

### Revenue
- AOV
- 30d total revenue (paid_assessments)
- 30d MRR-equivalent (Fractional retainers)

### Engagement (LinkedIn — newly measurable via P30-5)
- avg impressions per post
- avg reactions per post
- avg comments per post
- pillar mix (% of posts with non-null Pillar — fix pending)

### Outreach (newly trustworthy via P30-4)
- 30d connection-sent → connected acceptance rate (was reading 0.85%; expect 8–18% true rate)
- 30d connected → replied rate
- candidate prospects scanned per reconcile run

### Referral (zero-state pre-Wave 0)
- referral_token-tagged paid_assessments count
- /refer page visits (when /refer ships in Wave 1)

## Locking note

Per locked decision #45 of the strategy doc:
> Day 30 prerequisite checkpoint: no other 90-day-plan target fires until
> Wave 0 has 30 days of data. Day 60 + Day 90 reference points use this
> epoch, not the audit's 9-day window.

If any audit recommendation is reviewed against pre-Wave 0 data, **REJECT**
the comparison and demand a re-pull from after 2026-05-03.

## Auto-fail triggers

If at Day 30 (2026-06-02) ANY of the following are true, Wave 0 didn't fully land — escalate before Wave 1:

- LinkedIn-attributed sessions still 0 (UTM convention not adopted on bio/posts/DMs)
- 30d new paid_assessments rows have `utm_source` null on >50%
- calendar_events `utm_source` null on >50%
- outreach reconcile cron has fewer than 30 successful runs (one every 15 min × 30d ≈ 2,880 expected; allow 1% miss rate = >2,800)
- ClickUp posts with non-null Impressions <10 (engagement pull cron not connecting Source Post ID)
- `is_test=true` row count grew unexpectedly (>50 new test rows in 30d on prod tables — heuristic too loose)

---

Generated 2026-05-03 by Wave 0 implementation agent.
