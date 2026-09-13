-- Canonical event ownership and as-of classifier state.
create or replace view public.audn_post_owner_resolution_v with(security_invoker=true) as
with raw_ids as (select distinct post_social_id from public.post_engagers where post_social_id is not null),
candidates as (
 select r.post_social_id,i.client_id,i.canonical_post_id
 from raw_ids r join public.audn_canonical_post_identity_v i on i.identity_status='resolved' and
  (i.canonical_post_id=r.post_social_id or (public.audn_urn_kind(r.post_social_id) is null and i.activity_digits=public.audn_urn_digits(r.post_social_id)))
), g as (
 select post_social_id,count(*)::int candidate_count,min(client_id) client_id,min(canonical_post_id) canonical_post_id,
  jsonb_agg(jsonb_build_object('client_id',client_id,'canonical_post_id',canonical_post_id) order by client_id,canonical_post_id) candidates
 from candidates group by post_social_id
)
select r.post_social_id,case when g.candidate_count=1 then g.client_id end client_id,
 case when g.candidate_count=1 then g.canonical_post_id end canonical_post_id,coalesce(g.candidate_count,0) candidate_count,
 case when g.candidate_count=1 then 'resolved' when g.candidate_count>1 then 'ambiguous' else 'unresolved' end resolution_status,
 coalesce(g.candidates,'[]'::jsonb) candidates
from raw_ids r left join g using(post_social_id);

create or replace view public.audn_interaction_events_v with(security_invoker=true) as
with raw_events as (
 select o.client_id,o.canonical_post_id post_social_id,
  coalesce(public.audn_person_key(pe.provider_id,pe.member_id,pe.linkedin_url,pe.name),'unresolved:post_engagers:'||pe.id::text) person_key,
  pe.engagement_type kind,pe.first_seen_at first_observed_at,greatest(pe.first_seen_at,coalesce(pe.last_seen_at,pe.first_seen_at)) last_observed_at,
  'post_engagers:'||pe.id::text source_ref
 from public.post_engagers pe join public.audn_post_owner_resolution_v o on o.post_social_id=pe.post_social_id and o.resolution_status='resolved'
 union all
 select m.client_id,public.audn_canonical_post_key(m.client_id,m.social_id),
  coalesce(nullif(btrim(cpe.profile_id),''),'unresolved:client_post_engagers:'||cpe.id::text),cpe.kind,cpe.seen_at,cpe.seen_at,
  'client_post_engagers:'||cpe.id::text
 from public.client_post_engagers cpe join public.client_post_metrics m on m.id=cpe.post_id
 where public.audn_canonical_post_key(m.client_id,m.social_id) is not null
), merged as (
 select client_id,post_social_id,person_key,kind,min(first_observed_at) first_observed_at,max(last_observed_at) last_observed_at,
  array_agg(source_ref order by source_ref) sources from raw_events group by 1,2,3,4
), comment_times as (
 select distinct on(post_urn,author_provider_id) post_urn,author_provider_id,posted_at,comment_id from public.client_post_comments
 where comment_id is not null and posted_at is not null and author_provider_id is not null order by post_urn,author_provider_id,posted_at
)
select m.client_id,m.post_social_id,m.person_key,m.kind,m.first_observed_at,m.last_observed_at,ct.posted_at event_time,
 case when ct.posted_at is null then 'collection_only' else 'event_time' end::text timing_confidence,ct.comment_id platform_event_id,
 m.sources,coalesce(array_length(m.sources,1),0) source_count
from merged m left join comment_times ct on m.kind='comment'
 and public.audn_canonical_post_key(m.client_id,ct.post_urn)=m.post_social_id and ct.author_provider_id=m.person_key;

create or replace view public.audn_classification_v with(security_invoker=true) as
select o.client_id,coalesce(public.audn_person_key(pe.provider_id,pe.member_id,pe.linkedin_url,pe.name),'unresolved:post_engagers:'||pe.id::text) person_key,
 o.canonical_post_id post_social_id,case when pe.icp_score is null then 'unknown' when pe.icp_score>=7 then 'positive' when pe.icp_score>=4 then 'borderline' else 'negative' end::text label,
 pe.icp_score::text raw_label,
 case when pe.scorer_version like '%@v%' then split_part(pe.scorer_version,'@',1)
      else coalesce(nullif(r.platform->'measurement'->>'icp_prompt_slug',''),'unknown') end classifier_slug,
 coalesce(pe.scorer_version,'unknown') classifier_version,
 pe.scored_at judged_at,'post_engagers'::text source_table,pe.id::text source_row_id
from public.post_engagers pe join public.audn_post_owner_resolution_v o on o.post_social_id=pe.post_social_id and o.resolution_status='resolved'
left join public.client_registry r on r.client_id=o.client_id
union all
select m.client_id,coalesce(nullif(btrim(cpe.profile_id),''),'unresolved:client_post_engagers:'||cpe.id::text),
 public.audn_canonical_post_key(m.client_id,m.social_id),case lower(coalesce(cpe.side,'')) when 'owner' then 'positive' when 'provider' then 'negative' when 'vendor' then 'negative' when 'other' then 'borderline' else 'unknown' end,
 cpe.side,'rise-board-side-rubric','unversioned-code-node',cpe.judged_at,'client_post_engagers',cpe.id::text
from public.client_post_engagers cpe join public.client_post_metrics m on m.id=cpe.post_id
where public.audn_canonical_post_key(m.client_id,m.social_id) is not null;

create or replace view public.audn_person_label_v with(security_invoker=true) as
with eligible as (select * from public.audn_classification_v where judged_at is null or judged_at<=public.audn_cutoff()),
latest_at as (select client_id,person_key,max(judged_at) latest from eligible group by 1,2),
latest as (select e.* from eligible e join latest_at l using(client_id,person_key) where e.judged_at is not distinct from l.latest),
chosen as (select distinct on(client_id,person_key) * from latest order by client_id,person_key,source_row_id desc),
stats as (select client_id,person_key,count(*)::int n_rows,count(distinct label)::int n_labels from eligible group by 1,2),
excl as (select client_id,person_key,bool_or(exclusion_kind='operator') is_operator from public.audn_excluded_person_v group by 1,2)
select c.client_id,c.person_key,c.label,c.classifier_slug,c.classifier_version,c.judged_at,s.n_labels>1 conflict,s.n_rows,
 coalesce(x.is_operator,false) is_operator,x.person_key is not null is_excluded
from chosen c join stats s using(client_id,person_key) left join excl x using(client_id,person_key);

revoke all on public.audn_post_owner_resolution_v from public,anon,authenticated;
grant select on public.audn_post_owner_resolution_v to service_role;
