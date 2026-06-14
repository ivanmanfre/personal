import { TOUR_STEPS, type TourStep } from './tourSteps';

// Content Studio subs that are polished enough to show live.
export const DEMO_SAFE = new Set<string>([
  'posts', 'leadmagnets', 'styles', 'calendar', 'performance', 'video',
]);

// Tour steps minus anything that would land on an unfinished surface.
export function getTourSteps(): TourStep[] {
  return TOUR_STEPS.filter(s => !s.sub || DEMO_SAFE.has(s.sub));
}
