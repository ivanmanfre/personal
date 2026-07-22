-- Email lane visibility (2026-07-22): seed the live Smartlead v2 sequence copy as
-- read-only template rows + a gated status RPC so the dashboard can show whether
-- the cold-email channel is actually moving.
insert into outreach_templates (key,client_id,lane,step,label,body,subject,tokens,editable,in_rotation,source,notes) values
('email_v2_step1', null, 'Email cold (Smartlead)', 'email1', 'Step 1: audit + wins',
 E'Hey {{first_name}} \U0001F642\n\nI ran an audit of your inbound potential off your LinkedIn, what''s there today and what we''d run for you:\n\n{{wins}}\n\nThat''s part of what my done-for-you inbound engine handles end to end.\n\nMay I send you your complete plan?\n\nIván',
 'your inbound audit',
 '[{"token":"first_name","fills":"lead first name (Smartlead merge field)"},{"token":"wins","fills":"3 grounded wins the feeder generates per lead (Opus, fail-closed)"},{"token":"company_name","fills":"lead company (NEVER {{company}}, renders empty)"}]'::jsonb,
 false, true, 'Smartlead campaign 3680738 · seq 1',
 'The copy of record lives IN SMARTLEAD (campaign 3680738), synced here 2026-07-22 for visibility. Edit it in Smartlead, or ask for Smartlead write-back wiring.'),
('email_v2_step2', null, 'Email cold (Smartlead)', 'email2', 'Step 2 (+3d, same thread): just say yes',
 E'Hey {{first_name}}, want the full plan for {{company_name}}? Just say yes and I''ll send it over.\n\nIván',
 '(no subject: threads on step 1)',
 '[{"token":"first_name","fills":"lead first name"},{"token":"company_name","fills":"lead company (NEVER {{company}})"}]'::jsonb,
 false, true, 'Smartlead campaign 3680738 · seq 2',
 'The copy of record lives IN SMARTLEAD (campaign 3680738), synced here 2026-07-22. The just-say-yes register is Ivan-ratified; "did any of that land" was rejected as an AI tell.')
on conflict (key) do nothing;

create or replace function public.operator_email_lane_status(p_gate text)
returns jsonb
language plpgsql stable security definer
set search_path to 'public', 'extensions'
as $fn$
declare
  v_campaign text;
  v_loaded_ever int; v_loaded_v2 int; v_loaded_7d int;
  v_unlocks jsonb; v_imports jsonb;
  v_last_feeder record;
  v_replies_30d int;
begin
  if not operator_gate_ok(p_gate) then
    return jsonb_build_object('ok', false, 'error', 'bad_gate');
  end if;
  select value into v_campaign from integration_config where key = 'smartlead_v2_campaign_id';
  select count(*) filter (where email_campaign_id is not null),
         count(*) filter (where email_campaign_id::text = v_campaign),
         count(*) filter (where email_loaded_at >= now() - interval '7 days')
    into v_loaded_ever, v_loaded_v2, v_loaded_7d
  from outreach_prospects;
  select value::jsonb into v_unlocks from integration_config where key = 'email_unlock_count';
  select value::jsonb into v_imports from integration_config where key = 'email_import_fires';
  select el.created_at, el.error_message into v_last_feeder
  from outreach_engagement_log el
  where el.error_message ilike '%skipped on personalization%'
  order by el.created_at desc limit 1;
  select count(*) into v_replies_30d
  from outreach_messages m
  where m.channel = 'email' and m.direction = 'inbound'
    and m.sent_at >= now() - interval '30 days';
  return jsonb_build_object(
    'ok', true,
    'campaign_id', v_campaign,
    'loaded_ever', v_loaded_ever,
    'loaded_v2', v_loaded_v2,
    'loaded_7d', v_loaded_7d,
    'unlocks_today', v_unlocks,
    'imports_today', v_imports,
    'replies_30d', v_replies_30d,
    'last_feeder_skip_at', v_last_feeder.created_at,
    'last_feeder_skip', left(coalesce(v_last_feeder.error_message, ''), 300)
  );
end;
$fn$;
