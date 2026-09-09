-- ============================================================================
-- Audience-learning measurement foundation — 04 / classification + relationship.
-- goal-run audience-learning-02-foundation-2026-09-09, foundation seat.
-- Worklist: W04 / W11 (classification with slug + version + unknown as a value),
--           W03 (RISE two-store reconciliation), W12 (relationship as-of limit,
--           operator exclusion flag), W25 (conflict never averaged, exclusion
--           list), W30/W31 (label provenance).
--
-- Depends on: 01_functions, 03_views_identity_events.
-- Source tables: post_engagers, client_post_engagers, client_post_metrics,
--   outreach_prospects, outreach_campaigns.
--
-- NOTHING HERE ACTS. QUALITY-CONTRACT §1 leaves every client REVIEW-ONLY; no
-- classifier in this record is eligible for automatic scoring, and these views
-- exist to make that visible, not to route on it.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- audn_classification_v — one row per SOURCE classification row, per post.
--
-- Label mapping is fixed by R1/calibration/calibration-bar.md, registered at
-- 14:36Z before any label existed:
--   icp_score >= 7 positive | 4-6 borderline | <= 3 negative | NULL unknown
--   side: owner positive | provider, vendor negative | other borderline
-- NULL is unknown. It is never rounded to negative and never dropped — Ivan has
-- 17 unscored rows of 112 and that share is the classifier's coverage gap, not
-- 17 negatives.
--
-- Slug and version travel with every row so two classifier generations are
-- never pooled (handoff correction C5). client_post_engagers.side is produced
-- by an n8n code node with no prompt row behind it, so its version is the
-- literal 'unversioned-code-node' rather than a fabricated number.
-- ---------------------------------------------------------------------------
create or replace view public.audn_classification_v
with (security_invoker = true) as
select
  id.client_id,
  coalesce(
    public.audn_person_key(pe.provider_id, pe.member_id, pe.linkedin_url, pe.name),
    'unresolved:post_engagers:' || pe.id::text
  )                                                           as person_key,
  pe.post_social_id,
  case
    when pe.icp_score is null then 'unknown'
    when pe.icp_score >= 7    then 'positive'
    when pe.icp_score >= 4    then 'borderline'
    else                           'negative'
  end::text                                                   as label,
  pe.icp_score::text                                          as raw_label,
  -- Run 04: the stamp is the truth. Loggers write scorer_version as
  -- '<slug>@v<N>' (the audience-learning loggers read their own pinned rows,
  -- e.g. audn-icp-engager-scoring@v18), so the slug is read from the stamp
  -- when it has that shape. Rows stamped in the older shapes
  -- ('arch-engager-v16', 'rise-engager-v2', null) fall back to the client
  -- mapping, exactly as before.
  case
    when pe.scorer_version like '%@v%'
      then split_part(pe.scorer_version, '@', 1)
    else case id.client_id
      when 'ivan'    then 'icp-outreach-scoring'
      when 'arch'    then 'arch-icp-engager-scoring'
      when 'risedtc' then 'rise-icp-engager-scoring'
      else 'icp-outreach-scoring'
    end
  end::text                                                   as classifier_slug,
  pe.scorer_version                                           as classifier_version,
  pe.scored_at                                                as judged_at,
  'post_engagers'::text                                       as source_table,
  pe.id::text                                                 as source_row_id
from public.post_engagers pe
join public.audn_post_identity_v id
  on id.post_social_id = pe.post_social_id
union all
select
  id.client_id,
  coalesce(
    nullif(btrim(cpe.profile_id), ''),
    'unresolved:client_post_engagers:' || cpe.id::text
  )                                                           as person_key,
  m.social_id                                                 as post_social_id,
  case lower(coalesce(cpe.side, ''))
    when 'owner'    then 'positive'
    when 'provider' then 'negative'
    when 'vendor'   then 'negative'
    when 'other'    then 'borderline'
    else 'unknown'
  end::text                                                   as label,
  cpe.side                                                    as raw_label,
  'rise-board-side-rubric'::text                              as classifier_slug,
  'unversioned-code-node'::text                               as classifier_version,
  cpe.judged_at,
  'client_post_engagers'::text                                as source_table,
  cpe.id::text                                                as source_row_id
from public.client_post_engagers cpe
join public.client_post_metrics m
  on m.id = cpe.post_id
join public.audn_post_identity_v id
  on id.client_id = m.client_id
 and id.post_social_id = m.social_id;

comment on view public.audn_classification_v is
  'One row per source classification row. unknown is an emitted value, never a rounded negative; slug + version travel with every row so generations are never pooled (CONTRACTS §3.4).';

-- ---------------------------------------------------------------------------
-- audn_person_label_v — the person's current label.
--
-- Latest judged_at wins. Conflicts are FLAGGED, never averaged: a person that
-- one store calls owner and another calls provider is a disagreement to
-- adjudicate, and an average of two rubrics is a number with no referent.
-- n_rows exposes how much evidence sits behind the label.
-- ---------------------------------------------------------------------------
create or replace view public.audn_person_label_v
with (security_invoker = true) as
with c as (
  select * from public.audn_classification_v
),
latest as (
  select distinct on (client_id, person_key)
         client_id, person_key, label, classifier_slug, classifier_version, judged_at
  from c
  order by client_id, person_key, judged_at desc nulls last, source_row_id
),
stats as (
  select client_id, person_key,
         count(*)::int              as n_rows,
         count(distinct label)::int as n_labels
  from c
  group by 1, 2
),
excl as (
  -- W12 / W25. LEFT JOINED, NEVER FILTERED — see audn_excluded_person_v.
  select client_id, person_key,
         bool_or(exclusion_kind = 'operator') as is_operator
  from public.audn_excluded_person_v
  group by 1, 2
)
select
  l.client_id,
  l.person_key,
  l.label,
  l.classifier_slug,
  l.classifier_version,
  l.judged_at,
  (s.n_labels > 1) as conflict,
  s.n_rows,
  coalesce(x.is_operator, false) as is_operator,
  (x.person_key is not null)     as is_excluded
from latest l
join stats s
  on s.client_id = l.client_id and s.person_key = l.person_key
left join excl x
  on x.client_id = l.client_id and x.person_key = l.person_key;

comment on view public.audn_person_label_v is
  'Latest label per person per client; conflict is flagged and never averaged (CONTRACTS §3.4). is_operator / is_excluded are FLAGS from audn_excluded_person_v — the operator keeps his label row, and any Run 03 denominator excludes him itself (W12 / W25).';

-- ---------------------------------------------------------------------------
-- audn_rise_reconciliation_v — the two RISE stores, side by side.
--
-- RISE is the only lane written by two collectors. IMPLEMENTATION-PLAN task 3
-- wanted client_post_engagers as the interaction source; the cohort trace
-- rejected it because its seen_at is a September harvest date. The resolution
-- (C2) is: post_engagers carries the HISTORY, client_post_engagers carries the
-- board's CLASSIFICATION, and this view is where the two are compared instead
-- of one silently overwriting the other.
--
-- agree is NULL when either side has no label — that is missing evidence, not
-- disagreement and not agreement.
-- ---------------------------------------------------------------------------
create or replace view public.audn_rise_reconciliation_v
with (security_invoker = true) as
with ev as (
  select *
  from public.audn_interaction_events_v
  where client_id = 'risedtc'
),
pe_lab as (
  select distinct on (client_id, post_social_id, person_key)
         client_id, post_social_id, person_key, label
  from public.audn_classification_v
  where client_id = 'risedtc' and source_table = 'post_engagers'
  order by client_id, post_social_id, person_key, judged_at desc nulls last, source_row_id
),
cpe_lab as (
  select distinct on (client_id, post_social_id, person_key)
         client_id, post_social_id, person_key, label
  from public.audn_classification_v
  where client_id = 'risedtc' and source_table = 'client_post_engagers'
  order by client_id, post_social_id, person_key, judged_at desc nulls last, source_row_id
)
select
  ev.post_social_id,
  ev.person_key,
  ev.kind,
  exists (select 1 from unnest(ev.sources) s where s like 'post_engagers:%')        as in_post_engagers,
  exists (select 1 from unnest(ev.sources) s where s like 'client_post_engagers:%') as in_client_post_engagers,
  p.label                                                                          as pe_label,
  c.label                                                                          as cpe_label,
  case when p.label is not null and c.label is not null
       then (p.label = c.label)
       else null
  end                                                                              as agree
from ev
left join pe_lab p
  on p.client_id = ev.client_id and p.post_social_id = ev.post_social_id and p.person_key = ev.person_key
left join cpe_lab c
  on c.client_id = ev.client_id and c.post_social_id = ev.post_social_id and c.person_key = ev.person_key;

comment on view public.audn_rise_reconciliation_v is
  'RISE only: which store saw each canonical event and whether the two rubrics agree. agree is NULL when either side has no label.';

-- ---------------------------------------------------------------------------
-- audn_relationship_v — what we know about the person, and when we knew it.
--
-- HARD LIMIT (Run 01 D02, worklist W12): outreach_prospects.stage is CURRENT
-- STATE. There is no stage-history table, so "relationship as of the moment
-- they engaged" is NOT reconstructible. Rather than pretend, every row carries
-- source = 'outreach_prospects.current' and effective_date = updated_at, so a
-- consumer can see the state is read at cutoff and not at engagement time.
-- Existing-CUSTOMER state does not exist anywhere in the record and is unknown
-- for everyone (§3.5).
--
-- TENANCY (§3.1). outreach_prospects has no client_id. Scope resolves ONLY
-- through outreach_campaigns.client_id, and Ivan's rows are the ones where that
-- is NULL. This is not cosmetic: in the frozen census, 5 of the 7 prospect rows
-- Run 01 matched to RISE cohort-30 people belong to Ivan's campaigns. Under
-- this scope they are Ivan's rows and RISE keeps only 2. A person with no
-- prospect row inside their own client's scope is 'unknown' — never "no
-- relationship", and never another tenant's row.
-- ---------------------------------------------------------------------------
create or replace view public.audn_relationship_v
with (security_invoker = true) as
with people as (
  select distinct client_id, person_key
  from public.audn_interaction_events_v
),
scoped_prospects as (
  select
    case when oc.client_id is null then 'ivan' else oc.client_id end as client_id,
    p.linkedin_profile_id                                            as person_key,
    p.id                                                             as prospect_id,
    p.campaign_id,
    p.stage,
    p.updated_at
  from public.outreach_prospects p
  join public.outreach_campaigns oc
    on oc.id = p.campaign_id
  where nullif(btrim(p.linkedin_profile_id), '') is not null
),
picked as (
  select distinct on (client_id, person_key)
         client_id, person_key, prospect_id, campaign_id, stage, updated_at
  from scoped_prospects
  order by client_id, person_key, updated_at desc nulls last, prospect_id
),
excl as (
  -- W12 / W25. LEFT JOINED, NEVER FILTERED — see audn_excluded_person_v.
  select client_id, person_key,
         bool_or(exclusion_kind = 'operator') as is_operator
  from public.audn_excluded_person_v
  group by 1, 2
)
select
  pe.client_id,
  pe.person_key,
  case
    when pk.stage is not null then 'existing_prospect_stage:' || pk.stage
    else 'unknown'
  end::text                                          as state,
  case when pk.prospect_id is not null
       then 'outreach_prospects.current'
       else null
  end::text                                          as source,
  pk.updated_at                                      as effective_date,
  pk.prospect_id::uuid                               as prospect_id,
  pk.campaign_id::uuid                               as campaign_id,
  coalesce(x.is_operator, false)                     as is_operator,
  (x.person_key is not null)                         as is_excluded
from people pe
left join picked pk
  on pk.client_id = pe.client_id and pk.person_key = pe.person_key
left join excl x
  on x.client_id = pe.client_id and x.person_key = pe.person_key;

comment on view public.audn_relationship_v is
  'Current prospect stage per person, client-scoped through outreach_campaigns.client_id (Ivan = NULL). No stage history exists, so effective_date is updated_at and as-of reconstruction is unavailable (Run 01 D02). is_operator / is_excluded are FLAGS from audn_excluded_person_v; no row is removed (W12 / W25).';
