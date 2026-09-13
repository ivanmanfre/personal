-- Extend the existing audience-audit row and generator. No collection or scheduled run.
alter table public.audience_audits add column if not exists client_id text;
alter table public.audience_audits add column if not exists measurement jsonb;
alter table public.audience_audits add column if not exists guidance jsonb;
alter table public.audience_audits add column if not exists audience_coverage jsonb;
alter table public.audience_audits add column if not exists generation_key text;
create unique index if not exists audn_client_audit_generation_key on public.audience_audits(client_id,generation_key)
where client_id is not null and generation_key is not null;

create or replace function public.audn_client_audit_payload(p_client_id text)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare cr jsonb; m jsonb; brief jsonb; measure jsonb; coverage jsonb; guidance jsonb;
 total_n int; positive_n int; borderline_n int; negative_n int; unknown_n int; cutoff timestamptz:=audn_cutoff();
begin
 select to_jsonb(r) into cr from client_registry r where r.client_id=p_client_id;
 if cr is null then raise exception 'audn_unknown_client'; end if;
 m:=cr->'platform'->'measurement';brief:=m->'editorial'->'brief';
 measure:=audn_measurement_payload(p_client_id);
 if measure is null or measure->>'ok'='false' then raise exception 'audn_measurement_unavailable'; end if;
 select count(*),count(*) filter(where label='positive'),count(*) filter(where label='borderline'),
 count(*) filter(where label='negative'),count(*) filter(where label is null or label not in('positive','borderline','negative'))
 into total_n,positive_n,borderline_n,negative_n,unknown_n
 from (select distinct person_key,case when conflict then 'unknown' else label end label from audn_person_label_v where client_id=p_client_id and not is_excluded) labels;
 coverage:=jsonb_build_object('distinct_people',total_n,'positive',positive_n,'borderline',borderline_n,'negative',negative_n,'unknown',unknown_n,
 'classified_n',positive_n+borderline_n+negative_n,'labelled_share_pct',100.0*(positive_n+borderline_n+negative_n)/nullif(total_n,0),
 'conflict_people',(select count(*) from audn_person_label_v where client_id=p_client_id and not is_excluded and conflict),
 'classifier_generations',(select jsonb_agg(to_jsonb(g)) from (select classifier_slug,classifier_version,count(*) as people from audn_person_label_v where client_id=p_client_id and not is_excluded group by classifier_slug,classifier_version)g),
 'classifier_ref',m->>'icp_prompt_slug','classifier_version',m->'icp_prompt_version','basis','stored_labels_not_conversion','cutoff',cutoff,
 'source_state',case when total_n=0 then 'no_stored_people' else 'available' end);
 guidance:=jsonb_build_object('brief_state',case when brief->>'client_id'=p_client_id then 'available' else 'missing' end,
 'buyer',case when brief->>'client_id'=p_client_id then brief->>'buyer' end,
 'subjects',case when brief->>'client_id'=p_client_id then brief->'subjects' else '[]'::jsonb end,
 'review_cadence',coalesce(m->>'review_cadence','weekly'),
 'next_action',case when brief->>'client_id' is distinct from p_client_id then 'Complete the client buyer and editorial brief before proposing content.'
 when total_n=0 then 'Collect the next normal audience observation; keep buyer fit unknown until people are available.'
 else 'Review a buyer-relevant subject in Strategy, confirm the source and proof, then use the normal idea approval step.' end,
 'asset_readiness',coalesce((select jsonb_agg(jsonb_build_object('asset_id',a->>'asset_id','state',audn_asset_state(a)))
 from jsonb_array_elements(coalesce(m->'assets','[]'::jsonb))a),'[]'::jsonb),
 'limitations','Stored buyer-fit labels describe the observed audience. They do not establish buying intent, sales conversion or causal content performance.');
 return jsonb_build_object('client_id',p_client_id,'source','client-learning','audited_at',cutoff,
 'prospect_name',coalesce(cr->'platform'->'client'->>'founder_name',cr->>'display_name',p_client_id),
 'prospect_id',null,'prospect_provider_id',null,'posts_analyzed',
 (select count(*) from audn_canonical_post_identity_v where client_id=p_client_id and published_at<=cutoff and published_at>=cutoff-interval '90 days'),
 'unique_engagers',total_n,'icp_density',100.0*positive_n/nullif(total_n,0),
 'buyer_relevant_pct',100.0*(positive_n+borderline_n)/nullif(total_n,0),
 'buckets',jsonb_build_object('positive',positive_n,'borderline',borderline_n,'negative',negative_n,'unknown',unknown_n),
 'named_examples','[]'::jsonb,'network_total',null,'network_icp_density',null,'network_sample_size',null,'network_icp_count',null,
 'buyer_definition',guidance->>'buyer','verdict',case when total_n=0 then 'Audience evidence unavailable' when unknown_n>0 then 'Partial buyer-fit coverage; review the unknowns' else 'Observed buyer-fit labels; outcomes remain separate' end,
 'measurement',measure,'guidance',guidance,'audience_coverage',coverage);
end;
$$;
revoke all on function public.audn_client_audit_payload(text) from public,anon,authenticated;
grant execute on function public.audn_client_audit_payload(text) to service_role;

create or replace function public.operator_audn_client_audit(p_gate text,p_client_id text)
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if not operator_gate_ok(p_gate) then raise exception 'unauthorized'; end if;
 return audn_client_audit_payload(p_client_id);
end;
$$;
revoke all on function public.operator_audn_client_audit(text,text) from public,anon;
grant execute on function public.operator_audn_client_audit(text,text) to authenticated,service_role;
