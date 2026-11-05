-- Rollback for 20261105_board_post_viewers.sql. Read-only functions; nothing else depends on them in the DB.
-- The board reads client_board_post_viewers* softly: when they are gone the viewer block simply does not show.
drop function if exists public.client_board_post_viewers_v2(text, text);
drop function if exists public.client_board_post_viewers(text, text);
drop function if exists public._board_post_viewers(text, jsonb);
drop function if exists public._board_viewer_reason(text);
drop function if exists public._board_try_jsonb(text);
