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

// A chip can only be dragged if its underlying row can still be re-timed.
// Queue rows (lm/post-queue) re-time only while pending/queued_v2 (matches the
// scheduled_posts update guard); carousel posts re-time until published.
// Locking the rest stops drags that silently no-op and snap back.
const QUEUE_RESCHEDULABLE = new Set(['pending', 'queued_v2']);
function isReschedulable(kind: CalendarItem['kind'], status: string): boolean {
  return kind === 'post' ? status !== 'published' : QUEUE_RESCHEDULABLE.has(status);
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
 *  - `lm`         ← LinkedIn scheduled_posts whose clickupTaskId is a real
 *                   lm_drafts_v2 id (so the LM editor can open it)
 *  - `post-queue` ← every other LinkedIn scheduled_posts row not already shown
 *                   as a post (editable via ScheduledPostEditor)
 * The "comment X" pattern is used ONLY to extract a keyword label — NOT to
 * decide LM-vs-post. Many regular posts carry a comment-gate CTA without being
 * lead magnets; routing those to the LM editor (which needs an lm_drafts_v2
 * row) would silently fail to open. LinkedIn-only. Precedence post > lm > post-queue.
 */
export function buildCalendarItems(posts: PostRow[], queue: QueueRow[], lmDraftIds: string[] = []): CalendarItem[] {
  const out: CalendarItem[] = [];
  const draftIds = new Set(posts.map((p) => p.id));
  const lmIds = new Set(lmDraftIds);

  for (const p of posts) {
    if (!p.scheduledAt) continue;
    out.push({
      id: p.id,
      title: p.title,
      kind: 'post',
      scheduledAt: p.scheduledAt,
      tone: (p.status as CalendarTone) || 'scheduled',
      statusLabel: p.status,
      reschedulable: isReschedulable('post', p.status),
    });
  }

  for (const qr of queue) {
    if (!isLinkedIn(qr.platform)) continue;
    // Already represented as a post chip — skip its queue twin.
    if (qr.clickupTaskId && draftIds.has(qr.clickupTaskId)) continue;
    const tone = SP_STATUS_TO_TONE[qr.status] || 'scheduled';
    const isLm = !!qr.clickupTaskId && lmIds.has(qr.clickupTaskId);
    if (isLm) {
      const lm = qr.postText.match(LM_PATTERN);
      out.push({
        id: qr.id,
        title: queueTitle(qr.postText, lm ? lm[1].toUpperCase() : undefined),
        kind: 'lm',
        editId: qr.clickupTaskId || undefined,
        scheduledAt: qr.scheduledAt,
        tone,
        statusLabel: qr.status,
        reschedulable: isReschedulable('lm', qr.status),
      });
    } else {
      out.push({
        id: qr.id,
        title: queueTitle(qr.postText),
        kind: 'post-queue',
        scheduledAt: qr.scheduledAt,
        tone,
        statusLabel: qr.status,
        reschedulable: isReschedulable('post-queue', qr.status),
      });
    }
  }
  return out;
}
