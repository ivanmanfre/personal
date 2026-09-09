-- Down for 20260911_audn_08_recommendation_links.sql. Drops exactly what 08
-- created and nothing else: no source table, no Run 02 object, no migration 07
-- object. Migration 07 already guards its own call on to_regclass, so a board
-- that outlives this down file falls back to link_state 'unknown' rather than
-- erroring.
drop view     if exists public.audn_recommendation_links_v;
drop function if exists public.audn_recommendation_links();
