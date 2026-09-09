/**
 * audienceCopy.ts — EVERY string the audience section can show a client.
 *
 * Run-03 CONTRACTS §3: client-facing copy is Ivan's call, so it all lives in one
 * file (plus `expectation.ts`) and both files are listed for approval before any
 * deployment. `AudienceSection.tsx` contains no user-visible literal at all;
 * anything it renders comes from here.
 *
 * RULES THIS FILE OBEYS
 * - No workflow name, no table name, no prospect or person name, no private row.
 *   People are counts, never names.
 * - Nothing promises a timeframe. A sentence says what makes a number appear,
 *   never how long it takes (the same correction as expectation.ts).
 * - "Assisted", never "caused" or "drove". A booking is counted once overall;
 *   a post gets an assist, not the deal.
 * - Unknown, immature and not-collected are stated in words. There is no
 *   sentence here that turns one of them into a zero.
 * - Plain separators, no em dashes.
 */

/** Words used in more than one place, so a change lands everywhere at once. */
export const AUDIENCE_COPY = {
  // ── section chrome ──────────────────────────────────────────────────────
  eyebrow: 'Audience review',
  postsBlurb: (n: number) => (n === 1 ? 'post reviewed' : 'posts reviewed'),

  /** The headline. Two clauses: what was reviewed, then the one finding. */
  headline: {
    withPeople: (posts: number, people: number) =>
      `${posts} ${posts === 1 ? 'post' : 'posts'} reviewed. ${people} ${people === 1 ? 'person' : 'people'} we can name engaged with them.`,
    postsOnly: (posts: number) =>
      `${posts} ${posts === 1 ? 'post' : 'posts'} reviewed.`,
    nothingYet: 'Nothing reviewed yet.',
  },

  /** The state line. One per rendered state; `unavailable` has no line because
   *  the section does not render at all. */
  state: {
    normal: 'Reviewed against your own posts and the accounts on your source list.',
    empty: 'Nothing reviewed yet. The first review fills this in.',
    unknown: 'People engaged, and none of them has been judged against your buyer yet. The counts below stay unknown until they are.',
    incomplete_history: 'These posts were measured, but not yet at an age that compares to your other posts. Ranks appear once two posts have been measured at the same age.',
    stale: 'Nothing new has been collected here for more than two weeks. The numbers below are the last ones we have, with the date they were taken.',
  },
  stateChip: {
    normal: 'Up to date',
    empty: 'Not started',
    unknown: 'Not judged yet',
    incomplete_history: 'Short history',
    stale: 'Out of date',
  },

  /** The meta line under the headline. */
  reviewedOn: (d: string) => `Reviewed ${d}`,
  reviewedNever: 'Not reviewed yet',
  cadence: (c: string) => `${c} review`,
  freshness: {
    snapshots: (d: string) => `Post numbers as of ${d}`,
    snapshotsNone: 'No post numbers collected yet',
    engagers: (d: string) => `People as of ${d}`,
    engagersNone: 'No people collected yet',
    staleAfter: (days: number) => `Counted out of date after ${days} days`,
  },

  // ── recommendations ─────────────────────────────────────────────────────
  recs: {
    heading: 'What we would do next',
    blurb: 'Up to three per review.',
    none: 'No recommendation from this review.',
    whatChanged: 'What changed',
    whyItMatters: 'Why it may matter to your buyers',
    couldPublish: 'What we could publish',
    proofNeeded: 'What we would need to publish it',
    supports: 'What this is based on',
    sample: (n: number) => `${n} ${n === 1 ? 'source post' : 'source posts'}`,
    unknowns: (n: number) => `${n} unjudged`,
    sources: 'Source posts',
    sourceLink: (i: number) => `Source ${i}`,
    noSources: 'No source rows are attached to this one.',
    happenedAfter: 'What happened after',
  },

  linkState: {
    recommended: 'Recommended. Not taken up yet.',
    idea: 'Now an idea on your board.',
    drafted: 'Drafted.',
    published: 'Published.',
    unknown: 'Not tracked yet.',
  } as Record<string, string>,

  assetState: {
    approved: 'You have already approved the material for this.',
    requested: 'We have asked you for the material for this.',
    missing: 'We would need material from you before publishing this.',
    none: 'Nothing needed from you.',
  } as Record<string, string>,

  assets: {
    heading: 'Material you have approved',
    blurb: 'Only what you approved for public use appears here.',
    context: 'Context',
    none: 'Nothing approved yet.',
  },

  // ── decisions ───────────────────────────────────────────────────────────
  decision: {
    heading: 'Your call',
    accept: 'Use it',
    reject: 'Skip it',
    defer: 'Later',
    reasonLabel: 'Why',
    reasonPlaceholder: 'One line, so the next review knows.',
    reasonRequired: 'Add a line about why, then choose.',
    recorded: {
      accepted: (d: string) => `You said use it, ${d}.`,
      rejected: (d: string) => `You said skip it, ${d}.`,
      deferred: (d: string) => `You said later, ${d}.`,
    } as Record<string, (d: string) => string>,
    recordedNoDate: {
      accepted: 'You said use it.',
      rejected: 'You said skip it.',
      deferred: 'You said later.',
    } as Record<string, string>,
    change: 'Change this',
    saving: 'Saving',
    failed: 'That did not save. Try again.',
    previewNote: 'This is a preview board, so these buttons are switched off.',
  },

  // ── per-post ledger ─────────────────────────────────────────────────────
  posts: {
    heading: 'Post by post',
    blurb: 'Your own posts. Numbers from different accounts are never averaged together.',
    colDate: 'Published',
    colPost: 'Post',
    colReactions: 'Reactions',
    colPeople: 'People',
    none: 'No posts measured yet.',
    capturedAt: (d: string) => `taken ${d}`,
    notMeasured: 'Not measured yet',
    rank: {
      matched: (rank: number, n: number, age: number) =>
        `Rank ${rank} of ${n} of your posts measured at ${age} days old`,
      observed: 'Measured, but not yet at an age that compares to your other posts',
      none: 'Not measured yet',
    },
    coverage: {
      collected: 'Collected',
      not_collected: 'Not collected yet',
      unknown: 'Collection not confirmed',
    } as Record<string, string>,
    people: {
      none: 'No people collected for this post yet',
      total: (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`,
      positive: (n: number) => `${n} look like your buyers`,
      positiveOne: '1 looks like your buyer',
      borderline: (n: number) => `${n} possible`,
      unknown: (n: number) => `${n} not judged yet`,
      excluded: (n: number) => `${n} from our team, not counted`,
    },
    assisted: (n: number) =>
      `Assisted ${n} booked ${n === 1 ? 'call' : 'calls'}`,
    assistedNote: 'A booked call is counted once. It is shown against a post when the person engaged with that post before the call was booked.',
    impressions: (n: string) => `${n} reads`,
    comments: (n: string) => `${n} comments`,
    shares: (n: string) => `${n} shares`,
  },

  // ── monthly trend ───────────────────────────────────────────────────────
  trend: {
    heading: 'Month by month',
    blurb: 'The middle post of each month, measured at the same age. Not an average, so one big post cannot carry a month.',
    sample: (n: number) => `${n} ${n === 1 ? 'post' : 'posts'}`,
    age: (d: number) => `at ${d} days old`,
    none: 'Not enough posts measured at a comparable age yet.',
    basisMatched: 'Same measured age',
    basisOther: 'Mixed ages, labelled',
  },
} as const;

export type AudienceCopy = typeof AUDIENCE_COPY;
