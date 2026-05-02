import { PreconditionKey, preconditions } from './preconditions';

export type Verdict = 'agent_ready' | 'close' | 'foundation';

/** Per-precondition score: 1-5. Computed from 3 sub-scores by averaging. */
export type ScoreMap = Record<PreconditionKey, number>;

/** Per-sub-question raw answers, keyed by sub.id (e.g. 'structured_input_q1'). */
export type SubScores = Record<string, number>;

/** Average 3 sub-scores per precondition → integer 1-5 score. */
export function computeScoresFromSubScores(subs: SubScores): ScoreMap {
  const out = {} as ScoreMap;
  for (const p of preconditions) {
    const vals = p.subQuestions.map((sq) => subs[sq.id] ?? 1);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    out[p.key] = Math.max(1, Math.min(5, Math.round(avg)));
  }
  return out;
}

export interface ScorecardResult {
  scores: ScoreMap;
  total: number;
  verdict: Verdict;
  verdictLabel: string;
  recommendation: string;
  ctaLabel: string;
  ctaHref: string;
  weakest: PreconditionKey[];
}

const VERDICT_BANDS: Array<{ min: number; verdict: Verdict }> = [
  { min: 16, verdict: 'agent_ready' },
  { min: 11, verdict: 'close' },
  { min: 0, verdict: 'foundation' },
];

const VERDICT_COPY: Record<Verdict, Omit<ScorecardResult, 'scores' | 'total' | 'verdict' | 'weakest'>> = {
  agent_ready: {
    verdictLabel: 'Agent-Ready',
    recommendation:
      "You meet the four preconditions. The Scorecard tells you the verdict; the Blueprint maps the deployment — sequenced builds, costed gaps, and decision logic for the first project, in one week.",
    ctaLabel: 'Build your Blueprint',
    ctaHref: '/assessment',
  },
  close: {
    verdictLabel: 'Close',
    recommendation:
      'One or two preconditions need work. The Blueprint surfaces exactly which gaps to close before deploying.',
    ctaLabel: 'Build your Blueprint',
    ctaHref: '/assessment',
  },
  foundation: {
    verdictLabel: 'Foundation first',
    recommendation:
      'Foundation work first. Let\'s prioritize before any AI build, so the system you ship actually holds.',
    ctaLabel: 'Book a 30-min call',
    ctaHref: '/start',
  },
};

export function scoreCard(scores: ScoreMap): ScorecardResult {
  const total = Object.values(scores).reduce((sum, n) => sum + n, 0);
  const band = VERDICT_BANDS.find((b) => total >= b.min) ?? VERDICT_BANDS[VERDICT_BANDS.length - 1];
  const lowest = Math.min(...Object.values(scores));
  const weakest = (Object.keys(scores) as PreconditionKey[]).filter((k) => scores[k] === lowest);

  return {
    scores,
    total,
    verdict: band.verdict,
    weakest,
    ...VERDICT_COPY[band.verdict],
  };
}
