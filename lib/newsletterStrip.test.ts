import { describe, it, expect } from 'vitest';
import { deriveIssueTimeline } from './newsletterStrip';

describe('deriveIssueTimeline', () => {
  it('returns nulls and zero counts for empty input', () => {
    expect(deriveIssueTimeline([])).toEqual({
      nextScheduledAt: null,
      lastSentAt: null,
      sentCount: 0,
      scheduledCount: 0,
      draftCount: 0,
    });
  });

  it('picks the earliest scheduled and latest sent', () => {
    const out = deriveIssueTimeline([
      { status: 'scheduled', scheduledFor: '2026-07-10T09:00:00Z', sentAt: null },
      { status: 'scheduled', scheduledFor: '2026-07-05T09:00:00Z', sentAt: null },
      { status: 'sent', scheduledFor: null, sentAt: '2026-06-20T09:00:00Z' },
      { status: 'sent', scheduledFor: null, sentAt: '2026-06-28T09:00:00Z' },
      { status: 'draft', scheduledFor: null, sentAt: null },
    ]);
    expect(out.nextScheduledAt).toBe('2026-07-05T09:00:00Z');
    expect(out.lastSentAt).toBe('2026-06-28T09:00:00Z');
    expect(out.scheduledCount).toBe(2);
    expect(out.sentCount).toBe(2);
    expect(out.draftCount).toBe(1);
  });

  it('ignores scheduled rows with null scheduledFor and sent rows with null sentAt', () => {
    const out = deriveIssueTimeline([
      { status: 'scheduled', scheduledFor: null, sentAt: null },
      { status: 'sent', scheduledFor: null, sentAt: null },
    ]);
    expect(out.nextScheduledAt).toBeNull();
    expect(out.lastSentAt).toBeNull();
    expect(out.scheduledCount).toBe(1);
    expect(out.sentCount).toBe(1);
  });
});
