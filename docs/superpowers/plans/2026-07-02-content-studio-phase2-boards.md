# Content Studio Phase 2 — Boards (Posts + Lead Magnets) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triage becomes one glance + one click on both boards (needs-you strip, Ideas stay first), approved redundancies are deleted, errors become diagnosable, and native confirm() dialogs are replaced.

**Architecture:** One shared `NeedsYouStrip` primitive consumes the status counts both panels already compute and reuses their existing chip-filter handlers. Deletions are pure removals (the grouped list already carries every capability the deleted views had). A shared `ConfirmDialog` replaces window.confirm at all call sites.

**Tech Stack:** React, Supabase realtime hooks (existing), Playwright + vitest.

## Global Constraints

- **Ideas stay FIRST. Do not touch group order** in either panel (memory: feedback-posts-ideas-first). The strip is additive.
- Approved mockup: Option A needs-you strip — amber band between toolbar and list; items are jump-filters; strip hidden when all counts are zero. Mockup: claude.ai/code/artifact/ec3e8167-a9e0-4648-8429-08d517b29ca9.
- Worktree + refspec push (personal-site-concurrent-git-hazard); deploy `git push origin main` only; Playwright screenshots before any done claim.
- Line refs below are from the 2026-07-02 audit; re-verify with grep before each edit (main moves daily).
- Do not restructure write paths (dashboardAction calls, RPCs, webhooks). Deletions remove JSX/branches, not handlers used elsewhere.

---

### Task 1: Worktree

- [ ] **Step 1:**
```bash
cd ~/Desktop/personal-site && git fetch origin
git worktree add ../personal-site-wt-phase2 -b phase2-boards origin/main
cd ../personal-site-wt-phase2 && npm install 2>&1 | tail -2
```

---

### Task 2: Shared NeedsYouStrip primitive

**Files:**
- Create: `components/dashboard/NeedsYouStrip.tsx`
- Test: `components/dashboard/NeedsYouStrip.test.tsx`

**Interfaces:**
- Produces: `<NeedsYouStrip items={StripItem[]} />` with `interface StripItem { label: string; count: number; tone: 'bad' | 'warn'; onJump: () => void }`. Renders null when every `count === 0`. Tasks 3–4 mount it.

- [ ] **Step 1: Failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NeedsYouStrip } from './NeedsYouStrip';

describe('NeedsYouStrip', () => {
  it('renders nothing when all counts are zero', () => {
    const { container } = render(<NeedsYouStrip items={[{ label: 'errors', count: 0, tone: 'bad', onJump: () => {} }]} />);
    expect(container.firstChild).toBeNull();
  });
  it('renders only non-zero items and fires onJump', () => {
    const jump = vi.fn();
    render(<NeedsYouStrip items={[
      { label: 'errors', count: 2, tone: 'bad', onJump: jump },
      { label: 'in review', count: 0, tone: 'warn', onJump: () => {} },
    ]} />);
    expect(screen.queryByText(/in review/)).toBeNull();
    screen.getByRole('button', { name: /2 errors/ }).click();
    expect(jump).toHaveBeenCalled();
  });
});
```

Run: `npx vitest run components/dashboard/NeedsYouStrip.test.tsx` — expect FAIL (module not found). If @testing-library/react is absent, `npm i -D @testing-library/react @testing-library/jest-dom` first (check package.json).

- [ ] **Step 2: Implement (matches approved mockup: amber band, white jump buttons, colored counts)**

```tsx
import React from 'react';

export interface StripItem { label: string; count: number; tone: 'bad' | 'warn'; onJump: () => void }

export function NeedsYouStrip({ items }: { items: StripItem[] }) {
  const live = items.filter((i) => i.count > 0);
  if (live.length === 0) return null;
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-[var(--d-rule-strong)] bg-[var(--d-warn-bg)] px-3 py-2 mb-3">
      <span className="text-[11px] font-bold tracking-wider text-[var(--d-warn)]">NEEDS YOU</span>
      {live.map((i) => (
        <button
          key={i.label}
          onClick={i.onJump}
          className="text-[11.5px] font-semibold rounded-md border border-[var(--d-rule-strong)] bg-[var(--d-surface)] px-2 py-0.5 hover:ring-1 hover:ring-[var(--d-rule-strong)] focus-visible:ring-2 focus-visible:ring-[var(--ds-accent)] outline-none"
        >
          <span className={i.tone === 'bad' ? 'text-[var(--d-bad-txt)]' : 'text-[var(--d-warn)]'}>{i.count}</span> {i.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Test passes; commit**

```bash
npx vitest run components/dashboard/NeedsYouStrip.test.tsx
git add components/dashboard/NeedsYouStrip.tsx components/dashboard/NeedsYouStrip.test.tsx
git commit -m "feat: NeedsYouStrip primitive (Option A, ideas stay first)"
```

---

### Task 3: Mount strip in Posts

**Files:**
- Modify: `components/dashboard/PostStudioPanel.tsx` (below the toolbar, above the filter-chip row ~:346 region)

- [ ] **Step 1: Wire counts + jumps.** The panel already computes `statusCounts` (used at :310) and a status-filter setter that the chips call (read the chip onClick at :516-531 to get the exact setter name). Mount:

```tsx
<NeedsYouStrip items={[
  { label: 'errors', count: statusCounts['error'] || 0, tone: 'bad', onJump: () => setStatusFilter('error') },
  { label: 'in review', count: statusCounts['review'] || 0, tone: 'warn', onJump: () => setStatusFilter('review') },
  { label: 'stuck scheduled', count: stuckScheduledCount, tone: 'warn', onJump: () => setStatusFilter('scheduled') },
]} />
```

`stuckScheduledCount` already exists for the triage banner (:440-491) — reuse its source; if it is inline, extract `const stuckScheduledCount = ...` above. Use the real setter name found in Step 1.

- [ ] **Step 2: Verify visually (localhost, sub=posts, 1440): strip shows "2 errors · 5 in review"; clicking filters the list; group order unchanged (Idea still first). Screenshot.**

- [ ] **Step 3: Commit** — `git commit -am "feat: needs-you strip on Posts board"`

---

### Task 4: Mount strip in Lead Magnets

**Files:**
- Modify: `components/dashboard/LeadMagnetStudioPanel.tsx` (above the status chip row ~:314 region)

- [ ] **Step 1: Same pattern; counts come from the panel's status counts (grep `statusCounts\|counts` in the file); items: errors (tone bad), review (warn), plus `generating > 45m` stuck count if trivially derivable from rows' updatedAt, else omit (Task 6 adds age chips regardless).**
- [ ] **Step 2: Visual check (sub=leadmagnets): strip lists "7 in review"; Idea group still first. Screenshot. Commit** — `git commit -am "feat: needs-you strip on LM board"`

---

### Task 5: Approved deletions

**Files:**
- Modify: `components/dashboard/PostStudioPanel.tsx` (Board view :746-793 + its view toggle; Smart sort :549-557; LifecycleLegend :346; disqualified label :566)
- Modify: `components/dashboard/StudioListView.tsx` (status pill column :536-589; column drag-reorder :225-255)
- Modify: `components/dashboard/LeadMagnetStudioPanel.tsx` (Board view :433-473 + toggle; format chip row :333-344; error-chip-at-zero :314,332)

- [ ] **Step 1: Posts — delete Board view branch + its List/Board toggle buttons; delete the Smart sort `<select>`; delete the LifecycleLegend strip. Grep for now-unused imports/components (`LifecycleLegend`, board-only helpers) and remove them.**
- [ ] **Step 2: Posts — "35 more" toggle (:566): change label template from `` `${count} more` `` to `` `${count} disqualified` ``.**
- [ ] **Step 3: StudioListView — remove the always-on status pill column (:536-589). Keep the inline status editor if it is part of that cell by moving its trigger into the row's existing hover-action cluster (:689 area). Remove column drag-to-reorder DnD block (:225-255) and its dnd imports if now unused.**
- [ ] **Step 4: LM — delete Board view + toggle (keep Grid: it serves cover QA); delete format chip row; fix error chip: render the Error chip and its "·" separator only when `count > 0 || statusFilter === 'error'`.**
- [ ] **Step 5: Gate:** `npx tsc --noEmit && npm run build 2>&1 | tail -3` clean; screenshots of both boards (no Board toggle, no Smart sort, no legend, no pill column; sorting via headers still works; row count unchanged). Commit — `git commit -am "chore: remove approved board redundancies (posts+lm)"`

---

### Task 6: Error diagnosis + stuck-age chips

**Files:**
- Modify: `components/dashboard/PostStudioPanel.tsx` (:614 row excerpt), `components/dashboard/CarouselEditor.tsx` (:747-760 banner), `components/dashboard/StudioListView.tsx` (row actions), `components/dashboard/LeadMagnetStudioPanel.tsx` (list row status cell)

- [ ] **Step 1: Discovery — where does error text live?**

```bash
grep -rn "last_error\|error_message\|errorText\|generation_error" hooks/ components/dashboard/*.tsx lib/ | grep -vi test | head -20
```

Decision rule: if a text column exists on the drafts table/hook → pipe it (Steps 2-3). If none exists → implement Steps 2-3 with the generic string "Generation failed — retry or check n8n Activity", add row Retry anyway, and append a NOTE to the phase-5 plan stub that a `last_error text` column + n8n error-handler write is required to finish this.

- [ ] **Step 2: Row-level: for status='error' rows replace the stale body excerpt (:614) with the error text (red, 12px) and add a Retry button in the row action cluster calling the same handler as CarouselEditor's Retry (:751-757) — import/lift that handler, do not duplicate the webhook call.**
- [ ] **Step 3: Editor banner (:747-760): append the error text under "Last generation failed".**
- [ ] **Step 4: Stuck-age chips: in both boards' generating rows, render `` `generating · ${age}m` `` from `updatedAt` (reuse a shared `relTime`-style helper; Posts has elapsed logic at :602-610 — extend it to LM rather than duplicating: export the helper from a small `components/dashboard/genAge.ts`). At >20m append " ⚠" and a re-fire affordance where a re-fire handler already exists (LM editor has one at LeadMagnetEditor.tsx:296-299 — reuse; do NOT invent a new webhook).**
- [ ] **Step 5: Verify: force nothing — use the two live error posts on the board; screenshot rows showing reason + Retry. Commit** — `git commit -am "feat: error reasons + row retry + stuck-age chips on boards"`

---

### Task 7: ConfirmDialog replaces window.confirm

**Files:**
- Create: `components/dashboard/ConfirmDialog.tsx`
- Modify: `components/dashboard/PostStudioPanel.tsx:473,664`, `components/dashboard/StudioListView.tsx:315,686`, `components/dashboard/PromptLibraryPanel.tsx:194`, `components/dashboard/LeadMagnetEditor.tsx:296-299`

- [ ] **Step 1: Check `components/dashboard-v2/primitives/` for an existing modal/dialog (`ls` + grep "Dialog\|Modal"). If one exists, use it and skip Step 2.**
- [ ] **Step 2: Otherwise create the minimal primitive:**

```tsx
import React from 'react';

export function ConfirmDialog({ open, title, body, confirmLabel = 'Confirm', danger, onConfirm, onCancel }: {
  open: boolean; title: string; body?: string; confirmLabel?: string; danger?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onCancel} role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-[380px] rounded-xl bg-[var(--d-surface)] border border-[var(--d-rule-strong)] shadow-lg p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="text-[14px] font-semibold text-[var(--d-paper)]">{title}</div>
        {body && <div className="text-[12.5px] text-[var(--d-paper-dim)]">{body}</div>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onCancel} className="text-[12px] font-medium px-3 py-1.5 rounded-md border border-[var(--d-rule-strong)] focus-visible:ring-2 focus-visible:ring-[var(--ds-accent)] outline-none">Cancel</button>
          <button onClick={onConfirm} autoFocus className={`text-[12px] font-semibold px-3 py-1.5 rounded-md text-white focus-visible:ring-2 focus-visible:ring-offset-1 outline-none ${danger ? 'bg-[var(--d-bad)]' : 'bg-[var(--ds-accent)]'}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Swap all six confirm() sites for dialog state (`const [confirming, setConfirming] = useState<null | {...}>`); destructive ones (delete, bulk) get `danger`. Keyboard: Escape cancels (add `useEffect` keydown listener inside the dialog).**
- [ ] **Step 4: tsc + manual dialog check via Playwright drive script (click a delete, dialog appears, cancel works). Commit** — `git commit -am "feat: in-app confirm dialogs replace window.confirm"`

---

### Task 8: Affordance minors

**Files:**
- Modify: `components/dashboard/PostStudioPanel.tsx:352`, `components/dashboard/StudioListView.tsx:689,472-491`

- [ ] **Step 1: New post → solid primary: replace the 10%-tint ghost classes at :352 with the solid pattern already used at :429 (`bg-[var(--ds-accent)] hover:bg-[var(--ds-accent-hover)] text-white`).**
- [ ] **Step 2: Hover-only row Delete (:689): remove `opacity-0 group-hover:opacity-100`; keep it subtle via `text-[var(--d-paper-dimmer)] hover:text-[var(--d-bad)]`, min height 32px.**
- [ ] **Step 3: Focus rings: rows (:472-475) and filter chips get `focus-visible:ring-2 focus-visible:ring-[var(--ds-accent)] outline-none`.**
- [ ] **Step 4: Screenshot + commit** — `git commit -am "fix: primary CTA weight, touch-reachable delete, focus rings"`

---

### Task 9: Ship gate

- [ ] **Step 1:** `npx vitest run && npx tsc --noEmit` all green.
- [ ] **Step 2:** Playwright sweep sub=posts + sub=leadmagnets at 1440 + 375: strip present and functional, Ideas first, deletions gone, error rows diagnosable, dialogs in-app. Read every screenshot.
- [ ] **Step 3:** Refspec push → ff main → deploy → live screenshot (same commands as Phase 0 Task 7, branch `phase2-boards`).
