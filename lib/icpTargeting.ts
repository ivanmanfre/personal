// lib/icpTargeting.ts
// Pure derivation for the scan's ICP + targeting block. No React, no fetching.
// Fail-closed by design: every gate returns null rather than rendering a thin block.
// A thin ICP block is worse than none, because it invites the buyer to check it.

export const MIN_SAMPLE_LEADS = 3;
const MAX_SAMPLE_LEADS = 4;

export type PoolSource = 'engagers' | 'competitor_engagers' | 'network' | 'signals';

export interface IcpTargeting {
  icp_line: string;
  segments?: { label: string; note?: string }[];
  pool_sources?: PoolSource[];
}

export interface SampleLead {
  name: string;
  headline: string;
  reason: string;
}

export interface DerivedIcpTargeting {
  icpLine: string;
  segments: { label: string; note?: string }[];
  leads: SampleLead[];
  poolLabels: string[];
}

const POOL_LABELS: Record<PoolSource, string> = {
  engagers: 'People who engage your posts',
  competitor_engagers: 'People who engage your competitors',
  network: 'Buyers already in your connections',
  signals: 'Accounts showing a hiring or spend signal',
};

// `source` mirrors the vocabulary already used by the audience audit block.
function reasonFor(source?: string): string {
  return source === 'network' ? 'In your connections' : 'Engaged your posts';
}

export function deriveIcpTargeting(
  targeting: IcpTargeting | undefined,
  audience: { named?: { name?: string; headline?: string; source?: string }[] } | undefined,
): DerivedIcpTargeting | null {
  if (!targeting) return null;
  const icpLine = (targeting.icp_line || '').trim();
  if (!icpLine) return null;

  const leads: SampleLead[] = (audience?.named ?? [])
    .filter((p) => (p.name || '').trim().length > 0)
    .slice(0, MAX_SAMPLE_LEADS)
    .map((p) => ({
      name: (p.name || '').trim(),
      headline: (p.headline || '').trim(),
      reason: reasonFor(p.source),
    }));

  if (leads.length < MIN_SAMPLE_LEADS) return null;

  const poolLabels = (targeting.pool_sources ?? [])
    .filter((s): s is PoolSource => s in POOL_LABELS)
    .map((s) => POOL_LABELS[s]);

  return { icpLine, segments: targeting.segments ?? [], leads, poolLabels };
}
