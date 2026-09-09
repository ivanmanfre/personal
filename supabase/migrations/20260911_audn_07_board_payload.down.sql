-- Down for 20260911_audn_07_board_payload.sql. Removes exactly what 07 created,
-- in reverse dependency order, and nothing else. No source table, no Run 02
-- object and no pre-existing board RPC is touched. Once this file runs, the
-- board's audience loader gets an RPC-missing error, which it already treats as
-- "section not available" (progressive enhancement), so the board renders
-- exactly as it did before 07.
drop function if exists public.client_board_audience_decide_v2(text,text,text,text,text);
drop function if exists public.client_board_audience_decide(text,text,text,text,text);
drop function if exists public._audn_decide(text,text,text,text,text);
drop function if exists public.client_board_audience_v2(text,text);
drop function if exists public.client_board_audience(text,text);
drop view     if exists public.audn_board_payload_fixture_v;
drop function if exists public.audn_board_payload(text);
