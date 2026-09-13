-- Run07 rollback: remove owned callable behavior; preserve committed cycle ledger/new events.
drop function if exists public.audn_recommendation_commit(text,text,jsonb,integer,boolean);
drop function if exists public.audn_writer_context(text);
drop function if exists public.audn_canonical_post_key(text,text);
drop function if exists public.audn_asset_state(jsonb);
-- audn_writer_cycles is deliberately retained; no audit/event row is destroyed.
