# CRM Spine — Phase 1 (Spine + Visibility) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a CRM tab where you click a person and see their whole arc (outreach + DMs + leads + manually-attached proposals/meetings/assessments), with writable stage/notes/next-action — built on a thin canonical `contacts` spine that links live to source tables.

**Architecture:** Two new Supabase tables (`contacts`, `contact_links`) hold identity + CRM fields only. A Postgres `resolve_contacts()` function auto-links the two clean LinkedIn-keyed sources (`outreach_prospects`, `leads`) and queues fuzzy matches for review. A `get_contact_360()` function fans out live to source tables. A new `CrmPanel` React sub-tab renders a list + inline 360° record. Heavy source data is never copied.

**Tech Stack:** Supabase Postgres (pg_trgm), Supabase RPC functions, n8n schedule trigger, React + TypeScript + `@supabase/supabase-js`, existing `lib/dashboardActions` write pattern, Playwright (`dashboard` profile) for UI verification.

**Spec:** `docs/superpowers/specs/2026-06-04-crm-spine-design.md`

---

## Verification approach (read first)

This repo has **no JS test runner** (package.json has only `dev`/`build`/`prerender`). Do **not** add vitest/jest — it's against the codebase grain. Verification per task uses:
- **SQL assertions** — run a query via the Supabase MCP `execute_sql` (project `bjbvqvzbzczjbatgmccb`) or the SQL editor; assert row counts / shape.
- **Edge/RPC smoke** — call the RPC via `supabase.rpc(...)` from a throwaway `node --input-type=module` snippet or the SQL editor.
- **Playwright** — use the `playwright-driver` skill with the `dashboard` profile to screenshot the CRM tab and confirm render (per the "test visual work yourself" rule).

Migrations are applied to the **remote** project (no local stack) via the Supabase MCP `apply_migration` tool (or SQL editor). Commit the `.sql` file to the repo as the source of truth either way.

## Git hazard (read first)

personal-site has a live automation that commits to `main` and switches branches. **Do all work in an isolated git worktree** (`superpowers:using-git-worktrees`), branch `feat/crm-spine`, and push via refspec. Never edit/commit on the shared main tree.

## File structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20260604_crm_spine.sql` | tables, indexes, `updated_at` trigger, pg_trgm |
| `supabase/migrations/20260604_crm_resolver.sql` | `resolve_contacts()` + `merge_contacts()` functions |
| `supabase/migrations/20260604_crm_360.sql` | `get_contact_360(uuid)` function |
| `hooks/useContacts.ts` | list fetch, filters, CRM-field mutations, resolve-now, review actions |
| `hooks/useContact360.ts` | single-record 360° fetch |
| `components/dashboard/crm/CrmPanel.tsx` | two-pane shell + list pane |
| `components/dashboard/crm/ContactRecord.tsx` | inline 360° record (timeline, CRM fields, sources, attach) |
| `components/dashboard/crm/ReviewQueueStrip.tsx` | pending-match confirm/reject strip |
| `components/dashboard/crm/crmTypes.ts` | shared TS types |
| `components/dashboard-v2/sections/ReachPipeline.tsx` | add `crm` sub-tab (modify) |
| `types/dashboard.ts` | add `Contact`, `ContactLink`, `Contact360` (modify) |

---

## Task 1: Spine tables migration

**Files:**
- Create: `supabase/migrations/20260604_crm_spine.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 20260604_crm_spine.sql  — CRM spine tables
create extension if not exists pg_trgm;

create table if not exists contacts (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  company         text,
  linkedin_url    text,
  email           text,
  icp_score       int,
  stage           text not null default 'new',
  next_action     text,
  next_action_due date,
  owner_notes     text,
  referred_by     uuid references contacts(id),
  merged_into     uuid references contacts(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists contacts_linkedin_uniq
  on contacts (linkedin_url) where linkedin_url is not null and merged_into is null;
create index if not exists contacts_email_idx on contacts (lower(email));
create index if not exists contacts_stage_idx on contacts (stage);
create index if not exists contacts_next_due_idx on contacts (next_action_due);
create index if not exists contacts_merged_idx on contacts (merged_into);
create index if not exists contacts_name_trgm on contacts using gin (name gin_trgm_ops);

create table if not exists contact_links (
  id            uuid primary key default gen_random_uuid(),
  contact_id    uuid not null references contacts(id) on delete cascade,
  source_type   text not null,
  source_id     text not null,
  source_ref    jsonb,
  linked_by     text not null default 'resolver',
  confidence    text not null default 'exact',
  review_status text not null default 'active',
  created_at    timestamptz not null default now()
);
-- a source row belongs to exactly one (non-rejected) contact
create unique index if not exists contact_links_source_uniq
  on contact_links (source_type, source_id) where review_status <> 'rejected';
create index if not exists contact_links_contact_idx on contact_links (contact_id);
create index if not exists contact_links_pending_idx on contact_links (review_status) where review_status = 'pending';

create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;

drop trigger if exists contacts_updated_at on contacts;
create trigger contacts_updated_at before update on contacts
  for each row execute function set_updated_at();

-- RLS: match dashboard posture of leads/outreach_prospects (service-role + anon read via dashboard).
alter table contacts enable row level security;
alter table contact_links enable row level security;
-- Mirror existing dashboard tables' policies. Inspect leads' policy first:
--   select polname, cmd, qual from pg_policies where tablename='leads';
-- then create equivalent policies for contacts/contact_links (anon select, service_role all).
```

- [ ] **Step 2: Inspect the existing `leads` RLS policy so the new tables match**

Run (Supabase MCP `execute_sql`, project `bjbvqvzbzczjbatgmccb`):
```sql
select tablename, polname, cmd, roles, qual, with_check
from pg_policies where tablename in ('leads','outreach_prospects') order by tablename, polname;
```
Expected: a set of policies (likely `anon`/`authenticated` select + `service_role` all). Append matching `create policy` statements for `contacts` and `contact_links` to the migration file before applying. If `leads` has RLS **disabled**, instead `alter table contacts disable row level security;` to match (do not invent a stricter posture than the sibling tables).

- [ ] **Step 3: Apply the migration**

Apply via Supabase MCP `apply_migration` (name `crm_spine`, the file contents). 

- [ ] **Step 4: Verify tables + extension exist**

Run:
```sql
select to_regclass('public.contacts') as contacts,
       to_regclass('public.contact_links') as links,
       exists(select 1 from pg_extension where extname='pg_trgm') as trgm;
```
Expected: both regclasses non-null, `trgm = true`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260604_crm_spine.sql
git commit -m "feat(crm): spine tables — contacts + contact_links"
```

---

## Task 2: Resolver function

**Files:**
- Create: `supabase/migrations/20260604_crm_resolver.sql`

- [ ] **Step 1: Write `resolve_contacts()` + `merge_contacts()`**

```sql
-- 20260604_crm_resolver.sql
-- Resolves UNLINKED rows from the two clean LinkedIn-keyed sources into contacts.
-- Cascade: exact linkedin_url -> exact email -> fuzzy name (PENDING, not auto-linked) -> new contact.
-- Phase 1 sources only: outreach_prospect, lead. Returns counts for the n8n driver.

create or replace function resolve_contacts()
returns jsonb language plpgsql as $$
declare
  rec record;
  v_contact uuid;
  v_created int := 0; v_linked int := 0; v_pending int := 0;
  src text; sid text; s_name text; s_li text; s_email text; s_company text; s_icp int;
begin
  for rec in
    -- outreach_prospects (has linkedin + email + company + icp)
    select 'outreach_prospect'::text as source_type, p.id::text as source_id,
           p.name, p.linkedin_url, p.email, p.company, p.icp_score,
           jsonb_build_object('stage', p.stage) as source_ref
    from outreach_prospects p
    where not exists (select 1 from contact_links cl
                      where cl.source_type='outreach_prospect' and cl.source_id=p.id::text
                        and cl.review_status <> 'rejected')
    union all
    -- leads (linkedin + company + icp; NO email column)
    select 'lead', l.id::text, l.name, l.linkedin_url, null::text, l.company, l.icp_score,
           jsonb_build_object('engagement_type', l.engagement_type)
    from leads l
    where not exists (select 1 from contact_links cl
                      where cl.source_type='lead' and cl.source_id=l.id::text
                        and cl.review_status <> 'rejected')
  loop
    src := rec.source_type; sid := rec.source_id; s_name := rec.name;
    s_li := nullif(trim(rec.linkedin_url),''); s_email := nullif(lower(trim(rec.email)),'');
    s_company := rec.company; s_icp := rec.icp_score;
    v_contact := null;

    -- 1. exact linkedin_url
    if s_li is not null then
      select id into v_contact from contacts
      where linkedin_url = s_li and merged_into is null limit 1;
    end if;
    -- 2. exact email
    if v_contact is null and s_email is not null then
      select id into v_contact from contacts
      where lower(email) = s_email and merged_into is null limit 1;
    end if;

    if v_contact is not null then
      insert into contact_links(contact_id, source_type, source_id, source_ref, linked_by, confidence, review_status)
      values (v_contact, src, sid, rec.source_ref, 'resolver', 'exact', 'active');
      -- backfill identity gaps on the contact (never overwrite non-null)
      update contacts set
        email = coalesce(email, s_email),
        linkedin_url = coalesce(linkedin_url, s_li),
        company = coalesce(company, s_company),
        icp_score = greatest(coalesce(icp_score, -1), coalesce(s_icp, -1)),
        name = coalesce(nullif(name,''), s_name)
      where id = v_contact;
      v_linked := v_linked + 1;
      continue;
    end if;

    -- 3. fuzzy name -> PENDING review link (only if a candidate exists)
    if s_name is not null then
      select id into v_contact from contacts
      where merged_into is null
        and similarity(name, s_name) >= 0.55
        and (s_company is null or company is null
             or similarity(coalesce(company,''), s_company) >= 0.4)
      order by similarity(name, s_name) desc limit 1;
      if v_contact is not null then
        insert into contact_links(contact_id, source_type, source_id, source_ref, linked_by, confidence, review_status)
        values (v_contact, src, sid, rec.source_ref, 'resolver', 'fuzzy', 'pending');
        v_pending := v_pending + 1;
        continue;
      end if;
    end if;

    -- 4. new contact
    insert into contacts(name, company, linkedin_url, email, icp_score, stage)
    values (coalesce(nullif(s_name,''),'(unknown)'), s_company, s_li, s_email, s_icp, 'new')
    returning id into v_contact;
    insert into contact_links(contact_id, source_type, source_id, source_ref, linked_by, confidence, review_status)
    values (v_contact, src, sid, rec.source_ref, 'resolver', 'exact', 'active');
    v_created := v_created + 1;
  end loop;

  return jsonb_build_object('created', v_created, 'linked', v_linked, 'pending', v_pending);
end; $$;

-- Merge contact b into contact a: re-point links, fill gaps, soft-delete b.
create or replace function merge_contacts(a uuid, b uuid)
returns void language plpgsql as $$
begin
  update contact_links set contact_id = a where contact_id = b;
  update contacts set
    email = coalesce((select email from contacts where id=a), (select email from contacts where id=b)),
    company = coalesce((select company from contacts where id=a), (select company from contacts where id=b)),
    linkedin_url = coalesce((select linkedin_url from contacts where id=a), (select linkedin_url from contacts where id=b)),
    owner_notes = coalesce((select owner_notes from contacts where id=a), (select owner_notes from contacts where id=b))
  where id = a;
  update contacts set merged_into = a where id = b;
end; $$;
```

- [ ] **Step 2: Apply the migration**

Apply via Supabase MCP `apply_migration` (name `crm_resolver`).

- [ ] **Step 3: Verify idempotency + merge — seed assertion**

Run this self-contained assertion (creates two temp source rows with the SAME linkedin, resolves, asserts ONE contact + TWO active links, then asserts a second run adds nothing):
```sql
-- pick a real prospect+lead sharing a linkedin_url if one exists, else inspect counts:
select resolve_contacts();                      -- first run
select resolve_contacts();                      -- second run must be all-zero
-- a person present in BOTH outreach_prospects and leads collapses to one contact:
select c.id, c.name, count(*) links
from contacts c join contact_links cl on cl.contact_id=c.id
group by c.id, c.name having count(*) > 1 order by links desc limit 5;
```
Expected: second `resolve_contacts()` returns `{"created":0,"linked":0,"pending":0}`; the `having count(*)>1` query shows at least the known dual-source people (e.g. anyone who is both a lead and a prospect) as a single contact with ≥2 links. If zero multi-link contacts appear, confirm by checking overlap: `select count(*) from leads l join outreach_prospects p on p.linkedin_url=l.linkedin_url;`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260604_crm_resolver.sql
git commit -m "feat(crm): resolve_contacts + merge_contacts functions"
```

---

## Task 3: 360° fetch function

**Files:**
- Create: `supabase/migrations/20260604_crm_360.sql`

- [ ] **Step 1: Write `get_contact_360(uuid)`**

Returns the contact, its active links, and a live unified timeline. Phase 1 timeline sources: outreach prospect touches + DMs (`outreach_messages` via the prospect link) + lead created event. Manually-attached transcript/proposal/assessment links appear as source chips (their deep data fetched by the panel on expand).

```sql
-- 20260604_crm_360.sql
create or replace function get_contact_360(p_contact uuid)
returns jsonb language plpgsql stable as $$
declare
  v_contact jsonb;
  v_links jsonb;
  v_timeline jsonb;
begin
  select to_jsonb(c.*) into v_contact from contacts c where c.id = p_contact;
  if v_contact is null then return null; end if;

  select coalesce(jsonb_agg(to_jsonb(cl.*) order by cl.created_at), '[]'::jsonb)
    into v_links
  from contact_links cl
  where cl.contact_id = p_contact and cl.review_status = 'active';

  with prospect_ids as (
    select source_id::uuid as id from contact_links
    where contact_id = p_contact and source_type='outreach_prospect' and review_status='active'
  ),
  events as (
    -- DM thread
    select m.sent_at as ts, 'dm' as kind,
           jsonb_build_object('direction', m.direction, 'text', m.message_text) as data
    from outreach_messages m where m.prospect_id in (select id from prospect_ids)
    union all
    -- prospect created / stage
    select p.created_at, 'outreach_added',
           jsonb_build_object('campaign', p.campaign_id, 'stage', p.stage)
    from outreach_prospects p where p.id in (select id from prospect_ids)
    union all
    -- lead created
    select l.created_at, 'lead_added',
           jsonb_build_object('engagement_type', l.engagement_type)
    from leads l
    where l.id::text in (select source_id from contact_links
                         where contact_id=p_contact and source_type='lead' and review_status='active')
  )
  select coalesce(jsonb_agg(jsonb_build_object('ts', ts, 'kind', kind, 'data', data)
                            order by ts desc), '[]'::jsonb)
    into v_timeline from events where ts is not null;

  return jsonb_build_object('contact', v_contact, 'links', v_links, 'timeline', v_timeline);
end; $$;
```

> Note: confirm the `outreach_messages` timestamp column name (`sent_at` vs `sentAt`/`created_at`) against the table before applying — the resolver inventory flagged inconsistent casing. Adjust the `m.sent_at` reference to the real column.

- [ ] **Step 2: Apply + verify shape**

Apply via `apply_migration` (name `crm_360`). Then:
```sql
select jsonb_pretty(get_contact_360((select id from contacts order by created_at desc limit 1)));
```
Expected: JSON with `contact`, `links` (array), `timeline` (array, newest-first). For a contact linked to a prospect that has DMs, timeline includes `kind:"dm"` rows.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260604_crm_360.sql
git commit -m "feat(crm): get_contact_360 live fan-out function"
```

---

## Task 4: Resolver driver (n8n schedule + Resolve-now)

**Files:**
- n8n workflow (created via n8n REST / n8n-mcp): "CRM Resolver"

- [ ] **Step 1: Create the workflow**

Schedule Trigger (every 30 min) → Supabase RPC call `resolve_contacts` (HTTP POST `${SUPABASE_URL}/rest/v1/rpc/resolve_contacts`, headers `apikey`/`Authorization: Bearer <service_role>`) → IF error → notify node (WhatsApp via Whapi, per house rule — not Telegram). Keep it ≤5 nodes; no Code node (avoid the Code-node traps). Use the existing Supabase service-role credential.

- [ ] **Step 2: Manual-execute the workflow once**

Trigger a manual run. Expected: HTTP 200, body `{created, linked, pending}` matching a fresh `select resolve_contacts();`. No error branch fired.

- [ ] **Step 3: Verify the schedule is active**

Confirm the workflow is published/active and the Schedule Trigger shows a next-run time. (Use the `n8n-execs` skill to confirm it appears in recent/scheduled.)

- [ ] **Step 4: Note the workflow id**

Record the workflow id in the spec's risks section / project memory `workflows.md`. No code commit (n8n lives outside the repo).

---

## Task 5: Types + `useContacts` hook

**Files:**
- Modify: `types/dashboard.ts` (add types)
- Create: `components/dashboard/crm/crmTypes.ts` (re-export + view types)
- Create: `hooks/useContacts.ts`

- [ ] **Step 1: Add core types to `types/dashboard.ts`**

```ts
export interface Contact {
  id: string; name: string; company: string | null;
  linkedinUrl: string | null; email: string | null;
  icpScore: number | null; stage: string;
  nextAction: string | null; nextActionDue: string | null;
  ownerNotes: string | null; referredBy: string | null;
  createdAt: string; updatedAt: string;
}
export interface ContactLink {
  id: string; contactId: string; sourceType: string; sourceId: string;
  sourceRef: Record<string, unknown> | null; linkedBy: string;
  confidence: string; reviewStatus: 'active' | 'pending' | 'rejected'; createdAt: string;
}
export interface TimelineEvent { ts: string; kind: string; data: Record<string, unknown>; }
export interface Contact360 { contact: Contact; links: ContactLink[]; timeline: TimelineEvent[]; }
```

- [ ] **Step 2: Write the hook** (`hooks/useContacts.ts`)

```ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { dashboardAction, toastError, toastSuccess } from '../lib/dashboardActions';
import type { Contact, ContactLink } from '../types/dashboard';

const mapContact = (r: any): Contact => ({
  id: r.id, name: r.name, company: r.company,
  linkedinUrl: r.linkedin_url, email: r.email, icpScore: r.icp_score,
  stage: r.stage, nextAction: r.next_action, nextActionDue: r.next_action_due,
  ownerNotes: r.owner_notes, referredBy: r.referred_by,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [pending, setPending] = useState<ContactLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: cs }, { data: pl }] = await Promise.all([
        supabase.from('contacts').select('*').is('merged_into', null)
          .order('next_action_due', { ascending: true, nullsFirst: false }).limit(500),
        supabase.from('contact_links').select('*').eq('review_status', 'pending'),
      ]);
      setContacts((cs || []).map(mapContact));
      setPending((pl || []).map((r: any): ContactLink => ({
        id: r.id, contactId: r.contact_id, sourceType: r.source_type, sourceId: r.source_id,
        sourceRef: r.source_ref, linkedBy: r.linked_by, confidence: r.confidence,
        reviewStatus: r.review_status, createdAt: r.created_at,
      })));
    } catch (err) { toastError('load contacts', err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const resolveNow = useCallback(async () => {
    setResolving(true);
    try {
      const { data, error } = await supabase.rpc('resolve_contacts');
      if (error) throw error;
      toastSuccess(`Resolver: +${data?.created ?? 0} new, ${data?.linked ?? 0} linked, ${data?.pending ?? 0} to review`);
      await fetchAll();
    } catch (err) { toastError('resolve contacts', err); }
    finally { setResolving(false); }
  }, [fetchAll]);

  const updateField = useCallback(async (id: string, field: keyof Contact, value: string) => {
    const col = ({ stage:'stage', nextAction:'next_action', nextActionDue:'next_action_due',
                   ownerNotes:'owner_notes' } as Record<string,string>)[field];
    if (!col) return;
    setContacts(cs => cs.map(c => c.id === id ? { ...c, [field]: value } as Contact : c)); // optimistic
    try { await dashboardAction('contacts', id, col, value); }
    catch (err) { toastError('update contact', err); fetchAll(); }
  }, [fetchAll]);

  const reviewLink = useCallback(async (linkId: string, decision: 'confirm' | 'reject') => {
    const patch = decision === 'confirm'
      ? { review_status: 'active', confidence: 'confirmed' }
      : { review_status: 'rejected' };
    setPending(p => p.filter(l => l.id !== linkId)); // optimistic
    try {
      const { error } = await supabase.from('contact_links').update(patch).eq('id', linkId);
      if (error) throw error;
      if (decision === 'confirm') await fetchAll();
    } catch (err) { toastError('review match', err); fetchAll(); }
  }, [fetchAll]);

  const stageCounts = useMemo(() => contacts.reduce((a, c) => {
    a[c.stage] = (a[c.stage] || 0) + 1; return a;
  }, {} as Record<string, number>), [contacts]);

  return { contacts, pending, loading, resolving, resolveNow, updateField, reviewLink, stageCounts, refetch: fetchAll };
}
```

- [ ] **Step 3: Type-check**

Run: `cd <worktree> && npx tsc --noEmit`
Expected: no errors in `useContacts.ts` / `types/dashboard.ts`. (Pre-existing repo errors elsewhere, if any, are out of scope — confirm none are in the new files.)

- [ ] **Step 4: Commit**

```bash
git add types/dashboard.ts hooks/useContacts.ts components/dashboard/crm/crmTypes.ts
git commit -m "feat(crm): Contact types + useContacts hook (list, resolve, review, write)"
```

---

## Task 6: 360° fetch hook

**Files:**
- Create: `hooks/useContact360.ts`

- [ ] **Step 1: Write the hook**

```ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { toastError } from '../lib/dashboardActions';
import type { Contact360 } from '../types/dashboard';

export function useContact360(contactId: string | null) {
  const [data, setData] = useState<Contact360 | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!contactId) { setData(null); return; }
    setLoading(true);
    try {
      const { data: res, error } = await supabase.rpc('get_contact_360', { p_contact: contactId });
      if (error) throw error;
      setData(res as Contact360);
    } catch (err) { toastError('load contact record', err); }
    finally { setLoading(false); }
  }, [contactId]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, refetch: fetch };
}
```

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc --noEmit` → no errors in the new file.
```bash
git add hooks/useContact360.ts
git commit -m "feat(crm): useContact360 hook"
```

---

## Task 7: CRM panel — two-pane shell + list

**Files:**
- Create: `components/dashboard/crm/CrmPanel.tsx`
- Create: `components/dashboard/crm/ReviewQueueStrip.tsx`

- [ ] **Step 1: ReviewQueueStrip**

```tsx
import React from 'react';
import type { ContactLink } from '../../../types/dashboard';

export function ReviewQueueStrip({ pending, onReview }: {
  pending: ContactLink[];
  onReview: (linkId: string, d: 'confirm' | 'reject') => void;
}) {
  if (!pending.length) return null;
  return (
    <div style={{ background:'var(--d-paper-2,#1c1c1c)', border:'1px solid #3a3a3a',
                  borderRadius:8, padding:'10px 14px', marginBottom:12 }}>
      <strong style={{ fontSize:13 }}>{pending.length} match{pending.length>1?'es':''} need review</strong>
      <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:8 }}>
        {pending.map(l => (
          <div key={l.id} style={{ display:'flex', alignItems:'center', gap:10, fontSize:12 }}>
            <span style={{ opacity:.8 }}>{l.sourceType} · {l.sourceId.slice(0,8)}…</span>
            <button onClick={() => onReview(l.id,'confirm')}>Confirm</button>
            <button onClick={() => onReview(l.id,'reject')}>Reject</button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: CrmPanel (list + selection + resolve button)**

```tsx
import React, { useState, useMemo } from 'react';
import { useContacts } from '../../../hooks/useContacts';
import { ReviewQueueStrip } from './ReviewQueueStrip';
import { ContactRecord } from './ContactRecord';

const STAGES = ['new','engaged','qualified','call_booked','proposal_sent','negotiating','won','lost','nurture'];

export default function CrmPanel() {
  const { contacts, pending, loading, resolving, resolveNow, updateField, reviewLink, stageCounts, refetch } = useContacts();
  const [selected, setSelected] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [q, setQ] = useState('');

  const rows = useMemo(() => contacts.filter(c =>
    (stageFilter==='all' || c.stage===stageFilter) &&
    (!q || `${c.name} ${c.company ?? ''}`.toLowerCase().includes(q.toLowerCase()))
  ), [contacts, stageFilter, q]);

  return (
    <div>
      <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:12 }}>
        <input placeholder="Search name / company" value={q} onChange={e=>setQ(e.target.value)}
               style={{ flex:1, padding:'6px 10px' }} />
        <select value={stageFilter} onChange={e=>setStageFilter(e.target.value)}>
          <option value="all">All stages</option>
          {STAGES.map(s => <option key={s} value={s}>{s} ({stageCounts[s]||0})</option>)}
        </select>
        <button onClick={resolveNow} disabled={resolving}>{resolving?'Resolving…':'Resolve now'}</button>
      </div>
      <ReviewQueueStrip pending={pending} onReview={reviewLink} />
      <div style={{ display:'flex', gap:16 }}>
        <div style={{ flex:'0 0 42%', maxHeight:'70vh', overflow:'auto' }}>
          {loading ? <div style={{ opacity:.6 }}>Loading…</div> :
            rows.map(c => (
              <button key={c.id} onClick={()=>setSelected(c.id)}
                style={{ display:'block', width:'100%', textAlign:'left', padding:'8px 10px',
                         background: selected===c.id?'var(--d-paper-3,#262626)':'transparent',
                         border:'none', borderBottom:'1px solid #2a2a2a', cursor:'pointer' }}>
                <div style={{ fontWeight:600, fontSize:13 }}>{c.name}</div>
                <div style={{ fontSize:11, opacity:.7 }}>
                  {c.company || '—'} · {c.stage}{c.icpScore!=null?` · ICP ${c.icpScore}`:''}
                  {c.nextActionDue?` · due ${c.nextActionDue}`:''}
                </div>
              </button>
            ))}
          {!loading && !rows.length && <div style={{ opacity:.6 }}>No contacts.</div>}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          {selected
            ? <ContactRecord contactId={selected} stages={STAGES}
                onChangeField={(f,v)=>updateField(selected,f,v)} onChanged={refetch} />
            : <div style={{ opacity:.5, padding:'2rem 0' }}>Select a contact.</div>}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit` → expect errors ONLY for the not-yet-created `./ContactRecord` import (resolved in Task 8). Confirm no other new errors.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/crm/CrmPanel.tsx components/dashboard/crm/ReviewQueueStrip.tsx
git commit -m "feat(crm): CrmPanel list pane + review-queue strip"
```

---

## Task 8: 360° record (timeline + CRM fields + sources + attach)

**Files:**
- Create: `components/dashboard/crm/ContactRecord.tsx`

- [ ] **Step 1: Write ContactRecord**

```tsx
import React, { useState } from 'react';
import { useContact360 } from '../../../hooks/useContact360';
import { supabase } from '../../../lib/supabase';
import { toastError, toastSuccess } from '../../../lib/dashboardActions';
import type { Contact } from '../../../types/dashboard';

const ATTACHABLE = ['transcript','proposal_clickup','paid_assessment'] as const;

export function ContactRecord({ contactId, stages, onChangeField, onChanged }: {
  contactId: string; stages: string[];
  onChangeField: (field: keyof Contact, value: string) => void;
  onChanged: () => void;
}) {
  const { data, loading, refetch } = useContact360(contactId);
  const [attachType, setAttachType] = useState<typeof ATTACHABLE[number]>('proposal_clickup');
  const [attachId, setAttachId] = useState('');

  if (loading || !data) return <div style={{ opacity:.6, padding:'1rem 0' }}>Loading record…</div>;
  const c = data.contact;

  const attach = async () => {
    if (!attachId.trim()) return;
    try {
      const { error } = await supabase.from('contact_links').insert({
        contact_id: contactId, source_type: attachType, source_id: attachId.trim(),
        linked_by: 'manual', confidence: 'confirmed', review_status: 'active',
      });
      if (error) throw error;
      toastSuccess('Attached'); setAttachId(''); refetch(); onChanged();
    } catch (err) { toastError('attach source', err); }
  };

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
        <div>
          <div style={{ fontSize:18, fontWeight:700 }}>{c.name}</div>
          <div style={{ fontSize:12, opacity:.7 }}>
            {c.company || '—'}{c.icpScore!=null?` · ICP ${c.icpScore}`:''}
            {c.linkedinUrl && <> · <a href={c.linkedinUrl} target="_blank" rel="noreferrer">LinkedIn</a></>}
          </div>
        </div>
        <select value={c.stage} onChange={e=>onChangeField('stage', e.target.value)}>
          {stages.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* CRM fields */}
      <div style={{ marginTop:12, display:'grid', gap:8 }}>
        <label style={{ fontSize:11, opacity:.7 }}>Next action
          <input defaultValue={c.nextAction ?? ''} onBlur={e=>onChangeField('nextAction', e.target.value)}
                 style={{ width:'100%', padding:'5px 8px' }} />
        </label>
        <label style={{ fontSize:11, opacity:.7 }}>Due
          <input type="date" defaultValue={c.nextActionDue ?? ''}
                 onBlur={e=>onChangeField('nextActionDue', e.target.value)} />
        </label>
        <label style={{ fontSize:11, opacity:.7 }}>Notes
          <textarea defaultValue={c.ownerNotes ?? ''} onBlur={e=>onChangeField('ownerNotes', e.target.value)}
                    rows={3} style={{ width:'100%', padding:'5px 8px' }} />
        </label>
      </div>

      {/* Sources */}
      <div style={{ marginTop:14 }}>
        <div style={{ fontSize:11, textTransform:'uppercase', opacity:.6 }}>Sources</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:6 }}>
          {data.links.map(l => (
            <span key={l.id} style={{ fontSize:11, padding:'3px 8px', borderRadius:12,
                  background:'var(--d-paper-3,#262626)' }}>{l.sourceType}</span>
          ))}
          {!data.links.length && <span style={{ fontSize:11, opacity:.5 }}>none</span>}
        </div>
        <div style={{ display:'flex', gap:6, marginTop:8 }}>
          <select value={attachType} onChange={e=>setAttachType(e.target.value as any)}>
            {ATTACHABLE.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input placeholder="source id (clickup task / stripe session / transcript id)"
                 value={attachId} onChange={e=>setAttachId(e.target.value)} style={{ flex:1, padding:'4px 8px' }} />
          <button onClick={attach}>+ Attach</button>
        </div>
      </div>

      {/* Timeline */}
      <div style={{ marginTop:16 }}>
        <div style={{ fontSize:11, textTransform:'uppercase', opacity:.6, marginBottom:6 }}>Timeline</div>
        {data.timeline.map((e, i) => (
          <div key={i} style={{ display:'flex', gap:10, fontSize:12, padding:'5px 0', borderBottom:'1px solid #242424' }}>
            <span style={{ opacity:.5, flex:'0 0 130px' }}>{new Date(e.ts).toLocaleString()}</span>
            <span style={{ flex:'0 0 90px', opacity:.8 }}>{e.kind}</span>
            <span style={{ flex:1, minWidth:0, whiteSpace:'pre-wrap' }}>
              {e.kind==='dm' ? `${(e.data as any).direction}: ${(e.data as any).text ?? ''}` : JSON.stringify(e.data)}
            </span>
          </div>
        ))}
        {!data.timeline.length && <div style={{ opacity:.5, fontSize:12 }}>No activity yet.</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit` → no new errors (CrmPanel's `./ContactRecord` import now resolves).

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/crm/ContactRecord.tsx
git commit -m "feat(crm): ContactRecord — timeline, CRM fields, sources, manual attach"
```

---

## Task 9: Wire CRM sub-tab into Reach & Pipeline

**Files:**
- Modify: `components/dashboard-v2/sections/ReachPipeline.tsx`

- [ ] **Step 1: Add `crm` as the first sub-tab + default**

In `ReachPipeline.tsx`: import `CrmPanel` (lazy), extend `SubKey` with `'crm'`, add `crm: 'CRM'` to `SUB_LABELS`, put `'crm'` first in `SUB_ORDER`, change the `resolveSub` fallback default from `'outreach'` to `'crm'`, add `case 'crm': return <CrmPanel />;` to `renderSub`.

```tsx
const CrmPanel = lazy(() => import('../../dashboard/crm/CrmPanel'));
// SubKey: add 'crm'
type SubKey = 'crm' | 'outreach' | 'leads' | 'competitors' | 'upwork' | 'meetings' | 'agentready';
// SUB_LABELS: add crm:'CRM'   SUB_ORDER: ['crm','outreach','leads','competitors','upwork','meetings','agentready']
// resolveSub fallback: return { sub: 'crm', corrected: raw != null };
// getInitialSub default + SSR default: 'crm'
// renderSub switch: case 'crm': return <CrmPanel />;
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: build succeeds; `CrmPanel` chunk emitted. Fix any type errors surfaced.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard-v2/sections/ReachPipeline.tsx
git commit -m "feat(crm): mount CRM as first Reach sub-tab + default landing"
```

---

## Task 10: End-to-end UI verification (Playwright)

**Files:** none (verification only)

- [ ] **Step 1: Run resolver against real data**

`select resolve_contacts();` then confirm `select count(*) from contacts;` > 0 and at least one contact has ≥2 active links (the outreach∩lead overlap).

- [ ] **Step 2: Screenshot the CRM tab**

Use the `playwright-driver` skill (Mode 1 inspect, `dashboard` profile) against the running dashboard at the Reach → CRM sub-tab (`?...&sub=crm`). Capture: (a) list pane populated, (b) a selected contact's 360° record showing timeline + sources + stage selector.
Expected: list renders contacts; clicking one loads the record inline (no modal); timeline shows DM/lead events for a known person (e.g. someone who replied in outreach).

- [ ] **Step 3: Exercise one write + one review**

In the UI: change a contact's stage, set a next-action + due date, type a note (blur each). Reload → values persisted (reads from `contacts`). If a pending match exists, Confirm it and verify it disappears from the strip and the source chip appears on the record.
Expected: all persist; optimistic UI matches post-reload state.

- [ ] **Step 4: Final commit / branch ready**

```bash
git add docs/superpowers/
git commit -m "docs(crm): phase 1 verification notes"
```
Then finish via `superpowers:finishing-a-development-branch` (PR or merge of `feat/crm-spine`), pushing via refspec per the git hazard.

---

## Self-review — spec coverage

- Spine tables (contacts + contact_links + denorm icp/identity + referred_by + merged_into) → Task 1 ✓
- Resolver cascade (linkedin→email→fuzzy-pending→new) for outreach_prospect+lead → Task 2 ✓
- Merge → `merge_contacts` Task 2 ✓ (UI merge button deferred to Phase 2 per spec; manual SQL merge available now)
- Review queue (pending links, confirm/reject, partial unique index allows re-resolve) → Task 1 schema + Task 5 `reviewLink` + Task 7 strip ✓
- 360° live fan-out (timeline from outreach_messages + prospect + lead; inbound DMs ride the prospect link) → Task 3 ✓
- CRM sub-tab, first + default, `?sub=crm`, inline (no modal) → Task 9 + Task 7 ✓
- List: search/stage filter/sort by next_action_due → Task 7 ✓ (ICP-band + needs-review + overdue filters: stage+search shipped; remaining filters are trivial follow-ons, flagged for Phase 2 polish)
- CRM writes via dashboardAction optimistic → Task 5 `updateField` ✓
- Manual Attach for transcript/proposal_clickup/paid_assessment → Task 8 ✓
- Resolver driver (n8n schedule + WhatsApp error + Resolve-now button) → Task 4 + Task 5/7 ✓
- RLS posture matches siblings → Task 1 Step 2 ✓
- Git worktree + refspec → preamble + Task 10 ✓

**Deferred to Phase 2 (per spec, not gaps):** ICP-band/overdue list filters, stage suggestions, Today strip, merge UI, auto-resolution of transcript/proposal/assessment, morning-triage/WhatsApp nudges.
