# Scheduled Ops (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a "Scheduled Ops" dashboard tab that catches silently-missed n8n cron runs and shows an at-a-glance, categorized health board of every scheduled n8n workflow.

**Architecture:** A new `scheduled_job_registry` table is the declared catalog of scheduled jobs. A DB trigger on `dashboard_workflow_stats` (which the n8n sync already writes hourly) auto-populates/refreshes the n8n rows — no n8n workflow edit. A single anon-readable view `scheduled_ops_status` joins the registry to last-run data and computes one status per job (OK / OVERDUE / ERRORING / DISABLED / UNKNOWN). The frontend reads only that view via a `useScheduledOps()` hook rendered by a new `ScheduledOpsPanel`.

**Tech Stack:** Postgres (Supabase, project `bjbvqvzbzczjbatgmccb`), React + Vite + TypeScript, Tailwind, lucide-react. No unit-test runner in repo → verification is SQL assertions (view logic), `vite build` (types), and Playwright (`dashboard` profile) for the visual check.

**Spec:** `docs/superpowers/specs/2026-06-04-scheduled-ops-design.md`. This plan implements Phase 1 only. Phase 2 (launchd + Claude-Code heartbeats via `scheduled_run_log`) is a later separate plan; the view's `base` CTE is structured so it extends cleanly.

**Working dir:** isolated worktree `/tmp/ps-scheduled-ops` on branch `feat/scheduled-ops` (personal-site has a live automation committing to `main` — do NOT work in the shared tree).

---

## File Structure

- **Create** `migrations/scheduled_ops.sql` — table + `derive_interval_minutes()` fn + `sync_scheduled_registry()` trigger fn + trigger + `scheduled_ops_status` view + one-time backfill. Repo record of the schema (also applied to the live DB).
- **Create** `scripts/verify-scheduled-ops.sql` — transactional (BEGIN…ROLLBACK) assertion script proving the view's status logic. Not shipped to prod data.
- **Modify** `types/dashboard.ts` — add `ScheduledStatus` + `ScheduledJob` types; add `'scheduled-ops'` to the `Tab` union.
- **Create** `hooks/useScheduledOps.ts` — reads `scheduled_ops_status`, returns `{ jobs, loading, refresh, stats }`.
- **Create** `components/dashboard/ScheduledOpsPanel.tsx` — the tab UI (summary strip + grouped rows + filters).
- **Modify** `components/dashboard/DashboardLayout.tsx` — add the sidebar tab entry (Operations group).
- **Modify** `components/dashboard/Dashboard.tsx` — lazy-import the panel + register it in `panelComponents`.

---

## Task 1: Database — registry table, interval fn, sync trigger, status view

**Files:**
- Create: `migrations/scheduled_ops.sql`
- Create: `scripts/verify-scheduled-ops.sql`

- [ ] **Step 1: Write the migration file**

Create `migrations/scheduled_ops.sql` with exactly this content:

```sql
-- Scheduled Ops: unified catalog of every scheduled job + computed freshness/status.
-- Phase 1 covers n8n cron workflows; last-run is resolved from dashboard_workflow_stats.
-- n8n registry rows are auto-maintained by a trigger on dashboard_workflow_stats
-- (which the n8n "Dashboard Data Sync" workflow already writes hourly) — no workflow edit.
-- Phase 2 will add launchd / claude-code jobs via scheduled_run_log (view extended then).

-- ── Catalog table ──
CREATE TABLE IF NOT EXISTS scheduled_job_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_key text UNIQUE NOT NULL,                 -- 'n8n:<workflow_id>' | 'launchd:<label>' | 'cc:<routine>'
  source text NOT NULL DEFAULT 'n8n',           -- 'n8n' | 'launchd' | 'claude-code'
  label text NOT NULL,
  description text,                             -- human-curated; NEVER overwritten by the sync trigger
  category text NOT NULL DEFAULT 'Meta',         -- Content | Outreach | Brain-Memory | Recording | Meta
  schedule_human text,
  expected_interval_minutes int,                 -- NULL => no overdue eval (irregular / unparseable)
  grace_minutes int NOT NULL DEFAULT 15,        -- human-curated; NEVER overwritten by the sync trigger
  timezone text NOT NULL DEFAULT 'UTC',
  enabled boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sjr_source ON scheduled_job_registry(source);
CREATE INDEX IF NOT EXISTS idx_sjr_category ON scheduled_job_registry(category);

ALTER TABLE scheduled_job_registry ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS scheduled_job_registry_read ON scheduled_job_registry;
CREATE POLICY scheduled_job_registry_read ON scheduled_job_registry FOR SELECT USING (TRUE);
-- writes via service-role only (default deny)

COMMENT ON TABLE scheduled_job_registry IS 'Catalog of every scheduled job across sources. The declared-expectation half of missed-run detection. n8n rows auto-maintained by trigger on dashboard_workflow_stats.';

-- ── Best-effort interval derivation (cron 5/6-field OR human strings) ──
-- Returns the expected MAX gap between runs in minutes, or NULL if unparseable
-- (NULL => the status view will never flag OVERDUE — safe default, no false alarms).
CREATE OR REPLACE FUNCTION derive_interval_minutes(expr text)
RETURNS int LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  n int;
  unit text;
  parts text[];
  f_min text; f_hour text; f_dom text; f_dow text;
BEGIN
  IF expr IS NULL OR btrim(expr) = '' OR expr ILIKE '%undefined%' THEN
    RETURN NULL;
  END IF;

  -- "Every N second(s)|minute(s)|hour(s)"
  IF expr ~* '^every\s+\d+\s+(second|minute|hour)' THEN
    n := (regexp_match(expr, '(\d+)'))[1]::int;
    unit := lower((regexp_match(expr, '(second|minute|hour)', 'i'))[1]);
    RETURN CASE unit
      WHEN 'second' THEN GREATEST(1, CEIL(n / 60.0))::int
      WHEN 'minute' THEN n
      WHEN 'hour'   THEN n * 60
    END;
  END IF;

  -- Human day/week/month labels
  IF expr ILIKE 'daily%'   THEN RETURN 1440;  END IF;
  IF expr ILIKE 'weekly%'  THEN RETURN 10080; END IF;
  IF expr ILIKE 'monthly%' THEN RETURN 43200; END IF;

  -- Cron (5 or 6 fields). Drop a leading seconds field if present.
  parts := regexp_split_to_array(btrim(expr), '\s+');
  IF array_length(parts, 1) = 6 THEN
    parts := parts[2:6];
  END IF;
  IF array_length(parts, 1) = 5 THEN
    f_min := parts[1]; f_hour := parts[2]; f_dom := parts[3]; f_dow := parts[5];
    IF f_dom <> '*' THEN RETURN 43200; END IF;          -- specific day-of-month => ~monthly
    IF f_dow <> '*' THEN RETURN 10080; END IF;          -- specific day-of-week  => ~weekly
    IF f_min ~ '^\*/\d+$' AND f_hour = '*' THEN          -- "*/N * * * *" => every N min
      RETURN (regexp_match(f_min, '(\d+)'))[1]::int;
    END IF;
    IF f_hour ~ '^\*/\d+$' THEN                          -- "* */N * * *" => every N hours
      RETURN (regexp_match(f_hour, '(\d+)'))[1]::int * 60;
    END IF;
    IF f_hour <> '*' THEN RETURN 1440; END IF;          -- specific hour, every day => daily
    IF f_min <> '*' THEN RETURN 60; END IF;             -- specific minute, every hour => hourly
    RETURN 1;                                            -- all wildcard => every minute
  END IF;

  RETURN NULL;  -- unparseable
END;
$$;

-- ── Trigger: keep n8n registry rows in sync with the stats table ──
-- Refreshes only DERIVED fields on conflict; preserves human-curated description/category/grace_minutes.
CREATE OR REPLACE FUNCTION sync_scheduled_registry()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.trigger_type = 'schedule' THEN
    INSERT INTO scheduled_job_registry
      (job_key, source, label, schedule_human, expected_interval_minutes, enabled, last_synced_at, updated_at)
    VALUES
      ('n8n:' || NEW.workflow_id, 'n8n', NEW.workflow_name, NEW.schedule_expression,
       derive_interval_minutes(NEW.schedule_expression),
       (COALESCE(NEW.is_active, false) AND NOT COALESCE(NEW.manually_paused, false)),
       now(), now())
    ON CONFLICT (job_key) DO UPDATE SET
      label = EXCLUDED.label,
      schedule_human = EXCLUDED.schedule_human,
      expected_interval_minutes = EXCLUDED.expected_interval_minutes,
      enabled = EXCLUDED.enabled,
      last_synced_at = now(),
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_scheduled_registry ON dashboard_workflow_stats;
CREATE TRIGGER trg_sync_scheduled_registry
AFTER INSERT OR UPDATE ON dashboard_workflow_stats
FOR EACH ROW EXECUTE FUNCTION sync_scheduled_registry();

-- ── Computed status view (anon-readable). Phase 1: n8n source only. ──
CREATE OR REPLACE VIEW scheduled_ops_status AS
WITH base AS (
  SELECT
    r.id, r.job_key, r.source, r.label, r.description, r.category,
    r.schedule_human, r.expected_interval_minutes, r.grace_minutes,
    r.timezone, r.enabled, r.last_synced_at,
    ws.last_execution_at          AS last_run_at,
    ws.last_execution_status      AS last_status,
    COALESCE(ws.error_count_24h, 0)   AS error_count_24h,
    COALESCE(ws.success_count_24h, 0) AS success_count_24h,
    ws.last_error_message         AS last_error_message,
    ws.last_execution_duration_ms AS last_duration_ms
  FROM scheduled_job_registry r
  LEFT JOIN dashboard_workflow_stats ws
    ON r.source = 'n8n'
   AND ws.workflow_id = substring(r.job_key FROM position(':' IN r.job_key) + 1)
)
SELECT
  base.*,
  CASE WHEN last_run_at IS NULL THEN NULL
       ELSE FLOOR(EXTRACT(EPOCH FROM (now() - last_run_at)) / 60)::int
  END AS minutes_since_last_run,
  CASE
    WHEN NOT enabled THEN 'DISABLED'
    WHEN last_status = 'error' OR error_count_24h > 0 THEN 'ERRORING'
    WHEN last_run_at IS NULL OR expected_interval_minutes IS NULL THEN 'UNKNOWN'
    WHEN EXTRACT(EPOCH FROM (now() - last_run_at)) / 60
         > (expected_interval_minutes + grace_minutes) THEN 'OVERDUE'
    ELSE 'OK'
  END AS status
FROM base;

COMMENT ON VIEW scheduled_ops_status IS 'Per-job computed status for the Scheduled Ops tab. Single source of OK/OVERDUE/ERRORING/DISABLED/UNKNOWN. Phase 1 = n8n only; extend base CTE with scheduled_run_log for non-n8n in Phase 2.';

-- ── One-time backfill from existing scheduled workflows ──
INSERT INTO scheduled_job_registry
  (job_key, source, label, schedule_human, expected_interval_minutes, enabled, last_synced_at, updated_at)
SELECT
  'n8n:' || workflow_id, 'n8n', workflow_name, schedule_expression,
  derive_interval_minutes(schedule_expression),
  (COALESCE(is_active, false) AND NOT COALESCE(manually_paused, false)),
  now(), now()
FROM dashboard_workflow_stats
WHERE trigger_type = 'schedule'
ON CONFLICT (job_key) DO UPDATE SET
  label = EXCLUDED.label,
  schedule_human = EXCLUDED.schedule_human,
  expected_interval_minutes = EXCLUDED.expected_interval_minutes,
  enabled = EXCLUDED.enabled,
  last_synced_at = now(),
  updated_at = now();
```

- [ ] **Step 2: Apply the migration to the live DB**

Use the Supabase MCP `apply_migration` tool (project `bjbvqvzbzczjbatgmccb`, name `scheduled_ops`) with the full file content from Step 1.
Expected: success, no errors. (DDL + the backfill INSERT all run.)

- [ ] **Step 3: Write the view-logic assertion script**

Create `scripts/verify-scheduled-ops.sql` with exactly this content. It seeds controlled rows inside a transaction, checks the view, then ROLLs BACK so no test data persists:

```sql
BEGIN;

-- Registry rows covering every status branch
INSERT INTO scheduled_job_registry (job_key, source, label, category, expected_interval_minutes, grace_minutes, enabled) VALUES
  ('n8n:__t_overdue',  'n8n', 'T Overdue',  'Meta', 60,   15, true),
  ('n8n:__t_ok',       'n8n', 'T OK',       'Meta', 60,   15, true),
  ('n8n:__t_interval_null','n8n','T IntNull','Meta', NULL, 15, true),
  ('n8n:__t_neverrun', 'n8n', 'T NeverRun', 'Meta', 60,   15, true),
  ('n8n:__t_disabled', 'n8n', 'T Disabled', 'Meta', 60,   15, false),
  ('n8n:__t_erroring', 'n8n', 'T Erroring', 'Meta', 60,   15, true);

-- Matching last-run data (only workflow_id + workflow_name are required NOT NULL)
INSERT INTO dashboard_workflow_stats (workflow_id, workflow_name, is_active, last_execution_at, last_execution_status, error_count_24h, success_count_24h) VALUES
  ('__t_overdue',      'T Overdue',  true, now() - interval '200 minutes', 'success', 0, 3),
  ('__t_ok',           'T OK',       true, now() - interval '10 minutes',  'success', 0, 5),
  ('__t_interval_null','T IntNull',  true, now() - interval '10 minutes',  'success', 0, 5),
  ('__t_erroring',     'T Erroring', true, now() - interval '5 minutes',   'error',   2, 0);

SELECT job_key, status
FROM scheduled_ops_status
WHERE job_key LIKE 'n8n:__t_%'
ORDER BY job_key;

ROLLBACK;
```

- [ ] **Step 4: Run the assertion script and verify output**

Run it via Supabase MCP `execute_sql` (project `bjbvqvzbzczjbatgmccb`) with the file content from Step 3.
Expected exact rows (the ROLLBACK means nothing is persisted):

| job_key | status |
|---|---|
| n8n:__t_disabled | DISABLED |
| n8n:__t_erroring | ERRORING |
| n8n:__t_interval_null | UNKNOWN |
| n8n:__t_neverrun | UNKNOWN |
| n8n:__t_ok | OK |
| n8n:__t_overdue | OVERDUE |

If any status differs, fix the `CASE` in the view (Step 1), re-apply (Step 2), re-run. Do NOT proceed until all six match.

- [ ] **Step 5: Verify real data populated + interval derivation sanity**

Run via Supabase MCP `execute_sql`:

```sql
SELECT status, count(*) FROM scheduled_ops_status GROUP BY status ORDER BY count DESC;
SELECT schedule_human, expected_interval_minutes
FROM scheduled_job_registry
WHERE source = 'n8n'
ORDER BY expected_interval_minutes NULLS LAST
LIMIT 25;
```
Expected: first query returns a spread across OK/OVERDUE/ERRORING/DISABLED/UNKNOWN totalling ~104 rows. Second query: `Every 5 minutes`→5, `Every 1 hours`→60, `0 10 * * *`→1440, `Weekly Mon at 04:00 UTC`→10080, `Every undefined`→NULL. Spot-check a handful look right.

- [ ] **Step 6: Commit**

```bash
cd /tmp/ps-scheduled-ops
git add migrations/scheduled_ops.sql scripts/verify-scheduled-ops.sql
git commit -m "feat(scheduled-ops): registry table, interval fn, sync trigger, status view"
```

---

## Task 2: TypeScript types + Tab union

**Files:**
- Modify: `types/dashboard.ts` (add types near `WorkflowStat` ~line 33; extend `Tab` ~line 904)

- [ ] **Step 1: Add the ScheduledJob types**

In `types/dashboard.ts`, immediately after the `WorkflowStat` interface, add:

```typescript
export type ScheduledStatus = 'OK' | 'OVERDUE' | 'ERRORING' | 'DISABLED' | 'UNKNOWN';

export interface ScheduledJob {
  id: string;
  jobKey: string;
  source: 'n8n' | 'launchd' | 'claude-code';
  label: string;
  description: string | null;
  category: string;
  scheduleHuman: string | null;
  expectedIntervalMinutes: number | null;
  graceMinutes: number;
  timezone: string;
  enabled: boolean;
  lastRunAt: string | null;
  lastStatus: string | null;
  errorCount24h: number;
  successCount24h: number;
  lastErrorMessage: string | null;
  lastDurationMs: number | null;
  minutesSinceLastRun: number | null;
  status: ScheduledStatus;
}
```

- [ ] **Step 2: Add the tab to the Tab union**

In `types/dashboard.ts` find the `export type Tab = ...` union (~line 904) and insert `| 'scheduled-ops'` before `| 'settings'`. The end of the union becomes:

```typescript
 | 'leadmagnets' | 'signal-clusters' | 'scheduled-ops' | 'settings';
```

- [ ] **Step 3: Verify it compiles**

```bash
cd /tmp/ps-scheduled-ops && npx tsc --noEmit
```
Expected: no new errors referencing `types/dashboard.ts`. (If the repo's tsc has pre-existing unrelated errors, confirm none are in the lines you touched.)

- [ ] **Step 4: Commit**

```bash
cd /tmp/ps-scheduled-ops
git add types/dashboard.ts
git commit -m "feat(scheduled-ops): ScheduledJob types + scheduled-ops tab union"
```

---

## Task 3: useScheduledOps hook

**Files:**
- Create: `hooks/useScheduledOps.ts`

- [ ] **Step 1: Write the hook**

Create `hooks/useScheduledOps.ts` with exactly:

```typescript
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { toastError } from '../lib/dashboardActions';
import type { ScheduledJob, ScheduledStatus } from '../types/dashboard';

function mapRow(row: any): ScheduledJob {
  return {
    id: row.id,
    jobKey: row.job_key,
    source: row.source,
    label: row.label,
    description: row.description,
    category: row.category || 'Meta',
    scheduleHuman: row.schedule_human,
    expectedIntervalMinutes: row.expected_interval_minutes,
    graceMinutes: row.grace_minutes,
    timezone: row.timezone,
    enabled: row.enabled,
    lastRunAt: row.last_run_at,
    lastStatus: row.last_status,
    errorCount24h: row.error_count_24h || 0,
    successCount24h: row.success_count_24h || 0,
    lastErrorMessage: row.last_error_message,
    lastDurationMs: row.last_duration_ms,
    minutesSinceLastRun: row.minutes_since_last_run,
    status: (row.status || 'UNKNOWN') as ScheduledStatus,
  };
}

export function useScheduledOps() {
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);

  const fetch = useCallback(async () => {
    if (!hasFetched.current) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('scheduled_ops_status')
        .select('*')
        .order('label');
      if (error) throw error;
      setJobs((data || []).map(mapRow));
    } catch (err) {
      toastError('load scheduled ops', err);
    } finally {
      setLoading(false);
      hasFetched.current = true;
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const stats = useMemo(() => {
    const c = { ok: 0, overdue: 0, erroring: 0, disabled: 0, unknown: 0 };
    for (const j of jobs) {
      if (j.status === 'OK') c.ok++;
      else if (j.status === 'OVERDUE') c.overdue++;
      else if (j.status === 'ERRORING') c.erroring++;
      else if (j.status === 'DISABLED') c.disabled++;
      else c.unknown++;
    }
    return { total: jobs.length, ...c };
  }, [jobs]);

  return { jobs, loading, refresh: fetch, stats };
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /tmp/ps-scheduled-ops && npx tsc --noEmit
```
Expected: no errors in `hooks/useScheduledOps.ts`. (Confirms `supabase`, `toastError`, and the new types resolve.)

- [ ] **Step 3: Commit**

```bash
cd /tmp/ps-scheduled-ops
git add hooks/useScheduledOps.ts
git commit -m "feat(scheduled-ops): useScheduledOps hook reading scheduled_ops_status"
```

---

## Task 4: ScheduledOpsPanel component

**Files:**
- Create: `components/dashboard/ScheduledOpsPanel.tsx`

- [ ] **Step 1: Write the panel**

Create `components/dashboard/ScheduledOpsPanel.tsx` with exactly:

```tsx
import React, { useState, useMemo } from 'react';
import {
  Timer, CheckCircle2, AlertTriangle, XCircle, HelpCircle, PauseCircle,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import { useScheduledOps } from '../../hooks/useScheduledOps';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import AnimateIn from './shared/AnimateIn';
import FilterBar from './shared/FilterBar';
import { timeAgo } from './shared/utils';
import type { ScheduledJob, ScheduledStatus } from '../../types/dashboard';

/* ── Status presentation ── */
const STATUS_META: Record<ScheduledStatus, { label: string; pill: string; dot: string; priority: number }> = {
  OVERDUE:  { label: 'Overdue',  pill: 'bg-red-500/15 text-red-300 border-red-500/30',       dot: 'bg-red-400',     priority: 0 },
  ERRORING: { label: 'Erroring', pill: 'bg-orange-500/15 text-orange-300 border-orange-500/30', dot: 'bg-orange-400', priority: 1 },
  UNKNOWN:  { label: 'Unknown',  pill: 'bg-amber-500/15 text-amber-300 border-amber-500/30',  dot: 'bg-amber-400',   priority: 2 },
  OK:       { label: 'OK',       pill: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', dot: 'bg-emerald-400', priority: 3 },
  DISABLED: { label: 'Disabled', pill: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',     dot: 'bg-zinc-500',    priority: 4 },
};

const SOURCE_CHIP: Record<string, string> = {
  'n8n':         'bg-blue-500/15 text-blue-300 border-blue-500/30',
  'launchd':     'bg-purple-500/15 text-purple-300 border-purple-500/30',
  'claude-code': 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
};

/* ── One job row ── */
const JobRow: React.FC<{ job: ScheduledJob }> = ({ job }) => {
  const [open, setOpen] = useState(false);
  const meta = STATUS_META[job.status];
  const hasError = !!job.lastErrorMessage;

  return (
    <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/40">
      <button
        onClick={() => hasError && setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${meta.dot} ${job.status === 'OVERDUE' || job.status === 'ERRORING' ? 'animate-pulse' : ''}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-zinc-100 truncate">{job.label}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${SOURCE_CHIP[job.source] || SOURCE_CHIP['n8n']}`}>{job.source}</span>
          </div>
          {job.description && <p className="text-xs text-zinc-500 truncate">{job.description}</p>}
        </div>
        <div className="hidden sm:block text-xs text-zinc-500 shrink-0 w-32 truncate">{job.scheduleHuman || '—'}</div>
        <div className="text-xs text-zinc-400 shrink-0 w-20 text-right tabular-nums">
          {job.lastRunAt ? timeAgo(job.lastRunAt) : 'never'}
        </div>
        <span className={`text-[11px] px-2 py-0.5 rounded-full border shrink-0 ${meta.pill}`}>{meta.label}</span>
        {hasError ? (open ? <ChevronDown className="w-4 h-4 text-zinc-600 shrink-0" /> : <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" />) : <span className="w-4 shrink-0" />}
      </button>
      {open && hasError && (
        <div className="px-3 pb-3 pt-0">
          <pre className="text-[11px] text-red-300/90 bg-red-950/20 border border-red-900/30 rounded p-2 whitespace-pre-wrap break-words">{job.lastErrorMessage}</pre>
        </div>
      )}
    </div>
  );
};

/* ── Summary strip stat ── */
const Stat: React.FC<{ icon: React.ReactNode; n: number; label: string; alarm?: boolean }> = ({ icon, n, label, alarm }) => (
  <div className="flex items-center gap-1.5">
    {icon}
    <span className={`text-sm font-bold tabular-nums ${alarm && n > 0 ? 'text-red-400' : 'text-zinc-200'}`}>{n}</span>
    <span className="text-[10px] text-zinc-500 hidden sm:inline">{label}</span>
  </div>
);

const ScheduledOpsPanel: React.FC = () => {
  const { jobs, stats, loading, refresh } = useScheduledOps();
  const { lastRefreshed } = useAutoRefresh(refresh, { realtimeTables: ['scheduled_job_registry'] });

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ScheduledStatus | 'ALL'>('ALL');
  const [groupBy, setGroupBy] = useState<'category' | 'source'>('category');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((j) => {
      if (statusFilter !== 'ALL' && j.status !== statusFilter) return false;
      if (q && !(`${j.label} ${j.description ?? ''} ${j.scheduleHuman ?? ''}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [jobs, search, statusFilter]);

  const groups = useMemo(() => {
    const m = new Map<string, ScheduledJob[]>();
    for (const j of filtered) {
      const key = groupBy === 'category' ? (j.category || 'Meta') : j.source;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(j);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => STATUS_META[a.status].priority - STATUS_META[b.status].priority || a.label.localeCompare(b.label));
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, groupBy]);

  if (loading) return <LoadingSkeleton cards={4} rows={8} />;

  const filterChips: (ScheduledStatus | 'ALL')[] = ['ALL', 'OVERDUE', 'ERRORING', 'UNKNOWN', 'OK', 'DISABLED'];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Scheduled Ops</h1>
        <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
      </div>

      <AnimateIn>
        <div className="flex items-center gap-3 sm:gap-5 px-4 py-3 rounded-xl border border-zinc-800/50 bg-zinc-900/40 flex-wrap">
          <Stat icon={<Timer className="w-3.5 h-3.5 text-blue-400" />} n={stats.total} label="jobs" />
          <Stat icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />} n={stats.ok} label="ok" />
          <Stat icon={<XCircle className="w-3.5 h-3.5 text-red-400" />} n={stats.overdue} label="overdue" alarm />
          <Stat icon={<AlertTriangle className="w-3.5 h-3.5 text-orange-400" />} n={stats.erroring} label="erroring" alarm />
          <Stat icon={<HelpCircle className="w-3.5 h-3.5 text-amber-400" />} n={stats.unknown} label="unknown" />
          <Stat icon={<PauseCircle className="w-3.5 h-3.5 text-zinc-500" />} n={stats.disabled} label="disabled" />
        </div>
      </AnimateIn>

      <div className="flex items-center gap-2 flex-wrap">
        <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search scheduled jobs..." />
        <button
          onClick={() => setGroupBy((g) => (g === 'category' ? 'source' : 'category'))}
          className="text-xs px-2.5 py-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-200"
        >
          Group: {groupBy}
        </button>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {filterChips.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`text-[11px] px-2 py-1 rounded-full border ${statusFilter === s ? 'bg-zinc-100 text-zinc-900 border-zinc-100' : 'border-zinc-800 text-zinc-400 hover:text-zinc-200'}`}
          >
            {s === 'ALL' ? 'All' : STATUS_META[s].label}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-zinc-500 px-1">No scheduled jobs match.</p>
      ) : (
        groups.map(([groupName, arr]) => (
          <AnimateIn key={groupName}>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 px-1">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{groupName}</h2>
                <span className="text-[10px] text-zinc-600">{arr.length}</span>
              </div>
              <div className="space-y-1.5">
                {arr.map((j) => <JobRow key={j.jobKey} job={j} />)}
              </div>
            </div>
          </AnimateIn>
        ))
      )}
    </div>
  );
};

export default ScheduledOpsPanel;
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /tmp/ps-scheduled-ops && npx tsc --noEmit
```
Expected: no errors in `ScheduledOpsPanel.tsx`. If `timeAgo`, `FilterBar`, `AnimateIn`, `RefreshIndicator`, or `LoadingSkeleton` import paths/props differ from what's used here, fix the import/usage to match the actual signatures in `components/dashboard/shared/` (these were taken from `WorkflowsPanel.tsx` — verify against it).

- [ ] **Step 3: Commit**

```bash
cd /tmp/ps-scheduled-ops
git add components/dashboard/ScheduledOpsPanel.tsx
git commit -m "feat(scheduled-ops): ScheduledOpsPanel — summary strip, grouped rows, filters"
```

---

## Task 5: Wire the tab into navigation + routing

**Files:**
- Modify: `components/dashboard/DashboardLayout.tsx` (tab list, Operations group)
- Modify: `components/dashboard/Dashboard.tsx` (lazy import + `panelComponents`)

- [ ] **Step 1: Add the sidebar tab**

In `components/dashboard/DashboardLayout.tsx`, ensure `Timer` is imported from `lucide-react` (add it to the existing lucide import if absent). Then in the `tabGroups` array, in the group whose `label` is `'Operations'`, add as the first tab entry:

```tsx
{ id: 'scheduled-ops', label: 'Scheduled Ops', icon: <Timer className="w-[18px] h-[18px]" /> },
```

- [ ] **Step 2: Register the panel component**

In `components/dashboard/Dashboard.tsx`, add the lazy import alongside the other `Lazy*Panel` declarations (match the existing `retryImport`/`lazy` pattern used by neighbours, e.g.):

```tsx
const LazyScheduledOpsPanel = lazy(retryImport(() => import('./ScheduledOpsPanel')));
```

Then add this entry to the `panelComponents: Record<Tab, React.ComponentType>` map:

```tsx
  'scheduled-ops': LazyScheduledOpsPanel as unknown as React.ComponentType,
```

(If there is a prefetch list of lazy imports nearby, add `LazyScheduledOpsPanel` to it too — optional, non-blocking.)

- [ ] **Step 3: Verify the production build passes**

```bash
cd /tmp/ps-scheduled-ops && npm run build
```
Expected: build succeeds. A `Record<Tab, ...>` is exhaustive — if `'scheduled-ops'` were missing from `panelComponents`, the build would fail, so a green build confirms the wiring is complete.

- [ ] **Step 4: Commit**

```bash
cd /tmp/ps-scheduled-ops
git add components/dashboard/DashboardLayout.tsx components/dashboard/Dashboard.tsx
git commit -m "feat(scheduled-ops): register Scheduled Ops tab + panel routing"
```

---

## Task 6: End-to-end visual verification (Playwright, `dashboard` profile)

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

```bash
cd /tmp/ps-scheduled-ops && npm run dev
```
Expected: Vite serves on a local URL (e.g. `http://localhost:5173`). Note the port.

- [ ] **Step 2: Screenshot the new tab**

Use the **playwright-driver** skill (Mode 2 / drive lane) with the persistent `dashboard` profile (already holds the single-password `dashboard_auth` in localStorage). Navigate to the dev URL, click the **Scheduled Ops** item in the sidebar (Operations group), wait for the grid, and capture a full-page screenshot at desktop width (1440) and mobile width (390).

- [ ] **Step 3: Inspect the screenshots — confirm against the spec**

Verify visually (this is the "test visual work yourself" gate — do not declare done on assertions alone):
- Summary strip shows the six counts; `overdue`/`erroring` render red when > 0.
- Jobs are grouped (default by category) with overdue/erroring floated to the top of each group.
- Each row shows label + description + blue `n8n` chip + schedule + relative last-run + status pill.
- Clicking a row with an error expands the error text.
- Status filter chips and the Group toggle work.
- Mobile width: strip wraps, rows remain legible (no overflow).

If anything looks off, fix `ScheduledOpsPanel.tsx`, rebuild, re-screenshot. Iterate until it reads cleanly.

- [ ] **Step 4: Sanity-check the data is truthful**

Cross-check the on-screen overdue/erroring counts against:
```sql
SELECT status, count(*) FROM scheduled_ops_status GROUP BY status;
```
(run via Supabase MCP). The strip counts must match the view. Confirm at least the known-broken jobs from system context (e.g. anything that stopped firing) surface as OVERDUE rather than hiding.

- [ ] **Step 5: Stop the dev server and commit any UI fixes**

```bash
cd /tmp/ps-scheduled-ops
git add -A
git commit -m "fix(scheduled-ops): visual polish from Playwright verification" --allow-empty
```

---

## Done criteria (Phase 1)

- `scheduled_ops_status` returns correct statuses for all six seeded cases (Task 1, Step 4).
- ~104 real n8n scheduled workflows appear in the registry with derived intervals (Task 1, Step 5).
- `npm run build` passes (Task 5, Step 3).
- The Scheduled Ops tab renders the categorized board, floats overdue/erroring to top, and the strip counts match the view, verified by screenshot (Task 6).
- Silently-stopped scheduled workflows now surface as OVERDUE instead of being invisible — the core goal.

## Deferred to Phase 2 (separate plan)
- `scheduled_run_log` table + heartbeat helper for launchd + Claude-Code jobs + committed declaration file; extend the `base` CTE in `scheduled_ops_status` to union non-n8n last-run data.
- Optional: WhatsApp alert on OVERDUE/ERRORING via existing alert path + morning-triage; forward "next 24h" list.
- Optional: per-job edit UI for `description` / `category` / `grace_minutes` (currently curated directly in the registry table).
```
