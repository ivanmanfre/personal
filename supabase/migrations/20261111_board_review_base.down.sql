-- Rollback of 20261111_board_review_base.sql. Stored review_base values stay in source_detail; they are inert
-- without the triggers and the board keeps reading the ones already there.
drop trigger if exists zzzz_board_review_base_mirror on public.carousel_drafts;
drop trigger if exists zzzz_board_review_base on public.carousel_drafts;
drop function if exists public.tg_board_review_base_mirror();
drop function if exists public.tg_board_review_base();
