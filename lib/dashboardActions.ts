import { toast } from 'sonner';
import { supabase } from './supabase';

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
