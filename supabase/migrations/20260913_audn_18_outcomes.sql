-- Audience-learning 18: deterministic outcome identity, honest maturity and
-- replay-only activation queues. No row here sends, enrolls or activates work.

create or replace view public.audn_outcome_identity_v
with (security_invoker = true) as
with scoped as (
  select coalesce(c.client_id,'ivan') as client_id, p.id as prospect_id,
    nullif(btrim(p.linkedin_profile_id),'') as person_key,
    p.campaign_id, p.stage, p.updated_at
  from public.outreach_prospects p join public.outreach_campaigns c on c.id=p.campaign_id
), candidates as (
  select b.client_id, b.meeting_id as outcome_id, b.prospect_id,
    count(s.prospect_id)::int as candidate_count,
    min(s.person_key) as candidate_person_key,
    min(s.campaign_id::text)::uuid as candidate_campaign_id,
    min(s.updated_at) as relationship_effective_at,
    min(s.stage) as current_stage
  from public.booking_attributions b
  left join scoped s on s.client_id=b.client_id and s.prospect_id=b.prospect_id
  group by b.client_id,b.meeting_id,b.prospect_id
), domains as (
  select b.client_id,b.meeting_id,
    nullif(lower(regexp_replace(split_part(split_part(regexp_replace(btrim(b.booker_website),'^[a-zA-Z][a-zA-Z0-9+.-]*://',''), '/',1),'?',1),'^www\.','','i')),'') as website_domain,
    nullif(lower(split_part(btrim(b.booker_email),'@',2)),'') as email_domain
  from public.booking_attributions b
)
select c.client_id,c.outcome_id,c.prospect_id,
  case when c.candidate_count=1 then c.candidate_person_key end as person_key,
  case when c.candidate_count=1 then c.candidate_campaign_id end as campaign_id,
  case when c.candidate_count=1 and c.candidate_person_key is not null then 'deterministic_prospect_id'
       when c.candidate_count>1 then 'ambiguous'
       else 'unmatched' end as person_match_status,
  c.candidate_count,
  case when c.candidate_count>1 then 'multiple_scoped_prospect_candidates'
       when c.candidate_count=0 then 'no_scoped_prospect_candidate'
       when c.candidate_person_key is null then 'candidate_missing_person_key' end as person_unresolved_reason,
  case when d.website_domain is not null and d.email_domain is not null and d.website_domain<>d.email_domain then null
       else coalesce(d.website_domain,d.email_domain) end as company_key,
  case when d.website_domain is not null and d.email_domain is not null and d.website_domain<>d.email_domain then 'ambiguous'
       when coalesce(d.website_domain,d.email_domain) is null then 'unmatched'
       else 'deterministic_domain' end as company_match_status,
  case when d.website_domain is not null and d.email_domain is not null and d.website_domain<>d.email_domain
       then 'website_email_domain_conflict'
       when coalesce(d.website_domain,d.email_domain) is null then 'no_company_domain' end as company_unresolved_reason,
  c.relationship_effective_at,c.current_stage
from candidates c join domains d on d.client_id=c.client_id and d.meeting_id=c.outcome_id;

create or replace view public.audn_outcome_source_availability_v
with (security_invoker = true) as
select cr.client_id,'booking_attributions'::text as source,
  case when count(b.meeting_id)>0 then 'available_observed_rows'
       when coalesce(cr.platform->'measurement'->'outcomes'->>'booking_source','')<>'' then 'available_zero_rows'
       else 'unconfigured' end as availability,
  count(b.meeting_id)::int as source_rows,max(b.booked_at) as observed_through,
  case when count(b.meeting_id)=0 and coalesce(cr.platform->'measurement'->'outcomes'->>'booking_source','')=''
       then 'zero cannot be inferred without a configured source' end as limitation
from public.client_registry cr left join public.booking_attributions b on b.client_id=cr.client_id
group by cr.client_id,cr.platform;

create or replace view public.audn_outcomes_v
with (security_invoker = true) as
select b.client_id,b.meeting_id as outcome_id,i.person_key,b.prospect_id::uuid,
  i.company_key,b.booked_at,b.meeting_start,
  case when upper(coalesce(b.meeting_outcome,'')) in ('HELD','COMPLETED') then 'attended'
       when upper(coalesce(b.meeting_outcome,'')) in ('CANCELLED','CANCELED')
         or b.meeting_title ilike 'Canceled:%' or b.meeting_title ilike 'Cancelled:%' then 'cancelled'
       when upper(coalesce(b.meeting_outcome,'')) in ('SCHEDULED','RESCHEDULED','') then 'booked'
       else 'unknown' end as event_type,
  case when lower(coalesce(b.meeting_title,'')) ~ 'screening interview|interview|recruit|candidate' then 'recruiting'
       when lower(coalesce(b.meeting_title,'')) ~ 'sales|discovery|demo|consultation' then 'sales'
       else 'unknown' end as meeting_kind,
  case when lower(coalesce(b.meeting_title,'')) ~ 'screening interview|interview|recruit|candidate' then false
       when upper(coalesce(b.meeting_outcome,'')) in ('CANCELLED','CANCELED') then false
       else null end as qualified,
  'booking_attributions'::text as source,i.person_match_status as match_confidence,
  case when lower(coalesce(b.meeting_title,'')) ~ 'screening interview|interview|recruit|candidate' then 'excluded_recruiting_title'
       when upper(coalesce(b.meeting_outcome,'')) in ('CANCELLED','CANCELED') then 'excluded_cancelled'
       else 'qualification_source_unavailable' end as qualification_basis,
  i.person_unresolved_reason,i.company_match_status,i.company_unresolved_reason
from public.booking_attributions b join public.audn_outcome_identity_v i
  on i.client_id=b.client_id and i.outcome_id=b.meeting_id;

comment on view public.audn_outcomes_v is
  'One row per stable meeting_id. Person/company matches are deterministic or explicitly unresolved. A title alone never proves a qualified commercial conversation.';

create or replace view public.audn_outcome_assists_v
with (security_invoker = true) as
with per_post as (
 select e.client_id,e.person_key,e.post_social_id,min(e.first_observed_at) first_observed_at
 from public.audn_interaction_events_v e group by 1,2,3
)
select o.client_id,o.outcome_id,o.person_key,p.post_social_id,p.first_observed_at,
 row_number() over(partition by o.client_id,o.outcome_id order by p.first_observed_at,p.post_social_id)::int assist_rank,
 'audn-assist-v2-prebooking-observation'::text rule_version,
 count(*) over(partition by o.client_id,o.outcome_id)::int assist_count
from public.audn_outcomes_v o join per_post p on p.client_id=o.client_id and p.person_key=o.person_key
where o.person_key is not null and o.booked_at is not null and p.first_observed_at<o.booked_at;

create or replace view public.audn_relationship_asof_touch_v
with (security_invoker = true) as
select a.client_id,a.person_key,a.first_observed_at as touch_at,
  case when r.prospect_id is null then 'unknown'
       when r.effective_date is null or r.effective_date>a.first_observed_at then 'unknown_asof'
       else r.state end as state_asof_touch,
  case when r.prospect_id is null then 'no_scoped_relationship_record'
       when r.effective_date is null then 'relationship_effective_time_missing'
       when r.effective_date>a.first_observed_at then 'current_record_postdates_touch_no_history'
       else 'current_record_effective_by_touch' end as asof_basis,
  r.source,r.effective_date,r.prospect_id,r.campaign_id,r.is_operator,r.is_excluded
from public.audn_person_activity_v a left join public.audn_relationship_v r
 on r.client_id=a.client_id and r.person_key=a.person_key;

create or replace view public.audn_person_cohorts_v
with (security_invoker = true) as
with windows(window_days) as (values(30),(60),(90)), grid as (
 select a.client_id,a.person_key,a.first_observed_at origin_at,w.window_days
 from public.audn_person_activity_v a cross join windows w where not a.is_excluded
), hit as (
 select distinct on(g.client_id,g.person_key,g.window_days) g.client_id,g.person_key,g.window_days,o.event_type,o.booked_at,o.outcome_id
 from grid g join public.audn_outcomes_v o on o.client_id=g.client_id and o.person_key=g.person_key
  and o.booked_at>=g.origin_at and o.booked_at<g.origin_at+make_interval(days=>g.window_days)
 order by g.client_id,g.person_key,g.window_days,o.booked_at,o.outcome_id
), availability as (
 select client_id,availability from public.audn_outcome_source_availability_v
)
select g.client_id,g.person_key,g.origin_at,'first_observed'::text origin_label,g.window_days,
 public.audn_cutoff()-g.origin_at>=make_interval(days=>g.window_days) eligible,
 public.audn_cutoff()-g.origin_at>=make_interval(days=>g.window_days) mature,
 case when public.audn_cutoff()-g.origin_at<make_interval(days=>g.window_days) then 'unknown_immature'
      when a.availability not in ('available_observed_rows','available_zero_rows') then 'unknown_source_unavailable'
      when h.event_type is not null then h.event_type else 'none_observed_in_available_source' end outcome,
 case when public.audn_cutoff()-g.origin_at>=make_interval(days=>g.window_days) then h.booked_at end outcome_at,
 coalesce(a.availability,'unconfigured') outcome_source_availability,
 case when h.outcome_id is null then 0 else 1 end::int unique_outcomes
from grid g left join hit h using(client_id,person_key,window_days)
left join availability a using(client_id);

create or replace view public.audn_return_activation_eligibility_v
with (security_invoker = true) as
select a.client_id,a.person_key,a.first_observed_at,a.last_observed_at,a.distinct_posts,a.total_events,
 a.confirmed_return,a.return_timing,r.state_asof_touch,r.asof_basis,
 case when a.client_id<>'risedtc' then 'ineligible_wrong_lane'
      when a.is_excluded then 'ineligible_relationship_exclusion'
      when not a.confirmed_return then 'ineligible_no_trustworthy_return'
      when r.state_asof_touch<>'unknown' and r.state_asof_touch<>'unknown_asof' then 'ineligible_existing_relationship'
      else 'eligible_return_signal' end eligibility,
 'replay_only'::text queue_state,null::text assignment_arm,
 false as send_capable,'operator_client_outreach'::text handoff_adapter,
 'immediate_buying_intent_source_unavailable'::text immediate_intent_state
from public.audn_person_activity_v a join public.audn_relationship_asof_touch_v r using(client_id,person_key);

create or replace view public.audn_commenting_pilot_queue_v
with (security_invoker = true) as
select e.client_id,e.person_key,min(e.first_observed_at) observed_at,
 count(distinct e.post_social_id)::int observed_posts,
 max(l.label) as audience_label,
 case when bool_or(coalesce(l.conflict,false)) then 'ineligible_label_conflict'
      when max(l.label) is null then 'ineligible_fit_unknown'
      else 'eligible_for_draft_review' end eligibility,
 'replay_only'::text queue_state,false as send_capable,
 'operator_approve_rise_draft'::text approval_adapter,
 'outbound_comment_draft'::text proposed_kind
from public.audn_interaction_events_v e left join public.audn_person_label_v l
 using(client_id,person_key)
where e.client_id='risedtc' and not coalesce(l.is_excluded,false)
group by e.client_id,e.person_key;

revoke all on public.audn_outcome_identity_v,public.audn_outcome_source_availability_v,
 public.audn_relationship_asof_touch_v,public.audn_return_activation_eligibility_v,
 public.audn_commenting_pilot_queue_v from anon;
