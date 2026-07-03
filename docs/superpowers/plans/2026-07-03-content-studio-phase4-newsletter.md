# Content Studio Phase 4 — Newsletter (improve-in-place) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface newsletter health as an always-on status strip above the sub-tabs, open on the operational tab, and remove debug cruft + tighten the idea cards — all frontend, no backend.

**Architecture:** "The Letter" (`LetterPanel.tsx`) already fetches subscribers, queue, open-rate, sequences and issues via `useNewsletter`. Today the health KPIs are buried inside the "Drafts & Scheduled" sub-tab and the panel opens on "Idea Inbox". This phase (a) extracts a pure `deriveIssueTimeline` helper (next-scheduled / last-sent dates from the already-fetched issues), (b) promotes a compact 5-cell status strip above the tabs, always visible, (c) flips the default tab to Drafts & Scheduled, (d) removes the Form-captures debug panel + implementation-note copy, (e) stacks the mobile header, and (f) gives the idea cards real hierarchy (bold hook / quiet WHY rail / italic excerpt) with a destructive Reject (via `ConfirmDialog`, not `window.confirm`) and a ≥36px View button.

**Tech Stack:** React + Vite + Tailwind; Supabase read hooks; `panel-surface` tokenized surface class; light-theme shim (`components/dashboard-v2/theme/light.css`) guarded by `scripts/lightshim-census.mjs`; vitest.

## Global Constraints

- **No backend.** No Supabase migrations, no n8n, no edge functions. Everything reads from the existing `useNewsletter` fetch.
- **"Last sent" renders a DATE**, not an issue-count (Ivan's explicit choice over the mockup's literal "7 issues" cell).
- **Status strip is always visible on all 3 sub-tabs** — render it above the tab bar, after loading, regardless of `hasAny` or active tab.
- **Ideas group is not demoted.** This phase does not touch the Posts/LM board ordering; the Idea Inbox tab stays present with its count badge, just no longer the default.
- **11px text floor** on the idea-card badges being restyled here (the approved mockup renders these badges at 11px; this supersedes Phase 6's 10.5px sweep for these specific idea-card badges only — a deliberate, approved bump, not a regression).
- **Theme integrity gate:** `node scripts/lightshim-census.mjs` must exit 0. Capture the census exit code **directly** (`node scripts/lightshim-census.mjs; echo "census exit $?"`) — never through a `| tail` pipe, which reports tail's exit, not census's. Prefer the tokenized `panel-surface` class and already-shimmed text/semantic classes for new markup so no new shim gaps open; if census flags a class, add it to `light.css`.
- **vitest green:** `npx vitest run` must pass.
- Work happens in the isolated worktree `.claude/worktrees/phase4-newsletter` (branch `feat/content-studio-phase4`); ship via refspec push `git push origin feat/content-studio-phase4:main`.

---

### Task 1: Pure issue-timeline helper

**Files:**
- Create: `lib/newsletterStrip.ts`
- Test: `lib/newsletterStrip.test.ts`

**Interfaces:**
- Consumes: nothing (pure).
- Produces:
  ```ts
  export interface IssueTimelineInput {
    status: string;
    scheduledFor: string | null;
    sentAt: string | null;
  }
  export interface IssueTimeline {
    nextScheduledAt: string | null; // earliest scheduledFor among status==='scheduled'
    lastSentAt: string | null;      // most recent sentAt among status==='sent'
    sentCount: number;
    scheduledCount: number;
    draftCount: number;
  }
  export function deriveIssueTimeline(issues: IssueTimelineInput[]): IssueTimeline;
  ```
  Rules: `nextScheduledAt` = the chronologically earliest `scheduledFor` (ISO string compare is valid for ISO-8601) among issues whose `status === 'scheduled'` and `scheduledFor` is non-null; `null` if none. `lastSentAt` = the chronologically latest `sentAt` among issues whose `status === 'sent'` and `sentAt` non-null; `null` if none. Counts are simple status tallies (`draft`, `scheduled`, `sent`). Never throws on empty input.

- [ ] **Step 1: Write the failing test**

```ts
// lib/newsletterStrip.test.ts
import { describe, it, expect } from 'vitest';
import { deriveIssueTimeline } from './newsletterStrip';

describe('deriveIssueTimeline', () => {
  it('returns nulls and zero counts for empty input', () => {
    expect(deriveIssueTimeline([])).toEqual({
      nextScheduledAt: null,
      lastSentAt: null,
      sentCount: 0,
      scheduledCount: 0,
      draftCount: 0,
    });
  });

  it('picks the earliest scheduled and latest sent', () => {
    const out = deriveIssueTimeline([
      { status: 'scheduled', scheduledFor: '2026-07-10T09:00:00Z', sentAt: null },
      { status: 'scheduled', scheduledFor: '2026-07-05T09:00:00Z', sentAt: null },
      { status: 'sent', scheduledFor: null, sentAt: '2026-06-20T09:00:00Z' },
      { status: 'sent', scheduledFor: null, sentAt: '2026-06-28T09:00:00Z' },
      { status: 'draft', scheduledFor: null, sentAt: null },
    ]);
    expect(out.nextScheduledAt).toBe('2026-07-05T09:00:00Z');
    expect(out.lastSentAt).toBe('2026-06-28T09:00:00Z');
    expect(out.scheduledCount).toBe(2);
    expect(out.sentCount).toBe(2);
    expect(out.draftCount).toBe(1);
  });

  it('ignores scheduled rows with null scheduledFor and sent rows with null sentAt', () => {
    const out = deriveIssueTimeline([
      { status: 'scheduled', scheduledFor: null, sentAt: null },
      { status: 'sent', scheduledFor: null, sentAt: null },
    ]);
    expect(out.nextScheduledAt).toBeNull();
    expect(out.lastSentAt).toBeNull();
    expect(out.scheduledCount).toBe(1);
    expect(out.sentCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/newsletterStrip.test.ts`
Expected: FAIL — cannot find module `./newsletterStrip`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/newsletterStrip.ts
export interface IssueTimelineInput {
  status: string;
  scheduledFor: string | null;
  sentAt: string | null;
}

export interface IssueTimeline {
  nextScheduledAt: string | null;
  lastSentAt: string | null;
  sentCount: number;
  scheduledCount: number;
  draftCount: number;
}

/**
 * Derive next-scheduled and last-sent timestamps (plus status tallies) from
 * the already-fetched newsletter issues. ISO-8601 strings sort lexically, so
 * plain string comparison gives correct chronological order.
 */
export function deriveIssueTimeline(issues: IssueTimelineInput[]): IssueTimeline {
  let nextScheduledAt: string | null = null;
  let lastSentAt: string | null = null;
  let sentCount = 0;
  let scheduledCount = 0;
  let draftCount = 0;

  for (const i of issues) {
    if (i.status === 'scheduled') {
      scheduledCount++;
      if (i.scheduledFor && (nextScheduledAt === null || i.scheduledFor < nextScheduledAt)) {
        nextScheduledAt = i.scheduledFor;
      }
    } else if (i.status === 'sent') {
      sentCount++;
      if (i.sentAt && (lastSentAt === null || i.sentAt > lastSentAt)) {
        lastSentAt = i.sentAt;
      }
    } else if (i.status === 'draft') {
      draftCount++;
    }
  }

  return { nextScheduledAt, lastSentAt, sentCount, scheduledCount, draftCount };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/newsletterStrip.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/newsletterStrip.ts lib/newsletterStrip.test.ts
git commit -m "feat(newsletter): pure deriveIssueTimeline helper + tests"
```

---

### Task 2: Expose timeline in the newsletter hook

**Files:**
- Modify: `hooks/useNewsletter.ts` (import + `totals` memo, ~lines 1-3, 213-255)

**Interfaces:**
- Consumes: `deriveIssueTimeline` from Task 1; `data.issues` (already fetched, each has `status`, `scheduledFor`, `sentAt`).
- Produces: `totals` gains five fields — `nextScheduledAt: string | null`, `lastSentAt: string | null`, `sentCount: number`, `scheduledCount: number`, `draftCount: number` — consumed by Task 3.

- [ ] **Step 1: Add the import**

At the top of `hooks/useNewsletter.ts`, after the existing `toastError` import (line 3), add:

```ts
import { deriveIssueTimeline } from '../lib/newsletterStrip';
```

- [ ] **Step 2: Extend the totals memo**

Inside the `totals = useMemo(...)` block, just before the `return { ... }` (currently line 240), add:

```ts
    const timeline = deriveIssueTimeline(
      data.issues.map((i) => ({ status: i.status, scheduledFor: i.scheduledFor, sentAt: i.sentAt }))
    );
```

Then extend the returned object (currently lines 240-254) to include the timeline fields:

```ts
    return {
      activeSubs,
      subs30d,
      subsPrev30d,
      subs7d,
      pending,
      failed,
      openRate7d,
      clickRate7d,
      unsubs30d,
      captures7d,
      delivered7d,
      opened7d,
      clicked7d,
      nextScheduledAt: timeline.nextScheduledAt,
      lastSentAt: timeline.lastSentAt,
      sentCount: timeline.sentCount,
      scheduledCount: timeline.scheduledCount,
      draftCount: timeline.draftCount,
    };
```

- [ ] **Step 3: Verify typecheck + existing tests still pass**

Run: `npx tsc --noEmit && npx vitest run lib/newsletterStrip.test.ts`
Expected: no type errors; timeline tests still PASS.

- [ ] **Step 4: Commit**

```bash
git add hooks/useNewsletter.ts
git commit -m "feat(newsletter): expose next-scheduled/last-sent in totals"
```

---

### Task 3: LetterPanel — status strip, default tab, header stack, cruft removal

**Files:**
- Modify: `components/dashboard/LetterPanel.tsx`

**Interfaces:**
- Consumes: `totals` (now with `nextScheduledAt`, `lastSentAt`, `sentCount`, `scheduledCount`, `draftCount`) from Task 2; existing `fmtDate` and `relTime` helpers in the file.
- Produces: nothing downstream.

This task has five edits to one file. Do them in order, then run the gates once at the end.

- [ ] **Step 1: Add a compact StripStat sub-component**

Directly above the `const LetterPanel: React.FC = () => {` line (currently line 70), add a small presentational component:

```tsx
function StripStat({ label, value, sub, warn }: { label: string; value: React.ReactNode; sub?: string; warn?: boolean }) {
  return (
    <div className="panel-surface px-3.5 py-3 rounded-xl">
      <div className="text-[11px] text-zinc-500 uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-xl font-bold tabular-nums leading-tight ${warn ? 'text-amber-400' : 'text-zinc-100'}`}>{value}</div>
      {sub && <div className="text-[11px] text-zinc-600 mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

/** Short date for the strip cells — "Jun 28", no time. */
function fmtShortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '—';
  }
}
```

- [ ] **Step 2: Flip the default tab to Drafts & Scheduled**

Change (currently line 75):

```tsx
  const [tab, setTab] = useState<'inbox' | 'drafts' | 'queue'>('inbox');
```

to:

```tsx
  const [tab, setTab] = useState<'inbox' | 'drafts' | 'queue'>('drafts');
```

- [ ] **Step 3: Stack the header on mobile + insert the always-on status strip**

Replace the header wrapper opening (currently line 107):

```tsx
      <div className="flex items-center justify-between gap-3">
```

with:

```tsx
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
```

Then, immediately after the header `</div>` that closes the title/actions row (currently line 123, the `</div>` before the tab bar `<div className="border-b border-zinc-800 ...">`), insert the status strip:

```tsx
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
        <StripStat
          label="Subscribers"
          value={totals.activeSubs}
          sub={`+${totals.subs7d} last 7d`}
        />
        <StripStat
          label="Open rate · 7d"
          value={`${totals.openRate7d}%`}
          sub={`${totals.opened7d} of ${totals.delivered7d} delivered`}
          warn={totals.delivered7d > 0 && totals.openRate7d === 0}
        />
        <StripStat
          label="Queue"
          value={totals.pending}
          sub={totals.failed > 0 ? `${totals.failed} failed` : 'pending sends'}
          warn={totals.failed > 0}
        />
        <StripStat
          label="Next scheduled"
          value={<span className="text-[15px]">{fmtShortDate(totals.nextScheduledAt)}</span>}
          sub={totals.scheduledCount > 0 ? `${totals.scheduledCount} scheduled` : 'nothing queued'}
        />
        <StripStat
          label="Last sent"
          value={<span className="text-[15px]">{totals.lastSentAt ? fmtShortDate(totals.lastSentAt) : 'Never'}</span>}
          sub={totals.lastSentAt ? relTime(totals.lastSentAt) : `${totals.sentCount} sent`}
        />
      </div>
```

- [ ] **Step 4: Remove the now-duplicated KPI grid inside the Drafts tab**

The four `StatCard`s (currently lines 161-191, the `<div className="grid grid-cols-2 md:grid-cols-4 gap-4"> ... </div>` block containing Active subscribers / Queue / Open rate / Unsubs) are now superseded by the always-on strip. Delete that entire `<div className="grid grid-cols-2 md:grid-cols-4 gap-4">...</div>` block. Leave the `<>` fragment and the Sequences panel that follows intact. Also remove the now-unused `StatCard` import (line 5) **only if** no other reference to `StatCard` remains in the file (grep first).

- [ ] **Step 5: Replace the implementation-note copy in the issues empty state**

Change the issues empty-state block (currently lines 250-253):

```tsx
              <div className="rounded-xl border border-dashed border-zinc-700/70 bg-zinc-950/50 p-5 text-xs text-zinc-400 leading-relaxed">
                <p className="font-medium text-zinc-300 mb-1">No issues yet.</p>
                <p>Once drafts are seeded into <code className="text-zinc-300">newsletter_issues</code>, schedule them by setting <code className="text-zinc-300">status='scheduled'</code> and <code className="text-zinc-300">scheduled_for</code>. The Broadcast Sender workflow will pick them up and send via Resend.</p>
              </div>
```

to plain-English operator copy:

```tsx
              <div className="rounded-xl border border-dashed border-zinc-700/70 bg-zinc-950/50 p-5 text-xs text-zinc-400 leading-relaxed">
                <p className="font-medium text-zinc-300 mb-1">No issues yet.</p>
                <p>Click <span className="text-zinc-300 font-medium">New issue</span> to write one, or approve an idea from the Idea Inbox — it'll land here as a draft, ready to schedule and send.</p>
              </div>
```

- [ ] **Step 6: Remove the Form-captures debug panel**

Delete the entire Form-captures `<div className="panel-surface ...">...</div>` block (currently lines 422-444) — the panel whose heading is "Form captures". It is internal wiring scaffolding, not operator content. Nothing else references `data.captures` for display after this (the `hasAny` memo still uses `data.captures.length` — leave that memo untouched).

- [ ] **Step 7: Run the gates**

```bash
npx tsc --noEmit
node scripts/lightshim-census.mjs; echo "census exit $?"
npx vitest run
```
Expected: no type errors; **census exit 0**; vitest all PASS. If census flags a class (e.g. a strip class not covered by the light shim), add the mapping to `components/dashboard-v2/theme/light.css` following the existing patterns there, and re-run until exit 0. The strip uses `panel-surface` + already-shimmed text/amber classes, so it should stay clean.

- [ ] **Step 8: Commit**

```bash
git add components/dashboard/LetterPanel.tsx components/dashboard-v2/theme/light.css
git commit -m "feat(newsletter): always-on status strip, default to Drafts, drop debug cruft + mobile header stack"
```

---

### Task 4: IdeaInboxPanel — card hierarchy, destructive Reject, ≥36px View, 11px badges

**Files:**
- Modify: `components/dashboard/IdeaInboxPanel.tsx`

**Interfaces:**
- Consumes: `ConfirmDialog` from `./ConfirmDialog` (props: `open, title, body?, confirmLabel?, danger?, onConfirm, onCancel`).
- Produces: nothing downstream.

- [ ] **Step 1: Import ConfirmDialog and add reject-target state**

Add the import after the existing imports (after line 10):

```tsx
import { ConfirmDialog } from './ConfirmDialog';
```

Add a state hook alongside the others (after line 28, `const [editPatch, ...]`):

```tsx
  const [rejectTarget, setRejectTarget] = useState<IdeaRow | null>(null);
```

- [ ] **Step 2: Route Reject through ConfirmDialog instead of window.confirm**

Replace the `onReject` function (currently lines 48-60):

```tsx
  async function onReject(idea: IdeaRow) {
    if (!confirm('Reject this idea? It will be hidden from the inbox.')) return;
    setBusyId(idea.id);
    try {
      await rejectNewsletterIdea(idea.id);
      toastSuccess('Rejected');
      refresh();
    } catch (e) {
      toastError('reject', e as Error);
    } finally {
      setBusyId(null);
    }
  }
```

with a confirm-then-reject pair:

```tsx
  async function confirmReject() {
    const idea = rejectTarget;
    if (!idea) return;
    setRejectTarget(null);
    setBusyId(idea.id);
    try {
      await rejectNewsletterIdea(idea.id);
      toastSuccess('Rejected');
      refresh();
    } catch (e) {
      toastError('reject', e as Error);
    } finally {
      setBusyId(null);
    }
  }
```

- [ ] **Step 3: Give the idea card real hierarchy (bold hook / quiet WHY rail / italic excerpt) + 11px badges**

Replace the badge/meta row and the non-editing body block. First, the two badges at the top of the card (currently lines 92 and 97) — raise `text-[10.5px]` to `text-[11px]`:

Line 92 becomes:
```tsx
            <span className={`inline-flex items-center px-2 py-0.5 text-[11px] uppercase tracking-wider border rounded ${CADENCE_PILL_CLASS[idea.recommended_cadence] || ''}`}>
```
Line 97 becomes:
```tsx
          <span className="text-[11px] text-zinc-500 uppercase tracking-wider">From: {idea.source_signal_type.replace(/_/g, ' ')}</span>
```

Then replace the non-editing body block (currently lines 112-124):

```tsx
          <>
            <h4 className="text-base font-semibold text-zinc-100 mb-1">{idea.subject}</h4>
            <p className="text-sm italic text-zinc-400 mb-2">{idea.hook_one_liner}</p>
            {idea.reasoning && (
              <p className="text-xs text-zinc-500 mb-2">
                <span className="font-mono uppercase tracking-wider text-zinc-600">Why: </span>
                {idea.reasoning}
              </p>
            )}
            {idea.source_excerpt && (
              <p className="text-xs text-zinc-500 italic line-clamp-2">"{idea.source_excerpt}"</p>
            )}
          </>
```

with a clearer hierarchy — bold hook, quiet left-rail WHY, italic excerpt:

```tsx
          <>
            <h4 className="text-base font-semibold text-zinc-100 mb-1 leading-snug">{idea.subject}</h4>
            {idea.hook_one_liner && (
              <p className="text-sm italic text-zinc-400 mb-2">{idea.hook_one_liner}</p>
            )}
            {idea.reasoning && (
              <div className="text-xs text-zinc-400 mb-2 pl-3 border-l-2 border-zinc-700/60">
                <span className="block font-mono uppercase tracking-wider text-[11px] text-zinc-500 mb-0.5">Why</span>
                {idea.reasoning}
              </div>
            )}
            {idea.source_excerpt && (
              <p className="text-xs text-zinc-500 italic line-clamp-2">"{idea.source_excerpt}"</p>
            )}
          </>
```

- [ ] **Step 4: Destructive Reject button + ≥36px View button**

Replace the Reject button (currently lines 138-140):

```tsx
                <button onClick={() => onReject(idea)} disabled={busyId === idea.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-red-400 rounded text-sm hover:bg-red-950/30 disabled:opacity-50 ml-auto">
                  <X className="w-4 h-4" /> Reject
                </button>
```

with a destructive-styled, ≥36px button that opens the confirm dialog:

```tsx
                <button onClick={() => setRejectTarget(idea)} disabled={busyId === idea.id} className="inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 disabled:opacity-50 ml-auto">
                  <X className="w-4 h-4" /> Reject
                </button>
```

Also raise the `Approve` and `Edit` buttons to the 36px tap floor for consistency — change their `py-1.5` to `min-h-[36px]` (currently lines 131 and 135). Approve becomes:
```tsx
                <button onClick={() => onApprove(idea)} disabled={busyId === idea.id} className="inline-flex items-center gap-1.5 px-3 min-h-[36px] bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-500 disabled:opacity-50">
```
Edit becomes:
```tsx
                <button onClick={() => startEdit(idea)} disabled={busyId === idea.id} className="inline-flex items-center gap-1.5 px-3 min-h-[36px] border border-zinc-700 text-zinc-300 rounded text-sm hover:bg-zinc-800 disabled:opacity-50">
```

Then replace the drafted-status "View" link (currently lines 159-166):

```tsx
        {idea.status === 'drafted' && idea.linked_issue_id && (
          <div className="text-xs text-emerald-500 mt-3 inline-flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3" /> Drafted + scheduled
            <a href={`#issue-${idea.linked_issue_id}`} className="ml-2 underline inline-flex items-center gap-0.5">
              View <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
```

with a ≥36px View button:

```tsx
        {idea.status === 'drafted' && idea.linked_issue_id && (
          <div className="flex items-center gap-3 mt-3">
            <span className="text-xs text-emerald-500 inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3" /> Drafted + scheduled
            </span>
            <a href={`#issue-${idea.linked_issue_id}`} className="inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded text-sm font-medium border border-zinc-700 text-zinc-300 hover:bg-zinc-800">
              View issue <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
```

- [ ] **Step 5: Mount the ConfirmDialog**

At the end of the component's returned JSX, just before the closing `</div>` of the outer `<div className="space-y-6">` (currently line 199), add:

```tsx
      <ConfirmDialog
        open={rejectTarget !== null}
        title="Reject this idea?"
        body="It will be hidden from the inbox. This can't be undone from here."
        confirmLabel="Reject"
        danger
        onConfirm={confirmReject}
        onCancel={() => setRejectTarget(null)}
      />
```

- [ ] **Step 6: Run the gates**

```bash
npx tsc --noEmit
node scripts/lightshim-census.mjs; echo "census exit $?"
npx vitest run
```
Expected: no type errors; **census exit 0**; vitest all PASS. The new `bg-red-500/10` and `border-red-500/30` are the classes most likely to be flagged by census — if so, add the mappings to `components/dashboard-v2/theme/light.css` next to the existing red/rose entries (red text is already shimmed to `--ds-bad`/`--d-bad`; the tinted bg + border need a light wash, e.g. `rgba(255,241,242,1)` bg and `#f6cdd5`-ish border, mirroring the mockup's `--rose-bg`/reject border). Re-run until exit 0.

- [ ] **Step 7: Commit**

```bash
git add components/dashboard/IdeaInboxPanel.tsx components/dashboard-v2/theme/light.css
git commit -m "feat(newsletter): idea-card hierarchy, destructive Reject via ConfirmDialog, 36px tap targets, 11px badges"
```

---

### Task 5: Production build + light-theme visual verification

**Files:** none (verification only).

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: build + prerender succeed with no errors.

- [ ] **Step 2: Final census + vitest**

```bash
node scripts/lightshim-census.mjs; echo "census exit $?"
npx vitest run
```
Expected: census exit 0; all vitest PASS.

- [ ] **Step 3: Self-screenshot the light theme (controller does this post-merge on the live URL after deploy, per feedback-visual-work-test-yourself). No code.**

---

## Self-Review (author checklist — completed)

1. **Spec coverage:** ✅ status strip (T3), default→Drafts (T3), header stack (T3), remove Form-captures + impl-note copy (T3), idea-card hierarchy + destructive Reject + ≥36px View + 11px badges (T4), next-scheduled/last-sent date data (T1/T2). "Last sent = DATE" honored (T3 Step 3).
2. **Placeholder scan:** ✅ no TBD/TODO; every code step shows full code.
3. **Type consistency:** ✅ `deriveIssueTimeline` signature identical across T1/T2; `totals` field names (`nextScheduledAt`, `lastSentAt`, `sentCount`, `scheduledCount`, `draftCount`) identical across T2/T3; `ConfirmDialog` props match its definition.
