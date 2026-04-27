import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { toastError } from '../lib/dashboardActions';

export interface SequencePerf {
  slug: string;
  name: string;
  subscribersTotal: number;
  unsubscribed: number;
  emailsSent: number;
  emailsFailed: number;
  opens: number;
  clicks: number;
  bounces: number;
}

export interface SubscriberRow {
  id: string;
  email: string;
  sequenceId: string;
  lmSlug: string | null;
  lmTitle: string | null;
  currentStep: number;
  unsubscribedAt: string | null;
  createdAt: string;
}

export interface QueueRow {
  id: string;
  subscriberEmail: string | null;
  emailId: string;
  scheduledFor: string;
  sentAt: string | null;
  status: string;
  errorMessage: string | null;
  attemptCount: number;
  emailStep: number | null;
  emailSubject: string | null;
  emailPreview: string | null;
  sequenceName: string | null;
}

export interface EventRow {
  id: string;
  subscriberId: string | null;
  subscriberEmail: string | null;
  eventType: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface CaptureRow {
  id: string;
  email: string | null;
  src: string | null;
  createdAt: string;
}

export interface IssueRow {
  id: string;
  slug: string;
  subject: string;
  preview: string | null;
  format: string;
  status: string;
  scheduledFor: string | null;
  sentAt: string | null;
  recipientCount: number;
  deliveredCount: number;
  opensCount: number;
  clicksCount: number;
  bouncesCount: number;
  unsubscribesCount: number;
  complaintsCount: number;
  errorMessage: string | null;
  createdAt: string;
}

export interface NewsletterData {
  performance: SequencePerf[];
  subscribers: SubscriberRow[];
  queue: QueueRow[];
  events: EventRow[];
  captures: CaptureRow[];
  issues: IssueRow[];
}

function emptyData(): NewsletterData {
  return { performance: [], subscribers: [], queue: [], events: [], captures: [], issues: [] };
}

export function useNewsletter() {
  const [data, setData] = useState<NewsletterData>(emptyData);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const [perfRes, subsRes, queueRes, eventsRes, capturesRes, issuesRes] = await Promise.all([
        supabase.from('nurture_performance').select('*'),
        supabase
          .from('nurture_subscribers')
          .select('id, email, sequence_id, lm_slug, lm_title, current_step, unsubscribed_at, created_at')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('nurture_queue')
          .select('id, subscriber_id, email_id, scheduled_for, sent_at, status, error_message, attempt_count, nurture_subscribers(email), nurture_emails(step, subject, preview, sequence_id, nurture_sequences(name))')
          .order('scheduled_for', { ascending: false })
          .limit(100),
        supabase
          .from('nurture_events')
          .select('id, subscriber_id, event_type, metadata, created_at, nurture_subscribers(email)')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('lm_events')
          .select('id, email, src, created_at')
          .eq('lm_slug', 'agent-ready-letter')
          .eq('event_type', 'capture')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('newsletter_issues')
          .select('id, slug, subject, preview, format, status, scheduled_for, sent_at, recipient_count, delivered_count, opens_count, clicks_count, bounces_count, unsubscribes_count, complaints_count, error_message, created_at')
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      setData({
        performance: (perfRes.data || []).map((r: any) => ({
          slug: r.slug,
          name: r.name,
          subscribersTotal: Number(r.subscribers_total) || 0,
          unsubscribed: Number(r.unsubscribed) || 0,
          emailsSent: Number(r.emails_sent) || 0,
          emailsFailed: Number(r.emails_failed) || 0,
          opens: Number(r.opens) || 0,
          clicks: Number(r.clicks) || 0,
          bounces: Number(r.bounces) || 0,
        })),
        subscribers: (subsRes.data || []).map((r: any) => ({
          id: r.id,
          email: r.email,
          sequenceId: r.sequence_id,
          lmSlug: r.lm_slug,
          lmTitle: r.lm_title,
          currentStep: Number(r.current_step) || 0,
          unsubscribedAt: r.unsubscribed_at,
          createdAt: r.created_at,
        })),
        queue: (queueRes.data || []).map((r: any) => ({
          id: r.id,
          subscriberEmail: r.nurture_subscribers?.email ?? null,
          emailId: r.email_id,
          scheduledFor: r.scheduled_for,
          sentAt: r.sent_at,
          status: r.status,
          errorMessage: r.error_message,
          attemptCount: Number(r.attempt_count) || 0,
          emailStep: r.nurture_emails?.step ?? null,
          emailSubject: r.nurture_emails?.subject ?? null,
          emailPreview: r.nurture_emails?.preview ?? null,
          sequenceName: r.nurture_emails?.nurture_sequences?.name ?? null,
        })),
        events: (eventsRes.data || []).map((r: any) => ({
          id: r.id,
          subscriberId: r.subscriber_id,
          subscriberEmail: r.nurture_subscribers?.email ?? null,
          eventType: r.event_type,
          metadata: r.metadata,
          createdAt: r.created_at,
        })),
        captures: (capturesRes.data || []).map((r: any) => ({
          id: r.id,
          email: r.email,
          src: r.src,
          createdAt: r.created_at,
        })),
        issues: (issuesRes.data || []).map((r: any) => ({
          id: r.id,
          slug: r.slug,
          subject: r.subject,
          preview: r.preview,
          format: r.format,
          status: r.status,
          scheduledFor: r.scheduled_for,
          sentAt: r.sent_at,
          recipientCount: Number(r.recipient_count) || 0,
          deliveredCount: Number(r.delivered_count) || 0,
          opensCount: Number(r.opens_count) || 0,
          clicksCount: Number(r.clicks_count) || 0,
          bouncesCount: Number(r.bounces_count) || 0,
          unsubscribesCount: Number(r.unsubscribes_count) || 0,
          complaintsCount: Number(r.complaints_count) || 0,
          errorMessage: r.error_message,
          createdAt: r.created_at,
        })),
      });
    } catch (err) {
      toastError('load newsletter', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const totals = useMemo(() => {
    const now = Date.now();
    const ms30d = 30 * 24 * 3600 * 1000;
    const ms7d = 7 * 24 * 3600 * 1000;
    const activeSubs = data.subscribers.filter((s) => !s.unsubscribedAt).length;
    const subs30d = data.subscribers.filter(
      (s) => !s.unsubscribedAt && now - new Date(s.createdAt).getTime() < ms30d
    ).length;
    const subsPrev30d = data.subscribers.filter((s) => {
      const t = now - new Date(s.createdAt).getTime();
      return !s.unsubscribedAt && t >= ms30d && t < 2 * ms30d;
    }).length;
    const subs7d = data.subscribers.filter(
      (s) => !s.unsubscribedAt && now - new Date(s.createdAt).getTime() < ms7d
    ).length;
    const pending = data.queue.filter((q) => q.status === 'pending').length;
    const failed = data.queue.filter((q) => q.status === 'failed').length;
    const events7d = data.events.filter((e) => now - new Date(e.createdAt).getTime() < ms7d);
    const delivered7d = events7d.filter((e) => e.eventType === 'delivered').length;
    const opened7d = events7d.filter((e) => e.eventType === 'opened').length;
    const clicked7d = events7d.filter((e) => e.eventType === 'clicked').length;
    const openRate7d = delivered7d > 0 ? Math.round((opened7d / delivered7d) * 100) : 0;
    const clickRate7d = delivered7d > 0 ? Math.round((clicked7d / delivered7d) * 100) : 0;
    const unsubs30d = data.subscribers.filter(
      (s) => s.unsubscribedAt && now - new Date(s.unsubscribedAt).getTime() < ms30d
    ).length;
    const captures7d = data.captures.filter((c) => now - new Date(c.createdAt).getTime() < ms7d).length;
    return {
      activeSubs,
      subs30d,
      subsPrev30d,
      subs7d,
      pending,
      failed,
      openRate7d,
      clickRate7d,
      unsubs30d,
      captures7d,
      delivered7d,
      opened7d,
      clicked7d,
    };
  }, [data]);

  return { data, totals, loading, refresh: fetch };
}
