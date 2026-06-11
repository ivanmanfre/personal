-- Per-item seen watermark (replaces the single notification_state row).
create table if not exists public.notification_seen (
  item_key text primary key,
  seen_at timestamptz not null default now()
);
alter table public.notification_seen enable row level security;
drop policy if exists notification_seen_rw on public.notification_seen;
create policy notification_seen_rw on public.notification_seen for all using (true) with check (true);

-- Muted categories.
create table if not exists public.notification_muted_categories (
  category text primary key,
  muted_at timestamptz not null default now()
);
alter table public.notification_muted_categories enable row level security;
drop policy if exists notif_mute_rw on public.notification_muted_categories;
create policy notif_mute_rw on public.notification_muted_categories for all using (true) with check (true);

-- mark_pending_seen: upsert seen_at=now for a set of keys (backs all seen buttons).
create or replace function public.mark_pending_seen(p_keys text[])
returns void language sql security definer set search_path = public as $$
  insert into public.notification_seen (item_key, seen_at)
  select unnest(p_keys), now()
  on conflict (item_key) do update set seen_at = now();
$$;
grant execute on function public.mark_pending_seen(text[]) to anon, authenticated;

create or replace function public.mute_category(p_category text)
returns void language sql security definer set search_path = public as $$
  insert into public.notification_muted_categories (category) values (p_category)
  on conflict (category) do nothing;
$$;
grant execute on function public.mute_category(text) to anon, authenticated;

create or replace function public.unmute_category(p_category text)
returns void language sql security definer set search_path = public as $$
  delete from public.notification_muted_categories where category = p_category;
$$;
grant execute on function public.unmute_category(text) to anon, authenticated;

-- get_pending_actions v2: add `unread` (created_at > seen_at), exclude muted categories.
-- stuck_automation (dashboard_workflow_stats) now keys on dws.id so inline-ack can
-- resolve it; overdue crons keep the 'overdue:' prefix (navigate-only).
-- Return-type changes (added `unread`) require dropping the v1 function first.
drop function if exists public.get_pending_actions();
create or replace function public.get_pending_actions()
returns table (
  category text, item_key text, title text, subtitle text,
  severity text, deeplink text, created_at timestamptz, unread boolean
)
language sql stable security definer set search_path = public as $$
  with feed as (
    select 'skill_draft' as category, 'skill_draft:'||sd.id::text as item_key,
           sd.skill_name as title, left(coalesce(sd.rationale,''),100) as subtitle,
           'tier3' as severity, '?section=ops&sub=skills' as deeplink, sd.created_at as created_at
    from skill_drafts sd
    where sd.status='pending' and sd.kind <> 'prune_candidate'
    union all
    select 'memory_proposal','memory_proposal:'||cm.id::text,
           'Memory cleanup — '||coalesce(cm.client_id,'tier'),'Pending prune proposals',
           'tier3','?section=knowledge&sub=brain', cm.updated_at
    from claude_memory cm where cm.file_path like '%\_compaction-review.md'
    union all
    select 'scheduled_check','scheduled_check:'||scs.id::text, scs.title, coalesce(scs.detail,''),
           'tier1','?section=ops&sub=checks',(scs.due_date)::timestamptz
    from scheduled_checks_status scs where scs.state='due'
    union all
    select 'stuck_automation','stuck_automation:'||dws.id::text, dws.workflow_name,
           left(coalesce(dws.last_error_message,'error'),100),
           'tier1','?section=ops&sub=scheduled-ops', dws.last_execution_at
    from dashboard_workflow_stats dws
    where dws.last_execution_status='error' and dws.error_acknowledged = false and dws.is_active = true
    union all
    select 'stuck_automation','overdue:'||sjr.job_key, sjr.label,
           'Overdue — no run within expected interval','tier1','?section=ops&sub=scheduled-ops', sjr.last_synced_at
    from scheduled_job_registry sjr
    where sjr.enabled = true and sjr.last_synced_at is not null
      and sjr.last_synced_at < now() - ((coalesce(sjr.expected_interval_minutes,60)+coalesce(sjr.grace_minutes,0)) * interval '1 minute')
    union all
    select 'carousel_review','carousel_review:'||cd.id::text, coalesce(cd.title, cd.topic, 'Untitled post'),
           'Post awaiting review','tier2','?section=content&sub=posts', cd.created_at
    from carousel_drafts cd where cd.status='review'
    union all
    select 'lm_review','lm_review:'||lm.id::text, coalesce(lm.topic, lm.slug, 'Untitled LM'),
           'Lead magnet awaiting review','tier2','?section=content&sub=lead-magnets', lm.created_at
    from lm_drafts_v2 lm where lm.status='lm_review'
    union all
    select 'prospect_reply','prospect_reply:'||op.id::text, coalesce(op.name,'Unknown prospect'),
           coalesce(op.company,''),'tier1','?section=reach&otab=inbox', coalesce(op.last_reply_at, op.updated_at)
    from outreach_prospects op
    where op.stage='replied' and op.needs_manual_reply = true and op.blacklisted is not true
    union all
    select 'paid_intake','paid_intake:'||pa.id::text, coalesce(pa.name, pa.email, 'Paid assessment'),
           'Day-2 deliverable pending','tier1','?section=clients', pa.paid_at
    from paid_assessments pa
    where pa.status='paid' and pa.day2_completed_at is null and pa.is_test is not true
    union all
    select 'upwork_proposal','upwork_proposal:'||up.id::text,
           'Upwork proposal'||coalesce(' ('||up.rate_amount::text||' '||up.rate_type||')',''),
           'Awaiting your approval','tier3','?section=reach&otab=upwork', up.created_at
    from upwork_proposals up where up.status='pending_approval'
    union all
    select 'call_clip','call_clip:'||vs.id::text, coalesce(vs.title, vs.hook_line, 'Call clip'),
           'Clip awaiting review','tier2','?section=content&sub=clips', vs.created_at
    from video_shorts vs where vs.source_type='call_recording' and vs.status='pending'
    union all
    select 'crm_action_due','crm_action_due:'||c.id::text, coalesce(c.name,'Contact'),
           coalesce(c.next_action,'Action due'),'tier2','?section=clients',(c.next_action_due)::timestamptz
    from contacts c
    where c.next_action_due is not null and c.next_action_due <= current_date and c.merged_into is null
    union all
    select 'dashboard_task','dashboard_task:'||dt.id::text, coalesce(dt.title,'Task'),
           coalesce(dt.status,''),'tier3','?section=ops&sub=tasks', dt.created_at
    from dashboard_tasks dt where dt.status in ('pending','open')
  )
  select f.category, f.item_key, f.title, f.subtitle, f.severity, f.deeplink, f.created_at,
         (f.created_at > coalesce(ns.seen_at, '1970-01-01'::timestamptz)) as unread
  from feed f
  left join notification_seen ns on ns.item_key = f.item_key
  where f.category not in (select category from notification_muted_categories);
$$;
grant execute on function public.get_pending_actions() to anon, authenticated;

drop table if exists public.notification_state;
