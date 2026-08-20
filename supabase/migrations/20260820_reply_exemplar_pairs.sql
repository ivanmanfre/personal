-- 2026-08-20 — Exemplar harvest paired replies against the PRECEDING INBOUND using
-- i.created_at < m.sent_at: insert time compared against send time. manual_mirror rows are
-- backfilled in batches, so created_at ordering inside a batch is arbitrary. Live proof
-- (Jeremy Karp, 2026-08-20): inbound "What is the minimum spend?" sent 03:10:56 / created
-- 03:15:55.714; reply "No minimums on spend..." sent 03:12:42 / created 03:15:55.446. The
-- inbound's created_at is 0.27s AFTER the reply's, so the query walked back six days and taught
-- the corpus that "Please do." is answered with a minimum-spend rebuttal. 2 of 8 pairs were wrong.
--
-- Fix: pair on coalesce(sent_at, created_at), and expose the pairs as a function so the prompt
-- blob and the drafter's recorded evidence derive from ONE query and cannot drift.

create or replace function public.reply_exemplar_pairs(p_client_id text, p_limit int default 8)
returns table (
  message_id    uuid,
  prospect_id   uuid,
  prospect_name text,
  their         text,
  reply         text,
  sent_at       timestamptz
)
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $$
  select
    m.id,
    p.id,
    p.name,
    left(regexp_replace(i.message_text, E'\\s+', ' ', 'g'), 350),
    left(regexp_replace(m.message_text, E'\\s+', ' ', 'g'), 400),
    m.sent_at
  from outreach_messages m
  join outreach_prospects p on p.id = m.prospect_id
  join outreach_campaigns c on c.id = p.campaign_id
  left join lateral (
    select i2.message_text
    from outreach_messages i2
    where i2.prospect_id = m.prospect_id
      and i2.direction = 'inbound'
      and coalesce(i2.is_reaction, false) = false
      and coalesce(i2.sent_at, i2.created_at) < m.sent_at
    order by coalesce(i2.sent_at, i2.created_at) desc
    limit 1
  ) i on true
  where m.ai_model = 'manual_mirror'
    and m.direction = 'outbound'
    and m.sent_at is not null
    and m.sent_at > now() - interval '45 days'
    and coalesce(c.client_id, 'ivan') = p_client_id
    and i.message_text is not null
    and length(i.message_text) > 5
  order by m.sent_at desc
  limit p_limit;
$$;

grant execute on function public.reply_exemplar_pairs(text, int) to service_role, authenticated;

-- Rebuild the harvester on top of that one source. Header wording updated because facts now come
-- from RISE FACTS *and* the VERIFIED RECENT ANSWERS block (learned_facts), not company-facts alone.
create or replace function public.refresh_reply_exemplars()
returns void
language plpgsql
security definer
as $function$
declare
  rec  record;
  body text;
  who  text;
begin
  for rec in select unnest(array['ivan','risedtc']) as client_id loop
    who := case rec.client_id when 'ivan' then 'IVAN' else 'MATTAN' end;

    select 'REAL RECENT REPLIES ' || who || ' SENT MANUALLY on LinkedIn (auto-harvested daily from '
        || 'mirrored sends). Mirror the JUDGMENT, register, and length of these; never copy one '
        || 'verbatim; any factual claim still comes ONLY from the facts sections.' || E'\n'
        || coalesce(string_agg(E'\nTHEY: ' || pair.their || E'\nREPLY: ' || pair.reply,
                               E'\n' order by pair.sent_at desc), '')
      into body
      from reply_exemplar_pairs(rec.client_id, 8) pair;

    if body is not null and length(body) > 250 then
      insert into content_prompts (slug, title, body, is_active)
      values (case rec.client_id when 'ivan' then 'ivan-reply-exemplars' else 'rise-reply-exemplars' end,
              'Auto-harvested manual reply exemplars', body, true)
      on conflict (slug) do update set body = excluded.body, is_active = true;
    end if;
  end loop;
end;
$function$;
