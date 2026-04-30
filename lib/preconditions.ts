export type PreconditionKey =
  | 'structured_input'
  | 'decision_logic'
  | 'narrow_scope'
  | 'human_loop';

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
    key: 'human_loop',
    number: '04',
    title: 'Human-in-the-loop by design',
    description: 'Routed review is the design, not the rescue. Failure paths planned upfront.',
    subQuestions: [
      {
        id: 'human_loop_q1',
        angle: 'Named reviewer',
        question:
          'Is there a named human who reviews the AI\'s output before it touches a customer?',
        scoreLabels: [
          'No review, AI ships direct',
          'Spot checks, no clear owner',
          'Owner exists, no real workflow',
          'Routed review for risky outputs',
          'Routed review designed in from day one',
        ],
      },
      {
        id: 'human_loop_q2',
        angle: 'Review surface',
        question:
          'Where does the AI\'s output land for review — somewhere the reviewer is already looking, or somewhere new they\'d have to remember to check?',
        scoreLabels: [
          'New dashboard nobody looks at',
          'Email digest reviewer ignores',
          'Slack channel they sometimes check',
          'Their existing inbox or queue',
          'A workflow tool they live in daily',
        ],
      },
      {
        id: 'human_loop_q3',
        angle: 'Feedback path',
        question:
          'When the reviewer catches an error, what happens — does it loop back into the system, or just get fixed manually?',
        scoreLabels: [
          'Reviewer fixes silently, system never learns',
          'Sometimes flagged, no formal path',
          'Logged but not actioned',
          'Errors route to human-only next time',
          'Errors feed back into training or rules',
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
