# Scorecard Project — State + Handoff

**Last updated:** 2026-04-30 (Phase 2 frontend + edge functions auto-deployed)

This doc tracks what's live in production vs. what still requires your hands. Read top to bottom.

---

## What's already live in production

### Database (Supabase project `bjbvqvzbzczjbatgmccb`)
- ✅ Table `free_diagnostics` (Phase 1 migration applied)
- ✅ Column `share_count` (Phase 2 migration applied)

### Edge functions (4 total, all deployed)
- ✅ `scorecard-submit` — POST creates row from quiz completion
- ✅ `scorecard-get` — GET sanitized row by id (used by SPA result viewer + Cloudflare Worker)
- ✅ `scorecard-add-email` — POST adds email to existing row, fires drip webhook
- ✅ `scorecard-share` — POST increments share_count

All four have `verify_jwt: false` (public). Validation is in-function.

### SPA (deployed via GitHub Pages on every push to `main`)
- ✅ `/scorecard` — Likert quiz, submits + navigates to result viewer
- ✅ `/scorecard/result/:id` — viewer page (submit mode shows email gate, view mode shows "Take your own scorecard" CTA)
- ✅ `/scorecard/roadmap/:slug` — 4 brand-styled roadmap pages
- ✅ Hero, Services, Navbar updates
- ✅ Share button on result page (currently shares canonical SPA URL — see Step 3 below to upgrade to OG-rich URL)

---

## What still needs your hands — in order

### Step 1: Activate the email drip (n8n workflow)

**Why:** Right now, scorecard submissions land in Supabase but no email goes out. The drip workflow needs to be imported into n8n + activated.

**Time:** ~30 minutes.

1. Open https://n8n.ivanmanfredi.com
2. **Workflows** → **Import from File** → select `docs/scorecard-drip/n8n-workflow.json`
3. Workflow imports as inactive with name **Scorecard Followup**
4. Click into the workflow

#### 1a. Wire Resend credentials on each Send Email node

The 5 HTTP Request nodes (Send Email 1, 2, 3, 4-A, 4-B) all need a Resend Bearer token. Use the existing `RESEND_API_KEY_ASSESSMENT` from Supabase Vault.

For each Send Email node:
- Authentication → Generic Credential Type → Header Auth
- Create credential (name: `Resend Assessment API`)
- Header name: `Authorization`
- Header value: `Bearer re_YOUR_KEY` (paste the value of `RESEND_API_KEY_ASSESSMENT`)
- Save, reuse on the other 4 nodes

#### 1b. Copy the production webhook URL

Open the **Webhook** node → copy the **Production URL** (looks like `https://n8n.ivanmanfredi.com/webhook/scorecard-followup`).

#### 1c. Activate the workflow

Toggle the workflow to **Active**.

#### 1d. Set the webhook env var on Supabase

```bash
# Either via CLI:
supabase secrets set SCORECARD_FOLLOWUP_WEBHOOK_URL=https://n8n.ivanmanfredi.com/webhook/scorecard-followup --project-ref bjbvqvzbzczjbatgmccb

# Or via dashboard:
# https://supabase.com/dashboard/project/bjbvqvzbzczjbatgmccb/settings/functions → Edit Function Secrets
```

The edge function reads env vars on cold start, so the next invocation picks it up automatically.

#### 1e. End-to-end test

1. Open https://ivanmanfredi.com/scorecard in incognito
2. Take the quiz, submit any email you control
3. Email 1 should arrive within 60s
4. To skip the 3-day wait for testing, find the execution in n8n → click into it → on the `Wait 3 days` node, hit **Resume from here** → Email 2 fires immediately

**Rollback:** Toggle the workflow inactive. In-flight executions can be cancelled in n8n's executions panel. Already-saved Supabase rows are untouched.

---

### Step 2: Activate shareable cards (Cloudflare Worker)

**Why:** The Share button on `/scorecard/result/:id` currently copies a canonical SPA URL. LinkedIn previews work, but show a generic site card. This step swaps to a custom domain that serves OG-rich previews per result.

**Time:** ~30–45 minutes.

#### 2a. Deploy the Worker

```bash
cd ~/Desktop/personal-site/cloudflare-share-worker
npm install
npx wrangler login   # opens browser, log in to the Cloudflare account that owns ivanmanfredi.com
npx wrangler deploy
```

#### 2b. Wire DNS

In Cloudflare dashboard for `ivanmanfredi.com`:
1. **DNS** → **Add record**
2. Type: `AAAA` · Name: `share` · IPv6 address: `100::` · Proxy: **Proxied** (orange cloud)
3. Save

The Worker's route binding (in `wrangler.toml`) already points `share.ivanmanfredi.com/*` at the Worker.

#### 2c. Verify the Worker

```bash
# Submit a test scorecard to get an id
ID=$(curl -s -X POST https://bjbvqvzbzczjbatgmccb.supabase.co/functions/v1/scorecard-submit \
  -H 'Content-Type: application/json' \
  -d '{"scores":{"structured_input":5,"decision_logic":4,"narrow_scope":5,"human_loop":4},"verdict":"agent_ready"}' \
  | grep -oE '[0-9a-f-]{36}')

# HTML
curl -i "https://share.ivanmanfredi.com/scorecard/$ID" | head -30

# OG image
curl -o /tmp/og-test.png "https://share.ivanmanfredi.com/scorecard/$ID/og.png" && open /tmp/og-test.png
```

The OG image should render: "Agent-Ready Scorecard" eyebrow, italic "Manfredi" logo, italic verdict label, large italic numeral score, hairline rule, mono URL.

#### 2d. Switch the Share button to use share.* URLs

```bash
cd ~/Desktop/personal-site
echo 'VITE_SHARE_DOMAIN=https://share.ivanmanfredi.com' >> .env.production
git add .env.production
git commit -m "scorecard: route Share button through share.ivanmanfredi.com"
git push origin main
```

Or set it as a GitHub Actions secret if `.env.production` isn't appropriate.

#### 2e. LinkedIn-specific check

Paste a share URL into [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/). The preview should show the verdict card. If it doesn't, hit "Re-fetch" — LinkedIn caches OG images.

**Rollback:** Remove `VITE_SHARE_DOMAIN` env var, redeploy. Share button falls back to canonical SPA URL.

---

### Step 3: Soft launch announcement

Once Steps 1 + 2 are validated, write a single LinkedIn post announcing the Scorecard. Editorial, not pitchy.

Suggested arc:
> "I built a free 4-question Scorecard against the four preconditions every AI deployment needs before it ships.
>
> 60 seconds. You get a verdict, a per-precondition breakdown, and a personalized 30-day roadmap by email.
>
> ivanmanfredi.com/scorecard"

---

## Files in this project

### Local source (committed)
- `lib/preconditions.ts` — canonical 4 preconditions
- `lib/scorecard.ts` — scoring logic
- `lib/roadmaps.ts` — 30-day roadmap content
- `components/Hero.tsx` · `Services.tsx` · `Navbar.tsx` — Phase 0 polish
- `components/ScorecardPage.tsx` — quiz flow
- `components/ScorecardResultViewerPage.tsx` — `/scorecard/result/:id`
- `components/scorecard/ScorecardQuestion.tsx` · `ScorecardResult.tsx` — quiz + result UI
- `components/RoadmapPage.tsx` — `/scorecard/roadmap/:slug`
- `migrations/free_diagnostics_table.sql` · `free_diagnostics_share_count.sql`
- `supabase/functions/scorecard-submit/` · `scorecard-get/` · `scorecard-add-email/` · `scorecard-share/`
- `cloudflare-share-worker/` — Worker source + README

### Documentation
- `docs/scorecard-drip/_DRAFT-COPY.md` — readable email copy reference
- `docs/scorecard-drip/n8n-workflow.json` — importable workflow
- `docs/scorecard-drip/DEPLOY-CHECKLIST.md` — superseded by this doc; keep as historical reference
- `docs/scorecard-drip/HANDOFF.md` — this file

---

## Health-check rituals

### Daily (first 2 weeks after launch)
- Check `free_diagnostics` row count → expect 1+/day after first LinkedIn post
- Spot-check rows for malformed `scores` jsonb
- Check n8n executions panel for failed runs
- Check Resend dashboard for bounced sends

### Weekly
- Read 1 random Email 1 + 4 to confirm copy still feels right
- Track `share_count` distribution — if <5% of completions share after 30 days, OG card design needs work or share button needs more prominence
- Watch for unsubscribe replies → manually remove from drip until proper unsub edge function ships

---

## Known tradeoffs / future work

- **Verdict on submit comes from frontend, not recomputed in edge function.** Tampering possible. Low risk for now (no money tied to verdict). Fix: have `scorecard-submit` recompute verdict from scores via shared scoring logic.
- **No proper unsubscribe handler.** Email links go to `mailto:hello@ivanmanfredi.com?subject=Unsubscribe ${id}`. Manual processing fine for first batch; build a real `unsubscribe` edge function when inbound volume hits ~10/day.
- **No `List-Unsubscribe` header on Resend payloads.** Add to the 5 HTTP nodes when convenient — Gmail/Apple Mail show one-click unsub at top of email.
- **No drip-stop on Blueprint purchase.** When someone buys the Blueprint, drip keeps running until day 10. Wire the existing Stripe webhook to set `engaged=true` on `free_diagnostics` matching email.
- **Email copy embedded in n8n.** Lives in the Code node, not in ClickUp. Iterate on copy by editing the workflow directly.
- **Roadmap pages are static React components.** If you want to edit a roadmap without redeploying, move content from `lib/roadmaps.ts` into a Supabase table or ClickUp doc. Not a priority.
