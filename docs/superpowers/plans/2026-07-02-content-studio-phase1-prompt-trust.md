# Content Studio Phase 1 — Prompt Trust Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prompt state becomes trustworthy: provenance visible on every prompt, external writes can never destroy an unsaved draft, version bumps for ANY writer, the second (ClickUp-writing) prompt editor is retired.

**Architecture:** A Supabase trigger owns version bumping (removing the client-side read-then-increment), `savePrompt` gains compare-and-swap, and the panel gains a provenance line plus an external-change banner driven by a pure resolver function (unit-tested). PromptsPanel (ClickUp editor) is archived and the Knowledge tab repointed.

**Tech Stack:** React, Supabase (project `bjbvqvzbzczjbatgmccb`, table `content_prompts` — PRODUCTION, additive migrations only), vitest, Playwright.

## Global Constraints

- Repo `~/Desktop/personal-site`; isolated worktree + refspec push (personal-site-concurrent-git-hazard); deploy = `git push origin main` only.
- `content_prompts` is production data feeding live n8n runs. Migrations are additive (trigger + column only). No row rewrites except the category backfill UPDATE, which touches only the new column.
- The Prompts→Supabase Sync workflow was caught reverting this table nightly (full-system audit 2026-07-02). Nothing in this phase may assume that sync is dead.
- Playwright screenshot verification before any "done" claim.

---

### Task 1: Worktree setup

- [ ] **Step 1:**

```bash
cd ~/Desktop/personal-site && git fetch origin
git worktree add ../personal-site-wt-phase1 -b phase1-prompt-trust origin/main
cd ../personal-site-wt-phase1 && npm install 2>&1 | tail -2
```

---

### Task 2: DB migration — server-side version bump + audit-friendly updated_by

**Files:**
- Create: `supabase/migrations/20260702_content_prompts_version_trigger.sql` (also applied via MCP `apply_migration`)

**Interfaces:**
- Produces: any UPDATE that changes `body` bumps `version` and `updated_at` server-side; writers that don't set `updated_by` get `'external'`. Task 3's savePrompt relies on the trigger doing the bump.

- [ ] **Step 1: Write the migration**

```sql
-- Version bumps must happen for ANY writer (dashboard, n8n, sync workflows),
-- otherwise a revert re-uses the old version and the UI shows "unchanged".
create or replace function public.content_prompts_touch()
returns trigger language plpgsql as $$
begin
  if new.body is distinct from old.body then
    new.version := coalesce(old.version, 0) + 1;
    new.updated_at := now();
    -- Writer that did not identify itself = external system.
    if new.updated_by is not distinct from old.updated_by then
      new.updated_by := 'external';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists content_prompts_version_bump on public.content_prompts;
create trigger content_prompts_version_bump
  before update on public.content_prompts
  for each row execute function public.content_prompts_touch();
```

- [ ] **Step 2: Apply via Supabase MCP `apply_migration` (name: `content_prompts_version_trigger`) against project bjbvqvzbzczjbatgmccb**

- [ ] **Step 3: Verify with a no-op-safe probe (MCP `execute_sql`)**

```sql
-- pick any row, rewrite same body with a marker change appended+removed is risky on prod;
-- instead verify trigger exists and fires on a scratch row:
insert into content_prompts (slug, title, body, kind) values ('_trigger_probe', 'probe', 'v1', 'probe');
update content_prompts set body = 'v2' where slug = '_trigger_probe';
select version, updated_by from content_prompts where slug = '_trigger_probe';  -- expect version=2, updated_by='external'
delete from content_prompts where slug = '_trigger_probe';
```

Expected: `version = 2` (insert default 1, one bump), `updated_by = 'external'`.

- [ ] **Step 4: Commit the migration file**

```bash
git add supabase/migrations/20260702_content_prompts_version_trigger.sql
git commit -m "feat(db): server-side version bump trigger on content_prompts"
```

---

### Task 3: savePrompt — drop client bump, add compare-and-swap

**Files:**
- Modify: `hooks/useContentPrompts.ts:77-100`

**Interfaces:**
- Produces: `savePrompt(id: string, patch: {body?: string; title?: string; is_active?: boolean}, expectedVersion: number): Promise<{ok: true} | {ok: false; conflict: true}>`. Panel (Task 5) handles the conflict return.

- [ ] **Step 1: Replace the savePrompt body**

```ts
/** PATCH body/title. Version bump is owned by the DB trigger.
 * Compare-and-swap on version: if another writer landed first, returns
 * {ok:false, conflict:true} and writes nothing. */
const savePrompt = useCallback(async (
  id: string,
  patch: { body?: string; title?: string; is_active?: boolean },
  expectedVersion: number,
) => {
  const update: Record<string, any> = {
    updated_at: new Date().toISOString(),
    updated_by: 'dashboard',
  };
  if (patch.body !== undefined) update.body = patch.body;
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.is_active !== undefined) update.is_active = patch.is_active;
  const { data, error } = await supabase
    .from('content_prompts')
    .update(update)
    .eq('id', id)
    .eq('version', expectedVersion)
    .select('id');
  if (error) throw new Error(`save failed: ${error.message}`);
  if (!data || data.length === 0) return { ok: false as const, conflict: true as const };
  return { ok: true as const };
}, []);
```

- [ ] **Step 2: Type-check; update the existing call site in PromptLibraryPanel to pass `selected.version` and handle `{conflict}` (full JSX in Task 5 — for now pass the arg and `alert`-free console.warn so tsc passes)**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add hooks/useContentPrompts.ts components/dashboard/PromptLibraryPanel.tsx
git commit -m "feat: compare-and-swap prompt saves; version bump moved to DB trigger"
```

---

### Task 4: Pure draft-resolver + unit tests (the no-data-loss core)

**Files:**
- Create: `components/dashboard/promptDraftResolver.ts`
- Test: `components/dashboard/promptDraftResolver.test.ts`

**Interfaces:**
- Produces: `resolveDraft(prev: DraftState, row: {id: string; body: string; title: string; updatedAt: string; updatedBy: string | null} | null, dirty: boolean): DraftState` where `DraftState = { body: string; title: string; externalUpdate: null | { updatedAt: string; updatedBy: string | null } }`. Task 5 wires it into the panel effect.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { resolveDraft } from './promptDraftResolver';

const row = (over = {}) => ({ id: '1', body: 'B1', title: 'T1', updatedAt: '2026-07-02T10:00:00Z', updatedBy: 'dashboard', ...over });

describe('resolveDraft', () => {
  it('seeds draft from row when not dirty', () => {
    const s = resolveDraft({ body: '', title: '', externalUpdate: null }, row(), false);
    expect(s).toEqual({ body: 'B1', title: 'T1', externalUpdate: null });
  });
  it('clears everything when no row selected', () => {
    const s = resolveDraft({ body: 'x', title: 'y', externalUpdate: null }, null, true);
    expect(s).toEqual({ body: '', title: '', externalUpdate: null });
  });
  it('NEVER overwrites a dirty draft on external update — flags it instead', () => {
    const s = resolveDraft(
      { body: 'my edit', title: 'T1', externalUpdate: null },
      row({ body: 'REVERTED', updatedAt: '2026-07-02T11:00:00Z', updatedBy: 'external' }),
      true,
    );
    expect(s.body).toBe('my edit');
    expect(s.externalUpdate).toEqual({ updatedAt: '2026-07-02T11:00:00Z', updatedBy: 'external' });
  });
  it('re-seeds silently when clean and row changes', () => {
    const s = resolveDraft({ body: 'B1', title: 'T1', externalUpdate: null }, row({ body: 'B2' }), false);
    expect(s.body).toBe('B2');
    expect(s.externalUpdate).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect FAIL (module not found)**

Run: `npx vitest run components/dashboard/promptDraftResolver.test.ts`

- [ ] **Step 3: Implement**

```ts
export interface DraftState {
  body: string;
  title: string;
  externalUpdate: null | { updatedAt: string; updatedBy: string | null };
}
export function resolveDraft(
  prev: DraftState,
  row: { id: string; body: string; title: string; updatedAt: string; updatedBy: string | null } | null,
  dirty: boolean,
): DraftState {
  if (!row) return { body: '', title: '', externalUpdate: null };
  if (dirty) return { ...prev, externalUpdate: { updatedAt: row.updatedAt, updatedBy: row.updatedBy } };
  return { body: row.body, title: row.title, externalUpdate: null };
}
```

- [ ] **Step 4: Run — expect PASS, then commit**

```bash
npx vitest run components/dashboard/promptDraftResolver.test.ts
git add components/dashboard/promptDraftResolver.ts components/dashboard/promptDraftResolver.test.ts
git commit -m "feat: pure draft resolver - dirty drafts survive external prompt updates"
```

---

### Task 5: Panel wiring — provenance line, external-change banner, conflict handling, honest header

**Files:**
- Modify: `components/dashboard/PromptLibraryPanel.tsx` (:62-67 effect, :133-136 header, :204-211 list row, :236-249 meta row, save handler)

- [ ] **Step 1: Replace the reset effect with the resolver (keeps selection-change reset, adds guard)**

```tsx
const [externalUpdate, setExternalUpdate] = React.useState<null | { updatedAt: string; updatedBy: string | null }>(null);

React.useEffect(() => {
  // Selection change: always seed fresh (dirty=false path via selectedId dep reset below).
  const next = resolveDraft({ body: draftBody, title: draftTitle, externalUpdate }, selected ?? null, dirty);
  setDraftBody(next.body);
  setDraftTitle(next.title);
  setExternalUpdate(next.externalUpdate);
  if (!next.externalUpdate) setDirty(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [selectedId, selected?.updatedAt]);
```

(On `selectedId` change, first set `dirty=false` in the row-click handler — the existing discard-confirm at :194 already gates that path.)

- [ ] **Step 2: Banner JSX (render directly under the meta row when `externalUpdate` is set)**

```tsx
{externalUpdate && (
  <div className="text-[12px] rounded-md border border-[var(--d-rule-strong)] bg-[var(--d-warn-bg)] text-[var(--d-warn)] px-3 py-2 flex items-center gap-3">
    <span>
      Changed outside this editor ({externalUpdate.updatedBy ?? 'unknown'}, {new Date(externalUpdate.updatedAt).toLocaleTimeString()}).
      Your unsaved draft is preserved.
    </span>
    <button className="underline font-semibold" onClick={() => { setDraftBody(selected!.body); setDraftTitle(selected!.title); setDirty(false); setExternalUpdate(null); }}>
      Take theirs
    </button>
    <button className="underline" onClick={() => setExternalUpdate(null)}>Keep mine</button>
  </div>
)}
```

- [ ] **Step 3: Provenance in the meta row (:236-249) — append after the version span**

```tsx
<span>·</span>
<span title={selected.updatedAt}>
  {relTime(selected.updatedAt)} by {selected.updatedBy ?? 'unknown'}
</span>
```

with a tiny helper at module scope:

```ts
function relTime(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}
```

Also add `<span className="text-[10px] text-zinc-600 tabular-nums shrink-0">{relTime(p.updatedAt)}</span>` to each list row (:208 area, before the size badge).

- [ ] **Step 4: Conflict handling in the save handler**

Where save is invoked, pass `selected.version` and on `{conflict:true}` set `externalUpdate` from a fresh row fetch instead of alerting; the banner explains the situation.

- [ ] **Step 5: Honest header (:134-135)**

Replace `live source-of-truth for every Claude system prompt in the content engine. Edits propagate instantly to n8n via realtime — no sync wait.` with:

```
canonical prompt store (content_prompts) read by live n8n runs. Version bumps on every write; rows show who wrote last.
```

- [ ] **Step 6: tsc + vitest + visual check + commit**

```bash
npx tsc --noEmit && npx vitest run
```
Playwright: screenshot `sub=prompts` at 1440, confirm provenance line renders on a selected prompt.

```bash
git add components/dashboard/PromptLibraryPanel.tsx
git commit -m "feat: prompt provenance, external-change banner, save-conflict surfacing, honest header"
```

---

### Task 6: category column + recently-updated sort

**Files:**
- Create: `supabase/migrations/20260702_content_prompts_category.sql`
- Modify: `hooks/useContentPrompts.ts` (SELECT + interface + mapRow)
- Modify: `components/dashboard/PromptLibraryPanel.tsx` (categorize fallback + sort toggle)

- [ ] **Step 1: Migration (additive) + backfill mirroring the categorize() if-chain (read it at PromptLibraryPanel.tsx:25-41 and translate each branch to a `update ... where slug like/in (...)` statement; anything unmatched stays NULL = "Other")**

```sql
alter table public.content_prompts add column if not exists category text;
-- Backfill: translate categorize() branches, e.g.:
-- update content_prompts set category = 'Carousel' where category is null and (slug like 'carousel-%' or slug like 'layout-%');
-- ...one statement per branch, in the same precedence order as the code...
```

- [ ] **Step 2: Hook: add `category` to SELECT, interface, and mapRow (`category: row.category || null`)**

- [ ] **Step 3: Panel: `const cat = p.category ?? categorize(p.slug)` everywhere categorize() is called; add sort toggle**

```tsx
const [sortBy, setSortBy] = useState<'slug' | 'updated'>('slug');
// in the grouped/filtered memo: sortBy === 'updated'
//   ? [...list].sort((a,b) => b.updatedAt.localeCompare(a.updatedAt))
//   : list  (existing slug order)
```
Toggle button next to Refresh: label "Recent" / "A-Z".

- [ ] **Step 4: Verify (recently-updated sort shows this morning's reverted post-gen prompt on top) + commit**

```bash
git add supabase/migrations/20260702_content_prompts_category.sql hooks/useContentPrompts.ts components/dashboard/PromptLibraryPanel.tsx
git commit -m "feat: content_prompts.category column + recently-updated sort"
```

---

### Task 7: Archive PromptsPanel (the ClickUp-writing footgun)

**Files:**
- Modify: `components/dashboard-v2/sections/Knowledge.tsx`
- Modify: `components/dashboard/Dashboard.tsx:69,101,136`
- Move: `components/dashboard/PromptsPanel.tsx` → `components/dashboard/_archive/PromptsPanel.tsx`

- [ ] **Step 1: Knowledge.tsx — Prompts sub-tab now renders the real editor**

Replace `const PromptsPanel = lazy(() => import('../../dashboard/PromptsPanel'));` with `const PromptLibraryPanel = lazy(() => import('../../dashboard/PromptLibraryPanel'));` and `:53` `<PromptsPanel />` with `<PromptLibraryPanel />`. Update the header comment (lines 8-10) to say prompts are edited in content_prompts directly.

- [ ] **Step 2: Dashboard.tsx (legacy v1) — repoint the same way at :69,101,136** (keep the `prompts` route key working; it should render PromptLibraryPanel).

- [ ] **Step 3: Archive the file**

```bash
mkdir -p components/dashboard/_archive
git mv components/dashboard/PromptsPanel.tsx components/dashboard/_archive/PromptsPanel.tsx
```

- [ ] **Step 4: Grep for stragglers, build, commit**

```bash
grep -rn "dashboard/PromptsPanel\|from './PromptsPanel'" components/ --include="*.tsx" | grep -v _archive
npx tsc --noEmit && npm run build 2>&1 | tail -3
git add -A && git commit -m "chore: archive ClickUp-writing PromptsPanel; Knowledge tab uses content_prompts editor"
```
Expected: grep returns nothing outside `_archive`; build clean.

---

### Task 8: Ship gate

- [ ] **Step 1: Full test run** — `npx vitest run` (all green) + `npx tsc --noEmit`.
- [ ] **Step 2: Playwright** — `sub=prompts` (1440 + 375): provenance line visible, sort toggle works (drive script clicks it), Knowledge tab renders the content_prompts editor.
- [ ] **Step 3: Live data-loss drill** — with a scratch prompt row (`_trigger_probe2`), open it in the editor, type without saving, run an MCP `execute_sql` UPDATE on its body, confirm the banner appears and the typed draft survives. Delete the scratch row.
- [ ] **Step 4: Refspec push, ff main, deploy, live screenshot** (same commands as Phase 0 Task 7, branch `phase1-prompt-trust`).
