# Content Studio Phase 6 — Chrome Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the three cross-tab chrome defects (sidebar footer collision, floating pill overlap, mobile tab overflow) and enforce the 11px text floor on touched panels.

**Architecture:** CSS/layout-only edits in Shell/Sidebar + dashboard-v2.css; no data or behavior changes. Small phase, can run any time after Phase 0.

**Tech Stack:** React, dashboard-v2.css.

## Global Constraints

- Worktree + refspec push; deploy `git push origin main` only; Playwright screenshots before done.
- Evidence anchors: `~/Desktop/Ivan - Content System/audits/content-studio-2026-07-02/posts-1440-s1.png` (Tour vs "Jump to anything" collision, bottom-left) and `calendar-1440-s0.png` (pill over weekend cells).

---

### Task 1: Worktree

- [ ] **Step 1:**
```bash
cd ~/Desktop/personal-site && git fetch origin
git worktree add ../personal-site-wt-phase6 -b phase6-chrome origin/main
cd ../personal-site-wt-phase6 && npm install 2>&1 | tail -2
```

---

### Task 2: Sidebar footer collision (Tour vs Jump-to-anything)

**Files:**
- Modify: `components/dashboard-v2/Shell.tsx` and/or `components/dashboard-v2/Sidebar.tsx` (locate both widgets: `grep -n "Tour\|Jump to anything" components/dashboard-v2/*.tsx components/dashboard-v2/tour/*.tsx`)

- [ ] **Step 1: Reproduce at 1440 (localhost screenshot, bottom-left): Tour button overlaps the jump hint.**
- [ ] **Step 2: Fix by stacking them in one flex column footer (`display:flex; flex-direction:column; gap:8px; padding-bottom:12px`) or right-aligning the Tour pill so the hint keeps the left rail. Whichever container already owns the footer, keep both visible and non-overlapping at sidebar width 240px.**
- [ ] **Step 3: Screenshot confirms separation; commit** — `git commit -am "fix: sidebar footer - tour button no longer overlaps jump hint"`

---

### Task 3: Floating schedule pill overlap

**Files:**
- Modify: the pill component (locate: `grep -rn "scheduled this week" components/ --include="*.tsx"`) and its CSS

- [ ] **Step 1: The "N post scheduled this week" pill sits bottom-right and covers content (calendar weekend cells). Fix: add `pointer-events` pass-through is NOT enough (it visually hides data). Give `.dv-main` a bottom padding equal to pill height + 16px when the pill renders, OR dock the pill into the header row on `?sub=calendar`. Choose the padding approach unless the pill is position:fixed inside `.dv-main` (then padding works trivially).**
- [ ] **Step 2: Screenshot calendar at 1440: last week row fully visible with pill present. Commit** — `git commit -am "fix: schedule pill no longer covers content"`

---

### Task 4: Mobile tab overflow affordance

**Files:**
- Modify: `components/dashboard-v2/dashboard-v2.css:288-300` (.dv-subtabs) and `components/dashboard-v2/primitives` SubTabs component

- [ ] **Step 1: At 375px only 4 of 9 tabs are visible; the mask fade (css:292) is subtle. Add a trailing overflow indicator: SubTabs renders a non-interactive `+N` chip pinned right when `scrollWidth > clientWidth` (measure via ref + ResizeObserver), N = tabs fully out of view (approximate: `Math.round((scrollWidth - clientWidth - scrollLeft) / avgTabWidth)`; clamp ≥1). Hide when scrolled to end.**
- [ ] **Step 2: Verify at 375 (posts tab): `+5` visible on load, disappears at scroll end. Commit** — `git commit -am "feat: mobile subtab overflow indicator"`

---

### Task 5: 11px floor sweep

**Files:**
- Modify: panels touched in earlier phases (`grep -rn "text-\[9px\]\|text-\[9.5px\]\|text-\[10px\]" components/dashboard components/dashboard-v2 --include="*.tsx"`)

- [ ] **Step 1: Raise every `text-[9px]`/`text-[9.5px]`/`text-[10px]` on meta/labels to `text-[11px]`; uppercase tracked micro-badges may stay at 10.5px. Known: StyleGalleryPanel:263,326,331,354; PerformancePanel:285,309,331; LetterPanel:264,286,313,336,361,405,409; IdeaInboxPanel:97; PromptLibraryPanel slugs :206 (join key — raise to 11px).**
- [ ] **Step 2: Screenshot styles + performance + newsletter at 1440; nothing clips or wraps badly. Commit** — `git commit -am "fix: 11px text floor across legacy panels"`

---

### Task 6: Ship gate

- [ ] **Step 1:** `npx tsc --noEmit && npm run build 2>&1 | tail -3` clean.
- [ ] **Step 2:** Playwright: 1440 posts (sidebar footer), 1440 calendar (pill), 375 posts (tab indicator). Read all.
- [ ] **Step 3:** Refspec push → ff main → deploy → live spot-check (same commands as Phase 0 Task 7, branch `phase6-chrome`).
