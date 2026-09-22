/// <reference types="vite/client" />
import type { ContentSystem } from '../../../../lib/scanTypes';
import original from './samples.json';

export type JourneySamples = NonNullable<ContentSystem['sample_output']>;
export interface JourneyFixture {
  slug: string; domain: string;
  founder: { name: string; firstName: string; company: string; headline: string; avatarUrl?: string };
  buyer: { role: string; project: string };
  samples: JourneySamples;
  /** The scan's lead-magnet cover (local copy for Andrew, remote for loaded scans). */
  lm_cover_local: string;
  post_labels?: string[];
  post_notes?: Record<string, string>;
  source: { kind: 'original-scan' | 'preview-draft'; url: string; capturedOn: string };
}
export const fixture = original as JourneyFixture;
/** Public asset path that works at '/' in the app and at './' in the standalone preview build. */
export function asset(p: string) { return `${import.meta.env.BASE_URL}${p.replace(/^\//, '')}`; }
export interface JourneyState { subscribed: boolean }
export type JourneyAction = { type: 'subscription'; value: boolean };
export const initialJourneyState: JourneyState = { subscribed: false };
export function journeyReducer(state: JourneyState, action: JourneyAction): JourneyState {
  switch (action.type) {
    case 'subscription': return { ...state, subscribed: action.value };
  }
}
export const newsletterDraft = {
  issue: 'No. 1',
  subject: 'Before the brand enters the story',
  preview: 'One exercise for your next post. Two minutes.',
  intro: 'Hi Alex. One thing this week, from the checklist you pulled.',
  section: { h: 'Start with the person.', body: 'Open your last draft. Underline the first sentence that names a person and says what they were doing. If you can only underline your company name, start again with a customer’s day.\n\nAsk them: “What were you feeling when it happened?” Keep their words in front of you as you write.' },
  cta: 'Reply with your first three lines. I’ll tell you where I got curious.',
};
/** One issue = one idea. Loaded scans carry a full newsletter; the preview shows its first section. */
export function newsletterFor(f: JourneyFixture) {
  const n = f.samples.newsletter as { subject?: string; preview?: string; cta?: string; sections?: { h: string; body: string }[] } | undefined;
  if (n?.sections?.length) return { issue: 'No. 1', subject: n.subject || n.sections[0].h, preview: n.preview || '', intro: `Hi Alex. One thing this week, from ${f.founder.firstName}.`, section: n.sections[0], cta: n.cta || '', fromScan: true, more: n.sections.length - 1 };
  return { ...newsletterDraft, fromScan: false, more: 0 };
}
