# Dashboard Elevation + Tour Rebuild — Progress & Plan (resume after compaction)

**Branch / worktree:** `worktree-dashboard-readability` at
`/Users/ivanmanfredi/Desktop/personal-site/.claude/worktrees/dashboard-readability`
**Dev server (demo, no auth):** `npm run dev -- --port 5219` → http://localhost:5219/dashboard-v2
**Verify loop:** `PW_INSPECT_CONFIG='{"url":"http://localhost:5219/dashboard-v2?section=content&sub=posts","viewports":[1440],"waitFor":"body"}' node ~/.claude/skills/playwright-driver/templates/inspect.js | tail -n 1` → Read the screenshot path. (Custom playwright scripts must live IN `~/.claude/skills/playwright-driver/` so ESM resolves `playwright`.)
**Build:** `npm run build`. **Tour bug context:** the merged Plan-1 tour goes blank on step 5 + just hops sections — being replaced in Phase E.

## Goal
Make the `/dashboard-v2` demo surfaces look like a polished PRODUCT (not an internal tool) for live sales demos, and rebuild the guided tour to demonstrate TASKS (create/edit/schedule a post, build a lead magnet) — not section-hopping, not starting on the Morning Dispatch.

Surfaces in scope (demo path): Briefing, Content Studio ▸ Posts, Lead Magnets, Calendar, Performance, Styles. **Quality bar = Calendar + Performance** (already product-grade); pull the others up to match.

## Review discipline (user instruction)
Execute all phases; after EACH of A, B, C, review with screenshots and only advance if polished. (A, B, C done + verified.) D–F follow.

---

## PHASE STATUS

### ✅ Phase A — sidebar + brand (commit f78045d)
- Renumbered nav **01–09 in visual order** (was 01–06, ⌖, 08, 07). Briefing = home icon, no number. Added Ideas + System icons.
- Added M-monogram **logo** (from `public/favicon.svg`, recolored to `--d-good`) in `Sidebar.tsx` brand block; dropped **"Console · v2"**; simplified footer to "⌘K Jump to anything".
- Also bumped the global type scale (~+25%: base 13→15, H1 24→30, display 30→38) and spacing scale in `dashboard-v2.css`.
- Files: `components/dashboard-v2/DemoShell.tsx` (nav nums), `Sidebar.tsx` (logo/icons/footer), `dashboard-v2.css` (brand css + scale). Verified via DOM probe: nav 01–09 ordered, logo present.

### ✅ Phase B — kill data leaks (commit 0af10bd)
- Briefing "Action Required" no longer prints raw JSON — `safeMessage()` parses `{...}` and shows `summary` (Briefing.tsx).
- `formatLabel()` humanizes enums (`single_image`→"Single image", etc.).
- Health chip: "SYSTEM RED" → calm "Action needed" / "Needs attention" / "All systems go".
- Styles: removed "27.5K CHARS" + all "synced from ClickUp" / "Source of truth = ClickUp" copy (`StyleGalleryPanel.tsx`).
- Posts filters: "Sort: smart" → "Smart sort"; "+33 hidden" → "33 more".
- Mid-word truncation → `truncateWords()` (word-boundary safe).

### ✅ Phase C — fix empty flagship (commit d43c8a8)
- `StudioListView.tsx`: initial collapsed state was `new Set(statusOrder)` (all collapsed) → now `new Set()` (expanded); empty (0-count) groups no longer render. Posts + LM now show real rows filling the screen.
- LM "Lm Review" phantom group: `lm_review` (+ `generating_content`) added to `LM_STATUS_ALIASES` (`hooks/useLeadMagnets.ts`) and `RAW_LABEL_MAP` (`lib/statusLabels.ts`) → folds into canonical "Review", label "In review".
- LM "(untitled)" → fallback `topic || description || \`${format} — ${date}\`` (LeadMagnetStudioPanel list/board/grid).
- Verified: Posts shows Review/Scheduled(6)/Published(66) with thumbnails+titles; LM groups = Idea/Review/Scheduled/Published, no untitled, no "Lm Review".

---

## REMAINING WORK

### ⏳ Phase D — imagery + lift the weak surfaces toward the Calendar/Performance bar
1. **Imagery/thumbnails everywhere** the product is visual: Posts board cards (status stripe + format icon + thumbnail), Lead Magnet rows/cards (**cover thumbnail** from `cover_url`), Style cards (render an actual **sample slide preview** per style instead of the empty "No reference images" dashed box).
2. **Performance de-jargon** (`PerformancePanel.tsx`): all-caps "BY CONTENT TYPE", "BAR WIDTH SHOWS AVG IMPRESSIONS PER POST", etc. → sentence-case human titles; drop the duplicate "Performance" H1 (triple "Content Studio ▸ Performance ▸ Post Performance ▸ Performance" nesting). Give charts more vertical room.
3. **Briefing cleanup**: the scheduled-checks fetch fails locally and surfaces a raw **"TypeError: Failed to fetch"** toast + empty KPIs. Humanize/suppress the raw error toast (no stack-y text on a sales surface); confirm KPI queries degrade gracefully. (May be partly local-env; verify on the deployed site too.)
4. **Calendar polish** (already good): clean single-line chip truncation + a "+N more" per day; consider defaulting to weeks-with-content so empty trailing weeks don't dominate.
5. **Reclaim remaining vertical voids** on any surface still half-empty.

### ⏳ Phase E — rebuild the guided tour, task-based (replaces Plan-1 tour; fixes step-5 blank)
Tour code lives in `components/dashboard-v2/tour/` (tourSteps.ts, demoSafe.ts, tourReducer.ts, TourProvider.tsx, useTourSpotlight.ts, TourNarratorCard.tsx) + wired in Shell.tsx + ContentStudio.tsx.
**New task-based flow (do NOT start on Briefing/Morning Dispatch):**
1. **Posts (Board)** — "This is your content pipeline — a week of posts, all generated."
2. **Create** — spotlight **New post**, ideally OPEN the create field — "Type one idea; it writes the draft in your voice."
3. **Review & edit** — OPEN a post in Review (the editor/side-sheet) — "Every draft is quality-checked. Edit copy, image, or timing here."
4. **Schedule** — show approve→schedule, land on **Calendar** — "Approve and it schedules itself."
5. **Lead magnet** — "The same idea becomes a lead magnet that captures qualified leads."
6. **Performance** — "And it learns from what actually lands."
- This requires the tour to TRIGGER UI states (open the new-post form, open an editor), not just spotlight section labels. Update `tourSteps.ts` (new ordered steps + targets), and likely add the ability for a step to fire an action (open form / open a specific post editor) — investigate PostStudioPanel's create + editor open mechanisms.
- The step-5 blank in the old tour was the lazy/data-gated Lead Magnets panel mounting after the spotlight window; the spotlight now uses a MutationObserver (already merged) — re-verify under the new flow.
- Keep `?tour=1` deep link + the ▶ Tour button (fixed bottom-left).

### ⏳ Phase F — video script + link on /content-system
- Draft the walkthrough **video script** as an in-repo markdown doc (e.g. `docs/walkthrough-script.md`), based on the new task-based tour + the six promises (file structure of the script: hook → the 6 promises as spoken beats → CTA).
- Wire a **"View script"** link into the `/content-system` `VideoSlot` placeholder (`components/VideoSlot.tsx` — add an optional `scriptHref` prop; render a small "View script" link in the "coming" state) and pass it from `ContentSystemPage.tsx`.
- NOTE: `/content-system` lives in `components/ContentSystemPage.tsx` (on main; this worktree has it too). VideoSlot is `components/VideoSlot.tsx`.

### Finish
- `npm run build` clean; playwright visual verify all touched surfaces (desktop 1440 + mobile 390); commit screenshots to `docs/superpowers/verification/`.
- Ship as ONE PR off `worktree-dashboard-readability` (gh is NOT authed → push branch, give the user the PR compare link `https://github.com/ivanmanfre/personal/pull/new/worktree-dashboard-readability`).

## Full audit reference
The detailed per-surface audit (top-10 prioritized) is preserved in the conversation that produced commits f78045d/0af10bd/d43c8a8; the actionable items are captured in Phases A–F above. Calendar + Performance are the quality bar to match.
