-- Run in an isolated test database after the migration; all probe rows roll back.
begin;
do $$
declare
  payload jsonb := '{"brand":"Test","brand_url":"https://swishdm-probe-1.example/","rival":"Rival","rival_url":null,"product":"Shoes","name":"Tester","email":"test@example.com","linkedin_url":null,"source":"form"}'::jsonb;
  answer text;
  i int;
begin
  answer := public.swishdm_scan_request_admit(payload);
  if answer <> 'accepted' then raise exception 'first admission: %', answer; end if;
  answer := public.swishdm_scan_request_admit(payload || '{"email":"other@example.com"}'::jsonb);
  if answer <> 'duplicate' then raise exception 'duplicate domain: %', answer; end if;
  answer := public.swishdm_scan_request_admit(jsonb_set(payload, '{brand_url}', '"https://www.swishdm-probe-1.example/"'));
  if answer <> 'duplicate' then raise exception 'www duplicate domain: %', answer; end if;
  for i in 2..15 loop
    answer := public.swishdm_scan_request_admit(jsonb_set(payload, '{brand_url}', to_jsonb('https://swishdm-probe-' || i || '.example/')));
    if answer <> 'accepted' then raise exception 'admission %: %', i, answer; end if;
  end loop;
  answer := public.swishdm_scan_request_admit(jsonb_set(payload, '{brand_url}', '"https://swishdm-probe-16.example/"'));
  if answer <> 'full' then raise exception 'rolling cap: %', answer; end if;
  if (select count(*) from public.swishdm_scan_requests where brand_domain like 'swishdm-probe-%') <> 15 then
    raise exception 'unexpected queued count';
  end if;
  if has_function_privilege('anon', 'public.swishdm_scan_request_admit(jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.swishdm_scan_request_admit(jsonb)', 'execute')
     or has_table_privilege('anon', 'public.swishdm_scan_requests', 'select')
     or has_table_privilege('authenticated', 'public.swishdm_scan_requests', 'insert') then
    raise exception 'public queue permission leaked';
  end if;
  update public.swishdm_scan_requests set created_at = now() - interval '8 days'
    where brand_domain = 'swishdm-probe-1.example';
  answer := public.swishdm_scan_request_admit(jsonb_set(payload, '{brand_url}', '"https://swishdm-probe-16.example/"'));
  if answer <> 'accepted' then raise exception 'rolling window did not release capacity: %', answer; end if;
end $$;
rollback;
