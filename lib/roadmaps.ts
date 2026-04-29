import type { PreconditionKey } from './preconditions';

export interface RoadmapWeek {
  number: number;
  title: string;
  steps: string[];
}

export interface Roadmap {
  key: PreconditionKey;
  slug: string;
  title: string;
  subtitle: string;
  intro: string;
  weeks: RoadmapWeek[];
  howToKnow: string;
  whenToReturn: string;
}

export const roadmaps: Record<PreconditionKey, Roadmap> = {
  structured_input: {
    key: 'structured_input',
    slug: 'reliable-input-pipeline',
    title: '30 Days to Reliable Input Pipeline',
    subtitle: 'How to tighten the data your AI is reading from',
    intro:
      "Most AI projects don't fail at the model. They fail at the data layer underneath. If the same query gives a different answer on Tuesday than it did on Monday, no prompt is going to save you. This roadmap walks through tightening the input pipeline before any model work begins.",
    weeks: [
      {
        number: 1,
        title: 'Audit',
        steps: [
          'Day 1–2: Map every source the AI currently reads from (or would, if you built it). Write each one as: source name → who maintains it → freshness → format.',
          'Day 3–5: Pick ONE canonical source per data point. Document why.',
          'Day 6–7: Sanity check — pull 20 sample records by hand and verify the canonical source actually agrees with itself.',
        ],
      },
      {
        number: 2,
        title: 'Extract',
        steps: [
          'Day 8–10: For unstructured sources, write the extraction step. Either tag the source or build a parser. Don\'t ship "the AI will figure it out".',
          'Day 11–12: Test extraction on 50 sample records. Aim for 80%+ accuracy on the structured fields.',
          "Day 13–14: Document the data contract — what fields, what types, what's required, what's optional.",
        ],
      },
      {
        number: 3,
        title: 'Stabilize',
        steps: [
          'Day 15–19: Run the same query against the pipeline twice a day for a week. Log the answers.',
          'Day 20–21: Review the log. If the same query gave different answers, find why and fix it before any AI work.',
        ],
      },
      {
        number: 4,
        title: 'Verify',
        steps: [
          "Day 22–26: Hand the pipeline to someone who didn't build it. Ask them to query 10 records. If they can do it without asking you questions, the pipeline is documented enough.",
          'Day 27–28: Write the runbook for when something breaks.',
          "Day 29–30: You're ready to start the AI work. Begin with one narrow use case, not a sweep.",
        ],
      },
    ],
    howToKnow:
      'The same input gives the same output 100% of the time. When something breaks, the runbook tells you where to look. New team members can use the pipeline without you in the loop.',
    whenToReturn:
      "When you've completed Weeks 1–2 and want a second pair of eyes before Week 3, or when you're ready to ship the first AI build on top of a tight pipeline.",
  },
  decision_logic: {
    key: 'decision_logic',
    slug: 'documentable-decision-logic',
    title: '30 Days to Documentable Decision Logic',
    subtitle: "How to encode your best operator's judgment so an agent can use it",
    intro:
      "Your best operator makes calls every day that nobody else on the team can replicate. That's the bottleneck. Encoding that judgment isn't a prompt-engineering problem — it's a documentation problem. This roadmap walks through getting the rules out of someone's head and onto paper before any model touches the work.",
    weeks: [
      {
        number: 1,
        title: 'Shadow',
        steps: [
          'Day 1–3: Pick the work you want to encode. Pick ONE workflow, not a category.',
          'Day 4–5: Sit with your best operator. Ask them to narrate every decision out loud, including the ones they think are obvious.',
          'Day 6–7: Record everything. Transcribe later.',
        ],
      },
      {
        number: 2,
        title: 'Surface the rules',
        steps: [
          'Day 8–10: Read the transcripts. Pull out every "if X then Y" you can find — including the ones that contradict each other.',
          'Day 11–12: Group the rules. Some will be hard rules (always/never), others will be heuristics (usually). Note which is which.',
          'Day 13–14: Show the doc to your operator. Ask: "what\'s missing?" The unconscious rules show up here.',
        ],
      },
      {
        number: 3,
        title: 'Test on humans first',
        steps: [
          "Day 15–19: Hand the doc to someone else on the team. Have them make 10 decisions using ONLY the doc. Score against your operator's choices.",
          'Day 20–21: For every miss, find the rule that was missing. Add it. Re-test.',
        ],
      },
      {
        number: 4,
        title: 'Encode',
        steps: [
          "Day 22–26: NOW write the prompt. Use the doc as the source. Don't paraphrase.",
          'Day 27–28: Test on 10 fresh cases. Compare to operator. Adjust prompt for the misses.',
          'Day 29–30: Ship to staging behind a human review step.',
        ],
      },
    ],
    howToKnow:
      "A non-expert on the team can replicate your operator's decisions 80%+ of the time using only the doc. When they can't, the gap is a known limitation, not an unknown one.",
    whenToReturn:
      "When you've completed Week 1–2 and need help structuring the rules, or when the doc is solid and you're ready to encode.",
  },
  narrow_scope: {
    key: 'narrow_scope',
    slug: 'narrow-initial-scope',
    title: '30 Days to Narrow Initial Scope',
    subtitle: "How to pick the one workflow that'll actually ship",
    intro:
      "The fastest way to spend $40k on a build that never ships is to start with 'automate ops with AI.' Narrow scope isn't a constraint — it's the discipline that surfaces hidden constraints before they kill the project. This roadmap walks through cutting scope until exactly one workflow is left, and proving it ships before you widen.",
    weeks: [
      {
        number: 1,
        title: 'Inventory',
        steps: [
          'Day 1–3: Write down every workflow you\'ve thought "AI could help with." Don\'t filter.',
          'Day 4–5: For each one, write three things: who does it today, how often, what does failure cost.',
          'Day 6–7: Sort the list by cost-of-failure × frequency. The top of the sorted list is your bottleneck.',
        ],
      },
      {
        number: 2,
        title: 'Define one workflow end-to-end',
        steps: [
          'Day 8–10: Pick the top one. Define: input, output, user, success metric, failure mode.',
          'Day 11–12: Map the current process step by step. Where does it slow down? Where does it break?',
          'Day 13–14: Define what "AI doing this" actually looks like in your environment. Where does the input come from? Where does the output go?',
        ],
      },
      {
        number: 3,
        title: 'Cut scope harder',
        steps: [
          'Day 15–17: Try to cut the workflow in half. Which 50% can you defer? You\'re aiming for "one job, end-to-end" not "the whole function."',
          'Day 18–19: Validate the cut with the operator who does the work today. Ask: "if I automated only this part, would it help?"',
          'Day 20–21: Lock the scope. Write it down. Print it. Pin it somewhere.',
        ],
      },
      {
        number: 4,
        title: 'Build prep',
        steps: [
          "Day 22–26: For the locked scope, identify the other three preconditions: structured input, decision logic, human review. What's missing?",
          "Day 27–28: If anything's missing, that's the next 30 days.",
          "Day 29–30: If nothing's missing, you're ready to build.",
        ],
      },
    ],
    howToKnow:
      'You can describe the workflow in two sentences. Anyone on your team would describe it the same way. The build estimate is in weeks, not months.',
    whenToReturn:
      'When the scope is locked and you want to validate the build estimate before signing a SOW with anyone.',
  },
  human_loop: {
    key: 'human_loop',
    slug: 'human-in-the-loop',
    title: '30 Days to Human-in-the-Loop by Design',
    subtitle: 'How to build review into the system, not bolt it on later',
    intro:
      "AI projects don't fail at deployment — they fail six months later when the team stops noticing the 5% of outputs that are wrong. Human-in-the-loop isn't a fallback; it's how you stop drift before it costs a relationship. This roadmap walks through naming the reviewer and designing the review path before any AI work.",
    weeks: [
      {
        number: 1,
        title: 'Name the human',
        steps: [
          'Day 1–3: For your target workflow, identify the specific role that owns review. Not "the team" — one role.',
          'Day 4–5: Talk to the person in that role. Ask: "if AI did this work and 5% of it was wrong, how would you find the 5%?"',
          "Day 6–7: If they don't have an answer, the review path doesn't exist yet. That's what Week 2 is for.",
        ],
      },
      {
        number: 2,
        title: 'Design the review path',
        steps: [
          "Day 8–10: Map where the AI's output needs to land. Inbox? Slack? CRM queue? It needs to be somewhere the reviewer is already looking.",
          'Day 11–12: Design the review UI. What does the reviewer see? What\'s their lightest possible action — approve, reject, edit?',
          "Day 13–14: Write the SLA. How fast does review need to happen? What happens if it doesn't?",
        ],
      },
      {
        number: 3,
        title: 'Plan the failure path',
        steps: [
          'Day 15–17: When the reviewer flags an error, where does that signal go? Back into AI training? Routes to human-only next time? Logged for later?',
          'Day 18–19: Define escalation. If a reviewer is unsure, who do they escalate to?',
          'Day 20–21: Pressure-test with the reviewer. Walk them through three hypothetical failure scenarios. Adjust if their answer is "I\'d just fix it manually."',
        ],
      },
      {
        number: 4,
        title: 'Build review before AI',
        steps: [
          'Day 22–26: Build the review surface FIRST. Even if the AI side is just a dummy that outputs random data, the review step needs to be real.',
          'Day 27–28: Have the reviewer use it for a week. Iterate based on friction.',
          'Day 29–30: Now connect the AI side. Review step is already proven.',
        ],
      },
    ],
    howToKnow:
      "The reviewer can spot errors in under 30 seconds per item. The failure path actually closes the loop — errors don't repeat. New team members in the reviewer role can be trained in under a day.",
    whenToReturn:
      "When the review surface is live and you want to validate it before connecting the AI, or when you've discovered the workflow you wanted to automate is actually one where review can't be designed in (sometimes the answer is: don't automate this).",
  },
};

export const roadmapBySlug = (slug: string): Roadmap | undefined =>
  Object.values(roadmaps).find((r) => r.slug === slug);

export const roadmapByKey = (key: PreconditionKey): Roadmap => roadmaps[key];
