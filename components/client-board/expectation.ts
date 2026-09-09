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
  if (l.includes('view')) return 'Profile views appear here once the first post has been live long enough to measure.';
  if (l.includes('dm')) return 'Inbound DMs appear here when one is attributed to a post.';
  if (l.includes('opt') || l.includes('magnet')) return 'Opt-ins appear here once a lead magnet is live and has captured one.';
  if (l.includes('call')) return 'Booked calls appear here when a booking is recorded.';
  return 'Tracking starts the day delivery goes live.';
}
