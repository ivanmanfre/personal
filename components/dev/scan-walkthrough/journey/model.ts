import type { ContentSystem } from '../../../../lib/scanTypes';
import original from './samples.json';

export type JourneySamples = NonNullable<ContentSystem['sample_output']>;
export type TierId = 'low' | 'mid' | 'high';
export interface JourneyAssessment {
  url: string; title: string; subtitle: string; badge: string; questions: number; minutes: number; sections: string[];
  tiers: { id: TierId; name: string; headline: string; firstStep: string }[]; thresholds: { low: number; mid: number };
  image: string; imageMobile: string; capturedOn: string;
}
export interface JourneyFixture {
  founder: { name: string; company: string; headline: string; avatarUrl?: string };
  buyer: { role: string; project: string };
  samples: JourneySamples;
  assessment: JourneyAssessment;
  source: { kind: 'original-scan' | 'preview-draft'; url: string; capturedOn: string };
}
export const fixture = original as JourneyFixture;
/** Example scores, one per tier of the live assessment (thresholds 40 / 70). */
export const tierScores: Record<TierId, number> = { low: 31, mid: 58, high: 84 };
export interface JourneyState { tier: TierId; requested: boolean; subscribed: boolean }
export type JourneyAction = { type: 'tier'; value: TierId } | { type: 'request' } | { type: 'subscription'; value: boolean };
export const initialJourneyState: JourneyState = { tier: 'mid', requested: false, subscribed: false };
export function journeyReducer(state: JourneyState, action: JourneyAction): JourneyState {
  switch (action.type) {
    case 'tier': return { ...state, tier: action.value, requested: false };
    case 'request': return { ...state, requested: true };
    case 'subscription': return { ...state, subscribed: action.value };
  }
}
export function tierOf(state: JourneyState) { return fixture.assessment.tiers.find(t => t.id === state.tier)!; }
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
