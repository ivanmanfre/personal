-- Versioned comment APIs: real-member mentions and reversible root-thread resolution.
-- Preserve original text/author/audit records and keep legacy board APIs unchanged.
create or replace function public.board_comments_list_v2(p_slug text, p_session text default null, p_token text default null)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_result jsonb; v_items jsonb;
begin
  v_result := public.board_comments_list(p_slug,p_session,p_token);
  if v_result->>'ok' is distinct from 'true' then return v_result; end if;
  -- Include all visible board threads: the legacy 500-comment window can omit an open root.
  select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'ref',a.ref,'at',a.created_at,
    'by',a.payload->>'by','text',a.payload->>'text','parent',a.payload->>'parent',
    'mentions',coalesce(a.payload->'mentions','[]'::jsonb),
    'resolved_at',a.payload->>'resolved_at','resolved_by',a.payload->>'resolved_by'
  ) order by a.created_at,a.id),'[]'::jsonb) into v_items
  from public.client_board_actions a where a.board_slug=p_slug and a.action='comment' and a.hidden_at is null;
  return v_result || jsonb_build_object('items',v_items);
end $$;

create or replace function public.board_comment_add_v2(p_slug text,p_ref text,p_text text,p_parent text default null,p_session text default null,p_mentions text[] default '{}')
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare
  v_team jsonb; v_email text; v_recipient text; v_member jsonb; v_label text;
  v_mentions jsonb := '[]'::jsonb; v_result jsonb; v_parent uuid; v_root public.client_board_actions%rowtype;
begin
  if coalesce(p_session,'')='' then return jsonb_build_object('ok',false,'error','not_authenticated'); end if;
  v_team := public.board_team_list(p_slug,p_session,null);
  v_email := v_team->>'me';
  if v_team->>'ok' is distinct from 'true' or v_email is null or not exists(
    select 1 from jsonb_array_elements(v_team->'members') m where lower(m->>'email')=v_email
  ) then return jsonb_build_object('ok',false,'error','not_authenticated'); end if;
  if cardinality(coalesce(p_mentions,'{}'::text[]))>25 then return jsonb_build_object('ok',false,'error','bad_mentions'); end if;
  for v_recipient in select distinct lower(btrim(e)) from unnest(coalesce(p_mentions,'{}'::text[])) e loop
    select m into v_member from jsonb_array_elements(v_team->'members') m where lower(m->>'email')=v_recipient;
    if not found then return jsonb_build_object('ok',false,'error','bad_mentions'); end if;
    v_label := coalesce(nullif(btrim(v_member->>'name'),''),v_member->>'email');
    if (select count(*) from jsonb_array_elements(v_team->'members') m where coalesce(nullif(btrim(m->>'name'),''),m->>'email')=v_label)>1 then
      v_label := v_label || ' (' || v_recipient || ')';
    end if;
    -- Match the same complete tag boundaries as the composer (and treat labels literally).
    if not exists(select 1 from generate_series(1,length(coalesce(p_text,''))) pos
      where substring(p_text from pos for length(v_label)+1)='@'||v_label
        and (pos=1 or substring(p_text from pos-1 for 1)!~'[[:alnum:]_]')
        and (pos+length(v_label)+1>length(p_text) or substring(p_text from pos+length(v_label)+1 for 1)!~'[[:alnum:]_]')) then
      return jsonb_build_object('ok',false,'error','bad_mentions');
    end if;
    v_mentions := v_mentions || jsonb_build_array(jsonb_build_object('email',v_recipient,'label',v_label));
  end loop;
  if coalesce(p_parent,'')<>'' then
    begin v_parent := p_parent::uuid;
    exception when invalid_text_representation then return jsonb_build_object('ok',false,'error','bad_parent'); end;
    select * into v_root from public.client_board_actions where id=v_parent and board_slug=p_slug and ref=p_ref
      and action='comment' and hidden_at is null and coalesce(payload->>'parent','')='' for update;
    if not found then return jsonb_build_object('ok',false,'error','bad_parent'); end if;
  end if;
  v_result := public.board_comment_add(p_slug,p_ref,p_text,p_parent,p_session);
  if v_result->>'ok' is distinct from 'true' then return v_result; end if;
  update public.client_board_actions set payload=coalesce(payload,'{}'::jsonb)||jsonb_build_object('mentions',v_mentions)
    where id=(v_result->'item'->>'id')::uuid and board_slug=p_slug;
  -- A new reply is fresh feedback. Reopen the thread so it cannot disappear from open counts.
  if v_parent is not null and v_root.payload->>'resolved_at' is not null then
    update public.client_board_actions set payload=payload||jsonb_build_object('resolved_at',null,'resolved_by',null) where id=v_parent;
    insert into public.client_board_actions(board_slug,client_id,action,ref,payload)
      values(p_slug,v_root.client_id,'note',p_ref,jsonb_build_object('event','comment_reopened','comment_id',v_parent,'by',v_email,'reason','new_reply'));
  end if;
  return v_result || jsonb_build_object('item',(v_result->'item')||jsonb_build_object('mentions',v_mentions,'resolved_at',null,'resolved_by',null),
    'reopened_thread',case when v_parent is not null and v_root.payload->>'resolved_at' is not null then v_parent::text else null end);
end $$;

create or replace function public.board_comment_resolve(p_slug text,p_comment_id text,p_resolved boolean,p_session text default null)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare
  v_team jsonb; v_email text; v_id uuid; v_root public.client_board_actions%rowtype; v_payload jsonb;
begin
  if coalesce(p_session,'')='' then return jsonb_build_object('ok',false,'error','not_authenticated'); end if;
  v_team := public.board_team_list(p_slug,p_session,null); v_email := v_team->>'me';
  if v_team->>'ok' is distinct from 'true' or v_email is null or not exists(
    select 1 from jsonb_array_elements(v_team->'members') m where lower(m->>'email')=v_email
  ) then return jsonb_build_object('ok',false,'error','not_authenticated'); end if;
  if not exists(select 1 from public.client_boards where slug=p_slug and (expires_at is null or expires_at>now())) then
    return jsonb_build_object('ok',false,'error','not_found'); end if;
  if p_resolved is null then return jsonb_build_object('ok',false,'error','bad_state'); end if;
  begin v_id := p_comment_id::uuid;
  exception when invalid_text_representation then return jsonb_build_object('ok',false,'error','bad_comment'); end;
  select * into v_root from public.client_board_actions where id=v_id and board_slug=p_slug and action='comment'
    and hidden_at is null and coalesce(payload->>'parent','')='' for update;
  if not found then return jsonb_build_object('ok',false,'error','bad_comment'); end if;
  if public._board_member_role(p_slug,v_email)='viewer' and lower(coalesce(v_root.payload->>'by',''))<>v_email then
    return jsonb_build_object('ok',false,'error','not_allowed'); end if;
  v_payload := v_root.payload;
  if (v_payload->>'resolved_at' is not null) is distinct from p_resolved then
    v_payload := v_payload || jsonb_build_object('resolved_at',case when p_resolved then to_jsonb(now()) else 'null'::jsonb end,
      'resolved_by',case when p_resolved then v_email else null end);
    update public.client_board_actions set payload=v_payload where id=v_id;
    insert into public.client_board_actions(board_slug,client_id,action,ref,payload)
      values(p_slug,v_root.client_id,'note',v_root.ref,jsonb_build_object('event',case when p_resolved then 'comment_resolved' else 'comment_reopened' end,
        'comment_id',v_id,'by',v_email));
  end if;
  return jsonb_build_object('ok',true,'item',jsonb_build_object('id',v_id,'ref',v_root.ref,'at',v_root.created_at,
    'by',v_payload->>'by','text',v_payload->>'text','parent',v_payload->>'parent','mentions',coalesce(v_payload->'mentions','[]'::jsonb),
    'resolved_at',v_payload->>'resolved_at','resolved_by',v_payload->>'resolved_by'));
end $$;

revoke all on function public.board_comments_list_v2(text,text,text) from public;
revoke all on function public.board_comment_add_v2(text,text,text,text,text,text[]) from public;
revoke all on function public.board_comment_resolve(text,text,boolean,text) from public;
grant execute on function public.board_comments_list_v2(text,text,text) to anon,authenticated;
grant execute on function public.board_comment_add_v2(text,text,text,text,text,text[]) to anon,authenticated;
grant execute on function public.board_comment_resolve(text,text,boolean,text) to anon,authenticated;
notify pgrst,'reload schema';
