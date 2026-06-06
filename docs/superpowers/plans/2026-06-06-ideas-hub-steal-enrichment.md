# Ideas Hub + Enriched Kyle Steal Cards — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nest the Kyle "Steal Box" under a new sub-tabbed **"Ideas"** dashboard section and give each tactic real context — call date, signal score, call-type chip, a takeaway context line, and a link to the source call — ordered newest-call-first.

**Architecture:** Extend the existing `kyle_steal_box` Postgres view with three more columns (`task_id`, `call_type`, `summary`), surface them through the `useKyleStealBox` hook, render them on the card, and wrap the panel in a new `Ideas.tsx` hub that uses the codebase's existing `SubTabs` pattern (cloned from `ContentStudio.tsx`). Rename the top-level section slug `steal` → `ideas` with a legacy redirect.

**Tech Stack:** React + TypeScript, Vite, Supabase (PostgREST + SQL view), dashboard-v2 primitives (`HeadRow`, `SubTabs`, `SubTab`).

**Working tree:** isolated worktree `/tmp/personal-site-ideas-hub` on branch `feat/ideas-hub` (off `origin/main`). All paths below are relative to that worktree. Never edit the shared `~/Desktop/personal-site` tree — live automation commits to it.

**No unit-test runner exists** (Vite-only; no vitest/jest, no component tests). Per-task verification is `npx tsc --noEmit`; final verification is `npm run build` + self-tested Playwright screenshots at 1440px and 390px against live data (Ivan's visual-work rule).

**Base table `kyle_call_insights` columns (verified live 2026-06-06):** `id, task_id, source_list, call_type, call_date, participants, summary, insights, created_at`. `call_type` values are snake_case (e.g. `sales_call`). `task_id` is a ClickUp id (e.g. `86b8rna0c`). **`participants` is PII and must NOT be projected.**

---

### Task 1: Extend the `kyle_steal_box` view

**Files:**
- Modify: `migrations/kyle_steal_box_view.sql` (full-file rewrite)

- [ ] **Step 1: Rewrite the migration file**

Replace the entire contents of `migrations/kyle_steal_box_view.sql` with:

```sql
-- kyle_steal_box: anon-readable projection of Kyle-call "steal for my system" tactics.
--
-- 2026-06-06 (Ivan's explicit decision): this view now ALSO exposes the call
-- takeaway (summary) and the source ClickUp task_id, to give each tactic context
-- plus a link back to the call. `summary` CAN name Kyle's prospects (third-party
-- PII Kyle authorized Ivan to MINE, not PUBLISH). Because the dashboard anon key
-- ships in the public JS bundle, this view is effectively WORLD-READABLE — the
-- dashboard password gates the screen, not the data. Ivan was shown the threat
-- model and accepted this exposure; the real fix (Supabase Auth + RLS on
-- auth.uid()) is a separate, deferred, dashboard-wide project. The `participants`
-- column is deliberately NOT projected.
--
-- security_invoker = off → the view runs with definer (owner) rights, so anon can
-- read the curated projection even though base-table RLS blocks anon on
-- kyle_call_insights.

CREATE OR REPLACE VIEW public.kyle_steal_box
WITH (security_invoker = off) AS
SELECT
  k.id,
  k.task_id,
  k.call_type,
  k.call_date,
  k.summary,
  k.created_at,
  (k.insights->>'signal_score')::int                AS signal_score,
  k.insights->'steal_for_my_system'                 AS steal_items
FROM public.kyle_call_insights k
WHERE jsonb_typeof(k.insights->'steal_for_my_system') = 'array'
  AND jsonb_array_length(k.insights->'steal_for_my_system') > 0;

GRANT SELECT ON public.kyle_steal_box TO anon, authenticated;
```

- [ ] **Step 2: Apply the view to Supabase**

Apply the DDL to project `bjbvqvzbzczjbatgmccb`. Preferred: `mcp__supabase-ivan__apply_migration` with name `kyle_steal_box_view_v2` and the SQL above (re-authorize the `supabase-ivan` MCP first if the token is expired). Fallback: paste the SQL into the Supabase SQL editor.

- [ ] **Step 3: Verify the new columns are anon-readable**

Run (anon key is the public publishable key; this proves the projection works through PostgREST):

```bash
ANON="$(grep -m1 'anon' /Users/ivanmanfredi/.claude/projects/-Users-ivanmanfredi-Desktop-Ivan---Content-System/memory/supabase.md | grep -oE 'eyJ[A-Za-z0-9._-]+' | head -1)"
curl -s "https://bjbvqvzbzczjbatgmccb.supabase.co/rest/v1/kyle_steal_box?select=id,task_id,call_type,call_date,summary,signal_score,steal_items&limit=1" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON" | python3 -m json.tool | head -40
```

Expected: one row with `task_id`, `call_type`, `summary` populated (not an error about missing columns). If `$ANON` doesn't resolve, use the service-role key from `supabase.md` just to confirm shape, but the anon read is the real gate.

- [ ] **Step 4: Commit**

```bash
cd /tmp/personal-site-ideas-hub
git add migrations/kyle_steal_box_view.sql
git commit -m "feat(ideas): expose call_type/summary/task_id on kyle_steal_box view"
```

---

### Task 2: Surface the new fields + call-date ordering in the hook

**Files:**
- Modify: `hooks/useKyleStealBox.ts` (full-file rewrite)

- [ ] **Step 1: Rewrite the hook**

Replace the entire contents of `hooks/useKyleStealBox.ts` with:

```ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Reads the `kyle_steal_box` view (steal tactics + call context). As of
 * 2026-06-06 the view also exposes call_type, summary (takeaway) and task_id;
 * see migrations/kyle_steal_box_view.sql for the privacy note.
 */

export interface StealItem {
  tactic: string;
  how_ivan_applies?: string;
  evidence_quote?: string;
}

export interface StealRow {
  id: string;
  task_id: string | null;
  call_type: string | null;
  call_date: string | null;
  summary: string | null;
  created_at: string;
  signal_score: number | null;
  steal_items: StealItem[];
}

/** One steal tactic, flattened with its source-call context. */
export interface StealCard extends StealItem {
  key: string;
  call_date: string | null;
  call_type: string | null;
  summary: string | null;
  created_at: string;
  signal_score: number | null;
  clickup_url: string | null;
}

/** Source-call time for ordering: call_date ms, or -1 so null/invalid sorts last. */
function callTime(c: StealCard): number {
  if (!c.call_date) return -1;
  const t = new Date(c.call_date).getTime();
  return Number.isNaN(t) ? -1 : t;
}

export function useKyleStealBox() {
  const [cards, setCards] = useState<StealCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('kyle_steal_box')
      .select('id, task_id, call_type, call_date, summary, created_at, signal_score, steal_items')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const flat: StealCard[] = [];
    for (const r of (data || []) as StealRow[]) {
      const items = Array.isArray(r.steal_items) ? r.steal_items : [];
      items.forEach((it, i) => {
        const tactic = (it?.tactic || '').trim();
        if (!tactic) return;
        flat.push({
          ...it,
          tactic,
          key: `${r.id}-${i}`,
          call_date: r.call_date,
          call_type: r.call_type,
          summary: r.summary,
          created_at: r.created_at,
          signal_score: r.signal_score,
          clickup_url: r.task_id ? `https://app.clickup.com/t/${r.task_id}` : null,
        });
      });
    }

    // Order by call date (newest first); null/invalid call dates last,
    // tie-broken by extraction time (created_at) desc.
    flat.sort((a, b) => {
      const ka = callTime(a);
      const kb = callTime(b);
      if (ka !== kb) return kb - ka;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    setCards(flat);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { cards, loading, error, refresh };
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /tmp/personal-site-ideas-hub && npx tsc --noEmit
```

Expected: no errors referencing `useKyleStealBox.ts` or `StealCard`. (Pre-existing unrelated errors elsewhere, if any, are out of scope — confirm none are in this file or `StealBox.tsx`.)

- [ ] **Step 3: Commit**

```bash
git add hooks/useKyleStealBox.ts
git commit -m "feat(ideas): hook surfaces call context + orders by call date"
```

---

### Task 3: Enrich the steal card UI

**Files:**
- Modify: `components/dashboard-v2/sections/StealBox.tsx`

- [ ] **Step 1: Replace the `relTime` helper with date + call-type formatters**

In `components/dashboard-v2/sections/StealBox.tsx`, delete the entire `relTime` function (the `function relTime(iso: string): string { ... }` block) and replace it with:

```tsx
function fmtCallDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

function prettyCallType(t: string | null): string {
  if (!t) return '';
  return t.replace(/_/g, ' ');
}
```

- [ ] **Step 2: Replace the `StealTile` component**

Replace the entire `function StealTile({ card }: { card: StealCard }) { ... }` block with:

```tsx
function StealTile({ card }: { card: StealCard }) {
  return (
    <div className="dv-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div
        className="dv-card-lbl"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
      >
        <span style={{ letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: 11, color: 'var(--d-good)' }}>
          Kyle · steal
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--d-paper-dim)' }}>
          {typeof card.signal_score === 'number' && (
            <span title="Source-call signal strength (1–5)">signal {card.signal_score}/5</span>
          )}
          {card.call_date && <span>{fmtCallDate(card.call_date)}</span>}
        </span>
      </div>

      {(card.call_type || card.summary) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {card.call_type && (
            <span
              style={{
                alignSelf: 'flex-start',
                fontSize: 10.5,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                padding: '2px 7px',
                borderRadius: 999,
                background: 'var(--d-ink-2)',
                color: 'var(--d-paper-dim)',
                border: '1px solid var(--d-rule-strong, rgba(255,255,255,0.12))',
              }}
            >
              {prettyCallType(card.call_type)}
            </span>
          )}
          {card.summary && (
            <p style={{ fontSize: 12.5, lineHeight: 1.5, margin: 0, color: 'var(--d-paper-dim)' }}>
              {card.summary}
            </p>
          )}
        </div>
      )}

      <h3 style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.4, margin: 0, color: 'var(--d-paper)' }}>
        {card.tactic}
      </h3>

      {card.how_ivan_applies && (
        <p style={{ fontSize: 13, lineHeight: 1.5, margin: 0, color: 'var(--d-paper-dim)' }}>
          <span style={{ color: 'var(--d-good)', fontWeight: 600 }}>→ </span>
          {card.how_ivan_applies}
        </p>
      )}

      {card.evidence_quote && (
        <blockquote
          style={{
            margin: 0,
            paddingLeft: 12,
            borderLeft: '2px solid var(--d-good)',
            fontSize: 12.5,
            fontStyle: 'italic',
            lineHeight: 1.5,
            color: 'var(--d-paper-dim)',
          }}
        >
          “{card.evidence_quote}”
        </blockquote>
      )}

      {card.clickup_url && (
        <a
          href={card.clickup_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 11.5, color: 'var(--d-good)', textDecoration: 'none', alignSelf: 'flex-start' }}
        >
          source call ↗
        </a>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Retitle the panel header**

In the `StealBox` component's JSX, change the `HeadRow` title from `"Steal Box"` to `"Steal"` (the Ideas hub now provides the section identity). The line:

```tsx
      <HeadRow
        title="Steal Box"
        meta={<>{cards.length} tactic{cards.length === 1 ? '' : 's'} from Kyle's calls</>}
      />
```

becomes:

```tsx
      <HeadRow
        title="Steal"
        meta={<>{cards.length} tactic{cards.length === 1 ? '' : 's'} from Kyle's calls</>}
      />
```

- [ ] **Step 4: Typecheck**

```bash
cd /tmp/personal-site-ideas-hub && npx tsc --noEmit
```

Expected: no errors in `StealBox.tsx` (no remaining reference to `relTime`).

- [ ] **Step 5: Commit**

```bash
git add components/dashboard-v2/sections/StealBox.tsx
git commit -m "feat(ideas): steal cards show signal, call date, type, takeaway + source link"
```

---

### Task 4: Create the Ideas hub section

**Files:**
- Create: `components/dashboard-v2/sections/Ideas.tsx`

- [ ] **Step 1: Create `Ideas.tsx`**

Create `components/dashboard-v2/sections/Ideas.tsx` with:

```tsx
import React, { useState } from 'react';
import { HeadRow, SubTabs, SubTab } from '../primitives';
import { StealBox } from './StealBox';

/**
 * Ideas — hub for mined/curated idea sources. v1 ships one sub-tab (Steal:
 * Kyle-call tactics). The sub-tab bar exists so future sources (e.g. Kyle
 * content-angles) drop in as new tabs without restructuring.
 * URL contract: ?section=ideas&sub=steal (clones ContentStudio's pattern).
 */

type SubKey = 'steal';
const SUB_LABELS: Record<SubKey, string> = { steal: 'Steal' };
const SUB_ORDER: SubKey[] = ['steal'];

function getInitialSub(): SubKey {
  if (typeof window === 'undefined') return 'steal';
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('sub');
  if (raw && SUB_ORDER.includes(raw as SubKey)) return raw as SubKey;
  return 'steal';
}

function syncSubToUrl(sub: SubKey) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (url.searchParams.get('sub') !== sub) {
    url.searchParams.set('sub', sub);
    window.history.replaceState(null, '', url.toString());
  }
}

export function Ideas() {
  const [sub, setSub] = useState<SubKey>(getInitialSub);

  const handleSub = (s: string) => {
    setSub(s as SubKey);
    syncSubToUrl(s as SubKey);
  };

  const renderSub = () => {
    switch (sub) {
      case 'steal':
        return <StealBox />;
    }
  };

  return (
    <>
      <HeadRow title="Ideas" />
      <SubTabs>
        {SUB_ORDER.map((key) => (
          <SubTab key={key} id={key} active={sub} onChange={handleSub}>
            {SUB_LABELS[key]}
          </SubTab>
        ))}
      </SubTabs>
      {renderSub()}
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /tmp/personal-site-ideas-hub && npx tsc --noEmit
```

Expected: no errors. (Confirms `../primitives` exports `HeadRow`, `SubTabs`, `SubTab` — same import `ContentStudio.tsx` uses.)

- [ ] **Step 3: Commit**

```bash
git add components/dashboard-v2/sections/Ideas.tsx
git commit -m "feat(ideas): add Ideas hub section with Steal sub-tab"
```

---

### Task 5: Rewire nav, section id, and legacy redirect

**Files:**
- Modify: `components/dashboard-v2/types.ts`
- Modify: `components/dashboard-v2/DemoShell.tsx`
- Modify: `components/dashboard-v2/Shell.tsx`

- [ ] **Step 1: Rename the SectionId slug**

In `components/dashboard-v2/types.ts`, in the `SectionId` union, change the line `  | 'steal'` to `  | 'ideas'`.

- [ ] **Step 2: Swap the section import in DemoShell**

In `components/dashboard-v2/DemoShell.tsx`, change the import line:

```tsx
import { StealBox } from './sections/StealBox';
```

to:

```tsx
import { Ideas } from './sections/Ideas';
```

- [ ] **Step 3: Update the nav item**

In `components/dashboard-v2/DemoShell.tsx`, change the nav item line:

```tsx
    { id: 'steal', name: 'Steal Box', num: '⌖', group: 'knowledge' },
```

to:

```tsx
    { id: 'ideas', name: 'Ideas', num: '⌖', group: 'knowledge' },
```

- [ ] **Step 4: Update the renderer**

In `components/dashboard-v2/DemoShell.tsx`, change the renderer line:

```tsx
    steal: () => <StealBox />,
```

to:

```tsx
    ideas: () => <Ideas />,
```

- [ ] **Step 5: Update the Shell allowlist + add legacy redirect**

In `components/dashboard-v2/Shell.tsx`, change the `ALL_SECTIONS` array so `'steal'` becomes `'ideas'`:

```tsx
const ALL_SECTIONS: SectionId[] = [
  'briefing', 'content', 'reach', 'ops', 'clients', 'knowledge', 'agent', 'ideas', 'personal',
];
```

Immediately below the `ALL_SECTIONS` declaration, add the legacy remap + resolver:

```tsx
// Legacy slug remap: ?section=steal (the old standalone panel) now lives at
// ?section=ideas&sub=steal. Old links keep working.
const LEGACY_SECTION_REMAP: Record<string, SectionId> = { steal: 'ideas' };

function resolveSection(raw: string | null): SectionId | null {
  if (!raw) return null;
  const mapped = (LEGACY_SECTION_REMAP[raw] ?? raw) as SectionId;
  return ALL_SECTIONS.includes(mapped) ? mapped : null;
}
```

Then, in the `useState<SectionId>` initializer, replace:

```tsx
    const s = params.get('section') as SectionId | null;
    return s && ALL_SECTIONS.includes(s) ? s : 'briefing';
```

with:

```tsx
    return resolveSection(params.get('section')) ?? 'briefing';
```

And in the `onPop` handler (popstate listener), replace:

```tsx
      const s = params.get('section') as SectionId | null;
      if (s && ALL_SECTIONS.includes(s) && s !== active) {
        setActive(s);
      }
```

with:

```tsx
      const s = resolveSection(params.get('section'));
      if (s && s !== active) {
        setActive(s);
      }
```

(The existing URL-sync `useEffect` then rewrites `?section=steal` → `?section=ideas` automatically, because `active` is now `ideas` while the param still reads `steal`.)

- [ ] **Step 6: Typecheck**

```bash
cd /tmp/personal-site-ideas-hub && npx tsc --noEmit
```

Expected: no errors. There should be **no remaining references to `StealBox` in `DemoShell.tsx`** and **no `'steal'` in `SectionId` or `ALL_SECTIONS`**. Verify:

```bash
grep -rn "StealBox" components/dashboard-v2/DemoShell.tsx; grep -rn "'steal'" components/dashboard-v2/types.ts components/dashboard-v2/Shell.tsx
```

Expected: both greps return nothing.

- [ ] **Step 7: Commit**

```bash
git add components/dashboard-v2/types.ts components/dashboard-v2/DemoShell.tsx components/dashboard-v2/Shell.tsx
git commit -m "feat(ideas): rename section steal -> ideas with legacy redirect"
```

---

### Task 6: Build + visual verification

**Files:** none (verification only)

- [ ] **Step 1: Production build**

```bash
cd /tmp/personal-site-ideas-hub && npm run build
```

Expected: build succeeds with no TypeScript/Vite errors.

- [ ] **Step 2: Run the dev server**

```bash
cd /tmp/personal-site-ideas-hub && npm run dev
```

Note the local URL (Vite default `http://localhost:5173`). The dashboard reads **live** Supabase data, so the enriched cards render against real rows.

- [ ] **Step 3: Screenshot the Ideas hub via playwright-driver**

Use the **playwright-driver** skill (Mode 1 inspect; reuse the `dashboard` profile for the password gate — see `dashboard-v2-routing-and-audit.md`). Navigate to `?section=ideas&sub=steal` on the dev server and capture screenshots at **1440px** and **390px** widths.

Verify on a real card:
- "Kyle · steal" label + `signal N/5` + a real **call date** in the header.
- A **call-type chip** (e.g. "sales call").
- A **context line** (the takeaway) above the tactic.
- The tactic, "→ how Ivan applies", and Kyle's italic quote.
- A working **"source call ↗"** link (href = `https://app.clickup.com/t/<task_id>`, opens in a new tab).
- Cards are ordered **newest call date first** (compare the dates top-to-bottom).
- The left nav shows **"Ideas"** (not "Steal Box") with the ⌖ glyph, and a **"Steal"** sub-tab is visible.

- [ ] **Step 4: Verify the legacy redirect**

In the same browser, load `?section=steal` and confirm it lands on the Ideas hub (Steal tab) and the URL rewrites to `?section=ideas`.

- [ ] **Step 5: Iterate if needed**

If any card field is missing, mis-styled, or ordering is wrong, fix the relevant file (Task 2/3) and re-screenshot. Do not mark complete until the screenshots show every field correct (Ivan's rule: visual work isn't done on functional asserts alone).

- [ ] **Step 6: Final commit (if Step 5 made changes)**

```bash
git add -A && git commit -m "fix(ideas): visual polish from screenshot review"
```

---

## Done criteria
- `npm run build` is clean.
- Screenshots at 1440px + 390px show signal, call date, call-type chip, takeaway, tactic, how-Ivan-applies, Kyle quote, and a working source-call link — ordered newest-call-first.
- Nav reads "Ideas" with a "Steal" sub-tab; `?section=steal` redirects to `?section=ideas`.
- `migrations/kyle_steal_box_view.sql` applied to Supabase and anon-readable with the 3 new columns.

## Handoff to a reviewer / merge
This branch (`feat/ideas-hub`) is in a worktree off `origin/main`. To integrate, push with a refspec and open a PR — **do not** merge through the shared `~/Desktop/personal-site` tree (live automation owns it). The deploy path is `git push origin main` (GitHub Actions); coordinate the merge so it doesn't collide with the automation's commits.
