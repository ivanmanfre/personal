-- Derived views/functions may depend on these source views. CASCADE removes
-- callable/view definitions only; the release restore map recreates them.
drop view if exists public.audn_person_label_v cascade;
drop view if exists public.audn_classification_v cascade;
drop view if exists public.audn_interaction_events_v cascade;
drop view if exists public.audn_post_owner_resolution_v;
-- Restore the four legacy views by replaying migrations 03 and 04.
