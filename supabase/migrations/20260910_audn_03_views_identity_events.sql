-- ============================================================================
-- Audience-learning measurement foundation — 03 / identity + interaction events.
-- goal-run audience-learning-02-foundation-2026-09-09, foundation seat.
-- Worklist: W01 (post identity), W02 (canonical interaction events),
--           W03 (two-store reconciliation), W06 (timing confidence),
--           W10 (person activity / return signals),
--           W12 / W25 (operator + team exclusion made READABLE IN SQL).
--
-- Depends on: 01_functions (audn_person_key, audn_urn_kind, audn_urn_digits).
-- Source tables (all pre-existing): client_registry, own_posts,
--   client_post_metrics, post_engagers, client_post_engagers,
--   client_post_comments, ivan_post_outcome_spine.
--
-- security_invoker = true on every view: the caller's RLS decides what they
-- see. A security-definer read path here would let any role that can select the
-- view read every client's rows, which is exactly the tenant leak §3.1 forbids.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- audn_excluded_person_v — the measurement exclusion list, as rows (W12 / W25).
--
-- Until this view existed the exclusion list lived ONLY in client configuration
-- (client_registry.platform->'measurement'->'exclusions', staged in
-- OUT/staged/manifests/<client>.json). Nothing in SQL could read it, so the
-- claim "the views expose is_operator so consumers can exclude without deleting
-- rows" was config, not code. This view is the code.
--
-- One row per (client_id, person_key, exclusion_kind):
--   operator  <- platform.measurement.exclusions.operator_person_keys
--                (the operator's own account — Ivan engages his clients' posts;
--                counting him as audience inflates every RISE/ARCH denominator)
--   team      <- platform.measurement.exclusions.team_person_keys
--
-- FAIL-QUIET BY CONSTRUCTION. A client with no registry row, a NULL platform,
-- no measurement block, no exclusions block, or a key holding something other
-- than an array contributes ZERO rows and raises nothing. Every step is guarded
-- with jsonb_typeof rather than assuming shape: a config typo must not take the
-- measurement views down.
--
-- distinct: a key repeated in the config is one exclusion, not two.
--
-- NOTHING IS FILTERED HERE OR ANYWHERE DOWNSTREAM. This view only makes the
-- list joinable; audn_person_activity_v / audn_person_label_v /
-- audn_relationship_v carry is_operator + is_excluded as FLAGS and still emit
-- every person. Deleting the rows would destroy the evidence that the operator
-- engaged at all; flagging them lets Run 03 exclude them from denominators and
-- still show the raw count beside the adjusted one.
-- ---------------------------------------------------------------------------
create or replace view public.audn_excluded_person_v
with (security_invoker = true) as
with cfg as (
  select
    cr.client_id,
    case
      when jsonb_typeof(cr.platform) = 'object'
       and jsonb_typeof(cr.platform -> 'measurement') = 'object'
       and jsonb_typeof(cr.platform -> 'measurement' -> 'exclusions') = 'object'
      then cr.platform -> 'measurement' -> 'exclusions'
      else '{}'::jsonb
    end                                                     as ex
  from public.client_registry cr
  where nullif(btrim(cr.client_id), '') is not null
),
keys as (
  select client_id, 'operator'::text as exclusion_kind, 'operator_person_keys'::text as cfg_key
  from cfg
  union all
  select client_id, 'team'::text, 'team_person_keys'::text
  from cfg
)
select distinct
  cfg.client_id,
  btrim(k.person_key)                                       as person_key,
  keys.exclusion_kind
from cfg
join keys on keys.client_id = cfg.client_id
cross join lateral jsonb_array_elements_text(
  case when jsonb_typeof(cfg.ex -> keys.cfg_key) = 'array'
       then cfg.ex -> keys.cfg_key
       else '[]'::jsonb
  end
) as k(person_key)
where nullif(btrim(k.person_key), '') is not null;

comment on view public.audn_excluded_person_v is
  'Measurement exclusion list as rows, expanded from client_registry.platform->measurement->exclusions (operator_person_keys -> kind operator, team_person_keys -> kind team). A client with no manifest, no measurement block or no exclusions contributes zero rows. Nothing is filtered anywhere: consumers join this and exclude, they never delete (W12 / W25).';

-- ---------------------------------------------------------------------------
-- audn_post_identity_v — one row per published post, per owning client.
--
-- Two physical stores, one logical record (DATA-CONTRACT "Published post"):
--   * Ivan  -> own_posts            (251 rows, client_id is the literal 'ivan')
--   * clients -> client_post_metrics (58 rows, client_id is on the row)
-- There is no social_id overlap between the two, so no post can be claimed by
-- two owners; the harness asserts uniqueness of (client_id, post_social_id).
--
-- C3: client_id is derived HERE, in a scoped view. Run 01 proposed a generated
-- column on post_engagers computed by a function that reads other tables —
-- PostgreSQL does not allow that, and marking such a lookup IMMUTABLE to force
-- it through would be a lie about the function. No generated column exists.
--
-- Topic provenance differs by lane and is labelled rather than blended:
--   Ivan     topic = own_posts.pillar             (topic_source own_posts.pillar)
--   clients  topic = client_post_metrics.funnel_class
--                                                 (topic_source client_post_metrics.funnel_class)
-- topic_version comes from funnel_class_meta->>'version' and is NULL today on
-- every row — the classifier stamps 'classifier'/'at', not a version. NULL is
-- reported as unknown, not backfilled.
--
-- idea_id: Ivan resolves through ivan_post_outcome_spine.lm_idea_candidate_id
-- (99 of 350 spine rows carry a post_social_id). RISE/ARCH idea linkage runs
-- carousel_drafts.client_idea_id -> client_ideas and needs the
-- scheduled_posts/source_post_id chain; that join is DEFERRED and recorded, so
-- client idea_id is NULL here rather than guessed.
-- ---------------------------------------------------------------------------
create or replace view public.audn_post_identity_v
with (security_invoker = true) as
with spine as (
  -- one idea per post; the spine is unique on post_social_id today, the
  -- distinct on keeps it deterministic if it ever stops being
  select distinct on (s.post_social_id)
         s.post_social_id,
         s.lm_idea_candidate_id
  from public.ivan_post_outcome_spine s
  where s.post_social_id is not null
  order by s.post_social_id, s.lm_idea_candidate_id nulls last
)
select
  'ivan'::text                                        as client_id,
  op.social_id                                        as post_social_id,
  public.audn_urn_kind(op.social_id)                  as post_urn_kind,
  public.audn_urn_digits(op.social_id)                as post_urn_digits,
  op.posted_at                                        as published_at,
  op.post_type                                        as format,
  spine.lm_idea_candidate_id::uuid                    as idea_id,
  op.pillar                                           as topic,
  'own_posts.pillar'::text                            as topic_source,
  null::text                                          as topic_version,
  'own_posts'::text                                   as source_table
from public.own_posts op
left join spine on spine.post_social_id = op.social_id
where op.social_id is not null
union all
select
  m.client_id,
  m.social_id                                         as post_social_id,
  public.audn_urn_kind(m.social_id)                   as post_urn_kind,
  public.audn_urn_digits(m.social_id)                 as post_urn_digits,
  m.published_at,
  m.meta ->> 'format'                                 as format,
  null::uuid                                          as idea_id,
  m.funnel_class                                      as topic,
  'client_post_metrics.funnel_class'::text            as topic_source,
  m.funnel_class_meta ->> 'version'                   as topic_version,
  'client_post_metrics'::text                         as source_table
from public.client_post_metrics m
where m.social_id is not null;

comment on view public.audn_post_identity_v is
  'One row per (client_id, post_social_id). The single place post ownership is resolved; every other audn_ view scopes through this, never through a path or a name (CONTRACTS §3.1).';

-- ---------------------------------------------------------------------------
-- audn_interaction_events_v — one canonical event per
--   (client_id, post_social_id, person_key, kind).
--
-- Two writers, one truth (handoff correction C2):
--   * post_engagers        (477 rows) — Ivan + ARCH loggers, plus RISE rows,
--                                       carries first_seen_at / last_seen_at
--   * client_post_engagers (236 rows) — the RISE harvest, carries seen_at only
--
-- 713 physical rows collapse to 479 canonical events (RISE 275 / Ivan 112 /
-- ARCH 92): 234 events exist in BOTH RISE stores and 2 exist only in
-- client_post_engagers. Reproducing 713 would be a baseline-import check, never
-- the event count.
--
-- EARLIEST OBSERVATION WINS. client_post_engagers.seen_at is a HARVEST date —
-- that workflow first ran 2026-09-06 and its upsert body omits seen_at, so
-- every one of its 236 rows sits in a 3-day band. Taking min() across the
-- stores means the RISE harvest can never overwrite an older first_seen_at and
-- can never compress the whole RISE audience into one September cohort. It is
-- min/max, not last-writer-wins, precisely for that reason.
--
-- TIMING (§3.3, C1). Neither store records a platform event time; a re-seen
-- reaction only PATCHes last_seen_at. So every event is 'collection_only'
-- unless client_post_comments has the actual comment, which carries the real
-- comment_id and posted_at from LinkedIn. Those get timing_confidence
-- 'event_time'. A collection interval is NOT a platform event time and is never
-- promoted to one.
--
-- IDENTITY. A row whose four identity columns are all empty gets an opaque
-- per-row sentinel key ('unresolved:<table>:<id>') instead of NULL: NULL keys
-- would be treated as equal by GROUP BY and would silently merge two anonymous
-- strangers into one person. The sentinel keeps them apart and stays visibly
-- unresolved. Zero census rows need it.
--
-- No client_id column is added to post_engagers (C3) — ownership is joined.
-- ---------------------------------------------------------------------------
create or replace view public.audn_interaction_events_v
with (security_invoker = true) as
with raw_events as (
  -- post_engagers: owner resolved through the identity view, never assumed
  select
    id.client_id,
    pe.post_social_id,
    coalesce(
      public.audn_person_key(pe.provider_id, pe.member_id, pe.linkedin_url, pe.name),
      'unresolved:post_engagers:' || pe.id::text
    )                                                       as person_key,
    pe.engagement_type                                      as kind,
    pe.first_seen_at                                        as first_observed_at,
    greatest(pe.first_seen_at, coalesce(pe.last_seen_at, pe.first_seen_at))
                                                            as last_observed_at,
    'post_engagers:' || pe.id::text                         as source_ref
  from public.post_engagers pe
  join public.audn_post_identity_v id
    on id.post_social_id = pe.post_social_id
  union all
  -- client_post_engagers: owner resolved through client_post_metrics.id, which
  -- is what post_id actually references. client_post_engagers.client_id is not
  -- trusted as the scope on its own — the post's owner is.
  select
    id.client_id,
    m.social_id                                             as post_social_id,
    coalesce(
      nullif(btrim(cpe.profile_id), ''),
      'unresolved:client_post_engagers:' || cpe.id::text
    )                                                       as person_key,
    cpe.kind,
    cpe.seen_at                                             as first_observed_at,
    cpe.seen_at                                             as last_observed_at,
    'client_post_engagers:' || cpe.id::text                 as source_ref
  from public.client_post_engagers cpe
  join public.client_post_metrics m
    on m.id = cpe.post_id
  join public.audn_post_identity_v id
    on id.client_id = m.client_id
   and id.post_social_id = m.social_id
),
merged as (
  select
    client_id,
    post_social_id,
    person_key,
    kind,
    min(first_observed_at)                                  as first_observed_at,
    max(last_observed_at)                                   as last_observed_at,
    array_agg(source_ref order by source_ref)                as sources
  from raw_events
  group by 1, 2, 3, 4
),
comment_times as (
  -- the only real platform timing available anywhere in the record
  select distinct on (c.post_urn, c.author_provider_id)
         c.post_urn,
         c.author_provider_id,
         c.posted_at,
         c.comment_id
  from public.client_post_comments c
  where c.comment_id is not null
    and c.posted_at is not null
    and c.author_provider_id is not null
  order by c.post_urn, c.author_provider_id, c.posted_at
)
select
  m.client_id,
  m.post_social_id,
  m.person_key,
  m.kind,
  m.first_observed_at,
  m.last_observed_at,
  ct.posted_at                                              as event_time,
  case when ct.posted_at is not null
       then 'event_time'
       else 'collection_only'
  end::text                                                 as timing_confidence,
  ct.comment_id                                             as platform_event_id,
  m.sources,
  coalesce(array_length(m.sources, 1), 0)                   as source_count
from merged m
left join comment_times ct
  on m.kind = 'comment'
 and ct.post_urn = m.post_social_id
 and ct.author_provider_id = m.person_key;

comment on view public.audn_interaction_events_v is
  'Canonical interaction events: one row per (client_id, post_social_id, person_key, kind), earliest observation preserved across both stores, provenance kept in sources. Collection time is never presented as platform event time (CONTRACTS §3.2 / §3.3).';

-- ---------------------------------------------------------------------------
-- audn_person_activity_v — per person, per client. Return signals (§3.3, C1).
--
-- THE RULE THAT MATTERS: `observed_across_posts` is a NAMED SIGNAL and is never
-- a return visit. Seeing the same person on two posts only proves the collector
-- saw them twice; a backfill or a late first sweep produces exactly that shape.
--
-- confirmed_return is true only when one of two things is establishable:
--   (a) event_time  — two of the person's events carry real platform times at
--                     least 24 h apart;
--   (b) bounded     — for two distinct posts A and B, published_at(B) is at
--                     least 24 h after the person's first observation on A.
--                     B did not exist until a day after A had already been
--                     observed, so the person cannot have done both in one
--                     sitting. This is a bound from publication times, not an
--                     inferred timestamp.
-- Everything else is return_timing 'unknown' with confirmed_return false —
-- which surfaces as unknown, NEVER as a zero in a count of returns (§3.9).
-- Same-post returns are always unknown (Run 01 D03): the logger overwrites
-- last_seen_at and stores no visit count.
--
-- Census under this rule: across-posts RISE 28 / Ivan 6 / ARCH 21; the bounded
-- rule qualifies 18 / 4 / 15, which is the frozen assertion in
-- fixtures/expected/census-baseline.json. confirmed_return is the UNION of the
-- two rules and is therefore RISE 20 / Ivan 4 / ARCH 15 — two RISE people are
-- confirmed by real comment times alone (they commented on two posts more than
-- 24 h apart, but the second post was published too soon for the bound to hold).
--
-- return_timing REPORTS THE BOUND WHEN BOTH RULES FIRE. Naming the weaker
-- evidence can only understate the claim; naming 'event_time' for someone whose
-- bound already settles it would overstate it. So the count of
-- return_timing = 'bounded' is exactly the frozen 18 / 4 / 15, and
-- 'event_time' names only the people the bound could not reach.
-- ---------------------------------------------------------------------------
create or replace view public.audn_person_activity_v
with (security_invoker = true) as
with ev as (
  select * from public.audn_interaction_events_v
),
agg as (
  select
    client_id,
    person_key,
    count(distinct post_social_id)::int                     as distinct_posts,
    count(*)::int                                           as total_events,
    min(first_observed_at)                                  as first_observed_at,
    max(last_observed_at)                                   as last_observed_at
  from ev
  group by 1, 2
),
per_post as (
  select
    e.client_id,
    e.person_key,
    e.post_social_id,
    min(e.first_observed_at)                                as post_first_observed_at
  from ev e
  group by 1, 2, 3
),
per_post_pub as (
  select
    pp.*,
    id.published_at
  from per_post pp
  left join public.audn_post_identity_v id
    on id.client_id = pp.client_id
   and id.post_social_id = pp.post_social_id
),
bounded as (
  -- (b): a post that did not exist 24 h after the person was already observed
  select distinct a.client_id, a.person_key
  from per_post_pub a
  join per_post_pub b
    on b.client_id      = a.client_id
   and b.person_key     = a.person_key
   and b.post_social_id <> a.post_social_id
  where b.published_at is not null
    and a.post_first_observed_at is not null
    and b.published_at >= a.post_first_observed_at + interval '24 hours'
),
by_event_time as (
  -- (a): two real platform times far enough apart to be two sittings
  select client_id, person_key
  from ev
  where event_time is not null
  group by 1, 2
  having max(event_time) - min(event_time) >= interval '24 hours'
),
excl as (
  -- W12 / W25. LEFT JOINED, NEVER FILTERED — see audn_excluded_person_v.
  select client_id, person_key,
         bool_or(exclusion_kind = 'operator') as is_operator
  from public.audn_excluded_person_v
  group by 1, 2
)
select
  a.client_id,
  a.person_key,
  a.distinct_posts,
  a.total_events,
  a.first_observed_at,
  a.last_observed_at,
  (a.distinct_posts >= 2)                                   as observed_across_posts,
  (et.person_key is not null or b.person_key is not null)    as confirmed_return,
  case
    when b.person_key  is not null then 'bounded'
    when et.person_key is not null then 'event_time'
    else 'unknown'
  end::text                                                  as return_timing,
  coalesce(x.is_operator, false)                             as is_operator,
  (x.person_key is not null)                                 as is_excluded
from agg a
left join by_event_time et
  on et.client_id = a.client_id and et.person_key = a.person_key
left join bounded b
  on b.client_id = a.client_id and b.person_key = a.person_key
left join excl x
  on x.client_id = a.client_id and x.person_key = a.person_key;

comment on view public.audn_person_activity_v is
  'One row per (client_id, person_key). observed_across_posts is a named signal, never a return; confirmed_return needs platform event times 24h apart or a publication-time bound (CONTRACTS §3.3, handoff C1). is_operator / is_excluded are FLAGS from audn_excluded_person_v: no row is dropped, and any Run 03 denominator must exclude the flagged people itself (W12 / W25).';
