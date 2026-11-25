begin;

alter table public.inbound_triage_log add column if not exists post_review jsonb;
create unique index if not exists swishdm_one_post_per_inbound_chat
  on public.inbound_triage_log (chat_id)
  where client_id='swishdm' and attributed_post_id is not null;

-- Only these two verdicts represent an open question about buyer demand.
create or replace function public.swishdm_dm_candidates()
returns table(id uuid, chat_id text, unipile_message_id text) language sql stable
set search_path=public as $$
  select t.id,t.chat_id,t.unipile_message_id from inbound_triage_log t
  where t.client_id='swishdm' and t.seat='swishdm' and t.verdict in ('buyer','unsure')
    and (t.post_review is null or (t.post_review->>'retry_at')::timestamptz <= now())
    and not exists (select 1 from inbound_triage_log x where x.client_id='swishdm'
                    and x.chat_id=t.chat_id and x.attributed_post_id is not null)
  order by (t.verdict='buyer') desc,t.decided_at,t.id limit 3;
$$;

-- The native post excerpt can be cut at 500 characters. Prefer the published board copy
-- when its title and opening passage match, including when the reference is near the end.
create or replace function public.swishdm_dm_posts()
returns table(id uuid,activity text,title text,body text,published_at timestamptz) language sql stable
set search_path=public as $$
  with board_posts as (
    select p->>'title' title,
           coalesce(nullif(p->>'post_body',''),nullif(p->>'body','')) body
    from client_boards b cross join lateral jsonb_array_elements(b.board->'queue') p
    where b.slug='swishdm-live' and b.client_id='swishdm' and p->>'stage' in ('live','published')
  )
  select m.id,substring(m.social_id from '([0-9]+)$'),m.title,coalesce(b.body,m.meta->>'text',''),m.published_at
  from client_post_metrics m left join lateral (select max(bp.body) body from board_posts bp
    where bp.title=m.title and length(m.meta->>'text')>=80
      and left(bp.body,80)=left(m.meta->>'text',80) having count(*)=1) b on true
  where m.client_id='swishdm' and m.published_at is not null order by m.published_at desc;
$$;

-- Reapply counts whenever the LinkedIn metrics collector replaces its snapshot.
create or replace function public.swishdm_dm_board_counts() returns trigger language plpgsql
set search_path=public as $$
begin
 if jsonb_typeof(new.board#>'{performance,posts}')='array' then
   new.board := jsonb_set(new.board, '{performance,posts}', (
     select coalesce(jsonb_agg(case when m.id is null then p else
       p || jsonb_build_object('inbound_dms',coalesce(m.inbound_dms,0)) end order by ord),'[]'::jsonb)
     from jsonb_array_elements(new.board#>'{performance,posts}') with ordinality j(p,ord)
     left join client_post_metrics m on m.client_id='swishdm'
       and m.social_id='urn:li:activity:'||substring(p->>'url' from 'activity[-:]([0-9]+)')
   ));
 end if;
 return new;
end;
$$;
create trigger swishdm_dm_board_counts before update of board on public.client_boards
for each row when (new.client_id='swishdm' and new.slug='swishdm-live' and
 new.board#>'{performance,posts}' is distinct from old.board#>'{performance,posts}')
execute function public.swishdm_dm_board_counts();

create or replace function public.swishdm_record_dm_review(p_id uuid,p_post uuid,p_review jsonb)
returns text language plpgsql set search_path=public as $$
declare t inbound_triage_log%rowtype; n integer;
begin
 select * into t from inbound_triage_log where id=p_id and client_id='swishdm' and seat='swishdm'
   and verdict in ('buyer','unsure') for update;
 if not found then return 'excluded'; end if;
 if t.post_review is not null and (t.post_review->>'retry_at' is null or (t.post_review->>'retry_at')::timestamptz > now()) then return 'already_reviewed'; end if;
 if p_post is null then
   update inbound_triage_log set post_review=p_review where id=p_id;
   return 'unattributed';
 end if;
 if p_review->>'status' is distinct from 'qualified'
   or nullif(trim(p_review->>'buyer_quote'),'') is null or nullif(trim(p_review->>'reference_quote'),'') is null
   or nullif(trim(p_review->>'post_quote'),'') is null or (p_review->>'reference_at') is null or (p_review->>'buyer_at') is null
   or not exists (select 1 from client_post_metrics where id=p_post and client_id='swishdm'
                  and published_at <= (p_review->>'reference_at')::timestamptz)
 then raise exception 'Invalid SwishDM attribution evidence'; end if;
 perform pg_advisory_xact_lock(hashtextextended('swishdm-dm:'||t.chat_id,0));
 if exists(select 1 from inbound_triage_log where client_id='swishdm' and chat_id=t.chat_id
           and attributed_post_id is not null) then return 'already_attributed'; end if;
 if exists(select 1 from outreach_messages om join outreach_prospects op on op.id=om.prospect_id
           join outreach_campaigns c on c.id=op.campaign_id where c.client_id='swishdm'
           and (om.unipile_chat_id=t.chat_id or op.id=t.surfaced_prospect_id)
           and om.direction='outbound' and om.sent_at <= (p_review->>'buyer_at')::timestamptz)
 then
   update inbound_triage_log set post_review=jsonb_build_object('status','outreach') where id=p_id;
   return 'outreach';
 end if;
 update inbound_triage_log set post_review=p_review, attributed_post_id=p_post, attribution='post_touch' where id=p_id;
 update client_post_metrics set inbound_dms=coalesce(inbound_dms,0)+1, updated_at=now()
 where id=p_post returning inbound_dms into n;
 -- Patch only the matching measured post. The trigger hydrates the other counts from their own rows.
 update client_boards b set board=jsonb_set(b.board,'{performance,posts}',(
   select jsonb_agg(case when substring(p->>'url' from 'activity[-:]([0-9]+)')=substring(m.social_id from '([0-9]+)$')
       then p||jsonb_build_object('inbound_dms',n) else p end order by ord)
   from jsonb_array_elements(b.board#>'{performance,posts}') with ordinality j(p,ord)))
 from client_post_metrics m where m.id=p_post and b.client_id='swishdm' and b.slug='swishdm-live'
   and jsonb_array_length(b.board#>'{performance,posts}')>0;
 return 'qualified';
end;
$$;

revoke all on function public.swishdm_dm_candidates(),public.swishdm_dm_posts(),public.swishdm_record_dm_review(uuid,uuid,jsonb),public.swishdm_dm_board_counts() from public,anon,authenticated;
grant execute on function public.swishdm_dm_candidates(),public.swishdm_dm_posts(),public.swishdm_record_dm_review(uuid,uuid,jsonb),public.swishdm_dm_board_counts() to service_role;

-- Force just a new performance projection on existing measured rows. All other board JSON survives.
update public.client_boards b set board=jsonb_set(b.board,'{performance,posts}',(
 select jsonb_agg(p||jsonb_build_object('inbound_dms',coalesce(m.inbound_dms,0)) order by ord)
 from jsonb_array_elements(b.board#>'{performance,posts}') with ordinality j(p,ord)
 left join public.client_post_metrics m on m.client_id=b.client_id
 and m.social_id='urn:li:activity:'||substring(p->>'url' from 'activity[-:]([0-9]+)')))
where b.client_id='swishdm' and b.slug='swishdm-live' and jsonb_array_length(b.board#>'{performance,posts}')>0;

commit;
