-- Offline rollback for migration 16. Restore migrations 06, 09, 12 and 15
-- definitions after dropping the new objects; production rollback uses the
-- release restore map and is never executed automatically.
drop function if exists public.audn_board_payload(text);
alter function public.audn_board_payload_v15(text) rename to audn_board_payload;
drop function if exists public.operator_audn_measurement(text,text);
drop function if exists public.audn_measurement_payload(text);
drop view if exists public.audn_classification_coverage_v;
-- Retain additive taxonomy/classification tables and every classification row.
drop view if exists public.audn_measurement_coverage_v;
drop view if exists public.audn_monthly_median_v;
drop view if exists public.audn_matched_age_rank_v;
drop view if exists public.audn_monthly_metric_trend_v;
drop view if exists public.audn_metric_standing_v;
drop view if exists public.audn_selected_snapshot_v;
drop view if exists public.audn_snapshot_eligibility_v;
drop view if exists public.audn_identity_resolution_v;
drop view if exists public.audn_canonical_post_identity_v;
-- Migration09 extended the legacy identity view. Drop its definition so the
-- pre-16 migration03/09 restore can recreate the exact column contract.
drop view if exists public.audn_post_identity_v cascade;
-- Compatibility views/functions are restored by replaying their last pre-16
-- migrations: 06, 09, 12 and 15 in that order.
