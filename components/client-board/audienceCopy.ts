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

  /**
   * The headline. Two clauses: what was reviewed, then the one finding.
   *
   * IT DOES NOT ADD PEOPLE UP. Per-post people counts are distinct WITHIN a post;
   * one person who engaged with three posts is one person three times over, so
   * summing the columns would report a distinct-people total that is simply
   * wrong (measurement contract rule 3). The payload carries no cross-post
   * distinct count, so the second clause states coverage instead, which is exact.
   */
  headline: {
    withCoverage: (posts: number, withPeople: number) =>
      `${posts} ${posts === 1 ? 'post' : 'posts'} reviewed. `
      + (posts === 1
        ? 'Engagement collected for 1 post.'
        : `Engagement collected for ${withPeople} of ${posts} posts.`),
    postsOnly: (posts: number) =>
      `${posts} ${posts === 1 ? 'post' : 'posts'} reviewed.`,
    nothingYet: 'Nothing reviewed yet.',
  },

  /** The state line. One per rendered state; `unavailable` has no line because
   *  the section does not render at all. */
  state: {
    normal: 'Reviewed against your own posts and the accounts on your source list.',
    empty: 'Nothing reviewed yet. The first review fills this in.',
    unknown: 'People engaged, and none of them has been judged for relevance yet. The counts below stay unknown until they are.',
    incomplete_history: 'These posts were measured, but not yet at an age that compares to your other posts. Ranks appear once two posts have been measured at the same age.',
    stale: 'Nothing new has been collected here for more than two weeks. The numbers below are the last ones we have, with the date they were taken.',
  },
  /** The chip about WHAT STATE the review is in. It never claims freshness:
   *  "Up to date" moved to `freshnessChip` below, which reads
   *  `freshness.overall` and nothing else (run-04 CONTRACTS §2.1). `normal` has
   *  no state chip of its own, because the only thing it used to say was the
   *  freshness claim the chip was not entitled to make. */
  stateChip: {
    empty: 'Not started',
    unknown: 'Not judged yet',
    incomplete_history: 'Short history',
    stale: 'Out of date',
  } as Record<string, string>,

  /**
   * The freshness chip. ONE input: `freshness.overall`.
   *
   * "Up to date" is only ever printed for `fresh`, which means BOTH sources are
   * inside the staleness window. A fresh metric with stale engagement is
   * `partial` and says so; before this the greatest of the two timestamps won
   * and a stale engagement source could ride along under an "Up to date" chip.
   */
  freshnessChip: {
    fresh: 'Up to date',
    partial: 'Partly up to date',
    stale: 'Out of date',
    missing: 'Nothing collected yet',
  } as Record<string, string>,

  /** The meta line under the headline. */
  reviewedOn: (d: string) => `Reviewed ${d}`,
  reviewedNever: 'Not reviewed yet',
  cadence: (c: string) => `${c} review`,
  /**
   * The freshness lines under the headline.
   *
   * `sources` is the per-source pair (run-04 CONTRACTS §2.1). Each source says
   * its own date and its own verdict, so a stale one is visible even when the
   * other is fresh. `snapshots` / `engagers` below are the legacy single-date
   * lines, kept for a payload that carries no `freshness.sources` block yet.
   */
  freshness: {
    sources: {
      metricsFresh: (d: string) => `Post metrics as of ${d}`,
      metricsStale: (d: string) => `Post metrics as of ${d}, out of date`,
      metricsMissing: 'No post metrics collected yet',
      engagementFresh: (d: string) => `Engagement last seen ${d}`,
      engagementStale: (d: string) => `Engagement last seen ${d}, out of date`,
      engagementMissing: 'No engagement collected yet',
    },
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
      /** A positive label is a RELEVANCE judgement, never a claim that the
       *  person is a buyer or a new prospect (run-04 CONTRACTS §2.2). Whether
       *  we already know them is a separate fact and lives in the relationship
       *  chip below. */
      positive: (n: number) => `${n} judged relevant`,
      positiveOne: '1 judged relevant',
      borderline: (n: number) => `${n} possible`,
      unknown: (n: number) => `${n} not judged yet`,
      /** people minus (positive + borderline + unknown). Named so the four
       *  numbers reconcile with the total instead of leaving a silent gap. */
      notAFit: (n: number) => `${n} not a fit`,
      excluded: (n: number) => `${n} from our team, not counted`,
    },
    /** Under the ledger. People are distinct within a post, never across posts. */
    notSummed: 'People are counted for each post on its own. Someone who engaged with two of your posts appears on both, so these columns do not add up to a total.',
    assisted: (n: number) =>
      `Assisted ${n} booked ${n === 1 ? 'call' : 'calls'}`,
    assistedNote: 'A booked call is counted once. It is shown against a post when the person engaged with that post before the call was booked.',
    /** The metric is called `impressions` at the source. It was printed as
     *  "reads", which names an event nobody measures: an impression is the
     *  post appearing on a screen. The source name is kept (run-04 §2.4). */
    impressions: (n: number) => `${n.toLocaleString()} ${n === 1 ? 'impression' : 'impressions'}`,
    comments: (n: number) => `${n.toLocaleString()} ${n === 1 ? 'comment' : 'comments'}`,
    shares: (n: number) => `${n.toLocaleString()} ${n === 1 ? 'share' : 'shares'}`,
  },

  /**
   * The two limits that sit beside every relevance count (run-04 §2.4).
   *
   * One is about the JUDGE: an automated check nobody has scored on this
   * account. One is about the SAMPLE: the count only covers people collection
   * actually reached. Both are printed as footnotes under the ledger, so a
   * relevance number is never read on its own.
   */
  limits: {
    classifier: 'Relevance is judged by an automated check against your buyer description. Its accuracy has not been measured on your account, so these counts are a reading and carry no guarantee.',
    coverage: 'These counts only cover people we collected. Anyone the collection missed is not counted anywhere on this page.',
  },

  /**
   * Relationship (run-04 CONTRACTS §2.2). Whether we already know a person is a
   * FACT off our own records, and it is kept separate from the relevance
   * judgement above. A person we have never contacted says so in words; the
   * board never leaves the line blank and never calls anyone a new prospect.
   */
  relationship: {
    heading: 'People we already know',
    blurb: 'Taken from our own contact records.',
    known: (d: string, stage: string) => `Known to us since ${d} · ${stage}`,
    knownNoDate: (stage: string) => `Known to us · ${stage}`,
    /** No date on the record, and no stage we have a client-facing word for. */
    knownBare: 'Known to us',
    knownDateOnly: (d: string) => `Known to us since ${d}`,
    /**
     * `audn_relationship_v.state` carries the RAW `outreach_prospects.stage`
     * token (`existing_prospect_stage:dm1_sent`). Those tokens are internal and
     * never reach a client, so each one is translated here. An unmapped stage
     * prints NO stage at all rather than leaking the token: the date and the
     * fact that we know the person are true on their own.
     */
    stage: {
      queued: 'on our list',
      connect_sent: 'we sent a connection request',
      connected: 'connected with us',
      invited: 'we sent a connection request',
      dm_sent: 'we have written to them',
      dm1_sent: 'we have written to them',
      dm2_sent: 'we have written to them',
      dm3_sent: 'we have written to them',
      nudge_sent: 'we have written to them',
      inmail_sent: 'we have written to them',
      messaged: 'we have written to them',
      replied: 'they replied to us',
      in_conversation: 'in conversation with us',
      booked: 'they booked a call',
      call_booked: 'they booked a call',
      won: 'a client of yours',
      closed: 'a client of yours',
      skipped: 'set aside on our list',
      paused: 'paused on our list',
      not_now: 'said not now',
    } as Record<string, string>,
    unknown: 'Relationship unknown',
    unknownMany: (n: number) => `${n} ${n === 1 ? 'person has' : 'people have'} no contact history with us: relationship unknown.`,
    more: (n: number) => `${n} more, relationship unknown.`,
    none: 'No people are attached to this review yet.',
    footnote: 'A relationship is only shown where our own records carry one. A person with no record here may still know you; we just have nothing on file.',
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
