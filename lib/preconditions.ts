export type PreconditionKey =
  | 'structured_input'
  | 'decision_logic'
  | 'narrow_scope'
  | 'repeatability';

export interface SubQuestion {
  /** Unique id, e.g. 'structured_input_q1' */
  id: string;
  /** Short angle label shown above the question (e.g. 'Single source of truth') */
  angle: string;
  /** Full question shown to user */
  question: string;
  /** 5-point Likert labels, weakest-to-strongest */
  scoreLabels: [string, string, string, string, string];
}

export interface Precondition {
  key: PreconditionKey;
  number: string;
  title: string;
  description: string;
  /** 3 angles that triangulate the same underlying signal */
  subQuestions: [SubQuestion, SubQuestion, SubQuestion];
}

export const preconditions: Precondition[] = [
  {
    key: 'structured_input',
    number: '01',
    title: 'Reliable input pipeline',
    description:
      'The agent reads the same data every time. Either the source is structured, or extraction from it is.',
    subQuestions: [
      {
        id: 'structured_input_q1',
        angle: 'Single source of truth',
        question:
          'When your team makes a key call, can they point to a single source of truth they all read from?',
        scoreLabels: [
          'It lives in someone\'s head',
          'Scattered across docs and chats',
          'Mostly findable, often stale',
          'One canonical source, mostly current',
          'Single source, current, queryable',
        ],
      },
      {
        id: 'structured_input_q2',
        angle: 'Freshness',
        question:
          'How current is that data when someone reads it — minutes, days, or who-knows?',
        scoreLabels: [
          'Who knows when this was last updated',
          'Updated whenever someone remembers',
          'Refreshed weekly or so',
          'Refreshed daily, rarely stale',
          'Real-time or near-real-time',
        ],
      },
      {
        id: 'structured_input_q3',
        angle: 'Determinism',
        question:
          'If two people query for the same answer today, would they get the same result?',
        scoreLabels: [
          'Different answers depending on who you ask',
          'Mostly the same, with caveats',
          'Same if they read the same source',
          'Same answer, same source, same day',
          'Deterministic — same query, same answer, every time',
        ],
      },
    ],
  },
  {
    key: 'decision_logic',
    number: '02',
    title: 'Documentable decision logic',
    description: 'Your best person can write down how they decide. Then we encode it.',
    subQuestions: [
      {
        id: 'decision_logic_q1',
        angle: 'Documentability',
        question:
          'Could your best operator write down how they decide on this kind of work in under a page?',
        scoreLabels: [
          'It\'s all gut, no one can explain it',
          'Some of it, the rest is judgment',
          'Roughly, with a lot of caveats',
          'Yes, with the edge cases noted',
          'Already documented and used',
        ],
      },
      {
        id: 'decision_logic_q2',
        angle: 'Consistency',
        question:
          'If two senior people independently made the same call, how often would they reach the same answer?',
        scoreLabels: [
          'Rarely — too much depends on the person',
          'Maybe half the time',
          'Most of the time, with disagreement on edges',
          'Almost always, except in edge cases',
          'Always — the rules leave no room',
        ],
      },
      {
        id: 'decision_logic_q3',
        angle: 'Edge cases',
        question:
          'When something unusual comes in, do you have written rules for it, or does someone make a judgment call?',
        scoreLabels: [
          'Always a judgment call by whoever\'s around',
          'Senior person handles them ad-hoc',
          'Some rules exist, mostly improvised',
          'Most edge cases are covered in writing',
          'Edge cases are explicit and routed',
        ],
      },
    ],
  },
  {
    key: 'narrow_scope',
    number: '03',
    title: 'Narrow initial scope',
    description: 'One job, done end-to-end, before widening. Small wins compound.',
    subQuestions: [
      {
        id: 'narrow_scope_q1',
        angle: 'Scope tightness',
        question:
          'Are you trying to fix one specific bottleneck, or rebuild a whole function at once?',
        scoreLabels: [
          'Rebuild everything, end-to-end',
          'Big sweep, several departments',
          'A function or two',
          'One workflow, end-to-end',
          'One specific bottleneck, sharply scoped',
        ],
      },
      {
        id: 'narrow_scope_q2',
        angle: 'End-to-end clarity',
        question:
          'For the first thing you\'d automate, can you describe the input, output, and user in one sentence?',
        scoreLabels: [
          'Not yet — still figuring it out',
          'Roughly, with hand-waving',
          'Yes, but with caveats',
          'Yes, in one tight sentence',
          'Already written down and shared',
        ],
      },
      {
        id: 'narrow_scope_q3',
        angle: 'Discipline to wait',
        question:
          'If the first project takes 4 weeks, would you wait a full quarter before widening, or roll it across other workflows immediately?',
        scoreLabels: [
          'Roll it everywhere as soon as it ships',
          'Start the next one in parallel',
          'Wait a few weeks, then widen',
          'Wait until production proves it',
          'Treat each new workflow as its own scope decision',
        ],
      },
    ],
  },
  {
    key: 'repeatability',
    number: '04',
    title: 'Repeatable enough to encode',
    description: 'The work runs often enough that automating it compounds. One-off projects don\'t qualify.',
    subQuestions: [
      {
        id: 'repeatability_q1',
        angle: 'Frequency',
        question:
          'How often does the workflow you want to automate actually run?',
        scoreLabels: [
          'Once a year or rarer',
          'A few times a year',
          'Monthly',
          'Weekly',
          'Daily or continuous',
        ],
      },
      {
        id: 'repeatability_q2',
        angle: 'Volume',
        question:
          'How many times has this exact workflow run in the last 90 days?',
        scoreLabels: [
          'Less than 5',
          '5 to 20',
          '20 to 50',
          '50 to 200',
          'More than 200',
        ],
      },
      {
        id: 'repeatability_q3',
        angle: 'Predictability',
        question:
          'When the workflow runs again next month, will it look basically the same as last month?',
        scoreLabels: [
          'It\'s never the same twice',
          'Slight variations each time',
          'Mostly the same, with edge cases',
          'Same shape, occasional new patterns',
          'Identical pattern every time',
        ],
      },
    ],
  },
];

export const preconditionByKey = (key: PreconditionKey) =>
  preconditions.find((p) => p.key === key) as Precondition;

/** Flat list of 12 sub-questions in display order, with parent precondition context. */
export interface FlatQuestion {
  index: number;
  preconditionKey: PreconditionKey;
  preconditionTitle: string;
  preconditionNumber: string;
  preconditionIndex: number; // 0-3
  subIndex: number; // 0-2 within the precondition
  sub: SubQuestion;
}

export const flatQuestions: FlatQuestion[] = preconditions.flatMap((p, pi) =>
  p.subQuestions.map((sub, si) => ({
    index: pi * 3 + si,
    preconditionKey: p.key,
    preconditionTitle: p.title,
    preconditionNumber: p.number,
    preconditionIndex: pi,
    subIndex: si,
    sub,
  }))
);
