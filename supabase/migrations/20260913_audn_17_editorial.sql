-- Run07: grounded writer, atomic pending queue, and source/asset state validation.
-- Inert release artifact. Run08 authority required. No source rows changed here.
create table if not exists public.audn_writer_cycles (
  client_id text not null,
  cycle_id text not null,
  committed_at timestamptz not null default now(),
  proposal_ids uuid[] not null,
  primary key(client_id, cycle_id)
);
alter table public.audn_writer_cycles enable row level security;
revoke all on public.audn_writer_cycles from public, anon, authenticated;
grant select, insert on public.audn_writer_cycles to service_role;

create or replace function public.audn_asset_state(a jsonb)
returns text language sql immutable set search_path=public as $$
select case
  when a->>'revoked_at' is not null or a->>'state'='revoked' then 'revoked'
  when a->>'usage_approval'='true' and a->>'approved_at' is not null
    and a->>'approved_by' is not null
    and (jsonb_array_length(coalesce(a->'files','[]'::jsonb))>0
         or nullif(a->>'excerpt','') is not null)
    then 'approved'
  when jsonb_array_length(coalesce(a->'files','[]'::jsonb))>0 or nullif(a->>'excerpt','') is not null then 'received'
  when a->>'sent_record_id' is not null and a->>'sent_at' is not null then 'requested'
  else 'draft' end;
$$;

-- One deterministic key for non-snapshot consumers. Typed identifiers never alias by digits.
create or replace function public.audn_canonical_post_key(p_client_id text,p_raw_id text)
returns text language sql stable set search_path=public as $$
with exact_i as (select canonical_post_id,identity_status from audn_canonical_post_identity_v
 where client_id=p_client_id and canonical_post_id=p_raw_id),
alias_i as (select case when count(*)=1 then min(canonical_post_id) end id
 from audn_canonical_post_identity_v where client_id=p_client_id and identity_status='resolved'
 and activity_digits=audn_urn_digits(p_raw_id))
select case when exists(select 1 from exact_i) then
 (select canonical_post_id from exact_i where identity_status='resolved')
 when audn_urn_kind(p_raw_id) is null then (select id from alias_i) else null end;
$$;

create or replace function public.audn_writer_context(p_client_id text)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare
 m jsonb; editorial jsonb; brief jsonb; pr jsonb; own_rows jsonb; labels jsonb;
 post_labels jsonb; feedback jsonb; measure jsonb; themes jsonb; assets jsonb;
 refs jsonb; cutoff timestamptz:=public.audn_cutoff();
begin
 select platform->'measurement' into m from client_registry where client_id=p_client_id;
 if m is null then raise exception 'audn_unknown_client'; end if;
 editorial:=m->'editorial';brief:=editorial->'brief';refs:=editorial->'prompt_refs';
 if brief is null or brief->>'client_id' is distinct from p_client_id
    or nullif(brief->>'buyer','') is null or nullif(brief->>'offer','') is null
    or jsonb_typeof(brief->'vetoes') is distinct from 'array'
    or jsonb_typeof(refs) is distinct from 'array' or jsonb_array_length(refs)=0 then
   raise exception 'audn_required_client_brief_missing';
 end if;
 select jsonb_agg(jsonb_build_object('slug',p.slug,'role',r->>'role','body',p.body,'version',p.version)) into pr
 from jsonb_array_elements(refs) r join content_prompts p on p.slug=r->>'slug'
 where p.is_active and nullif(p.body,'') is not null and p.version is not null;
 if coalesce(jsonb_array_length(pr),0)<>jsonb_array_length(refs) then raise exception 'audn_required_prompt_missing'; end if;
 -- Exact own text; client feed meta.text is the body, title is only a truncated label.
 if p_client_id='ivan' then
  select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) into own_rows from (
   select social_id as post_social_id,post_text as text,posted_at as published_at,post_type as format,linkedin_url as url
   from own_posts_scored where posted_at<=cutoff and posted_at>=cutoff-interval '90 days' order by posted_at desc
  )t;
 else
  select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) into own_rows from (
   select social_id as post_social_id,meta->>'text' as text,published_at,meta->'attachments' as attachments,post_url as url,
     case when nullif(meta->>'text','') is null then 'unavailable' else 'stored_feed_text_may_be_truncated' end as text_coverage
   from client_post_metrics where client_id=p_client_id and published_at<=cutoff and published_at>=cutoff-interval '90 days'
   order by published_at desc
  )t;
 end if;
 select jsonb_build_object('distinct_people',count(*),'positive',count(*) filter(where label='positive'),
   'borderline',count(*) filter(where label='borderline'),'negative',count(*) filter(where label='negative'),
   'unknown',count(*) filter(where label not in('positive','borderline','negative') or label is null),
   'conflict_people',count(*) filter(where conflict),
   'classifier_generations',(select jsonb_agg(to_jsonb(g)) from (select classifier_slug,classifier_version,count(*) as people from audn_person_label_v where client_id=p_client_id and not is_excluded group by classifier_slug,classifier_version)g),
   'basis','stored_relevance_labels_not_outcomes','classifier_ref',m->>'icp_prompt_slug',
   'classifier_version',m->'icp_prompt_version','calibration','not_validated_for_production_weights') into labels
 from (select distinct person_key,case when conflict then 'unknown' else label end as label,conflict from audn_person_label_v where client_id=p_client_id and not is_excluded)t;
 select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) into post_labels from (
   select audn_canonical_post_key(e.client_id,e.post_social_id) as canonical_post_id,
     case when audn_canonical_post_key(e.client_id,e.post_social_id) is null then e.post_social_id end as unresolved_raw_post_id,
     count(distinct e.person_key) as distinct_people,
     count(distinct e.person_key) filter(where l.label='positive' and not l.conflict) as positive,
     count(distinct e.person_key) filter(where l.label='borderline' and not l.conflict) as borderline,
     count(distinct e.person_key) filter(where l.label='negative' and not l.conflict) as negative,
     count(distinct e.person_key) filter(where l.conflict or l.label is null or l.label not in('positive','borderline','negative')) as unknown
   from audn_interaction_events_v e left join audn_person_label_v l on l.client_id=e.client_id and l.person_key=e.person_key
   where e.client_id=p_client_id and coalesce(l.is_excluded,false)=false and e.first_observed_at<=cutoff
   group by audn_canonical_post_key(e.client_id,e.post_social_id),
     case when audn_canonical_post_key(e.client_id,e.post_social_id) is null then e.post_social_id end
 )t;
 select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) into feedback from (
   select l.*,coalesce((select jsonb_agg(to_jsonb(s)) from audn_metric_standing_v s
     where s.client_id=p_client_id and s.canonical_post_id=audn_canonical_post_key(p_client_id,l.published_post_social_id)),'[]'::jsonb) as linked_results
   from audn_recommendation_links_v l
   -- A real proposal is the provenance boundary. A reject/defer/accept before
   -- idea creation is still useful feedback; an unrelated action is not.
   join ops_drafts o on o.client_id=l.client_id and o.id::text=l.recommendation_id and o.kind='audn_recommendation'
   where l.client_id=p_client_id and o.created_at<=cutoff
     and coalesce(o.context->>'provenance','production') not in('test','demo','synthetic','orphan')
     and (l.decided_at is null or l.decided_at<=cutoff)
     and (l.published_post_social_id is null or exists(select 1 from audn_canonical_post_identity_v pi
       where pi.client_id=p_client_id and pi.canonical_post_id=audn_canonical_post_key(p_client_id,l.published_post_social_id)
         and pi.published_at<=cutoff))
 )t;
 measure:=public.audn_measurement_payload(p_client_id);
 themes:=public.audn_themes_payload(p_client_id,90);
 if measure is null or measure->>'ok'='false' then raise exception 'audn_measurement_unavailable'; end if;
 if themes is null or themes->>'ok'='false' then raise exception 'audn_themes_unavailable'; end if;
 select coalesce(jsonb_agg(a || jsonb_build_object('effective_state',public.audn_asset_state(a))),'[]'::jsonb)
 into assets from jsonb_array_elements(coalesce(m->'assets','[]'::jsonb)) a;
 return jsonb_build_object('client_id',p_client_id,'schema_version','audn-editorial-v2','cutoff',cutoff,
   'brief',brief,'prompts',pr,'roster',coalesce(m->'roster','[]'::jsonb),'own_posts',own_rows,
   'own_text_coverage',jsonb_build_object('rows',jsonb_array_length(own_rows),'missing_text',
     (select count(*) from jsonb_array_elements(own_rows)x where nullif(x->>'text','') is null)),
   'measurement',measure,'themes',themes,'buyer_fit',labels,'post_buyer_fit',post_labels,
   'sources',coalesce((select jsonb_agg(case when
       x->>'client_id'=p_client_id and nullif(x->>'source_id','') is not null and nullif(x->>'location','') is not null
       and x->'consent'->>'state'='approved' and x->>'revoked_at' is null
       and x->'consent'->'purpose' ? 'drafting' and x->>'state'='approved'
       then x else jsonb_build_object('source_id',x->>'source_id','client_id',p_client_id,'state','unavailable','writer_eligible',false) end)
       from jsonb_array_elements(coalesce(editorial->'sources','[]'::jsonb))x),'[]'::jsonb),'assets',assets,'previous_decisions_and_results',feedback,
   'scoring',jsonb_build_object('mode','shadow','production_weights_enabled',false),
   'source_state',case when jsonb_array_length(own_rows)=0 then 'empty_valid_dataset' else 'available' end);
end;
$$;
revoke all on function public.audn_writer_context(text) from public,anon,authenticated;
grant execute on function public.audn_writer_context(text) to service_role;

create or replace function public.audn_recommendation_commit(
 p_client_id text,p_cycle_id text,p_rows jsonb,p_limit integer default 3,p_force_gap boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 prior uuid[]; ids uuid[]:='{}'; row jsonb; row_id uuid; n int; cap int; registry_cap int;
 cutoff timestamptz:=public.audn_cutoff();
begin
 if p_client_id is null or nullif(p_cycle_id,'') is null or jsonb_typeof(p_rows) is distinct from 'array' then raise exception 'bad_args'; end if;
 select coalesce((platform->'measurement'->'pilot_limits'->>'recommendations_per_review')::int,3) into registry_cap
 from client_registry where client_id=p_client_id;
 if registry_cap is null then raise exception 'audn_unknown_client'; end if;
 cap:=least(greatest(registry_cap,1),greatest(coalesce(p_limit,3),1));
 -- Serialize only this client's queue. Check durable same-cycle result before current cap/gap.
 perform pg_advisory_xact_lock(hashtextextended('audn-writer:'||p_client_id,0));
 select proposal_ids into prior from audn_writer_cycles where client_id=p_client_id and cycle_id=p_cycle_id;
 if found then return jsonb_build_object('ok',true,'already',true,'proposal_ids',prior,'written',0); end if;
 select count(*) into n from ops_drafts where client_id=p_client_id and kind='audn_recommendation' and approved_at is null and sent_at is null;
 if n+jsonb_array_length(p_rows)>cap then return jsonb_build_object('ok',false,'reason','open_proposals_at_limit','written',0); end if;
 if not p_force_gap and exists(select 1 from ops_drafts where client_id=p_client_id and kind='audn_recommendation' and created_at>cutoff-interval '6 days') then
  return jsonb_build_object('ok',false,'reason','reviewed_this_week','written',0);
 end if;
 for row in select value from jsonb_array_elements(p_rows) loop
  if row->>'client_id' is distinct from p_client_id or row->>'kind' is distinct from 'audn_recommendation'
    or nullif(row->>'body','') is null or jsonb_typeof(row->'context'->'audn') is distinct from 'object'
    or row->'context'->>'cycle_id' is distinct from p_cycle_id then raise exception 'audn_invalid_proposal_tenant_or_shape'; end if;
  insert into ops_drafts(client_id,kind,slack_channel,body,context)
  values(p_client_id,'audn_recommendation',null,row->>'body',row->'context') returning id into row_id;
  ids:=array_append(ids,row_id);
 end loop;
 if cardinality(ids)>0 then insert into audn_writer_cycles(client_id,cycle_id,proposal_ids)values(p_client_id,p_cycle_id,ids);end if;
 return jsonb_build_object('ok',true,'already',false,'proposal_ids',ids,'written',cardinality(ids));
end;
$$;
revoke all on function public.audn_recommendation_commit(text,text,jsonb,integer,boolean) from public,anon,authenticated;
grant execute on function public.audn_recommendation_commit(text,text,jsonb,integer,boolean) to service_role;
