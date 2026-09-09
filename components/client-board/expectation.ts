/**
 * expectation.ts — the ONE honest empty-state line per performance indicator.
 *
 * WHY THIS FILE EXISTS
 * Until now `expectationFor()` was defined TWICE: once privately inside
 * `ClientBoardPage.tsx` (the blackbox `PerformanceSurface`) and once again,
 * copied by hand, inside `client-board/DeskPerformanceSurface.tsx`. Two copies of
 * a client-visible sentence is two places to correct, and the audience-learning
 * trace found both copies carrying four universal timing promises: one about
 * profile views moving inside a first week, one about inbound DMs following
 * consistency, one about opt-ins starting with a lead magnet, one about booked
 * calls following opt-ins.
 *
 * None of those four was ever measured for any client: there is no snapshot
 * history behind the week claim, no attributed-DM series behind the consistency
 * claim, and no opt-in or booking timing behind the other two. They promise WHEN
 * a number will move, on the surface whose whole job is to be honest about what
 * is not yet measured. Correction ledger C01-C04 (goal-run
 * audience-learning-01-trace-2026-09-09) replaces each with a statement about
 * what makes the number appear, not about how long it takes. C05 (the tracking
 * fallback below) is a fact about our own process and survives unchanged.
 *
 * The four retired sentences are deliberately NOT quoted anywhere in this file:
 * a source grep for them must come back empty across the component tree.
 *
 * Every string here is client-visible and is listed for approval alongside
 * `audienceCopy.ts` (run-03 CONTRACTS §3).
 *
 * RUN 04: EVERY SENTENCE RE-CHECKED AGAINST ITS ACTUAL INPUT (§2.4)
 * C01's replacement still described a MECHANISM rather than a timeframe, but it
 * described the wrong one, and two of the others were incomplete. What is
 * actually measured, and where:
 *
 * - Profile views. There IS a source: `public.profile_view_log`, read by
 *   `_risedtc_funnel_signals()` / `client_board_funnel_signals()`
 *   (`supabase/migrations/20260826_client_board_funnel_signals.sql`), plus a
 *   per-post `profile_views` figure on `PerfPost` from LinkedIn's own post
 *   analytics. Two facts the old line hid: the log only holds viewers LinkedIn
 *   NAMES (it names only those who allow it, so every figure is a floor), and
 *   capture is per account, not automatic. It is not a function of a post
 *   having been live "long enough": a post live for a year with no named viewer
 *   still produces nothing. The new line states the naming condition and the
 *   floor. NOTE FOR APPROVAL: the log is currently populated for one seat only
 *   (the query is seat-scoped), which is why the line says "for this account"
 *   rather than promising every board.
 * - Inbound DMs. `PerfPost.inbound_dms` is written by the reply detector's
 *   attribution hook (2026-09-06) and counts a DM whose sender had reacted to
 *   or commented on that post BEFORE writing, per thread. The old line said
 *   "attributed to a post" without saying what attribution means, which reads
 *   like any DM might land here. The new line states the rule.
 * - Opt-ins. Counted per lead-magnet entry, and `DeskLeadMagnetsSurface`
 *   aggregates GATED entries only: an ungated page has no gate to pass, so a
 *   zero there measures nothing. The old line said "once a lead magnet is live",
 *   which is true of a live ungated page that can never capture anything.
 * - Booked calls. `audn_outcomes_v` is one row per booking (Run 02 INTERFACES).
 *   The line already stated exactly that condition. UNCHANGED.
 * - The C05 fallback is a fact about our own process. UNCHANGED.
 *
 * Not one of these sentences may say or imply that waiting supplies a number.
 */

/** The shape this function needs from a `PerfIndicator`. Structural on purpose:
 *  importing the type from ClientBoardPage would make this leaf module depend on
 *  the 9.5k-line page it is imported BY. */
export type ExpectationInput = { key?: string | null; label?: string | null };

/**
 * The one honest expectation line for an indicator with no measured value yet.
 * Matching is on the indicator's key + label together, exactly as both former
 * private copies did, so no board changes which sentence it gets.
 */
export function expectationFor(ind: ExpectationInput): string {
  const l = `${ind.key ?? ''} ${ind.label ?? ''}`.toLowerCase();
  if (l.includes('view')) return 'Profile views appear here when LinkedIn names the viewer and profile-view capture is running for this account. LinkedIn only names viewers who allow it, so the number is a floor.';
  if (l.includes('dm')) return 'Inbound DMs appear here when the sender reacted to or commented on one of your posts before writing.';
  if (l.includes('opt') || l.includes('magnet')) return 'Opt-ins appear here when a gated lead magnet captures one. An ungated page has no gate, so it captures nothing.';
  if (l.includes('call')) return 'Booked calls appear here when a booking is recorded.';
  return 'Tracking starts the day delivery goes live.';
}
