export type PreconditionKey =
  | 'structured_input'
  | 'decision_logic'
  | 'narrow_scope'
  | 'human_loop';

export interface Precondition {
  key: PreconditionKey;
  number: string;
  title: string;
  description: string;
  question: string;
  scoreLabels: [string, string, string, string, string];
}

export const preconditions: Precondition[] = [
  {
    key: 'structured_input',
    number: '01',
    title: 'Reliable input pipeline',
    description: 'The agent reads the same data every time. Either the source is structured, or extraction from it is.',
    question: 'When your team makes a key call, can they point to a single source of truth they all read from?',
    scoreLabels: [
      'It lives in someone\'s head',
      'Scattered across docs and chats',
      'Mostly findable, often stale',
      'One canonical source, mostly current',
      'Single source, current, queryable',
    ],
  },
  {
    key: 'decision_logic',
    number: '02',
    title: 'Documentable decision logic',
    description: 'Your best person can write down how they decide. Then we encode it.',
    question: 'Could your best operator write down how they decide on this kind of work in under a page?',
    scoreLabels: [
      'It\'s all gut, no one can explain it',
      'Some of it, the rest is judgment',
      'Roughly, with a lot of caveats',
      'Yes, with the edge cases noted',
      'Already documented and used',
    ],
  },
  {
    key: 'narrow_scope',
    number: '03',
    title: 'Narrow initial scope',
    description: 'One job, done end-to-end, before widening. Small wins compound.',
    question: 'Are you trying to fix one specific bottleneck, or rebuild a whole function at once?',
    scoreLabels: [
      'Rebuild everything, end-to-end',
      'Big sweep, several departments',
      'A function or two',
      'One workflow, end-to-end',
      'One specific bottleneck, sharply scoped',
    ],
  },
  {
    key: 'human_loop',
    number: '04',
    title: 'Human-in-the-loop by design',
    description: 'Routed review is the design, not the rescue. Failure paths planned upfront.',
    question: 'Is there a named human who reviews the AI\'s output before it touches a customer?',
    scoreLabels: [
      'No review, AI ships direct',
      'Spot checks, no clear owner',
      'Owner exists, no real workflow',
      'Routed review for risky outputs',
      'Routed review designed in from day one',
    ],
  },
];

export const preconditionByKey = (key: PreconditionKey) =>
  preconditions.find((p) => p.key === key) as Precondition;
