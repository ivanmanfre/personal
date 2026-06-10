import type { CalendarItem, CalendarTone } from '../../dashboard/PostCalendarView';

/** Minimal shape from useContentLibrary (carousel_drafts). */
export interface PostRow {
  id: string;
  title: string;
  status: string;
  scheduledAt: string | null;
}

/** Minimal shape from useContentPipeline (scheduled_posts). */
export interface QueueRow {
  id: string;
  clickupTaskId: string | null;
  postText: string;
  platform: string | null;
  status: string;
  scheduledAt: string | null;
}

const LM_PATTERN = /\bcomment\s+["“”]?(\w+)["“”]?\b/i;

// scheduled_posts.status → calendar tone vocabulary.
const SP_STATUS_TO_TONE: Record<string, CalendarTone> = {
  pending: 'scheduled',
  queued_v2: 'scheduled',
  posting: 'generating',
  posted: 'published',
  failed: 'failed',
  cancelled: 'cancelled',
};

function isLinkedIn(platform: string | null): boolean {
  return !platform || platform === 'linkedin';
}

function queueTitle(postText: string, keyword?: string): string {
  const firstLine = (postText.split('\n').find((l) => l.trim()) || '').trim();
  const base = firstLine.length > 60 ? firstLine.slice(0, 60) + '…' : firstLine;
  if (keyword) return `${keyword} — ${base || keyword}`;
  return base || '(untitled)';
}

/**
 * Merge the three calendar sources into a single chip list:
 *  - `post`       ← carousel_drafts with a scheduledAt
 *  - `lm`         ← LinkedIn scheduled_posts matching the "comment X" CTA
 *  - `post-queue` ← LinkedIn scheduled_posts that are neither LM nor already
 *                   shown as a post (clickupTaskId not in draft ids)
 * LinkedIn-only. Precedence post > lm > post-queue.
 */
export function buildCalendarItems(posts: PostRow[], queue: QueueRow[]): CalendarItem[] {
  const out: CalendarItem[] = [];
  const draftIds = new Set(posts.map((p) => p.id));

  for (const p of posts) {
    if (!p.scheduledAt) continue;
    out.push({
      id: p.id,
      title: p.title,
      kind: 'post',
      scheduledAt: p.scheduledAt,
      tone: (p.status as CalendarTone) || 'scheduled',
      statusLabel: p.status,
    });
  }

  for (const qr of queue) {
    if (!isLinkedIn(qr.platform)) continue;
    // Already represented as a post chip — skip its queue twin.
    if (qr.clickupTaskId && draftIds.has(qr.clickupTaskId)) continue;
    const tone = SP_STATUS_TO_TONE[qr.status] || 'scheduled';
    const lm = qr.postText.match(LM_PATTERN);
    if (lm) {
      out.push({
        id: qr.id,
        title: queueTitle(qr.postText, lm[1].toUpperCase()),
        kind: 'lm',
        editId: qr.clickupTaskId || undefined,
        scheduledAt: qr.scheduledAt,
        tone,
        statusLabel: qr.status,
      });
    } else {
      out.push({
        id: qr.id,
        title: queueTitle(qr.postText),
        kind: 'post-queue',
        scheduledAt: qr.scheduledAt,
        tone,
        statusLabel: qr.status,
      });
    }
  }
  return out;
}
