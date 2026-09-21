import type { ContentSystem } from '../../../../lib/scanTypes';
import original from './samples.json';

export type JourneySamples = NonNullable<ContentSystem['sample_output']>;
export interface JourneyFixture {
  founder: { name: string; company: string; headline: string; avatarUrl?: string };
  buyer: { role: string; project: string };
  samples: JourneySamples;
  source: { kind: 'original-scan' | 'preview-draft'; url: string; capturedOn: string };
}
export const fixture = original as JourneyFixture;
export type ResearchPurpose = 'story' | 'campaign' | 'launch';
export const purposes: Record<ResearchPurpose, string> = { story: 'Customer story', campaign: 'Campaign', launch: 'Product launch' };
export interface JourneyState { category: string; purpose: ResearchPurpose; checked: number[]; requested: boolean; subscribed: boolean }
export type JourneyAction =
  | { type: 'category'; value: string } | { type: 'purpose'; value: ResearchPurpose }
  | { type: 'check'; index: number } | { type: 'request' } | { type: 'subscription'; value: boolean };
export const initialJourneyState: JourneyState = { category: 'Coffee', purpose: 'story', checked: [0, 1], requested: false, subscribed: false };
export function journeyReducer(state: JourneyState, action: JourneyAction): JourneyState {
  switch (action.type) {
    case 'category': return { ...state, category: action.value, requested: false };
    case 'purpose': return { ...state, purpose: action.value, requested: false };
    case 'check': return { ...state, checked: state.checked.includes(action.index) ? state.checked.filter(i => i !== action.index) : [...state.checked, action.index], requested: false };
    case 'request': return { ...state, requested: true };
    case 'subscription': return { ...state, subscribed: action.value };
  }
}
export function escapeHtml(value: string) { return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)); }
export function checklistDownload(state: JourneyState, questions: string[]) {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>Your story checklist</title><style>body{font:18px/1.6 system-ui;max-width:680px;margin:48px auto;padding:24px;color:#131210}li{margin:20px 0}small{color:#555}</style><h1>The 99-1 Story Checklist</h1><p>${escapeHtml(state.category)} · ${escapeHtml(purposes[state.purpose])}</p><p>${state.checked.length} of ${questions.length} checked</p><ol>${questions.map((q,i) => `<li>${state.checked.includes(i) ? '✓ ' : '□ '}${escapeHtml(q)}</li>`).join('')}</ol><small>Interactive preview. Questions from Andrew Hayes’s original scan. Nothing has been submitted.</small></html>`;
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
