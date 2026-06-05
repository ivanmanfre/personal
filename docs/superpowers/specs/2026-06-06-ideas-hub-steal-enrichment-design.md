# Ideas Hub + Enriched Steal Cards — Design

**Date:** 2026-06-06
**Author:** Ivan (via Claude)
**Status:** Approved, ready for planning
**Area:** personal-site dashboard-v2

## Problem

The Kyle "Steal Box" panel surfaces tactics mined from Kyle Hunt's coaching
calls, but each card shows only `tactic → how Ivan applies → Kyle quote` plus a
relative timestamp. There is **no call context and no source** — Ivan can't tell
which call a tactic came from, when, how strong the signal was, or open the
underlying call. The tactics read as context-free fragments.

Secondary: "Steal Box" is a bare top-level nav item. Ivan wants it nested under
a broader **"Ideas"** hub that can grow to hold other idea-sources later.

## Decisions (locked during brainstorming)

1. **Name:** the top-level section becomes **"Ideas"**.
2. **Structure:** "Ideas" is a hub with `?sub=` sub-tabs (the existing
   ContentStudio pattern). **v1 ships one tab — "Steal"** — rendering the
   current `StealBox`. The tab bar exists so future sources (e.g. Kyle
   content-angles) slot in as additional tabs without restructuring.
3. **Card context to add:** call date, signal score, call-type chip, a brief
   context line (the call takeaway), and a link to the source call doc (ClickUp).
4. **Ordering:** cards ordered by **call date, newest first** (true call order).
   Rows with a null `call_date` sort last, tie-broken by `created_at` desc.
5. **Privacy stance (explicit Ivan decision, 2026-06-06):** show everything on
   the existing world-readable view. See Risk below — this is documented, not
   mitigated, at Ivan's instruction.

## Risk (documented, accepted by Ivan)

The dashboard's anon key ships in the public JS bundle, so anything
anon-readable via the `kyle_steal_box` view is effectively **world-readable**;
the dashboard password gates the screen, not the data. This change adds the call
**takeaway** (which can name Kyle's prospects — third-party PII Kyle authorized
Ivan to *mine*, not *publish*) and **ClickUp task ids** to that view. Ivan was
shown the threat model twice and chose "show everything on the public view." The
real fix (Supabase Auth + RLS on `auth.uid()`) remains a separately-deferred,
dashboard-wide project and is **out of scope here**. The view's SQL comment will
record this reversal of the prior PII-minimal stance.

## Components

### 1. View — `migrations/kyle_steal_box_view.sql`
Extend the `kyle_steal_box` projection. Currently selects
`id, call_date, created_at, signal_score, steal_items`. **Add three columns from
the base `kyle_call_insights` row:**
- `task_id` — source ClickUp task id, for the deep-link.
- `call_type` — sales/client category, for the chip.
- `summary` — the call takeaway, used as the context line.

`CREATE OR REPLACE VIEW ... WITH (security_invoker = off)` re-run in Supabase via
migration. Update the header comment to record the 2026-06-06 decision.

*Implementation note:* confirm the exact base-column names (`task_id`,
`call_type`, `summary`) against `kyle_call_insights` before writing the
migration — memory records these as real columns, but verify.

### 2. Hook — `hooks/useKyleStealBox.ts`
- Add `task_id`, `call_type`, `summary` to the `.select(...)` and to `StealRow`.
- Propagate `call_date`, `call_type`, `summary`, `task_id` onto each flattened
  `StealCard`.
- Derive `clickup_url = https://app.clickup.com/t/${task_id}` when `task_id` set.
- **Ordering:** sort flattened cards by `call_date` desc (nulls last), tie-broken
  by `created_at` desc. (Server `.order('created_at')` stays as a coarse fetch
  order; final sort happens after flattening so call-date order is exact.)

### 3. Ideas hub — `components/dashboard-v2/sections/Ideas.tsx` (new)
Mirror `ContentStudio.tsx`'s sub-tab mechanism:
- Read `?sub=` (default `steal`), keep it URL-synced via the same
  `syncSubToUrl` approach.
- Render `<SubTabs><SubTab id="steal">Steal</SubTab></SubTabs>` and switch the
  body. v1 body for `steal` = `<StealBox/>`.

### 4. Steal card UI — `components/dashboard-v2/sections/StealBox.tsx`
Per-tile additions (`StealTile`):
- Header: keep "Kyle · steal"; add a **signal badge** (`signal N/5`) and the
  **call date** (real date; relative time optional secondary).
- **Call-type chip** ("sales call" / "client call") when `call_type` present.
- **Context line** = `summary`, visually distinct from "→ how Ivan applies".
- **"source call ↗"** anchor → `clickup_url`, `target="_blank"
  rel="noopener noreferrer"`, rendered only when `task_id` present.
- Keep tactic, "→ how Ivan applies", Kyle quote.
- The `HeadRow` title for the panel stays "Steal" (the hub provides "Ideas").

### 5. Registration
- `components/dashboard-v2/types.ts` — `SectionId`: `steal` → `ideas`.
- `components/dashboard-v2/DemoShell.tsx` — nav item
  `{ id: 'ideas', name: 'Ideas', num: '⌖', group: 'knowledge' }`; renderer
  `ideas: () => <Ideas/>`. Drop the standalone `steal` nav item + renderer.
- `components/dashboard-v2/Shell.tsx` — `ALL_SECTIONS`: replace `steal` with
  `ideas`. Add a legacy redirect: a request for `?section=steal` resolves to
  `?section=ideas&sub=steal` (old links keep working).

## Out of scope
- Real auth / RLS (separately deferred, dashboard-wide).
- A second Ideas sub-tab (content-angles feed) — the bar is built to accept it
  later, but v1 ships Steal only.
- Any change to the Kyle extractor / n8n pipeline or the insights schema.

## Testing
- Typecheck/build clean.
- Self-tested screenshots at **1440px and 390px** against live data before
  claiming done (Ivan's visual-work rule): verify date, signal, type chip,
  context line, and a working "source call" link on a real card; verify
  call-date-desc ordering; verify `?section=steal` legacy redirect.

## Build hygiene
- Work in the isolated worktree off `origin/main` (`feat/ideas-hub`); refspec
  push — never the shared local tree (live automation commits to it; the local
  checkout currently trails `origin/main`).
