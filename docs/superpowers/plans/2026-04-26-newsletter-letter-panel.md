# Newsletter "Letter" Panel Implementation Plan

> **For agentic workers:** Execute task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new "Letter" dashboard panel that surfaces nurture-driven newsletter activity (subscribers, queued sends, sequence performance, recent events) for The Agent-Ready Letter and any future newsletter-format sequences.

**Architecture:** Reuse the existing `nurture_*` Supabase tables and `nurture_performance` view (no new tables). Follow the established panel pattern: typed hook (`useNewsletter`) → presentational panel (`LetterPanel`) → lazy import in `Dashboard.tsx` → sidebar entry in `DashboardLayout.tsx`. Place the tab inside the **Content** group between `audience` and `content` since the newsletter is a content distribution channel.

**Tech Stack:** React + TypeScript, Supabase JS client, recharts, lucide-react, Tailwind, shared `StatCard` / `LoadingSkeleton` / `RefreshIndicator` / `EmptyState` components.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `types/dashboard.ts` | Modify | Add `'letter'` to `Tab` union |
| `hooks/useNewsletter.ts` | Create | Single hook fetching subscribers, queue, events, performance, lm_events captures |
| `components/dashboard/LetterPanel.tsx` | Create | Renders all sections of the panel |
| `components/dashboard/Dashboard.tsx` | Modify | Lazy-import + register in `panelComponents` + prefetch list |
| `components/dashboard/DashboardLayout.tsx` | Modify | Add tab entry in `Content` group |

No new edge functions, no migrations, no n8n changes — the upstream pipeline is already wired (footer form → `lm-beacon` → `nurture_queue` → `Nurture Sender (Resend)` → `nurture_events`).

---

## Task 1: Add `letter` to Tab union

**Files:**
- Modify: `types/dashboard.ts:803`

- [ ] **Step 1**: Append `| 'letter'` to the `Tab` union (place it logically after `'audience'`).

- [ ] **Step 2**: Build typecheck — `npx tsc --noEmit` — expect no new errors.

---

## Task 2: Create `useNewsletter` hook

**Files:**
- Create: `hooks/useNewsletter.ts`

The hook fetches:
- `nurture_performance` view (per-sequence aggregates)
- `nurture_subscribers` (full list, ordered by `created_at` desc, limit 200)
- `nurture_queue` joined with `nurture_subscribers` for upcoming/recent sends (limit 100, ordered by `scheduled_for` desc)
- `nurture_events` (last 50 events, ordered desc)
- `lm_events` filtered to `event_type='capture' AND lm_slug='agent-ready-letter'` for top-of-funnel signups

It then computes hero totals (active subscribers, last-30d net new, pending queue, 7d open rate, 30d unsubs, last 7d signups).

- [ ] **Step 1**: Create the file with the full implementation:

```ts
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
  status: string; // pending | sent | failed | skipped | cancelled
  errorMessage: string | null;
  attemptCount: number;
}

export interface EventRow {
  id: string;
  subscriberId: string | null;
  eventType: string; // delivered | opened | clicked | bounced | complained | unsubscribed
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface CaptureRow {
  id: string;
  email: string | null;
  src: string | null;
  createdAt: string;
}

export interface NewsletterData {
  performance: SequencePerf[];
  subscribers: SubscriberRow[];
  queue: QueueRow[];
  events: EventRow[];
  captures: CaptureRow[];
}

function emptyData(): NewsletterData {
  return { performance: [], subscribers: [], queue: [], events: [], captures: [] };
}

export function useNewsletter() {
  const [data, setData] = useState<NewsletterData>(emptyData);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const [perfRes, subsRes, queueRes, eventsRes, capturesRes] = await Promise.all([
        supabase.from('nurture_performance').select('*'),
        supabase.from('nurture_subscribers')
          .select('id, email, sequence_id, lm_slug, lm_title, current_step, unsubscribed_at, created_at')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase.from('nurture_queue')
          .select('id, subscriber_id, email_id, scheduled_for, sent_at, status, error_message, attempt_count, nurture_subscribers(email)')
          .order('scheduled_for', { ascending: false })
          .limit(100),
        supabase.from('nurture_events')
          .select('id, subscriber_id, event_type, metadata, created_at')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase.from('lm_events')
          .select('id, email, src, created_at')
          .eq('lm_slug', 'agent-ready-letter')
          .eq('event_type', 'capture')
          .order('created_at', { ascending: false })
          .limit(100),
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
        })),
        events: (eventsRes.data || []).map((r: any) => ({
          id: r.id,
          subscriberId: r.subscriber_id,
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
      });
    } catch (err) {
      toastError('load newsletter', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const totals = useMemo(() => {
    const now = Date.now();
    const ms30d = 30 * 24 * 3600 * 1000;
    const ms7d = 7 * 24 * 3600 * 1000;
    const activeSubs = data.subscribers.filter((s) => !s.unsubscribedAt).length;
    const subs30d = data.subscribers.filter((s) => !s.unsubscribedAt && now - new Date(s.createdAt).getTime() < ms30d).length;
    const subsPrev30d = data.subscribers.filter((s) => {
      const t = now - new Date(s.createdAt).getTime();
      return !s.unsubscribedAt && t >= ms30d && t < 2 * ms30d;
    }).length;
    const subs7d = data.subscribers.filter((s) => !s.unsubscribedAt && now - new Date(s.createdAt).getTime() < ms7d).length;
    const pending = data.queue.filter((q) => q.status === 'pending').length;
    const failed = data.queue.filter((q) => q.status === 'failed').length;
    const events7d = data.events.filter((e) => now - new Date(e.createdAt).getTime() < ms7d);
    const delivered7d = events7d.filter((e) => e.eventType === 'delivered').length;
    const opened7d = events7d.filter((e) => e.eventType === 'opened').length;
    const clicked7d = events7d.filter((e) => e.eventType === 'clicked').length;
    const openRate7d = delivered7d > 0 ? Math.round((opened7d / delivered7d) * 100) : 0;
    const clickRate7d = delivered7d > 0 ? Math.round((clicked7d / delivered7d) * 100) : 0;
    const unsubs30d = data.subscribers.filter((s) => s.unsubscribedAt && now - new Date(s.unsubscribedAt).getTime() < ms30d).length;
    const captures7d = data.captures.filter((c) => now - new Date(c.createdAt).getTime() < ms7d).length;
    return { activeSubs, subs30d, subsPrev30d, subs7d, pending, failed, openRate7d, clickRate7d, unsubs30d, captures7d, delivered7d, opened7d, clicked7d };
  }, [data]);

  return { data, totals, loading, refresh: fetch };
}
```

- [ ] **Step 2**: Typecheck — `npx tsc --noEmit` — expect no errors.

---

## Task 3: Create `LetterPanel` component

**Files:**
- Create: `components/dashboard/LetterPanel.tsx`

Sections (top → bottom):
1. Header (title + RefreshIndicator)
2. Stat cards: Active subscribers (with 30d trend), Pending queue, 7d open rate, 30d unsubs
3. Sequences table — rows from `nurture_performance` (only newsletter sequence shown for now, but renders any active sequence)
4. Queue table — next pending/most-recent sends with subscriber email + status
5. Subscribers list — email, sequence, current step, joined date, unsubscribed badge
6. Recent events feed — last 50 events with type pill + timestamp
7. Captures feed — top-of-funnel `lm_events` to confirm form is firing

- [ ] **Step 1**: Create the file:

```tsx
import React, { useMemo } from 'react';
import { Mail, Send, Eye, UserMinus, Inbox, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { useNewsletter } from '../../hooks/useNewsletter';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import StatCard from './shared/StatCard';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import EmptyState from './shared/EmptyState';

function pctChange(curr: number, prev: number): number {
  if (!prev) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
}

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

const statusStyles: Record<string, string> = {
  pending:   'bg-amber-500/15 text-amber-400 border-amber-500/30',
  sent:      'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  failed:    'bg-red-500/15 text-red-400 border-red-500/30',
  skipped:   'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  cancelled: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
};

const eventStyles: Record<string, string> = {
  delivered:    'bg-blue-500/15 text-blue-400 border-blue-500/30',
  opened:       'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  clicked:      'bg-purple-500/15 text-purple-400 border-purple-500/30',
  bounced:      'bg-red-500/15 text-red-400 border-red-500/30',
  complained:   'bg-red-500/15 text-red-400 border-red-500/30',
  unsubscribed: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
};

const LetterPanel: React.FC = () => {
  const { data, totals, loading, refresh } = useNewsletter();
  const { lastRefreshed } = useAutoRefresh(refresh);

  const hasAny = useMemo(
    () => data.subscribers.length > 0 || data.captures.length > 0 || data.performance.some((p) => p.subscribersTotal > 0),
    [data]
  );

  if (loading) return <LoadingSkeleton cards={4} rows={6} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">The Letter</h1>
          <p className="text-sm text-zinc-500 mt-1">Newsletter subscribers, queue, sequence performance, and Resend events.</p>
        </div>
        <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
      </div>

      {!hasAny ? (
        <EmptyState
          title="No subscribers yet"
          description="Once someone signs up via the footer form, they'll appear here within seconds. Open ivanmanfredi.com#newsletter to test."
          icon={<Mail className="w-10 h-10" />}
        />
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Active subscribers"
              value={totals.activeSubs}
              icon={<Mail className="w-5 h-5" />}
              color="text-emerald-400"
              trend={{ value: pctChange(totals.subs30d, totals.subsPrev30d), label: 'vs prev 30d' }}
              subValue={`+${totals.subs7d} last 7d`}
            />
            <StatCard
              label="Queue"
              value={totals.pending}
              icon={<Clock className="w-5 h-5" />}
              color={totals.failed > 0 ? 'text-amber-400' : 'text-blue-400'}
              subValue={totals.failed > 0 ? `${totals.failed} failed` : 'pending sends'}
            />
            <StatCard
              label="Open rate · 7d"
              value={`${totals.openRate7d}%`}
              icon={<Eye className="w-5 h-5" />}
              color="text-blue-400"
              subValue={`${totals.opened7d} of ${totals.delivered7d} delivered`}
            />
            <StatCard
              label="Unsubs · 30d"
              value={totals.unsubs30d}
              icon={<UserMinus className="w-5 h-5" />}
              color="text-zinc-300"
              subValue={`${totals.captures7d} signups · 7d`}
            />
          </div>

          {/* Sequence performance */}
          <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl p-5 shadow-sm shadow-black/10">
            <h2 className="text-sm font-bold text-zinc-300 mb-4">Sequences</h2>
            {data.performance.length === 0 ? (
              <p className="text-xs text-zinc-500">No sequence data yet.</p>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-zinc-500 border-b border-zinc-800">
                      <th className="px-2 py-2 font-medium">Sequence</th>
                      <th className="px-2 py-2 font-medium text-right">Subs</th>
                      <th className="px-2 py-2 font-medium text-right">Unsubs</th>
                      <th className="px-2 py-2 font-medium text-right">Sent</th>
                      <th className="px-2 py-2 font-medium text-right">Failed</th>
                      <th className="px-2 py-2 font-medium text-right">Opens</th>
                      <th className="px-2 py-2 font-medium text-right">Clicks</th>
                      <th className="px-2 py-2 font-medium text-right">Bounces</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.performance.map((p) => (
                      <tr key={p.slug} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                        <td className="px-2 py-2.5 text-zinc-200">{p.name}</td>
                        <td className="px-2 py-2.5 text-right text-zinc-300">{p.subscribersTotal}</td>
                        <td className="px-2 py-2.5 text-right text-zinc-500">{p.unsubscribed}</td>
                        <td className="px-2 py-2.5 text-right text-zinc-300">{p.emailsSent}</td>
                        <td className="px-2 py-2.5 text-right text-red-400">{p.emailsFailed || '—'}</td>
                        <td className="px-2 py-2.5 text-right text-emerald-400">{p.opens}</td>
                        <td className="px-2 py-2.5 text-right text-purple-400">{p.clicks}</td>
                        <td className="px-2 py-2.5 text-right text-red-400">{p.bounces || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Queue */}
            <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl p-5 shadow-sm shadow-black/10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-zinc-300">Queue</h2>
                <span className="text-[11px] text-zinc-500">{data.queue.length} recent</span>
              </div>
              {data.queue.length === 0 ? (
                <p className="text-xs text-zinc-500">Nothing in the queue.</p>
              ) : (
                <ul className="divide-y divide-zinc-800/60 -mx-1">
                  {data.queue.slice(0, 12).map((q) => (
                    <li key={q.id} className="px-1 py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-zinc-200 truncate">{q.subscriberEmail || '—'}</p>
                        <p className="text-[11px] text-zinc-500 mt-0.5">{q.sentAt ? `Sent ${relTime(q.sentAt)}` : `Scheduled ${fmtDate(q.scheduledFor)}`}</p>
                        {q.errorMessage && <p className="text-[11px] text-red-400 mt-0.5 truncate">{q.errorMessage}</p>}
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wide ${statusStyles[q.status] || statusStyles.skipped}`}>
                        {q.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Recent events */}
            <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl p-5 shadow-sm shadow-black/10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-zinc-300">Recent events</h2>
                <span className="text-[11px] text-zinc-500">{data.events.length}</span>
              </div>
              {data.events.length === 0 ? (
                <p className="text-xs text-zinc-500">No events yet — Resend webhook will populate this.</p>
              ) : (
                <ul className="divide-y divide-zinc-800/60 -mx-1 max-h-[320px] overflow-y-auto">
                  {data.events.slice(0, 30).map((e) => (
                    <li key={e.id} className="px-1 py-2 flex items-center justify-between gap-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wide ${eventStyles[e.eventType] || eventStyles.delivered}`}>
                        {e.eventType}
                      </span>
                      <span className="text-[11px] text-zinc-500">{relTime(e.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Subscribers */}
          <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl p-5 shadow-sm shadow-black/10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-zinc-300">Subscribers</h2>
              <span className="text-[11px] text-zinc-500">{data.subscribers.length} shown</span>
            </div>
            {data.subscribers.length === 0 ? (
              <p className="text-xs text-zinc-500">No subscribers yet.</p>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-zinc-500 border-b border-zinc-800">
                      <th className="px-2 py-2 font-medium">Email</th>
                      <th className="px-2 py-2 font-medium">Sequence</th>
                      <th className="px-2 py-2 font-medium text-right">Step</th>
                      <th className="px-2 py-2 font-medium">Joined</th>
                      <th className="px-2 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.subscribers.map((s) => (
                      <tr key={s.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                        <td className="px-2 py-2.5 text-zinc-200 truncate max-w-[240px]">{s.email}</td>
                        <td className="px-2 py-2.5 text-zinc-400">{s.lmTitle || s.lmSlug || '—'}</td>
                        <td className="px-2 py-2.5 text-right text-zinc-300">{s.currentStep}</td>
                        <td className="px-2 py-2.5 text-zinc-500">{fmtDate(s.createdAt)}</td>
                        <td className="px-2 py-2.5">
                          {s.unsubscribedAt
                            ? <span className="text-[10px] px-2 py-0.5 rounded-full border bg-zinc-500/15 text-zinc-400 border-zinc-500/30 uppercase tracking-wide">unsubscribed</span>
                            : <span className="text-[10px] px-2 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-400 border-emerald-500/30 uppercase tracking-wide">active</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Captures (top-of-funnel) */}
          <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl p-5 shadow-sm shadow-black/10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-zinc-300">Form captures</h2>
              <span className="text-[11px] text-zinc-500">{data.captures.length} recent</span>
            </div>
            {data.captures.length === 0 ? (
              <p className="text-xs text-zinc-500">No form captures yet — submit the footer form on ivanmanfredi.com to confirm wiring.</p>
            ) : (
              <ul className="divide-y divide-zinc-800/60 -mx-1">
                {data.captures.slice(0, 20).map((c) => (
                  <li key={c.id} className="px-1 py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-zinc-200 truncate">{c.email || '—'}</p>
                      <p className="text-[11px] text-zinc-500">{c.src || 'unknown source'}</p>
                    </div>
                    <span className="text-[11px] text-zinc-500 shrink-0">{relTime(c.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default LetterPanel;
```

- [ ] **Step 2**: Typecheck — `npx tsc --noEmit` — expect no errors.

---

## Task 4: Wire panel into Dashboard.tsx routing

**Files:**
- Modify: `components/dashboard/Dashboard.tsx:66`, `:90`, `:120`

- [ ] **Step 1**: Add `const LazyLetterPanel = lazy(retryImport(() => import('./LetterPanel')));` next to the other lazy imports.
- [ ] **Step 2**: Add `letter: LazyLetterPanel as unknown as React.ComponentType,` in `panelComponents`.
- [ ] **Step 3**: Add `retryImport(() => import('./LetterPanel')),` to the `lazyImports` prefetch array.
- [ ] **Step 4**: Typecheck — expect no errors.

---

## Task 5: Add sidebar tab in DashboardLayout

**Files:**
- Modify: `components/dashboard/DashboardLayout.tsx`

- [ ] **Step 1**: Import `Mail` from `lucide-react` (verify it's not already there; if so skip).
- [ ] **Step 2**: Insert a new tab entry between `audience` and `content` in the `Content` group:
  `{ id: 'letter', label: 'Letter', icon: <Mail className="w-[18px] h-[18px]" /> },`
- [ ] **Step 3**: Typecheck.

---

## Task 6: Build verification

- [ ] **Step 1**: Run `npm run build` from `/Users/ivanmanfredi/Desktop/personal-site` — expect successful build with no TS errors.
- [ ] **Step 2**: Done. Deploy via `git push origin main`.
