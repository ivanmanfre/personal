# Signal Clusters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A weekly n8n workflow that ingests call transcripts + inbound LinkedIn DMs + inbound Gmail, clusters them with Claude into Content-Topic and Sales-Intelligence buckets, persists to `signal_clusters`, and surfaces them in a dashboard panel.

**Architecture:** n8n (scheduled, unattended) ingests three sources → normalizes → calls the Railway Claude proxy `/v1/messages` (standalone text-gen) with a clustering prompt stored in a ClickUp page → writes clusters to a new Supabase table. A React dashboard panel reads that table and shows two tabs. Clustering quality stays high without n8n LLM-node pain because the prompt lives in ClickUp (fast iteration) and the call is a plain HTTP Request.

**Tech Stack:** n8n (n8n.ivanmanfredi.com), Supabase (project `bjbvqvzbzczjbatgmccb`), Railway Claude proxy, ClickUp v3 API, React + TypeScript + Vite + Tailwind + recharts + lucide-react (personal-site dashboard v1).

---

## Verification approach (read first)

This repo has **no unit-test runner** (no vitest/jest). Per Ivan's conventions, verification uses:
- **TypeScript:** `npx tsc --noEmit` (typecheck) and `npm run build` (vite build must pass).
- **Visual:** the `playwright-driver` skill for dashboard screenshots (Ivan's rule: visual work is self-tested with screenshots before claiming done).
- **Data/workflow:** real Supabase row checks (Supabase MCP `execute_sql`) and n8n manual executions (via UI / `n8nac`).

Do **not** introduce vitest or restructure the build. Do **not** `git push` — commit locally only; Ivan pushes to deploy when ready. Use `n8nac` for n8n, **never** the `n8n-mcp` MCP (it is pointed at a different n8n instance).

Project conventions honored: prompts live in ClickUp (never hardcoded in n8n); Railway proxy only via HTTP Request nodes (never `lmChatAnthropic`); Supabase REST writes need both `apikey` and `Authorization: Bearer`; strip ```json fences before parsing; n8n Code nodes use `this.helpers.httpRequest()`.

---

## File / artifact map

- Create: `migrations/signal_clusters_table.sql` — table + RLS
- Create (ClickUp): clustering prompt page in content prompts doc `2ky5ezad-853`
- Create (n8n): workflow "Signal Clusters — Weekly"
- Modify: `types/dashboard.ts` — add `SignalCluster` interface + `SignalBucket` type
- Create: `hooks/useSignalClusters.ts` — fetch + group clusters by run_date
- Create: `components/dashboard/SignalClustersPanel.tsx` — two-tab panel
- Modify: `components/dashboard/Dashboard.tsx` — register lazy panel + preload
- Modify: `components/dashboard/DashboardLayout.tsx` — nav item + icon import
- Update (memory): new project memory file + MEMORY.md pointer

---

## Phase 1 — Supabase table

### Task 1: Create `signal_clusters` table

**Files:**
- Create: `migrations/signal_clusters_table.sql`

- [ ] **Step 1: Write the migration SQL**

Create `migrations/signal_clusters_table.sql`:

```sql
-- Signal Clusters: weekly cross-conversation theme clusters (content + sales)
create table if not exists public.signal_clusters (
  id uuid primary key default gen_random_uuid(),
  run_date date not null,
  bucket text not null check (bucket in ('content', 'sales')),
  theme text not null,
  summary text,
  frequency int not null default 0,
  quotes jsonb not null default '[]'::jsonb,        -- [{text, source, date}]
  source_mix jsonb not null default '{}'::jsonb,    -- {calls, dms, email}
  suggested_action text,
  created_at timestamptz not null default now()
);

create index if not exists signal_clusters_run_date_idx on public.signal_clusters (run_date desc);
create index if not exists signal_clusters_bucket_idx on public.signal_clusters (bucket);

alter table public.signal_clusters enable row level security;

-- anon: read-only (dashboard reads via anon key); service_role: full (n8n writes)
drop policy if exists signal_clusters_anon_select on public.signal_clusters;
create policy signal_clusters_anon_select on public.signal_clusters
  for select to anon using (true);

drop policy if exists signal_clusters_service_all on public.signal_clusters;
create policy signal_clusters_service_all on public.signal_clusters
  for all to service_role using (true) with check (true);
```

- [ ] **Step 2: Apply the migration**

Apply via Supabase MCP `apply_migration` (name: `signal_clusters_table`, project_id `bjbvqvzbzczjbatgmccb`) with the SQL above.

- [ ] **Step 3: Verify table + RLS**

Run via Supabase MCP `execute_sql`:
```sql
select count(*) from public.signal_clusters;
select polname from pg_policies where tablename = 'signal_clusters';
```
Expected: count = 0; two policies `signal_clusters_anon_select`, `signal_clusters_service_all`.

- [ ] **Step 4: Seed one fixture row (for panel dev before workflow exists)**

Run via Supabase MCP `execute_sql`:
```sql
insert into public.signal_clusters (run_date, bucket, theme, summary, frequency, quotes, source_mix, suggested_action)
values
  (current_date, 'content', 'Unsure where AI actually fits in their ops',
   'Prospects repeatedly ask which processes are even AI-suitable before cost.', 4,
   '[{"text":"I don''t even know what parts of my business AI could touch","source":"call","date":"2026-05-20"}]'::jsonb,
   '{"calls":3,"dms":1,"email":0}'::jsonb,
   'Post: a 5-question "is this process AI-ready?" checklist.'),
  (current_date, 'sales', 'Price anchored to a freelancer, not an outcome',
   'Buyers compare the engine to a cheap contractor rather than to revenue impact.', 3,
   '[{"text":"I can get someone on Upwork for way less","source":"dm","date":"2026-05-22"}]'::jsonb,
   '{"calls":1,"dms":2,"email":0}'::jsonb,
   'Reframe to relief/outcome (see feedback-buying-relief-frame); never match freelancer price.');
```

- [ ] **Step 5: Commit**

```bash
cd "/Users/ivanmanfredi/Desktop/personal-site"
git add migrations/signal_clusters_table.sql
git commit -m "feat(signal-clusters): add signal_clusters table + RLS"
```

---

## Phase 2 — ClickUp clustering prompt page

### Task 2: Create the clustering prompt page

**Files:**
- Create (ClickUp): page in doc `2ky5ezad-853` (content prompts doc)

- [ ] **Step 1: Create the page** via ClickUp tooling (`clickup-searcher` skill or `clickup_create_document_page`) titled `Signal Clusters — Clustering Prompt` with this body:

```
You cluster qualitative customer signal into recurring themes.

INPUT: a JSON array of items, each {source: "call"|"dm"|"email", date, who, text}.

TASK: Produce two separate sets of clusters:
- content_clusters — recurring questions, pains, or topics that indicate WHAT IVAN SHOULD POST ABOUT. Capture the buyer's own words.
- sales_clusters — recurring objections, pricing pushback, hesitations, or buying signals across deals.

For EACH cluster return:
- theme: short label (<=8 words)
- summary: 1-2 sentences
- frequency: integer count of input items in this cluster
- quotes: 1-3 verbatim representative quotes, each {text, source, date}
- source_mix: {calls, dms, email} integer counts
- suggested_action: for content = a concrete post idea; for sales = an objection-handling/positioning note

RULES:
- Only cluster themes supported by >=2 items, unless a single item is strikingly high-signal (then frequency=1).
- Quotes must be verbatim from input. Never invent quotes.
- Prefer 3-7 clusters per bucket. Merge near-duplicates.
- Output STRICT JSON only. No prose, no markdown, no code fences.

OUTPUT SHAPE:
{"content_clusters":[{...}], "sales_clusters":[{...}]}
```

- [ ] **Step 2: Record the page id**

Note the returned `page_id`. It is referenced by the n8n "Fetch Prompt" node (Task 4). Save it to the memory file in Task 9.

- [ ] **Step 3: Verify readability**

Read the page back (`clickup_get_document_pages` or `clickup-searcher`) and confirm `text_content` contains the prompt. (ClickUp page content lives in `text_content`, not `content`.)

---

## Phase 3 — n8n workflow

> Build in the n8n UI on n8n.ivanmanfredi.com (use `n8nac` for node-parameter lookup). Each node's exact config/code is given below. Keep it INACTIVE until E2E (Phase 6).

### Task 3: Create workflow skeleton + source-read nodes

**Artifact:** n8n workflow "Signal Clusters — Weekly"

- [ ] **Step 1: Create workflow** named `Signal Clusters — Weekly`. Add a **Schedule Trigger**: weekly, Monday 06:00 UTC. (Avoid the busy cron slot that OOM'd trackers — see `incident-own-post-tracker-fanout-oom`.)

- [ ] **Step 2: Add "Read Transcripts" (HTTP Request → Supabase REST)**
  - Method GET, URL `https://bjbvqvzbzczjbatgmccb.supabase.co/rest/v1/transcripts?select=id,date,summary,transcript_text,participants,meeting_type&date=gte.{{ $now.minus({ days: 7 }).toFormat('yyyy-MM-dd') }}`
  - Headers: `apikey: <service_role key>`, `Authorization: Bearer <service_role key>`
  - On error: Continue (Regular Output).

- [ ] **Step 3: Add "Read Inbound DMs" (HTTP Request → Supabase REST)**
  - Method GET, URL `https://bjbvqvzbzczjbatgmccb.supabase.co/rest/v1/outreach_messages?select=sent_at,message_text,prospect_id&direction=eq.inbound&sent_at=gte.{{ $now.minus({ days: 7 }).toISO() }}`
  - Same auth headers. On error: Continue.

- [ ] **Step 4: Add "Read Inbound Email" (Gmail node)**
  - First add a **Google OAuth2 (Gmail) credential** in n8n (Settings → Credentials → Gmail OAuth2). Confirm it exists via `n8nac` or the n8n UI — do not rely on n8n-mcp.
  - Gmail node: Resource Message, Operation Get Many, Return All off / Limit 50, Filters → Received After = 7 days ago, `q`: `-from:me -category:promotions -category:social`. Simplify = true.
  - On error: Continue (so a Gmail hiccup doesn't kill the run).

- [ ] **Step 5: Verify each read** by executing the three nodes individually in the editor. Expected: transcripts returns rows (≈ recent calls), inbound DMs may be 0–few, Gmail returns recent inbox messages. Note shapes for the normalize step.

### Task 4: Normalize + fetch prompt + cluster

- [ ] **Step 1: Add "Normalize" (Code node, Run Once for All Items)**

```javascript
// Merge the three source node outputs into uniform signal items.
function clip(s, n) { return (s || '').replace(/\s+/g, ' ').trim().slice(0, n); }

const items = [];

// Transcripts: prefer summary, fall back to clipped transcript_text
for (const t of $('Read Transcripts').all().map(i => i.json)) {
  const text = t.summary || clip(t.transcript_text, 1500);
  if (!text) continue;
  items.push({ source: 'call', date: (t.date || '').slice(0, 10), who: (t.participants || 'call'), text: clip(text, 1500) });
}

// Inbound DMs
for (const m of $('Read Inbound DMs').all().map(i => i.json)) {
  if (!m.message_text) continue;
  items.push({ source: 'dm', date: (m.sent_at || '').slice(0, 10), who: String(m.prospect_id || 'prospect'), text: clip(m.message_text, 800) });
}

// Inbound Email: strip quoted replies + signatures (cut at first quote marker)
for (const e of $('Read Inbound Email').all().map(i => i.json)) {
  const raw = e.text || e.snippet || '';
  const body = raw.split(/\n>|On .* wrote:|-----Original Message-----/)[0];
  if (!body || !body.trim()) continue;
  items.push({ source: 'email', date: clip(e.date, 10), who: clip(e.from || e.From || 'email', 80), text: clip(body, 1000) });
}

return [{ json: { items, count: items.length } }];
```

- [ ] **Step 2: Run Normalize and verify** the output is a single item with `items: [...]` and a sane `count`. If `count === 0`, the workflow should still complete cleanly (no write) — handled in Task 5 Step 3.

- [ ] **Step 3: Add "Fetch Prompt" (HTTP Request → ClickUp v3)**
  - Method GET, URL `https://api.clickup.com/api/v3/workspaces/90132938061/docs/2ky5ezad-853/pages/<PAGE_ID_FROM_TASK_2>`
  - Header: `Authorization: <ClickUp API key>`
  - The prompt text is in the response `text_content` field.

- [ ] **Step 4: Add "Cluster" (HTTP Request → Railway proxy)**
  - Method POST, URL `https://claude-code-railway-production.up.railway.app/v1/messages`
  - Headers: `x-api-key: <Railway proxy key>`, `anthropic-version: 2023-06-01`, `content-type: application/json`
  - Body (JSON, expression-enabled):
```
{
  "model": "claude-opus-4-8",
  "max_tokens": 4000,
  "system": {{ JSON.stringify($('Fetch Prompt').first().json.text_content) }},
  "messages": [
    { "role": "user", "content": {{ JSON.stringify(JSON.stringify($('Normalize').first().json.items)) }} }
  ]
}
```
  - On error: Stop (don't write partial output). This is standalone text-gen via the proxy — the documented-safe pattern (NOT an `lmChatAnthropic` agent node).

- [ ] **Step 5: Verify the Cluster node** returns a `content[0].text` containing JSON with `content_clusters` and `sales_clusters`. Inspect raw output for fences.

### Task 5: Parse + write to Supabase

- [ ] **Step 1: Add "Parse Clusters" (Code node, Run Once for All Items)**

```javascript
const raw = $('Cluster').first().json.content?.[0]?.text || $('Cluster').first().json.text || '';
const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

let parsed;
try { parsed = JSON.parse(cleaned); }
catch (e) { throw new Error('Cluster output not valid JSON: ' + cleaned.slice(0, 300)); }

const runDate = $now.toFormat('yyyy-MM-dd');
const rows = [];
for (const c of (parsed.content_clusters || [])) rows.push({ bucket: 'content', ...c });
for (const c of (parsed.sales_clusters || [])) rows.push({ bucket: 'sales', ...c });

return rows.map(c => ({ json: {
  run_date: runDate,
  bucket: c.bucket,
  theme: c.theme || 'Untitled',
  summary: c.summary || null,
  frequency: c.frequency || 0,
  quotes: c.quotes || [],
  source_mix: c.source_mix || {},
  suggested_action: c.suggested_action || null,
}}));
```

- [ ] **Step 2: Add "Delete Prior Run" (HTTP Request → Supabase REST)** — keeps re-runs idempotent.
  - Method DELETE, URL `https://bjbvqvzbzczjbatgmccb.supabase.co/rest/v1/signal_clusters?run_date=eq.{{ $now.toFormat('yyyy-MM-dd') }}`
  - Headers: both `apikey` and `Authorization: Bearer` (service_role), plus `Prefer: return=minimal`.

- [ ] **Step 3: Add "Write Clusters" (HTTP Request → Supabase REST)**
  - Method POST, URL `https://bjbvqvzbzczjbatgmccb.supabase.co/rest/v1/signal_clusters`
  - Headers: both `apikey` and `Authorization: Bearer` (service_role), `Content-Type: application/json`, `Prefer: return=minimal`
  - Body: send the items array from "Parse Clusters" (Send Body = JSON, use `={{ $json }}` per item, or batch). Wire so it only runs when Parse produced ≥1 row (if Normalize `count===0`, short-circuit before Cluster using an IF node: `{{ $('Normalize').first().json.count }}` > 0).

- [ ] **Step 4: Commit a workflow export** for version control:
```bash
cd "/Users/ivanmanfredi/Desktop/personal-site"
# Export the workflow JSON via n8n UI (Download) into n8n-workflows/, then:
git add n8n-workflows/signal-clusters-weekly.json
git commit -m "feat(signal-clusters): add weekly n8n clustering workflow export"
```

---

## Phase 4 — Dashboard types + hook

### Task 6: Add types + data hook

**Files:**
- Modify: `types/dashboard.ts`
- Create: `hooks/useSignalClusters.ts`

- [ ] **Step 1: Add types** to `types/dashboard.ts` (near the AutoResearch interfaces, ~line 603):

```typescript
export type SignalBucket = 'content' | 'sales';

export interface SignalQuote {
  text: string;
  source: 'call' | 'dm' | 'email';
  date: string;
}

export interface SignalCluster {
  id: string;
  runDate: string;
  bucket: SignalBucket;
  theme: string;
  summary: string | null;
  frequency: number;
  quotes: SignalQuote[];
  sourceMix: { calls?: number; dms?: number; email?: number };
  suggestedAction: string | null;
  createdAt: string;
}
```

- [ ] **Step 2: Create the hook** `hooks/useSignalClusters.ts` (mirrors `useAutoResearch.ts` patterns):

```typescript
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { toastError } from '../lib/dashboardActions';
import type { SignalCluster } from '../types/dashboard';

function mapCluster(row: any): SignalCluster {
  return {
    id: row.id,
    runDate: row.run_date,
    bucket: row.bucket,
    theme: row.theme,
    summary: row.summary,
    frequency: row.frequency || 0,
    quotes: Array.isArray(row.quotes) ? row.quotes : [],
    sourceMix: row.source_mix || {},
    suggestedAction: row.suggested_action,
    createdAt: row.created_at,
  };
}

export function useSignalClusters() {
  const [clusters, setClusters] = useState<SignalCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRunDate, setSelectedRunDate] = useState<string | null>(null);
  const hasFetched = useRef(false);

  const fetchClusters = useCallback(async () => {
    if (!hasFetched.current) setLoading(true);
    try {
      const { data } = await supabase
        .from('signal_clusters')
        .select('*')
        .order('run_date', { ascending: false })
        .order('frequency', { ascending: false });
      setClusters((data || []).map(mapCluster));
    } catch (err) {
      toastError('load signal clusters', err);
    } finally {
      setLoading(false);
      hasFetched.current = true;
    }
  }, []);

  useEffect(() => { fetchClusters(); }, [fetchClusters]);

  const runDates = useMemo(
    () => Array.from(new Set(clusters.map((c) => c.runDate))),
    [clusters]
  );

  // Default to the latest run once data arrives
  useEffect(() => {
    if (!selectedRunDate && runDates.length > 0) setSelectedRunDate(runDates[0]);
  }, [runDates, selectedRunDate]);

  const visible = useMemo(
    () => clusters.filter((c) => !selectedRunDate || c.runDate === selectedRunDate),
    [clusters, selectedRunDate]
  );

  const contentClusters = useMemo(() => visible.filter((c) => c.bucket === 'content'), [visible]);
  const salesClusters = useMemo(() => visible.filter((c) => c.bucket === 'sales'), [visible]);

  return {
    loading,
    refresh: fetchClusters,
    runDates,
    selectedRunDate,
    setSelectedRunDate,
    contentClusters,
    salesClusters,
    totalThisRun: visible.length,
  };
}
```

- [ ] **Step 3: Typecheck**

Run: `cd "/Users/ivanmanfredi/Desktop/personal-site" && npx tsc --noEmit`
Expected: no new errors referencing `useSignalClusters.ts` or `types/dashboard.ts`.

- [ ] **Step 4: Commit**

```bash
git add types/dashboard.ts hooks/useSignalClusters.ts
git commit -m "feat(signal-clusters): add SignalCluster types + data hook"
```

---

## Phase 5 — Dashboard panel + nav

### Task 7: Build `SignalClustersPanel.tsx`

**Files:**
- Create: `components/dashboard/SignalClustersPanel.tsx`

- [ ] **Step 1: Write the panel** `components/dashboard/SignalClustersPanel.tsx` (uses the shared components AutoResearchPanel uses: StatCard, PanelCard, LoadingSkeleton, RefreshIndicator, EmptyState):

```tsx
import React, { useState } from 'react';
import { MessagesSquare, Lightbulb, Handshake, Phone, Send, Mail, RefreshCw } from 'lucide-react';
import { useSignalClusters } from '../../hooks/useSignalClusters';
import StatCard from './shared/StatCard';
import PanelCard from './shared/PanelCard';
import LoadingSkeleton from './shared/LoadingSkeleton';
import EmptyState from './shared/EmptyState';
import type { SignalCluster } from '../../types/dashboard';

const SOURCE_ICON: Record<string, React.ReactNode> = {
  call: <Phone className="w-3 h-3" />,
  dm: <Send className="w-3 h-3" />,
  email: <Mail className="w-3 h-3" />,
};

const ClusterCard: React.FC<{ cluster: SignalCluster; accent: string }> = ({ cluster, accent }) => {
  const [open, setOpen] = useState(false);
  const mix = cluster.sourceMix || {};
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-sm font-semibold text-zinc-100">{cluster.theme}</h4>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${accent}`}>
          {cluster.frequency}×
        </span>
      </div>
      {cluster.summary && <p className="mt-1 text-xs text-zinc-400">{cluster.summary}</p>}
      <div className="mt-2 flex items-center gap-3 text-[11px] text-zinc-500">
        {(['call', 'dm', 'email'] as const).map((s) => {
          const key = s === 'call' ? 'calls' : s === 'dm' ? 'dms' : 'email';
          const n = (mix as any)[key] || 0;
          return n > 0 ? (
            <span key={s} className="flex items-center gap-1">{SOURCE_ICON[s]}{n}</span>
          ) : null;
        })}
      </div>
      {cluster.suggestedAction && (
        <div className="mt-3 rounded-lg bg-zinc-800/40 px-3 py-2 text-xs text-zinc-300">
          <span className="font-medium text-zinc-200">Action: </span>{cluster.suggestedAction}
        </div>
      )}
      {cluster.quotes.length > 0 && (
        <button onClick={() => setOpen((v) => !v)} className="mt-2 text-[11px] text-zinc-500 hover:text-zinc-300">
          {open ? 'Hide' : `Show ${cluster.quotes.length} quote${cluster.quotes.length > 1 ? 's' : ''}`}
        </button>
      )}
      {open && (
        <ul className="mt-2 space-y-2">
          {cluster.quotes.map((q, i) => (
            <li key={i} className="border-l-2 border-zinc-700 pl-3 text-xs italic text-zinc-400">
              “{q.text}”
              <span className="ml-2 not-italic text-[10px] text-zinc-600">— {q.source}, {q.date}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const SignalClustersPanel: React.FC = () => {
  const {
    loading, refresh, runDates, selectedRunDate, setSelectedRunDate,
    contentClusters, salesClusters, totalThisRun,
  } = useSignalClusters();
  const [tab, setTab] = useState<'content' | 'sales'>('content');

  if (loading) return <LoadingSkeleton />;

  const active = tab === 'content' ? contentClusters : salesClusters;
  const accent = tab === 'content' ? 'bg-violet-500/10 text-violet-300' : 'bg-cyan-500/10 text-cyan-300';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Content Topics" value={contentClusters.length} icon={<Lightbulb className="w-5 h-5" />} color="text-violet-400" />
        <StatCard label="Sales Signals" value={salesClusters.length} icon={<Handshake className="w-5 h-5" />} color="text-cyan-400" />
        <StatCard label="Clusters This Run" value={totalThisRun} icon={<MessagesSquare className="w-5 h-5" />} color="text-zinc-300" />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-zinc-900/60 p-1">
          <button onClick={() => setTab('content')} className={`rounded-md px-3 py-1.5 text-xs font-medium ${tab === 'content' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400'}`}>Content Topics</button>
          <button onClick={() => setTab('sales')} className={`rounded-md px-3 py-1.5 text-xs font-medium ${tab === 'sales' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400'}`}>Sales Intelligence</button>
        </div>
        <div className="flex items-center gap-2">
          {runDates.length > 0 && (
            <select
              value={selectedRunDate || ''}
              onChange={(e) => setSelectedRunDate(e.target.value)}
              className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-300"
            >
              {runDates.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
          <button onClick={refresh} className="rounded-md border border-zinc-800 p-1.5 text-zinc-400 hover:text-zinc-200"><RefreshCw className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      <PanelCard title={tab === 'content' ? 'Content Topics' : 'Sales Intelligence'} icon={<MessagesSquare className="w-4 h-4" />} badge={active.length} accent={tab === 'content' ? 'violet' : 'cyan'}>
        {active.length === 0 ? (
          <EmptyState title="No clusters yet" description="Clusters appear after the weekly Signal Clusters workflow runs." icon={<MessagesSquare className="w-10 h-10" />} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {active.map((c) => <ClusterCard key={c.id} cluster={c} accent={accent} />)}
          </div>
        )}
      </PanelCard>
    </div>
  );
};

export default SignalClustersPanel;
```

- [ ] **Step 2: Verify `PanelCard` accepts `accent="violet"|"cyan"`** by reading `components/dashboard/shared/PanelCard.tsx`. If those accent values are not supported, use an accent the component supports (AutoResearchPanel uses `"emerald"`) and adjust. Fix inline if needed.

- [ ] **Step 3: Typecheck + build**

Run: `cd "/Users/ivanmanfredi/Desktop/personal-site" && npx tsc --noEmit && npm run build`
Expected: build succeeds, no errors referencing `SignalClustersPanel.tsx`.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/SignalClustersPanel.tsx
git commit -m "feat(signal-clusters): add dashboard panel"
```

### Task 8: Register panel in nav

**Files:**
- Modify: `components/dashboard/Dashboard.tsx`
- Modify: `components/dashboard/DashboardLayout.tsx`

- [ ] **Step 1: Register lazy panel** in `components/dashboard/Dashboard.tsx`. Near the other `lazy(retryImport(...))` declarations (~line 60):

```tsx
const LazySignalClustersPanel = lazy(retryImport(() => import('./SignalClustersPanel')));
```
Add to the panel-id map (~line 89, alongside `'auto-research': ...`):
```tsx
  'signal-clusters': LazySignalClustersPanel as unknown as React.ComponentType,
```
Add to the preload list (~line 124, alongside the other `retryImport(() => import('./AutoResearchPanel'))`):
```tsx
  retryImport(() => import('./SignalClustersPanel')),
```

- [ ] **Step 2: Add the nav item** in `components/dashboard/DashboardLayout.tsx`. Add `MessagesSquare` to the lucide-react import (line 2), then add a nav entry near the `auto-research` item (~line 50):
```tsx
      { id: 'signal-clusters', label: 'Signal Clusters', icon: <MessagesSquare className="w-[18px] h-[18px]" /> },
```

- [ ] **Step 3: Typecheck + build**

Run: `cd "/Users/ivanmanfredi/Desktop/personal-site" && npx tsc --noEmit && npm run build`
Expected: success.

- [ ] **Step 4: Visual verification (Ivan's rule: self-test visual work)**

Use the `playwright-driver` skill (inspect mode) against the local dev server (`npm run dev`), navigate to the dashboard, click the "Signal Clusters" nav item. Confirm: nav item renders with icon; both tabs switch; the two seeded fixture clusters (Task 1 Step 4) render with frequency badge, source-mix icons, action callout, and expandable quotes; run-date selector shows today. Capture screenshots of both tabs. Iterate until it looks polished (not just functional).

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/Dashboard.tsx components/dashboard/DashboardLayout.tsx
git commit -m "feat(signal-clusters): register panel in dashboard nav"
```

---

## Phase 6 — E2E + memory

### Task 9: End-to-end run + document

- [ ] **Step 1: Delete the fixture rows**

Run via Supabase MCP `execute_sql`:
```sql
delete from public.signal_clusters where suggested_action like 'Post: a 5-question%' or suggested_action like 'Reframe to relief%';
```

- [ ] **Step 2: Manually execute the n8n workflow** (Execute Workflow in the editor, still INACTIVE). Watch each node. Expected: reads return data, Normalize count > 0, Cluster returns JSON, Parse produces rows, Write succeeds.

- [ ] **Step 3: Verify rows landed**

Run via Supabase MCP `execute_sql`:
```sql
select run_date, bucket, theme, frequency, jsonb_array_length(quotes) q
from public.signal_clusters order by run_date desc, bucket, frequency desc;
```
Expected: real clusters for today, both buckets present, quotes non-empty.

- [ ] **Step 4: Eyeball cluster quality** against the panel (refresh). If themes are weak/duplicated, iterate the **ClickUp prompt page** only (no n8n change) and re-run Step 2. This is the iteration loop the architecture was designed for.

- [ ] **Step 5: Activate the workflow** (toggle Active) once a run looks good.

- [ ] **Step 6: Write project memory**

Create `/Users/ivanmanfredi/.claude/projects/-Users-ivanmanfredi-Desktop-Ivan---Content-System/memory/signal-clusters.md`:

```markdown
---
name: signal-clusters
description: Weekly cross-conversation clustering of calls + inbound DMs + Gmail into content topics + sales intelligence; dashboard panel
metadata:
  type: project
---

Signal Clusters (built 2026-05-31, from Dan Carey/Anthropic Labs "cross-conversation analysis" idea).

**What:** n8n workflow "Signal Clusters — Weekly" (Mon 06:00 UTC) ingests `transcripts` + inbound `outreach_messages` + inbound Gmail → normalizes → Railway proxy `/v1/messages` with clustering prompt (ClickUp page `2ky5ezad-853` page id <PAGE_ID>) → writes `signal_clusters` table. Dashboard panel `SignalClustersPanel.tsx` (nav id `signal-clusters`) shows two tabs: Content Topics / Sales Intelligence.

**Iterate clustering quality:** edit the ClickUp prompt page only — no n8n change.
**Sources caveat:** inbound DM volume is thin (~15 rows); email is likely the richest source. Comments deliberately excluded (no signal). Assessment intakes excluded from v1 (forms, not conversations) — trivial to add as a 4th read node.
**Auto-research stays dormant** — its blocker is engagement variance (median 0 likes), a distribution problem, not data volume or model quality. See [[auto-research]].
```

Then add to `MEMORY.md` project topic files list:
```
- signal-clusters.md — weekly cross-conversation clustering (calls+DMs+email) → content topics + sales intel + dashboard panel
```

- [ ] **Step 7: Final commit**

```bash
cd "/Users/ivanmanfredi/Desktop/personal-site"
git add docs/superpowers/plans/2026-05-31-signal-clusters.md
git commit -m "docs(signal-clusters): implementation plan"
```
(Memory files live outside the repo — no commit needed for those.)

---

## Self-review notes

- **Spec coverage:** table (Task 1), ClickUp prompt (Task 2), n8n ingest+cluster+write (Tasks 3–5), panel + nav (Tasks 6–8), E2E + memory (Task 9). All spec sections mapped.
- **Type consistency:** `SignalCluster`/`SignalQuote` defined in Task 6 and consumed verbatim in Tasks 6–7. `source_mix` keys are `calls`/`dms`/`email` consistently across SQL (Task 1), n8n Normalize (Task 4), and panel mapping (Task 7).
- **Known soft spots flagged inline:** PanelCard accent values (Task 7 Step 2 verifies before relying), Gmail node output field names (`text`/`snippet`/`from` — Normalize defensively handles all), `<PAGE_ID>` placeholder is intentional (created at runtime in Task 2, recorded in Task 9).
