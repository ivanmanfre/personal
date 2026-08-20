-- 2026-08-20 (Ivan): "i dont want to have to approve fact changes just to see the draft on the dm
-- with a small context collapsed thing". The approval queue was scope I invented. These facts are
-- Mattan's OWN words, already sent to a prospect, so there is nothing for Ivan to authorise. They
-- go live on arrival; recency still governs; the Evidence collapsible is how a bad line gets caught.
create or replace function public.learn_fact(
  p_client_id text, p_topic text, p_fact text, p_message_id uuid, p_prospect_id uuid,
  p_prospect_name text, p_question text, p_quote text, p_reasoning text, p_sent_at timestamptz)
returns uuid
language plpgsql volatile security definer set search_path to 'public','extensions'
as $function$
declare v_id uuid;
begin
  insert into public.learned_facts (client_id, topic, fact_text, status, source_message_id,
      source_prospect_id, source_prospect_name, source_question, source_quote, source_reasoning,
      source_sent_at, resolved_at, resolved_by)
  values (p_client_id, p_topic, p_fact, 'approved', p_message_id, p_prospect_id, p_prospect_name,
      p_question, p_quote, p_reasoning, p_sent_at, now(), 'auto')
  on conflict (source_message_id) do nothing
  returning id into v_id;

  if v_id is null then return null; end if;

  -- Recency: an older answer on the same subject retires the moment a newer one lands. Guarded on
  -- source_sent_at, not insert order, because mirrored rows can be backfilled out of order.
  update public.learned_facts
     set status = 'superseded', superseded_by = v_id, resolved_at = now(), resolved_by = 'recency'
   where client_id = p_client_id and topic = p_topic and status = 'approved'
     and id <> v_id and source_sent_at <= p_sent_at;

  return v_id;
end;
$function$;

grant execute on function public.learn_fact(text,text,text,uuid,uuid,text,text,text,text,timestamptz) to service_role;

-- The 3 already queued are Mattan's real sent words. Nothing to approve; make them live, newest
-- per topic only.
update public.learned_facts set status = 'approved', resolved_at = now(), resolved_by = 'auto'
 where status = 'pending';
