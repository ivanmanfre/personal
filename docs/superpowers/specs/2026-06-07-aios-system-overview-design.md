# AIOS System Overview — Design

**Date:** 2026-06-07
**Status:** Approved (brainstorming) — pending spec review
**Section:** Dashboard v2 → new top-level "System" section

## Problem

Ivan's operating system has grown large — 19 business skills, ~50 GSD commands, stochastic + superpowers suites, 224 n8n workflows, 3 memory tiers, multiple integrations and edge functions — but **none of that capability roster is visible anywhere on the dashboard**. Existing panels surface slices (SkillDrafts = approval queue, Brain = memory, Workflows = n8n health, Usage = tokens), but there is no single place that answers *"what can my whole system actually do?"* The result: Ivan underestimates his own system because there's no mirror reflecting its full surface area.

## Goal

A single **System** section that gives an at-a-glance, visual overview of the entire AIOS plus a readable roster of every capability — acting as a **summary index** that deep-links into the existing detail panels. Easy to read, easy to visualize, always current.

## Non-Goals

- Not a replacement for existing operational panels (Workflows, Health, Brain, Usage) — it summarizes and links to them.
- Not a live monitor — Health and Scheduled Ops already own real-time alerting. This is an overview/reference layer.
- Not an editor — read-only roster. (Skill *drafts* approval stays in its own panel.)

## Scope

**Whole-AIOS overview.** Capabilities surfaced, by `kind`:

| kind | Source | Examples |
|---|---|---|
| `skill` | `~/.claude/skills/*/SKILL.md` | grill-me, negotiate, recall, brain |
| `command` | GSD / stochastic / superpowers command dirs | plan-phase, stochastic-audit, brainstorming |
| `panel` | This repo's `components/dashboard*` | the dashboard panels themselves |
| `integration` | Memory/config (n8n, Supabase, ClickUp, Apify, Slack, Evolution, Railway, Calendly…) | external services |
| `edge_fn` | Supabase edge functions | claude-brain-query, lm-cover-gemini |

Live counts for **n8n workflows**, **memory tiers/files**, and **token usage** are read from existing Supabase-backed hooks, not re-synced.

## Architecture

### Data model (fully live via Supabase)

New table **`aios_capabilities`**:

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `kind` | text | `skill` \| `command` \| `panel` \| `integration` \| `edge_fn` |
| `slug` | text | stable id, unique per kind |
| `name` | text | display name |
| `description` | text | one-line (skills: parsed from frontmatter `description:`) |
| `group` | text | display grouping (e.g. `business`, `gsd`, `stochastic`, `superpowers`) |
| `source_path` | text | where it lives (for reference) |
| `last_used_at` | timestamptz | null = never (adoption signal) |
| `invoke_count` | int | from session-log analysis |
| `status` | text | `live` \| `draft` \| `deprecated` |
| `metadata` | jsonb | kind-specific extras |
| `synced_at` | timestamptz | last sync stamp |

Unique constraint on `(kind, slug)` for idempotent upsert. RLS: readable by the dashboard's existing auth path (match sibling tables like `claude_usage`).

RPC **`aios_capabilities_overview()`** → returns the roster grouped by `kind` + per-kind counts, ordered by `group` then `name`.

### Sync pipeline

Script **`scripts/sync-aios-capabilities.mjs`** (mirrors how Usage data already flows local → Supabase):

1. Scan `~/.claude/skills/*/SKILL.md`, parse YAML frontmatter (`name`, `description`).
2. Scan GSD / stochastic / superpowers command dirs → `command` rows grouped by suite.
3. Read this repo's `components/dashboard*` to enumerate `panel` rows.
4. Read integrations + edge functions from a small declared manifest (memory/config — avoids guessing).
5. Compute `last_used_at` / `invoke_count` from `~/.claude/projects` session logs (same source `usage-insights` uses).
6. Upsert all rows to `aios_capabilities` (on conflict `(kind, slug)` update), stamp `synced_at`, mark missing rows `deprecated`.

Runnable manually (`node scripts/sync-aios-capabilities.mjs`) **and** wired for auto-refresh in this build via a **debounced Stop-hook** (`~/.claude/hooks/`): on session end, re-sync only if the last `synced_at` is older than a threshold (default 6h) so it stays current without running every turn. The script runs **locally** (it needs `~/.claude` access) — never in GitHub Actions.

The integration + edge-function rows (step 4) are seeded from a declared manifest built from existing memory files (n8n, Supabase, ClickUp, Apify, Slack, Evolution, Railway, Calendly, etc.) — confirmed in scope.

### Frontend

```
components/dashboard-v2/sections/SystemOverview.tsx   ← section (HeadRow + hero + roster)
components/dashboard/CapabilityHero.tsx               ← visual cluster map + stat band
components/dashboard/CapabilityRoster.tsx             ← grouped collapsible roster
hooks/useAiosOverview.ts                              ← fans out to RPC + existing hooks
```

- `useAiosOverview` calls `aios_capabilities_overview()` for the roster and **reuses** `useWorkflows`, `useBrainStats`, `useClaudeUsage` for live workflow-health / memory / token numbers. No duplicate plumbing.
- `CapabilityHero`: cluster map (skills ◦ workflows ◦ memory ◦ integrations), nodes health-colored and sized by count, with a stat band (19 skills · 224 flows · 3 tiers · N integ). The visual "wow".
- `CapabilityRoster`: collapsible group per `kind`; each row = name + one-line description + status dot; each group header **deep-links** to its detail panel (Skills→SkillDrafts, Workflows→Operations·Workflows, Memory→Knowledge·Brain, Usage→Operations·Usage). Skills group shows a "N drafts pending →" badge.

### Nav wiring

Add `{ id: 'system', name: 'System', num: '08', group: 'knowledge' }` to the nav and `system: () => <SystemOverview />` to `sectionRenderers` (in the shell that builds the authed nav). URL-synced like other sections.

## Consolidation (overlap resolution — option A)

The overview is a **summary index**, overlapping existing panels *by design* — the correct pattern is **link, don't replace**.

- **DELETE `components/dashboard/SystemMapPanel.tsx`** — confirmed orphan (not imported anywhere). Its purpose (visual pipeline map) is superseded by `CapabilityHero`. Also remove `components/dashboard/system-map/` if nothing else imports it (verify before deleting).
- **Keep** SkillDraftsPanel, WorkflowsPanel, UsagePanel, HealthPanel, BrainPanel — these do real drill-down work; the overview summarizes + deep-links to them.

## Error Handling

- RPC/hook failure → section renders the hero from whatever live hooks succeed + a "roster unavailable" inline notice; never blanks the whole section.
- Empty table (sync never run) → roster shows a "Run sync to populate" empty state; hero still shows live workflow/memory/usage numbers.
- Sync script: per-source try/catch so one bad source (e.g. n8n API down) doesn't abort the whole sync; logs what it skipped (no silent truncation).
- Stop-hook: debounce check + hard timeout so a slow sync never blocks session exit; failures log and exit 0 (never break the session).

## Testing

- Sync script: unit test frontmatter parsing (quoted/unquoted/missing `description:`) and the deprecate-missing-rows logic against a fixture skills dir.
- RPC: verify grouping + counts on seeded rows.
- Frontend: `useAiosOverview` renders roster from mocked RPC; hero degrades gracefully when a live hook errors; deep-links point to correct section/sub URLs.
- Manual: run real sync, load the System section, confirm counts match reality (19 skills etc.) and links land on the right panels.

## Git Hazard Note

`personal-site` has live automation committing to `main` and switching branches. Per `personal-site-concurrent-git-hazard.md`, implementation must happen in an **isolated worktree** with refspec push — not the shared tree.

## Open Questions

- None blocking. Integration/edge-fn manifest (step 4) will be a small declared list seeded during implementation from existing memory files.
