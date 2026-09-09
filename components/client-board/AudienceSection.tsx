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

export type AudiencePayload = {
  client_id: string;
  capability_version: number;
  reviewed_at: string | null;
  review_cadence: string;
  state: AudienceState;
  freshness: {
    snapshots_as_of: string | null; engagers_as_of: string | null; stale_after_days: number;
  };
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
          <Chip tone={rec.asset_state === 'approved' ? 'accent' : 'default'}>
            {C.assetState[rec.asset_state] || C.assetState.none}
          </Chip>
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
  const bits: string[] = [];
  if (e.positive !== null) bits.push(e.positive === 1 ? C.posts.people.positiveOne : C.posts.people.positive(e.positive));
  if (e.borderline !== null) bits.push(C.posts.people.borderline(e.borderline));
  if (e.unknown !== null) bits.push(C.posts.people.unknown(e.unknown));
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
            <LedgerCell num align="left" width="1%" style={{ fontSize: 18 }}>
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
                <Chip tone={p.rank.rank === 1 ? 'accent' : 'default'}>{rankLine}</Chip>
              </div>
              {r !== null && <LedgerBar pct={pct} tone={p.rank.rank === 1 ? 'strong' : 'muted'} />}
              <PeopleLine e={p.engagers} />
              <div style={{ marginTop: 8, display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'baseline' }}>
                <Meta>{C.posts.coverage[p.raw.coverage] || C.posts.coverage.unknown}</Meta>
                {p.raw.captured_at && <Meta>{C.posts.capturedAt(fmtDay(p.raw.captured_at))}</Meta>}
                {p.raw.impressions !== null && <Meta>{C.posts.impressions(fmtNum(p.raw.impressions))}</Meta>}
                {p.raw.comments !== null && <Meta>{C.posts.comments(fmtNum(p.raw.comments))}</Meta>}
                {p.raw.shares !== null && <Meta>{C.posts.shares(fmtNum(p.raw.shares))}</Meta>}
                {p.assisted_outcomes > 0 && <Delta dir="up">{C.posts.assisted(p.assisted_outcomes)}</Delta>}
              </div>
            </LedgerCell>
            <LedgerCell num align="right" width="1%">
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
  const peopleTotal = posts.reduce((t, p) => t + (p.engagers.people ?? 0), 0);
  const headline = state === 'empty'
    ? C.headline.nothingYet
    : peopleTotal > 0
      ? C.headline.withPeople(posts.length, peopleTotal)
      : C.headline.postsOnly(posts.length);
  const stateLine = (C.state as Record<string, string>)[state];
  const stateChip = (C.stateChip as Record<string, string>)[state];

  return (
    <section data-audn-section={state} style={{ marginTop: 34 }}>
      <SectionRule
        label={C.eyebrow}
        count={posts.length}
        blurb={C.postsBlurb(posts.length)}
        right={stateChip ? <Chip>{stateChip}</Chip> : undefined}
      />
      <DeskH2>{headline}</DeskH2>

      <div style={{ marginTop: 10, display: 'flex', gap: 9, flexWrap: 'wrap' }}>
        <Meta>{audience.reviewed_at ? C.reviewedOn(fmtDay(audience.reviewed_at)) : C.reviewedNever}</Meta>
        <Meta>{C.cadence(audience.review_cadence)}</Meta>
        <Meta>{freshness.snapshots_as_of
          ? C.freshness.snapshots(fmtDay(freshness.snapshots_as_of))
          : C.freshness.snapshotsNone}</Meta>
        <Meta>{freshness.engagers_as_of
          ? C.freshness.engagers(fmtDay(freshness.engagers_as_of))
          : C.freshness.engagersNone}</Meta>
        {state === 'stale' && <Meta>{C.freshness.staleAfter(freshness.stale_after_days)}</Meta>}
      </div>

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
          <Footnote>{C.posts.assistedNote}</Footnote>
        </div>
      )}
      {posts.length === 0 && state !== 'empty' && (
        <div style={{ marginTop: 26 }}>
          <SectionRule label={C.posts.heading} blurb={C.posts.blurb} />
          <Meta style={{ marginTop: 12 }}>{C.posts.none}</Meta>
        </div>
      )}

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
