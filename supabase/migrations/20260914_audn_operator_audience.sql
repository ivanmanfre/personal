begin;
-- Authenticated operator capability boundary; source grants and RLS stay unchanged.
create function public.operator_audn_audience(p_gate text, p_client_id text)
returns jsonb language plpgsql stable security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare result jsonb := jsonb_build_object('client_id',p_client_id); section jsonb;
begin
  if not public.operator_gate_ok(p_gate) then
    raise exception 'unauthorized' using errcode='42501';
  end if;
  if p_client_id is null or not exists (
    select 1 from public.client_registry r where r.client_id=p_client_id
  ) then
    raise exception 'unknown client' using errcode='22023';
  end if;
  begin
    with scoped as materialized (
      select client_id, topic, people, events, posts from public.audn_topic_people_v where client_id=p_client_id
    ), bounded as (select * from scoped order by topic)
    select jsonb_build_object('ok',true,'rows',coalesce((select jsonb_agg(to_jsonb(b)) from bounded b),'[]'::jsonb),
      'count',null) into section;
  exception when others then
    section := jsonb_build_object('ok',false,'error','topics: ' || SQLERRM);
  end;
  result := result || jsonb_build_object('topics',section);
  begin
    with scoped as materialized (
      select client_id, person_key, label, is_operator, is_excluded, conflict from public.audn_person_label_v where client_id=p_client_id
    ), bounded as (select * from scoped order by person_key limit 1000)
    select jsonb_build_object('ok',true,'rows',coalesce((select jsonb_agg(to_jsonb(b)) from bounded b),'[]'::jsonb),
      'count',(select count(*) from scoped)) into section;
  exception when others then
    section := jsonb_build_object('ok',false,'error','labels: ' || SQLERRM);
  end;
  result := result || jsonb_build_object('labels',section);
  begin
    with scoped as materialized (
      select client_id, person_key, distinct_posts, total_events, observed_across_posts, confirmed_return, return_timing, is_operator, is_excluded from public.audn_person_activity_v where client_id=p_client_id
    ), bounded as (select * from scoped order by person_key limit 1000)
    select jsonb_build_object('ok',true,'rows',coalesce((select jsonb_agg(to_jsonb(b)) from bounded b),'[]'::jsonb),
      'count',(select count(*) from scoped)) into section;
  exception when others then
    section := jsonb_build_object('ok',false,'error','activity: ' || SQLERRM);
  end;
  result := result || jsonb_build_object('activity',section);
  begin
    with scoped as materialized (
      select client_id, post_social_id, target_age_days, reactions, rank, eligible_n, rank_basis from public.audn_matched_age_rank_v where client_id=p_client_id
    ), bounded as (select * from scoped order by rank asc nulls last limit 50)
    select jsonb_build_object('ok',true,'rows',coalesce((select jsonb_agg(to_jsonb(b)) from bounded b),'[]'::jsonb),
      'count',null) into section;
  exception when others then
    section := jsonb_build_object('ok',false,'error','ranks: ' || SQLERRM);
  end;
  result := result || jsonb_build_object('ranks',section);
  begin
    with scoped as materialized (
      select client_id, month, target_age_days, median_reactions, n, basis from public.audn_monthly_median_v where client_id=p_client_id
    ), bounded as (select * from scoped order by month desc limit 12)
    select jsonb_build_object('ok',true,'rows',coalesce((select jsonb_agg(to_jsonb(b)) from bounded b),'[]'::jsonb),
      'count',null) into section;
  exception when others then
    section := jsonb_build_object('ok',false,'error','monthly: ' || SQLERRM);
  end;
  result := result || jsonb_build_object('monthly',section);
  begin
    with scoped as materialized (
      select client_id, recommendation_id, recommendation_ref, idea_id, draft_id, published_post_social_id, link_state from public.audn_recommendation_links_v where client_id=p_client_id
    ), bounded as (select * from scoped order by recommendation_id limit 200)
    select jsonb_build_object('ok',true,'rows',coalesce((select jsonb_agg(to_jsonb(b)) from bounded b),'[]'::jsonb),
      'count',null) into section;
  exception when others then
    section := jsonb_build_object('ok',false,'error','links: ' || SQLERRM);
  end;
  result := result || jsonb_build_object('links',section);
  return result;
end;
$function$;
revoke all on function public.operator_audn_audience(text,text) from public, anon;
grant execute on function public.operator_audn_audience(text,text) to authenticated, service_role;
commit;
