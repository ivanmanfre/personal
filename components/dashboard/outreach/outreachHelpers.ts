import type { OutreachProspect } from '../../../types/dashboard';

// Housekeeping events that drown out meaningful prospect actions in the feed.
export const SYSTEM_ACTION_TYPES = ['auto_replenish', 'rotation_swap', 'stage_reconcile_connected'] as const;

export function filterSystemEvents<T extends { actionType: string }>(events: T[], includeSystem = false): T[] {
  if (includeSystem) return events;
  return events.filter((e) => !(SYSTEM_ACTION_TYPES as readonly string[]).includes(e.actionType));
}

export interface CampaignPerfRow {
  campaignId: string;
  name: string;
  sent: number;       // an invite went out (connection_sent and everything past it)
  connected: number;  // connected and beyond
  replied: number;
  replyRate: number;  // replied / sent, 0 when sent === 0
}

const SENT_STAGES = new Set(['connection_sent', 'connected', 'dm_sent', 'replied', 'converted']);
const CONNECTED_STAGES = new Set(['connected', 'dm_sent', 'replied', 'converted']);
const REPLIED_STAGES = new Set(['replied', 'converted']);

export function campaignPerformance(
  prospects: Pick<OutreachProspect, 'campaignId' | 'campaignName' | 'stage'>[]
): CampaignPerfRow[] {
  const map = new Map<string, CampaignPerfRow>();
  for (const p of prospects) {
    if (!p.campaignId) continue;
    const row = map.get(p.campaignId) ?? { campaignId: p.campaignId, name: p.campaignName || 'Unknown', sent: 0, connected: 0, replied: 0, replyRate: 0 };
    if (SENT_STAGES.has(p.stage)) row.sent++;
    if (CONNECTED_STAGES.has(p.stage)) row.connected++;
    if (REPLIED_STAGES.has(p.stage)) row.replied++;
    map.set(p.campaignId, row);
  }
  const rows = [...map.values()];
  for (const r of rows) r.replyRate = r.sent > 0 ? Math.round((r.replied / r.sent) * 1000) / 10 : 0;
  return rows.sort((a, b) => b.sent - a.sent);
}
