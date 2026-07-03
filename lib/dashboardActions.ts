import { toast } from 'sonner';
import { supabase } from './supabase';

// Neither carousel_drafts nor lm_drafts_v2 persist a machine-readable failure
// reason (no `last_error` column, no n8n error-handler write) — this generic
// string is shown wherever a real reason would otherwise go, on both the
// board rows and the editor banner, until that column + write path exist.
// See .superpowers/sdd/task-6-report.md for the backlog item.
export const GENERATION_ERROR_FALLBACK = 'Generation failed — retry or check n8n Activity';

export async function dashboardAction(table: string, id: string, field: string, value: string) {
  const { error } = await supabase.rpc('dashboard_action', {
    p_table: table,
    p_id: id,
    p_field: field,
    p_value: value,
  });
  if (error) throw error;
}

/** Show a toast error - call this in catch blocks across hooks */
export function toastError(action: string, err?: unknown) {
  let msg = 'Unknown error';
  if (err instanceof Error) {
    msg = err.message;
  } else if (err && typeof err === 'object' && 'message' in err) {
    msg = String((err as Record<string, unknown>).message);
  } else if (typeof err === 'string') {
    msg = err;
  }
  // Humanize low-level errors so demo/sales surfaces never show a raw
  // "TypeError: Failed to fetch" or "canceling statement due to statement
  // timeout" stack-style string.
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    msg = "Couldn't reach the server — check your connection.";
  } else if (/statement timeout|canceling statement|query timeout/i.test(msg)) {
    msg = 'The server is busy — give it a moment and retry.';
  }
  toast.error(`Failed to ${action}`, { description: msg });
}

/** Show a toast success */
export function toastSuccess(message: string) {
  toast.success(message);
}

// ─── Newsletter actions ─────────────────────────────────────────────────────

export interface NewsletterIssueInput {
  id?: string | null;
  slug: string;
  subject: string;
  preview: string | null;
  body_markdown: string;
  format: string;
}

export async function upsertNewsletterIssue(input: NewsletterIssueInput): Promise<string> {
  const { data, error } = await supabase.rpc('newsletter_issue_upsert', {
    p_id: input.id ?? null,
    p_slug: input.slug,
    p_subject: input.subject,
    p_preview: input.preview,
    p_body_markdown: input.body_markdown,
    p_format: input.format,
  });
  if (error) throw error;
  return data as string;
}

export async function approveNewsletterIssue(id: string): Promise<string> {
  const { data, error } = await supabase.rpc('newsletter_issue_approve', { p_id: id });
  if (error) throw error;
  return data as string;
}

export async function scheduleNewsletterIssue(id: string, when: string): Promise<void> {
  const { error } = await supabase.rpc('newsletter_issue_schedule', { p_id: id, p_when: when });
  if (error) throw error;
}

export async function cancelNewsletterIssue(id: string): Promise<void> {
  const { error } = await supabase.rpc('newsletter_issue_cancel', { p_id: id });
  if (error) throw error;
}

export async function sendNewsletterNow(id: string): Promise<void> {
  const { error } = await supabase.rpc('newsletter_issue_send_now', { p_id: id });
  if (error) throw error;
}

export async function deleteNewsletterIssue(id: string): Promise<void> {
  const { error } = await supabase.rpc('newsletter_issue_delete', { p_id: id });
  if (error) throw error;
}

const TEST_SEND_WEBHOOK = 'https://n8n.ivanmanfredi.com/webhook/send-newsletter-test';

export async function sendNewsletterTest(issueId: string, testEmail: string): Promise<void> {
  const res = await fetch(TEST_SEND_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ issue_id: issueId, test_email: testEmail }),
  });
  if (!res.ok) throw new Error(`Test send failed: ${res.status} ${await res.text()}`);
}

// Newsletter idea-bank actions
export async function approveAndDraftIdea(idea_id: string): Promise<{ ok: boolean; issue_id?: string; webhook_request_id?: number; error?: string }> {
  const { data, error } = await supabase.rpc('dashboard_action', { op: 'approveAndDraftIdea', input: { idea_id } });
  if (error) return { ok: false, error: error.message };
  return data as { ok: boolean; issue_id?: string; webhook_request_id?: number; error?: string };
}

export async function rejectNewsletterIdea(idea_id: string): Promise<void> {
  const { error } = await supabase.rpc('dashboard_action', { op: 'rejectNewsletterIdea', input: { idea_id } });
  if (error) throw error;
}

export async function updateNewsletterIdea(
  idea_id: string,
  patch: { subject?: string; preview?: string; hook_one_liner?: string; recommended_cadence?: string },
): Promise<void> {
  const { error } = await supabase.rpc('dashboard_action', { op: 'updateNewsletterIdea', input: { idea_id, ...patch } });
  if (error) throw error;
}

export async function upsertTopicQueueItem(input: {
  id?: string;
  thesis: string;
  cadence_hint?: string;
  priority?: number;
  notes?: string;
  status?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('dashboard_action', { op: 'upsertTopicQueueItem', input });
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function archiveTopicQueueItem(id: string): Promise<void> {
  const { error } = await supabase.rpc('dashboard_action', { op: 'archiveTopicQueueItem', input: { id } });
  if (error) throw error;
}

export async function requeueTopicQueueItem(id: string): Promise<void> {
  const { error } = await supabase.rpc('dashboard_action', { op: 'requeueTopicQueueItem', input: { id } });
  if (error) throw error;
}
