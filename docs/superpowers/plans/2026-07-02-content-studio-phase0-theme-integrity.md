# Content Studio Phase 0 — Theme Integrity Sweep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every legacy Content Studio panel renders correctly on the Light Premium theme: no un-shimmed dark opacity-variant classes, no off-token hardcoded colors, no dark chart debris.

**Architecture:** One census script finds every dark-era Tailwind class used in `components/dashboard/` that `theme/light.css` does not remap; one shim block addition covers them; a short list of true hardcodes (raw hex, gradients, chart palette) is edited at component level. No behavior changes anywhere in this phase.

**Tech Stack:** React + Tailwind (class-based), light.css CSS-variable bridge, Playwright (verification), Recharts (PerformancePanel).

## Global Constraints

- Repo: `~/Desktop/personal-site`. Live automation commits to main concurrently → work in an isolated worktree, push with explicit refspec (memory: personal-site-concurrent-git-hazard). Deploy = `git push origin main` only.
- Presentational edits only. Do not touch handlers, hooks, RPCs, or webhook calls.
- Light-theme accent is indigo `#4f46e5` (`--ds-accent`, light.css:5). Do NOT recolor indigo UI to sage; tokenize instead.
- Verification is Playwright screenshots at 1440 + 375 of every touched surface BEFORE claiming done (feedback-visual-work-test-yourself).
- Every task ends with a commit.

---

### Task 1: Worktree setup

**Files:** none (git only)

- [ ] **Step 1: Create isolated worktree**

```bash
cd ~/Desktop/personal-site
git fetch origin
git worktree add ../personal-site-wt-phase0 -b phase0-theme-integrity origin/main
cd ../personal-site-wt-phase0
npm install 2>&1 | tail -2
```

Expected: worktree at `~/Desktop/personal-site-wt-phase0`, branch `phase0-theme-integrity`.
All subsequent tasks run inside this worktree.

---

### Task 2: Census script — find every un-shimmed dark class

**Files:**
- Create: `scripts/lightshim-census.mjs`

**Interfaces:**
- Produces: `node scripts/lightshim-census.mjs` → prints JSON `{ missing: [{cls, files: ["path:line"]}] }` and exits 1 if `missing.length > 0`, 0 if clean. Task 3 consumes the list; Task 7 re-runs it as the pass/fail gate.

- [ ] **Step 1: Write the script**

```js
// scripts/lightshim-census.mjs
// Finds dark-era Tailwind classes used in legacy dashboard panels that
// theme/light.css does not remap. Exit 1 when any are missing.
import fs from 'node:fs';
import path from 'node:path';

const PANEL_DIRS = ['components/dashboard', 'components/dashboard-v2/sections'];
const SHIM = fs.readFileSync('components/dashboard-v2/theme/light.css', 'utf8');

// Class families that are dark-theme-only and must be shimmed or absent.
const DARK_CLASS = /(?:^|[\s"'`])((?:hover:)?(?:bg|text|ring|border|placeholder|from|to|shadow)-(?:zinc|neutral|slate|red|amber|sky|emerald|violet|indigo)-(?:[89]\d\d|950)(?:\/\d+)?)(?=[\s"'`}])/g;

const used = new Map();
for (const dir of PANEL_DIRS) {
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.tsx')) continue;
    const p = path.join(dir, f);
    const lines = fs.readFileSync(p, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const m of line.matchAll(DARK_CLASS)) {
        const cls = m[1];
        if (!used.has(cls)) used.set(cls, []);
        used.get(cls).push(`${p}:${i + 1}`);
      }
    });
  }
}

// A class is covered if light.css mentions it as an escaped selector.
const esc = (c) => c.replace('/', '\\/').replace(':', '\\:');
const missing = [];
for (const [cls, files] of [...used.entries()].sort()) {
  if (!SHIM.includes(`.${esc(cls)}`)) missing.push({ cls, files: files.slice(0, 4) });
}
console.log(JSON.stringify({ usedCount: used.size, missing }, null, 2));
process.exit(missing.length ? 1 : 0);
```

- [ ] **Step 2: Run it — expect FAILURE listing known offenders**

Run: `node scripts/lightshim-census.mjs`
Expected: exit 1; `missing` includes at least `bg-zinc-900/40`, `bg-zinc-950/60`, `ring-zinc-800/80`, `bg-red-950/30`, `text-emerald-400/70`, `bg-zinc-900/30`, `bg-amber-900/50`, `bg-sky-900/50`, `bg-red-900/50`, `bg-zinc-700/60`. (`text-red-300`, `placeholder-zinc-600`, `text-zinc-300/90`, `text-zinc-200/90` are 300/600-range so outside this regex — they are handled explicitly in Task 3 regardless.)

- [ ] **Step 3: Commit**

```bash
git add scripts/lightshim-census.mjs
git commit -m "chore: light-shim census script (fails while gaps exist)"
```

---

### Task 3: Close the shim gaps in light.css

**Files:**
- Modify: `components/dashboard-v2/theme/light.css` (append inside the existing compat-shim region, after the `.bg-zinc-900\/95` block near line 458)

**Interfaces:**
- Consumes: Task 2's `missing` list. If census found classes beyond the block below, extend the block using the same mapping table (dark translucent bg → light neutral; dark ring/border → `#d8d8df`; dark semantic bg → 50-tint; dark semantic text → 700-shade).

- [ ] **Step 1: Append the shim block**

```css
/* ── Phase 0 shim completion: opacity variants + stragglers (2026-07-02) ──
 * Mapping rules: dark translucent surface → light neutral wash;
 * dark ring/border → var-equivalent #d8d8df; *-900/50 semantic bg → 50-tint;
 * 300-level semantic text → 700-shade for AA on white. */
body.dashboard-v2-light .dashboard-v2 .bg-zinc-900\/30,
body.dashboard-v2-light .dashboard-v2 .bg-zinc-900\/40,
body.dashboard-v2-light .dashboard-v2 .bg-zinc-700\/60 { background-color: #f1f1f5 !important; }
body.dashboard-v2-light .dashboard-v2 .bg-zinc-950\/60,
body.dashboard-v2-light .dashboard-v2 .bg-zinc-950\/80 { background-color: #ffffff !important; }
body.dashboard-v2-light .dashboard-v2 .ring-zinc-800\/80,
body.dashboard-v2-light .dashboard-v2 .ring-zinc-800\/60 { --tw-ring-color: #d8d8df !important; }
body.dashboard-v2-light .dashboard-v2 .placeholder-zinc-600::placeholder { color: #94a3b8 !important; }
body.dashboard-v2-light .dashboard-v2 .text-red-300 { color: #b91c1c !important; }
body.dashboard-v2-light .dashboard-v2 .border-red-900\/50 { border-color: #fecaca !important; }
body.dashboard-v2-light .dashboard-v2 .bg-red-950\/30 { background-color: #fef2f2 !important; }
body.dashboard-v2-light .dashboard-v2 .bg-red-900\/50 { background-color: #fee2e2 !important; }
body.dashboard-v2-light .dashboard-v2 .bg-amber-900\/50 { background-color: #fffbeb !important; }
body.dashboard-v2-light .dashboard-v2 .bg-sky-900\/50 { background-color: #e0f2fe !important; }
body.dashboard-v2-light .dashboard-v2 .text-emerald-400\/70 { color: #047857 !important; }
body.dashboard-v2-light .dashboard-v2 .text-zinc-300\/90,
body.dashboard-v2-light .dashboard-v2 .text-zinc-200\/90 { color: #475569 !important; }
```

- [ ] **Step 2: Re-run census; add any remaining classes it still lists using the mapping rules, until it exits 0**

Run: `node scripts/lightshim-census.mjs`
Expected: exit 0, `missing: []`.

- [ ] **Step 3: Visual spot-check the three worst surfaces**

```bash
npm run dev &   # note: needs .env or the site renders blank
sleep 6
PW_INSPECT_CONFIG='{"url":"http://localhost:5173/dashboard-v2/?section=content&sub=newsletter","viewports":[1440],"waitFor":"body"}' node ~/.claude/skills/playwright-driver/templates/inspect.js | tail -n 1
```

Read the screenshot: newsletter idea cards must be white/neutral cards, no gray slabs. Repeat for `sub=leadmagnets` (open the "New lead magnet" form by clicking the button in a drive-mode script or verify via computed style probe on `.bg-zinc-950\/60` input) and `sub=prompts`.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard-v2/theme/light.css
git commit -m "fix: complete light-theme shim for opacity-variant dark classes"
```

---

### Task 4: Tokenize off-token hardcodes (Posts, LM, Newsletter, shared list)

**Files:**
- Modify: `components/dashboard/PostStudioPanel.tsx:521,540`
- Modify: `components/dashboard/StudioListView.tsx:325,417,476,491`
- Modify: `components/dashboard/PostStudioPanel.tsx:388,552,769`
- Modify: `components/dashboard/LeadMagnetStudioPanel.tsx:292`
- Modify: `components/dashboard/LetterPanel.tsx:117,244`
- Modify: `components/dashboard/PostCalendarView.tsx:350`

- [ ] **Step 1: Posts active-filter chips — tokenize (both occurrences, lines 521 and 540)**

Old (exact, appears at :521 and :540):
```
bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200 shadow-sm font-medium
```
New:
```
bg-[var(--d-accent-bg)] text-[var(--ds-accent)] ring-1 ring-inset ring-[var(--d-rule-strong)] shadow-sm font-medium
```

- [ ] **Step 2: Row checkbox accent — unify with header**

`StudioListView.tsx:491`: `accent-emerald-500` → `accent-[var(--ds-accent)]` (header at :334 already uses this).

- [ ] **Step 3: Hardcoded hex greys → tokens**

- `StudioListView.tsx:325`: `bg-[#eef1f6]` → `bg-[var(--d-ink-3)]`; `border-[#d9dee6]` → `border-[var(--d-rule-strong)]`
- `StudioListView.tsx:417`: `hover:bg-[#f1f1f5]` → `hover:bg-[var(--d-ink-3)]`
- `StudioListView.tsx:476`: `hover:bg-[#fafafc]` → `hover:bg-[var(--d-surface-2)]`
- `PostStudioPanel.tsx:769`: `hover:bg-[#fafafe]` → `hover:bg-[var(--d-surface-2)]`
- `PostStudioPanel.tsx:388,552`: `hover:ring-[#cbd5e1]` → `hover:ring-[var(--d-rule-strong)]`
- `PostCalendarView.tsx:350`: `bg-[#eef1f6]` → `bg-[var(--d-ink-3)]`

- [ ] **Step 4: LM Generate button — flat sage, no gradient**

`LeadMagnetStudioPanel.tsx:292` old:
```
bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-900/40 ring-1 ring-emerald-400/30 transition-all
```
new:
```
bg-[var(--ds-ok)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all
```

- [ ] **Step 5: Newsletter CTAs**

`LetterPanel.tsx:117,244`: replace `bg-emerald-600` (and its hover variant on the same className string) with `bg-[var(--ds-ok)] hover:opacity-90`.

- [ ] **Step 6: Build check + commit**

Run: `npx tsc --noEmit && npm run build 2>&1 | tail -3`
Expected: no type errors, build succeeds.

```bash
git add components/dashboard components/dashboard-v2
git commit -m "fix: tokenize hardcoded colors in Posts/LM/Newsletter/list panels"
```

---

### Task 5: Performance chart de-darkening + token palette

**Files:**
- Modify: `components/dashboard/PerformancePanel.tsx:21-23,34-40,170,189,209,249,288,312,334`
- Modify: `components/dashboard/AudiencePanel.tsx` (same tooltip object, locate via `grep -n "18181b" components/dashboard/AudiencePanel.tsx`)

- [ ] **Step 1: Palette consts → token-derived set**

At `PerformancePanel.tsx:21-23` replace the pink/amber/violet/raw hexes with:

```ts
const CHART = {
  primary: '#047857',   // --ds-ok    (own posts / main series)
  info:    '#2563eb',   // --ds-info  (secondary series)
  violet:  '#7c3aed',   // --ds-violet (tertiary)
  warn:    '#b45309',   // --ds-warn  (highlights)
  grid:    '#e9e9ee',   // --ds-line
  axis:    '#64748b',   // --ds-faint
};
```

Replace every use of the deleted consts (`#ec4899`, `#f59e0b`, `#8b5cf6`) and the raw `emerald/blue/purple-500` bar fills at :288, :312, :334 with the matching `CHART.*` value. Donut segments cycle `[CHART.primary, CHART.info, CHART.violet, CHART.warn]`.

- [ ] **Step 2: Tooltip → light card**

At the shared tooltip `contentStyle` (:34-40, and the AudiencePanel copy):
```ts
contentStyle: {
  background: '#ffffff',
  border: '1px solid #e9e9ee',
  borderRadius: 10,
  color: '#0f172a',
  boxShadow: '0 10px 26px -18px rgba(15,23,42,.18)',
  fontSize: 12,
}
```

- [ ] **Step 3: Pills + gridlines**

- `:170` active range pill: `bg-zinc-700/80 text-white` → `bg-[var(--d-accent-bg)] text-[var(--ds-accent)] ring-1 ring-inset ring-[var(--d-rule-strong)]`
- `:189` active metric pill: `bg-zinc-800/80` → same replacement as above
- `:209,249` `stroke="rgba(39,39,42,.6)"` (CartesianGrid) → `stroke="#e9e9ee"`

- [ ] **Step 4: Verify + commit**

```bash
PW_INSPECT_CONFIG='{"url":"http://localhost:5173/dashboard-v2/?section=content&sub=performance","viewports":[1440],"waitFor":"body"}' node ~/.claude/skills/playwright-driver/templates/inspect.js | tail -n 1
```
Read the screenshot: pills light, hover a chart in a drive script or trust static render for grid/palette; no dark boxes anywhere.

```bash
git add components/dashboard/PerformancePanel.tsx components/dashboard/AudiencePanel.tsx
git commit -m "fix: performance charts on light theme - token palette, light tooltip, light pills/grid"
```

---

### Task 6: Styles kit card + editor stragglers

**Files:**
- Modify: `components/dashboard/StyleGalleryPanel.tsx:353-356`
- Modify: `components/dashboard/LeadMagnetEditor.tsx:163`
- Modify: `components/dashboard/LetterEditor.tsx:333,361`

- [ ] **Step 1: Kit preview card — light placeholder**

`StyleGalleryPanel.tsx:353` replace the hardcoded dark gradient `from-[#1c241f]…` container classes with `bg-[var(--d-ink-3)] border border-[var(--d-rule)]`, and `:355` `text-zinc-200/90` → `text-[var(--d-paper-dim)]` (shim from Task 3 also covers it; the explicit token is the durable fix since this is a one-off arbitrary value).

- [ ] **Step 2: Editor collapse bars**

- `LeadMagnetEditor.tsx:163`: `bg-zinc-900/30` → `bg-[var(--d-ink-3)]`
- `LetterEditor.tsx:333`: `bg-zinc-900/50` stays (already shimmed at light.css:452) — no edit
- `LetterEditor.tsx:361`: `bg-zinc-950/80` → covered by Task 3 shim — no edit; confirm visually in Step 3

- [ ] **Step 3: Verify + commit**

Screenshot `sub=styles` at 1440; kit name must be legible dark-on-light.

```bash
git add components/dashboard/StyleGalleryPanel.tsx components/dashboard/LeadMagnetEditor.tsx
git commit -m "fix: styles kit card + LM editor collapse bar on light theme"
```

---

### Task 7: Full verification gate + ship

**Files:** none new

- [ ] **Step 1: Census must be clean**

Run: `node scripts/lightshim-census.mjs`
Expected: exit 0.

- [ ] **Step 2: Playwright sweep of all seven tabs, both viewports**

Re-use the audit capture script pattern (`scroll .dv-main`, segment screenshots) against localhost for tabs posts, leadmagnets, styles, prompts, calendar, performance, newsletter at 1440 + 375. Read every segment; acceptance: no dark slabs, no illegible text, no dark tooltips/pills, zero console errors.

- [ ] **Step 3: Ship via refspec push, then fast-forward main**

```bash
git push origin phase0-theme-integrity:phase0-theme-integrity
cd ~/Desktop/personal-site
git pull --rebase origin main
git merge --ff-only phase0-theme-integrity || git merge phase0-theme-integrity
git push origin main
git worktree remove ../personal-site-wt-phase0
```

Expected: GH Actions deploys; verify live at https://ivanmanfredi.com/dashboard-v2/?section=content&sub=newsletter after deploy.

- [ ] **Step 4: Post-deploy live screenshot**

Capture the live newsletter + leadmagnets tabs at 1440 and read them; only then report Phase 0 done.
