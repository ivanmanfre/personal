# AIOS System Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new top-level "System" section to the dashboard that gives a visual, always-current overview of Ivan's whole AIOS (skills, commands, n8n workflows, memory, integrations, panels) as a summary index that deep-links into existing detail panels.

**Architecture:** A Supabase table `aios_capabilities` holds the capability roster, populated by a local Node sync script (scans `~/.claude` + repo + a declared integrations manifest, computes adoption from session logs) that also runs via a debounced Stop-hook. The frontend `SystemOverview` section reads the roster through an RPC and reuses existing live hooks (`useWorkflowStats`, `useBrainStats`, `useClaudeUsage`) for dynamic counts. Only the orphaned `SystemMapPanel` is deleted.

**Tech Stack:** React + TypeScript + Vite, `@supabase/supabase-js`, Node 20 (built-in `node --test`), existing dashboard-v2 primitives (`HeadRow`, `SubTabs`, `KpiTile`, `StatusChip`, `Card`, `Row`, `ErrBanner`).

**Spec:** `docs/superpowers/specs/2026-06-07-aios-system-overview-design.md`

---

## Pre-flight: Isolated Worktree (REQUIRED)

`personal-site` has live automation committing to `main` and switching branches (`personal-site-concurrent-git-hazard.md`). **Before any task**, create an isolated worktree via `superpowers:using-git-worktrees` and do all work there; push the feature branch with an explicit refspec. Never edit the shared working tree.

Branch name: `feat/aios-system-overview`.

---

## File Structure

**Create:**
- `migrations/aios_capabilities.sql` — table + RLS + indexes + RPC
- `scripts/sync-aios-capabilities.mjs` — local scan → Supabase upsert
- `scripts/lib/capability-scan.mjs` — pure scan/parse helpers (testable)
- `scripts/lib/capability-scan.test.mjs` — `node --test` unit tests
- `scripts/aios-manifest.json` — declared integrations + edge functions
- `hooks/useAiosOverview.ts` — roster RPC + live-count fan-out
- `components/dashboard/CapabilityHero.tsx` — stat band + cluster map
- `components/dashboard/CapabilityRoster.tsx` — grouped collapsible roster
- `components/dashboard-v2/sections/SystemOverview.tsx` — the section
- `~/.claude/hooks/sync-aios-capabilities.sh` — debounced Stop-hook wrapper

**Modify:**
- `components/dashboard-v2/types.ts` — add `'system'` to `SectionId`
- `components/dashboard-v2/DemoShell.tsx` — nav item + section renderer
- `~/.claude/settings.json` — register the Stop-hook

**Delete:**
- `components/dashboard/SystemMapPanel.tsx` (orphan)
- `components/dashboard/system-map/` (only if no other importer — verify in Task 13)

---

## Phase A — Data + Sync

### Task 1: `aios_capabilities` table + RLS + indexes

**Files:**
- Create: `migrations/aios_capabilities.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- aios_capabilities: roster of every AIOS capability for the System overview.
create table if not exists public.aios_capabilities (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('skill','command','panel','integration','edge_fn')),
  slug         text not null,
  name         text not null,
  description  text,
  "group"      text,
  source_path  text,
  last_used_at timestamptz,
  invoke_count integer not null default 0,
  status       text not null default 'live' check (status in ('live','draft','deprecated')),
  metadata     jsonb not null default '{}'::jsonb,
  synced_at    timestamptz not null default now(),
  unique (kind, slug)
);

create index if not exists aios_capabilities_kind_idx  on public.aios_capabilities (kind);
create index if not exists aios_capabilities_group_idx on public.aios_capabilities ("group");

alter table public.aios_capabilities enable row level security;

-- Read access for the dashboard (anon), matching sibling read-only tables.
drop policy if exists aios_capabilities_read on public.aios_capabilities;
create policy aios_capabilities_read on public.aios_capabilities
  for select using (true);
-- Writes happen only via the service-role key in the sync script (bypasses RLS).
```

- [ ] **Step 2: Apply the migration**

Apply via the Supabase MCP tool `apply_migration` (project `bjbvqvzbzczjbatgmccb`, name `aios_capabilities`) with the SQL above, OR run it in the Supabase SQL editor.

- [ ] **Step 3: Verify the table exists**

Run (Supabase MCP `execute_sql`):
```sql
select column_name, data_type from information_schema.columns
where table_name = 'aios_capabilities' order by ordinal_position;
```
Expected: 12 rows matching the columns above.

- [ ] **Step 4: Commit**

```bash
git add migrations/aios_capabilities.sql
git commit -m "feat(db): aios_capabilities table for System overview"
```

---

### Task 2: `aios_capabilities_overview()` RPC

**Files:**
- Modify: `migrations/aios_capabilities.sql` (append)

- [ ] **Step 1: Append the RPC to the migration file**

```sql
-- Returns the full roster ordered for display, plus per-kind counts.
create or replace function public.aios_capabilities_overview()
returns table (
  kind text, slug text, name text, description text, "group" text,
  source_path text, last_used_at timestamptz, invoke_count integer,
  status text, metadata jsonb
)
language sql stable
as $$
  select kind, slug, name, description, "group", source_path,
         last_used_at, invoke_count, status, metadata
  from public.aios_capabilities
  where status <> 'deprecated'
  order by kind, "group" nulls last, name;
$$;

grant execute on function public.aios_capabilities_overview() to anon, authenticated;
```

- [ ] **Step 2: Apply the RPC**

Apply via Supabase MCP `apply_migration` (name `aios_capabilities_rpc`) or SQL editor.

- [ ] **Step 3: Verify the RPC returns (empty) without error**

Run (Supabase MCP `execute_sql`):
```sql
select * from public.aios_capabilities_overview();
```
Expected: 0 rows, no error.

- [ ] **Step 4: Commit**

```bash
git add migrations/aios_capabilities.sql
git commit -m "feat(db): aios_capabilities_overview RPC"
```

---

### Task 3: Scan helpers + frontmatter parser (TDD)

**Files:**
- Create: `scripts/lib/capability-scan.mjs`
- Test: `scripts/lib/capability-scan.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// scripts/lib/capability-scan.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontmatter, slugify } from './capability-scan.mjs';

test('parseFrontmatter reads quoted description', () => {
  const md = '---\nname: grill-me\ndescription: "Knowledge extraction interviewer"\n---\nbody';
  assert.deepEqual(parseFrontmatter(md), { name: 'grill-me', description: 'Knowledge extraction interviewer' });
});

test('parseFrontmatter reads unquoted description', () => {
  const md = '---\nname: recall\ndescription: Search memory tiers\n---\nx';
  assert.equal(parseFrontmatter(md).description, 'Search memory tiers');
});

test('parseFrontmatter returns nulls when missing', () => {
  assert.deepEqual(parseFrontmatter('no frontmatter here'), { name: null, description: null });
});

test('slugify lowercases and hyphenates', () => {
  assert.equal(slugify('Lead Magnets!'), 'lead-magnets');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/lib/capability-scan.test.mjs`
Expected: FAIL — `Cannot find module './capability-scan.mjs'` / export not found.

- [ ] **Step 3: Write the minimal implementation**

```js
// scripts/lib/capability-scan.mjs
export function parseFrontmatter(md) {
  const fm = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return { name: null, description: null };
  const block = fm[1];
  const grab = (key) => {
    const m = block.match(new RegExp(`^${key}:\\s*["']?(.+?)["']?\\s*$`, 'm'));
    return m ? m[1].trim() : null;
  };
  return { name: grab('name'), description: grab('description') };
}

export function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test scripts/lib/capability-scan.test.mjs`
Expected: PASS — 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/capability-scan.mjs scripts/lib/capability-scan.test.mjs
git commit -m "feat(scan): frontmatter parser + slugify helpers with tests"
```

---

### Task 4: Directory scanners + adoption (TDD)

**Files:**
- Modify: `scripts/lib/capability-scan.mjs`
- Modify: `scripts/lib/capability-scan.test.mjs`

- [ ] **Step 1: Write the failing test (against a fixture dir)**

```js
// append to scripts/lib/capability-scan.test.mjs
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanSkillDir, deprecateMissing } from './capability-scan.mjs';

test('scanSkillDir returns one row per SKILL.md with parsed fields', () => {
  const root = mkdtempSync(join(tmpdir(), 'skills-'));
  mkdirSync(join(root, 'grill-me'));
  writeFileSync(join(root, 'grill-me', 'SKILL.md'),
    '---\nname: grill-me\ndescription: Knowledge extraction\n---\nbody');
  const rows = scanSkillDir(root, 'skill', 'business');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, 'skill');
  assert.equal(rows[0].slug, 'grill-me');
  assert.equal(rows[0].description, 'Knowledge extraction');
  assert.equal(rows[0].group, 'business');
});

test('deprecateMissing flags db slugs not in the fresh set', () => {
  const fresh = [{ kind: 'skill', slug: 'grill-me' }];
  const dbSlugs = [{ kind: 'skill', slug: 'grill-me' }, { kind: 'skill', slug: 'old-skill' }];
  assert.deepEqual(deprecateMissing(fresh, dbSlugs), [{ kind: 'skill', slug: 'old-skill' }]);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test scripts/lib/capability-scan.test.mjs`
Expected: FAIL — `scanSkillDir`/`deprecateMissing` not exported.

- [ ] **Step 3: Implement the scanners**

```js
// append to scripts/lib/capability-scan.mjs
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Scan a directory of <slug>/SKILL.md (skills) or <slug>/*.md (commands).
export function scanSkillDir(root, kind, group, file = 'SKILL.md') {
  if (!existsSync(root)) return [];
  const rows = [];
  for (const entry of readdirSync(root)) {
    const dir = join(root, entry);
    if (!statSync(dir).isDirectory()) continue;
    const md = join(dir, file);
    if (!existsSync(md)) continue;
    const { name, description } = parseFrontmatter(readFileSync(md, 'utf8'));
    rows.push({
      kind, slug: slugify(name || entry), name: name || entry,
      description, group, source_path: md, status: 'live',
    });
  }
  return rows;
}

// Given the fresh roster and what's in the DB, return rows to mark deprecated.
export function deprecateMissing(fresh, dbSlugs) {
  const live = new Set(fresh.map((r) => `${r.kind}:${r.slug}`));
  return dbSlugs.filter((r) => !live.has(`${r.kind}:${r.slug}`));
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test scripts/lib/capability-scan.test.mjs`
Expected: PASS — all tests passing.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/capability-scan.mjs scripts/lib/capability-scan.test.mjs
git commit -m "feat(scan): directory scanner + deprecate-missing logic with tests"
```

---

### Task 5: Integrations manifest + sync entrypoint

**Files:**
- Create: `scripts/aios-manifest.json`
- Create: `scripts/sync-aios-capabilities.mjs`

- [ ] **Step 1: Write the manifest** (seeded from existing memory: integrations.md / shared-tech)

```json
{
  "integration": [
    { "slug": "n8n",       "name": "n8n",       "description": "Workflow automation engine (ivanmanfredi.com)" },
    { "slug": "supabase",  "name": "Supabase",  "description": "Postgres + pgvector + edge functions" },
    { "slug": "clickup",   "name": "ClickUp",   "description": "Tasks + prompt pages (being retired)" },
    { "slug": "apify",     "name": "Apify",     "description": "Scraping actors for outreach/ICP" },
    { "slug": "slack",     "name": "Slack",     "description": "Curator + alert source" },
    { "slug": "evolution", "name": "Evolution", "description": "WhatsApp API (n8nClaw, alerts)" },
    { "slug": "railway",   "name": "Railway",   "description": "Video engine + Claude proxy host" },
    { "slug": "calendly",  "name": "Calendly",  "description": "Discovery-call scheduling" }
  ],
  "edge_fn": [
    { "slug": "claude-brain-query", "name": "claude-brain-query", "description": "Hybrid memory retrieval (BM25+vector)" },
    { "slug": "lm-cover-gemini",    "name": "lm-cover-gemini",    "description": "Lead-magnet cover renderer (Gemini)" }
  ]
}
```

- [ ] **Step 2: Write the sync entrypoint**

```js
// scripts/sync-aios-capabilities.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { scanSkillDir, deprecateMissing, slugify } from './lib/capability-scan.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bjbvqvzbzczjbatgmccb.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) { console.error('SUPABASE_SERVICE_ROLE_KEY not set'); process.exit(1); }
const db = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

const HOME = homedir();
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const rows = [];
const skipped = [];

function safe(label, fn) {
  try { const r = fn(); if (Array.isArray(r)) rows.push(...r); }
  catch (e) { skipped.push(`${label}: ${e.message}`); }
}

// 1. Business skills
safe('skills', () => scanSkillDir(join(HOME, '.claude/skills'), 'skill', 'business'));
// 2. Command suites (one dir each; .md command files live flat or nested)
safe('gsd', () => scanCmdSuite(join(HOME, '.claude/plugins'), 'gsd'));
// 3. Dashboard panels (repo)
safe('panels', () => scanPanels(join(REPO, 'components/dashboard')));
// 4. Integrations + edge functions (manifest)
safe('manifest', () => loadManifest(join(HERE, 'aios-manifest.json')));
// 5. Adoption from session logs
safe('adoption', () => applyAdoption(rows, join(HOME, '.claude/projects')));

function scanCmdSuite(pluginsRoot, group) {
  // GSD/stochastic/superpowers commands live under plugin dirs as *.md with frontmatter.
  if (!existsSync(pluginsRoot)) return [];
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.md') && /commands|skills/.test(dir)) {
        const md = readFileSync(p, 'utf8');
        const m = md.match(/^description:\s*["']?(.+?)["']?\s*$/m);
        const name = e.name.replace(/\.md$/, '');
        out.push({ kind: 'command', slug: slugify(name), name,
          description: m ? m[1].trim() : null, group, source_path: p, status: 'live' });
      }
    }
  };
  walk(pluginsRoot);
  return out;
}

function scanPanels(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('Panel.tsx'))
    .map((f) => {
      const name = f.replace(/\.tsx$/, '');
      return { kind: 'panel', slug: slugify(name), name,
        description: 'Dashboard panel', group: 'dashboard',
        source_path: join(dir, f), status: 'live' };
    });
}

function loadManifest(path) {
  const m = JSON.parse(readFileSync(path, 'utf8'));
  const out = [];
  for (const kind of ['integration', 'edge_fn']) {
    for (const r of m[kind] || []) {
      out.push({ kind, slug: r.slug, name: r.name, description: r.description,
        group: kind === 'edge_fn' ? 'supabase' : 'external', status: 'live' });
    }
  }
  return out;
}

function applyAdoption(allRows, projectsDir) {
  // Count "Skill" invocations per slug across session JSONL logs; cheap substring scan.
  if (!existsSync(projectsDir)) return [];
  const counts = {};
  const last = {};
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.jsonl')) {
        let text; try { text = readFileSync(p, 'utf8'); } catch { continue; }
        const mtime = new Date(statSync(p).mtime).toISOString();
        for (const r of allRows) {
          if (r.kind !== 'skill' && r.kind !== 'command') continue;
          if (text.includes(`"${r.slug}"`)) {
            counts[r.slug] = (counts[r.slug] || 0) + 1;
            if (mtime && (!last[r.slug] || mtime > last[r.slug])) last[r.slug] = mtime;
          }
        }
      }
    }
  };
  walk(projectsDir);
  for (const r of allRows) {
    r.invoke_count = counts[r.slug] || 0;
    r.last_used_at = last[r.slug] || null;
  }
  return [];
}

// Upsert + deprecate missing
const now = new Date().toISOString();
const payload = rows.map((r) => ({ ...r, invoke_count: r.invoke_count || 0,
  metadata: r.metadata || {}, synced_at: now }));

const { error: upErr } = await db.from('aios_capabilities')
  .upsert(payload, { onConflict: 'kind,slug' });
if (upErr) { console.error('upsert failed:', upErr.message); process.exit(1); }

const { data: dbRows } = await db.from('aios_capabilities').select('kind,slug');
const stale = deprecateMissing(payload, dbRows || []);
for (const s of stale) {
  await db.from('aios_capabilities').update({ status: 'deprecated', synced_at: now })
    .eq('kind', s.kind).eq('slug', s.slug);
}

console.log(`synced ${payload.length} rows, deprecated ${stale.length}` +
  (skipped.length ? `; skipped: ${skipped.join(' | ')}` : ''));
```

- [ ] **Step 3: Commit**

```bash
git add scripts/sync-aios-capabilities.mjs scripts/aios-manifest.json
git commit -m "feat(scan): sync entrypoint + integrations manifest"
```

---

### Task 6: Run the sync against real data

**Files:** none (verification)

- [ ] **Step 1: Run the sync with the service-role key**

Run (key from project memory `integrations.md`):
```bash
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>" node scripts/sync-aios-capabilities.mjs
```
Expected: `synced N rows, deprecated 0` where N ≥ 30 (≈19 skills + commands + panels + 10 manifest).

- [ ] **Step 2: Verify the roster in Supabase**

Run (Supabase MCP `execute_sql`):
```sql
select kind, count(*) from public.aios_capabilities group by kind order by kind;
```
Expected: rows for `skill` (≈19), `command`, `panel`, `integration` (8), `edge_fn` (2).

- [ ] **Step 3: Spot-check a known skill has its description + adoption**

```sql
select name, description, invoke_count, last_used_at
from public.aios_capabilities where slug = 'grill-me';
```
Expected: description present; invoke_count ≥ 1 (we used it this session).

---

## Phase B — Frontend

### Task 7: `useAiosOverview` hook

**Files:**
- Create: `hooks/useAiosOverview.ts`

- [ ] **Step 1: Write the hook**

```ts
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useWorkflowStats } from './useWorkflowStats';
import { useBrainStats } from './useBrainStats';

export type Capability = {
  kind: 'skill' | 'command' | 'panel' | 'integration' | 'edge_fn';
  slug: string;
  name: string;
  description: string | null;
  group: string | null;
  source_path: string | null;
  last_used_at: string | null;
  invoke_count: number;
  status: string;
  metadata: Record<string, unknown>;
};

export type AiosOverview = {
  byKind: Record<string, Capability[]>;
  counts: Record<string, number>;
  workflows: { total: number; errors: number };
  memoryFiles: number;
  loading: boolean;
  error: string | null;
};

export function useAiosOverview(): AiosOverview {
  const [rows, setRows] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const wf = useWorkflowStats();
  const brain = useBrainStats();

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase.rpc('aios_capabilities_overview');
      if (!alive) return;
      if (error) setError(error.message);
      else setRows((data as Capability[]) || []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const byKind: Record<string, Capability[]> = {};
  const counts: Record<string, number> = {};
  for (const r of rows) {
    (byKind[r.kind] ||= []).push(r);
    counts[r.kind] = (counts[r.kind] || 0) + 1;
  }
  const memoryFiles = (brain.tierCounts || []).reduce((s: number, t: any) => s + (t.count || 0), 0);

  return {
    byKind, counts,
    workflows: { total: wf.stats?.total || 0, errors: wf.stats?.totalErrors24h || 0 },
    memoryFiles,
    loading: loading || wf.loading || brain.loading,
    error,
  };
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors referencing `useAiosOverview.ts`. (If `useBrainStats` exposes `tierCounts`/`loading` under different names, align to the actual exports — confirm against `hooks/useBrainStats.ts` return object.)

- [ ] **Step 3: Commit**

```bash
git add hooks/useAiosOverview.ts
git commit -m "feat(hooks): useAiosOverview roster + live counts"
```

---

### Task 8: `CapabilityHero` (stat band + cluster map)

**Files:**
- Create: `components/dashboard/CapabilityHero.tsx`

- [ ] **Step 1: Write the component**

```tsx
import React from 'react';
import { KpiTile, KpiRow } from '../dashboard-v2/primitives';

type Props = {
  counts: Record<string, number>;
  workflows: { total: number; errors: number };
  memoryFiles: number;
};

const CLUSTERS = [
  { key: 'skill', label: 'Skills' },
  { key: 'command', label: 'Commands' },
  { key: 'integration', label: 'Integrations' },
  { key: 'panel', label: 'Panels' },
];

const CapabilityHero: React.FC<Props> = ({ counts, workflows, memoryFiles }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 8 }}>
    <KpiRow>
      <KpiTile label="Skills" value={String(counts.skill || 0)} />
      <KpiTile label="Workflows" value={String(workflows.total)}
        sub={workflows.errors ? `${workflows.errors} errors` : 'healthy'} />
      <KpiTile label="Commands" value={String(counts.command || 0)} />
      <KpiTile label="Integrations" value={String(counts.integration || 0)} />
      <KpiTile label="Memory files" value={String(memoryFiles)} />
    </KpiRow>
    {/* Cluster band: capability domains sized by count */}
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {CLUSTERS.map((c) => {
        const n = counts[c.key] || 0;
        return (
          <div key={c.key} style={{
            flex: `1 1 ${80 + Math.min(n, 60) * 2}px`,
            border: '1px solid var(--d-line, #2a2a2a)', borderRadius: 10,
            padding: '14px 16px', background: 'var(--d-panel, #141414)',
          }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{n}</div>
            <div style={{ fontSize: 12, color: 'var(--d-paper-dim, #888)' }}>{c.label}</div>
          </div>
        );
      })}
    </div>
  </div>
);

export default CapabilityHero;
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors. (If `KpiTile` does not accept a `sub` prop, drop it — confirm against `primitives/KpiTile`.)

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/CapabilityHero.tsx
git commit -m "feat(ui): CapabilityHero stat band + cluster map"
```

---

### Task 9: `CapabilityRoster` (grouped collapsible + deep-links)

**Files:**
- Create: `components/dashboard/CapabilityRoster.tsx`

- [ ] **Step 1: Write the component**

```tsx
import React, { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import type { Capability } from '../../hooks/useAiosOverview';

// Deep-link each kind to its existing detail panel (section + optional sub-tab).
const LINKS: Record<string, { href: string; label: string } | undefined> = {
  skill:       { href: '?section=ops&sub=skills', label: 'Skill Drafts' },
  panel:       undefined,
  integration: undefined,
  edge_fn:     undefined,
  command:     undefined,
};

const KIND_TITLE: Record<string, string> = {
  skill: 'Skills', command: 'Commands', integration: 'Integrations',
  edge_fn: 'Edge Functions', panel: 'Dashboard Panels',
};
const KIND_ORDER = ['skill', 'command', 'integration', 'edge_fn', 'panel'];

const CapabilityRoster: React.FC<{ byKind: Record<string, Capability[]> }> = ({ byKind }) => {
  const [open, setOpen] = useState<Record<string, boolean>>({ skill: true });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {KIND_ORDER.filter((k) => byKind[k]?.length).map((kind) => {
        const items = byKind[kind];
        const link = LINKS[kind];
        const isOpen = open[kind] ?? false;
        return (
          <div key={kind} style={{ border: '1px solid var(--d-line,#2a2a2a)', borderRadius: 10 }}>
            <button
              onClick={() => setOpen((o) => ({ ...o, [kind]: !isOpen }))}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '12px 14px', background: 'transparent', border: 0,
                color: 'inherit', cursor: 'pointer', font: 'inherit' }}>
              {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <span style={{ fontWeight: 600 }}>{KIND_TITLE[kind]}</span>
              <span style={{ color: 'var(--d-paper-dim,#888)', fontSize: 12 }}>({items.length})</span>
              {link && (
                <a href={link.href} onClick={(e) => e.stopPropagation()}
                  style={{ marginLeft: 'auto', fontSize: 12, display: 'flex',
                    alignItems: 'center', gap: 4, color: 'var(--d-sage,#1F6B4B)' }}>
                  {link.label} <ExternalLink size={12} />
                </a>
              )}
            </button>
            {isOpen && (
              <div style={{ padding: '0 14px 12px 38px', display: 'flex',
                flexDirection: 'column', gap: 8 }}>
                {items.map((c) => (
                  <div key={`${c.kind}:${c.slug}`} style={{ display: 'flex', gap: 10 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 8, marginTop: 6,
                      flex: '0 0 auto',
                      background: c.invoke_count > 0 ? 'var(--d-sage,#1F6B4B)' : '#555' }} />
                    <div>
                      <div style={{ fontWeight: 500 }}>{c.name}</div>
                      {c.description && (
                        <div style={{ fontSize: 12, color: 'var(--d-paper-dim,#888)' }}>
                          {c.description}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default CapabilityRoster;
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors referencing `CapabilityRoster.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/CapabilityRoster.tsx
git commit -m "feat(ui): CapabilityRoster grouped roster with deep-links"
```

---

### Task 10: `SystemOverview` section

**Files:**
- Create: `components/dashboard-v2/sections/SystemOverview.tsx`

- [ ] **Step 1: Write the section**

```tsx
import React, { lazy, Suspense } from 'react';
import { HeadRow, ErrBanner } from '../primitives';
import { useAiosOverview } from '../../../hooks/useAiosOverview';

const CapabilityHero = lazy(() => import('../../dashboard/CapabilityHero'));
const CapabilityRoster = lazy(() => import('../../dashboard/CapabilityRoster'));

const Loading = () => (
  <div style={{ padding: '2rem 0', color: 'var(--d-paper-dim)', fontSize: 13 }}>Loading…</div>
);

export function SystemOverview() {
  const o = useAiosOverview();
  return (
    <>
      <HeadRow title={<>My <em>AIOS</em></>} meta={<>Capabilities · live overview</>} />
      {o.error && <ErrBanner>Roster unavailable: {o.error}</ErrBanner>}
      {o.loading ? <Loading /> : (
        <Suspense fallback={<Loading />}>
          <CapabilityHero counts={o.counts} workflows={o.workflows} memoryFiles={o.memoryFiles} />
          <CapabilityRoster byKind={o.byKind} />
        </Suspense>
      )}
    </>
  );
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors. (If `ErrBanner` expects a `message` prop instead of children, adapt to its signature.)

- [ ] **Step 3: Commit**

```bash
git add components/dashboard-v2/sections/SystemOverview.tsx
git commit -m "feat(ui): SystemOverview section"
```

---

### Task 11: Nav wiring

**Files:**
- Modify: `components/dashboard-v2/types.ts:6-15`
- Modify: `components/dashboard-v2/DemoShell.tsx`

- [ ] **Step 1: Add `'system'` to `SectionId`**

In `components/dashboard-v2/types.ts`, change the union to include `system`:
```ts
export type SectionId =
  | 'briefing'
  | 'content'
  | 'reach'
  | 'ops'
  | 'clients'
  | 'knowledge'
  | 'agent'
  | 'ideas'
  | 'system'
  | 'personal';
```

- [ ] **Step 2: Add the nav item** (in `DemoShell.tsx` `navItems`, after the `agent`/`ideas` entries, in the `knowledge` group)

```ts
    { id: 'system', name: 'System', num: '08', group: 'knowledge' },
```

- [ ] **Step 3: Import + register the renderer** (in `DemoShell.tsx`)

Add the import near the other section imports:
```ts
import { SystemOverview } from './sections/SystemOverview';
```
Add to `sectionRenderers`:
```ts
    system: () => <SystemOverview />,
```

- [ ] **Step 4: Verify type-check + build**

Run: `npx tsc --noEmit -p tsconfig.json && npm run build`
Expected: build succeeds, no type errors.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard-v2/types.ts components/dashboard-v2/DemoShell.tsx
git commit -m "feat(ui): wire System section into dashboard-v2 nav"
```

---

### Task 12: Visual verification (self-test — required for UI)

Per `feedback-visual-work-test-yourself.md`, prove it renders before claiming done.

**Files:** none (verification)

- [ ] **Step 1: Start dev server**

Run: `npm run dev` (note the local URL).

- [ ] **Step 2: Screenshot the System section via playwright-driver**

Use the `playwright-driver` skill (Mode 1, inspect) to load `<dev-url>/dashboard-v2?section=system` and capture desktop + mobile screenshots.
Expected: hero stat band shows real counts (Skills ≈19, Workflows ≈224); roster groups expand; Skills group shows the "Skill Drafts" deep-link.

- [ ] **Step 3: Iterate on spacing/contrast** if needed (brand: paper+sage, `#1F6B4B`), re-screenshot until clean. Commit any tweaks:

```bash
git add -A && git commit -m "fix(ui): System overview visual polish"
```

---

## Phase C — Auto-refresh + Cleanup

### Task 13: Debounced Stop-hook

**Files:**
- Create: `~/.claude/hooks/sync-aios-capabilities.sh`
- Modify: `~/.claude/settings.json`

- [ ] **Step 1: Write the debounced wrapper**

```bash
#!/usr/bin/env bash
# Debounced AIOS capability sync — runs at most once per 6h on session Stop.
set -euo pipefail
STAMP="$HOME/.cache/aios-sync.stamp"
REPO="$HOME/Desktop/personal-site"
THRESHOLD=$((6 * 3600))
now=$(date +%s)
if [ -f "$STAMP" ]; then
  last=$(cat "$STAMP" 2>/dev/null || echo 0)
  if [ $((now - last)) -lt "$THRESHOLD" ]; then exit 0; fi
fi
# Service-role key from the environment configured for hooks; bail quietly if absent.
if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then exit 0; fi
( cd "$REPO" && timeout 60 node scripts/sync-aios-capabilities.mjs ) >/dev/null 2>&1 || exit 0
echo "$now" > "$STAMP"
exit 0
```

Make it executable: `chmod +x ~/.claude/hooks/sync-aios-capabilities.sh`

- [ ] **Step 2: Register the Stop-hook** (use the `update-config` skill to edit `~/.claude/settings.json`)

Add to the `hooks.Stop` array an entry running `~/.claude/hooks/sync-aios-capabilities.sh`. Verify the JSON stays valid.

- [ ] **Step 3: Verify the debounce works**

Run twice:
```bash
rm -f ~/.cache/aios-sync.stamp
SUPABASE_SERVICE_ROLE_KEY="<key>" ~/.claude/hooks/sync-aios-capabilities.sh && echo "run1 ok"
SUPABASE_SERVICE_ROLE_KEY="<key>" ~/.claude/hooks/sync-aios-capabilities.sh && echo "run2 ok (should no-op)"
```
Expected: first run updates `~/.cache/aios-sync.stamp`; second run exits immediately (stamp < 6h old).

- [ ] **Step 4: Commit** (hooks live outside the repo; commit only repo-tracked changes if any)

No repo commit needed for `~/.claude` files. Note the change in the PR description instead.

---

### Task 14: Delete orphaned `SystemMapPanel`

**Files:**
- Delete: `components/dashboard/SystemMapPanel.tsx`
- Delete: `components/dashboard/system-map/` (conditional)

- [ ] **Step 1: Confirm `SystemMapPanel` has no importers**

Run: `grep -rn "SystemMapPanel" components/ App.tsx index.tsx | grep -v "SystemMapPanel.tsx:"`
Expected: no output (orphan confirmed).

- [ ] **Step 2: Check whether `system-map/` is used by anything else**

Run: `grep -rn "from './system-map\|dashboard/system-map" components/ | grep -v "SystemMapPanel.tsx"`
Expected: no output → safe to delete the dir. If there IS output, delete only `SystemMapPanel.tsx`.

- [ ] **Step 3: Delete**

```bash
git rm components/dashboard/SystemMapPanel.tsx
# only if Step 2 showed no other importers:
git rm -r components/dashboard/system-map
```

- [ ] **Step 4: Verify build still passes**

Run: `npx tsc --noEmit -p tsconfig.json && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git commit -m "chore(ui): remove orphaned SystemMapPanel superseded by System overview"
```

---

### Task 15: Finish the branch

- [ ] **Step 1: Full verification**

Run: `npx tsc --noEmit -p tsconfig.json && npm run build && node --test scripts/lib/capability-scan.test.mjs`
Expected: all pass.

- [ ] **Step 2: Push the feature branch** with explicit refspec (per git-hazard rule):

```bash
git push origin feat/aios-system-overview:feat/aios-system-overview
```

- [ ] **Step 3: Use `superpowers:finishing-a-development-branch`** to choose merge/PR/cleanup. Deploy to production is via `git push origin main` per project rules — only after merge.

---

## Notes for the Engineer

- **Hook return-shape drift:** `useBrainStats` / `useWorkflowStats` are existing hooks — confirm the exact property names (`tierCounts`, `stats.total`, `stats.totalErrors24h`, `loading`) in their source and align `useAiosOverview` to them. The plan's names match what was observed but verify before trusting.
- **Primitive props:** `KpiTile`, `ErrBanner` props are assumed (`sub`, children). Open the primitive source; adapt if signatures differ. Don't invent props.
- **Service-role key:** lives in project memory `integrations.md`. Never commit it; pass via env only.
- **CSS variables:** the inline styles use `var(--d-*)` fallbacks; if the dashboard-v2 theme uses different token names, switch to the real ones (grep `dashboard-v2.css`).
- **Deep-link target:** the Skills group links to `?section=ops&sub=skills` (Operations → Skill Drafts). Confirm that URL actually selects that sub-tab when loaded cold.
