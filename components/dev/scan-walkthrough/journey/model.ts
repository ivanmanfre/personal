import type { ContentSystem } from '../../../../lib/scanTypes';
import original from './samples.json';

export type JourneySamples = NonNullable<ContentSystem['sample_output']>;
export type TierId = 'low' | 'mid' | 'high';
export interface JourneyAssessment {
  url: string; title: string; subtitle: string; badge: string; questions: number; minutes: number; sections: string[];
  tiers: { id: TierId; name: string; headline: string; firstStep: string }[]; thresholds: { low: number; mid: number };
  questions_sample: { text: string; answers: { label: string; score: number }[] }[];
  brand: { ink: string; paper: string; accent: string; accentDeep: string; fontHeading: string; fontBody: string; source: string };
  gate: string; capturedOn: string;
}
export interface JourneyFixture {
  founder: { name: string; company: string; headline: string; avatarUrl?: string };
  buyer: { role: string; project: string };
  samples: JourneySamples;
  assessment: JourneyAssessment;
  source: { kind: 'original-scan' | 'preview-draft'; url: string; capturedOn: string };
}
export const fixture = original as JourneyFixture;
/** Alex's example answers: one score (1 to 5) per sample question. Three sample questions stand in for the 17 on the live page. */
export interface JourneyState { answers: number[]; subscribed: boolean }
export type JourneyAction = { type: 'answer'; index: number; score: number } | { type: 'subscription'; value: boolean };
export const initialJourneyState: JourneyState = { answers: [3, 2, 4], subscribed: false };
export function journeyReducer(state: JourneyState, action: JourneyAction): JourneyState {
  switch (action.type) {
    case 'answer': return { ...state, answers: state.answers.map((s,i) => i === action.index ? action.score : s) };
    case 'subscription': return { ...state, subscribed: action.value };
  }
}
export function scoreOf(state: JourneyState) { const max = state.answers.length * 5; return Math.round(state.answers.reduce((a,b) => a + b, 0) / max * 100); }
export function tierOf(state: JourneyState) {
  const score = scoreOf(state); const { low, mid } = fixture.assessment.thresholds;
  const id: TierId = score < low ? 'low' : score < mid ? 'mid' : 'high';
  return fixture.assessment.tiers.find(t => t.id === id)!;
}
export const newsletterDraft = {
  subject: 'Before the brand enters the story',
  preview: 'A small exercise for your next LinkedIn post.',
  sections: [
    { h: 'Start with the person.', body: 'Open your last draft. Underline the first sentence that names a person and says what they were doing. If you can only underline your company name, start again with a customer’s day.\n\nYou can ask them: “What were you feeling when it happened?” Keep their words in front of you as you write.' },
    { h: 'Give the moment a place.', body: '“At work” leaves a lot to imagine. “Reading the same proposal for the third time” gives the reader something to picture. Use a detail from the customer’s own account. Ask before sharing anything private.' },
    { h: 'Try it on one opening.', body: 'Write the first three lines without mentioning your brand. Name the person, the moment and what was getting in their way. Then read it aloud. Does it sound like someone telling you what happened?' },
  ],
  cta: 'Reply with those three lines. I’ll tell you where I got curious.',
};
