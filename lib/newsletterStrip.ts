export interface IssueTimelineInput {
  status: string;
  scheduledFor: string | null;
  sentAt: string | null;
}

export interface IssueTimeline {
  nextScheduledAt: string | null;
  lastSentAt: string | null;
  sentCount: number;
  scheduledCount: number;
  draftCount: number;
}

/**
 * Derive next-scheduled and last-sent timestamps (plus status tallies) from
 * the already-fetched newsletter issues. ISO-8601 strings sort lexically, so
 * plain string comparison gives correct chronological order.
 */
export function deriveIssueTimeline(issues: IssueTimelineInput[]): IssueTimeline {
  let nextScheduledAt: string | null = null;
  let lastSentAt: string | null = null;
  let sentCount = 0;
  let scheduledCount = 0;
  let draftCount = 0;

  for (const i of issues) {
    if (i.status === 'scheduled') {
      scheduledCount++;
      if (i.scheduledFor && (nextScheduledAt === null || i.scheduledFor < nextScheduledAt)) {
        nextScheduledAt = i.scheduledFor;
      }
    } else if (i.status === 'sent') {
      sentCount++;
      if (i.sentAt && (lastSentAt === null || i.sentAt > lastSentAt)) {
        lastSentAt = i.sentAt;
      }
    } else if (i.status === 'draft') {
      draftCount++;
    }
  }

  return { nextScheduledAt, lastSentAt, sentCount, scheduledCount, draftCount };
}
