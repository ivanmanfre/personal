# Content Studio Phase 3 — Performance reorg + honesty Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorder the Performance tab to lead with what informs the next post (pillars → topics/hooks), make the data honest (real scrape time, "not scraped yet" exclusion, taxonomy labels, min-sample guard, deduped ticks, window-aware benchmark), move Site Audience out to Reach & Pipeline, and add "Run it back" seeding on top posts.

**Architecture:** React + Vite + Tailwind dashboard (`components/dashboard/PerformancePanel.tsx` + `AudiencePanel.tsx`), Supabase (`own_posts`, `lm_idea_candidates`), one n8n workflow ("Own Post Performance Tracker" `XMuGMZJlcF9pB3Db`), one new Supabase Edge Function (`seed-idea-from-post`). Backend enablers land first (taxonomy/helpers/window/scrape-column/edge-fn) so the frontend reorg consumes finished interfaces.

**Tech Stack:** React, Recharts, Supabase JS, Deno edge functions, n8n (n8nac CLI), vitest.

**Approved mockup:** the layout in artifact `perf-phase3-mockup` is the contract — order `KPIs → audience strip → Pillars → Topics/Hooks → Trend → Top posts → (content-type share-bar · Benchmark last)`; content-type becomes a share-bar (not a donut). Ivan approved "build end-to-end now" for scrape-time and "build now in Phase 3" for Run it back.

## Global Constraints

- **Worktree + refspec push.** Work in `~/Desktop/personal-site-wt-phase3`. Never edit the main worktree. Deploy only via refspec push to `main` (GitHub Actions → Pages); expect a possible transient `deploy-pages@v4` "try again later" — re-trigger with an empty commit if so.
- **Census must stay green:** `node scripts/lightshim-census.mjs` exits 0 (currently 298/0). Any NEW dark tailwind class needs a shim in `components/dashboard-v2/theme/light.css` before shipping. Prefer existing `--d-*`/`--ds-*` tokens.
- **vitest green:** `npx vitest run` (currently 103/103). Every new pure helper gets a co-located `*.test.ts` (repo convention: sibling file, `import { describe, it, expect } from 'vitest'`).
- **Canonical pillar display copy is the EXISTING map — do not restyle it:** `translator→'Agency Diagnostic'`, `methodology→'Build-in-public'`, `teardown→'Anti-slop'`, `case_study→'Case study'`, `personal→'Owner-POV'`. Unknown non-null key → show the raw key + an "unmapped (key)" badge (never silently dropped).
- **Supabase project** `bjbvqvzbzczjbatgmccb`. Migrations applied to prod via Supabase MCP `apply_migration`; edge functions deployed via MCP `deploy_edge_function`. Use `if not exists` / idempotent SQL.
- **Honesty rule:** never fabricate a scrape time or a "scraped" state. A post with `metrics_updated_at IS NULL` is "not scraped yet" — badge it and EXCLUDE it from averages, don't coerce to 0.
- **Playwright self-verify before "done"** on any visual task (`~/.claude/skills/playwright-driver`), reading screenshots yourself. Dev server: `npm run dev` (vite; read the printed port); `.env` present in worktree.

---

### Task 1: Worktree

- [ ] **Step 1:**
```bash
cd ~/Desktop/personal-site && git fetch origin
git worktree add ../personal-site-wt-phase3 -b phase3-performance origin/main
cd ../personal-site-wt-phase3 && npm install 2>&1 | tail -2
cp ~/Desktop/personal-site/.env ./.env 2>/dev/null && echo ".env copied"
```

---

### Task 2: Canonical pillar taxonomy module

**Files:**
- Create: `lib/pillarTaxonomy.ts`
- Test: `lib/pillarTaxonomy.test.ts`
- Modify: `components/dashboard/PerformancePanel.tsx` (remove local `PILLAR_LABELS` at :35-41; consume the module)

**Interfaces:**
- Produces: `PILLAR_LABELS: Record<string,string>`, `normalizePillar(key: string | null | undefined): { key: string; label: string; unmapped: boolean }`. `unmapped` is true when a non-empty key isn't in the map. Null/empty key → `{ key: '', label: '', unmapped: false }` (caller already skips null pillars).

- [ ] **Step 1: Write the failing test** — `lib/pillarTaxonomy.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { normalizePillar, PILLAR_LABELS } from './pillarTaxonomy';

describe('normalizePillar', () => {
  it('maps a known key to its editorial label', () => {
    expect(normalizePillar('teardown')).toEqual({ key: 'teardown', label: 'Anti-slop', unmapped: false });
  });
  it('flags an unknown non-null key as unmapped, keeping the raw key as label', () => {
    expect(normalizePillar('field_notes')).toEqual({ key: 'field_notes', label: 'field_notes', unmapped: true });
  });
  it('treats null/empty as a non-unmapped empty (caller skips these)', () => {
    expect(normalizePillar(null)).toEqual({ key: '', label: '', unmapped: false });
    expect(normalizePillar('')).toEqual({ key: '', label: '', unmapped: false });
  });
  it('exposes the 5 canonical labels verbatim', () => {
    expect(PILLAR_LABELS).toMatchObject({
      translator: 'Agency Diagnostic', methodology: 'Build-in-public',
      teardown: 'Anti-slop', case_study: 'Case study', personal: 'Owner-POV',
    });
  });
});
```

- [ ] **Step 2: Run it, verify it fails** — `npx vitest run lib/pillarTaxonomy.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement** — `lib/pillarTaxonomy.ts`
```ts
// Canonical pillar key→label map for own_posts.pillar. Editorial display copy
// (unchanged from PerformancePanel's original local map). Unknown non-null keys
// are surfaced with an "unmapped" flag so the UI can badge them instead of
// silently dropping or showing a raw snake_case slug.
export const PILLAR_LABELS: Record<string, string> = {
  translator: 'Agency Diagnostic',
  methodology: 'Build-in-public',
  teardown: 'Anti-slop',
  case_study: 'Case study',
  personal: 'Owner-POV',
};

export function normalizePillar(key: string | null | undefined): { key: string; label: string; unmapped: boolean } {
  if (!key) return { key: '', label: '', unmapped: false };
  const known = PILLAR_LABELS[key];
  return { key, label: known ?? key, unmapped: known === undefined };
}
```

- [ ] **Step 4: Repoint PerformancePanel** — delete the local `PILLAR_LABELS` const (:35-41), add `import { normalizePillar } from '../../lib/pillarTaxonomy';`. In the `pillarData` memo (:124-141), where each row is built, replace `label: PILLAR_LABELS[name] || name` with a `normalizePillar(name)` call and carry the flag: each row becomes `{ name, label, unmapped, count, avgImpressions, engRate }`. Keep the existing `if (!p.pillar) return;` skip.

- [ ] **Step 5: Run tests + census** — `npx vitest run lib/pillarTaxonomy.test.ts` PASS; `node scripts/lightshim-census.mjs` exit 0.

- [ ] **Step 6: Commit** — `git commit -am "feat(perf): canonical pillar taxonomy module + unmapped flag"`

---

### Task 3: Ranking helpers — min-sample guard + deduped ticks

**Files:**
- Create: `lib/perfRankings.ts`
- Test: `lib/perfRankings.test.ts`

**Interfaces:**
- Produces:
  - `minSampleRanking<T extends { count: number }>(rows: T[], minN?: number): { ranked: T[]; pending: T[] }` — `minN` default 3. `ranked` = rows with `count >= minN` (order preserved), `pending` = the rest.
  - `dedupeTicks(dates: string[]): string[]` — returns the subset of `dates` (preserving order + first occurrence) with duplicates removed, for use as an explicit Recharts `<XAxis ticks={...}>` set so repeated date labels ("Jun 8, Jun 8") don't render twice.

- [ ] **Step 1: Write the failing test** — `lib/perfRankings.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { minSampleRanking, dedupeTicks } from './perfRankings';

describe('minSampleRanking', () => {
  it('splits rows at the min-sample threshold (default 3)', () => {
    const rows = [{ name: 'a', count: 6 }, { name: 'b', count: 3 }, { name: 'c', count: 2 }, { name: 'd', count: 1 }];
    const { ranked, pending } = minSampleRanking(rows);
    expect(ranked.map(r => r.name)).toEqual(['a', 'b']);
    expect(pending.map(r => r.name)).toEqual(['c', 'd']);
  });
  it('respects a custom minN and preserves input order', () => {
    const rows = [{ name: 'x', count: 5 }, { name: 'y', count: 4 }];
    expect(minSampleRanking(rows, 5).ranked.map(r => r.name)).toEqual(['x']);
  });
  it('handles empty input', () => {
    expect(minSampleRanking([])).toEqual({ ranked: [], pending: [] });
  });
});

describe('dedupeTicks', () => {
  it('keeps first occurrence, drops repeats, preserves order', () => {
    expect(dedupeTicks(['Jun 4', 'Jun 8', 'Jun 8', 'Jun 10', 'Jun 8'])).toEqual(['Jun 4', 'Jun 8', 'Jun 10']);
  });
  it('is a no-op on already-unique input', () => {
    expect(dedupeTicks(['Jun 4', 'Jun 11', 'Jun 18'])).toEqual(['Jun 4', 'Jun 11', 'Jun 18']);
  });
});
```

- [ ] **Step 2: Run it, verify it fails** — `npx vitest run lib/perfRankings.test.ts` → FAIL.

- [ ] **Step 3: Implement** — `lib/perfRankings.ts`
```ts
// Pure ranking guards for the Performance panel.
export function minSampleRanking<T extends { count: number }>(rows: T[], minN = 3): { ranked: T[]; pending: T[] } {
  const ranked: T[] = [], pending: T[] = [];
  for (const r of rows) (r.count >= minN ? ranked : pending).push(r);
  return { ranked, pending };
}

// De-duplicate x-axis date labels while preserving first-seen order, so a
// post-indexed chart with two posts on the same day doesn't print the tick twice.
export function dedupeTicks(dates: string[]): string[] {
  const seen = new Set<string>(), out: string[] = [];
  for (const d of dates) { if (!seen.has(d)) { seen.add(d); out.push(d); } }
  return out;
}
```

- [ ] **Step 4: Run tests** — `npx vitest run lib/perfRankings.test.ts` PASS.

- [ ] **Step 5: Commit** — `git commit -am "feat(perf): min-sample + tick-dedupe ranking helpers"`

---

### Task 4: Competitor window fix

**Files:**
- Modify: `hooks/useCompetitors.ts` (add optional `days` param + date filter on `competitor_posts.post_date`)
- Create: `lib/withinWindow.ts` + `lib/withinWindow.test.ts` (pure date-window predicate, so the filter is unit-tested)
- Modify: `components/dashboard/PerformancePanel.tsx` (pass `days`; benchmark zero-state copy)

**Interfaces:**
- Produces: `withinWindow(dateISO: string | null | undefined, days: number, nowMs: number): boolean` — true when `dateISO` is within the last `days` days of `nowMs`. `days <= 0` (or the "90d/all" case the caller chooses) → treat as no-filter by passing a large `days`. Null/invalid date → false.
- `useCompetitors(days?: number)` — when `days` is provided, competitor rows are filtered to `post_date >= now - days`. Signature stays backward compatible (no-arg = current behavior).

- [ ] **Step 1: Write the failing test** — `lib/withinWindow.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { withinWindow } from './withinWindow';
const NOW = Date.parse('2026-07-03T00:00:00Z');
describe('withinWindow', () => {
  it('accepts a date inside the window', () => {
    expect(withinWindow('2026-06-28T00:00:00Z', 7, NOW)).toBe(true);
  });
  it('rejects a date older than the window', () => {
    expect(withinWindow('2026-06-01T00:00:00Z', 7, NOW)).toBe(false);
  });
  it('rejects null/invalid dates', () => {
    expect(withinWindow(null, 30, NOW)).toBe(false);
    expect(withinWindow('not-a-date', 30, NOW)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it, verify it fails** — `npx vitest run lib/withinWindow.test.ts` → FAIL.

- [ ] **Step 3: Implement** — `lib/withinWindow.ts`
```ts
export function withinWindow(dateISO: string | null | undefined, days: number, nowMs: number): boolean {
  if (!dateISO) return false;
  const t = Date.parse(dateISO);
  if (Number.isNaN(t)) return false;
  return t >= nowMs - days * 86_400_000;
}
```

- [ ] **Step 4: Wire the hook** — in `hooks/useCompetitors.ts`, accept `useCompetitors(days?: number)`. After the `competitor_posts` rows load (the ~200-most-recent query stays), if `days != null` filter the in-memory posts with `withinWindow(row.post_date, days, Date.now())` BEFORE `competitorStats` is computed, so `avgLikes`/`recentPostCount` reflect the window. Recompute `competitorStats` from the filtered set. (Keep the DB query unchanged — filter client-side to avoid a query-shape change; the 200-cap already bounds it.)

- [ ] **Step 5: Consume in PerformancePanel** — pass the numeric window: map `range` → days (`7d→7, 30d→30, 90d→90`) and call `useCompetitors(days)` with the SAME `days` already derived for `useOwnPosts(days)`. In the benchmark card (:254-282), when `benchmarkData.length <= 1` show window-aware copy: `No competitor posts in this {range} window` (fall back to `No competitor data` only when competitor_patterns is entirely empty — distinguish the two: empty-patterns vs empty-after-window-filter).

- [ ] **Step 6: Run tests + census** — `npx vitest run lib/withinWindow.test.ts` PASS; census exit 0.

- [ ] **Step 7: Commit** — `git commit -am "feat(perf): window-aware competitor benchmark + zero-state"`

---

### Task 5: Scrape-time — DB column + hook exposure

**Files:**
- Migration (applied to prod via Supabase MCP): add `own_posts.metrics_updated_at`
- Modify: `hooks/useOwnPosts.ts` (select + map the column; expose `metricsUpdatedAt` per post + `lastScrapedAt` in stats)
- Modify: `types/dashboard.ts` (add `metricsUpdatedAt: string | null` to `OwnPost`)

**Interfaces:**
- Produces: `OwnPost.metricsUpdatedAt: string | null` (ISO or null when never scraped). `useOwnPosts` stats gains `lastScrapedAt: string | null` = max non-null `metricsUpdatedAt`, and `scrapedCount` / `unscrapedCount`. Averages (`avgImpressions`, `engagementRate`) must be computed over SCRAPED posts only (metricsUpdatedAt != null) — never over unscraped rows.

- [ ] **Step 1: Apply the migration to prod** (Supabase MCP `apply_migration`, name `own_posts_metrics_updated_at`):
```sql
alter table public.own_posts add column if not exists metrics_updated_at timestamptz;
comment on column public.own_posts.metrics_updated_at is
  'Set by the Own Post Performance Tracker n8n workflow each time LinkedIn metrics are (re)written for this post. NULL = never scraped yet.';
```
Verify: `select count(*) filter (where metrics_updated_at is null) as unscraped, count(*) total from public.own_posts;` — expect all rows currently NULL (backfill happens on the next scraper run, Task 6).

- [ ] **Step 2: Type + hook** — add `metricsUpdatedAt: string | null` to `OwnPost` in `types/dashboard.ts`. In `hooks/useOwnPosts.ts`: add `metrics_updated_at` to the `.select(...)` (:35); in `mapPost` (:6-21) set `metricsUpdatedAt: row.metrics_updated_at ?? null`. In the `stats` memo add `lastScrapedAt` (max of non-null `metricsUpdatedAt`), `scrapedCount`, `unscrapedCount`, and **change `avgImpressions`/`engagementRate` to divide only over scraped posts** (`posts.filter(p => p.metricsUpdatedAt)`) so never-scraped rows don't drag the average to zero. Guard divide-by-zero (0 scraped → 0).

- [ ] **Step 3: Verify build** — `npx tsc --noEmit` shows no NEW errors in `useOwnPosts.ts`/`types/dashboard.ts` (baseline pre-existing errors elsewhere are fine); `npx vitest run` still green.

- [ ] **Step 4: Commit** — `git commit -am "feat(perf): own_posts.metrics_updated_at column + scraped-only averages"`

---

### Task 6: n8n scraper stamps metrics_updated_at

**Files:**
- n8n workflow "Own Post Performance Tracker" (`XMuGMZJlcF9pB3Db`) — edit via `n8nac` CLI (per project AGENTS.md; NOT n8n-mcp).

- [ ] **Step 1: Pull + inspect** — `n8nac pull XMuGMZJlcF9pB3Db`. Find the node that writes `own_posts` (a Supabase/Postgres "upsert" or an HTTP call to the REST API). Identify the column/value mapping object.
- [ ] **Step 2: Add the stamp** — in that upsert's field mapping, add `metrics_updated_at` set to the run time: for a Supabase/Postgres node use an expression `={{ $now.toISO() }}`; for a raw REST upsert add `"metrics_updated_at": "={{ $now.toISO() }}"` to the JSON body. It must be written on EVERY metrics (re)write so a re-scrape refreshes it. Push with `n8nac push`.
- [ ] **Step 3: Verify a real run stamps it** — trigger/await the next scheduled run (`python3 ~/.claude/skills/n8n-execs/n8n_execs.py wf XMuGMZJlcF9pB3Db --limit 3`), then confirm in Supabase: `select count(*) filter (where metrics_updated_at is not null) as stamped from public.own_posts;` climbs above 0. Do NOT proceed to the header UI claim until at least the most-recent posts are stamped. (If the scheduled run is far off, the workflow may be manually executed once to backfill.)
- [ ] **Step 4: Record** — note in the report the node name/id edited and the stamped count; no repo commit (n8n change is external — logged in ledger).

---

### Task 7: "Run it back" — seed-idea edge function

**Files:**
- Create: `supabase/functions/seed-idea-from-post/index.ts` (deploy via Supabase MCP `deploy_edge_function`)
- Create: `lib/runItBack.ts` + `lib/runItBack.test.ts` (pure `composeAngleBrief` + the client fetch wrapper)

**Interfaces:**
- Produces (server): `POST /functions/v1/seed-idea-from-post { title, topic, pillar, hook, angleBrief }` → inserts one `lm_idea_candidates` row with `content_type='post'`, `status='reviewing'`, `raw_topic=title`, `post_angle=angleBrief`, `source='run_it_back'`, `ingested_at=now()`; returns `{ ok: true, id }`. Uses the service-role key (client can't insert directly).
- Produces (client): `composeAngleBrief({ pillar, hook, title }): string` (pure, tested) and `seedIdeaFromPost(payload): Promise<{ ok: boolean; id?: string }>`.

- [ ] **Step 1: Write the failing test** — `lib/runItBack.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { composeAngleBrief } from './runItBack';
describe('composeAngleBrief', () => {
  it('packs pillar + hook + source title into a re-run brief', () => {
    const b = composeAngleBrief({ pillar: 'Anti-slop', hook: 'Contrarian claim', title: 'The 3-step lead enrichment pipeline' });
    expect(b).toContain('Anti-slop');
    expect(b).toContain('Contrarian claim');
    expect(b).toContain('The 3-step lead enrichment pipeline');
    expect(b.toLowerCase()).toContain('run it back');
  });
  it('degrades gracefully when pillar/hook are unknown', () => {
    const b = composeAngleBrief({ pillar: '', hook: '', title: 'Some post' });
    expect(b).toContain('Some post');
  });
});
```

- [ ] **Step 2: Run it, verify it fails** — `npx vitest run lib/runItBack.test.ts` → FAIL.

- [ ] **Step 3: Implement client** — `lib/runItBack.ts`
```ts
const SUPA = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://bjbvqvzbzczjbatgmccb.supabase.co';
const ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';
const SEED_URL = `${SUPA}/functions/v1/seed-idea-from-post`;

export function composeAngleBrief(p: { pillar: string; hook: string; title: string }): string {
  const bits = [
    `Run it back on a top performer: "${p.title}".`,
    p.pillar ? `Pillar: ${p.pillar}.` : '',
    p.hook ? `Hook that worked: ${p.hook}.` : '',
    'Write a fresh angle on the same territory — do not rewrite the original.',
  ].filter(Boolean);
  return bits.join(' ');
}

export async function seedIdeaFromPost(payload: { title: string; topic: string; pillar: string; hook: string }): Promise<{ ok: boolean; id?: string }> {
  const angleBrief = composeAngleBrief(payload);
  const res = await fetch(SEED_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + ANON_KEY },
    body: JSON.stringify({ ...payload, angleBrief }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'seed ' + res.status); }
  return res.json();
}
```

- [ ] **Step 4: Implement + deploy the edge function** — `supabase/functions/seed-idea-from-post/index.ts` (model on `supabase/functions/scorecard-submit/index.ts`: same CORS block, `json()` helper, service-role `createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)`). Handle `OPTIONS`. Validate `title` non-empty. Insert:
```ts
const { data, error } = await supa.from('lm_idea_candidates').insert({
  source: 'run_it_back',
  content_type: 'post',
  status: 'reviewing',
  raw_topic: title,
  post_angle: angleBrief,
  evidence: { origin: 'run_it_back', source_title: title, topic, pillar, hook },
  ingested_at: new Date().toISOString(),
}).select('id').single();
```
Deploy via MCP `deploy_edge_function` (project `bjbvqvzbzczjbatgmccb`).
- [ ] **Step 5: Integration-verify the seeded idea SURFACES** — call the deployed function once with a test payload (curl with the anon key), then confirm the row appears on the Posts board Idea stage: `lm-curator-feed` must return it (it filters `content_type='post'` + pending status). Load `?section=content&sub=posts` and confirm a new Idea-stage card appears (Playwright or a direct `lm-curator-feed` fetch). **If it does NOT surface**, the feed's pending-WHERE needs different fields — inspect what real curator rows carry (`select * from lm_idea_candidates where content_type='post' and status='reviewing' limit 1`) and match the missing NOT-NULL/score fields, then redeploy. Delete the test row when done (`delete from lm_idea_candidates where source='run_it_back' and raw_topic like 'TEST %'`).
- [ ] **Step 6: Run tests** — `npx vitest run lib/runItBack.test.ts` PASS.
- [ ] **Step 7: Commit** — `git commit -am "feat(perf): seed-idea-from-post edge fn + run-it-back client"` (the edge fn source + lib; note the deploy in the report).

---

### Task 8: PerformancePanel reorg + honesty render

**Files:**
- Modify: `components/dashboard/PerformancePanel.tsx` (the whole render body :170-382)

This is the mockup made real. Read the current file first. Keep all existing hooks/memos; ADD the new consumption. Do not change data semantics beyond what Tasks 2-7 established.

- [ ] **Step 1: New card order** — reorder the JSX blocks inside the `posts.length === 0 ? … : <>…</>` to exactly:
  1. **KPI row** (:190-194, unchanged StatCards).
  2. **Audience strip** (NEW — see Task 9 note; a slim `panel-surface` row: LinkedIn followers + 30d delta from `useFollowerHistory`, and a coverage chip `"{scrapedCount} of {count} posts scraped · {unscrapedCount} not scraped yet"`).
  3. **Metric selector** (:197-204) then **Which pillars land** (:286-306) — move pillars up here.
  4. **Topics · Hooks** two-column (:309-353).
  5. **Trend** area chart (:210-227) — moved down.
  6. **Top posts** (:356-380) — add Run-it-back button (Step 5).
  7. **Content-type share-bar** + **Benchmark** two-column, LAST (Step 4 + Task 4 zero-state).
- [ ] **Step 2: Real scrape-time header** — replace the `RefreshIndicator`'s "Updated Xs ago" prominence: render `Scraped from LinkedIn · {relative(stats.lastScrapedAt)}` (a real per-data timestamp) next to the range toggle, using a relative-time formatter (reuse the one in `RefreshIndicator`/`shared/utils`). If `lastScrapedAt` is null, show `Not scraped yet`. Keep the manual refresh control but it no longer implies data freshness.
- [ ] **Step 3: Not-scraped badge + pillar unmapped + min-sample** — (a) pillars: for rows with `unmapped` render the `unmapped (key)` badge (amber token chip) beside the label. (b) Topics/Hooks: run `minSampleRanking(rows, 3)` (Task 3); render `ranked` as bars, and if `pending.length` show a dashed guard row: `{pending.length} {topic|hook}(s) pending — <3 posts each, held out until the sample is honest.` (c) Averages already exclude unscraped (Task 5).
- [ ] **Step 4: Content-type share-bar** — replace the pie (:231-252) with a horizontal share-bar list (one row per `typeData` entry: label · `{count} posts · ~{avgImpressions} imp` · a token-colored `--ds-*` fill bar sized by share). No Recharts pie.
- [ ] **Step 5: Trend deduped ticks + Run it back** — (a) pass `ticks={dedupeTicks(chartData.map(d => d.date))}` to the trend `<XAxis>`. (b) Top posts: each row gets a right-aligned `↻ Run it back` button (token indigo pill, ≥32px tap target) calling `seedIdeaFromPost({ title: post.text-derived-title, topic: post.topicCategory ?? '', pillar: normalizePillar(post.pillar).label, hook: post.hookPattern ?? '' })`; on success show a toast/inline confirm ("Seeded a new idea → Posts") and on error a non-blocking error message.
- [ ] **Step 6: Verify (Playwright, read screenshots)** — `?section=content&sub=performance` at 1440 + 375: card order matches the mockup; scrape-time header renders; unmapped badge + min-sample guard appear when data warrants; share-bar renders; benchmark last with window zero-state on 7d; Run-it-back button present + a drive click seeds an idea (then remove the test idea). Census exit 0; `npx vitest run` green.
- [ ] **Step 7: Commit** — `git commit -am "feat(perf): reorg cards + honest data render + run-it-back"`

---

### Task 9: Site Audience → Reach & Pipeline (IA move)

**Files:**
- Modify: `components/dashboard-v2/sections/ContentStudio.tsx` (:113-122 Performance case; :61 LEGACY_SUB_REMAP)
- Modify: `components/dashboard-v2/sections/ReachPipeline.tsx` (add `audience` flat SubTab)
- Modify: `components/dashboard/AudiencePanel.tsx` (remove legacy `<h1>` :92, keep follower block for its own tab; the follower STRIP in PerformancePanel is separate, via `useFollowerHistory`)

- [ ] **Step 1: Unnest Performance** — in `ContentStudio.tsx` the `'performance'` case currently renders an `InternalTabs` with `Post Performance` + `Site Audience`. Replace it to render `<PerformancePanel />` directly (no internal tabs). Remove the `AudiencePanel` import from ContentStudio.
- [ ] **Step 2: Add Site Audience to Reach & Pipeline** — in `ReachPipeline.tsx` follow the existing flat-tab pattern: add `'audience'` to `SubKey`, `const AudiencePanel = lazy(() => import('../../dashboard/AudiencePanel'));`, add to `SUB_LABELS` (`audience: 'Site Audience'`) + `SUB_ORDER`, and a `case 'audience': return <AudiencePanel />;` in `renderSub()`.
- [ ] **Step 3: Legacy deeplinks** — `ContentStudio.tsx` `LEGACY_SUB_REMAP.audience = 'performance'` (:61): keep it (old `?section=content&sub=audience` links still resolve to Performance rather than 404). Add a code comment that Site Audience now lives under Reach & Pipeline.
- [ ] **Step 4: Remove the legacy h1** — in `AudiencePanel.tsx` delete the stray `<h1>Audience</h1>` (:92) and its now-redundant subtitle if it duplicates the SubTab label; the panel keeps its follower/pageview content (it's now a first-class Reach & Pipeline tab labeled by the SubTab strip).
- [ ] **Step 5: Verify (Playwright)** — `?section=content&sub=performance` shows PerformancePanel with NO internal "Site Audience" tab; `?section=reach&sub=audience` (or the actual Reach&Pipeline section key) shows AudiencePanel with no stray h1; old `?section=content&sub=audience` still lands on Performance. Census exit 0; build clean.
- [ ] **Step 6: Commit** — `git commit -am "feat(perf): move Site Audience to Reach & Pipeline, drop legacy h1"`

---

### Task 10: Ship gate

- [ ] **Step 1: Gates** — `npx tsc --noEmit` (no NEW errors in touched files vs baseline), `npm run build 2>&1 | tail -5` clean, `node scripts/lightshim-census.mjs` exit 0, `npx vitest run` green.
- [ ] **Step 2: Consolidated Playwright** — 1440 + 375 on `?section=content&sub=performance` (full new order, scrape header, share-bar, benchmark-last), plus the Reach & Pipeline audience tab, plus one Run-it-back drive (seed → confirm Idea card on Posts board → delete test idea). Read all screenshots. 0 console errors, 0 horizontal overflow.
- [ ] **Step 3: Ship** — refspec push `git push origin phase3-performance:main`; poll the Actions run (public API) to `success`; if `deploy-pages@v4` transient-fails, re-trigger with an empty commit; confirm production serves the new bundle; live DOM spot-check the Performance tab. FF the main worktree, remove the phase3 worktree, delete the merged branch.

## Self-review notes (author)

- **Backend-before-frontend ordering** is deliberate: Tasks 2-7 finish the interfaces (taxonomy, helpers, window hook, scrape column, edge fn) that Tasks 8-9 consume. Task 8's scrape-time header depends on Task 5 (column) + Task 6 (stamp) actually landing data — if Task 6's scheduled run hasn't fired, the header will honestly read "Not scraped yet" until it does; that's acceptable (honest), not a blocker.
- **Run-it-back integration risk** is contained in Task 7 Step 5 (verify the seeded row surfaces; adjust fields if the feed needs more). Do not mark Task 7 complete until a seeded idea is seen on the board.
- **No Ideas-first conflict** — Performance has no status board; the reorder ethos (lead with actionable) matches [[feedback-posts-ideas-first]] in spirit.
- **Prod touchpoints** (migration, n8n, edge fn) are each verified in-task before the frontend depends on them.
