-- 2026-08-20 (Ivan: "make sure it uses reasoning ... this is the best thing we can get for precision").
-- The Railway proxy SILENTLY IGNORES the `thinking` param (probed: accepts it, returns only a text
-- block, no thinking block, usage 0/0). So extended thinking there is a no-op. Real reasoning is
-- instead forced into the OUTPUT: the judge must write its reasoning BEFORE it decides, and we store
-- it so Ivan can read why a fact was proposed and reject a bad inference on sight.
alter table public.learned_facts add column if not exists source_reasoning text;

comment on column public.learned_facts.source_reasoning is
  'The judge''s stated reasoning, written before its verdict. Shown in the Client Ops review strip so a bad inference is visible, not just its conclusion.';
create or replace function public.operator_learned_facts(p_gate text, p_client_id text)
returns jsonb
language plpgsql stable security definer set search_path to 'public','extensions'
as $function$
declare v jsonb;
begin
  if not operator_gate_ok(p_gate) then
    return jsonb_build_object('ok', false, 'error', 'bad_gate');
  end if;
  select jsonb_agg(x order by (x->>'status') = 'pending' desc, (x->>'source_sent_at') desc) into v
  from (
    select jsonb_build_object(
      'id', f.id, 'topic', f.topic, 'fact_text', f.fact_text, 'status', f.status,
      'prospect_name', f.source_prospect_name, 'question', f.source_question,
      'quote', f.source_quote,
      -- Why the judge proposed it, written before its verdict. Ivan reads this to reject a bad
      -- inference on sight instead of trusting a confident one-line conclusion.
      'reasoning', f.source_reasoning,
      'source_sent_at', f.source_sent_at, 'chat_url', p.linkedin_url
    ) as x
    from public.learned_facts f
    left join public.outreach_prospects p on p.id = f.source_prospect_id
    where f.client_id = p_client_id and f.status in ('pending','approved')
    order by f.source_sent_at desc limit 30
  ) s;
  return jsonb_build_object('ok', true, 'facts', coalesce(v, '[]'::jsonb));
end;
$function$;
