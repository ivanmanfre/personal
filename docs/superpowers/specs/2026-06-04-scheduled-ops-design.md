# Scheduled Ops — design

**Date:** 2026-06-04
**Status:** Approved (brainstorm), pending implementation plan
**Repo:** personal-site (Ivan System dashboard)
**Branch:** feat/scheduled-ops

## Problem

Every automated thing in Ivan's system that runs on a timer is effectively invisible until it breaks loudly. n8n cron workflows, macOS launchd agents (ivan-listener, the 11:00 daily memory compactor, the weekly skill prune), and Claude Code scheduled agents all "just run." The dashboard's current [WorkflowsPanel.tsx](../../../components/dashboard/WorkflowsPanel.tsx) only knows about runs that **happened** — it has no concept of what was **supposed** to happen, so a cron that silently stops firing (e.g. `Execution Log Sync`, `Signal Clusters`) produces no signal at all.

Two jobs to be done, in priority order:

1. **Catch silent failures / missed runs** — flag jobs that should have run but didn't.
2. **At-a-glance health board** — one categorized, well-labeled pane showing every scheduled job, what it is, last run, status, and errors inline.

Secondary (later, not in initial scope): forward "next 24h" calendar; WhatsApp push alerts on failure.

## Why a registry

Missed-run detection is impossible from run data alone — you cannot flag what didn't run unless you have first **declared that it should run**. The core new concept is a registry of expected jobs, against which actual runs are matched. This is what separates this from the existing backward-looking execution log.

## Scope decision

Destination is **everything that runs on a timer**, clearly labeled by source so the view reads as a catalog, not a soup. Sequenced as **Approach B**: design the schema source-agnostic from day one, implement n8n coverage first (data already synced, ~80% of jobs, zero new Mac plumbing), then add non-n8n sources via heartbeat as a fast follow-on.

| Source | Reports to dashboard today? | Missed-run detection needs |
|---|---|---|
| n8n crons (~20+) | Yes — `dashboard_workflow_stats` + `workflow_execution_logs` carry schedule + last-run | Parse schedule + compare to last run |
| macOS launchd (ivan-listener, 11:00 memory compactor, weekly skill prune) | No — local logs only | ~10-line heartbeat → Supabase |
| Claude Code scheduled agents (`/schedule` routines) | No | Same heartbeat helper |

## Data model

### `scheduled_job_registry` (new table)

One row per scheduled job of any source — the catalog.

| Column | Type | Purpose |
|---|---|---|
| `id` | uuid pk | |
| `job_key` | text unique | stable id: `n8n:<workflow_id>`, `launchd:<label>`, `cc:<routine>` |
| `source` | text | `n8n` \| `launchd` \| `claude-code` — drives labeling |
| `label` | text | human name ("Signal Clusters") |
| `description` | text | what this job does (the "well-described" requirement) |
| `category` | text | Content / Outreach / Brain-Memory / Recording / Meta |
| `schedule_human` | text | "Daily 11:00 local", "Every hour" |
| `expected_interval_minutes` | int null | missed-run threshold; null = no overdue eval (irregular jobs) |
| `grace_minutes` | int | tolerance before flagging overdue (default per-job) |
| `timezone` | text | n8n=UTC, launchd=local — for human display |
| `enabled` | bool | mirrors n8n active/paused or launchd loaded |
| `last_synced_at` | timestamptz | when the row was last refreshed from its source |
| `created_at` / `updated_at` | timestamptz | |

- n8n rows are auto-upserted by the existing hourly sync (Phase 1).
- launchd / CC rows are seeded from a committed declaration file (Phase 2).
- Upsert is idempotent on `job_key`.

### `scheduled_run_log` (new table — Phase 2 only)

Where non-n8n jobs report runs. Not needed in Phase 1 (n8n last-run comes from `dashboard_workflow_stats`).

| Column | Purpose |
|---|---|
| `job_key` | FK-ish to registry |
| `status` | success \| error \| started |
| `started_at` / `finished_at` | |
| `detail` / `error_message` | |

### `scheduled_ops_status` (new view)

Anon-readable (RLS-safe), the single source of computed status. For each enabled registry row it derives:

- `last_run_at`, `last_status`, `error_count_24h`, `last_error_message` — from the source's native data (n8n → `dashboard_workflow_stats`; non-n8n → `scheduled_run_log`).
- `minutes_since_last_run`.
- `status`:
  - `DISABLED` — `enabled = false`.
  - `ERRORING` — last run failed or `error_count_24h > 0`.
  - `OVERDUE` — `expected_interval_minutes` not null AND `minutes_since_last_run > expected_interval_minutes + grace_minutes`.
  - `UNKNOWN` — no recorded run, or `expected_interval_minutes` null (never false-positive OVERDUE).
  - `OK` — otherwise.

All status logic lives in this one view; the dashboard only reads it.

## Ingestion

### Phase 1 — n8n

Extend the existing hourly n8n→Supabase sync (the workflow that already populates `dashboard_workflow_stats`) to additionally **upsert a `scheduled_job_registry` row for every scheduled-trigger workflow**. Because n8n already knows the schedule, the sync stamps `expected_interval_minutes` — keeping all cron parsing out of Postgres. `category` derives from the existing pipeline grouping; `description` seeds from the workflow name/notes and is editable later. Webhook/manual workflows are excluded from the registry.

### Phase 2 — launchd + Claude Code

- A ~10-line **heartbeat helper** each job calls at start and end. Fire-and-forget: it swallows its own errors and must never break the job it wraps. Posts `{job_key, status, ts, detail}` to Supabase (REST insert with a scoped key, or a small `scheduled-heartbeat` edge function).
- A committed **declaration file** listing the launchd / CC jobs (label, description, schedule_human, expected interval, category) → seeds their registry rows so descriptions are version-controlled.
- `scheduled_ops_status` extended to read `last_run_at` from `scheduled_run_log` for non-n8n sources.

## UI — new "Scheduled Ops" tab

A **dedicated tab** in the Operations group (not a sub-tab of Workflows): the view spans beyond n8n, and [WorkflowsPanel.tsx](../../../components/dashboard/WorkflowsPanel.tsx) is already ~614 lines and n8n-specific. Add `scheduled-ops` to the dashboard tab list and routing.

- **Heartbeat summary strip (top):** `X OK · Y overdue · Z erroring · N disabled`. Overdue/erroring counts render large and red when > 0 — the at-a-glance answer to "is everything good?"
- **Grouped by category**, with a toggle to group by source. Overdue/erroring jobs float to the top within each group.
- **Each job row:** label (bold) + description (muted) + color-coded source chip (n8n / launchd / claude-code) + `schedule_human` + relative last-run ("14m ago") + status chip + expandable last error.
- **Filters:** source / status / search — reuse existing dashboard filter components.
- **Read-only in Phase 1.** Pausing n8n already lives in the Workflows tab; not duplicated here.
- **Data:** new `useScheduledOps()` hook reading `scheduled_ops_status` via the anon key, on the existing auto-refresh / realtime pattern.

## Phasing

- **Phase 1 (ships first):** `scheduled_job_registry` + `scheduled_ops_status` view + n8n sync extension + Scheduled Ops tab → health board **and** missed-run detection for ~80% of jobs, no Mac instrumentation.
- **Phase 2 (fast follow):** `scheduled_run_log` + heartbeat helper + declaration file for launchd/CC + view extension → coverage of **everything**.
- **Secondary (later, optional):** WhatsApp alert on OVERDUE/ERRORING via the existing alert path + morning-triage; forward "next 24h" list.

## Guarantees / edge handling

- Null last-run ⇒ `UNKNOWN`, never `OVERDUE` (no false positives on never-run or newly-registered jobs).
- Null `expected_interval_minutes` ⇒ skip overdue eval (irregular jobs show OK/ERRORING only).
- Registry upsert idempotent on `job_key`.
- Heartbeat is fire-and-forget — failures never propagate to the wrapped job.

## Test approach

- Seed a registry row with a stale `last_run` past `interval + grace` → expect `OVERDUE` in the view.
- A deliberately failed n8n run → expect `ERRORING`.
- `enabled = false` → excluded from alarm counts (counted as `DISABLED`).
- Null last-run → `UNKNOWN`, not `OVERDUE`.

## Out of scope

- Manual trigger / pause from this view (n8n pause stays in Workflows tab).
- Cron parsing inside Postgres (n8n stamps the interval; declaration file supplies it for non-n8n).
- Forward calendar and push alerts (secondary, later).
