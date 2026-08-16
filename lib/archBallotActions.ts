// ARCH biweekly lead ballot — ops inbox actions (dashboard-v2 Today).
// Talks to the n8n workflow "CLIENT ARCH. Influencer Agency - Lead Ballot
// Webhook" (QrKYGZfgjRhdf4fO) via its k-gated webhook (house pattern, same as
// the RISE weekly note). Pending state lives in integration_config
// arch_ballot_pending; approving sends the ballot link by WhatsApp — to the
// "inboundonsteroids x arch" group once arch_ballot_group_jid is configured,
// until then to Ivan's own number (fallback flagged in the response). The
// biweekly assembly cron lives in a SEPARATE born-dead workflow
// (RbTIUFeVjar5dX2p) that Ivan arms after cycle-1 passes.

const ARCH_BALLOT_WEBHOOK = 'https://n8n.ivanmanfredi.com/webhook/arch-lead-ballot';
// Same key inlined in the workflow's Ballot Engine node.
const ARCH_BALLOT_KEY = 'alb_7c40e1f9a2d84b63b1a97e5c2f6d0a48';

export interface ArchBallotPending {
  ballot_url: string;
  summary: string;
  cycle: string;
  drafted_at: string;
  drafted_via: string;
}

async function callWebhook(body: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${ARCH_BALLOT_WEBHOOK}?k=${ARCH_BALLOT_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`arch-ballot webhook ${res.status}`);
  return res.json();
}

/** The pending ARCH lead ballot awaiting Ivan, or null when the queue is clear. */
export async function fetchArchBallotPending(): Promise<ArchBallotPending | null> {
  const d = await callWebhook({ mode: 'status' });
  return d && d.ok && d.pending ? (d.pending as ArchBallotPending) : null;
}

/** Approve the pending ballot: fires the WhatsApp message with the ballot URL
 *  and clears pending. Returns where it was sent (group vs Ivan fallback). */
export async function approveArchBallot(): Promise<{ ok: boolean; sentTo?: string; groupMissing?: boolean; error?: string }> {
  const d = await callWebhook({ mode: 'approve' });
  return {
    ok: !!(d && d.ok),
    sentTo: d && d.sent_to ? String(d.sent_to) : undefined,
    groupMissing: !!(d && d.group_missing),
    error: d && d.error ? String(d.error) : undefined,
  };
}
