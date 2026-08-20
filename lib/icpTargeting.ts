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
// `network_sample` is what the audit actually emits, verified 2026-08-20 against 40 live
// scans: 17 named leads carried `network_sample` and 2 carried `engager`. Plain `network`
// never occurs in production and is kept only so a future emitter change cannot regress
// those rows to the neutral label.
const REASONS: Record<string, string> = {
  engager: 'Engaged your posts',
  network_sample: 'In your connections',
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

// ── COLD LANE ────────────────────────────────────────────────────────────────
// A different lane from the warm one. Chapter 03 works the audience the founder already
// has; this is the list we build for them from strangers. Kept fail-closed for the same
// reason as the targeting block: a source line that does not describe the reader's own
// market reads as boilerplate, and boilerplate on a paid page costs the meeting.

// Two sources is the floor. One source reads as a single trick rather than a lane, and the
// chapter's whole claim is that we come at their market from several directions at once.
export const MIN_COLD_SOURCES = 2;

export interface ColdOutbound {
  note: string;
  sources?: { label?: string; detail?: string }[];
  filters?: string[];
}

export interface DerivedColdOutbound {
  note: string;
  sources: { label: string; detail: string }[];
  filters: string[];
}

export function deriveColdOutbound(cold: ColdOutbound | undefined): DerivedColdOutbound | null {
  if (!cold) return null;
  const note = cleanText(cold.note);
  if (!note) return null;

  const sources = (cold.sources ?? [])
    .map((s) => ({ label: cleanText(s?.label), detail: cleanText(s?.detail) }))
    .filter((s) => s.label.length > 0);
  if (sources.length < MIN_COLD_SOURCES) return null;

  // Filters are the only optional part: the lane still reads honestly without them, and an
  // invented exclusion is worse than a missing one.
  const filters = (cold.filters ?? []).map((f) => cleanText(f)).filter((f) => f.length > 0);

  return { note, sources, filters };
}

// The audience audit used to classify every prospect's audience against one hardcoded
// rubric: decision makers at consumer brands. Since 2026-08-20 it derives the buyer per
// prospect, so the page has to name whatever THAT audit counted rather than assert a
// category nobody looked for. This is the exact legacy sentence, and it is the honest
// reading of every audit row written before the change, all of which really were DTC.
export const LEGACY_BUYER_WORDS =
  'a decision maker at a consumer brand: founder, CMO, or head of growth';

// Falls back whenever the audit could not name the buyer with confidence. Never widen this
// to a guess: the sentence it feeds defines what every counted number on the page means.
export function buyerDefinitionWords(raw?: string | null): string {
  return cleanText(raw || '') || LEGACY_BUYER_WORDS;
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
