# UTM Convention (Wave 0 / P30-2)

> Authoritative spec for every link that points back to ivanmanfredi.com or
> resources.ivanmanfredi.com. Every surface that sends traffic to those domains
> MUST tag according to this convention. Anything untagged degrades to
> `(direct)` in the dashboard and burns weeks of attribution data.

## Quick reference

```
?utm_source=<source>
&utm_medium=<medium>
&utm_campaign=<campaign>
&utm_content=<content>      (optional — post id, DM template id)
&utm_term=<term>            (optional — keyword, post topic)
&ref=<referral-token>       (optional — referral attribution)
```

## Allowed values

### `utm_source` — where the click came from
- `linkedin` — LinkedIn (any surface: post, DM, profile, comment)
- `outreach` — automated outreach DMs (n8n WF3/WF5)
- `nurture` — automated nurture emails (post-LM drip)
- `podcast` — podcast guest appearances
- `referral` — past clients sending warm intros
- `google` — organic search
- `direct` — typed URL or no referrer (rarely tagged manually)
- `upwork` — Upwork proposals (when on cold-tail mode)
- `lm-share` — auto-tagged when an LM result is shared via the share button

### `utm_medium` — what kind of surface
- `profile` — LinkedIn bio link
- `post` — LinkedIn post body
- `comment` — LinkedIn comment
- `dm` — LinkedIn direct message
- `bio` — any short-bio surface (Calendly profile, podcast episode notes)
- `newsletter` — Resend nurture email body
- `calendly_link` — Calendly redirect (auto-injected by withUtmParams)
- `referral` — referral CTA on /refer or shared LM URL

### `utm_campaign` — campaign name
Slug-style, lowercase, dash-separated. Examples:
- `agency-q2-2026` — Q2 2026 push to agencies
- `blueprint-launch` — initial $2,500 Blueprint launch announcement
- `agent-ready-letter-issue-3` — newsletter issue 3
- `consultancies-q2-2026` — outreach campaign
- `manual-dm-2026-05` — month-bucketed manual DMs

### `utm_content` — post id / DM template id
For automated content this is auto-injected. For manual posts use the ClickUp
LinkedIn Posts task id (e.g. `t-86afdpost123`).

### `ref` — referral token
Format: `r-<8charhex>`. Issued from /refer page (when built); maps to
`referrer_email` via the referral_tokens table.

## Examples

```
# Newsletter issue link
https://ivanmanfredi.com/assessment?utm_source=nurture&utm_medium=newsletter&utm_campaign=agent-ready-letter-issue-3

# LinkedIn post link
https://ivanmanfredi.com/?utm_source=linkedin&utm_medium=post&utm_campaign=organic-2026-05&utm_content=t-86afdpost123

# Outreach DM link
https://ivanmanfredi.com/lead-magnet-system?utm_source=outreach&utm_medium=dm&utm_campaign=consultancies-q2-2026

# Profile bio link
https://ivanmanfredi.com/?utm_source=linkedin&utm_medium=profile&utm_campaign=bio-2026

# Shared LM result link (auto-injected by share button)
https://resources.ivanmanfredi.com/agency-ai-agent-roi-calculator-50k-investment-vs-billable-hours/?utm_source=lm-share&utm_medium=referral&utm_campaign=agency-ai-agent-roi-calculator
```

## How attribution flows downstream

1. `lib/pageviewTracker.ts` calls `captureUtmFromUrl()` on every pageview;
   first-touch wins and is persisted to `sessionStorage` + `localStorage`.
2. `lib/utmCapture.ts::buildStripeCheckoutUrl()` packs the UTM payload into
   Stripe's `client_reference_id` (200 char limit) before redirect.
3. `stripe-webhook` decodes the `client_reference_id` fingerprint and writes
   `paid_assessments.utm_source/medium/campaign/content`, plus `referral_token`
   and a high-level `source` bucket.
4. `lib/utmCapture.ts::withUtmParams()` decorates Calendly URLs with the
   captured UTMs; Calendly forwards them as `tracking.utm_*` to the webhook.
5. `calendly-webhook` writes `calendar_events.utm_*` and `booking_source_path`.
6. `lm_events` already collects UTM as `jsonb`; the wave-0 migration mirrors
   it to explicit `utm_*` columns.

## Auto-fail rules

- LinkedIn link to ivanmanfredi.com without `utm_source=linkedin` → fix.
- Outreach DM link without `utm_source=outreach&utm_medium=dm` → fix.
- Newsletter link without `utm_source=nurture&utm_medium=newsletter` → fix.
- Calendly external link without `utm_medium=calendly_link` → fix.

## See also

- `docs/utm-manual-todos.md` — surfaces that Claude can't touch (Ivan's bio,
  manual DMs that aren't auto-generated, etc.). Manual one-time work.
- `lib/utmCapture.ts` — the capture/replay implementation.
