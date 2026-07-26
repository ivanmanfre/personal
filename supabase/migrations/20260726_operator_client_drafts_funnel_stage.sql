-- operator_client_drafts: expose carousel_drafts.funnel_stage so the operator
-- cockpit (dashboard-v2 Client Ops) can render the same Reach / Trust / Buyers
-- chips the client board shows. Params unchanged -> CREATE OR REPLACE is safe.
CREATE OR REPLACE FUNCTION public.operator_client_drafts(p_gate text, p_client_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare out jsonb;
begin
  if not operator_gate_ok(p_gate) then
    return jsonb_build_object('ok', false, 'error', 'bad_gate');
  end if;
  select jsonb_agg(jsonb_build_object(
    'id', d.id, 'title', d.title, 'status', d.status,
    'qa_score', nullif(d.qa->>'score','')::numeric,
    'qa', d.qa,
    'agent_log', coalesce(d.agent_log, '[]'::jsonb),
    'taxonomy', d.taxonomy,
    'source_post_id', d.source_post_id,
    'idea_source_label', d.ci_source_label,
    'idea_source_ref', d.ci_source_ref,
    'idea_icp_score', d.ci_icp_score,
    'idea_agent_log', coalesce(d.ci_agent_log, '[]'::jsonb),
    'board_visible', d.board_visible,
    'type', d.type,
    'has_media', case
      when d.type = 'single_image' then coalesce(array_length(d.image_urls,1),0) > 0
      when d.type = 'carousel' then coalesce(array_length(d.image_urls,1),0) > 0
                                    or coalesce(jsonb_array_length(d.slides),0) > 0
      else true
    end,
    'image_urls', to_jsonb(coalesce(d.image_urls, '{}'::text[])),
    'scheduled_at', d.scheduled_at,
    'created_at', d.created_at, 'published_at', d.published_at,
    'post_body', d.post_body,
    'funnel_stage', d.funnel_stage
  ) order by d.created_at desc) into out
  from (
    select cd.*, ci.source_label as ci_source_label, ci.source_ref as ci_source_ref, ci.icp_score as ci_icp_score, ci.agent_log as ci_agent_log
    from carousel_drafts cd
    left join lateral (
      select c2.source_label, c2.source_ref, c2.icp_score, c2.agent_log from client_ideas c2
      where c2.client_id = cd.client_id
        and (c2.source_ref = cd.source_post_id or c2.id::text = cd.source_post_id)
      limit 1
    ) ci on true
    where cd.client_id = p_client_id
    order by cd.created_at desc limit 100
  ) d;
  return jsonb_build_object('ok', true, 'drafts', coalesce(out, '[]'::jsonb));
end; $function$;
