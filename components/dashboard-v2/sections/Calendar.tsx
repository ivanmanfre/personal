import React, { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../../lib/supabase';
import { toastError } from '../../../lib/dashboardActions';
import { useContentLibrary } from '../../../hooks/useContentLibrary';
import { useContentPipeline } from '../../../hooks/useContentPipeline';
import PostCalendarView, { type CalendarItem } from '../../dashboard/PostCalendarView';
import { Sheet } from '../../ui/Sheet';
import CarouselEditor from '../../dashboard/CarouselEditor';
import { buildCalendarItems } from './calendarItems';
import { useLeadMagnets } from '../../../hooks/useLeadMagnets';
import LeadMagnetEditor from '../../dashboard/LeadMagnetEditor';
import ScheduledPostEditor from '../../dashboard/ScheduledPostEditor';

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

export function Calendar() {
  const { drafts: posts, applyOptimistic, refresh: refreshPosts } = useContentLibrary();
  const { posts: queue, refresh: refreshQueue } = useContentPipeline();

  // Right-sheet editor — only opens for posts (LM editor lives elsewhere).
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const openPost = useMemo(() => posts.find((d) => d.id === openPostId) || null, [posts, openPostId]);

  const { drafts: lmDrafts, refresh: refreshLm } = useLeadMagnets();
  const [openLmId, setOpenLmId] = useState<string | null>(null);
  const openLm = useMemo(() => lmDrafts.find((d) => d.id === openLmId) || null, [lmDrafts, openLmId]);

  const [openQueueId, setOpenQueueId] = useState<string | null>(null);
  const openQueue = useMemo(() => queue.find((q) => q.id === openQueueId) || null, [queue, openQueueId]);

  const items: CalendarItem[] = useMemo(
    () => buildCalendarItems(
      posts.map((p) => ({ id: p.id, title: p.title, status: p.status, scheduledAt: p.scheduledAt })),
      queue.map((qr) => ({
        id: qr.id,
        clickupTaskId: qr.clickupTaskId,
        postText: qr.postText,
        platform: qr.platform,
        status: qr.status,
        scheduledAt: qr.scheduledAt,
      })),
    ),
    [posts, queue],
  );

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
      // Keep the publish queue in lockstep with the operator's intent. The bridge
      // workflow only re-syncs future-dated drafts on a 5-min cron; writing the
      // linked pending scheduled_posts row here makes the move instant and also
      // covers past-dated reschedules the bridge skips (scheduled_at>now filter).
      // Only pending rows — never re-time a post that already went out / was
      // cancelled. clickup_task_id holds the draft id post-migration; see the
      // "Bridge: carousel_drafts → scheduled_posts" workflow.
      if (nextISO) {
        const { error: qErr } = await supabase
          .from('scheduled_posts')
          .update({ scheduled_at: nextISO })
          .eq('clickup_task_id', item.id)
          .eq('status', 'pending');
        if (qErr) throw qErr;
      }
      toast.success('Rescheduled');
      refreshQueue();
    } catch (err) {
      toastError('reschedule', err);
      refreshPosts();
    }
  }, [posts, applyOptimistic, refreshPosts, refreshQueue]);

  const rescheduleQueueRow = useCallback(async (item: CalendarItem, isoDate: string) => {
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
    return item.kind === 'post' ? reschedulePost(item, isoDate) : rescheduleQueueRow(item, isoDate);
  }, [reschedulePost, rescheduleQueueRow]);

  const onOpenItem = useCallback((item: CalendarItem) => {
    if (item.kind === 'post') {
      setOpenPostId(item.id);
    } else if (item.kind === 'lm') {
      if (item.editId) setOpenLmId(item.editId);
      else toast.error('No lead-magnet draft linked to this post');
    } else {
      setOpenQueueId(item.id); // post-queue → ScheduledPostEditor (Task 6)
    }
  }, []);

  return (
    <div className="space-y-4">
      <PostCalendarView items={items} onOpenItem={onOpenItem} onReschedule={onReschedule} />

      {/* Post editor sheet — only opens for kind='post'. */}
      <Sheet open={!!openPost} onClose={() => setOpenPostId(null)} size="full" title={openPost ? <span className="truncate">{openPost.title}</span> : ''}>
        {openPost && <CarouselEditor draft={openPost} onClose={() => setOpenPostId(null)} onChanged={refreshPosts} />}
      </Sheet>

      <Sheet open={!!openLm} onClose={() => setOpenLmId(null)} size="full"
        title={openLm ? <span className="truncate">{openLm.topic || 'Lead magnet'}</span> : ''}>
        {openLm && (
          <LeadMagnetEditor draft={openLm} onClose={() => setOpenLmId(null)} onChanged={() => { refreshLm(); refreshQueue(); }} />
        )}
      </Sheet>

      <Sheet open={!!openQueue} onClose={() => setOpenQueueId(null)} size="lg"
        title={openQueue ? 'Scheduled post' : ''}>
        {openQueue && (
          <ScheduledPostEditor post={openQueue} onClose={() => setOpenQueueId(null)} onChanged={refreshQueue} />
        )}
      </Sheet>
    </div>
  );
}
