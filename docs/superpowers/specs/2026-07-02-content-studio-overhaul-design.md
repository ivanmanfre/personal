# Content Studio Overhaul — Design Spec

Date: 2026-07-02
Source: full Content Studio audit (evidence: `~/Desktop/Ivan - Content System/audits/content-studio-2026-07-02/`, 61 screenshots + probe JSON). All findings verified against source before entering this spec.

## Decisions (ratified by Ivan)

1. **Ideas stay first** on the Posts and Lead Magnets boards. Triage is surfaced additively via **Option A: needs-you strip** (mockup: claude.ai/code/artifact/ec3e8167-a9e0-4648-8429-08d517b29ca9). Never reorder Idea down.
2. **Deletions approved:** PromptsPanel archive; Posts redundancies (Board view, Smart sort, LifecycleLegend, status pill column, column drag-reorder); LM redundancies (Board view, format chip row, zero-count Error chip); Site Audience moves out of Content Studio.
3. **Newsletter tab stays** and gets improved in place (status-first default, debug panel removal). No demotion.
4. **Styles static card sections stay** (Text-post patterns, LM formats). Tab gets thumbnails + stats in the upgrade slate.
5. **Scope: full upgrade slate**, phased.
6. **Mockup gates** (artifact before code): Performance card reorg (Phase 3), Newsletter status strip (Phase 4), LM Published "Library" collapse (Phase 5).

## Corrections to audit findings (verified during planning)

- Light theme `--ds-accent` = indigo `#4f46e5` (light.css:5), so Posts `bg-indigo-50 text-indigo-700` actives are hue-correct but hardcoded. Fix = tokenize to `var(--d-accent-bg)` / `var(--ds-accent)`, do NOT recolor to sage or #6E8BC4 (that is the dark-theme accent).
- Same logic for `shadow-indigo-500/20` on the New post button: acceptable hue, tokenize opportunistically only.

## Architecture of the fix

Root cause for the worst visual defects: `components/dashboard-v2/theme/light.css` bridges legacy dark zinc classes with a whitelist; opacity variants missing from the whitelist composite to mud on light. Strategy: a census script produces the definitive list of un-shimmed variants used in `components/dashboard/*.tsx`; one shim block addition covers them all; the handful of true off-token hardcodes (raw hex, emerald gradients, chart palette) are edited at the component level. Behavior-bearing fixes (prompt trust, needs-you strip, deletions) are per-component edits with the smallest diff that ships each phase independently.

## Phase inventory (all edits)

### Phase 0 — Theme integrity sweep (root cause)
- Shim census script + light.css additions for every un-shimmed opacity variant found. Known cases: `bg-zinc-950/60` + `ring-zinc-800/80` + `placeholder-zinc-600` (LeadMagnetStudioPanel.tsx:264,272,285 — create form), `bg-zinc-900/40` (IdeaInboxPanel.tsx:89 — gray slabs), `text-red-300`/`border-red-900/50`/`bg-red-950/30` (PromptLibraryPanel.tsx:146 — error banner), `bg-zinc-950/60` preview pane (PromptLibraryPanel.tsx:277), `text-emerald-400/70` group headers (PromptLibraryPanel.tsx:188), `bg-zinc-900/30` (LeadMagnetEditor.tsx:163), LM grid pills `bg-zinc-700/60`/`amber-900/50`/`sky-900/50`/`red-900/50` (LeadMagnetStudioPanel.tsx:26-36), `text-zinc-300/90` (LeadMagnetStudioPanel.tsx:488), `text-zinc-200/90` + dark hex gradient (StyleGalleryPanel.tsx:353-355), `bg-zinc-950/80` + `bg-zinc-900/50` (LetterEditor.tsx:361,333).
- Off-token hardcodes: `accent-emerald-500` → `accent-[var(--ds-accent)]` (StudioListView.tsx:491, unify with header:334); `bg-indigo-50 text-indigo-700 ring-indigo-200` → token equivalents (PostStudioPanel.tsx:521,540); emerald gradient Generate button → flat `var(--ds-ok)` (LeadMagnetStudioPanel.tsx:292); `bg-emerald-600` CTAs (LetterPanel.tsx:117,244); hardcoded hex greys `bg-[#eef1f6]`/`border-[#d9dee6]`/`hover:bg-[#f1f1f5]`/`hover:bg-[#fafafc]`/`hover:bg-[#fafafe]`/`hover:ring-[#cbd5e1]` → `--ds-bg`/`--ds-line` tokens (StudioListView.tsx:325,417,476; PostStudioPanel.tsx:388,552,769; PostCalendarView.tsx:350).
- Performance dark debris: Recharts tooltip `#18181b` → light card tokens (PerformancePanel.tsx:34-40, AudiencePanel.tsx equivalent), active pills `bg-zinc-700/80`/`bg-zinc-800/80` → token chips (PerformancePanel.tsx:170,189), gridlines `rgba(39,39,42,.6)` → light rule (PerformancePanel.tsx:209,249). Chart palette `#ec4899`/`#f59e0b`/`#8b5cf6` + raw emerald/blue/purple bars (:21-23,288,312,334) → token-derived set (ds-ok, ds-info, ds-violet, ds-warn).
- Verification: Playwright capture of every touched surface at 1440+375, incl. opened LM create form, prompts error state (forced), newsletter cards.

### Phase 1 — Prompt trust (incident-shaped)
- Provenance render: `updated_at` + `updated_by` in editor meta row (PromptLibraryPanel.tsx:236-249) and list rows (relative time).
- Dirty guard: reset effect (PromptLibraryPanel.tsx:62-67) must not clobber `dirty` drafts; instead set an `externalUpdate` flag rendering a banner: "Changed outside this editor (updated_by, time) — Review diff / Keep my draft / Take theirs".
- Version honesty: Supabase migration — trigger `content_prompts_version_bump` bumps `version` + `updated_at` on ANY body UPDATE (removes client-side read-then-increment); `savePrompt` gains compare-and-swap (`.eq('version', expectedVersion)`) with conflict surfacing.
- Header copy fix (PromptLibraryPanel.tsx:134-135): drop "propagate instantly / no sync wait" overclaim; show real last-write info instead.
- `category` column on `content_prompts` (migration + backfill from categorize() map); panel reads column, keeps slug-prefix fallback; "recently updated" sort toggle.
- Archive PromptsPanel: Knowledge.tsx drops the ClickUp editor (points to PromptLibraryPanel or removes the sub-tab), Dashboard.tsx legacy registration removed, file moved to `components/dashboard/_archive/`.

### Phase 2 — Boards (Posts + Lead Magnets)
- `NeedsYouStrip` shared component (counts from existing status data; jump = same handler as filter chips; hidden when all zero). Mount above list in PostStudioPanel + LeadMagnetStudioPanel. Ideas order untouched.
- Deletions: PostStudioPanel Board view (:746-793) + view toggle; Smart sort select (:549-557); LifecycleLegend (:346); always-on status pill column (StudioListView.tsx:536-589 → hover/context only); column drag-reorder (StudioListView.tsx:225-255). LM Board view (LeadMagnetStudioPanel.tsx:433-473) + format chip row (:333-344) + zero-count Error chip fix (:314,332).
- Error surfacing: last error text into row excerpt (PostStudioPanel.tsx:614) + editor banner (CarouselEditor.tsx:750) + row-level Retry.
- Stuck-generation age chips: "generating · Nm ⚠ re-fire" from updatedAt on both boards (LM currently has none; Posts has 15m warning only inside row).
- Native confirm() → v2 dialog primitive (PostStudioPanel.tsx:473,664; StudioListView.tsx:315,686; PromptLibraryPanel.tsx:194; LeadMagnetEditor.tsx:296-299).
- Copy/affordance: "35 more" → "35 disqualified" (PostStudioPanel.tsx:566); New post → solid `--ds-accent` primary (:352); hover-only row Delete gets touch fallback (StudioListView.tsx:689); focus-visible rings on rows + chips.
- Mobile row card: title-first, checkbox demoted (StudioListView row layout).

### Phase 3 — Performance (MOCKUP GATE first)
- Competitor window fix: `useCompetitors(days)` range param; zero-state guard ("no competitor posts in window"); else delete card.
- Pillar labels from taxonomy source (all keys mapped, unknown → "Unmapped (key)" badge); unscraped posts badged "not scraped yet", excluded from averages; real Apify scrape timestamp in header (replace fetch-time "Updated 5s ago").
- Card reorder: KPIs → Pillars → Topics/Hooks → Trend → Top posts → benchmark. Min-sample guard (n≥3) on topic/hook rankings; post-indexed area chart gets deduped ticks.
- Site Audience → Reach & Pipeline; LinkedIn follower block extracted into Post Performance (AudiencePanel.tsx:96-153); legacy `h1` removed (AudiencePanel.tsx:90).
- "Run it back" on Top posts: pre-seeds Posts idea with pillar/hook/angle via existing post_angle/editorial_notes plumbing.

### Phase 4 — Newsletter improve-in-place (MOCKUP GATE first)
- Status strip on top: last sent · subscribers · open rate · next scheduled (data already behind Drafts & Scheduled tab, LetterPanel.tsx:161-191,232-293).
- Default tab → Drafts & Scheduled (LetterPanel.tsx:75).
- Remove Form-captures debug panel (LetterPanel.tsx:422-444) + implementation-note copy (:252,429).
- Reject → destructive button affordance; 16px View links → ≥32px targets; card hierarchy (hook/WHY/excerpt styles differentiated, IdeaInboxPanel.tsx:114-122); `text-[10px]` badges → 11px floor; mobile header stack (LetterPanel.tsx:107).

### Phase 5 — Upgrade slate
- Prompt versions: `content_prompt_versions` table + INSERT trigger on UPDATE; history drawer with body diff; "consumed by" map (static slug→workflow map, n8nac-generated JSON checked into repo).
- One-key triage on Posts Review lane: j/k navigate, A approve, S schedule-next-slot, R reject.
- Styles: real thumbnails (latest published carousel cover per archetype from carousel_drafts), per-style usage + median engagement, status chip per archetype (LIVE·CarouselSpec / LIVE·legacy / deprecated), populate the dormant `usage` field (StyleGalleryPanel.tsx:60); fix "— no kit_css" footer copy (:378); img onError fallbacks (:348,511); reconcile 9-vs-8 archetypes + add notebook style.
- LM: funnel column (signups → calls booked) on Published; live assessment embed in editor preview tab (LeadMagnetEditor.tsx:244-256); repost-candidate badge from lastPostedAt (+1-click Repost); Published collapse behind "Library" toggle (MOCKUP GATE).
- Calendar: mobile agenda fallback below md (PostCalendarView.tsx:357); cadence-gap tinting vs pillar targets; complete legend incl. post-queue + tone colors, compact on mobile (:318-329); actionable empty month CTA; promotion-aware toast ("Rescheduled + moved to scheduled", Calendar.tsx:75-83); loading skeleton; ICS feed edge function; delete dead `draggable` prop branch (PostCalendarView.tsx:64,249,378).
- Newsletter (if channel resumes by then): idea-to-issue one-click; cadence health widget. Deferred otherwise.
- **"Edit in Canva" for image posts (Ivan add, 2026-07-02):** every post/carousel with a generated image gets a button that opens the asset in Canva for manual touch-up (Magic Edit / "magic pencil"). Feasibility check FIRST (research task, do not build blind): Canva Connect API — OAuth once, `POST /v1/imports` (or asset-upload + create-design) to turn our stored PNG into an editable design, persist `canva_design_id` + edit URL on the draft row, render button in CarouselEditor/post editor. Open questions to verify at build time: current Connect API endpoint names + quotas, whether an imported flat PNG is editable enough to be useful (vs uploading per-layer), and how the edited result flows BACK (manual re-upload vs export API poll). If import-of-flat-PNG proves too weak for real editing, fallback: a "Send to Canva uploads" action + deep link, still one click.

### Phase 6 — Chrome polish
- Tour button vs "Jump to anything" collision (Shell/Sidebar footer, visible posts-1440-s1.png).
- "1 post scheduled this week" pill overlaps content (calendar weekend cells) — add right-edge offset rules or auto-hide on calendar.
- Mobile tab bar: strengthen overflow affordance (current mask fade light.css/dashboard-v2.css:290-293 is subtle; add trailing "+N" indicator at <768px).
- 10px text floor sweep across touched panels (11px minimum for meta; keep uppercase micro-badges at 10.5px).

## Plan index

- Phase 0: `docs/superpowers/plans/2026-07-02-content-studio-phase0-theme-integrity.md`
- Phase 1: `docs/superpowers/plans/2026-07-02-content-studio-phase1-prompt-trust.md`
- Phase 2: `docs/superpowers/plans/2026-07-02-content-studio-phase2-boards.md`
- Phase 6: `docs/superpowers/plans/2026-07-02-content-studio-phase6-chrome.md` (can run any time after Phase 0)
- Phases 3, 4, 5: plans are authored AFTER their mockup gates pass (Performance reorg, Newsletter status strip, LM Library collapse) so gated layouts aren't specified before Ivan approves them. The gate artifact for each is built at phase start; on approval the plan is written the same way as the ones above.

## Execution constraints

- Repo: `~/Desktop/personal-site`. Live automation commits to main concurrently — work in an isolated git worktree, push via explicit refspec (see memory: personal-site-concurrent-git-hazard). Deploy = `git push origin main` only.
- Every phase ends with Playwright self-test screenshots (1440 + 375) of changed surfaces BEFORE reporting done (feedback-visual-work-test-yourself).
- Supabase migrations via MCP `apply_migration` against project bjbvqvzbzczjbatgmccb; prompts table is production — migrations must be additive (new columns/triggers only, no destructive DDL).
- Write paths in legacy panels (drag-reschedule timezone math, dashboardAction webhooks, RPCs) must not be restructured — edits stay presentational unless a phase explicitly touches behavior.
- Vitest exists (vitest.config.ts); pure logic (calendarItems pattern) gets unit tests; visual work is verified by Playwright probes.

## Success criteria

- Zero un-shimmed dark-variant classes rendering on light theme (census script returns clean).
- Prompt edits: provenance visible, external writes can't destroy drafts, version bumps on any writer.
- Review/Error reachable in 1 click from board load with Ideas still the first group.
- Performance shows honest data (windowed benchmark, real scrape time, no fake zeros).
- Each phase independently deployed and screenshot-verified.
