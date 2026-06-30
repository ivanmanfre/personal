import type { CalendarItem } from '../../dashboard/PostCalendarView';

export type LmChipTarget =
  | { target: 'queue'; id: string }
  | { target: 'lm-editor'; id: string }
  | { target: 'error' };

/**
 * Decide what a click on an LM calendar chip opens.
 * Repost rows that are still pending (tone 'scheduled') open the queue editor so the
 * edit lands on the exact text that posts. Everything else keeps the full LM editor.
 */
export function resolveLmChipTarget(item: CalendarItem): LmChipTarget {
  if (item.isRepost && item.tone === 'scheduled') return { target: 'queue', id: item.id };
  if (item.editId) return { target: 'lm-editor', id: item.editId };
  return { target: 'error' };
}
