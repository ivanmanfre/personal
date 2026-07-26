// RISE weekly note — ops inbox actions (dashboard-v2 Today).
// Talks to the n8n workflow "CLIENT Rise DTC - Weekly Note Draft"
// (IHOpAedk4gJFNQo4) via its manual webhook, guarded by the shared ?k= key
// (house pattern, same as Client Board Queue Sync). WhatsApp stays the
// second approval path; the Monday poll treats an already-cleared pending
// as done, so approving here is safe at any time.

const WEEKLY_NOTE_WEBHOOK = 'https://n8n.ivanmanfredi.com/webhook/risedtc-weekly-note';
const WEEKLY_REPORT_VIEWER = 'https://n8n.ivanmanfredi.com/webhook/risedtc-weekly-report';
// Same key inlined in the workflow's Poll + Apply node and Report Gate.
const WEEKLY_NOTE_KEY = 'rwn_a0a8d703d9d51aa03865a6cfc22eae5d';

export interface WeeklyNotePending {
  draft_text: string;
  sent_at: string;
  week_start: string | null;
  prompt_version: number | null;
  report_path: string | null;
}

async function callWebhook(body: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${WEEKLY_NOTE_WEBHOOK}?k=${WEEKLY_NOTE_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`weekly-note webhook ${res.status}`);
  return res.json();
}

/** The pending weekly note draft awaiting Ivan, or null when the queue is clear. */
export async function fetchWeeklyNotePending(): Promise<WeeklyNotePending | null> {
  const d = await callWebhook({ mode: 'status' });
  return d && d.ok && d.pending ? (d.pending as WeeklyNotePending) : null;
}

/** The k-gated HTML report URL for a pending draft's week. */
export function weeklyNoteReportUrl(weekStart: string): string {
  return `${WEEKLY_REPORT_VIEWER}?week=${weekStart}&k=${WEEKLY_NOTE_KEY}`;
}

/** Approve the pending draft as-is, or with Ivan's override text.
 *  Same server-side write as the WhatsApp "ok" path (focus_lines set,
 *  pending cleared, WhatsApp confirmation sent). */
export async function approveWeeklyNote(overrideText?: string): Promise<{ ok: boolean; error?: string }> {
  const body: Record<string, unknown> = { mode: 'approve' };
  const t = (overrideText || '').trim();
  if (t) body.text = t;
  const d = await callWebhook(body);
  return { ok: !!(d && d.ok), error: d && d.error ? String(d.error) : undefined };
}
