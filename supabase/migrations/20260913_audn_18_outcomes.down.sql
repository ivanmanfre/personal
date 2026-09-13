-- Offline rollback: remove 18-only surfaces, then replay migration05 to restore
-- audn_outcomes_v, audn_outcome_assists_v and audn_person_cohorts_v exactly.
drop view if exists public.audn_commenting_pilot_queue_v;
drop view if exists public.audn_return_activation_eligibility_v;
drop view if exists public.audn_relationship_asof_touch_v;
drop view if exists public.audn_person_cohorts_v;
drop view if exists public.audn_outcome_assists_v;
-- Pre-18 outcome consumers depend on this view. CASCADE removes definitions
-- only; migration05 is replayed immediately by the release restore sequence.
drop view if exists public.audn_outcomes_v cascade;
drop view if exists public.audn_outcome_source_availability_v;
drop view if exists public.audn_outcome_identity_v;
