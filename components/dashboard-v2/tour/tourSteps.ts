import type { SectionId } from '../lib/navBus';
import type { TourIntent } from './tourBus';

export interface TourStep {
  id: string;
  section: SectionId;
  sub?: string;            // ContentStudio sub-tab key
  target?: string;         // CSS selector ([data-tour="..."]); omitted on sheet-driven steps
  intent?: TourIntent;     // UI state to trigger in the target panel (open form / open editor)
  opensSheet?: boolean;    // step opens a full editor sheet → suppress scrim + spotlight
  title: string;           // outcome headline
  body: string;            // one-line narrator copy
}

// Task-based walkthrough: the demo follows what an operator actually does —
// see the pipeline → create a post → edit it → schedule it → turn it into a
// lead magnet → watch it learn. It deliberately does NOT start on the Morning
// Dispatch and does NOT just hop between section labels.
export const TOUR_STEPS: TourStep[] = [
  { id: 'pipeline', section: 'content', sub: 'posts', target: '[data-tour="posts"]',
    title: 'Your content pipeline',
    body: 'A week of posts, drafted, reviewed, and shipped to LinkedIn without you writing them.' },
  { id: 'create', section: 'content', sub: 'posts', intent: 'posts-compose', target: '[data-tour="new-post"]',
    title: 'Turn one line into a post',
    body: 'Type a single idea. The system writes the hook, body, and image in your trained voice.' },
  { id: 'edit', section: 'content', sub: 'posts', intent: 'posts-edit', opensSheet: true,
    title: 'Edit anything before it ships',
    body: 'Every draft is quality-checked and voice-matched. Tweak the copy, swap the image, or change the timing right here.' },
  { id: 'schedule', section: 'content', sub: 'calendar', target: '[data-tour="calendar"]',
    title: 'It schedules itself',
    body: 'Approve a post and it drops into a steady publishing rhythm. Your feed never goes quiet.' },
  { id: 'leadmagnet', section: 'content', sub: 'leadmagnets', target: '[data-tour="leadmagnets"]',
    title: 'The same idea captures leads',
    body: 'One topic also becomes an interactive lead magnet on a live page that qualifies every signup.' },
  { id: 'performance', section: 'content', sub: 'performance', target: '[data-tour="performance"]',
    title: 'And it learns what lands',
    body: 'Real LinkedIn results feed back in, so the system doubles down on what actually works.' },
];
