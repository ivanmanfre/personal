-- outreach_templates: canonical, dashboard-editable store for the STATIC outreach copy
-- that today lives hardcoded in the n8n sender code nodes. Seeded VERBATIM from the live
-- nodes on 2026-07-22. live_synced=true means body matches what the sender ships today;
-- an edit flips it false (staged) until the gated n8n read-through wiring is applied.
create table if not exists outreach_templates (
  key text primary key,
  client_id text,                     -- null = Ivan's own lanes
  lane text not null,                 -- human lane label
  step text not null,                 -- connection_note | dm1 | dm2 | dm3 | inmail
  label text not null,
  body text not null,                 -- copy with {tokens} filled at send time
  subject text,                       -- InMail subject, null otherwise
  tokens jsonb not null default '[]', -- [{"token":"first","fills":"prospect first name"}]
  editable boolean not null default true,
  in_rotation boolean not null default true,
  source text,                        -- workflow id · node name
  live_synced boolean not null default true,
  notes text,
  updated_at timestamptz not null default now(),
  history jsonb not null default '[]'
);
alter table outreach_templates enable row level security; -- #allow-danger (new empty table, RLS lockdown)

create or replace function public.operator_outreach_templates(p_gate text, p_client_id text default null)
returns jsonb
language plpgsql stable security definer
set search_path to 'public', 'extensions'
as $fn$
declare
  v_rows jsonb;
  v_wired boolean;
begin
  if not operator_gate_ok(p_gate) then
    return jsonb_build_object('ok', false, 'error', 'bad_gate');
  end if;
  select exists (select 1 from integration_config where key = 'outreach_templates_wired' and value = 'true')
    into v_wired;
  select jsonb_agg(to_jsonb(t) order by t.lane, t.step, t.key) into v_rows
  from outreach_templates t
  where (p_client_id is null and t.client_id is null) or t.client_id = p_client_id;
  return jsonb_build_object('ok', true, 'wired', coalesce(v_wired, false), 'templates', coalesce(v_rows, '[]'::jsonb));
end;
$fn$;

create or replace function public.operator_edit_outreach_template(p_gate text, p_key text, p_body text)
returns jsonb
language plpgsql security definer
set search_path to 'public', 'extensions'
as $fn$
declare
  v_row outreach_templates%rowtype;
begin
  if not operator_gate_ok(p_gate) then
    return jsonb_build_object('ok', false, 'error', 'bad_gate');
  end if;
  select * into v_row from outreach_templates where key = p_key;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'unknown_template');
  end if;
  if not v_row.editable then
    return jsonb_build_object('ok', false, 'error', 'not_editable');
  end if;
  if p_body is null or length(trim(p_body)) < 10 then
    return jsonb_build_object('ok', false, 'error', 'body_too_short');
  end if;
  update outreach_templates
     set history = coalesce(history, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('at', now(), 'prev_body', body)),
         body = p_body,
         live_synced = false,
         updated_at = now()
   where key = p_key;
  return jsonb_build_object('ok', true, 'live_synced', false,
    'note', 'Saved. The sender still ships the previous copy until the n8n read-through wiring is applied.');
end;
$fn$;

create or replace function public.operator_outreach_lane_kpis(p_gate text, p_client_id text default null)
returns jsonb
language plpgsql stable security definer
set search_path to 'public', 'extensions'
as $fn$
declare
  v_lanes jsonb;
begin
  if not operator_gate_ok(p_gate) then
    return jsonb_build_object('ok', false, 'error', 'bad_gate');
  end if;
  select jsonb_agg(x order by (x->>'is_active') = 'true' desc, (x->>'sent')::int desc, x->>'name') into v_lanes
  from (
    select jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'is_active', coalesce(c.is_active, false),
      'lane_key', case
        when c.name ilike '%warm%' then 'warm'
        when c.name ilike '%orbit%' or c.name ilike '%engager%' then 'client-engager'
        when c.name ilike '%cold%' then 'pure-cold'
        else null
      end,
      'kpis', (
        select jsonb_build_object(
          'staged',      count(*) filter (where p.connection_sent_at is null and not coalesce(p.blacklisted, false)),
          'sent',        count(*) filter (where p.connection_sent_at is not null),
          'sent_mtd',    count(*) filter (where p.connection_sent_at >= date_trunc('month', now())),
          'sent_7d',     count(*) filter (where p.connection_sent_at >= now() - interval '7 days'),
          'accepted',    count(*) filter (where p.connected_at is not null),
          'accept_rate', case when count(*) filter (where p.connection_sent_at is not null) > 0
                              then round((count(*) filter (where p.connected_at is not null))::numeric
                                   / (count(*) filter (where p.connection_sent_at is not null)), 4) end,
          'dm1',         count(*) filter (where coalesce(p.dm_count, 0) >= 1),
          'dm2',         count(*) filter (where coalesce(p.dm_count, 0) >= 2),
          'replied',     count(*) filter (where coalesce(p.reply_count, 0) > 0),
          'reply_rate',  case when count(*) filter (where coalesce(p.dm_count, 0) >= 1) > 0
                              then round((count(*) filter (where coalesce(p.reply_count, 0) > 0))::numeric
                                   / (count(*) filter (where coalesce(p.dm_count, 0) >= 1)), 4) end,
          'needs_reply', count(*) filter (where coalesce(p.needs_manual_reply, false)),
          'last_send_at', greatest(max(p.connection_sent_at), max(p.last_dm_sent_at))
        )
        from outreach_prospects p where p.campaign_id = c.id
      )
    ) as x
    from outreach_campaigns c
    where ((p_client_id is null and c.client_id is null) or c.client_id = p_client_id)
      and coalesce(c.archived, false) = false
  ) s;
  return jsonb_build_object('ok', true, 'lanes', coalesce(v_lanes, '[]'::jsonb));
end;
$fn$;
