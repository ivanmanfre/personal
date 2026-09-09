-- ============================================================================
-- Audience-learning measurement foundation — 05 / outcomes, assists, cohorts.
-- goal-run audience-learning-02-foundation-2026-09-09, foundation seat.
-- Worklist: W08 (stable outcome id + qualification), W13 (assist rule version),
--           W32 (company dedupe), W10 (cohorts + maturity), W07 (window counts
--           renamed, never presented as attribution), W25 (unknown is a value).
--
-- Depends on: 01_functions, 03_views_identity_events,
--             04_views_classification_relationship.
-- Source tables: booking_attributions, outreach_prospects, outreach_campaigns,
--   ivan_post_outcome_spine, rise_buyers_post_ledger.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- audn_outcomes_v — one booking, one outcome_id, forever.
--
-- outcome_id = booking_attributions.meeting_id (the PK). 117 rows, 117 distinct
-- ids. A booking is counted once no matter how many posts assisted it.
--
-- PERSON MATCH. booking_attributions has no post reference at all, so the only
-- path from a booking to an engager is prospect_id -> outreach_prospects
-- -> linkedin_profile_id. match_confidence says so out loud: 'prospect_id' when
-- that path resolved, 'none' when it did not. A booking that never matches a
-- person KEEPS its row here — it is a real outcome with an unknown origin, and
-- dropping it would understate the lane.
--
-- meeting_kind. ARCH's calendar is mostly hiring: 15 of its 17 bookings are
-- titled "Screening Interview". Recruiting meetings are excluded from
-- `qualified` (§3.6) — counting interviews as pipeline would triple ARCH's
-- apparent commercial result. A CANCELLED meeting is excluded too: it was
-- booked and then did not happen, so it is not qualified pipeline either.
-- qualified is NULL, not false, when the title gives no basis to judge.
--
-- event_type. HELD/COMPLETED -> attended; CANCELLED/CANCELED (either case, or a
-- 'Canceled:' title prefix) -> cancelled; SCHEDULED/RESCHEDULED/NULL -> booked.
-- Anything else is 'unknown' rather than being forced into booked.
-- ---------------------------------------------------------------------------
create or replace view public.audn_outcomes_v
with (security_invoker = true) as
with prospect as (
  select p.id, p.linkedin_profile_id
  from public.outreach_prospects p
)
select
  ba.client_id,
  ba.meeting_id                                            as outcome_id,
  nullif(btrim(pr.linkedin_profile_id), '')                as person_key,
  ba.prospect_id::uuid                                     as prospect_id,
  nullif(
    lower(
      coalesce(
        regexp_replace(
          split_part(
            split_part(
              regexp_replace(btrim(ba.booker_website), '^[a-zA-Z][a-zA-Z0-9+.-]*://', ''),
              '/', 1),
            '?', 1),
          '^www\.', '', 'i'),
        split_part(btrim(ba.booker_email), '@', 2)
      )
    ), '')                                                 as company_key,
  ba.booked_at,
  ba.meeting_start,
  ev.event_type,
  case
    when lower(coalesce(ba.meeting_title, '')) ~ 'screening interview|interview|recruit|candidate'
      then 'recruiting'
    when nullif(btrim(ba.meeting_title), '') is not null then 'sales'
    else 'unknown'
  end::text                                                as meeting_kind,
  case
    when lower(coalesce(ba.meeting_title, '')) ~ 'screening interview|interview|recruit|candidate'
      then false
    -- A CANCELLED MEETING IS NOT QUALIFIED PIPELINE. The conversation was
    -- booked and then did not happen; counting it as qualified would report a
    -- meeting nobody attended as commercial result
    -- (fixtures/cases/cancelled-booking). This reads ev.event_type — the value
    -- the view actually reports — rather than re-deriving cancellation from the
    -- title, because one RISE row is titled 'Canceled: ...' while its outcome
    -- says COMPLETED, and the two derivations would disagree.
    when ev.event_type = 'cancelled' then false
    when nullif(btrim(ba.meeting_title), '') is not null then true
    else null
  end                                                      as qualified,
  'booking_attributions'::text                             as source,
  case when nullif(btrim(pr.linkedin_profile_id), '') is not null
       then 'prospect_id' else 'none'
  end::text                                                as match_confidence
from public.booking_attributions ba
left join prospect pr
  on pr.id = ba.prospect_id
cross join lateral (
  select (case
    when upper(coalesce(ba.meeting_outcome, '')) in ('HELD', 'COMPLETED')          then 'attended'
    when upper(coalesce(ba.meeting_outcome, '')) in ('CANCELLED', 'CANCELED')      then 'cancelled'
    when ba.meeting_title ilike 'Canceled:%' or ba.meeting_title ilike 'Cancelled:%' then 'cancelled'
    when ba.meeting_outcome is null                                                then 'booked'
    when upper(ba.meeting_outcome) in ('SCHEDULED', 'RESCHEDULED')                 then 'booked'
    else 'unknown'
  end)::text as event_type
) ev;

comment on view public.audn_outcomes_v is
  'One row per booking (outcome_id = meeting_id). Recruiting meetings are excluded from qualified; a booking with no resolvable person keeps its row with match_confidence = none (CONTRACTS §3.6).';

-- ---------------------------------------------------------------------------
-- audn_outcome_assists_v — which posts the booker had already touched.
--
-- Assist = an interaction by the outcome's person that was already observed
-- BEFORE the booking. One outcome can have many assists (one per post); the
-- outcome itself is still counted once in audn_outcomes_v, which is the whole
-- point of keeping assists in a separate view.
--
-- This is INFLUENCE, NOT CAUSATION (rule R9). Nothing here says a post caused a
-- booking; it says the person had been observed on that post first.
-- rule_version is stamped on every row so a later rule change is a new version,
-- never a silent re-interpretation of old numbers.
--
-- assist_rank is chronological: 1 = the earliest observed post. An outcome with
-- no matched person produces zero rows here and still exists in
-- audn_outcomes_v.
-- ---------------------------------------------------------------------------
create or replace view public.audn_outcome_assists_v
with (security_invoker = true) as
with per_post as (
  select
    e.client_id,
    e.person_key,
    e.post_social_id,
    min(e.first_observed_at) as first_observed_at
  from public.audn_interaction_events_v e
  group by 1, 2, 3
)
select
  o.client_id,
  o.outcome_id,
  o.person_key,
  pp.post_social_id,
  pp.first_observed_at,
  row_number() over (
    partition by o.client_id, o.outcome_id
    order by pp.first_observed_at, pp.post_social_id
  )::int                                    as assist_rank,
  'audn-assist-v1'::text                    as rule_version
from public.audn_outcomes_v o
join per_post pp
  on pp.client_id  = o.client_id
 and pp.person_key = o.person_key
where o.person_key is not null
  and o.booked_at is not null
  and pp.first_observed_at < o.booked_at;

comment on view public.audn_outcome_assists_v is
  'Posts the booker was observed on before the booking. Influence, not causation; one outcome may have many assists but is still one outcome (rule R9, worklist W13).';

-- ---------------------------------------------------------------------------
-- audn_company_outcomes_v — two employees of one company are one deal.
--
-- Without this, a company that sends two people to two calls looks like two
-- wins. Dedupe key is company_key (booker website domain, else the email
-- domain), stamped in dedupe_rule so the basis is never guessed by a reader.
--
-- An outcome with NO company_key stays its own row rather than being merged
-- into a single giant "unknown company" bucket — merging strangers because they
-- are both unknown is exactly the fabrication §3.9 forbids. Those rows carry
-- company_key = NULL and outcomes = 1.
-- ---------------------------------------------------------------------------
create or replace view public.audn_company_outcomes_v
with (security_invoker = true) as
select
  o.client_id,
  o.company_key,
  min(o.booked_at)                                   as first_booked_at,
  count(*)::int                                      as outcomes,
  count(distinct o.person_key)::int                  as people,
  'company_key'::text                                as dedupe_rule
from public.audn_outcomes_v o
group by o.client_id,
         o.company_key,
         case when o.company_key is null then o.outcome_id else null end;

comment on view public.audn_company_outcomes_v is
  'One row per company per client (two employees, one deal). Outcomes with no company_key are never merged with each other (worklist W32).';

-- ---------------------------------------------------------------------------
-- audn_person_cohorts_v — 30 / 60 / 90 day cohorts with honest maturity.
--
-- origin_at = the person's first observed interaction. origin_label is the
-- literal 'first_observed' because that is what it is: Ivan's logger reads only
-- the 12 most recent own_posts per run, so a person's TRUE first touch on an
-- older post was never observable. Calling this "first touch" would be a claim
-- the collection cannot support.
--
-- eligible = mature = (audn_cutoff() - origin_at >= window). C4: this is
-- recomputed per person from the source events every time — never trusted from
-- a stored eligible_people count.
--
-- Census under a 2026-09-09T14:30Z cutoff: Ivan 28/0/0, RISE 23/11/0,
-- ARCH 0/0/0. Those zeros are IMMATURE WINDOWS, not absence of outcomes: ARCH
-- collection starts 2026-08-28, twelve days before the cutoff. mature = false
-- is what a surface must render; it must never render 0 bookings.
--
-- outcome:
--   booked / attended / cancelled  — an outcome for this person landed inside
--                                    [origin_at, origin_at + window)
--   none_observed_in_lane          — the person HAS a scoped prospect row and
--                                    no outcome fell in the window. This is
--                                    evidence about the observed lane only. A
--                                    current outreach row with no reply is not
--                                    proof that no conversation happened
--                                    elsewhere (handoff C4).
--   unknown                        — either the window is still IMMATURE (it
--                                    has not closed, so there is nothing to
--                                    report yet and outcome_at is null), or no
--                                    scoped prospect row exists and no outcome
--                                    source can see this person at all.
--                                    19 of Ivan's 28 mature people are the
--                                    second kind.
-- ---------------------------------------------------------------------------
create or replace view public.audn_person_cohorts_v
with (security_invoker = true) as
with base as (
  select
    pa.client_id,
    pa.person_key,
    pa.first_observed_at as origin_at
  from public.audn_person_activity_v pa
),
windows (window_days) as (
  values (30), (60), (90)
),
grid as (
  select b.client_id, b.person_key, b.origin_at, w.window_days
  from base b
  cross join windows w
),
hit as (
  select distinct on (g.client_id, g.person_key, g.window_days)
    g.client_id, g.person_key, g.window_days,
    o.event_type,
    o.booked_at
  from grid g
  join public.audn_outcomes_v o
    on o.client_id  = g.client_id
   and o.person_key = g.person_key
   and o.booked_at is not null
   and o.booked_at >= g.origin_at
   and o.booked_at <  g.origin_at + make_interval(days => g.window_days)
  order by g.client_id, g.person_key, g.window_days, o.booked_at, o.outcome_id
),
rel as (
  select client_id, person_key, prospect_id
  from public.audn_relationship_v
)
select
  g.client_id,
  g.person_key,
  g.origin_at,
  'first_observed'::text                                                        as origin_label,
  g.window_days,
  (public.audn_cutoff() - g.origin_at >= make_interval(days => g.window_days))  as eligible,
  (public.audn_cutoff() - g.origin_at >= make_interval(days => g.window_days))  as mature,
  case
    -- AN IMMATURE WINDOW HAS NO OUTCOME TO REPORT (§3.9). The window has not
    -- closed, so 'none_observed_in_lane' would assert an observation that has
    -- not been made yet, and any event_type inside it would be a partial read
    -- of a window that can still change. Immature is always 'unknown', with a
    -- null outcome_at; maturity is the only thing the row asserts.
    when public.audn_cutoff() - g.origin_at
           < make_interval(days => g.window_days)                               then 'unknown'
    when h.event_type is not null    then h.event_type
    when r.prospect_id is not null   then 'none_observed_in_lane'
    else 'unknown'
  end::text                                                                     as outcome,
  case
    when public.audn_cutoff() - g.origin_at
           < make_interval(days => g.window_days)                               then null
    else h.booked_at
  end                                                                           as outcome_at
from grid g
left join hit h
  on h.client_id = g.client_id and h.person_key = g.person_key and h.window_days = g.window_days
left join rel r
  on r.client_id = g.client_id and r.person_key = g.person_key;

comment on view public.audn_person_cohorts_v is
  'Per person per 30/60/90 window. Maturity is recomputed from source events at audn_cutoff(); an immature window renders as immature, never as zero outcomes (QUALITY-CONTRACT §2, handoff C4).';

-- ---------------------------------------------------------------------------
-- audn_topic_people_v — people (not interactions) per topic.
--
-- One person counts once per topic no matter how many times they reacted;
-- `events` is kept beside `people` so the two numbers are never confused for
-- one another (QUALITY-CONTRACT §2, fixture five-topic-posts-one-person).
-- ---------------------------------------------------------------------------
create or replace view public.audn_topic_people_v
with (security_invoker = true) as
select
  id.client_id,
  id.topic,
  count(distinct e.person_key)::int     as people,
  count(*)::int                         as events,
  count(distinct e.post_social_id)::int as posts
from public.audn_interaction_events_v e
join public.audn_post_identity_v id
  on id.client_id = e.client_id
 and id.post_social_id = e.post_social_id
group by 1, 2;

comment on view public.audn_topic_people_v is
  'Distinct people, events and posts per topic. People and events are separate columns and are never interchanged.';

-- ---------------------------------------------------------------------------
-- audn_window_counts_v — the two time-window counts, under their real names.
--
-- ivan_post_outcome_spine.bookings_30d counts EVERY Ivan booking within 30 days
-- of the post; a post with a single engager carries bookings_30d = 7. RISE's
-- buyer_dms_48h is the same shape. They were being read as per-post attribution
-- and they are not (worklist W07).
--
-- The remedy is naming, not deletion: no audn_ view carries `bookings_30d` or
-- `buyer_dms_48h` as a column, and this one carries them verbatim as
-- `bookings_in_30d_window` / `buyer_dms_in_48h_window` so the existing
-- consumers keep their continuity while the column name states what the number
-- is. THIS VIEW IS NOT ATTRIBUTION. Attribution lives in
-- audn_outcomes_v + audn_outcome_assists_v.
-- ---------------------------------------------------------------------------
create or replace view public.audn_window_counts_v
with (security_invoker = true) as
select
  'ivan'::text                       as client_id,
  s.post_social_id,
  max(s.bookings_30d)::int           as bookings_in_30d_window,
  null::int                          as buyer_dms_in_48h_window,
  'ivan_post_outcome_spine'::text    as source
from public.ivan_post_outcome_spine s
where s.post_social_id is not null
group by s.post_social_id
union all
select
  'risedtc'::text                    as client_id,
  l.social_id                        as post_social_id,
  null::int                          as bookings_in_30d_window,
  max(l.buyer_dms_48h)::int          as buyer_dms_in_48h_window,
  'rise_buyers_post_ledger'::text    as source
from public.rise_buyers_post_ledger l
where l.social_id is not null
group by l.social_id;

comment on view public.audn_window_counts_v is
  'Time-window counts under names that say so. Not per-post attribution (CONTRACTS §3.6, worklist W07).';
