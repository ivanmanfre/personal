-- Client board: keep the text a client last reviewed when a post is edited afterwards (2026-11-11).
--
-- The board marks what changed in a post after the client's review (board-app src/data/review.ts). It reads
-- carousel_drafts.source_detail.review_base = { body, at, via }. Until now that was written by hand.
-- This makes it automatic for every client board:
--   1. BEFORE UPDATE OF post_body, source_detail: when a client draft's text changes and the client has
--      already acted on it (approve, request changes, comment, or their own edit), the old text is stored
--      as review_base. Later edits in the same round keep that base. Once the client acts again, the next
--      edit starts a new base. The client's own edit on the board (app.body_edit_via = 'board') never
--      starts one. A write to source_detail that leaves the base out keeps it; to remove one on purpose,
--      set app.review_base_clear = 'on' for that statement.
--   2. AFTER UPDATE: the stored base is copied into the board's cached queue, which the board reads.
-- Neither function can fail an edit: any error is downgraded to a warning.

create or replace function public.tg_board_review_base()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_via text := coalesce(nullif(current_setting('app.body_edit_via', true), ''), 'direct');
  v_sd jsonb;
  v_base jsonb;
  v_base_at timestamptz;
  v_seen timestamptz;
begin
  if new.client_id is null then
    return new;
  end if;
  -- A hand repair may take a base away on purpose: set app.review_base_clear = 'on' for that statement.
  if coalesce(current_setting('app.review_base_clear', true), '') = 'on' then
    return new;
  end if;
  -- source_detail must be an object (or empty) for a key to be kept in it.
  if new.source_detail is not null and jsonb_typeof(new.source_detail) <> 'object' then
    return new;
  end if;
  v_sd := coalesce(new.source_detail, '{}'::jsonb);

  -- 1. Keep. A base is an object. A write that leaves it out, or sets it to null, does not remove it,
  --    whether or not the text changes in the same write.
  if jsonb_typeof(v_sd -> 'review_base') = 'object' then
    v_base := v_sd -> 'review_base';
  elsif jsonb_typeof(old.source_detail) = 'object' and jsonb_typeof(old.source_detail -> 'review_base') = 'object' then
    v_base := old.source_detail -> 'review_base';
    new.source_detail := (v_sd - 'review_base') || jsonb_build_object('review_base', v_base);
    v_sd := new.source_detail;
  end if;

  -- 2. Start. Only when the text really changed (an earlier trigger may have put the old text back).
  if new.post_body is not distinct from old.post_body
     or v_via = 'board' or new.published_at is not null or coalesce(btrim(old.post_body), '') = '' then
    return new;
  end if;

  -- The client's latest look at this post. Ivan, operators and machines are not the client.
  select max(a.created_at) into v_seen
    from public.client_board_actions a
   where a.ref = new.id::text
     and a.client_id = new.client_id
     and a.action in ('approve', 'request_changes', 'comment', 'edit_copy')
     and coalesce(a.payload ->> 'by', '') !~* '(ivan|operator|codex|claude|system|content team|inboundonsteroids|changed outside the board)'
     and coalesce(a.payload ->> 'via', '') !~* '(claude|codex|inbox|direct)';
  if v_seen is null then
    return new;
  end if;

  if v_base is not null then
    begin
      v_base_at := (v_base ->> 'at')::timestamptz;
    exception when others then
      v_base_at := null;
    end;
    -- Same review round (or a base with no readable time): keep it.
    if v_base_at is null or v_base_at >= v_seen then
      return new;
    end if;
  end if;

  new.source_detail := (v_sd - 'review_base') || jsonb_build_object('review_base', jsonb_build_object(
    'body', old.post_body,
    'at', to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'via', v_via));
  return new;
exception when others then
  raise warning 'tg_board_review_base skipped for %: % (%)', new.id, sqlerrm, sqlstate;
  return new;
end;
$function$;

revoke all on function public.tg_board_review_base() from public, anon, authenticated;

create or replace trigger zzzz_board_review_base
  before update of post_body, source_detail on public.carousel_drafts
  for each row
  when (new.client_id is not null)
  execute function public.tg_board_review_base();

create or replace function public.tg_board_review_base_mirror()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_new jsonb := case when jsonb_typeof(new.source_detail) = 'object' then new.source_detail -> 'review_base' end;
  v_old jsonb := case when jsonb_typeof(old.source_detail) = 'object' then old.source_detail -> 'review_base' end;
begin
  if new.client_id is null or v_new is not distinct from v_old then
    return null;
  end if;
  update public.client_boards b
     set board = jsonb_set(b.board, '{queue}', (
       select jsonb_agg(
                case when q ->> 'id' = new.id::text
                     then jsonb_set(q, '{source_detail}',
                            (coalesce(case when jsonb_typeof(q -> 'source_detail') = 'object' then q -> 'source_detail' end, '{}'::jsonb) - 'review_base')
                            || case when v_new is null or v_new = 'null'::jsonb then '{}'::jsonb else jsonb_build_object('review_base', v_new) end)
                     else q end
                order by ord)
         from jsonb_array_elements(b.board -> 'queue') with ordinality as t(q, ord)))
   where b.client_id = new.client_id
     and jsonb_typeof(b.board -> 'queue') = 'array'
     and b.board -> 'queue' @> jsonb_build_array(jsonb_build_object('id', new.id::text));
  return null;
exception when others then
  raise warning 'tg_board_review_base_mirror skipped for %: % (%)', new.id, sqlerrm, sqlstate;
  return null;
end;
$function$;

revoke all on function public.tg_board_review_base_mirror() from public, anon, authenticated;

create or replace trigger zzzz_board_review_base_mirror
  after update of post_body, source_detail on public.carousel_drafts
  for each row
  when (new.client_id is not null)
  execute function public.tg_board_review_base_mirror();
