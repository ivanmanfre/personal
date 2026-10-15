-- Board comments on posts and drafts (2026-10-15).
-- Stored in client_board_actions as action='comment' (ref = the post/draft id on the board,
-- payload {text, by, parent}), so they ride the same audit trail, history log and operator
-- notification path as every other board action. One level of threading: parent = the id of
-- the top-level comment being answered.

-- Read: any member (session) or the board-link holder.
create or replace function public.board_comments_list(p_slug text, p_session text default null, p_token text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_caller text := public._board_team_caller(p_slug, p_session, p_token);
  v_items  jsonb;
begin
  if v_caller is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', a.id, 'ref', a.ref, 'at', a.created_at,
           'by', a.payload->>'by', 'text', a.payload->>'text', 'parent', a.payload->>'parent'
         ) order by a.created_at), '[]'::jsonb)
    into v_items
    from (select * from public.client_board_actions
           where board_slug = p_slug and action = 'comment'
           order by created_at desc limit 500) a;
  return jsonb_build_object('ok', true, 'items', v_items,
                            'me', case when v_caller = 'board link' then null else v_caller end);
end;
$$;

-- Write: signed-in members only, so every comment has a person behind it.
create or replace function public.board_comment_add(p_slug text, p_ref text, p_text text, p_parent text default null, p_session text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash   text;
  v_email  text;
  v_board  public.client_boards%rowtype;
  v_text   text := btrim(coalesce(p_text, ''));
  v_parent uuid;
  v_id     uuid;
  v_at     timestamptz;
  v_title  text;
begin
  if coalesce(p_session, '') = '' then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  v_hash := encode(digest(p_session, 'sha256'), 'hex');
  select email into v_email from public.client_board_sessions
   where slug = p_slug and token_hash = v_hash and revoked_at is null and expires_at > now();
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  update public.client_board_sessions set last_seen_at = now() where token_hash = v_hash;

  select * into v_board from public.client_boards
   where slug = p_slug and (expires_at is null or expires_at > now());
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_text = '' or length(v_text) > 2000 then
    return jsonb_build_object('ok', false, 'error', 'bad_text');
  end if;
  if coalesce(p_ref, '') = '' or length(p_ref) > 120 then
    return jsonb_build_object('ok', false, 'error', 'bad_ref');
  end if;
  -- The ref must be a post on this board (queue item id or its draft id).
  if not exists (
    select 1 from jsonb_array_elements(coalesce(v_board.board->'queue', '[]'::jsonb)) q
     where q->>'id' = p_ref or q->>'draft_id' = p_ref
  ) then
    return jsonb_build_object('ok', false, 'error', 'bad_ref');
  end if;
  if coalesce(p_parent, '') <> '' then
    begin
      v_parent := p_parent::uuid;
    exception when others then
      return jsonb_build_object('ok', false, 'error', 'bad_parent');
    end;
    if not exists (select 1 from public.client_board_actions
                    where id = v_parent and board_slug = p_slug and ref = p_ref and action = 'comment') then
      return jsonb_build_object('ok', false, 'error', 'bad_parent');
    end if;
  end if;
  -- Flood guard: 30 comments per person per 10 minutes.
  if (select count(*) from public.client_board_actions
       where board_slug = p_slug and action = 'comment' and payload->>'by' = lower(v_email)
         and created_at > now() - interval '10 minutes') >= 30 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  insert into public.client_board_actions (board_slug, client_id, action, ref, payload)
  values (p_slug, v_board.client_id, 'comment', p_ref,
          jsonb_build_object('text', v_text, 'by', lower(v_email), 'parent', v_parent))
  returning id, created_at into v_id, v_at;

  -- Ivan's inbox app: one feed card per comment, with the words (the board-actions digest only
  -- carries the post title). Feed-only family, same as every other board tap. Never blocks the write.
  begin
    select coalesce(nullif(q->>'hook', ''), nullif(q->>'title', ''), 'a post') into v_title
      from jsonb_array_elements(coalesce(v_board.board->'queue', '[]'::jsonb)) q
     where q->>'id' = p_ref or q->>'draft_id' = p_ref limit 1;
    insert into public.inbox_notifications (family, source, severity, title, body, url, dedupe_key)
    values ('content_board_activity', 'db:board_comment', 'info',
      left(format('%s comment from %s%s', coalesce(nullif(v_board.board->>'company_name', ''), p_slug),
                  lower(v_email), case when v_parent is not null then ' (reply)' else '' end), 200),
      left(format(E'%s\n\nOn: %s\n\nhttps://inboundonsteroids.com/client/%s#review', v_text, left(coalesce(v_title, 'a post'), 160), p_slug), 4000),
      './#exp/brain-b/content',
      'board_comment:' || v_id::text);
  exception when others then null;
  end;

  return jsonb_build_object('ok', true, 'item', jsonb_build_object(
    'id', v_id, 'ref', p_ref, 'at', v_at, 'by', lower(v_email), 'text', v_text, 'parent', v_parent));
end;
$$;

grant execute on function public.board_comments_list(text, text, text) to anon, authenticated;
grant execute on function public.board_comment_add(text, text, text, text, text) to anon, authenticated;
