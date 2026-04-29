# Phase 1 Deploy Checklist — Scorecard + Email Drip

This walks the Scorecard + Drip from local-only to live in production. Steps are ordered by dependency. Don't skip ahead.

---

## 0. What's already done locally

- ✅ `/scorecard` page (4-question Likert, 3-band scoring)
- ✅ `/scorecard/roadmap/:slug` pages (4 roadmap pages, one per precondition)
- ✅ Hero + Services + Navbar updates
- ✅ `lib/preconditions.ts` (single source of truth)
- ✅ `lib/scorecard.ts` (scoring logic)
- ✅ `lib/roadmaps.ts` (roadmap content)
- ✅ `migrations/free_diagnostics_table.sql` (Supabase migration)
- ✅ `supabase/functions/scorecard-submit/index.ts` (edge function)
- ✅ `docs/scorecard-drip/n8n-workflow.json` (importable n8n workflow)
- ✅ `docs/scorecard-drip/_DRAFT-COPY.md` (email copy reference)

All committed locally to the personal-site repo. **Nothing is in production yet.**

---

## 1. Apply Supabase migration

The `free_diagnostics` table doesn't exist in prod yet.

**Option A — Supabase CLI (recommended):**

```bash
cd ~/Desktop/personal-site
supabase db push --linked
# OR if you prefer pasting SQL:
supabase db execute --file migrations/free_diagnostics_table.sql --linked
```

**Option B — Supabase dashboard:**

1. Open https://supabase.com/dashboard/project/bjbvqvzbzczjbatgmccb/sql/new
2. Paste the contents of `migrations/free_diagnostics_table.sql`
3. Run

**Verify:**
```sql
select count(*) from free_diagnostics;
-- should return 0 rows, no error
```

---

## 2. Deploy `scorecard-submit` edge function

```bash
cd ~/Desktop/personal-site
supabase functions deploy scorecard-submit --project-ref bjbvqvzbzczjbatgmccb
```

**Verify:**
```bash
curl -i -X OPTIONS https://bjbvqvzbzczjbatgmccb.supabase.co/functions/v1/scorecard-submit
# expect: HTTP/2 200, with CORS headers
```

A real test (replace with your service-role key for auth bypass; or omit for public access):
```bash
curl -X POST https://bjbvqvzbzczjbatgmccb.supabase.co/functions/v1/scorecard-submit \
  -H "Content-Type: application/json" \
  -H "apikey: $(supabase secrets list --project-ref bjbvqvzbzczjbatgmccb | grep VITE_SUPABASE_ANON_KEY)" \
  -d '{"scores":{"structured_input":4,"decision_logic":3,"narrow_scope":5,"human_loop":4},"verdict":"close","email":"test@example.com"}'
# expect: { ok: true, id: "...", verdict: "close" }
```

Then verify in DB:
```sql
select id, email, verdict, total, created_at from free_diagnostics order by created_at desc limit 1;
```

---

## 3. Import + configure the n8n workflow

1. Open https://n8n.ivanmanfredi.com in browser
2. **Workflows** → **Import from File** → select `docs/scorecard-drip/n8n-workflow.json`
3. Workflow imports as inactive with name **Scorecard Followup**
4. Click into the workflow

### 3a. Wire Resend credentials

Each of the 5 HTTP Request nodes (Send Email 1/2/3/4-A/4-B) needs a Resend API key.

1. Open any "Send Email" node
2. Under **Authentication** → **Generic Credential Type** → **Header Auth**
3. **Credential to connect with:** create new (or reuse existing)
4. Name: `Resend Assessment API`
5. Header name: `Authorization`
6. Header value: `Bearer re_YOUR_RESEND_API_KEY` (use the key already stored as `RESEND_API_KEY_ASSESSMENT` in Supabase Vault)
7. Save
8. Reuse the same credential on all 5 HTTP nodes

### 3b. Activate the webhook

1. Click the **Webhook** node
2. Copy the **Production URL** (looks like `https://n8n.ivanmanfredi.com/webhook/scorecard-followup`)
3. Save it — you need it for step 4

### 3c. Activate the workflow

Toggle **Active** in the top-right corner.

---

## 4. Wire the webhook URL into the edge function

The edge function fires `SCORECARD_FOLLOWUP_WEBHOOK_URL` if set. You need to set it to the n8n webhook URL.

```bash
supabase secrets set SCORECARD_FOLLOWUP_WEBHOOK_URL=https://n8n.ivanmanfredi.com/webhook/scorecard-followup --project-ref bjbvqvzbzczjbatgmccb
```

Or via the Supabase dashboard:
1. Open https://supabase.com/dashboard/project/bjbvqvzbzczjbatgmccb/settings/functions
2. Edit secrets → add `SCORECARD_FOLLOWUP_WEBHOOK_URL`
3. Value: the n8n webhook URL from step 3b

The edge function reads env vars on cold start, so re-deploy to pick up the new secret:

```bash
supabase functions deploy scorecard-submit --project-ref bjbvqvzbzczjbatgmccb
```

---

## 5. Push the site changes to production

The new pages (`/scorecard`, `/scorecard/roadmap/:slug`) and Hero/Services/Navbar updates need to ship via GitHub Pages.

```bash
cd ~/Desktop/personal-site
git status                                  # confirm what's staged
git push origin main                        # GitHub Actions builds + deploys
```

Wait ~60s for the deploy. Verify:
- https://ivanmanfredi.com/ — new Hero with wordmark strip + "Are you Agent-Ready?" CTA
- https://ivanmanfredi.com/scorecard — quiz works
- https://ivanmanfredi.com/scorecard/roadmap/reliable-input-pipeline — roadmap renders

---

## 6. End-to-end test (real email)

Submit a real test scorecard via the live site:

1. Open https://ivanmanfredi.com/scorecard in an incognito window
2. Pick deliberately mixed scores so verdict = `close` (e.g. score 12)
3. After seeing the verdict, enter your real email in the gate
4. Wait ~30s

**Checks:**
- ✅ Email 1 lands in your inbox within 60s
- ✅ Subject reads: `Your Agent-Ready verdict (12/20)`
- ✅ Body shows correct verdict + weakest precondition
- ✅ "Read your 30-day roadmap" link → opens the right `/scorecard/roadmap/:slug`
- ✅ Result URL works
- ✅ Supabase `free_diagnostics` has the row with `email`, `verdict`, `total`

**Test the wait nodes (without waiting 10 days):**

In n8n, find the most recent execution → click into it → on the `Wait 3 days` node, click **Resume from here** to skip the wait. Verify Email 2 arrives.

**Test all 3 verdict paths:**

Submit 3 more scorecards with deliberately different scores: 18 (agent_ready), 12 (close), 8 (foundation). Verify:
- Score 18 + 12 → Email 4-A (Blueprint CTA)
- Score 8 → Email 4-B (Discovery call CTA)

---

## 7. Soft launch announcement (optional, recommended)

Once the drip is verified, write a single LinkedIn post announcing the Scorecard. Keep it editorial, not pitchy. Suggested arc:

> "I built a free 4-question Scorecard against the four preconditions every AI deployment needs before it ships.
> 
> 60 seconds. You get a verdict, a per-precondition breakdown, and a personalized 30-day roadmap by email.
> 
> ivanmanfredi.com/scorecard"

Don't post until E2E test passes.

---

## What's deferred (Phase 2+)

These are explicitly NOT shipping in Phase 1. Track in the plan file:

- **Shareable verdict cards** — needs `share.ivanmanfredi.com` Cloudflare Worker (Phase 2)
- **Live eat-your-own-cooking case study** — needs `public_engine_metrics()` RPC (Phase 3)
- **`/podcast` page** — engineering rails for podcast distribution (parallel)
- **Landing polish** — View Transitions, reading progress, drop caps, hover prefetch (parallel)

---

## Rollback plan

If Email 1 lands broken, immediately:
1. Toggle the n8n workflow to **inactive** — stops queueing new executions
2. Cancel all in-flight executions in n8n's executions panel
3. Roll the edge function back: `supabase functions deploy scorecard-submit --project-ref ...` after reverting the relevant commit
4. Or hot-fix: edit the Code node in n8n directly, save, re-activate

Phase 1 is small enough that all components can be reverted in <5 min.

---

## Health-check rituals (after launch)

Daily for the first 2 weeks:
- Check `free_diagnostics` row count → expect 1+/day after first LinkedIn post
- Spot-check a few rows for malformed `scores` jsonb
- Check n8n executions panel for failed runs
- Check Resend dashboard for bounced sends

Weekly:
- Track `share_count` once Phase 2 ships
- Read 1 random verdict-path Email 1 + 4 to confirm copy still feels right
- Watch for unsubscribe replies → manually remove from drip if needed (until proper unsub edge function ships)

---

## Notes for future improvements (low priority)

- **Proper unsubscribe edge function:** currently uses `mailto:hello@ivanmanfredi.com?subject=Unsubscribe ${id}`. Manual handling fine for low volume. When inbound volume hits ~10/day, build a real `unsubscribe` edge function that flips a column.
- **List-Unsubscribe header:** add `List-Unsubscribe: <mailto:...>` to Resend payloads (Gmail/Apple Mail show one-click unsub button at top). Add to all 5 HTTP nodes when you have a moment.
- **Drip-stop on Blueprint purchase:** wire the existing Stripe webhook to set a `engaged=true` flag on `free_diagnostics` when a Blueprint is purchased by the same email. n8n workflow checks the flag before each subsequent send.
- **Move email copy to ClickUp:** if Iván wants to edit copy without touching n8n, replace the inline strings in the Code node with HTTP calls to ClickUp doc pages at send time. Tradeoff: more failure modes.
