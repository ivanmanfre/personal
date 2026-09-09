/**
 * AudienceSection — the audience review block on the client board.
 *
 * WHAT IT ANSWERS (measurement contract, "Client experience and content
 * decisions"): what changed, why it may matter to this client's buyers, what
 * supports that reading, what we could publish, what proof is needed, and what
 * happened after. Plus, per post: the raw metric with the date it was taken,
 * the rank with its basis spelled out, the relevant engagers as PEOPLE, and an
 * absolute monthly median with its sample size.
 *
 * WHERE IT RENDERS
 * Inside BOTH performance surfaces, below the existing posts block:
 *   desk skin      -> DeskPerformanceSurface (ARCH)
 *   blackbox skin  -> PerformanceSurface in ClientBoardPage (RISE)
 * One component serves both. Every primitive it uses is desk-kit and every
 * colour resolves through a `--cb-*` variable, which both skins set, so the
 * section inherits each board's own ink/paper/accent without a single hex here.
 * <Plate/> is deliberately NOT used: the blackbox skin sets no `--cb-plate*`
 * variables, and the desk performance panel already owns the one dark plate.
 *
 * WHAT IT NEVER SHOWS
 * No workflow name, no table name, no person's name, no private row, no
 * unapproved asset. People are counts. The payload itself is built so that
 * unapproved and private assets never reach the browser at all (migration 07),
 * and this component has no path to fetch anything of its own.
 *
 * NULLS STAY NULL. A missing metric renders the kit's dashed <Blank/> with the
 * reason beside it, never a 0. `excluded_operator` is the one honest zero: it
 * is a real count over a known list.
 *
 * SIX STATES, and the sixth is absence: `audience === null` (the feature is off
 * for this client, or the client has no manifest) returns null. A live board
 * NEVER renders a placeholder or a staged deck here.
 *
 * Every client-visible string comes from ./audienceCopy.
 */
import React from 'react';
import {
  Eyebrow, SectionRule, DeskH2, Footnote, Card, Cols,
  Num, Chip, Delta, Pill, BarRow,
  Ledger, LedgerRow, LedgerCell, LedgerBar,
  Drill, Blank,
} from './desk-kit';
import { AUDIENCE_COPY as C } from './audienceCopy';

/* ────────────────────────────────────────────────────────────────────────────
 * The payload, exactly as run-03 CONTRACTS §2.1 freezes it. The board never
 * builds one of these; it comes out of client_board_audience / _v2.
 * ──────────────────────────────────────────────────────────────────────────── */
export type AudienceCoverage = 'collected' | 'not_collected' | 'unknown';
export type AudienceState =
  'normal' | 'empty' | 'unknown' | 'incomplete_history' | 'stale' | 'unavailable';

export type AudiencePost = {
  post_social_id: string;
  published_at: string | null;
  format: string | null;
  topic: string | null;
  raw: {
    impressions: number | null; reactions: number | null;
    comments: number | null; shares: number | null;
    captured_at: string | null; coverage: AudienceCoverage;
  };
  rank: {
    basis: 'matched_age' | 'observed_age' | 'none';
    rank: number | null; eligible_n: number | null; target_age_days: number | null;
  };
  engagers: {
    people: number | null; positive: number | null;
    borderline: number | null; unknown: number | null;
    excluded_operator: number; coverage: AudienceCoverage;
  };
  assisted_outcomes: number;
};

export type AudienceRecommendation = {
  recommendation_id: string;
  what_changed: string | null;
  why_it_matters: string | null;
  evidence: {
    source_ids: string[] | null; source_dates: string[] | null;
    sample_n: number | null; unknowns: number | null;
  };
  could_publish: string | null;
  proof_needed: string | null;
  asset_required: boolean | string | null;
  asset_state: 'approved' | 'requested' | 'missing' | 'none';
  decision: {
    state: 'accepted' | 'rejected' | 'deferred' | null;
    reason: string | null; decided_at: string | null;
  };
  link_state: string;
};

/** Per-source freshness (run-04 CONTRACTS §2.1). Optional on the type because a
 *  payload built before migration 07's §2.1 change carries only the two dates;
 *  every read below degrades to those. */
export type FreshnessSourceState = 'fresh' | 'stale' | 'missing';
export type FreshnessOverall = 'fresh' | 'partial' | 'stale' | 'missing';
export type AudienceFreshness = {
  snapshots_as_of: string | null;
  engagers_as_of: string | null;
  stale_after_days: number;
  sources?: {
    metrics?: { as_of: string | null; state: FreshnessSourceState };
    engagement?: { as_of: string | null; state: FreshnessSourceState };
  } | null;
  overall?: FreshnessOverall | null;
};

/**
 * One person attached to the review (run-04 CONTRACTS §2.2).
 *
 * NO NAME EVER. `person_ref` is the opaque key the payload already uses to keep
 * rows distinct; it is never rendered. `label` is the relevance judgement and
 * `relationship` is the separate fact of whether our own records already carry
 * this person. `relationship` is always present on a §2.2 payload; a person the
 * relationship view does not know arrives as `{state:'unknown', ...}` rather
 * than as a missing key, and the component treats a missing one the same way.
 */
export type AudiencePersonLabel = 'positive' | 'borderline' | 'negative' | 'unknown';
export type AudiencePerson = {
  person_ref: string;
  label?: AudiencePersonLabel | string | null;
  relationship?: {
    state: string | null;
    source: string | null;
    effective_date: string | null;
  } | null;
};

export type AudiencePayload = {
  client_id: string;
  capability_version: number;
  reviewed_at: string | null;
  review_cadence: string;
  state: AudienceState;
  freshness: AudienceFreshness;
  /** §2.2. Absent on a pre-§2.2 payload: the relationship block does not render
   *  at all rather than inventing an empty one. */
  people?: AudiencePerson[] | null;
  posts: AudiencePost[];
  monthly_median: {
    month: string; target_age_days: number | null;
    median_reactions: number | null; n: number; basis: string;
  }[];
  recommendations: AudienceRecommendation[];
  assets: { asset_id: string; source: string | null; factual_context: string | null; confidentiality: string }[];
};

export type DecideFn = (
  ref: string, decision: 'accept' | 'reject' | 'defer', reason: string,
) => Promise<boolean>;

/* ────────────────────────────────────────────────────────────────────────────
 * Local helpers. Date parsing matches the rest of the board: a bare date gets
 * LOCAL midnight so the day can never roll backwards through a UTC parse.
 * ──────────────────────────────────────────────────────────────────────────── */
function parseSafe(iso?: string | null): Date | null {
  if (!iso) return null;
  const d = /[T ]/.test(iso) ? new Date(iso) : new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
function fmtDay(iso?: string | null): string {
  const d = parseSafe(iso);
  return d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
}
function fmtMonth(iso?: string | null): string {
  const d = parseSafe(iso);
  return d ? d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '';
}
function fmtNum(n?: number | null): string {
  return n === null || n === undefined ? '' : n.toLocaleString();
}
/** A post id is not a title. The board shows the publication day and the topic;
 *  the raw platform id is only ever a link target. */
function postLabel(p: AudiencePost): string {
  const day = fmtDay(p.published_at);
  const bits = [p.topic, p.format].filter(Boolean).join(' · ');
  return bits ? `${day} · ${bits}` : day;
}
function postUrl(id: string): string | null {
  const digits = (id.match(/(\d{6,})/) || [])[1];
  return digits ? `https://www.linkedin.com/feed/update/urn:li:activity:${digits}/` : null;
}

/* ───────────────────────── freshness, per source (§2.1) ─────────────────────
 * The chip reads `overall` AND NOTHING ELSE. "Up to date" is printed only for
 * `fresh`, which means both sources are inside the window. Before this the
 * board took the greatest of the two timestamps, so a snapshot taken this
 * morning could carry a two-month-old engagement source under an "Up to date"
 * chip. The lines below always name each source separately with its own date.
 * ──────────────────────────────────────────────────────────────────────────── */

export function freshnessChipLabel(f: AudienceFreshness): string | null {
  const o = f?.overall;
  return o ? (C.freshnessChip[o] ?? null) : null;
}

/** The per-source lines. Falls back to the two legacy single-date lines when a
 *  payload carries no `sources` block, so an old payload still says its dates. */
export function freshnessLines(f: AudienceFreshness): string[] {
  const s = f?.sources;
  const S = C.freshness.sources;
  if (!s || (!s.metrics && !s.engagement)) {
    return [
      f?.snapshots_as_of ? C.freshness.snapshots(fmtDay(f.snapshots_as_of)) : C.freshness.snapshotsNone,
      f?.engagers_as_of ? C.freshness.engagers(fmtDay(f.engagers_as_of)) : C.freshness.engagersNone,
    ];
  }
  const line = (
    src: { as_of: string | null; state: FreshnessSourceState } | undefined | null,
    fresh: (d: string) => string, stale: (d: string) => string, missing: string,
  ): string => {
    // A source with no date is missing whatever its state field claims: there is
    // no day to print, so there is nothing to call fresh.
    if (!src || src.state === 'missing' || !src.as_of) return missing;
    return src.state === 'fresh' ? fresh(fmtDay(src.as_of)) : stale(fmtDay(src.as_of));
  };
  return [
    line(s.metrics, S.metricsFresh, S.metricsStale, S.metricsMissing),
    line(s.engagement, S.engagementFresh, S.engagementStale, S.engagementMissing),
  ];
}

/* ───────────────────────── relationship (§2.2) ─────────────────────────────
 * A relevance label says nothing about whether we know the person, and it must
 * never be read as "new prospect" or as a certified buyer. The relationship is
 * a separate fact off our own contact records, and where we have none the board
 * says so in words.
 * ──────────────────────────────────────────────────────────────────────────── */

const STAGE_PREFIX = 'existing_prospect_stage:';

/** The client-facing stage word, or null when the raw token has no translation.
 *  A raw `outreach_prospects.stage` token NEVER reaches the browser text. */
export function relationshipStageWord(state?: string | null): string | null {
  if (!state || !state.startsWith(STAGE_PREFIX)) return null;
  const raw = state.slice(STAGE_PREFIX.length).trim().toLowerCase();
  return C.relationship.stage[raw] ?? null;
}

/** The exact chip text for one person. Never blank, never a name, never a token. */
export function relationshipChipText(rel?: AudiencePerson['relationship']): string {
  const state = rel?.state ?? null;
  if (!state || state === 'unknown' || !state.startsWith(STAGE_PREFIX)) return C.relationship.unknown;
  const word = relationshipStageWord(state);
  const day = rel?.effective_date ? fmtDay(rel.effective_date) : '';
  if (word && day) return C.relationship.known(day, word);
  if (word) return C.relationship.knownNoDate(word);
  if (day) return C.relationship.knownDateOnly(day);
  return C.relationship.knownBare;
}

/** Chips are capped so a 200-person review does not become a wall. The people
 *  beyond the cap are counted in words, never dropped in silence. */
const REL_CHIP_CAP = 24;

function RelationshipBlock({ people }: { people: AudiencePerson[] }) {
  const known = people.filter((p) => (p.relationship?.state ?? 'unknown').startsWith(STAGE_PREFIX));
  const unknownN = people.length - known.length;
  const shown = known.slice(0, REL_CHIP_CAP);
  const hiddenKnown = known.length - shown.length;
  return (
    <div style={{ marginTop: 30 }} data-audn-relationship="">
      <SectionRule
        label={C.relationship.heading}
        count={known.length}
        blurb={C.relationship.blurb}
      />
      {people.length === 0 && <Meta style={{ marginTop: 12 }}>{C.relationship.none}</Meta>}
      {shown.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {shown.map((p) => (
            <Chip key={p.person_ref}>{relationshipChipText(p.relationship)}</Chip>
          ))}
        </div>
      )}
      {hiddenKnown > 0 && <Meta style={{ marginTop: 9 }}>{C.relationship.more(hiddenKnown)}</Meta>}
      {unknownN > 0 && (
        <div style={{ marginTop: 12, display: 'flex', gap: 9, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <Chip>{C.relationship.unknown}</Chip>
          <Meta>{C.relationship.unknownMany(unknownN)}</Meta>
        </div>
      )}
      <Footnote>{C.relationship.footnote}</Footnote>
    </div>
  );
}

/**
 * The one thing this section cannot inline: the narrow-screen ledger. Below
 * 560px a three-column table forces the middle cell down to a strip and every
 * chip wraps three deep, so the rows become stacked blocks instead, with the
 * date and the reactions figure sharing the top line. Every selector is
 * `audn-`-prefixed and scoped to this section's own table; no global rule.
 */
const AUDN_CSS = `
@media (max-width: 560px) {
  .audn-led thead { display: none; }
  .audn-led, .audn-led tbody, .audn-led td { display: block; width: auto; }
  /* the row becomes a flex line so the date and the reactions figure sit
     together at the top and the detail cell drops underneath them */
  .audn-led tr { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 12px;
                 border-bottom: 1px solid var(--cb-line); padding: 8px 0 12px; }
  .audn-led td { border-bottom: none; padding: 3px 0; text-align: left; }
  .audn-led td.audn-when { order: 0; flex: 0 0 auto; }
  .audn-led td.audn-reacts { order: 1; flex: 1 1 auto; text-align: right; }
  .audn-led td:not(.audn-when):not(.audn-reacts) { order: 2; flex: 1 1 100%; min-width: 0; }
}
`;

const MUTE = 'var(--cb-ink-mute)';
const INK = 'var(--cb-ink)';
const INK_SOFT = 'var(--cb-ink-soft)';
const SUNK = 'var(--cb-paper-sunk)';
const LINE = 'var(--cb-line)';

/** A labelled line of small meta text. Never a <p> (desk-kit rule 4). */
const Meta: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.5, color: MUTE, ...style }}>{children}</div>
);

/** A block inside a recommendation card: uppercase micro-label plus its copy. */
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ marginTop: 14 }}>
    <Eyebrow>{label}</Eyebrow>
    <div style={{ marginTop: 6, fontSize: 14.5, lineHeight: 1.5, color: INK_SOFT }}>{children}</div>
  </div>
);

/* ══════════════════════════ decision controls ══════════════════════════ */

function DecisionBlock({ rec, live, onDecide }: {
  rec: AudienceRecommendation; live: boolean; onDecide?: DecideFn;
}) {
  const [open, setOpen] = React.useState(!rec.decision.state);
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const enabled = live && !!onDecide;
  const choose = async (d: 'accept' | 'reject' | 'defer') => {
    if (!onDecide) return;
    if (reason.trim().length < 3) { setErr(C.decision.reasonRequired); return; }
    setErr(null); setBusy(d);
    const ok = await onDecide(`audn-rec:${rec.recommendation_id}`, d, reason.trim());
    setBusy(null);
    if (ok) { setOpen(false); setReason(''); } else { setErr(C.decision.failed); }
  };

  const recorded = rec.decision.state
    ? (rec.decision.decided_at
      ? C.decision.recorded[rec.decision.state](fmtDay(rec.decision.decided_at))
      : C.decision.recordedNoDate[rec.decision.state])
    : null;

  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${LINE}` }}>
      <Eyebrow>{C.decision.heading}</Eyebrow>
      {recorded && (
        <div style={{ marginTop: 7, display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: INK }}>{recorded}</span>
          {rec.decision.reason && (
            <span style={{ fontSize: 13.5, color: INK_SOFT, minWidth: 0, overflowWrap: 'anywhere' }}>
              &ldquo;{rec.decision.reason}&rdquo;
            </span>
          )}
          {enabled && !open && (
            <Pill onClick={() => setOpen(true)} style={{ marginLeft: 'auto' }}>{C.decision.change}</Pill>
          )}
        </div>
      )}
      {open && (
        <div style={{ marginTop: 10 }}>
          <label
            style={{ display: 'block', fontSize: 12, fontWeight: 800, letterSpacing: '0.14em',
                     textTransform: 'uppercase', color: MUTE }}
            htmlFor={`audn-reason-${rec.recommendation_id}`}
          >{C.decision.reasonLabel}</label>
          <textarea
            id={`audn-reason-${rec.recommendation_id}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={C.decision.reasonPlaceholder}
            disabled={!enabled}
            rows={2}
            style={{
              width: '100%', marginTop: 7, padding: '10px 12px', borderRadius: 12,
              border: `1px solid ${LINE}`, background: enabled ? 'var(--cb-paper)' : SUNK,
              color: INK, fontFamily: 'var(--cb-body)', fontSize: 14, lineHeight: 1.45,
              resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {(['accept', 'reject', 'defer'] as const).map((d) => (
              <Pill
                key={d}
                tone={d === 'accept' ? 'accent' : 'default'}
                onClick={enabled ? () => choose(d) : undefined}
                style={enabled ? undefined : { opacity: 0.55, cursor: 'not-allowed' }}
              >{busy === d ? C.decision.saving : C.decision[d]}</Pill>
            ))}
          </div>
          {!enabled && <Meta style={{ marginTop: 9 }}>{C.decision.previewNote}</Meta>}
          {err && <Meta style={{ marginTop: 9, color: INK }}>{err}</Meta>}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════ recommendation card ══════════════════════════ */

function RecommendationCard({ rec, live, onDecide }: {
  rec: AudienceRecommendation; live: boolean; onDecide?: DecideFn;
}) {
  const ev = rec.evidence || { source_ids: null, source_dates: null, sample_n: null, unknowns: null };
  const ids = ev.source_ids || [];
  const dates = ev.source_dates || [];
  return (
    <Card>
      <Field label={C.recs.whatChanged}>{rec.what_changed}</Field>
      <Field label={C.recs.whyItMatters}>{rec.why_it_matters}</Field>
      <Field label={C.recs.couldPublish}>{rec.could_publish}</Field>
      <Field label={C.recs.proofNeeded}>
        {rec.proof_needed}
        <div style={{ marginTop: 8 }}>
          {/* Neutral on purpose: the accent is spent on the one primary action
              and on the best-performing row, not on a status label. */}
          <Chip>{C.assetState[rec.asset_state] || C.assetState.none}</Chip>
        </div>
      </Field>

      <Drill
        label={C.recs.supports}
        summaryLeft={
          <span style={{ display: 'inline-flex', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
            {ev.sample_n !== null && ev.sample_n !== undefined && (
              <span><Num size="row" inline style={{ fontSize: 18 }}>{ev.sample_n}</Num>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: MUTE, marginLeft: 6 }}>
                  {C.recs.sample(ev.sample_n)}</span></span>
            )}
            {ev.unknowns !== null && ev.unknowns !== undefined && (
              <Delta>{C.recs.unknowns(ev.unknowns)}</Delta>
            )}
          </span>
        }
        style={{ marginTop: 16 }}
      >
        <Eyebrow>{C.recs.sources}</Eyebrow>
        {ids.length === 0 && <Meta style={{ marginTop: 6 }}>{C.recs.noSources}</Meta>}
        {ids.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ids.map((id, i) => (
              <div key={id} style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: INK }}>{C.recs.sourceLink(i + 1)}</span>
                {dates[i] && <Meta>{fmtDay(dates[i])}</Meta>}
                {postUrl(id) && (
                  <a href={postUrl(id) as string} target="_blank" rel="noopener noreferrer"
                     style={{ fontSize: 13, fontWeight: 700, color: INK, textDecoration: 'underline' }}>
                    {id}
                  </a>
                )}
                {!postUrl(id) && <span style={{ fontSize: 13, color: INK_SOFT }}>{id}</span>}
              </div>
            ))}
          </div>
        )}
      </Drill>

      <div style={{ marginTop: 12, display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <Eyebrow>{C.recs.happenedAfter}</Eyebrow>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: INK_SOFT }}>
          {C.linkState[rec.link_state] || C.linkState.unknown}
        </span>
      </div>

      <DecisionBlock rec={rec} live={live} onDecide={onDecide} />
    </Card>
  );
}

/* ══════════════════════════ per-post ledger ══════════════════════════ */

function PeopleLine({ e }: { e: AudiencePost['engagers'] }) {
  if (e.people === null || e.people === undefined) {
    return (
      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Blank style={{ maxWidth: 60, height: 26, minHeight: 26 }} />
        <Meta>{C.posts.people.none}</Meta>
      </div>
    );
  }
  // Only non-zero buckets are named, plus the remainder, so the parts shown
  // always reconcile with the total. `people` is the distinct-people count for
  // THIS post; a bucket at 0 contributes nothing and saying so is noise.
  const bits: string[] = [];
  if (e.positive) bits.push(e.positive === 1 ? C.posts.people.positiveOne : C.posts.people.positive(e.positive));
  if (e.borderline) bits.push(C.posts.people.borderline(e.borderline));
  if (e.unknown) bits.push(C.posts.people.unknown(e.unknown));
  const rest = e.people - ((e.positive ?? 0) + (e.borderline ?? 0) + (e.unknown ?? 0));
  if (rest > 0) bits.push(C.posts.people.notAFit(rest));
  if (e.excluded_operator > 0) bits.push(C.posts.people.excluded(e.excluded_operator));
  return (
    <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' }}>
      <Num size="row" inline style={{ fontSize: 18 }}>{e.people}</Num>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: INK }}>{C.posts.people.total(e.people)}</span>
      <Meta>{bits.join(' · ')}</Meta>
    </div>
  );
}

function PostRows({ posts }: { posts: AudiencePost[] }) {
  const best = posts.reduce(
    (m, p) => Math.max(m, p.raw.reactions ?? 0), 0);
  return (
    <Ledger
      className="audn-led"
      columns={[
        { label: C.posts.colDate, width: '1%' },
        { label: C.posts.colPost },
        { label: C.posts.colReactions, align: 'right', width: '1%' },
      ]}
      style={{ marginTop: 4 }}
    >
      {posts.map((p) => {
        const r = p.raw.reactions;
        const pct = best > 0 && r !== null ? (r / best) * 100 : 0;
        const rankLine = p.rank.basis === 'matched_age' && p.rank.rank && p.rank.eligible_n
          ? C.posts.rank.matched(p.rank.rank, p.rank.eligible_n, p.rank.target_age_days ?? 0)
          : p.rank.basis === 'observed_age' ? C.posts.rank.observed : C.posts.rank.none;
        const url = postUrl(p.post_social_id);
        return (
          <LedgerRow key={p.post_social_id} tone={p.rank.rank === 1 ? 'best' : 'default'}>
            <LedgerCell num align="left" width="1%" className="audn-when" style={{ fontSize: 18 }}>
              {fmtDay(p.published_at)}
            </LedgerCell>
            <LedgerCell>
              <div style={{ display: 'flex', gap: 9, alignItems: 'baseline', flexWrap: 'wrap' }}>
                {url ? (
                  <a href={url} target="_blank" rel="noopener noreferrer"
                     style={{ fontSize: 14.5, fontWeight: 700, color: INK, textDecoration: 'underline' }}>
                    {postLabel(p)}
                  </a>
                ) : (
                  <span style={{ fontSize: 14.5, fontWeight: 700, color: INK }}>{postLabel(p)}</span>
                )}
                <Chip>{rankLine}</Chip>
              </div>
              {r !== null && <LedgerBar pct={pct} tone={p.rank.rank === 1 ? 'strong' : 'muted'} />}
              <PeopleLine e={p.engagers} />
              <div style={{ marginTop: 8, display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'baseline' }}>
                <Meta>{C.posts.coverage[p.raw.coverage] || C.posts.coverage.unknown}</Meta>
                {p.raw.captured_at && <Meta>{C.posts.capturedAt(fmtDay(p.raw.captured_at))}</Meta>}
                {p.raw.impressions !== null && <Meta>{C.posts.impressions(p.raw.impressions)}</Meta>}
                {p.raw.comments !== null && <Meta>{C.posts.comments(p.raw.comments)}</Meta>}
                {p.raw.shares !== null && <Meta>{C.posts.shares(p.raw.shares)}</Meta>}
                {p.assisted_outcomes > 0 && <Delta dir="up">{C.posts.assisted(p.assisted_outcomes)}</Delta>}
              </div>
            </LedgerCell>
            <LedgerCell num align="right" width="1%" className="audn-reacts">
              {r === null
                ? <Blank style={{ maxWidth: 62, height: 30, minHeight: 30, marginLeft: 'auto' }} />
                : fmtNum(r)}
            </LedgerCell>
          </LedgerRow>
        );
      })}
    </Ledger>
  );
}

/* ══════════════════════════ monthly trend ══════════════════════════ */

function Trend({ rows }: { rows: AudiencePayload['monthly_median'] }) {
  if (!rows.length) {
    return (
      <div style={{ marginTop: 10 }}>
        <Blank style={{ maxWidth: 120, height: 32, minHeight: 32 }} />
        <Meta style={{ marginTop: 8 }}>{C.trend.none}</Meta>
      </div>
    );
  }
  const top = Math.max(...rows.map((r) => Number(r.median_reactions) || 0)) || 1;
  return (
    <div data-viz="" style={{ marginTop: 10 }}>
      {rows.map((r, i) => {
        const v = Number(r.median_reactions) || 0;
        return (
          <BarRow
            key={`${r.month}-${r.target_age_days}-${i}`}
            label={fmtMonth(r.month)}
            value={<Num size="row" inline style={{ fontSize: 19 }}>{fmtNum(r.median_reactions)}</Num>}
            pct={(v / top) * 100}
            tone={i === rows.length - 1 ? 'strong' : 'muted'}
          />
        );
      })}
      <div style={{ marginTop: 10, display: 'flex', gap: 9, flexWrap: 'wrap' }}>
        {rows.map((r, i) => (
          <Meta key={`n-${r.month}-${i}`}>
            {fmtMonth(r.month)}: {C.trend.sample(r.n)}
            {r.target_age_days ? ` ${C.trend.age(r.target_age_days)}` : ''}
          </Meta>
        ))}
      </div>
      <Meta style={{ marginTop: 8 }}>
        {rows.every((r) => r.basis === 'matched_age') ? C.trend.basisMatched : C.trend.basisOther}
      </Meta>
    </div>
  );
}

/* ══════════════════════════ the section ══════════════════════════ */

export function AudienceSection({ audience, live = false, onDecide }: {
  audience: AudiencePayload | null | undefined;
  /** Live board = the production tool. A preview board renders the section
   *  read-only: the decision buttons are switched off and say so. */
  live?: boolean;
  onDecide?: DecideFn;
}) {
  // The sixth state is ABSENCE. The feature is off for this client, or the
  // client has no manifest: render nothing at all, never a placeholder.
  if (!audience) return null;

  const { state, posts, recommendations, monthly_median: median, assets, freshness } = audience;
  // Posts that actually have a people count. NEVER the sum of the per-post
  // people columns: those are distinct within a post, not across posts, so a sum
  // would report a distinct-people total that is wrong (contract rule 3).
  const postsWithPeople = posts.filter((p) => p.engagers.people !== null && p.engagers.people > 0).length;
  const headline = state === 'empty'
    ? C.headline.nothingYet
    : postsWithPeople > 0
      ? C.headline.withCoverage(posts.length, postsWithPeople)
      : C.headline.postsOnly(posts.length);
  const stateLine = (C.state as Record<string, string>)[state];
  // TWO chips, and they answer two different questions. The state chip says what
  // KIND of review this is; the freshness chip says how current it is and reads
  // `freshness.overall` alone (§2.1). `normal` has no state chip: the only thing
  // it used to say was "Up to date", which is the freshness chip's claim to make.
  // When the two would print the same word (a stale review whose sources are both
  // out of date) only one is shown.
  const stateChip = C.stateChip[state];
  const freshChip = freshnessChipLabel(freshness);
  const chips = [stateChip, freshChip].filter(
    (c, i, a): c is string => !!c && a.indexOf(c) === i,
  );
  const people = audience.people ?? null;

  return (
    <section
      data-audn-section={state}
      data-audn-freshness={freshness.overall ?? ''}
      style={{ marginTop: 34 }}
    >
      <style>{AUDN_CSS}</style>
      <SectionRule
        label={C.eyebrow}
        count={posts.length}
        blurb={C.postsBlurb(posts.length)}
        right={chips.length > 0
          ? (
            <span style={{ display: 'inline-flex', gap: 7, flexWrap: 'wrap' }}>
              {chips.map((c) => <Chip key={c}>{c}</Chip>)}
            </span>
          )
          : undefined}
      />
      <DeskH2>{headline}</DeskH2>

      <Meta style={{ marginTop: 10 }}>
        {[
          audience.reviewed_at ? C.reviewedOn(fmtDay(audience.reviewed_at)) : C.reviewedNever,
          C.cadence(audience.review_cadence),
          ...freshnessLines(freshness),
          // The window is worth stating whenever something is out of date or
          // missing, not only in the `stale` state: `partial` is exactly the
          // case the old derivation hid.
          ...(state === 'stale' || (freshness.overall && freshness.overall !== 'fresh')
            ? [C.freshness.staleAfter(freshness.stale_after_days)]
            : []),
        ].join('  ·  ')}
      </Meta>

      {stateLine && state !== 'normal' && (
        <div
          data-audn-state-line=""
          style={{ marginTop: 14, padding: '13px 16px', borderRadius: 12, background: SUNK,
                   fontSize: 14, fontWeight: 600, lineHeight: 1.5, color: INK }}
        >{stateLine}</div>
      )}
      {state === 'normal' && <Meta style={{ marginTop: 12 }}>{stateLine}</Meta>}

      {/* ---- recommendations ------------------------------------------- */}
      {state !== 'empty' && (
        <div style={{ marginTop: 26 }}>
          <SectionRule label={C.recs.heading} count={recommendations.length} blurb={C.recs.blurb} />
          {recommendations.length === 0 && <Meta style={{ marginTop: 12 }}>{C.recs.none}</Meta>}
          {recommendations.length > 0 && (
            <Cols n={2} style={{ marginTop: 16 }}>
              {recommendations.map((r) => (
                <RecommendationCard key={r.recommendation_id} rec={r} live={live} onDecide={onDecide} />
              ))}
            </Cols>
          )}
        </div>
      )}

      {/* ---- per-post ledger ------------------------------------------- */}
      {posts.length > 0 && (
        <div style={{ marginTop: 30 }}>
          <SectionRule label={C.posts.heading} count={posts.length} blurb={C.posts.blurb} />
          <PostRows posts={posts} />
          <Footnote>{C.posts.notSummed}</Footnote>
          {/* The two limits that sit beside every relevance count (§2.4): what
              the judge is worth, and what the sample covers. */}
          <Footnote style={{ marginTop: 4 }}>{C.limits.classifier}</Footnote>
          <Footnote style={{ marginTop: 4 }}>{C.limits.coverage}</Footnote>
          <Footnote style={{ marginTop: 4 }}>{C.posts.assistedNote}</Footnote>
        </div>
      )}
      {posts.length === 0 && state !== 'empty' && (
        <div style={{ marginTop: 26 }}>
          <SectionRule label={C.posts.heading} blurb={C.posts.blurb} />
          <Meta style={{ marginTop: 12 }}>{C.posts.none}</Meta>
        </div>
      )}

      {/* ---- relationship ----------------------------------------------- */}
      {state !== 'empty' && people && <RelationshipBlock people={people} />}

      {/* ---- monthly trend --------------------------------------------- */}
      {state !== 'empty' && (
        <div style={{ marginTop: 30 }}>
          <SectionRule label={C.trend.heading} count={median.length} blurb={C.trend.blurb} />
          <Trend rows={median} />
        </div>
      )}

      {/* ---- approved material ----------------------------------------- */}
      {assets.length > 0 && (
        <div style={{ marginTop: 30 }}>
          <SectionRule label={C.assets.heading} count={assets.length} blurb={C.assets.blurb} />
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {assets.map((a) => (
              <div key={a.asset_id} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
                <Chip>{a.confidentiality}</Chip>
                <span style={{ fontSize: 14, fontWeight: 700, color: INK }}>{a.source}</span>
                <Meta style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{a.factual_context}</Meta>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default AudienceSection;
