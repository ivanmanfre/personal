-- All fixtures roll back, including writes to the real board projection.
begin;
do $$
declare p public.client_post_metrics%rowtype; t uuid; other uuid; result text; evidence jsonb; snapshot jsonb; observed int;
begin
 select * into strict p from public.client_post_metrics where client_id='swishdm' order by published_at desc limit 1;
 select board into snapshot from public.client_boards where slug='swishdm-live';
 evidence:=jsonb_build_object('status','qualified','reference_at',now(),'first_inbound_at',now(),'buyer_at',now(),
   'buyer_quote','Could you audit our store?','reference_quote','The two questions before fixing what AI says',
   'post_quote',p.title);
 insert into public.inbound_triage_log(client_id,seat,chat_id,unipile_message_id,who,verdict,reason,message_text)
 values ('swishdm','swishdm','test-post-dm-rollback','rollback-a','Test','buyer','fixture','Could you audit our store?') returning id into t;
 result:=public.swishdm_record_dm_review(t,p.id,evidence);
 if result<>'qualified' then raise exception 'positive failed: %',result; end if;
 result:=public.swishdm_record_dm_review(t,p.id,evidence);
 if result<>'already_reviewed' then raise exception 'retry failed'; end if;
 insert into public.inbound_triage_log(client_id,seat,chat_id,unipile_message_id,who,verdict,reason,message_text)
 values ('swishdm','swishdm','test-post-dm-rollback','rollback-b','Test','buyer','fixture','Thanks') returning id into other;
 if public.swishdm_record_dm_review(other,p.id,evidence)<>'already_attributed' then raise exception 'duplicate conversation counted'; end if;
 update public.client_boards b set board=jsonb_set(board,'{performance,posts}',(
   select jsonb_agg(j-'inbound_dms' order by ord) from jsonb_array_elements(board#>'{performance,posts}') with ordinality x(j,ord)))
 where b.slug='swishdm-live';
 select (j->>'inbound_dms')::int into strict observed from public.client_boards b,
 lateral jsonb_array_elements(public.get_client_board(b.slug,b.token)#>'{board,performance,posts}') j
 where b.slug='swishdm-live' and j->>'url'=p.post_url;
 if observed is distinct from coalesce(p.inbound_dms,0)+1 then raise exception 'board count lost'; end if;
 if (select board #- '{performance,posts}' from public.client_boards where slug='swishdm-live') is distinct from (snapshot #- '{performance,posts}') then raise exception 'unrelated board data changed'; end if;
 select id into strict other from public.inbound_triage_log where client_id='swishdm' and verdict='vendor' limit 1;
 if public.swishdm_record_dm_review(other,p.id,evidence)<>'excluded' then raise exception 'vendor counted'; end if;
end;
$$;
rollback;
