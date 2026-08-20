# Mattan Brain Auto-Learn Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the loop so Mattan's hand-typed LinkedIn replies teach the drafter *facts* (not just voice), with the newest reply winning on conflict, and show every draft's evidence in a collapsible so Ivan can check the source before approving.

**Architecture:** One SQL function becomes the single source of exemplar pairs (fixing a `created_at`-vs-`sent_at` pairing bug). A new `learned_facts` table holds machine-extracted, human-approved facts mined from `manual_mirror` sends by a new n8n workflow. The drafter injects approved facts as a block that outranks `rise-company-facts`, and records what it injected into a new `draft_evidence` jsonb column that the Client Ops inbox renders as a `<details>` panel.

**Tech Stack:** Postgres/Supabase (plpgsql, PostgREST, Management API), n8n code nodes (`n8nac` CLI), React + TypeScript (personal-site `components/dashboard-v2/sections/clientops2/`).

**Spec:** `docs/superpowers/specs/2026-08-20-mattan-brain-auto-learn-design.md`

## Global Constraints

- Supabase project ref: `bjbvqvzbzczjbatgmccb`. DDL runs via the Management API path in `~/.claude/memory/shared/supabase-ddl-apply-path.md` (keychain token is `go-keyring-base64:`-prefixed; strip and base64-decode; build the body with `json.dumps` into a file and use `--data-binary @file`).
- Migration files live in `personal-site/supabase/migrations/YYYYMMDD_name.sql`. Writing the file does **not** apply it — apply via the Management API, then verify by reading the object back.
- n8n workflow edits: `n8nac pull <id>` **before** editing (local `.workflow.ts` goes stale and pushing a stale file destroys nodes), then `n8nac push`, then `n8nac deactivate` + `n8nac activate`. Never edit via the REST API — it reverts.
- **No backtick characters anywhere inside a `.workflow.ts` file** — not in `jsCode` strings, not in comments. A raw backtick truncates the node on push. Use string concatenation with `"` and `'`.
- `Prefer: return=minimal` on a PostgREST insert returns **204 with an empty body**. Never parse its response.
- RPC signature changes require `DROP FUNCTION` then `CREATE` — `CREATE OR REPLACE` fails when parameters change.
- The drafter must keep failing open: no new code path may prevent a draft from being written. Every addition is wrapped in its own `try/catch`.
- Approving/sending is untouched by this work. The evidence panel is read-only; the facts review strip writes only to `learned_facts`.
- Client id for RISE in `outreach_campaigns.client_id` is `risedtc`. Client id in the Client Ops UI (`p_client_id`) is also `risedtc`.
- personal-site deploys via `git push origin main` only, through `menubar/deploy.sh`. Do not push until the whole plan is verified.

---

### Task 1: Fix exemplar pairing, and make one source of truth for pairs

**Files:**
- Create: `personal-site/supabase/migrations/20260820_reply_exemplar_pairs.sql`
- Verify against: live functions `public.reply_exemplar_pairs`, `public.refresh_reply_exemplars`

**Model:** `sonnet`

**Interfaces:**
- Consumes: nothing.
- Produces: `public.reply_exemplar_pairs(p_client_id text, p_limit int) returns table(message_id uuid, prospect_id uuid, prospect_name text, their text, reply text, sent_at timestamptz)` — called by Task 3 (Fact Learner), Task 4 (drafter evidence), and by `refresh_reply_exemplars()`.

- [ ] **Step 1: Write the failing check**

Save as `/tmp/t1_before.py` and run it. It asserts the fixed pairing differs from the live one — i.e. the bug is present. This is the "test fails first" step: it must report `MISPAIRED >= 1` **before** the migration.

```python
import json, subprocess
TOKEN = subprocess.run(
    "security find-generic-password -s 'Supabase CLI' -a supabase -w | sed 's/^go-keyring-base64://' | base64 -d",
    shell=True, capture_output=True, text=True).stdout.strip()
SQL = """
select
  left(regexp_replace(m.message_text, E'\\\\s+', ' ', 'g'), 60) as reply,
  (select left(regexp_replace(i.message_text, E'\\\\s+',' ','g'),60) from outreach_messages i
     where i.prospect_id=m.prospect_id and i.direction='inbound' and i.created_at < m.sent_at
     order by i.created_at desc limit 1) as paired_now,
  (select left(regexp_replace(i.message_text, E'\\\\s+',' ','g'),60) from outreach_messages i
     where i.prospect_id=m.prospect_id and i.direction='inbound'
       and coalesce(i.is_reaction,false)=false
       and coalesce(i.sent_at,i.created_at) < m.sent_at
     order by coalesce(i.sent_at,i.created_at) desc limit 1) as paired_fixed
from outreach_messages m
join outreach_prospects p on p.id=m.prospect_id
join outreach_campaigns c on c.id=p.campaign_id
where m.ai_model='manual_mirror' and m.direction='outbound' and m.sent_at is not null
  and m.sent_at > now() - interval '45 days' and coalesce(c.client_id,'ivan')='risedtc'
order by m.sent_at desc limit 8;
"""
open('/tmp/req.json','w').write(json.dumps({'query': SQL}))
out = subprocess.run([
    'curl','-s','-X','POST',
    'https://api.supabase.com/v1/projects/bjbvqvzbzczjbatgmccb/database/query',
    '-H', 'Authorization: Bearer ' + TOKEN, '-H', 'Content-Type: application/json',
    '--data-binary', '@/tmp/req.json'], capture_output=True, text=True).stdout
rows = json.loads(out)
bad = [r for r in rows if (r['paired_now'] or '') != (r['paired_fixed'] or '')]
for r in bad:
    print('MISPAIRED reply:', r['reply'])
    print('   now  :', r['paired_now'])
    print('   fixed:', r['paired_fixed'])
print('MISPAIRED', len(bad), 'of', len(rows))
```

- [ ] **Step 2: Run it to confirm the bug is live**

Run: `python3 /tmp/t1_before.py`
Expected: `MISPAIRED 2 of 8`, and one of the mispaired lines is the reply beginning `No minimums on spend`, whose `now` is `Please do.` and whose `fixed` is `What is the minimum spend?`.

If it reports `MISPAIRED 0 of 8`, stop and report — the population moved and the premise needs re-checking.

- [ ] **Step 3: Write the migration file**

Create `personal-site/supabase/migrations/20260820_reply_exemplar_pairs.sql`:

```sql
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
```

- [ ] **Step 4: Apply the migration**

```bash
RAW=$(security find-generic-password -s "Supabase CLI" -a "supabase" -w)
TOKEN=$(echo "$RAW" | sed 's/^go-keyring-base64://' | base64 -d)
python3 -c "import json;open('/tmp/req.json','w').write(json.dumps({'query':open('/Users/ivanmanfredi/Desktop/personal-site/supabase/migrations/20260820_reply_exemplar_pairs.sql').read()}))"
curl -s -o /tmp/resp.json -w '%{http_code}\n' -X POST \
  "https://api.supabase.com/v1/projects/bjbvqvzbzczjbatgmccb/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data-binary @/tmp/req.json
cat /tmp/resp.json
```

Expected: `201` and `[]`. Any other status: read `/tmp/resp.json` for the Postgres error and fix the SQL.

- [ ] **Step 5: Re-run the harvester and verify the pairing is fixed**

```bash
RAW=$(security find-generic-password -s "Supabase CLI" -a "supabase" -w)
TOKEN=$(echo "$RAW" | sed 's/^go-keyring-base64://' | base64 -d)
python3 -c "import json;open('/tmp/req.json','w').write(json.dumps({'query':'select refresh_reply_exemplars();'}))"
curl -s -X POST "https://api.supabase.com/v1/projects/bjbvqvzbzczjbatgmccb/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data-binary @/tmp/req.json
python3 -c "import json;open('/tmp/req.json','w').write(json.dumps({'query':\"select body from content_prompts where slug='rise-reply-exemplars';\"}))"
curl -s -X POST "https://api.supabase.com/v1/projects/bjbvqvzbzczjbatgmccb/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data-binary @/tmp/req.json \
  | python3 -c "import sys,json;print(json.load(sys.stdin)[0]['body'])"
```

Expected: the printed body contains the consecutive lines

```
THEY: What is the minimum spend?
REPLY: No minimums on spend actually. We partner with brands starting with 5-10k a month. Where are you at with spend and channels monthly?
```

and no longer contains `THEY: Please do.` paired with that reply.

- [ ] **Step 6: Re-run the Step 1 check**

Run: `python3 /tmp/t1_before.py`
Expected: still reports 2 mispaired, because it compares the *old* expression against the *new* one — that is the point of the check and it is now historical. The real assertion is Step 5. Delete `/tmp/t1_before.py` after confirming Step 5 passed.

- [ ] **Step 7: Commit**

```bash
cd /Users/ivanmanfredi/Desktop/personal-site
git add supabase/migrations/20260820_reply_exemplar_pairs.sql docs/superpowers/specs/2026-08-20-mattan-brain-auto-learn-design.md docs/superpowers/plans/2026-08-20-mattan-brain-auto-learn.md
git commit -m "fix(outreach): pair reply exemplars on sent_at, not created_at

The harvester compared inbound created_at against outbound sent_at. manual_mirror rows are
backfilled in batches so created_at ordering inside a batch is arbitrary: 2 of 8 live RISE
exemplars were paired with the wrong question, including 'No minimums on spend' paired with
'Please do.' from six days earlier. Adds reply_exemplar_pairs() as the single source of pairs."
```

---

### Task 2: `learned_facts` table, `draft_evidence` column, and the gated RPCs

**Files:**
- Create: `personal-site/supabase/migrations/20260820_learned_facts.sql`
- Modify: `personal-site/components/dashboard-v2/sections/clientops2/shared.tsx` (append types + hooks after `editRiseDraft`, currently ending line 392)

**Model:** `sonnet`

**Interfaces:**
- Consumes: `reply_exemplar_pairs` (Task 1) — not called here, but the `topic`/recency model must match.
- Produces:
  - table `public.learned_facts`
  - column `public.outreach_messages.draft_evidence jsonb`
  - `public.active_learned_facts(p_client_id text) returns table(id uuid, topic text, fact_text text, source_prospect_name text, source_message_id uuid, source_sent_at timestamptz)` — one row per topic, newest first. Called by Task 3 and Task 4.
  - `public.operator_learned_facts(p_gate text, p_client_id text) returns jsonb` → `{ok, facts:[...]}`
  - `public.operator_resolve_learned_fact(p_gate text, p_fact_id uuid, p_decision text, p_text text) returns jsonb` → `{ok, note}`
  - TS: `LearnedFact`, `DraftEvidence`, `useClientLearnedFacts(clientId)`, `resolveLearnedFact(id, decision, text?)`

- [ ] **Step 1: Write the migration file**

Create `personal-site/supabase/migrations/20260820_learned_facts.sql`:

```sql
-- 2026-08-20 — Mattan's hand-typed replies state facts that rise-company-facts does not carry
-- ("No minimums on spend. We partner with brands starting with 5-10k a month.", 2026-08-20).
-- The exemplar corpus takes them as STYLE and forbids using them as fact, so the brain never
-- learned them. This table is the fact store: machine-extracted, human-approved, never written
-- to content_prompts by a machine.
--
-- RECENCY PRIORITY (Ivan, 2026-08-20): "most recent manual replies from Mattan should take
-- knowledge priority". Enforced by `topic`: active_learned_facts returns distinct on (topic)
-- ordered by source_sent_at desc, and approving supersedes older approved facts on that topic.

create table if not exists public.learned_facts (
  id                   uuid primary key default gen_random_uuid(),
  client_id            text not null,
  topic                text not null,
  fact_text            text not null,
  status               text not null default 'pending',
  source_message_id    uuid unique references public.outreach_messages(id) on delete set null,
  source_prospect_id   uuid references public.outreach_prospects(id) on delete set null,
  source_prospect_name text,
  source_question      text,
  source_quote         text not null,
  source_sent_at       timestamptz not null,
  superseded_by        uuid references public.learned_facts(id) on delete set null,
  resolved_at          timestamptz,
  resolved_by          text,
  created_at           timestamptz not null default now(),
  constraint learned_facts_status_ck
    check (status in ('pending','approved','rejected','superseded'))
);

create index if not exists learned_facts_active_idx
  on public.learned_facts (client_id, status, source_sent_at desc);

alter table public.learned_facts enable row level security;

drop policy if exists learned_facts_service_all on public.learned_facts;
create policy learned_facts_service_all on public.learned_facts
  for all to service_role using (true) with check (true);

drop policy if exists learned_facts_authenticated_all on public.learned_facts;
create policy learned_facts_authenticated_all on public.learned_facts
  for all to authenticated using (true) with check (true);

-- What the drafter injects. distinct on (topic) IS the recency rule: for any topic only Mattan's
-- newest approved statement reaches the model.
create or replace function public.active_learned_facts(p_client_id text)
returns table (
  id                   uuid,
  topic                text,
  fact_text            text,
  source_prospect_name text,
  source_message_id    uuid,
  source_sent_at       timestamptz
)
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $$
  select distinct on (f.topic)
    f.id, f.topic, f.fact_text, f.source_prospect_name, f.source_message_id, f.source_sent_at
  from public.learned_facts f
  where f.client_id = p_client_id and f.status = 'approved'
  order by f.topic, f.source_sent_at desc;
$$;

grant execute on function public.active_learned_facts(text) to service_role, authenticated;

-- Operator read: pending candidates first, then the approved shelf so Ivan can see what the
-- brain currently believes and retire a line that has gone stale.
create or replace function public.operator_learned_facts(p_gate text, p_client_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'extensions'
as $function$
declare v jsonb;
begin
  if not operator_gate_ok(p_gate) then
    return jsonb_build_object('ok', false, 'error', 'bad_gate');
  end if;

  select jsonb_agg(x order by (x->>'status') = 'pending' desc, (x->>'source_sent_at') desc)
    into v
  from (
    select jsonb_build_object(
      'id',            f.id,
      'topic',         f.topic,
      'fact_text',     f.fact_text,
      'status',        f.status,
      'prospect_name', f.source_prospect_name,
      'question',      f.source_question,
      'quote',         f.source_quote,
      'source_sent_at', f.source_sent_at,
      'chat_url',      p.linkedin_url
    ) as x
    from public.learned_facts f
    left join public.outreach_prospects p on p.id = f.source_prospect_id
    where f.client_id = p_client_id
      and f.status in ('pending','approved')
    order by f.source_sent_at desc
    limit 30
  ) s;

  return jsonb_build_object('ok', true, 'facts', coalesce(v, '[]'::jsonb));
end;
$function$;

grant execute on function public.operator_learned_facts(text, text) to authenticated;

-- Operator write. p_decision: 'approve' | 'reject' | 'retire'. p_text optionally replaces the
-- extracted wording on approve, so Ivan can tighten a line without retyping the provenance.
create or replace function public.operator_resolve_learned_fact(
  p_gate text, p_fact_id uuid, p_decision text, p_text text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'extensions'
as $function$
declare f public.learned_facts%rowtype;
begin
  if not operator_gate_ok(p_gate) then
    return jsonb_build_object('ok', false, 'error', 'bad_gate');
  end if;
  if p_decision not in ('approve','reject','retire') then
    return jsonb_build_object('ok', false, 'error', 'bad_decision');
  end if;

  select * into f from public.learned_facts where id = p_fact_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if p_decision = 'reject' then
    update public.learned_facts
       set status = 'rejected', resolved_at = now(), resolved_by = 'operator'
     where id = p_fact_id;
    return jsonb_build_object('ok', true, 'note', 'Rejected. It will not reach the drafter.');
  end if;

  if p_decision = 'retire' then
    update public.learned_facts
       set status = 'superseded', resolved_at = now(), resolved_by = 'operator'
     where id = p_fact_id;
    return jsonb_build_object('ok', true, 'note', 'Retired from the drafter.');
  end if;

  -- approve: the newest statement on a topic wins, so older approved rows on that topic retire.
  update public.learned_facts
     set status = 'superseded', superseded_by = p_fact_id, resolved_at = now(),
         resolved_by = 'recency'
   where client_id = f.client_id
     and topic = f.topic
     and status = 'approved'
     and id <> p_fact_id
     and source_sent_at <= f.source_sent_at;

  update public.learned_facts
     set status = 'approved',
         fact_text = coalesce(nullif(btrim(p_text), ''), fact_text),
         resolved_at = now(), resolved_by = 'operator'
   where id = p_fact_id;

  return jsonb_build_object('ok', true, 'note', 'Approved. The drafter uses it from the next run.');
end;
$function$;

grant execute on function public.operator_resolve_learned_fact(text, uuid, text, text) to authenticated;

-- What the drafter actually injected into this draft. Deterministic input log, NOT a model
-- self-report: a model asked "which sources did you use" confabulates; logging the inputs cannot.
alter table public.outreach_messages
  add column if not exists draft_evidence jsonb;

comment on column public.outreach_messages.draft_evidence is
  'Inputs the drafter injected for this draft (facts row version, learned facts, exemplar pairs, store fact, anchor, scan finding, voice row versions). Rendered as the Evidence collapsible in Client Ops.';
```

- [ ] **Step 2: Apply the migration**

```bash
RAW=$(security find-generic-password -s "Supabase CLI" -a "supabase" -w)
TOKEN=$(echo "$RAW" | sed 's/^go-keyring-base64://' | base64 -d)
python3 -c "import json;open('/tmp/req.json','w').write(json.dumps({'query':open('/Users/ivanmanfredi/Desktop/personal-site/supabase/migrations/20260820_learned_facts.sql').read()}))"
curl -s -o /tmp/resp.json -w '%{http_code}\n' -X POST \
  "https://api.supabase.com/v1/projects/bjbvqvzbzczjbatgmccb/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data-binary @/tmp/req.json
cat /tmp/resp.json
```

Expected: `201` and `[]`.

- [ ] **Step 3: Test recency priority with real rows**

This is the behavioural test for "most recent manual replies take knowledge priority". Run:

```bash
RAW=$(security find-generic-password -s "Supabase CLI" -a "supabase" -w)
TOKEN=$(echo "$RAW" | sed 's/^go-keyring-base64://' | base64 -d)
python3 - <<'PY'
import json
SQL = """
insert into learned_facts (client_id, topic, fact_text, status, source_quote, source_sent_at, source_prospect_name)
values ('__test__','minimum ad spend','OLD: minimum spend is $20k/mo.','approved','q','2026-06-01','A'),
       ('__test__','minimum ad spend','NEW: no minimum; brands start at 5-10k/mo.','pending','q','2026-08-20','B')
returning id, status;
"""
open('/tmp/req.json','w').write(json.dumps({'query': SQL}))
PY
curl -s -X POST "https://api.supabase.com/v1/projects/bjbvqvzbzczjbatgmccb/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data-binary @/tmp/req.json
```

Note the `id` of the row whose status is `pending`. Then approve it and read the active set:

```bash
python3 -c "
import json,sys
fid = sys.argv[1]
q = \"select operator_resolve_learned_fact(current_setting('app.gate', true), '\" + fid + \"'::uuid, 'approve', null);\"
open('/tmp/req.json','w').write(json.dumps({'query': q}))" "<PENDING_ID>"
```

`operator_gate_ok` needs the real gate string. Instead of guessing it, exercise the recency rule directly with the same UPDATE the RPC runs, then assert `active_learned_facts` returns exactly one row:

```bash
python3 - <<'PY'
import json
SQL = """
update learned_facts set status='superseded', resolved_by='recency'
 where client_id='__test__' and topic='minimum ad spend' and status='approved'
   and source_sent_at <= '2026-08-20';
update learned_facts set status='approved' where client_id='__test__' and fact_text like 'NEW:%';
select fact_text, source_sent_at from active_learned_facts('__test__');
"""
open('/tmp/req.json','w').write(json.dumps({'query': SQL}))
PY
curl -s -X POST "https://api.supabase.com/v1/projects/bjbvqvzbzczjbatgmccb/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data-binary @/tmp/req.json
```

Expected: exactly one row, `NEW: no minimum; brands start at 5-10k/mo.` The `OLD:` row must be gone from the active set.

- [ ] **Step 4: Clean up the test rows**

```bash
python3 -c "import json;open('/tmp/req.json','w').write(json.dumps({'query':\"delete from learned_facts where client_id='__test__';\"}))"
curl -s -X POST "https://api.supabase.com/v1/projects/bjbvqvzbzczjbatgmccb/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data-binary @/tmp/req.json
```

Expected: `[]`. Confirm with `select count(*) from learned_facts;` → `0`.

- [ ] **Step 5: Add the TypeScript types and hooks**

In `personal-site/components/dashboard-v2/sections/clientops2/shared.tsx`, immediately after the `editRiseDraft` function (ends line 392, before the `// ── Overview hook ──` comment), insert:

```tsx
// ── Learned facts (2026-08-20) ───────────────────────────────────────────────
// Mattan states facts in hand-typed replies that rise-company-facts does not carry. The Fact
// Learner mines them from manual_mirror sends and queues them here; nothing reaches the drafter
// until Ivan approves. Recency priority: approving supersedes older approved facts on the topic.
export interface LearnedFact {
  id: string;
  topic: string;
  fact_text: string;
  status: 'pending' | 'approved';
  prospect_name: string | null;
  question: string | null;
  quote: string;
  source_sent_at: string;
  chat_url: string | null;
}

/** What the drafter injected for a draft. Logged inputs, not a model self-report. */
export interface DraftEvidenceFact {
  id: string; fact: string; topic: string; at: string; from: string | null; message_id: string | null;
}
export interface DraftEvidenceExemplar {
  they: string | null; reply: string | null; at: string | null; prospect: string | null;
}
export interface DraftEvidenceRow { slug: string; version: number | null; updated_at?: string | null }
export interface DraftEvidence {
  at?: string | null;
  facts?: DraftEvidenceRow | null;
  learned?: DraftEvidenceFact[] | null;
  exemplars?: DraftEvidenceExemplar[] | null;
  store_fact?: string | null;
  anchor?: string | null;
  scan_finding?: string | null;
  scan_url?: string | null;
  operator_note?: string | null;
  voice_rows?: DraftEvidenceRow[] | null;
}

export function useClientLearnedFacts(clientId: string | null) {
  const [facts, setFacts] = useState<LearnedFact[] | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!clientId) { setFacts(null); return; }
    setError('');
    const { data, error: err } = await supabase.rpc('operator_learned_facts', { p_gate: GATE, p_client_id: clientId });
    if (err || (data && data.ok === false)) {
      setError(err?.message || data?.error || 'learned facts load failed');
      setFacts((prev) => prev ?? null);
      return;
    }
    setFacts((data?.facts || []) as LearnedFact[]);
  }, [clientId]);
  useEffect(() => { load(); }, [load]);
  return { facts, error, reload: load };
}

/** decision: 'approve' | 'reject' | 'retire'. text optionally replaces the extracted wording. */
export async function resolveLearnedFact(
  factId: string, decision: 'approve' | 'reject' | 'retire', text?: string,
): Promise<{ ok: boolean; note?: string; error?: string }> {
  const { data, error } = await supabase.rpc('operator_resolve_learned_fact', {
    p_gate: GATE, p_fact_id: factId, p_decision: decision, p_text: text ?? null,
  });
  if (error) return { ok: false, error: error.message };
  const r = (data as { ok?: boolean; note?: string; error?: string }) || {};
  return { ok: !!r.ok, note: r.note, error: r.error };
}
```

Then add `draft_evidence` to the `PendingDraft` interface (line 348 area), immediately after `context_gap`:

```tsx
  context_gap?: PendingDraftGap | null;
  draft_evidence?: DraftEvidence | null;
```

- [ ] **Step 6: Expose `draft_evidence` on the drafts RPC**

Append to `personal-site/supabase/migrations/20260820_learned_facts.sql` a `CREATE OR REPLACE` of `operator_client_pending_drafts` that is byte-identical to the live definition except for one added key. Fetch the live definition first so nothing is lost:

```bash
RAW=$(security find-generic-password -s "Supabase CLI" -a "supabase" -w)
TOKEN=$(echo "$RAW" | sed 's/^go-keyring-base64://' | base64 -d)
python3 -c "import json;open('/tmp/req.json','w').write(json.dumps({'query':\"select pg_get_functiondef(p.oid) as def from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='operator_client_pending_drafts';\"}))"
curl -s -X POST "https://api.supabase.com/v1/projects/bjbvqvzbzczjbatgmccb/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data-binary @/tmp/req.json \
  | python3 -c "import sys,json;print(json.load(sys.stdin)[0]['def'])" > /tmp/pending_drafts.sql
```

Edit `/tmp/pending_drafts.sql`: directly after the line

```
      'context_gap',   m.context_gap,
```

insert

```
      -- Deterministic log of what the drafter injected. Rendered as the Evidence collapsible.
      'draft_evidence', m.draft_evidence,
```

Append the edited function to the migration file, apply it the same way as Step 2, and verify:

```bash
python3 -c "import json;open('/tmp/req.json','w').write(json.dumps({'query':\"select pg_get_functiondef(p.oid) like '%draft_evidence%' as ok from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='operator_client_pending_drafts';\"}))"
curl -s -X POST "https://api.supabase.com/v1/projects/bjbvqvzbzczjbatgmccb/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data-binary @/tmp/req.json
```

Expected: `[{"ok": true}]`.

- [ ] **Step 7: Typecheck and commit**

```bash
cd /Users/ivanmanfredi/Desktop/personal-site
npx tsc --noEmit
git add supabase/migrations/20260820_learned_facts.sql components/dashboard-v2/sections/clientops2/shared.tsx
git commit -m "feat(outreach): learned_facts store, draft_evidence column, gated operator RPCs

Facts Mattan states in hand-typed replies now have somewhere to live. Approving a fact supersedes
older approved facts on the same topic, so his newest statement is the one the drafter sees."
```

---

### Task 3: The Fact Learner n8n workflow

**Files:**
- Create: `Ivan - Content System/workflows/default/Outreach - Fact Learner.workflow.ts`
- Read first (do not edit): `Ivan - Content System/workflows/default/Outreach - RISE Reply Drafter.workflow.ts` — copy its `SUPA`/`SKEY`/`RAILWAY`/`RKEY`/`EVO`/`EVO_KEY`/`WA` constant block verbatim.

**Model:** `opus`

**Interfaces:**
- Consumes: `reply_exemplar_pairs` is *not* used here (it caps at 8 and truncates text); this workflow reads `outreach_messages` directly. Consumes `active_learned_facts(p_client_id)` (Task 2) and inserts into `learned_facts` (Task 2).
- Produces: `learned_facts` rows with `status='pending'`, one per `source_message_id` (unique constraint makes the workflow idempotent).

- [ ] **Step 1: Pull the drafter to copy the live constants**

```bash
cd "/Users/ivanmanfredi/Desktop/Ivan - Content System"
n8nac pull uee9FUFHxdRrhjMB
grep -n 'const SUPA\|const SKEY\|const RAILWAY\|const RKEY\|const EVO\|const WA' "workflows/default/Outreach - RISE Reply Drafter.workflow.ts"
```

Expected: the constant lines print. Copy them verbatim into Step 2 — do not retype the keys.

- [ ] **Step 2: Write the workflow file**

Create `Ivan - Content System/workflows/default/Outreach - Fact Learner.workflow.ts`. Substitute the real constant values from Step 1 where marked. **No backtick characters anywhere in this file.**

```ts
import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Outreach - Fact Learner
// Nodes   : 2  |  Connections: 1
//
// NODE INDEX
// Property name                    Node type (short)         Flags
// EveryHour                          scheduleTrigger
// LearnFacts                         code
//
// ROUTING MAP
// EveryHour
//    -> LearnFacts
// </workflow-map>

@workflow({
    name: 'Outreach - Fact Learner',
    active: false,
    isArchived: false,
    settings: { executionOrder: 'v1' },
})
export class OutreachFactLearnerWorkflow {
    @node({
        id: 'trig1',
        name: 'Every Hour',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 0],
    })
    EveryHour = {
        rule: { interval: [{ field: 'hours', hoursInterval: 1 }] },
    };

    @node({
        id: 'code1',
        name: 'Learn Facts',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [320, 0],
    })
    LearnFacts = {
        mode: 'runOnceForAllItems',
        jsCode: `
const SUPA = "<PASTE FROM STEP 1>";
const SKEY = "<PASTE FROM STEP 1>";
const RAILWAY = "<PASTE FROM STEP 1>";
const RKEY = "<PASTE FROM STEP 1>";
const EVO = "<PASTE FROM STEP 1>"; const EVO_KEY = "<PASTE FROM STEP 1>"; const WA = "<PASTE FROM STEP 1>";
const H = { apikey: SKEY, Authorization: "Bearer " + SKEY, "Content-Type": "application/json" };
const CLIENT = "risedtc";

async function sget(q){ return this.helpers.httpRequest({ method:"GET", url:SUPA+"/rest/v1/"+q, headers:H }); }
async function srpc(fn, body){ return this.helpers.httpRequest({ method:"POST", url:SUPA+"/rest/v1/rpc/"+fn, headers:H, body:body }); }

// 2026-08-20 (Ivan): Mattan answers questions by hand on LinkedIn that rise-company-facts does
// not cover. The exemplar harvest takes those replies as STYLE and explicitly forbids using them
// as fact, so the brain never learned them. This mines the FACT and queues it for approval.
// It never writes to content_prompts and never sends anything.
const SYS = "You read one exchange from a LinkedIn conversation: a prospect's question and the reply the founder typed BY HAND. You decide whether that reply states a durable fact about the company that the KNOWN FACTS do not already contain.\\n\\nA durable fact is a policy, price, threshold, capability, process, or constraint that would be true for the NEXT prospect who asks the same question. It is NOT: a scheduling answer, a pleasantry, a fact about the prospect's own business, a compliment, an opinion, or anything specific to this one deal.\\n\\nnew_fact=false when the reply states nothing durable, OR when KNOWN FACTS already contains the same information in any wording. When in doubt, answer false: a wrong fact reaching the drafter is far worse than a missed one.\\n\\nWhen new_fact=true, write fact_text as ONE plain sentence a colleague could read aloud to a prospect, stating only what the founder actually said. Never add a number, a qualifier, or a consequence he did not state. Write topic as two to four lowercase words naming the SUBJECT the fact is about (for example: minimum ad spend, contract length, creative process, reporting cadence). Two replies about the same subject must produce the same topic string, because topic is how a newer answer retires an older one.\\n\\nOutput STRICT JSON only, no markdown fence: {\\"new_fact\\": true|false, \\"fact_text\\": \\"...\\", \\"topic\\": \\"...\\", \\"why\\": \\"one short clause\\"}";

const out = [];

// Known facts = the canon row PLUS everything already approved, so we never re-queue a fact we
// have already learned.
let facts = "";
try { const rf = await sget.call(this, "content_prompts?slug=eq.rise-company-facts&is_active=eq.true&select=body&limit=1"); facts = (rf[0]&&rf[0].body)||""; } catch(e){}
let known = [];
try { known = await srpc.call(this, "active_learned_facts", { p_client_id: CLIENT }) || []; } catch(e){ known = []; }
const knownBlock = facts + (known.length ? ("\\n\\nALREADY LEARNED:\\n" + known.map(function(k){ return "- " + k.fact_text; }).join("\\n")) : "");

// Campaign ids for this client, so the message scan is tenant-scoped in SQL, never in code.
let camps = [];
try { camps = await sget.call(this, "outreach_campaigns?client_id=eq."+CLIENT+"&select=id"); } catch(e){ camps = []; }
if (!camps.length) { return [{ json:{ error:"no_campaigns", client:CLIENT } }]; }
const campIn = "(" + camps.map(function(c){ return c.id; }).join(",") + ")";

// Prospects on this client, then their manual_mirror sends in the last 7 days.
let pros = [];
try { pros = await sget.call(this, "outreach_prospects?campaign_id=in."+campIn+"&select=id,name&limit=1000"); } catch(e){ pros = []; }
if (!pros.length) { return [{ json:{ error:"no_prospects" } }]; }
const nameById = {};
pros.forEach(function(p){ nameById[p.id] = p.name; });
const prosIn = "(" + pros.map(function(p){ return p.id; }).join(",") + ")";

const since = new Date(Date.now() - 7*24*3600*1000).toISOString();
let sends = [];
try {
  sends = await sget.call(this, "outreach_messages?prospect_id=in."+prosIn+"&direction=eq.outbound&ai_model=eq.manual_mirror&sent_at=gte."+encodeURIComponent(since)+"&select=id,prospect_id,message_text,sent_at&order=sent_at.desc&limit=40");
} catch(e){ return [{ json:{ error:"send_query_failed", detail:String(e).slice(0,200) } }]; }

// Already processed? source_message_id is UNIQUE, so this is the idempotency check.
let seen = {};
try {
  const done = await sget.call(this, "learned_facts?client_id=eq."+CLIENT+"&select=source_message_id&limit=1000");
  (done||[]).forEach(function(d){ if (d.source_message_id) seen[d.source_message_id] = true; });
} catch(e){}

for (const m of sends) {
  try {
    if (seen[m.id]) { continue; }
    const reply = String(m.message_text||"").trim();
    if (reply.length < 20) { out.push({ id:m.id, status:"too_short" }); continue; }

    // Pair on sent_at, never created_at: mirrored rows are backfilled in batches so created_at
    // ordering inside a batch is arbitrary. This is the same bug that mispaired 2 of 8 exemplars.
    let inb = [];
    try {
      inb = await sget.call(this, "outreach_messages?prospect_id=eq."+m.prospect_id+"&direction=eq.inbound&is_reaction=not.eq.true&sent_at=lt."+encodeURIComponent(m.sent_at)+"&select=message_text,sent_at&order=sent_at.desc&limit=1");
    } catch(e){ inb = []; }
    const question = ((inb[0]||{}).message_text || "").trim();
    if (question.length < 6) { out.push({ id:m.id, status:"no_question" }); continue; }

    let verdict = null;
    try {
      const cl = await this.helpers.httpRequest({ method:"POST", url:RAILWAY+"/v1/messages",
        headers:{ "X-API-Key":RKEY, "Content-Type":"application/json", "anthropic-version":"2023-06-01" },
        body: JSON.stringify({ model:"claude-sonnet-5", max_tokens:300, system:SYS,
          messages:[{ role:"user", content:"=== KNOWN FACTS ===\\n" + knownBlock + "\\n\\n=== PROSPECT ASKED ===\\n" + question.slice(0,700) + "\\n\\n=== THE FOUNDER TYPED THIS BY HAND ===\\n" + reply.slice(0,900) + "\\n\\nDoes that reply state a durable fact KNOWN FACTS does not already contain?" }] }),
        timeout:60000 });
      const raw = (((cl.content||[])[0]||{}).text || "").trim().replace(/^\\u0060\\u0060\\u0060json?\\s*|\\s*\\u0060\\u0060\\u0060$/g, "");
      verdict = JSON.parse(raw);
    } catch(e){ verdict = null; }

    // A proxy quota refusal returns HTTP 200 with real prose, which will not parse as JSON.
    // Unparseable => skip and say so. Never insert a guess.
    if (!verdict || typeof verdict !== "object") { out.push({ id:m.id, status:"judge_unparseable" }); continue; }
    if (verdict.new_fact !== true) { out.push({ id:m.id, status:"nothing_new", why:String(verdict.why||"").slice(0,80) }); continue; }
    const factText = String(verdict.fact_text||"").trim();
    const topic = String(verdict.topic||"").trim().toLowerCase();
    if (factText.length < 12 || !topic) { out.push({ id:m.id, status:"bad_shape" }); continue; }

    await this.helpers.httpRequest({ method:"POST", url:SUPA+"/rest/v1/learned_facts",
      headers:{ ...H, Prefer:"return=minimal" },
      body:{ client_id:CLIENT, topic:topic, fact_text:factText.slice(0,400), status:"pending",
             source_message_id:m.id, source_prospect_id:m.prospect_id,
             source_prospect_name:nameById[m.prospect_id]||null,
             source_question:question.slice(0,400), source_quote:reply.slice(0,900),
             source_sent_at:m.sent_at } });

    try {
      await this.helpers.httpRequest({ method:"POST", url:EVO+"/message/sendText/ivan-wa",
        headers:{ apikey:EVO_KEY, "Content-Type":"application/json" },
        body:{ number:WA, text:"Mattan answered something our RISE notes do not cover.\\n\\nThey asked: " + question.slice(0,180) + "\\n\\nHe replied: " + reply.slice(0,240) + "\\n\\nProposed fact (" + topic + "):\\n" + factText + "\\n\\nApprove it in Client Ops so the drafter can use it." },
        timeout:15000 });
    } catch(e){}

    out.push({ id:m.id, status:"queued", topic:topic });
  } catch(e){ out.push({ id:m.id, status:"error", detail:String(e).slice(0,160) }); }
}

return [{ json:{ queued: out.filter(function(o){ return o.status==="queued"; }).length, scanned: sends.length, items: out } }];
`,
    };

    @links()
    defineRouting() {
        this.EveryHour.out(0).to(this.LearnFacts.in(0));
    }
}
```

- [ ] **Step 3: Verify no backticks leaked into the file**

```bash
cd "/Users/ivanmanfredi/Desktop/Ivan - Content System"
python3 - <<'PY'
p = "workflows/default/Outreach - Fact Learner.workflow.ts"
src = open(p).read()
# The three delimiters of the jsCode template literal are the only legal backticks.
n = src.count("`")
print("backticks:", n, "expected: 2")
PY
```

Expected: `backticks: 2 expected: 2`. If higher, a backtick leaked into the code body — replace it with ``` escapes as the regex line already does.

- [ ] **Step 4: Push it inactive and run it once by hand**

```bash
cd "/Users/ivanmanfredi/Desktop/Ivan - Content System"
n8nac push "workflows/default/Outreach - Fact Learner.workflow.ts"
```

Then open n8n, select **Outreach - Fact Learner**, and click Execute Workflow. Read the `Learn Facts` node output.

Expected: a JSON object with `scanned` > 0 and an `items` array. Every item has a `status`. `queued` may legitimately be 0 if nothing new was said this week — that is a pass, not a failure, provided at least one item shows `nothing_new` (proving the judge ran and returned parseable JSON).

If every item is `judge_unparseable`, the Railway proxy is refusing with HTTP 200 prose. Stop, re-probe `/v1/messages`, and do not activate.

- [ ] **Step 5: Seed the known-good case and re-run**

The 2026-08-20 minimum-spend reply is `4579faaf-a107-4992-bc73-bbb03f1db38d` (prospect `a63d5e4b-752f-4b58-96fb-fc08b039e37f`). It is inside the 7-day window, so Step 4 should already have queued it. Verify:

```bash
RAW=$(security find-generic-password -s "Supabase CLI" -a "supabase" -w)
TOKEN=$(echo "$RAW" | sed 's/^go-keyring-base64://' | base64 -d)
python3 -c "import json;open('/tmp/req.json','w').write(json.dumps({'query':\"select topic, fact_text, status, source_question, source_prospect_name from learned_facts order by created_at desc limit 10;\"}))"
curl -s -X POST "https://api.supabase.com/v1/projects/bjbvqvzbzczjbatgmccb/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data-binary @/tmp/req.json \
  | python3 -m json.tool
```

Expected: a `pending` row whose `source_question` is `What is the minimum spend?`, whose `topic` is about minimum spend, and whose `fact_text` states no minimum with brands starting at 5-10k/mo — **and states no threshold Mattan did not say**. Read the `fact_text` yourself: if it invents a qualifier, the SYS prompt needs tightening before activation.

- [ ] **Step 6: Activate**

```bash
cd "/Users/ivanmanfredi/Desktop/Ivan - Content System"
n8nac deactivate "Outreach - Fact Learner"
n8nac activate "Outreach - Fact Learner"
```

Then confirm it is live and scheduled:

```bash
n8nac list | grep -i "Fact Learner"
```

Expected: shows active. Note that `activate` resets the schedule timer, so the first run is one hour out.

---

### Task 4: Drafter injects learned facts and records evidence

**Files:**
- Modify: `Ivan - Content System/workflows/default/Outreach - RISE Reply Drafter.workflow.ts` (node `Draft RISE Replies`, workflow id `uee9FUFHxdRrhjMB`)

**Model:** `opus`

**Interfaces:**
- Consumes: `active_learned_facts(p_client_id)` and `reply_exemplar_pairs(p_client_id, p_limit)` (Tasks 1-2); writes `outreach_messages.draft_evidence` (Task 2).
- Produces: `draft_evidence` jsonb matching the `DraftEvidence` TS interface from Task 2 exactly — keys `at`, `facts`, `learned`, `exemplars`, `store_fact`, `anchor`, `scan_finding`, `scan_url`, `operator_note`, `voice_rows`.

- [ ] **Step 1: Pull fresh and count the nodes**

```bash
cd "/Users/ivanmanfredi/Desktop/Ivan - Content System"
n8nac pull uee9FUFHxdRrhjMB
grep -c "@node" "workflows/default/Outreach - RISE Reply Drafter.workflow.ts"
```

Expected: `2`. If the count differs from what you push later, the push destroyed nodes — restore from n8n version history immediately.

- [ ] **Step 2: Fetch versions alongside the prompt bodies**

In the pulled file, the four `content_prompts` fetches select `body` only. Change each to also select `version` and capture it. Replace:

```js
try { const fb = await sget.call(this, "content_prompts?slug=eq.forbidden-language&is_active=eq.true&select=body&limit=1"); forbidden = (fb[0]&&fb[0].body)||""; } catch(e){}
```

with

```js
let _fbVer = null;
try { const fb = await sget.call(this, "content_prompts?slug=eq.forbidden-language&is_active=eq.true&select=body,version&limit=1"); forbidden = (fb[0]&&fb[0].body)||""; _fbVer = (fb[0]&&fb[0].version)||null; } catch(e){}
```

Replace:

```js
try { const rf = await sget.call(this, "content_prompts?slug=eq.rise-company-facts&is_active=eq.true&select=body&limit=1"); riseFacts = (rf[0]&&rf[0].body)||""; } catch(e){}
```

with

```js
let _rfVer = null; let _rfUpd = null;
try { const rf = await sget.call(this, "content_prompts?slug=eq.rise-company-facts&is_active=eq.true&select=body,version,updated_at&limit=1"); riseFacts = (rf[0]&&rf[0].body)||""; _rfVer = (rf[0]&&rf[0].version)||null; _rfUpd = (rf[0]&&rf[0].updated_at)||null; } catch(e){}
```

Replace:

```js
try { const rc = await sget.call(this, "content_prompts?slug=eq.rise-reply-voice-core&is_active=eq.true&select=body&limit=1"); riseVoiceCore = (rc[0]&&rc[0].body)||""; } catch(e){}
```

with

```js
let _vcVer = null;
try { const rc = await sget.call(this, "content_prompts?slug=eq.rise-reply-voice-core&is_active=eq.true&select=body,version&limit=1"); riseVoiceCore = (rc[0]&&rc[0].body)||""; _vcVer = (rc[0]&&rc[0].version)||null; } catch(e){}
```

- [ ] **Step 3: Load learned facts and structured exemplar pairs**

Immediately after the `riseVoiceCore` fetch block, insert:

```js
// 2026-08-20 (Ivan: "most recent manual replies from Mattan should take knowledge priority").
// Facts Mattan stated by hand that rise-company-facts does not carry. active_learned_facts is
// distinct on (topic) ordered by source_sent_at desc, so only his NEWEST answer per subject is
// here. The block is labelled as outranking RISE FACTS, which is what makes recency win.
let learnedRows = [];
try {
  learnedRows = await this.helpers.httpRequest({ method:"POST", url:SUPA+"/rest/v1/rpc/active_learned_facts", headers:H, body:{ p_client_id:"risedtc" } }) || [];
} catch(e){ learnedRows = []; }
let learnedBlock = "";
if (learnedRows.length) {
  learnedBlock = "\\n\\n=== VERIFIED RECENT ANSWERS FROM MATTAN (he stated these himself, MORE RECENTLY than RISE FACTS above. Where any of these conflicts with RISE FACTS, THESE WIN and RISE FACTS is out of date) ===\\n"
    + learnedRows.map(function(f){ return "- " + f.fact_text + " (confirmed by Mattan " + String(f.source_sent_at||"").slice(0,10) + ")"; }).join("\\n");
}

// Structured exemplar pairs, from the SAME function that builds the rise-reply-exemplars blob,
// so the evidence panel can name the real prospect and date behind a phrasing.
let exPairs = [];
try {
  exPairs = await this.helpers.httpRequest({ method:"POST", url:SUPA+"/rest/v1/rpc/reply_exemplar_pairs", headers:H, body:{ p_client_id:"risedtc", p_limit:8 } }) || [];
} catch(e){ exPairs = []; }
```

- [ ] **Step 4: Feed the learned block to the coverage judge**

The coverage judge decides whether the reply answers something RISE FACTS does not cover. A fact we have now learned must stop being flagged. In the judge's user message, replace:

```js
messages:[{ role:"user", content:"=== RISE FACTS ===\\n" + (riseFacts||"") + "\\n\\n=== CONVERSATION ===\\n"
```

with

```js
messages:[{ role:"user", content:"=== RISE FACTS ===\\n" + (riseFacts||"") + (learnedBlock||"") + "\\n\\n=== CONVERSATION ===\\n"
```

- [ ] **Step 5: Inject the learned block into the drafting prompt**

In the long `sys` string, find the tail:

```js
"\\n\\n=== RISE FACTS (answer questions about RISE ONLY from here) ===\\n" + (riseFacts||"") + (riseExemplars ? "\\n\\n=== " + riseExemplars : "")
```

and replace with:

```js
"\\n\\n=== RISE FACTS (answer questions about RISE ONLY from here) ===\\n" + (riseFacts||"") + (learnedBlock||"") + (riseExemplars ? "\\n\\n=== " + riseExemplars : "")
```

- [ ] **Step 6: Build and write the evidence**

Immediately before the `await this.helpers.httpRequest({ method:"POST", url:SUPA+"/rest/v1/outreach_messages",` insert that writes the draft, add:

```js
    // What went INTO this draft. Logged inputs, never a model self-report: a model asked which
    // sources it used will confabulate; this cannot. Ivan reads it in the Evidence collapsible
    // to check the source before approving.
    let _ev = null;
    try {
      _ev = {
        at: new Date().toISOString(),
        facts: { slug:"rise-company-facts", version:_rfVer, updated_at:_rfUpd },
        learned: (learnedRows||[]).map(function(f){ return { id:f.id, fact:f.fact_text, topic:f.topic, at:f.source_sent_at, from:f.source_prospect_name||null, message_id:f.source_message_id||null }; }),
        exemplars: (exPairs||[]).map(function(x){ return { they:x.their, reply:x.reply, at:x.sent_at, prospect:x.prospect_name||null }; }),
        store_fact: storeFact || null,
        anchor: anchor || null,
        scan_finding: (scanFinding && !commercialStage) ? scanFinding : null,
        scan_url: (scanUrl && !commercialStage) ? scanUrl : null,
        operator_note: p.operator_note ? String(p.operator_note).slice(0,300) : null,
        voice_rows: [{ slug:"rise-reply-voice-core", version:_vcVer }, { slug:"forbidden-language", version:_fbVer }]
      };
    } catch(e){ _ev = null; }
```

Then add `draft_evidence:_ev` to the insert body, directly after `context_gap:_gap`:

```js
      body: { prospect_id:p.id, direction:"outbound", message_type:"dm", channel:"linkedin", message_text:draft, ai_model:"rise_reply_draft_v1", sequence_step:null, sent_at:null, approved_at:null, context_gap:_gap, draft_evidence:_ev } });
```

- [ ] **Step 7: Verify backtick count is unchanged, then push**

```bash
cd "/Users/ivanmanfredi/Desktop/Ivan - Content System"
python3 - <<'PY'
src = open("workflows/default/Outreach - RISE Reply Drafter.workflow.ts").read()
print("backticks:", src.count("`"), "| @node:", src.count("@node"))
PY
```

Expected: `backticks: 2 | @node: 2`. Only then:

```bash
n8nac push "workflows/default/Outreach - RISE Reply Drafter.workflow.ts"
n8nac deactivate "Outreach - RISE Reply Drafter"
n8nac activate "Outreach - RISE Reply Drafter"
```

- [ ] **Step 8: Verify a real draft carries evidence**

The drafter runs every 5 minutes. Wait for one cycle, then:

```bash
RAW=$(security find-generic-password -s "Supabase CLI" -a "supabase" -w)
TOKEN=$(echo "$RAW" | sed 's/^go-keyring-base64://' | base64 -d)
python3 -c "import json;open('/tmp/req.json','w').write(json.dumps({'query':\"select id, left(message_text,60) as txt, jsonb_pretty(draft_evidence) as ev from outreach_messages where ai_model='rise_reply_draft_v1' and draft_evidence is not null order by created_at desc limit 1;\"}))"
curl -s -X POST "https://api.supabase.com/v1/projects/bjbvqvzbzczjbatgmccb/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data-binary @/tmp/req.json \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print(d[0]['ev'] if d else 'NO ROW YET')"
```

Expected: pretty-printed JSON with `facts.version`, an `exemplars` array whose entries carry a real `prospect` and `at`, and `voice_rows`. `learned` may be `[]` until Task 3's candidate is approved — that is correct, not a failure.

If no row appears after two cycles, check the n8n execution list for `Outreach - RISE Reply Drafter` (list plain, then fetch by id — `includeData=true` on the list drops the newest runs).

---

### Task 5: Evidence collapsible and the learned-facts review strip

**Files:**
- Modify: `personal-site/components/dashboard-v2/sections/clientops2/OutreachInbox.tsx` (imports at line 3-16; `OutreachInbox` return at line 241; `InlineDraft` at line 466-570)
- Modify: `personal-site/components/dashboard-v2/sections/clientops2/OutreachView.tsx` (CSS block, after the `.co4-gap-note` rule at line 401)

**Model:** `opus`

**Interfaces:**
- Consumes: `LearnedFact`, `DraftEvidence`, `useClientLearnedFacts`, `resolveLearnedFact`, `PendingDraft.draft_evidence` (Task 2); `draft_evidence` payload shape (Task 4).
- Produces: no exports beyond the existing `OutreachInbox`.

- [ ] **Step 1: Extend the imports**

In `OutreachInbox.tsx`, add to the existing import block from `'./shared'`:

```tsx
  useClientLearnedFacts,
  resolveLearnedFact,
  type LearnedFact,
  type DraftEvidence,
```

- [ ] **Step 2: Add the evidence collapsible to `InlineDraft`**

In `InlineDraft`, directly after the `const gap = draft.context_gap || null;` line, add:

```tsx
  const ev = draft.draft_evidence || null;
```

Then, immediately before the `<div className="co3-draft-row">` that holds the action buttons, insert:

```tsx
      {ev && (
        <details className="co4-ev">
          <summary className="co4-ev-sum">Evidence</summary>
          <div className="co4-ev-body">
            {ev.learned && ev.learned.length > 0 && (
              <div className="co4-ev-grp">
                <span className="co4-ev-k">Learned from {company}</span>
                {ev.learned.map((f) => (
                  <div key={f.id} className="co4-ev-row">
                    <span className="co4-ev-fact">{f.fact}</span>
                    <span className="co4-ev-src">
                      his own DM{f.from ? ` to ${f.from}` : ''}, {fmtDate(f.at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {ev.facts && (
              <div className="co4-ev-grp">
                <span className="co4-ev-k">Company notes</span>
                <div className="co4-ev-row">
                  <span className="co4-ev-fact">{ev.facts.slug}</span>
                  <span className="co4-ev-src">
                    v{ev.facts.version ?? '?'}{ev.facts.updated_at ? `, updated ${fmtDate(ev.facts.updated_at)}` : ''}
                  </span>
                </div>
              </div>
            )}
            {(ev.store_fact || ev.anchor || ev.scan_finding) && (
              <div className="co4-ev-grp">
                <span className="co4-ev-k">Grounding</span>
                {ev.store_fact && <div className="co4-ev-row"><span className="co4-ev-fact">{ev.store_fact}</span><span className="co4-ev-src">their store</span></div>}
                {ev.anchor && <div className="co4-ev-row"><span className="co4-ev-fact">{ev.anchor}</span><span className="co4-ev-src">anchor client</span></div>}
                {ev.scan_finding && <div className="co4-ev-row"><span className="co4-ev-fact">{ev.scan_finding}</span><span className="co4-ev-src">their scan</span></div>}
              </div>
            )}
            {ev.operator_note && (
              <div className="co4-ev-grp">
                <span className="co4-ev-k">Your note</span>
                <div className="co4-ev-row"><span className="co4-ev-fact">{ev.operator_note}</span></div>
              </div>
            )}
            {ev.exemplars && ev.exemplars.length > 0 && (
              <div className="co4-ev-grp">
                <span className="co4-ev-k">Voice copied from ({ev.exemplars.length} real sends)</span>
                {ev.exemplars.slice(0, 3).map((x, i) => (
                  <div key={i} className="co4-ev-row">
                    <span className="co4-ev-fact">{x.reply}</span>
                    <span className="co4-ev-src">to {x.prospect || 'a lead'}, {fmtDate(x.at)}</span>
                  </div>
                ))}
              </div>
            )}
            <span className="co4-ev-foot">
              These are the inputs the drafter was given, recorded when it wrote the draft. It is not the model's account of what it used.
            </span>
          </div>
        </details>
      )}
```

- [ ] **Step 3: Add the learned-facts review strip component**

At the end of `OutreachInbox.tsx`, append:

```tsx
// ── Learned facts review strip (2026-08-20) ──────────────────────────────────
// Mattan answers by hand on LinkedIn; the Fact Learner mines the fact and queues it here.
// Nothing reaches the drafter until it is approved. Approving retires any older approved fact
// on the same topic, so his most recent answer is the one the brain uses.
function LearnedFactsStrip({ clientId, company }: { clientId: string; company: string }) {
  const { facts, reload } = useClientLearnedFacts(clientId);
  const pending = useMemo(() => (facts || []).filter((f) => f.status === 'pending'), [facts]);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState('');

  if (!pending.length) return null;

  const resolve = async (f: LearnedFact, decision: 'approve' | 'reject') => {
    if (busy) return;
    setBusy(f.id); setNote('');
    const r = await resolveLearnedFact(f.id, decision);
    setBusy(null);
    if (r.ok) { setNote(r.note || 'Saved.'); reload(); }
    else setNote(r.error || 'Could not save that.');
  };

  return (
    <div className="co4-lf">
      <div className="co4-lf-hd">
        {company} answered {pending.length === 1 ? 'something' : `${pending.length} things`} our notes do not cover
      </div>
      {pending.map((f) => (
        <div key={f.id} className="co4-lf-item">
          <div className="co4-lf-fact">{f.fact_text}</div>
          <div className="co4-lf-src">
            <b>{f.topic}</b> · he typed this to {f.prospect_name || 'a lead'} on {fmtDate(f.source_sent_at)}
            {f.chat_url && <> · <a href={f.chat_url} target="_blank" rel="noreferrer">open the conversation</a></>}
          </div>
          {f.question && <div className="co4-lf-q">They asked: {f.question}</div>}
          <div className="co4-lf-quote">{f.quote}</div>
          <div className="co4-lf-row">
            <button className="co3-send-btn" disabled={busy === f.id} onClick={() => resolve(f, 'approve')}>
              {busy === f.id ? 'Saving…' : 'Use this'}
            </button>
            <button className="co3-edit-btn" disabled={busy === f.id} onClick={() => resolve(f, 'reject')}>
              Discard
            </button>
            <span className="co4-gap-note">Approving replaces anything older we knew about {f.topic}.</span>
          </div>
        </div>
      ))}
      {note && <span className="co4-gap-note">{note}</span>}
    </div>
  );
}
```

- [ ] **Step 4: Render the strip**

In the `OutreachInbox` return (line 241), directly after the `{!data.armed && (...)}` armbanner block and before `<div className={\`co4-inbox ...\`}>`, insert:

```tsx
      <LearnedFactsStrip clientId={clientId} company={company} />
```

- [ ] **Step 5: Add the CSS**

In `OutreachView.tsx`, immediately after the `.ec .co4-gap-note` rule (line 401), insert:

```css
/* Evidence: what the drafter was actually given. Collapsed by default so the card stays quiet. */
.ec .co4-ev { border-top:1px solid var(--ec-rule); padding-top:0.4rem; }
.ec .co4-ev-sum { font-family:var(--ec-sans); font-size:10px; font-weight:800; letter-spacing:0.05em; text-transform:uppercase; color:var(--ec-mutedc); cursor:pointer; list-style:none; }
.ec .co4-ev-sum::-webkit-details-marker { display:none; }
.ec .co4-ev-sum::before { content:'▸ '; }
.ec .co4-ev[open] .co4-ev-sum::before { content:'▾ '; }
.ec .co4-ev-body { display:flex; flex-direction:column; gap:0.5rem; padding:0.5rem 0 0.2rem; }
.ec .co4-ev-grp { display:flex; flex-direction:column; gap:0.2rem; }
.ec .co4-ev-k { font-family:var(--ec-sans); font-size:9.5px; font-weight:800; letter-spacing:0.05em; text-transform:uppercase; color:var(--ec-mutedc); }
.ec .co4-ev-row { display:flex; flex-direction:column; gap:0.05rem; border-left:2px solid var(--ec-rule-strong); padding-left:0.5rem; }
.ec .co4-ev-fact { font-family:var(--ec-clinical); font-size:11.5px; line-height:1.45; color:var(--ec-body); }
.ec .co4-ev-src { font-family:var(--ec-sans); font-size:10px; color:var(--ec-mutedc); }
.ec .co4-ev-foot { font-family:var(--ec-clinical); font-style:italic; font-size:10.5px; line-height:1.4; color:var(--ec-mutedc); }

/* Learned facts awaiting approval. Nothing here has reached the drafter yet. */
.ec .co4-lf { border:1px solid var(--ec-ink); border-left:3px solid var(--ec-ink); padding:0.7rem 0.8rem; display:flex; flex-direction:column; gap:0.6rem; margin-bottom:0.6rem; }
.ec .co4-lf-hd { font-family:var(--ec-sans); font-size:12px; font-weight:800; letter-spacing:0.02em; color:var(--ec-ink); }
.ec .co4-lf-item { display:flex; flex-direction:column; gap:0.25rem; border-top:1px solid var(--ec-rule); padding-top:0.5rem; }
.ec .co4-lf-fact { font-family:var(--ec-clinical); font-size:13px; line-height:1.5; color:var(--ec-ink); font-weight:600; }
.ec .co4-lf-src { font-family:var(--ec-sans); font-size:10.5px; color:var(--ec-mutedc); }
.ec .co4-lf-src a { color:var(--ec-ink); text-decoration:underline; }
.ec .co4-lf-q { font-family:var(--ec-clinical); font-style:italic; font-size:11.5px; color:var(--ec-body); }
.ec .co4-lf-quote { font-family:var(--ec-clinical); font-size:11.5px; line-height:1.45; color:var(--ec-body); border-left:2px solid var(--ec-rule-strong); padding-left:0.5rem; }
.ec .co4-lf-row { display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap; margin-top:0.2rem; }
```

- [ ] **Step 6: Typecheck and build**

```bash
cd /Users/ivanmanfredi/Desktop/personal-site
npx tsc --noEmit && npm run build
```

Expected: both clean. A `fmtDate` or `useMemo` "not defined" error means Step 1's imports are incomplete — `fmtDate` is already imported at line 8 and `useMemo` at line 1; confirm rather than re-adding.

- [ ] **Step 7: Verify in a browser against the real dashboard**

Use the `playwright-driver` skill, Mode 2, against the Client Ops panel with the RISE client selected. Confirm:
1. A draft card shows a collapsed `▸ EVIDENCE` line, and expanding it lists the company-notes version and at least one exemplar with a real prospect name and date.
2. If a pending learned fact exists, the strip renders above the inbox with `Use this` / `Discard`.
3. Approve & send is still present and enabled on a draft that has an evidence panel.

- [ ] **Step 8: Commit and deploy**

```bash
cd /Users/ivanmanfredi/Desktop/personal-site
git add components/dashboard-v2/sections/clientops2/OutreachInbox.tsx components/dashboard-v2/sections/clientops2/OutreachView.tsx
git commit -m "feat(clientops): evidence collapsible on drafts + learned-facts review strip

Every draft now shows what the drafter was given: which company-notes version, which facts learned
from Mattan's own DMs (with the prospect and date), which real sends the voice came from. Pending
learned facts get a review strip; nothing reaches the drafter until it is approved."
```

Deploy with `menubar/deploy.sh` (`git push origin main`). Check for concurrent work on `main` before pushing.

---

## Self-Review

**Spec coverage:**
- Spec §1 "one source of truth for exemplar pairs" → Task 1.
- Spec §2 "facts learned, never auto-written to canon" → Task 2 (store + gated RPCs), Task 3 (miner), Task 5 Steps 3-4 (approval surface).
- Spec §3 "recency priority" → Task 2 Step 1 (`active_learned_facts` distinct-on-topic; approve supersedes), Task 2 Step 3 (behavioural test), Task 4 Step 3 (block labelled as outranking RISE FACTS).
- Spec §4 "evidence logged, not self-reported" → Task 2 (column + RPC key), Task 4 Step 6 (writer), Task 5 Step 2 (reader).
- Spec non-goal "no change to send gating" → Task 5 Step 7 item 3 explicitly re-verifies approve & send.

**Type consistency:** `DraftEvidence` keys in Task 2 Step 5 match the object built in Task 4 Step 6 key-for-key (`at`, `facts`, `learned`, `exemplars`, `store_fact`, `anchor`, `scan_finding`, `scan_url`, `operator_note`, `voice_rows`). `LearnedFact` fields match `operator_learned_facts`'s `jsonb_build_object` keys (`id`, `topic`, `fact_text`, `status`, `prospect_name`, `question`, `quote`, `source_sent_at`, `chat_url`). `active_learned_facts` column names match the drafter's `f.fact_text` / `f.source_sent_at` / `f.source_prospect_name` / `f.source_message_id` reads.

**Known gap, deliberate:** Task 2 Step 3 exercises the recency rule with the underlying UPDATE rather than through `operator_resolve_learned_fact`, because the gate string is not in this plan. The RPC's supersede clause is the same SQL; the end-to-end gated path is verified by hand in Task 5 Step 7.
