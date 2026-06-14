import type { SectionId } from '../lib/navBus';

export interface TourStep {
  id: string;
  section: SectionId;
  sub?: string;            // ContentStudio sub-tab key
  target: string;          // CSS selector, always a [data-tour="..."] anchor
  title: string;           // outcome headline
  body: string;            // one-line narrator copy
}

// 7 stops mapped to the six outcome promises.
export const TOUR_STEPS: TourStep[] = [
  { id: 'briefing',    section: 'briefing', target: '[data-tour="briefing"]',
    title: 'It runs — and tells you so', body: 'The whole system’s health and what needs you, at a glance.' },
  { id: 'posts',       section: 'content', sub: 'posts', target: '[data-tour="posts"]',
    title: 'Never face a blank page', body: 'Ideas become drafts and move through review to published — automatically.' },
  { id: 'post-review', section: 'content', sub: 'posts', target: '[data-tour="post-lifecycle"]',
    title: 'It sounds like you, never slop', body: 'Every post is voice-trained and quality-checked before it reaches you.' },
  { id: 'calendar',    section: 'content', sub: 'calendar', target: '[data-tour="calendar"]',
    title: 'A feed that never goes quiet', body: 'Approved content schedules itself into a steady publishing rhythm.' },
  { id: 'leadmagnets', section: 'content', sub: 'leadmagnets', target: '[data-tour="leadmagnets"]',
    title: 'Attention → qualified leads', body: 'One idea becomes a live lead magnet that captures and qualifies signups.' },
  { id: 'styles',      section: 'content', sub: 'styles', target: '[data-tour="styles"]',
    title: 'One idea becomes everything', body: 'The same idea renders into nine on-brand carousel styles and video.' },
  { id: 'performance', section: 'content', sub: 'performance', target: '[data-tour="performance"]',
    title: 'It learns what lands', body: 'Real LinkedIn performance feeds back into what gets posted next.' },
];
