-- 2026-08-20 (Ivan): "the learner works over a baseline of old stuff i suppose.. it should self
-- improve". The learner only ever looked at a ROLLING 7-DAY window, so every manual DM Mattan
-- typed before ~08-13 was invisible to it forever: 107 mirrored sends on the seat, 3 facts.
--
-- Worse, the only idempotency check was `learned_facts.source_message_id`, which marks a message
-- ONLY when it produced a fact. Every message that produced nothing was re-judged on every hourly
-- run, which is why the runs measured 70-81s. This ledger marks a message the moment it has been
-- LOOKED AT, whatever the verdict, so the window can open to the full history without the cost
-- growing: the backlog drains once and each later run judges only genuinely new sends.
create table if not exists public.fact_learner_seen (
  message_id uuid primary key,
  client_id  text not null,
  verdict    text,
  seen_at    timestamptz not null default now()
);

create index if not exists fact_learner_seen_client_idx on public.fact_learner_seen (client_id);

alter table public.fact_learner_seen enable row level security;

drop policy if exists fact_learner_seen_service_all on public.fact_learner_seen;
create policy fact_learner_seen_service_all on public.fact_learner_seen
  for all to service_role using (true) with check (true);

-- The 3 facts already learned are, by definition, already looked at. Seed them so the first
-- full-history sweep does not pay to re-judge messages it has an answer for.
insert into public.fact_learner_seen (message_id, client_id, verdict, seen_at)
select source_message_id, client_id, 'learned', coalesce(resolved_at, created_at)
  from public.learned_facts
 where source_message_id is not null
on conflict (message_id) do nothing;
