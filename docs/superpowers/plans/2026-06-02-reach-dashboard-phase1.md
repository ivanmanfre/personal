# Reach Dashboard Phase 1 — Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the 1638-line `OutreachPanel` monolith into four focused inner tabs (Pipeline · Review · Inbox · Health), fix the routing/nav/noise/warming defects, and surface per-campaign performance + link-clicks — with no change to any data-write path.

**Architecture:** `OutreachPanel` becomes a thin shell that owns the existing `useOutreachPipeline` hook + all filter/selection state, renders a `SubTabs` bar, and passes data + handlers as props into four presentational tab components. The hook stays the single data source (no new fetch fan-out). New pure helpers (`filterSystemEvents`, `campaignPerformance`) are unit-tested; presentational extraction is verified by render smoke tests + self-tested screenshots.

**Tech Stack:** React 18 + TypeScript + Vite, Tailwind, lucide-react, Vitest + React Testing Library, existing `components/dashboard-v2/primitives` (`SubTabs`, `SubTab`, `ErrBanner`).

---

## File structure

**Create:**
- `components/dashboard/outreach/tabs/PipelineTab.tsx` — stats (warming removed), funnel, filters, bulk bar, prospect table, per-campaign performance, link-clicks column
- `components/dashboard/outreach/tabs/ReviewTab.tsx` — pending drafts, commenting cohort, proposed targets, comment drafts
- `components/dashboard/outreach/tabs/HealthTab.tsx` — system/auto-send toggles, today's activity, pending-invite gauge, workflow health, rate limits, recent activity feed
- `components/dashboard/outreach/tabs/InboxTab.tsx` — Phase-3 stub (action-needed/needs-reply list + "full inbox coming" notice)
- `components/dashboard/outreach/CampaignPerformance.tsx` — per-campaign connected/replied table
- `components/dashboard/outreach/PendingInviteGauge.tsx` — pending count vs ceiling gauge
- `components/dashboard/outreach/ActivityFeed.tsx` — recent activity list with system-event filter toggle
- `components/dashboard/outreach/outreachHelpers.ts` — `filterSystemEvents`, `campaignPerformance`, `SYSTEM_ACTION_TYPES`
- `components/dashboard/shared/PanelErrorBoundary.tsx` — error boundary wrapper
- `components/dashboard/outreach/__tests__/outreachHelpers.test.ts`
- `components/dashboard/outreach/__tests__/PipelineTab.test.tsx`
- `components/dashboard-v2/sections/__tests__/ReachPipeline.routing.test.ts`

**Modify:**
- `components/dashboard/OutreachPanel.tsx` — reduce to shell + inner-tab router
- `components/dashboard-v2/sections/ReachPipeline.tsx:30-45,68-71` — routing fallback + nav dedup

---

## Pre-flight

- [ ] **Step 0: Confirm test runner**

Run: `cd /Users/ivanmanfredi/Desktop/personal-site && cat package.json | grep -A3 '"scripts"' && ls vitest.config.* 2>/dev/null; ls node_modules/.bin/vitest 2>/dev/null`
Expected: a `test` script and a vitest binary. If vitest is absent, note the actual runner (jest) and translate commands. If no runner exists, add vitest+@testing-library/react as a devDependency task before Task 1 and create `vitest.config.ts` with `environment: 'jsdom'`.

---

## Task 1: Routing fallback + nav dedup (ReachPipeline)

**Files:**
- Modify: `components/dashboard-v2/sections/ReachPipeline.tsx`
- Create: `components/dashboard-v2/sections/__tests__/ReachPipeline.routing.test.ts`

- [ ] **Step 1: Extract a pure `resolveSub` and write the failing test**

Add an exported pure function so the fallback is testable without a DOM. In `ReachPipeline.tsx`, replace `getInitialSub` internals with a call to a new exported helper:

```typescript
export function resolveSub(raw: string | null): { sub: SubKey; corrected: boolean } {
  if (raw && (SUB_ORDER as string[]).includes(raw)) return { sub: raw as SubKey, corrected: false };
  return { sub: 'outreach', corrected: raw != null }; // corrected=true means URL had a bad value
}
```

Test file:

```typescript
import { describe, it, expect } from 'vitest';
import { resolveSub } from '../ReachPipeline';

describe('resolveSub', () => {
  it('keeps a valid sub', () => {
    expect(resolveSub('leads')).toEqual({ sub: 'leads', corrected: false });
  });
  it('falls back to outreach for an invalid sub and flags correction', () => {
    expect(resolveSub('posts')).toEqual({ sub: 'outreach', corrected: true });
  });
  it('defaults to outreach with no correction when absent', () => {
    expect(resolveSub(null)).toEqual({ sub: 'outreach', corrected: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node_modules/.bin/vitest run components/dashboard-v2/sections/__tests__/ReachPipeline.routing.test.ts`
Expected: FAIL — `resolveSub` not exported.

- [ ] **Step 3: Implement `resolveSub` + rewrite URL on correction + drop duplicate nav**

In `ReachPipeline.tsx`:
1. Add the `resolveSub` export above.
2. Change `getInitialSub` to use it:

```typescript
function getInitialSub(): SubKey {
  if (typeof window === 'undefined') return 'outreach';
  const { sub, corrected } = resolveSub(new URLSearchParams(window.location.search).get('sub'));
  if (corrected) syncSubToUrl(sub); // rewrite stale ?sub=posts to ?sub=outreach
  return sub;
}
```

3. Remove the redundant text-link `meta` (it duplicates the SubTabs). Replace the `HeadRow` meta with a non-redundant live count, or drop it:

```tsx
<HeadRow title={<>Reach <em>&amp; Pipeline</em></>} />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node_modules/.bin/vitest run components/dashboard-v2/sections/__tests__/ReachPipeline.routing.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck + commit**

Run: `node_modules/.bin/tsc --noEmit && git add -A && git commit -m "fix(reach): rewrite stale sub param + drop duplicate nav"`
Expected: tsc clean, commit created.

---

## Task 2: Outreach helpers — system-event filter + campaign performance

**Files:**
- Create: `components/dashboard/outreach/outreachHelpers.ts`
- Create: `components/dashboard/outreach/__tests__/outreachHelpers.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { filterSystemEvents, campaignPerformance, SYSTEM_ACTION_TYPES } from '../outreachHelpers';

const evt = (actionType: string, id = Math.random().toString()) => ({ id, actionType, prospectId: null, createdAt: '2026-06-02T00:00:00Z', success: true });

describe('filterSystemEvents', () => {
  it('drops auto_replenish and rotation_swap by default', () => {
    const out = filterSystemEvents([evt('auto_replenish'), evt('dm_sent'), evt('rotation_swap'), evt('connection_request')]);
    expect(out.map(e => e.actionType)).toEqual(['dm_sent', 'connection_request']);
  });
  it('keeps everything when includeSystem=true', () => {
    const all = [evt('auto_replenish'), evt('dm_sent')];
    expect(filterSystemEvents(all, true)).toHaveLength(2);
  });
  it('SYSTEM_ACTION_TYPES includes the known noise types', () => {
    expect(SYSTEM_ACTION_TYPES).toContain('auto_replenish');
    expect(SYSTEM_ACTION_TYPES).toContain('rotation_swap');
  });
});

describe('campaignPerformance', () => {
  it('aggregates connected/replied/sent per campaign', () => {
    const prospects = [
      { campaignId: 'c1', campaignName: 'A', stage: 'connection_sent' },
      { campaignId: 'c1', campaignName: 'A', stage: 'replied' },
      { campaignId: 'c1', campaignName: 'A', stage: 'dm_sent' },
      { campaignId: 'c2', campaignName: 'B', stage: 'archived' },
    ] as any;
    const rows = campaignPerformance(prospects);
    const a = rows.find(r => r.campaignId === 'c1')!;
    expect(a.sent).toBe(3); // connection_sent + replied + dm_sent all had an invite sent
    expect(a.replied).toBe(1);
    expect(a.name).toBe('A');
  });
  it('sorts by sent desc', () => {
    const rows = campaignPerformance([
      { campaignId: 'c1', campaignName: 'A', stage: 'connection_sent' },
      { campaignId: 'c2', campaignName: 'B', stage: 'connection_sent' },
      { campaignId: 'c2', campaignName: 'B', stage: 'replied' },
    ] as any);
    expect(rows[0].campaignId).toBe('c2');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node_modules/.bin/vitest run components/dashboard/outreach/__tests__/outreachHelpers.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement helpers**

```typescript
import type { OutreachEngagementLog, OutreachProspect } from '../../../types/dashboard';

// Housekeeping events that drown out meaningful prospect actions in the feed.
export const SYSTEM_ACTION_TYPES = ['auto_replenish', 'rotation_swap', 'stage_reconcile_connected'] as const;

export function filterSystemEvents<T extends { actionType: string }>(events: T[], includeSystem = false): T[] {
  if (includeSystem) return events;
  return events.filter((e) => !(SYSTEM_ACTION_TYPES as readonly string[]).includes(e.actionType));
}

export interface CampaignPerfRow {
  campaignId: string;
  name: string;
  sent: number;       // an invite went out (connection_sent and everything past it)
  connected: number;  // connected and beyond
  replied: number;
  replyRate: number;  // replied / sent, 0 when sent === 0
}

const SENT_STAGES = new Set(['connection_sent', 'connected', 'dm_sent', 'replied', 'converted']);
const CONNECTED_STAGES = new Set(['connected', 'dm_sent', 'replied', 'converted']);
const REPLIED_STAGES = new Set(['replied', 'converted']);

export function campaignPerformance(prospects: Pick<OutreachProspect, 'campaignId' | 'campaignName' | 'stage'>[]): CampaignPerfRow[] {
  const map = new Map<string, CampaignPerfRow>();
  for (const p of prospects) {
    if (!p.campaignId) continue;
    const row = map.get(p.campaignId) ?? { campaignId: p.campaignId, name: p.campaignName || 'Unknown', sent: 0, connected: 0, replied: 0, replyRate: 0 };
    if (SENT_STAGES.has(p.stage)) row.sent++;
    if (CONNECTED_STAGES.has(p.stage)) row.connected++;
    if (REPLIED_STAGES.has(p.stage)) row.replied++;
    map.set(p.campaignId, row);
  }
  const rows = [...map.values()];
  for (const r of rows) r.replyRate = r.sent > 0 ? Math.round((r.replied / r.sent) * 1000) / 10 : 0;
  return rows.sort((a, b) => b.sent - a.sent);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node_modules/.bin/vitest run components/dashboard/outreach/__tests__/outreachHelpers.test.ts`
Expected: PASS (5 tests). If `OutreachEngagementLog`/`OutreachProspect` field names differ, align imports with `types/dashboard.ts` before re-running.

- [ ] **Step 5: Commit**

Run: `git add -A && git commit -m "feat(reach): outreach helpers — system-event filter + campaign performance"`

---

## Task 3: PanelErrorBoundary

**Files:**
- Create: `components/dashboard/shared/PanelErrorBoundary.tsx`

- [ ] **Step 1: Implement (class component — error boundaries require classes)**

```tsx
import React from 'react';

interface Props { children: React.ReactNode; label?: string; }
interface State { hasError: boolean; message?: string; }

export class PanelErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(err: unknown): State {
    return { hasError: true, message: err instanceof Error ? err.message : String(err) };
  }
  componentDidCatch(err: unknown) { console.error('[PanelErrorBoundary]', this.props.label, err); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-xs text-red-300">
          This panel hit an error{this.props.label ? ` (${this.props.label})` : ''}: {this.state.message}
        </div>
      );
    }
    return this.props.children;
  }
}
export default PanelErrorBoundary;
```

- [ ] **Step 2: Typecheck + commit**

Run: `node_modules/.bin/tsc --noEmit && git add -A && git commit -m "feat(reach): PanelErrorBoundary"`

---

## Task 4: Inner-tab shell in OutreachPanel

**Files:**
- Modify: `components/dashboard/OutreachPanel.tsx`

The shell keeps ALL existing hook + state wiring (lines 61-172 today). It renders a `SubTabs` bar with `pipeline | review | inbox | health`, persists the active inner tab to `?tab=`, and renders the matching tab component (created in Tasks 5-8) wrapped in `PanelErrorBoundary`. Until those tab components exist, render placeholders so the app keeps compiling.

- [ ] **Step 1: Add inner-tab state + bar (placeholders for now)**

After the existing state declarations, add:

```tsx
type OutreachTab = 'pipeline' | 'review' | 'inbox' | 'health';
const TAB_ORDER: OutreachTab[] = ['pipeline', 'review', 'inbox', 'health'];
const TAB_LABELS: Record<OutreachTab, string> = { pipeline: 'Pipeline', review: 'Review', inbox: 'Inbox', health: 'Health' };
function readTab(): OutreachTab {
  if (typeof window === 'undefined') return 'pipeline';
  const t = new URLSearchParams(window.location.search).get('tab') as OutreachTab | null;
  return t && TAB_ORDER.includes(t) ? t : 'pipeline';
}
const [tab, setTab] = useState<OutreachTab>(readTab);
const changeTab = (t: OutreachTab) => {
  setTab(t);
  const url = new URL(window.location.href); url.searchParams.set('tab', t); window.history.replaceState(null, '', url.toString());
};
```

Compute review-queue badge count for the tab bar:

```tsx
const reviewCount = pendingDrafts.length + proposedTargets.length + commentDrafts.length;
```

- [ ] **Step 2: Replace the single returned scroll with the tab bar + router**

Keep the loading guard. Replace the top of the returned JSX (the `<div className="space-y-4">` wrapper) so the header + SubTabs render above the active tab. Use the `SubTabs`/`SubTab` primitives:

```tsx
import { SubTabs, SubTab } from '../dashboard-v2/primitives';
import PanelErrorBoundary from './shared/PanelErrorBoundary';
// ...
return (
  <div className="space-y-4">
    <div className="flex items-center justify-between flex-wrap gap-2">
      <h1 className="text-2xl font-bold tracking-tight">ICP Outreach</h1>
      <div className="flex items-center gap-3">
        <button onClick={() => toggleFeatureFlag('outreach_enabled')} /* unchanged classes */>
          System: {featureFlags.outreach_enabled ? 'ON' : 'OFF'}
        </button>
        <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
      </div>
    </div>
    <SubTabs>
      {TAB_ORDER.map((t) => (
        <SubTab key={t} id={t} active={tab} onChange={(id) => changeTab(id as OutreachTab)} badge={t === 'review' && reviewCount > 0 ? reviewCount : undefined}>
          {TAB_LABELS[t]}
        </SubTab>
      ))}
    </SubTabs>
    <PanelErrorBoundary label={tab}>
      {tab === 'pipeline' && <div>pipeline placeholder</div>}
      {tab === 'review' && <div>review placeholder</div>}
      {tab === 'inbox' && <div>inbox placeholder</div>}
      {tab === 'health' && <div>health placeholder</div>}
    </PanelErrorBoundary>
    {selectedProspect && (
      <ProspectDetailModal /* unchanged props as today */ />
    )}
    {showCampaigns && <CampaignManager /* unchanged props */ />}
  </div>
);
```

Note: the `ProspectDetailModal` and `CampaignManager` render blocks at the bottom of the current file stay at the shell level (they are cross-tab modals). Verify their exact props against the current file (around lines 1310-1638) and preserve them verbatim.

- [ ] **Step 3: Typecheck + run app smoke**

Run: `node_modules/.bin/tsc --noEmit`
Expected: clean. The four placeholders render; modals still wired. Commit:
`git add -A && git commit -m "refactor(reach): inner-tab shell with error boundary (placeholders)"`

---

## Task 5: HealthTab (move first — it owns the toggles/banners/activity)

**Files:**
- Create: `components/dashboard/outreach/tabs/HealthTab.tsx`
- Create: `components/dashboard/outreach/PendingInviteGauge.tsx`
- Create: `components/dashboard/outreach/ActivityFeed.tsx`
- Modify: `components/dashboard/OutreachPanel.tsx`

- [ ] **Step 1: Build `ActivityFeed`** — move the Recent Activity block (current lines 399-446) into a component that takes `events`, `prospects`, and owns an `includeSystem` toggle via `filterSystemEvents`:

```tsx
import React, { useState } from 'react';
import { Clock } from 'lucide-react';
import { filterSystemEvents } from './outreachHelpers';
import type { OutreachEngagementLog, OutreachProspect } from '../../types/dashboard';

const actionTypeIcons: Record<string, string> = {
  profile_view: 'Viewed profile', like: 'Liked post', react: 'Reacted to post',
  connection_request: 'Connection sent', dm: 'DM sent', dm_sent: 'DM sent',
  invite_withdrawn: 'Invite withdrawn',
};

export function ActivityFeed({ events, prospects }: { events: OutreachEngagementLog[]; prospects: OutreachProspect[] }) {
  const [expanded, setExpanded] = useState(false);
  const [includeSystem, setIncludeSystem] = useState(false);
  const visible = filterSystemEvents(events, includeSystem);
  // ...render header (Clock + "Recent Activity" + count), a "show system events" checkbox,
  // then the same row markup as the current lines 418-443 mapped over `visible`.
  // Reuse the time/anchor/prospect-name rendering verbatim from the original block.
  return (/* see original 399-446 for exact row markup */ null as any);
}
export default ActivityFeed;
```

Implementation note: copy the exact inner row JSX from current `OutreachPanel.tsx:418-443` so behavior (links, error styling) is preserved; only the data source becomes `visible` and the header gains the `includeSystem` checkbox.

- [ ] **Step 2: Build `PendingInviteGauge`** — pure-ish display of pending count vs ceiling:

```tsx
import React from 'react';

export function PendingInviteGauge({ pending, ceiling, oldestPendingDays }: { pending: number; ceiling: number; oldestPendingDays?: number | null }) {
  const pct = Math.min((pending / ceiling) * 100, 100);
  const danger = pct >= 90, warn = pct >= 70;
  const bar = danger ? 'bg-red-500' : warn ? 'bg-amber-500' : 'bg-emerald-500';
  const txt = danger ? 'text-red-400' : warn ? 'text-amber-400' : 'text-zinc-300';
  return (
    <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-4">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-zinc-200">Pending invites</span>
        <span className={`text-sm font-mono font-semibold ${txt}`}>{pending}<span className="text-zinc-600">/{ceiling}</span></span>
      </div>
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden"><div className={`h-full rounded-full ${bar} transition-all`} style={{ width: `${pct}%` }} /></div>
      {danger && <p className="text-[10px] text-red-400 mt-1">Near LinkedIn's pending-invite ceiling — new invites may be throttled. (Phase 2 adds auto-withdraw.)</p>}
      {oldestPendingDays != null && <p className="text-[10px] text-zinc-500 mt-1">Oldest pending: {oldestPendingDays}d</p>}
    </div>
  );
}
export default PendingInviteGauge;
```

`pending` = `stats.connectionSent`. `ceiling` constant for Phase 1: `const PENDING_CEILING = 200;` (Phase 2 makes it config-driven). `oldestPendingDays` may be undefined in Phase 1 (omit until the hook exposes it).

- [ ] **Step 3: Build `HealthTab`** — moves: the workflow error banner (lines 202-276), auto-send toggles (278-304), today's activity (329-397), `<PendingInviteGauge>`, the workflow-health table + rate-limits card (later in file ~1215-1607), and `<ActivityFeed>`. It receives the relevant slices/handlers as props from the shell. Keep all existing JSX verbatim; only relocate.

- [ ] **Step 4: Wire into shell** — replace the `health placeholder` with `<HealthTab .../>` passing the needed props (`workflowHealth`, `featureFlags`, `toggleFeatureFlag`, `rateLimits`, `cappedQueue`, `stats`, `engagementLog`/`recentActivity`, `prospects`, `workflowStatuses`, `toggleWorkflow`, `refresh`).

- [ ] **Step 5: Typecheck + screenshot Health + commit**

Run: `node_modules/.bin/tsc --noEmit`
Then screenshot (see Task 9 harness) the `?section=reach&sub=outreach&tab=health` view at 1440 + 390; confirm activity feed defaults to system-events-hidden and the gauge renders.
Commit: `git add -A && git commit -m "feat(reach): HealthTab + pending-invite gauge + filtered activity feed"`

---

## Task 6: ReviewTab

**Files:**
- Create: `components/dashboard/outreach/tabs/ReviewTab.tsx`
- Modify: `components/dashboard/OutreachPanel.tsx`

- [ ] **Step 1: Move** the four review blocks verbatim into `ReviewTab`: Outreach Review Queue (lines 549-652), Commenting Cohort (654-739), Proposed Commenting Targets (741-788), Comment Draft Review Queue (790-860). Props: `pendingDrafts, fetchPendingDrafts, approveDraft, rejectDraft, prospects, setSelectedProspect, activeCohort, proposedTargets, commentDrafts, addCommentingTargets, approveCommentingTarget, rejectCommentingTarget, approveCommentDraft, rejectCommentDraft, pauseCommentingTarget, dropActiveCommentingTarget`, plus local `bulkUrls`/`showCohort` state (move those `useState` into ReviewTab).
- [ ] **Step 2: Empty state** — when `pendingDrafts.length + proposedTargets.length + commentDrafts.length === 0 && activeCohort.length === 0`, show an `EmptyState` ("Nothing to review").
- [ ] **Step 3: Wire shell** — replace `review placeholder` with `<ReviewTab .../>`.
- [ ] **Step 4: Typecheck + screenshot + commit**

Run: `node_modules/.bin/tsc --noEmit`; screenshot `&tab=review` at 1440+390.
Commit: `git add -A && git commit -m "feat(reach): ReviewTab — drafts, cohort, comment queues"`

---

## Task 7: PipelineTab + CampaignPerformance + link-clicks (WARMING removed)

**Files:**
- Create: `components/dashboard/outreach/tabs/PipelineTab.tsx`
- Create: `components/dashboard/outreach/CampaignPerformance.tsx`
- Create: `components/dashboard/outreach/__tests__/PipelineTab.test.tsx`
- Modify: `components/dashboard/OutreachPanel.tsx`

- [ ] **Step 1: Build `CampaignPerformance`** — render `campaignPerformance(prospects)` rows as a compact table (campaign · sent · connected · replied · reply%). Dim reply% when `sent < 10` (mirror the existing low-signal rule).

- [ ] **Step 2: Build `PipelineTab`** — move: stats grid (307-327) **minus the Warming card** (delete the line 310 `StatCard label="Warming"`), funnel (452), action-needed (455-474), filters (477-530), bulk bar (533-547), prospect table mobile+desktop (862-end of table). Add `<CampaignPerformance prospects={prospects} />` above the table and `<AgencyVariantPerformance />` (moved from line 449). The prospect filter/sort/selection state stays in the shell and is passed down (or move the whole filter+table subtree as one unit with its state — choose the unit boundary that keeps the table's state with the table). Recommended: move filter+selection+pagination state INTO PipelineTab since nothing else uses it.

- [ ] **Step 3: Surface link-clicks** — import `useOutreachClicks` and show a small "clicked audit" indicator on prospect rows whose token appears in the clicks list. Match by `prospect.linkedinUrl`/token per `useOutreachClicks` shape (read `hooks/useOutreachClicks.ts` for the exact key). If matching keys aren't available without extra fetches, render a compact "Audit clicks" summary card above the table instead (count of distinct clickers) — do NOT add a per-prospect fetch.

- [ ] **Step 4: Write render smoke test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PipelineTab } from '../tabs/PipelineTab';
// minimal props with 2 prospects in different stages; assert the Warming card is absent
// and a campaign row renders.
it('does not render a Warming stat card', () => {
  render(<PipelineTab /* minimal props */ />);
  expect(screen.queryByText(/warming/i)).toBeNull();
});
```

(Fill the minimal props from PipelineTab's final prop type; keep the assertion on absence of "Warming".)

- [ ] **Step 5: Wire shell, typecheck, run tests, screenshot, commit**

Run: `node_modules/.bin/vitest run components/dashboard/outreach/__tests__ && node_modules/.bin/tsc --noEmit`
Screenshot `&tab=pipeline` 1440+390; confirm no Warming card, campaign table present.
Commit: `git add -A && git commit -m "feat(reach): PipelineTab + per-campaign performance + link-clicks, drop Warming card"`

---

## Task 8: InboxTab (Phase-3 stub)

**Files:**
- Create: `components/dashboard/outreach/tabs/InboxTab.tsx`
- Modify: `components/dashboard/OutreachPanel.tsx`

- [ ] **Step 1: Build a useful stub** — list `actionNeeded` prospects (those needing a reply) as clickable rows opening `ProspectDetailModal`, with a header note: "Full threaded inbox with in-dashboard reply lands in Phase 3." This gives immediate value (reply-needed queue) without the backend.
- [ ] **Step 2: Wire shell** — replace `inbox placeholder` with `<InboxTab actionNeeded={actionNeeded} onOpen={setSelectedProspect} />`.
- [ ] **Step 3: Typecheck + screenshot + commit**

Run: `node_modules/.bin/tsc --noEmit`; screenshot `&tab=inbox`.
Commit: `git add -A && git commit -m "feat(reach): InboxTab stub — reply-needed queue (full inbox = Phase 3)"`

---

## Task 9: Dead-state removal + final verification

**Files:**
- Modify: `components/dashboard/OutreachPanel.tsx`

- [ ] **Step 1: Remove dead state** — delete `showDocs`, `expandedDoc` (and `showSettings` if now unused). Confirm via grep no references remain:

Run: `grep -n 'showDocs\|expandedDoc' components/dashboard/OutreachPanel.tsx`
Expected: no output.

- [ ] **Step 2: Full typecheck + build + tests**

Run: `node_modules/.bin/tsc --noEmit && npm run build && node_modules/.bin/vitest run`
Expected: all green.

- [ ] **Step 3: Screenshot all four tabs, both widths, and read them**

Use the playwright-driver `dashboard` profile (script pattern: navigate to `https://ivanmanfredi.com/dashboard-v2/?section=reach&sub=outreach&tab=<tab>` for each tab; but since this is unmerged, run against `npm run dev` localhost build instead — `http://localhost:<port>/dashboard-v2/...`). Capture 1440 + 390 for pipeline/review/inbox/health. Read each PNG and confirm: no Warming card, single nav, no `auto_replenish` flood, no horizontal overflow on 390, gauge + campaign table present, modals open.

- [ ] **Step 4: Self-review against UI quality bar** — readability (contrast, spacing), every interactive element visible and reachable, brand consistency. Iterate on any tab that looks off, re-screenshot until clean (standing rule: aesthetic work isn't done until screenshots are iterated).

- [ ] **Step 5: Final commit**

Run: `git add -A && git commit -m "chore(reach): remove dead state; Phase 1 restructure complete"`

---

## Self-review (plan vs spec)

- **Spec §Dashboard restructure (4 tabs):** Tasks 4-8. ✓
- **Routing fallback (`sub=posts`):** Task 1. ✓
- **Nav dedup + mobile overflow:** Task 1 (dedup) + Task 9 Step 3 (390px overflow check; `SubTabs` must scroll — verify in screenshot, fix in the primitive if it clips). ✓
- **auto_replenish noise filter:** Task 2 + Task 5 Step 1. ✓
- **WARMING removal:** Task 7 Step 2. ✓
- **Per-campaign performance:** Task 7 Steps 1-2. ✓
- **Link-clicks surfaced:** Task 7 Step 3. ✓
- **Dead state removal:** Task 9 Step 1. ✓
- **Error boundary:** Task 3 + Task 4. ✓
- **Table virtualization:** pagination already exists (30/page); true virtualization deferred unless screenshots show jank — noted, not silently dropped.
- **No data-write changes:** all extraction is verbatim move; write paths (`approveDraft`, `updateStage`, etc.) pass through unchanged. ✓
