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
  repeatability: {
    key: 'repeatability',
    slug: 'repeatability',
    title: '30 Days to a Workflow Worth Encoding',
    subtitle: 'How to verify your bottleneck recurs often enough to justify automation',
    intro:
      "AI projects don't fail at deployment. They fail when the workflow you automated turns out to be a one-off in disguise. Repeatability isn't about volume. It's about pattern stability. This roadmap walks through proving that the workflow you'd most love to automate actually recurs in a way a system can absorb.",
    weeks: [
      {
        number: 1,
        title: 'Count the runs',
        steps: [
          'Day 1–3: For your target workflow, list every time it ran in the last 90 days. Use calendar, project tracker, inbox, Slack searches. Only count actual runs. Not "I planned to" or "we should have."',
          'Day 4–5: Note the date and the operator on each run. Patterns of who-runs-when matter.',
          "Day 6–7: If the count is under 8, the workflow may be too rare to justify automation. Either widen the definition or pick a different workflow.",
        ],
      },
      {
        number: 2,
        title: 'Compare the patterns',
        steps: [
          'Day 8–10: Pick 5 representative runs. Map each one: input, steps, output. Use the same 3-column format for all 5.',
          'Day 11–12: Highlight what is the same across the 5. That is the encodeable core.',
          'Day 13–14: Highlight what varies. If variation exceeds 30% of total work, the workflow may not be stable enough yet.',
        ],
      },
      {
        number: 3,
        title: 'Pressure-test the pattern',
        steps: [
          'Day 15–17: Walk the most recent 3 runs with whoever did them. Ask: "if I gave you this exact input next month, would you produce this exact output?"',
          'Day 18–19: Identify the 2–3 decision points where they say "depends." Those are the variability nodes. They need encoded logic, not a fixed flow.',
          'Day 20–21: Estimate what % of variability is rule-based (encodeable) vs genuine new judgment (not).',
        ],
      },
      {
        number: 4,
        title: 'Project forward',
        steps: [
          'Day 22–26: Project the next 90 days. Will the workflow run at the same frequency or rarer? Anything in your roadmap that would change the pattern (new product, restructure, seasonal shift)?',
          'Day 27–28: Run the math. Annual cost × (90/365). Does it clear $2k? If not, consider widening the workflow or picking a different one.',
          'Day 29–30: If repeatability passes, you are ready to scope the build. Move to the Blueprint.',
        ],
      },
    ],
    howToKnow:
      'You can describe the pattern in two sentences. Frequency holds at 5+ runs per month. Variability is a finite set of branches, not a creative judgment call each time.',
    whenToReturn:
      "When you're not sure whether your workflow has stable patterns or you'd be automating chaos. This roadmap makes that distinction visible before you commit to a build.",
  },
};

export const roadmapBySlug = (slug: string): Roadmap | undefined =>
  Object.values(roadmaps).find((r) => r.slug === slug);

export const roadmapByKey = (key: PreconditionKey): Roadmap => roadmaps[key];
