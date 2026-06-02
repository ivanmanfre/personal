# Reach System & Outreach Dashboard Overhaul — Design

**Date:** 2026-06-02
**Status:** Approved (brainstorming), pending implementation plan
**Repos:** `personal-site` (dashboard, git) + Ivan Content System n8n/Supabase (backend, non-git)
**Supabase project:** `bjbvqvzbzczjbatgmccb`

## Problem

The Reach dashboard (`?section=reach`) is a single endless scroll: the Outreach tab is a 1637-line monolith ([OutreachPanel.tsx](../../../components/dashboard/OutreachPanel.tsx)) stacking ~11 panels. Live audit also surfaced operational issues the UI hides:

- **`sub=posts` silently renders the Outreach tab** — invalid `sub` falls through with no redirect.
- **Duplicate navigation** — header text-link row + tab bar show the same 6 destinations twice; mobile tab bar overflows (Meetings/Agent-Ready cut off).
- **Dead WARMING stage** — zero `react`/`profile_view` actions in 14 days; WF2 warm-up is off, but the funnel/cards still display a WARMING stage as if live.
- **Recent Activity is 336 rows of `auto_replenish` noise**, burying meaningful events.
- **336 invites stuck in `connection_sent`** (pending acceptance), likely near LinkedIn's pending-invite ceiling and silently throttling new sends — nothing in the UI surfaces this.
- **Collected-but-hidden data:** `outreach_link_clicks` only shown in Agent-Ready; per-campaign performance buried in a modal.
- No unified inbox — reply handling is a Supabase flag, not a UX (the clearest gap vs HeyReach).

## Decisions (locked during brainstorming)

1. **Warming retired.** Remove the WARMING stage from dashboard funnel/cards. Do **not** revive WF2. Evidence: cold connects accept at 12.2% vs auto-warmed 7.4% on live data; external "60%+" lift is from genuine likes+comments, not passive views/auto-likes. Accept-rate experiment (route high-ICP prospects through the human-reviewed comment cohort before inviting) → **backlog, not this build**.
2. **Pending-invite hygiene in scope** — auto-withdraw stale + surface ceiling.
3. **Unified inbox in scope, phased** — its own inner tab.
4. **Dashboard restructures** into Outreach → `Pipeline · Review · Inbox · Health` (Option A).

## Architecture

### Dashboard (personal-site)

[OutreachPanel.tsx](../../../components/dashboard/OutreachPanel.tsx) becomes a thin router over 4 inner-tab components, each a focused file. The existing `useOutreachPipeline` hook stays the **single** data fetcher; inner tabs are presentational and receive slices via props (no new fetch fan-out).

| Inner tab | Owns | Built from |
|---|---|---|
| **Pipeline** | stat cards (WARMING removed), funnel, prospects table + filters, **per-campaign performance**, **link-clicks** surfaced on rows | existing stats, funnel, prospects table |
| **Review** | outreach drafts, comment drafts, commenting targets + active cohort | the 3 review queues |
| **Inbox** | inbound threads, sentiment chip, reply-from-dashboard | new (Phase 3) |
| **Health** | workflow health, rate caps/today, **pending-invite ceiling gauge**, activity feed (`auto_replenish` filtered) | workflow health, rate limits, activity |

New components (each own file under `components/dashboard/outreach/tabs/`):
`PipelineTab.tsx`, `ReviewTab.tsx`, `InboxTab.tsx`, `HealthTab.tsx`. Shared bits extracted: `OutreachStatCards.tsx`, `CampaignPerformance.tsx`, `PendingInviteGauge.tsx`, `ActivityFeed.tsx` (with system-event filter), `ReviewQueue.tsx`.

Cross-cutting fixes:
- **Routing:** unknown `sub` (and unknown inner tab) → redirect to default + rewrite URL via `replaceState`. Kills the `sub=posts` silent fallback. Lives in [ReachPipeline.tsx](../../../components/dashboard-v2/sections/ReachPipeline.tsx).
- **Nav:** drop the duplicate header text-link row; keep one horizontally-scrollable tab bar; fix mobile overflow.
- **Hygiene:** remove dead state (`showDocs`, `expandedDoc`); add an error boundary around the lazy-loaded panels; paginate/virtualize the prospects table.
- **UI quality bar:** built with the frontend-design skill — readability, visible elements, brand-consistent (paper+sage, editorial serif numerals), self-tested screenshots at 1440 + 390 before "done".

### Pending-invite auto-withdraw + ceiling (n8n + Supabase)

- New n8n workflow **`Outreach - Withdraw Stale Invites`**: daily. Selects `stage='connection_sent' AND connection_sent_at < now() - interval '21 days' AND connected_at IS NULL`. Withdraws via Unipile, sets `stage='archived'` + archive reason, logs `outreach_engagement_log.action_type='invite_withdrawn'`. **Caps withdrawals/day (default 20)** so it can't nuke the pipeline in one run; every action logged.
- Config: `integration_config.pending_invite_ceiling` (default 200), `integration_config.stale_invite_days` (default 21), `integration_config.withdraw_daily_cap` (default 20).
- **Health tab gauge:** pending count, oldest-pending age, gauge vs ceiling with a warning state.

### Unified Inbox (Phase 3)

- **Backend reply path:** dashboard → reply-send. Decision deferred to plan: n8n webhook vs Supabase edge function (lean n8n webhook for parity with existing outreach send infra + Unipile creds already wired there). Writes `outreach_messages` (`direction=outbound`), flips `needs_manual_reply=false`.
- **Sentiment:** reuse the existing Haiku negative-reply classifier output.
- **Frontend:** thread list (prospect · last message · sentiment chip) → thread view → reply box with optimistic send.

### Unipile endpoint-health monitor (Phase 4)

- New n8n workflow **`Outreach - Unipile Health Check`**: daily. Pings the endpoints history shows breaking (relations `member_id`, `POST /posts/reaction`, chats shape, `/users/{id}/posts`), asserts response shape, WhatsApps on drift. Pure guardrail.

## Phasing

1. **Phase 1 — Dashboard P0 + restructure** (routing fix, nav dedup, noise filter, WARMING removal, 4-tab split, per-campaign perf, link-clicks). Highest visible win, fully in personal-site/git/testable.
2. **Phase 2 — Pending-invite withdraw + ceiling gauge** (frees send capacity).
3. **Phase 3 — Unified Inbox** (backend reply path + Inbox tab).
4. **Phase 4 — Unipile health monitor** (guardrail).

## Error handling

- Dashboard: error boundary around lazy panels so one failing tab doesn't blank Reach. Routing fallback for bad params.
- Withdraw workflow: per-action try/catch, daily cap, all outcomes logged; Unipile failure → skip + log, never crash the run.
- Inbox send: optimistic UI with rollback on failure; surface send errors inline.
- Health check: non-fatal — reports drift, never mutates data.

## Testing & verification

- Dashboard: unit tests for the routing-fallback fix and inner-tab rendering; self-tested screenshots at 1440 + 390 (visual work isn't done until screenshots are iterated — per standing feedback).
- Withdraw workflow: dry-run against a 2-row test set before enabling; verify `invite_withdrawn` rows land and daily cap holds.
- Health check: assertions validated against live Unipile responses.
- **No silent caps:** withdrawal limit and any list truncation are logged/visible.

## Out of scope (backlog)

- Reviving WF2 / warm-up.
- Comment-cohort-before-invite accept-rate experiment.
- URL shortener for audit links.
- Multi-account / sender rotation (HeyReach-style) — not relevant to single-author engine.
