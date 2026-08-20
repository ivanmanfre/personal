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
  // Describes the pool, never its qualification. The audience block a few lines up the page
  // only calls these people buyers after a counted floor (>=3 named, >=2% density) clears.
  // This label sits behind no such gate, so it must not assert one.
  network: 'People already in your connections',
  competitor_engagers: 'People who engage your competitors',
  signals: 'Accounts showing a hiring or spend signal',
};

// The neutral label. Used whenever `source` is missing or is a value we do not recognise:
// it places the person in the audience read they were counted from and claims nothing about
// how they got there. Never widen this to a mechanism we cannot point at, because a lead
// row that asserts "engaged your posts" about someone who never did is the exact defect
// that has already reached a prospect once.
const NEUTRAL_REASON = 'In your audience';

// `source` mirrors the vocabulary already used by the audience audit block.
const REASONS: Record<string, string> = {
  engager: 'Engaged your posts',
  network: 'In your connections',
};

export function reasonFor(source?: string): string {
  return REASONS[(source || '').trim()] ?? NEUTRAL_REASON;
}

// Model-emitted strings reach this module raw. Everything below is the copy guarantee for
// them: em dashes become the comma the rest of the report uses (same idiom as the audience
// block's audClean), whitespace collapses, and nothing is invented.
function cleanText(raw?: string): string {
  return (raw || '')
    .replace(/\s*\u2014\s*/g, ', ')
    .replace(/\s+/g, ' ')
    // A value that was nothing but an em dash now reads as a bare comma. Strip the
    // separator punctuation off both ends so it falls back through the empty-string gate.
    .replace(/^[\s,;:]+|[\s,;:]+$/g, '');
}

// A LinkedIn headline runs to 220 characters. The lead row gives it one column, so anything
// past this length wraps into a wall and buries the name beside it. Cut on a word boundary.
export const MAX_HEADLINE_CHARS = 80;

function cleanHeadline(raw?: string): string {
  const text = cleanText(raw);
  if (text.length <= MAX_HEADLINE_CHARS) return text;
  const cut = text.slice(0, MAX_HEADLINE_CHARS);
  const lastSpace = cut.lastIndexOf(' ');
  const stem = (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.]+$/, '');
  return `${stem}…`;
}

export function deriveIcpTargeting(
  targeting: IcpTargeting | undefined,
  audience: { named?: { name?: string; headline?: string; source?: string }[] } | undefined,
): DerivedIcpTargeting | null {
  if (!targeting) return null;
  const icpLine = cleanText(targeting.icp_line);
  if (!icpLine) return null;

  const leads: SampleLead[] = (audience?.named ?? [])
    .filter((p) => (p.name || '').trim().length > 0)
    .slice(0, MAX_SAMPLE_LEADS)
    .map((p) => ({
      name: cleanText(p.name),
      headline: cleanHeadline(p.headline),
      reason: reasonFor(p.source),
    }));

  if (leads.length < MIN_SAMPLE_LEADS) return null;

  const poolLabels = (targeting.pool_sources ?? [])
    .filter((s): s is PoolSource => s in POOL_LABELS)
    .map((s) => POOL_LABELS[s]);

  return { icpLine, segments: targeting.segments ?? [], leads, poolLabels };
}
