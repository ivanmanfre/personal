-- Always run inside a rollback transaction. Fixtures are unique; no real comments survive.
begin;
do $$
declare
  s text := 'test-comment-collab-' || replace(gen_random_uuid()::text,'-','');
  root_id text; reply_id text; other_id text; result jsonb; rows jsonb;
begin
  insert into public.client_registry(client_id,display_name,github_repo,is_active,platform)
  values(s,'Comment test','test/fixture',false,jsonb_build_object('board',jsonb_build_object('slug',s,'auth',jsonb_build_object('magic_link',true,'allowed_emails',jsonb_build_array('owner@example.invalid','viewer@example.invalid','other@example.invalid'),'owner_emails',jsonb_build_array('owner@example.invalid'),'members',jsonb_build_object('viewer@example.invalid',jsonb_build_object('name','Test Viewer','role','viewer'),'other@example.invalid',jsonb_build_object('name','Other Viewer','role','viewer'),'owner@example.invalid',jsonb_build_object('name','Test Owner','role','admin'))))));
  insert into public.client_boards(slug,client_id,mode,token,board)
  values(s,s,'live',s||'-link','{"queue":[{"id":"post-a"},{"id":"post-b"}]}'::jsonb);
  insert into public.client_board_sessions(slug,email,token_hash,expires_at)
  values(s,'owner@example.invalid',encode(extensions.digest(s||'-owner','sha256'),'hex'),now()+interval '1 hour'),
        (s,'viewer@example.invalid',encode(extensions.digest(s||'-viewer','sha256'),'hex'),now()+interval '1 hour'),
        (s,'other@example.invalid',encode(extensions.digest(s||'-other','sha256'),'hex'),now()+interval '1 hour');

  update public.client_registry set platform=jsonb_set(jsonb_set(platform,'{board,auth,allowed_emails}',
    (platform#>'{board,auth,allowed_emails}')||'["alex1@example.invalid","alex2@example.invalid"]'::jsonb),
    '{board,auth,members}',(platform#>'{board,auth,members}')||'{"alex1@example.invalid":{"name":"Alex","role":"viewer"},"alex2@example.invalid":{"name":"Alex","role":"viewer"}}'::jsonb) where client_id=s;
  result := public.board_comment_add_v2(s,'post-a','@Alex check this.',null,s||'-owner',array['alex1@example.invalid','alex2@example.invalid']);
  assert result->>'error'='bad_mentions','ambiguous duplicate names accepted';
  result := public.board_comment_add_v2(s,'post-a','@Alex (alex1@example.invalid) @Alex (alex2@example.invalid) check this.',null,s||'-owner',array['alex1@example.invalid','alex2@example.invalid']);
  assert result->>'ok'='true' and jsonb_array_length(result->'item'->'mentions')=2,'disambiguated names lost identity';
  result := public.board_comment_add_v2(s,'post-a','Hello',null,'invalid','{}');
  assert result->>'error'='not_authenticated','invalid session accepted';
  result := public.board_comment_add_v2(s,'post-a','@Stranger',null,s||'-owner',array['stranger@example.invalid']);
  assert result->>'error'='bad_mentions','nonmember mention accepted';
  result := public.board_comment_add_v2(s,'post-a','@Test OwnerSuffix',null,s||'-owner',array['owner@example.invalid']);
  assert result->>'error'='bad_mentions','partial mention accepted';
  result := public.board_comment_add_v2(s,'post-a','No tag here',null,s||'-owner',array['viewer@example.invalid']);
  assert result->>'error'='bad_mentions','invisible mention accepted';
  result := public.board_comment_add_v2(s,'missing','Hello',null,s||'-owner','{}');
  assert result->>'error'='bad_ref','non-board ref accepted';

  result := public.board_comment_add_v2(s,'post-a','@Test Owner please check.',null,s||'-viewer',array['owner@example.invalid']);
  assert result->>'ok'='true','valid root rejected';
  root_id := result->'item'->>'id';
  assert result->'item'->'mentions'->0->>'email'='owner@example.invalid','mention receipt missing';
  result := public.board_comment_add_v2(s,'post-b','Other post',null,s||'-owner','{}');
  other_id := result->'item'->>'id';
  result := public.board_comment_add_v2(s,'post-a','Wrong post',other_id,s||'-owner','{}');
  assert result->>'error'='bad_parent','cross-post parent accepted';
  result := public.board_comment_resolve(s,root_id,true,s||'-other');
  assert result->>'error'='not_allowed','viewer resolved someone else thread';
  result := public.board_comment_resolve(s,root_id,true,null);
  assert result->>'error'='not_authenticated','board link resolved thread';
  result := public.board_comment_resolve(s,root_id,true,s||'-viewer');
  assert result->'item'->>'resolved_at' is not null,'author could not resolve';
  result := public.board_comment_resolve(s,root_id,true,s||'-owner');
  assert result->'item'->>'resolved_by'='viewer@example.invalid','idempotent resolve replaced attribution';
  assert (select count(*) from public.client_board_actions where board_slug=s and payload->>'event'='comment_resolved')=1,'duplicate resolution audit';
  result := public.board_comments_list_v2(s,null,s||'-link');
  assert result->>'ok'='true','board link could not read';
  select x into rows from jsonb_array_elements(result->'items') x where x->>'id'=root_id;
  assert rows->>'resolved_by'='viewer@example.invalid','resolution attribution missing';
  result := public.board_comment_resolve(s,root_id,false,s||'-owner');
  assert result->>'ok'='true' and result->'item'->>'resolved_at' is null,'approver could not reopen';
  result := public.board_comment_resolve(s,root_id,true,s||'-owner');
  result := public.board_comment_add_v2(s,'post-a','@Test Viewer following up.',root_id,s||'-owner',array['viewer@example.invalid']);
  assert result->>'ok'='true','reply rejected';
  reply_id := result->'item'->>'id';
  result := public.board_comments_list_v2(s,s||'-owner',null);
  select x into rows from jsonb_array_elements(result->'items') x where x->>'id'=root_id;
  assert rows->>'resolved_at' is null,'reply did not reopen thread';
  result := public.board_comment_add_v2(s,'post-a','Nested reply',reply_id,s||'-owner','{}');
  assert result->>'error'='bad_parent','nested reply accepted';
  result := public.board_comment_resolve(s,reply_id,true,s||'-owner');
  assert result->>'error'='bad_comment','resolved reply rather than root';
  update public.client_board_actions set hidden_at=now() where id=root_id::uuid;
  result := public.board_comment_add_v2(s,'post-a','Hidden parent',root_id,s||'-owner','{}');
  assert result->>'error'='bad_parent','hidden parent accepted';
  result := public.board_comment_resolve(s,root_id,true,s||'-owner');
  assert result->>'error'='bad_comment','hidden comment resolved';
  result := public.board_comments_list_v2(s,s||'-owner',null);
  assert not exists(select 1 from jsonb_array_elements(result->'items') x where x->>'id'=root_id),'hidden comment leaked';

  insert into public.client_board_actions(board_slug,client_id,action,ref,payload)
  values(s||'-otherboard',s,'comment','post-a',jsonb_build_object('text','Private to another board','by','owner@example.invalid')) returning id::text into reply_id;
  result := public.board_comment_add_v2(s,'post-a','Wrong board',reply_id,s||'-owner','{}');
  assert result->>'error'='bad_parent','cross-board parent accepted';
  result := public.board_comment_resolve(s,reply_id,true,s||'-owner');
  assert result->>'error'='bad_comment','cross-board comment mutated';
  update public.client_registry set platform=jsonb_set(platform,'{board,auth,allowed_emails}','["owner@example.invalid","other@example.invalid"]') where client_id=s;
  result := public.board_comment_add_v2(s,'post-a','Removed member',null,s||'-viewer','{}');
  assert result->>'error'='not_authenticated','removed member posted with old session';
  result := public.board_comment_resolve(s,other_id,true,s||'-viewer');
  assert result->>'error'='not_authenticated','removed member resolved with old session';
  update public.client_board_sessions set revoked_at=now() where slug=s and email='viewer@example.invalid';
  result := public.board_comment_resolve(s,other_id,true,s||'-viewer');
  assert result->>'error'='not_authenticated','revoked session accepted';
  insert into public.client_board_actions(board_slug,client_id,action,ref,payload,created_at)
    select s,s,'comment','post-a',jsonb_build_object('text','Older open feedback','by','owner@example.invalid'),now()-interval '1 day' from generate_series(1,501);
  result := public.board_comments_list_v2(s,s||'-owner',null);
  assert jsonb_array_length(result->'items')>500,'older open threads omitted from feedback counts';
  update public.client_boards set expires_at=now()-interval '1 second' where slug=s;
  result := public.board_comment_resolve(s,other_id,true,s||'-owner');
  assert result->>'error'='not_found','expired board mutated';
end $$;
rollback;
select 'comment collaboration assertions passed; all fixtures rolled back' as result;
