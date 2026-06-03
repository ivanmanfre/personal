import React, { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../../lib/supabase';
import { toastError } from '../../../lib/dashboardActions';
import { useContentLibrary } from '../../../hooks/useContentLibrary';
import { useContentPipeline } from '../../../hooks/useContentPipeline';
import { useDashboard } from '../../../contexts/DashboardContext';
import PostCalendarView, { type CalendarItem, type CalendarTone } from '../../dashboard/PostCalendarView';
import { Sheet } from '../../ui/Sheet';
import CarouselEditor from '../../dashboard/CarouselEditor';

/**
 * Unified content calendar — posts (carousel_drafts) + lead magnets
 * (scheduled_posts where the post text matches the "comment X" LM pattern).
 *
 * Why two sources:
 *  - carousel_drafts.scheduled_at carries the operator's INTENT for posts.
 *    Once approved the bridge workflow copies the row into scheduled_posts,
 *    but draft.scheduled_at is the canonical schedule the editor edits.
 *  - LMs don't carry their own scheduled_at on lm_drafts_v2. Their schedule
 *    only exists once the publisher queue row lands in scheduled_posts.
 *    Filtering by the "comment <keyword>" pattern (same regex ContentPanel
 *    used before deletion) gets us LM rows specifically.
 *
 * The two sources never collide on the same chip: posts surface from drafts;
 * LMs surface from scheduled_posts.
 */

const LM_PATTERN = /\bcomment\s+["“”]?(\w+)["“”]?\b/i;

// scheduled_posts statuses → tone vocabulary the generic calendar understands.
const SP_STATUS_TO_TONE: Record<string, CalendarTone> = {
  pending: 'scheduled',
  posting: 'generating',
  posted: 'published',
  failed: 'failed',
  cancelled: 'cancelled',
};

export function Calendar() {
  const { drafts: posts, applyOptimistic, refresh: refreshPosts } = useContentLibrary();
  const { posts: queue, refresh: refreshQueue } = useContentPipeline();
  const { userTimezone } = useDashboard();

  // Right-sheet editor — only opens for posts (LM editor lives elsewhere).
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const openPost = useMemo(() => posts.find((d) => d.id === openPostId) || null, [posts, openPostId]);

  const items: CalendarItem[] = useMemo(() => {
    const out: CalendarItem[] = [];
    // Posts — carousel_drafts.scheduled_at. Only render rows that ACTUALLY
    // have a scheduled date, regardless of status (idea/error rows with no
    // scheduled_at are excluded by the inner `if`).
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
    // Lead magnets — scheduled_posts rows that match the comment-keyword pattern.
    // We extract the keyword for the chip label so the chip reads "Keyword: …"
    // rather than the first words of the post body.
    for (const q of queue) {
      const match = q.postText.match(LM_PATTERN);
      if (!match) continue;
      const keyword = match[1].toUpperCase();
      // Use the first non-empty line as title fallback; fall back to keyword.
      const firstLine = (q.postText.split('\n').find((l) => l.trim()) || '').trim();
      const title = firstLine.length > 60 ? firstLine.slice(0, 60) + '…' : firstLine || keyword;
      out.push({
        id: q.id,
        title: `${keyword} — ${title}`,
        kind: 'lm',
        scheduledAt: q.scheduledAt,
        tone: SP_STATUS_TO_TONE[q.status] || 'scheduled',
        statusLabel: q.status,
      });
    }
    return out;
  }, [posts, queue]);

  const reschedulePost = useCallback(async (item: CalendarItem, isoDate: string) => {
    const cur = posts.find((d) => d.id === item.id)?.scheduledAt;
    let nextISO: string | null = null;
    if (isoDate) {
      const [y, m, d] = isoDate.split('-').map(Number);
      const base = cur ? new Date(cur) : new Date();
      base.setFullYear(y, m - 1, d);
      if (!cur) base.setHours(9, 0, 0, 0);
      nextISO = base.toISOString();
    }
    applyOptimistic(item.id, { scheduledAt: nextISO });
    try {
      const { error } = await supabase.from('carousel_drafts').update({ scheduled_at: nextISO }).eq('id', item.id);
      if (error) throw error;
      toast.success('Rescheduled');
    } catch (err) {
      toastError('reschedule', err);
      refreshPosts();
    }
  }, [posts, applyOptimistic, refreshPosts]);

  const rescheduleLm = useCallback(async (item: CalendarItem, isoDate: string) => {
    // LM lives in scheduled_posts. Preserve time-of-day if the row had one;
    // otherwise default to 09:00 in the operator's timezone (matches the
    // posts side).
    const cur = queue.find((q) => q.id === item.id)?.scheduledAt;
    let nextISO: string;
    if (isoDate) {
      const [y, m, d] = isoDate.split('-').map(Number);
      const base = cur ? new Date(cur) : new Date();
      base.setFullYear(y, m - 1, d);
      if (!cur) base.setHours(9, 0, 0, 0);
      nextISO = base.toISOString();
    } else {
      return;
    }
    try {
      const { error } = await supabase.from('scheduled_posts').update({ scheduled_at: nextISO }).eq('id', item.id);
      if (error) throw error;
      toast.success('Rescheduled');
      refreshQueue();
    } catch (err) {
      toastError('reschedule LM', err);
    }
  }, [queue, refreshQueue]);

  const onReschedule = useCallback((item: CalendarItem, isoDate: string) => {
    return item.kind === 'post' ? reschedulePost(item, isoDate) : rescheduleLm(item, isoDate);
  }, [reschedulePost, rescheduleLm]);

  const onOpenItem = useCallback((item: CalendarItem) => {
    if (item.kind === 'post') {
      setOpenPostId(item.id);
    } else {
      // LM — for now route to the Lead Magnets section editor via URL. The
      // LeadMagnetStudioPanel keys off ?open=<id> the same way Posts does.
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('section', 'content');
        url.searchParams.set('sub', 'leadmagnets');
        url.searchParams.set('open', item.id);
        window.location.assign(url.toString());
      }
    }
  }, []);

  return (
    <div className="space-y-4">
      <PostCalendarView items={items} onOpenItem={onOpenItem} onReschedule={onReschedule} />

      {/* Post editor sheet — only opens for kind='post'. LMs deeplink out. */}
      <Sheet open={!!openPost} onClose={() => setOpenPostId(null)} size="full" title={openPost ? <span className="truncate">{openPost.title}</span> : ''}>
        {openPost && <CarouselEditor draft={openPost} onClose={() => setOpenPostId(null)} onChanged={refreshPosts} />}
      </Sheet>
    </div>
  );
}
