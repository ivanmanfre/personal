import { PreconditionKey } from './preconditions';

export type Verdict = 'agent_ready' | 'close' | 'foundation';

export type ScoreMap = Record<PreconditionKey, number>;

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
      'You meet the four preconditions. The Blueprint maps your highest-ROI deployment in 30 days.',
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
